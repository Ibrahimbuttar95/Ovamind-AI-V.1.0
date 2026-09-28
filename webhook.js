import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Verify this request genuinely came from Whop ──
function verifyWhopSignature(payload, signature) {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) return false;
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(signature || '', 'hex')
  );
}

export async function handler(event) {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Verify Whop signature
  const signature = event.headers['whop-signature'] || event.headers['x-whop-signature'];
  if (!verifyWhopSignature(event.body, signature)) {
    console.error('[Webhook] Invalid signature — rejected');
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  console.log('[Webhook] Event received:', payload.event);

  try {
    switch (payload.event) {

      // ── User paid ──
      case 'payment.succeeded': {
        await supabase.from('users').upsert({
          whop_user_id:      payload.data.user_id,
          email:             payload.data.email,
          is_lifetime_member: true,
          plan:              payload.data.plan_id || 'lifetime',
          paid_at:           new Date().toISOString(),
          status:            'active'
        }, { onConflict: 'whop_user_id' });

        console.log('[Webhook] User activated:', payload.data.email);
        break;
      }

      // ── Membership renewed ──
      case 'membership.went_valid': {
        await supabase.from('users').upsert({
          whop_user_id: payload.data.user_id,
          email:        payload.data.email,
          status:       'active',
          renewed_at:   new Date().toISOString()
        }, { onConflict: 'whop_user_id' });
        break;
      }

      // ── Membership cancelled / expired ──
      case 'membership.went_invalid':
      case 'membership.expired': {
        await supabase.from('users')
          .update({ status: 'inactive' })
          .eq('whop_user_id', payload.data.user_id);

        console.log('[Webhook] User deactivated:', payload.data.user_id);
        break;
      }

      // ── Refund issued ──
      case 'payment.refunded': {
        await supabase.from('users')
          .update({ status: 'refunded', is_lifetime_member: false })
          .eq('whop_user_id', payload.data.user_id);

        console.log('[Webhook] User refunded:', payload.data.user_id);
        break;
      }

      default:
        console.log('[Webhook] Unhandled event:', payload.event);
    }
  } catch (err) {
    console.error('[Webhook] Supabase error:', err);
    return { statusCode: 500, body: 'Database error' };
  }

  return { statusCode: 200, body: 'OK' };
}
