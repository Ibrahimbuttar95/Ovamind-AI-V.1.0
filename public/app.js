import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

let supabase;
let currentUser;

async function loadConfig() {
  const env = import.meta.env || {};
  let config = window.OVAMIND_SUPABASE_CONFIG || {
    url: env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  if (!config.url || !config.publishableKey) {
    const response = await fetch('/.netlify/functions/supabase-config', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Configuration unavailable');
    config = await response.json();
  }
  if (!config.url || !config.publishableKey) throw new Error('Configuration unavailable');
  supabase = createClient(config.url, config.publishableKey);
  return supabase;
}

function show(id, visible) {
  document.getElementById(id)?.classList.toggle('hidden', !visible);
}

function renderAuth() {
  const paywall = document.getElementById('paywall-screen');
  paywall.innerHTML = `
    <div class="paywall-icon">🌸</div>
    <h1 style="font-family:'DM Serif Display',serif;font-size:30px;margin-bottom:8px">Your private PCOS companion</h1>
    <p style="max-width:420px;margin:0 auto 22px;color:var(--muted);line-height:1.6">Create an account to securely save your daily health record. OvaMind supports tracking and preparation for clinical conversations; it does not diagnose or treat.</p>
    <form id="auth-form" style="max-width:340px;margin:auto;text-align:left">
      <label for="auth-email">Email</label><input id="auth-email" type="email" required autocomplete="email" style="margin-bottom:12px">
      <label for="auth-password">Password</label><input id="auth-password" type="password" required minlength="8" autocomplete="current-password" style="margin-bottom:12px">
      <button class="btn-paywall" id="auth-submit" type="submit">Sign in</button>
      <button class="btn-demo" id="auth-toggle" type="button">Create an account</button>
      <p id="auth-message" role="status" style="font-size:13px;margin-top:14px;color:var(--muted)"></p>
    </form>`;
  let signUp = false;
  const form = document.getElementById('auth-form');
  const submit = document.getElementById('auth-submit');
  const toggle = document.getElementById('auth-toggle');
  const message = document.getElementById('auth-message');
  toggle.onclick = () => { signUp = !signUp; submit.textContent = signUp ? 'Create account' : 'Sign in'; toggle.textContent = signUp ? 'I already have an account' : 'Create an account'; };
  form.onsubmit = async (event) => {
    event.preventDefault();
    submit.disabled = true;
    message.textContent = signUp ? 'Creating your secure account…' : 'Signing in…';
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const result = signUp
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/` } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      message.textContent = signUp && result.error.message.toLowerCase().includes('confirm') ? 'Check your email to confirm your account.' : 'We could not complete that request. Check your details and try again.';
      submit.disabled = false;
      return;
    }
    if (signUp && !result.data.session) message.textContent = 'Account created. Check your email, then return here to sign in.';
    else await startApp(result.data.user);
    submit.disabled = false;
  };
}

async function startApp(user) {
  currentUser = user;
  show('loading-screen', false);
  show('paywall-screen', false);
  show('app-content', true);
  document.querySelector('.hero-sub')?.insertAdjacentHTML('afterend', `<p id="account-label" style="font-size:12px;opacity:.75;margin-top:10px">Private record · ${user.email}</p>`);
  await loadToday();
}

async function loadToday() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from('daily_records').select('water_glasses,sleep_hours,pain_score,symptoms,mood').eq('user_id', currentUser.id).eq('record_date', today).maybeSingle();
  if (!data) return;
  if (data.water_glasses != null) document.getElementById('water-log').value = data.water_glasses;
  if (data.sleep_hours != null) document.getElementById('sleep-log').value = data.sleep_hours;
  if (data.pain_score != null) { document.getElementById('pain-slider').value = data.pain_score; updatePain(data.pain_score); }
}

async function upsertDaily(values) {
  const { error } = await supabase.from('daily_records').upsert({ user_id: currentUser.id, record_date: new Date().toISOString().slice(0, 10), ...values }, { onConflict: 'user_id,record_date' });
  if (error) throw error;
}

window.ovamindSaveQuickLog = async (water, sleep) => { await upsertDaily({ water_glasses: Number(water), sleep_hours: Number(sleep) }); };
window.ovamindSaveSymptoms = async (symptoms, pain) => { await upsertDaily({ symptoms, pain_score: Number(pain) }); };
window.ovamindLogPeriod = async (startDate, flow) => { const { error } = await supabase.from('period_logs').insert({ user_id: currentUser.id, start_date: startDate, flow_intensity: flow }); if (error) throw error; };
window.ovamindLogout = async () => { await supabase.auth.signOut(); window.location.reload(); };

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadConfig();
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) await startApp(data.session.user);
    else { show('loading-screen', false); show('paywall-screen', true); renderAuth(); }
    supabase.auth.onAuthStateChange((_event, session) => { if (session?.user && !currentUser) startApp(session.user); });
  } catch (error) {
    console.error('[OvaMind] startup failed', error);
    show('loading-screen', false); show('paywall-screen', true);
    const screen = document.getElementById('paywall-screen');
    screen.innerHTML = '<h1>OvaMind is temporarily unavailable</h1><p>Please refresh and try again.</p>';
  }
});
