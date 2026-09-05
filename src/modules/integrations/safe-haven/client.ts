// ============================================================================
// Safe Haven HTTP Client
// 
// Low-level HTTP client for the Safe Haven MFB API.
// Handles: OAuth2 token exchange, token caching, request/response logging,
// timeout handling, error normalization.
// 
// This client NEVER exposes Safe Haven's raw shapes to the domain layer.
// The SafeHavenAdapter wraps this client and translates to/from our DTOs.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export interface SafeHavenClientConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;  // RSA private key or client secret for JWT signing
}

interface TokenCache {
  accessToken: string;
  ibsClientId: string;
  expiresAt: number;  // Unix timestamp (ms)
}

/**
 * Internal marker: the provider rejected our bearer token (HTTP 401/403).
 * request() retries once with a fresh token before giving up.
 */
class SafeHavenAuthRejectedError extends Error {}

interface LoggedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

interface LoggedResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

export class SafeHavenClient {
  private config: SafeHavenClientConfig;
  private tokenCache: TokenCache | null = null;
  private supabase: any = null;

  constructor(config: SafeHavenClientConfig) {
    this.config = config;
  }

  // ===========================================================================
  // Authentication
  // ===========================================================================

  /**
   * Exchange client credentials for an access token.
   * Caches the token until expiry. Refreshes automatically when expired.
   */
  async authenticate(): Promise<TokenCache> {
    // Return cached token if still valid (with 60s buffer)
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60000) {
      return this.tokenCache;
    }

    const tokenUrl = `${this.config.baseUrl}/oauth2/token`;
    
