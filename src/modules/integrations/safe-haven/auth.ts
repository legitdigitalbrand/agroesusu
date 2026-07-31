// ============================================================================
// Safe Haven OAuth Authentication Service
//
// Dedicated module for Safe Haven OAuth2 server-to-server authentication.
//
// Responsibilities:
//   - Generate RS256 JWT client assertions
//   - Exchange assertions for access tokens
//   - Cache tokens until near expiry
//   - Refresh/re-request when expired
//   - Structured logging (NO secrets ever logged)
//   - Never expose secrets or tokens to the frontend
//
// Security:
//   - Private key is read from environment (SAFEHAVEN_PRIVATE_KEY)
//   - Private key is NEVER logged, returned by API, or sent to the client
//   - Access token is NEVER returned to the frontend
//   - All errors are sanitized before returning to callers
// ============================================================================

import crypto from 'crypto';

// ── Types ──

interface SafeHavenTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  ibs_client_id?: string;
}

interface CachedToken {
  accessToken: string;
  ibsClientId: string;
  expiresAt: number; // Unix timestamp (ms)
}

interface StructuredLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  correlationId: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// ── Error Types ──

export type SafeHavenAuthErrorCode =
  | 'invalid_client'
  | 'invalid_grant'
  | 'invalid_request'
  | 'unauthorized'
  | 'timeout'
  | 'network_error'
  | 'malformed_response'
  | 'missing_config'
  | 'signing_error'
  | 'unknown';

export class SafeHavenAuthError extends Error {
  code: SafeHavenAuthErrorCode;
  statusCode: number;
  constructor(code: SafeHavenAuthErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'SafeHavenAuthError';
    this.code = code;
    this.statusCode = statusCode || 0;
  }
}

// ── Configuration ──

export interface SafeHavenAuthConfig {
  clientId: string;
  privateKey: string; // PEM-encoded RSA private key
  apiUrl: string;     // e.g. https://api.sandbox.safehavenmfb.com
  issuer?: string;     // Issuer claim (defaults to company URL)
  tokenPath?: string;  // Defaults to /oauth2/token
  tokenExpirySeconds?: number; // JWT assertion expiry (default 300 = 5 min)
  refreshBufferMs?: number;    // Refresh before expiry (default 60s)
  requestTimeoutMs?: number;   // HTTP timeout (default 15s)
}

// ── Auth Service ──

export class SafeHavenAuthService {
  private config: Required<SafeHavenAuthConfig>;
  private tokenCache: CachedToken | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(config: SafeHavenAuthConfig) {
    this.config = {
      tokenPath: '/oauth2/token',
      issuer: 'https://agriqcap.vercel.app',
      tokenExpirySeconds: 300,
      refreshBufferMs: 60_000,
      requestTimeoutMs: 15_000,
      ...config,
    } as Required<SafeHavenAuthConfig>;
  }

  // ═══════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════

  /**
   * Obtain a valid access token. Returns cached token if still valid.
   * Refreshes automatically when expired. Uses a single-flight
   * promise to prevent concurrent token requests.
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if valid
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + this.config.refreshBufferMs) {
      this.log('info', 'token_cache_hit', 'Using cached access token (still valid)');
      return this.tokenCache.accessToken;
    }

    // Single-flight: if a refresh is already in progress, await it
    if (this.refreshPromise) {
      this.log('info', 'token_refresh_in_flight', 'Awaiting in-flight token refresh');
      return this.refreshPromise;
    }

    // Start a new token request — store as string promise for single-flight
    this.refreshPromise = this.requestNewToken().then((t) => t.accessToken);
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Get the IBS client ID (returned by Safe Haven alongside the token).
   */
  getIbsClientId(): string {
    return this.tokenCache?.ibsClientId || '';
  }

  /**
   * Invalidate the cached token, forcing a fresh request on next call.
   */
  invalidateToken(): void {
    this.log('warn', 'token_invalidated', 'Token cache invalidated');
    this.tokenCache = null;
  }

