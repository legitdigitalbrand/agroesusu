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
  private supabase: ReturnType<typeof createClient> | null = null;

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
        throw new Error(`Safe Haven auth failed: ${response.status} ${JSON.stringify(responseBody)}`);
      }

      const expiresIn = responseBody.expires_in || 3600;
      this.tokenCache = {
        accessToken: responseBody.access_token,
        ibsClientId: responseBody.ibs_client_id || '',
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
    const tokenUrl = `${this.config.baseUrl}/oauth2/token`;
    
    const payload = {
      iss: this.config.clientId,
      sub: this.config.clientId,
      aud: tokenUrl,
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
   * Core request method with auth, logging, and error handling.
   */
  private async request(
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
      throw new Error(`Safe Haven API error: ${response.status} ${JSON.stringify(responseData)}`);
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
      await client.from('safe_haven_api_calls').insert({
        call_type: entry.callType,
        request_method: entry.request.method,
        request_url: entry.request.url,
        request_headers: entry.request.headers,
        request_body: entry.request.body,
        response_status: entry.response.status,
        response_body: entry.response.body,
        response_headers: entry.response.headers,
        status: entry.status,
        error_message: entry.errorMessage,
        latency_ms: entry.latencyMs,
        correlation_id: crypto.randomUUID(),
      });
    } catch (e) {
      // Logging failure should not block the operation
      console.error('[SafeHavenClient] Failed to log API call:', e);
    }
  }

  private getSupabase() {
    if (!this.supabase) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        throw new Error('Missing Supabase environment variables');
      }
      this.supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.supabase;
  }
}