    // Generate JWT client assertion (RS256)
    const clientAssertion = this.generateClientAssertion();

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_assertion: clientAssertion,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    });

    const startTime = Date.now();

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: body.toString(),
      });

      const responseBody = await response.json();
      const latencyMs = Date.now() - startTime;

      // Log the call
      await this.logApiCall({
        callType: 'authenticate',
        request: {
          method: 'POST',
          url: tokenUrl,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: { grant_type: 'client_credentials', client_id: this.config.clientId },
        },
        response: {
          status: response.status,
          body: responseBody,
          headers: {},
        },
        latencyMs,
        status: response.ok ? 'success' : 'client_error',
      });

      if (!response.ok) {
        throw new Error(`Safe Haven authentication failed (HTTP ${response.status}). Please check credentials.`);
      }

      // FAIL-CLOSED: Safe Haven returns 2xx (even HTTP 201) for OAuth errors
      // such as {"error":"invalid_request","error_description":"Invalid
      // client_assertion..."}. A response without an access_token is a
      // failure, never a success — otherwise an undefined token gets cached
      // and every subsequent API call fails with 403 "Expired token".
      const accessToken = responseBody.access_token as string | undefined;
      if (!accessToken) {
        const oauthError = (responseBody.error as string) || 'invalid_request';
        const oauthDesc = (responseBody.error_description as string) || 'No access token in response';
        throw new Error(
          `Safe Haven authentication failed: ${oauthError} — ${oauthDesc}`
        );
      }

      const expiresIn = Number(responseBody.expires_in) || 1800;
      this.tokenCache = {
        accessToken,
        ibsClientId: (responseBody.ibs_client_id as string) || '',
        expiresAt: Date.now() + expiresIn * 1000,
      };

      return this.tokenCache;

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      await this.logApiCall({
        callType: 'authenticate',
        request: {
          method: 'POST',
          url: tokenUrl,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: { grant_type: 'client_credentials', client_id: this.config.clientId },
        },
        response: {
          status: 0,
          body: null,
          headers: {},
        },
        latencyMs,
        status: 'network_error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate a JWT client assertion signed with RS256.
   */
  private generateClientAssertion(): string {
    const now = Math.floor(Date.now() / 1000);
    
    // Safe Haven requires `aud` to be the environment base URL
    // (https://api.safehavenmfb.com for production,
    //  https://api.sandbox.safehavenmfb.com for sandbox) — NOT the token
    // endpoint. Sending the token URL here returns
    // {"error":"invalid_request","error_description":"Invalid client_assertion.
    // jwt audience invalid. expected: https://api.safehavenmfb.com"} (observed
    // in production logs 2026-09-05).
    // `iss` per Safe Haven docs is the Company URL; falls back to clientId
    // when SAFEHAVEN_COMPANY_URL is not configured.
    const payload = {
      iss: process.env.SAFEHAVEN_COMPANY_URL || this.config.clientId,
      sub: this.config.clientId,
      aud: this.config.baseUrl,
      iat: now,
      exp: now + 3600,
      jti: crypto.randomUUID(),
    };

    // Encode header and payload
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signingInput = `${header}.${payloadB64}`;

    // Sign with RSA private key
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signingInput);
    const signature = sign.sign(this.config.clientSecret, 'base64url');

    return `${signingInput}.${signature}`;
  }

  // ===========================================================================
  // HTTP Methods
  // ===========================================================================

  async get(path: string, params?: Record<string, string>): Promise<{ status: number; data: unknown }> {
    return this.request('GET', path, undefined, params);
  }

  async post(path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
    return this.request('POST', path, body);
  }

  async put(path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
    return this.request('PUT', path, body);
  }

  async delete(path: string): Promise<{ status: number; data: unknown }> {
    return this.request('DELETE', path);
  }

  /**
   * Core request method with auth, logging, error handling, and a single
   * retry with a fresh token on auth rejection (401/403).
   */
  private async request(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): Promise<{ status: number; data: unknown }> {
    try {
      return await this.requestOnce(method, path, body, queryParams);
    } catch (error) {
      if (error instanceof SafeHavenAuthRejectedError) {
        // Token rejected by the provider (expired/invalid for their clock) —
        // drop the cache and retry exactly once with a freshly minted token.
        this.tokenCache = null;
        return await this.requestOnce(method, path, body, queryParams);
      }
      throw error;
    }
  }

  private async requestOnce(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): Promise<{ status: number; data: unknown }> {
    const { accessToken, ibsClientId } = await this.authenticate();

    let url = `${this.config.baseUrl}${path}`;
    if (queryParams && Object.keys(queryParams).length > 0) {
      const qs = new URLSearchParams(queryParams).toString();
      url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (ibsClientId) {
      headers['ClientID'] = ibsClientId;
    }

    const startTime = Date.now();
    let response: Response;
    
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000), // 30s timeout
      });
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      await this.logApiCall({
        callType: `${method.toLowerCase()}_${path.replace('/', '_')}`,
        request: { method, url, headers: this.sanitizeHeaders(headers), body },
        response: { status: 0, body: null, headers: {} },
        latencyMs,
        status: 'timeout',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Safe Haven request failed: ${error instanceof Error ? error.message : 'timeout'}`);
    }

    const latencyMs = Date.now() - startTime;
    let responseData: unknown;
    
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }

    const status = response.ok ? 'success' : (response.status >= 500 ? 'server_error' : 'client_error');
    
    await this.logApiCall({
      callType: `${method.toLowerCase()}_${path.replace(/\//g, '_').replace(/^_/, '')}`,
      request: { method, url, headers: this.sanitizeHeaders(headers), body },
      response: { status: response.status, body: responseData, headers: {} },
      latencyMs,
      status,
      errorMessage: response.ok ? undefined : `HTTP ${response.status}`,
    });

    if (!response.ok) {
      // Auth rejections (expired/invalid bearer token) are retried once with
      // a fresh token by request(); every other error is surfaced with the
      // provider's own message so failures are diagnosable from logs/APIs.
      const providerMessage =
        (responseData &&
          typeof responseData === 'object' &&
          ((responseData as Record<string, unknown>).message as string)) ||
        (typeof responseData === 'string' ? responseData.slice(0, 200) : '');

      if (response.status === 401 || response.status === 403) {
        throw new SafeHavenAuthRejectedError(
          `Safe Haven API request failed (HTTP ${response.status}): ${providerMessage || 'Access denied'}`
        );
      }

      throw new Error(
        `Safe Haven API request failed (HTTP ${response.status}): ${providerMessage || 'Please try again.'}`
      );
    }

    return { status: response.status, data: responseData };
  }

  // ===========================================================================
  // Logging
  // ===========================================================================

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase().includes('authorization')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Scrub sensitive PII (BVN, NIN) from request/response bodies before logging.
   * Prevents identity numbers from being stored in the safe_haven_api_calls audit table.
   */
  private sanitizeLogBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;
    try {
      const sanitized = JSON.parse(JSON.stringify(body));
      const sensitiveKeys = ['bvn', 'nin', 'number', 'identityNumber', 'identity_number'];
      const scrub = (obj: Record<string, unknown>) => {
        for (const key of Object.keys(obj)) {
          if (sensitiveKeys.includes(key.toLowerCase()) && typeof obj[key] === 'string') {
            obj[key] = '[REDACTED]';
          } else if (obj[key] && typeof obj[key] === 'object') {
            scrub(obj[key] as Record<string, unknown>);
          }
        }
      };
      scrub(sanitized as Record<string, unknown>);
      return sanitized;
    } catch {
      return '[UNPARSEABLE]';
    }
  }

  private async logApiCall(entry: {
    callType: string;
    request: LoggedRequest;
    response: LoggedResponse;
    latencyMs: number;
    status: string;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const client = this.getSupabase();
      await client.from("safe_haven_api_calls").insert({
        call_type: entry.callType,
        request_method: entry.request.method,
        request_url: entry.request.url,
        request_headers: entry.request.headers,
        request_body: this.sanitizeLogBody(entry.request.body),
        response_status: entry.response.status,
        response_body: this.sanitizeLogBody(entry.response.body),
        response_headers: entry.response.headers,
        status: entry.status,
        error_message: entry.errorMessage,
        latency_ms: entry.latencyMs,
        correlation_id: crypto.randomUUID(),
      } as Record<string, unknown>);
    } catch (e) {
      // Logging failure should not block the operation
      console.error('[SafeHavenClient] Failed to log API call:', e);
    }
  }

  private getSupabase(): any {
    if (!this.supabase) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        throw new Error('Missing Supabase environment variables');
      }
      this.supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      }) as any;
    }
    return this.supabase;
  }
}
