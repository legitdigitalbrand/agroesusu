// ═══════════════════════════════════════════════════════════════
// Agriqcap — Resend Email Service
//
// Branded transactional emails via Resend.
// Falls back to no-op (log) if RESEND_API_KEY is not set.
// NEVER throws — email failures must not block financial operations.
// ═══════════════════════════════════════════════════════════════

import { Resend } from 'resend';
import { BRAND } from '@/config/brand';

// ── Resend client (lazy singleton) ──────────────────────────

let client: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

// ── Config ──────────────────────────────────────────────────

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Agriqcap <noreply@agriqcap.com>';
const REPLY_TO = process.env.RESEND_REPLY_TO || BRAND.supportEmail;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://agriqcap.vercel.app';

// ── Branded HTML template ───────────────────────────────────

function brandedHtml(opts: {
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  footerNote?: string;
}): string {
  const { title, message, actionLabel, actionUrl, footerNote } = opts;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F3F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F3F0;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1B5E20 0%,#0D3D11 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:-0.5px;">${BRAND.name}</h1>
              <p style="margin:4px 0 0;color:#BBDC12;font-size:13px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;">${BRAND.tagline}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#1B5E20;font-size:18px;font-weight:600;">${title}</h2>
              <p style="margin:0 0 20px;color:#3D3D3D;font-size:15px;line-height:1.6;">${message}</p>

              ${actionLabel && actionUrl ? `
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 20px;">
                    <a href="${actionUrl}" style="display:inline-block;background-color:#1B5E20;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:10px;">${actionLabel}</a>
                  </td>
                </tr>
              </table>` : ''}

              ${footerNote ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                <tr>
                  <td style="background-color:#F5F3F0;border-radius:8px;padding:14px 16px;">
                    <p style="margin:0;color:#6B6B6B;font-size:13px;line-height:1.5;">${footerNote}</p>
                  </td>
                </tr>
              </table>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #E8E5E0;text-align:center;">
              <p style="margin:0;color:#9A9A9A;font-size:12px;line-height:1.5;">
                ${BRAND.copyright}<br>
                <a href="${APP_URL}" style="color:#9A9A9A;text-decoration:none;">${APP_URL.replace(/^https?:\/\//, '')}</a>
                &nbsp;•&nbsp;
                <a href="mailto:${BRAND.supportEmail}" style="color:#9A9A9A;text-decoration:none;">${BRAND.supportEmail}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Plain text fallback ─────────────────────────────────────

function plainText(title: string, message: string): string {
  return `${BRAND.name}\n${'='.repeat(40)}\n\n${title}\n\n${message}\n\n${BRAND.tagline}\n${APP_URL}\n${BRAND.supportEmail}`;
}

// ── Public API ──────────────────────────────────────────────

export interface SendEmailInput {
  to: string;
  subject: string;
  title: string;      // headline inside the email body
  message: string;    // body text (HTML-safe, will be embedded as-is)
  actionLabel?: string;
  actionUrl?: string;
  footerNote?: string;
}

export interface SendEmailResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a branded email via Resend.
 * Returns { sent: false } if no API key is configured — never throws.
 */
export async function sendBrandedEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getClient();
  if (!resend) {
    console.log('[Email:Resend] RESEND_API_KEY not set — skipping email to', input.to);
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      replyTo: REPLY_TO,
      subject: input.subject,
      html: brandedHtml({
        title: input.title,
        message: input.message,
        actionLabel: input.actionLabel,
        actionUrl: input.actionUrl,
        footerNote: input.footerNote,
      }),
      text: plainText(input.title, input.message),
    });

    if (error) {
      console.error('[Email:Resend] Send error:', error.message);
      return { sent: false, error: error.message };
    }

    console.log('[Email:Resend] Sent:', data?.id, 'to', input.to);
    return { sent: true, messageId: data?.id };
  } catch (err) {
    console.error('[Email:Resend] Exception:', err instanceof Error ? err.message : err);
    return { sent: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Check if Resend is configured (for health checks / status pages).
 */
export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
