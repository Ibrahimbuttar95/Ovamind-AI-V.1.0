import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { whop_user_id, email } = body;

  if (!whop_user_id && !email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ access: false, reason: 'No identifier provided' })
    };
  }

  try {
    // Look up user by whop_user_id OR email
    const query = supabase.from('users').select('*');
    if (whop_user_id) query.eq('whop_user_id', whop_user_id);
    else query.eq('email', email);

    const { data, error } = await query.single();

    if (error || !data) {
      return {
        statusCode: 200,
        body: JSON.stringify({ access: false, reason: 'User not found' })
      };
    }

    const hasAccess = data.status === 'active' && data.is_lifetime_member === true;

    return {
      statusCode: 200,
      body: JSON.stringify({
        access: hasAccess,
        plan: data.plan || 'lifetime',
        email: data.email,
        reason: hasAccess ? 'Active member' : 'Inactive or refunded'
      })
    };
  } catch (err) {
    console.error('[verify-access] Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ access: false, reason: 'Server error' })
    };
  }
}