  /**
   * Health check: can we obtain a token right now?
   * Returns a safe status object — never includes the token.
   */
  async healthCheck(): Promise<{
    status: 'connected' | 'disconnected';
    environment: string;
    message: string;
    latencyMs: number;
  }> {
    const start = Date.now();
    try {
      await this.getAccessToken();
      return {
        status: 'connected',
        environment: this.config.apiUrl.includes('sandbox') ? 'sandbox' : 'production',
        message: 'Successfully obtained Safe Haven access token',
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      const code = err instanceof SafeHavenAuthError ? err.code : 'unknown';
      return {
        status: 'disconnected',
        environment: this.config.apiUrl.includes('sandbox') ? 'sandbox' : 'production',
        message: `Failed to obtain token: ${code}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Internal: Token Request
  // ═══════════════════════════════════════════════════════════

  private async requestNewToken(): Promise<CachedToken> {
    const correlationId = crypto.randomUUID();
    this.log('info', 'token_request_started', 'Requesting new Safe Haven access token', { correlationId });

    // Validate config
    if (!this.config.clientId || !this.config.privateKey || !this.config.apiUrl) {
      throw new SafeHavenAuthError(
        'missing_config',
        'Missing required Safe Haven configuration (client ID, private key, or API URL)',
      );
    }

    // Generate JWT client assertion
    const clientAssertion = this.generateClientAssertion(correlationId);

    // Build request body
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_assertion: clientAssertion,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    });

    const tokenUrl = `${this.config.apiUrl}${this.config.tokenPath}`;

    // Make the request with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Parse response
      let responseBody: unknown;
      try {
        responseBody = await response.json();
      } catch {
        throw new SafeHavenAuthError(
          'malformed_response',
          `Safe Haven returned non-JSON response (HTTP ${response.status})`,
          response.status,
        );
      }

      if (!response.ok) {
        throw this.handleErrorResponse(response.status, responseBody, correlationId);
      }

      // Validate response shape
      const tokenResponse = responseBody as SafeHavenTokenResponse;
      if (!tokenResponse.access_token || typeof tokenResponse.access_token !== 'string') {
        throw new SafeHavenAuthError(
          'malformed_response',
          'Safe Haven response missing access_token field',
          response.status,
        );
      }

      // Cache the token
      const expiresIn = tokenResponse.expires_in || 3600;
      this.tokenCache = {
        accessToken: tokenResponse.access_token,
        ibsClientId: tokenResponse.ibs_client_id || '',
        expiresAt: Date.now() + expiresIn * 1000,
      };

      this.log('info', 'token_request_succeeded', 'Successfully obtained Safe Haven access token', {
        correlationId,
        expiresIn,
        hasIbsClientId: !!tokenResponse.ibs_client_id,
      });

      return this.tokenCache;

    } catch (err) {
      clearTimeout(timeout);

      // Re-throw SafeHavenAuthError as-is
      if (err instanceof SafeHavenAuthError) {
        throw err;
      }

      // Handle abort/timeout
      if (err instanceof DOMException && err.name === 'AbortError') {
        this.log('error', 'token_request_timeout', 'Safe Haven token request timed out', { correlationId });
        throw new SafeHavenAuthError('timeout', 'Safe Haven token request timed out');
      }

      // Handle network errors
      this.log('error', 'token_request_network_error', 'Network error requesting Safe Haven token', {
        correlationId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new SafeHavenAuthError(
        'network_error',
        `Network error communicating with Safe Haven: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Internal: JWT Generation
  // ═══════════════════════════════════════════════════════════

  private generateClientAssertion(correlationId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.config.tokenExpirySeconds;

    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: this.config.issuer,      // Agriqcap company URL
      sub: this.config.clientId,     // Safe Haven OAuth Client ID
      aud: this.config.apiUrl,       // https://api.sandbox.safehavenmfb.com
      iat: now,
      exp,
      jti: crypto.randomUUID(),
    };

    // Encode header and payload
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signingInput = `${headerB64}.${payloadB64}`;

    // Normalize private key (handle \n escapes from env vars)
    const privateKeyPem = this.normalizePrivateKey(this.config.privateKey);

    try {
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(signingInput);
      const signature = sign.sign(privateKeyPem, 'base64url');

      this.log('info', 'assertion_generated', 'JWT client assertion generated', {
        correlationId,
        exp,
        ttlSeconds: this.config.tokenExpirySeconds,
      });

      return `${signingInput}.${signature}`;
    } catch (err) {
      this.log('error', 'assertion_signing_failed', 'Failed to sign JWT assertion', {
        correlationId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new SafeHavenAuthError(
        'signing_error',
        'Failed to sign JWT client assertion with private key',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Internal: Error Handling
  // ═══════════════════════════════════════════════════════════

  private handleErrorResponse(status: number, body: unknown, correlationId: string): SafeHavenAuthError {
    const errorBody = body as Record<string, unknown>;
    const errorStr = (errorBody?.error as string) || '';

    this.log('error', 'token_request_failed', 'Safe Haven rejected token request', {
      correlationId,
      httpStatus: status,
      errorCode: errorStr || 'unknown',
    });

    // Map Safe Haven error codes to our error types
    const codeMap: Record<string, SafeHavenAuthErrorCode> = {
      invalid_client: 'invalid_client',
      invalid_grant: 'invalid_grant',
      invalid_request: 'invalid_request',
      unauthorized: 'unauthorized',
    };

    const code = codeMap[errorStr] || 'unknown';
    const safeMessage = this.sanitizeErrorMessage(code, status);

    return new SafeHavenAuthError(code, safeMessage, status);
  }

  /**
   * Sanitize error messages — never expose credentials, keys, or tokens
   */
  private sanitizeErrorMessage(
    code: SafeHavenAuthErrorCode,
    status: number,
  ): string {
    // Generic safe messages by error code
    const safeMessages: Partial<Record<SafeHavenAuthErrorCode, string>> = {
      invalid_client: 'Safe Haven rejected the client credentials',
      invalid_grant: 'Safe Haven rejected the client assertion (check key validity)',
      invalid_request: 'Safe Haven rejected the request format',
      unauthorized: 'Safe Haven denied authorization',
      timeout: 'Safe Haven request timed out',
      network_error: 'Network error communicating with Safe Haven',
      malformed_response: 'Safe Haven returned a malformed response',
      missing_config: 'Missing Safe Haven configuration',
      signing_error: 'Failed to sign JWT assertion',
      unknown: `Safe Haven returned HTTP ${status}`,
    };

    return safeMessages[code] || `Safe Haven error (HTTP ${status})`;
  }

  // ═══════════════════════════════════════════════════════════
  // Internal: Utilities
  // ═══════════════════════════════════════════════════════════

  /**
   * Normalize a private key from environment variable.
   * Handles \n escapes and ensures proper PEM format.
   */
  private normalizePrivateKey(key: string): string {
    // Replace literal \n with actual newlines (from env var escaping)
    let normalized = key.replace(/\\n/g, '\n');

    // If the key doesn't start with -----BEGIN, it might be base64 or raw
    if (!normalized.includes('-----BEGIN')) {
      // Try to reconstruct PEM format
      normalized = `-----BEGIN PRIVATE KEY-----\n${normalized}\n-----END PRIVATE KEY-----`;
    }

    return normalized;
  }

  /**
   * Structured logging — NEVER logs secrets, tokens, or private keys.
   */
  private log(
    level: 'info' | 'warn' | 'error',
    event: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      correlationId: (metadata?.correlationId as string) || crypto.randomUUID(),
      message,
      metadata: metadata
        ? Object.fromEntries(
            Object.entries(metadata).filter(([k]) => {
              // NEVER log: private keys, tokens, assertions, secrets
              const forbidden = ['privateKey', 'token', 'accessToken', 'assertion', 'clientAssertion', 'secret'];
              return !forbidden.some((f) => k.toLowerCase().includes(f.toLowerCase()));
            }),
          )
        : undefined,
    };

    const prefix = `[SafeHavenAuth] ${entry.timestamp} [${entry.level.toUpperCase()}]`;
    const metaStr = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    const logLine = `${prefix} ${entry.event}: ${entry.message}${metaStr}`;

    if (level === 'error') {
      console.error(logLine);
    } else if (level === 'warn') {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// Factory: Create auth service from environment variables
// ═══════════════════════════════════════════════════════════

let _authServiceInstance: SafeHavenAuthService | null = null;

/**
 * Get the singleton SafeHavenAuthService instance, configured from
 * environment variables. Throws if required env vars are missing.
 */
export function getSafeHavenAuthService(): SafeHavenAuthService {
  if (_authServiceInstance) {
    return _authServiceInstance;
  }

  const clientId = process.env.SAFEHAVEN_CLIENT_ID;
  const privateKey = process.env.SAFEHAVEN_PRIVATE_KEY;
  const apiUrl = process.env.SAFEHAVEN_API_URL || 'https://api.sandbox.safehavenmfb.com';

  if (!clientId || !privateKey) {
    throw new SafeHavenAuthError(
      'missing_config',
      'SAFEHAVEN_CLIENT_ID and SAFEHAVEN_PRIVATE_KEY environment variables are required',
    );
  }

  _authServiceInstance = new SafeHavenAuthService({
    clientId,
    privateKey,
    apiUrl,
  });

  return _authServiceInstance;
}

/**
 * Reset the singleton (for testing).
 */
export function _resetSafeHavenAuthService(): void {
  _authServiceInstance = null;
}
