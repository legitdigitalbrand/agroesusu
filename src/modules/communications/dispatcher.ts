// ═══════════════════════════════════════════════════════════════
// Communications Domain — Notification Dispatcher
//
// Business domains publish events. Communications subscribes.
// Notification logic never lives inside financial services.
//
// Notification failures MUST NEVER cause financial transactions to fail.
// ═══════════════════════════════════════════════════════════════

import { TEMPLATES } from './templates';
import { createNotification } from './repository';
import { sendBrandedEmail } from '@/lib/email/resend';
import { createServiceClient } from '@/lib/supabase/service';
import type { NotificationEvent } from './types';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(/\$(\w+)/g, (_, key) => variables[key] ?? '');
}

export interface DispatchInput {
  event: NotificationEvent;
  user_id: string;
  variables: Record<string, string>;
  metadata?: Record<string, unknown>;
  related_entity_type?: string;
  related_entity_id?: string;
}

/**
 * Look up the user's email address for email delivery.
 * Checks customers table (keyed by auth_id) first, then staff_users.
 */
async function lookupUserEmail(userId: string): Promise<string | null> {
  try {
    const db = createServiceClient();

    // Try customers table first
    const { data: customer } = await db
      .from('customers')
      .select('email')
      .eq('auth_id', userId)
      .maybeSingle();

    if (customer?.email) return customer.email;

    // Try staff_users table
    const { data: staff } = await db
      .from('staff_users')
      .select('email')
      .eq('auth_id', userId)
      .maybeSingle();

    if (staff?.email) return staff.email;

    return null;
  } catch {
    return null;
  }
}

/**
 * Dispatch a notification event.
 *
 * 1. Look up the template for the event type
 * 2. Interpolate variables into title and message
 * 3. Create an in-app notification record
 * 4. If email channel is active: send branded email via Resend (if configured)
 * 5. Retry up to MAX_RETRIES on failure
 * 6. NEVER throw — failures are swallowed and logged
 */
export async function dispatchNotification(input: DispatchInput): Promise<void> {
  const template = TEMPLATES[input.event];
  if (!template) {
    console.warn(`[Communications] No template for event: ${input.event}`);
    return;
  }

  const title = interpolate(template.title, input.variables);
  const message = interpolate(template.message, input.variables);

  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < MAX_RETRIES) {
    try {
      await createNotification({
        user_id: input.user_id,
        type: input.event as any,
        title,
        message,
        read: false,
        category: template.category,
        delivery_status: 'delivered',
        metadata: {
          ...input.metadata,
          event: input.event,
          channels: template.defaultChannels,
        },
        related_entity_type: input.related_entity_type,
        related_entity_id: input.related_entity_id,
      });

      // Email channel: send branded email via Resend
      if (template.defaultChannels.includes('email')) {
        const email = await lookupUserEmail(input.user_id);
        if (email) {
          const result = await sendBrandedEmail({
            to: email,
            subject: `${title} — Agriqcap`,
            title,
            message,
          });

          if (result.sent) {
            console.log(`[Communications] Email sent for ${input.event} to ${email}`);
          } else if (result.error !== 'RESEND_API_KEY not configured') {
            console.error(`[Communications] Email failed for ${input.event}: ${result.error}`);
          } else {
            console.log(`[Communications] Email skipped (no Resend key) for ${input.event}`);
          }
        } else {
          console.log(`[Communications] No email address found for user ${input.user_id} — skipping email for ${input.event}`);
        }
      }

      // SMS channel: not yet implemented — log for audit
      if (template.defaultChannels.includes('sms')) {
        console.log(`[Communications] SMS channel for ${input.event} — no SMS provider configured, logged for audit`);
      }

      return; // Success
    } catch (error) {
      lastError = error;
      attempt++;
      console.error(`[Communications] Dispatch attempt ${attempt} failed for ${input.event}:`, error);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  // All retries exhausted — log but DON'T throw
  console.error(`[Communications] All ${MAX_RETRIES} retries exhausted for ${input.event}. Last error:`, lastError);
}
