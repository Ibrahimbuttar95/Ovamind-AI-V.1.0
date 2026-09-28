// ══════════════════════════════════════════════════════
//  OvaMind AI — Frontend Access Gate
//  Flow: Check localStorage → verify with server →
//        grant access OR redirect to Whop payment page
// ══════════════════════════════════════════════════════

const WHOP_PRODUCT_URL = 'https://whop.com/your-product-url/'; // 🔁 Replace with your Whop link
const VERIFY_ENDPOINT  = '/.netlify/functions/verify-access';
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // Re-verify every 30 minutes

// ── Entry point ──
export async function initAccessGate() {
  showLoadingScreen();

  // 1. Check if Whop redirected back with user info
  const urlParams  = new URLSearchParams(window.location.search);
  const whopUserId = urlParams.get('whop_user_id');
  const email      = urlParams.get('email');

  if (whopUserId || email) {
    // Save to localStorage for future visits
    if (whopUserId) localStorage.setItem('ovamind_whop_id', whopUserId);
    if (email)      localStorage.setItem('ovamind_email', email);
    // Clean URL
    window.history.replaceState({}, '', '/');
  }

  // 2. Retrieve stored identity
  const storedId    = localStorage.getItem('ovamind_whop_id');
  const storedEmail = localStorage.getItem('ovamind_email');

  if (!storedId && !storedEmail) {
    // No identity — redirect to Whop to purchase/login
    redirectToWhop();
    return;
  }

  // 3. Verify with backend
  const hasAccess = await verifyAccess(storedId, storedEmail);

  if (hasAccess) {
    grantAccess();
    // 4. Periodic re-verification (anti-bypass)
    startPeriodicCheck(storedId, storedEmail);
  } else {
    revokeAccess();
  }
}

// ── Verify with Netlify function ──
async function verifyAccess(whopUserId, email) {
  try {
    const res = await fetch(VERIFY_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ whop_user_id: whopUserId, email })
    });
    const data = await res.json();
    console.log('[Access Gate]', data);
    return data.access === true;
  } catch (err) {
    console.error('[Access Gate] Verify failed:', err);
    // On network error: grant temporary access if previously verified
    return !!localStorage.getItem('ovamind_last_verified');
  }
}

// ── Periodic re-check (prevents bypassing the frontend gate) ──
function startPeriodicCheck(whopUserId, email) {
  setInterval(async () => {
    console.log('[Access Gate] Periodic re-check...');
    const stillValid = await verifyAccess(whopUserId, email);
    if (!stillValid) {
      console.warn('[Access Gate] Access revoked — logging out');
      revokeAccess();
    } else {
      localStorage.setItem('ovamind_last_verified', Date.now());
    }
  }, CHECK_INTERVAL_MS);
}

// ── UI States ──
function showLoadingScreen() {
  document.getElementById('loading-screen')?.classList.remove('hidden');
  document.getElementById('app-content')?.classList.add('hidden');
  document.getElementById('paywall-screen')?.classList.add('hidden');
}

function grantAccess() {
  localStorage.setItem('ovamind_last_verified', Date.now());
  document.getElementById('loading-screen')?.classList.add('hidden');
  document.getElementById('paywall-screen')?.classList.add('hidden');
  document.getElementById('app-content')?.classList.remove('hidden');
  console.log('[Access Gate] ✅ Access granted');
}

function revokeAccess() {
  localStorage.removeItem('ovamind_whop_id');
  localStorage.removeItem('ovamind_email');
  localStorage.removeItem('ovamind_last_verified');
  document.getElementById('loading-screen')?.classList.add('hidden');
  document.getElementById('app-content')?.classList.add('hidden');
  document.getElementById('paywall-screen')?.classList.remove('hidden');
  console.warn('[Access Gate] ❌ Access denied');
}

function redirectToWhop() {
  window.location.href = WHOP_PRODUCT_URL;
}

// ── Logout ──
export function logout() {
  localStorage.clear();
  window.location.href = WHOP_PRODUCT_URL;
}

// ── Run on page load ──
document.addEventListener('DOMContentLoaded', initAccessGate);
