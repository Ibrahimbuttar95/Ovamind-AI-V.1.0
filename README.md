# OvaMind AI — Deployment Guide
## Stack: Netlify → Whop → Local Bank (PKR)

---

## STEP 1 — Supabase (Database)

1. Go to **supabase.com** → Create free account → New Project
2. Go to **SQL Editor** → paste contents of `supabase-setup.sql` → Run
3. Go to **Settings → API** and copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `service_role` key → this is your `SUPABASE_SERVICE_KEY`

---

## STEP 2 — GitHub (Code Hosting)

```bash
# In your terminal, inside this folder:
git init
git add .
git commit -m "OvaMind AI initial deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ovamind-ai.git
git push -u origin main
```

---

## STEP 3 — Netlify (Hosting)

1. Go to **netlify.com** → Log in → "Add new site" → "Import from GitHub"
2. Select your `ovamind-ai` repo
3. Set:
   - **Build command:** *(leave empty)*
   - **Publish directory:** `public`
4. Click **Deploy**
5. Go to **Site Settings → Environment Variables** → Add:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | From Step 1 |
| `SUPABASE_SERVICE_KEY` | From Step 1 |
| `WHOP_WEBHOOK_SECRET` | From Step 4 below |

6. Your site is live at: `https://ovamind-ai.netlify.app`

---

## STEP 4 — Whop (Payment + Access)

1. Go to **whop.com** → Sign up → Create a Company
2. Create a **Product**:
   - Type: `One-time purchase` → Price: `$25`
   - OR `Subscription` → Price: `$9/month`
   - Post-purchase redirect URL: `https://ovamind-ai.netlify.app?whop_user_id={user_id}&email={email}`
3. Go to **Developer → Webhooks** → Add webhook:
   - URL: `https://ovamind-ai.netlify.app/.netlify/functions/webhook`
   - Events: `payment.succeeded`, `membership.went_valid`, `membership.went_invalid`, `payment.refunded`
   - Copy the **Webhook Secret** → paste into Netlify env vars as `WHOP_WEBHOOK_SECRET`
4. Complete **KYC** with your CNIC
5. Add your **local bank account** in payout settings for direct PKR transfer

---

## STEP 5 — Update Your Whop Link

Open `public/index.html` and find this line (near the bottom):

```javascript
const WHOP_PRODUCT_URL = 'https://whop.com/your-product-url/';
```

Replace with your actual Whop product link, then push to GitHub:

```bash
git add .
git commit -m "Add Whop product URL"
git push
```

Netlify auto-deploys in ~30 seconds.

---

## STEP 6 — Add Icon Images

You need two icon files in `/public/`:
- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

Use **Canva** → create 512×512 design with 🌸 on purple gradient → download as PNG.

---

## Money Flow

```
Customer pays on Whop ($25)
        ↓
Whop sends webhook to Netlify function
        ↓
Netlify saves user as active in Supabase
        ↓
User gets redirected to app with access
        ↓
Whop pays out → Your local bank in PKR
```

---

## File Structure

```
/ovamind-pwa
├── /netlify/functions/
│   ├── webhook.js          ← Whop payment listener
│   └── verify-access.js    ← Frontend calls this to check access
├── /public/
│   ├── index.html          ← Full app (gated behind paywall)
│   ├── manifest.json       ← PWA config
│   ├── sw.js               ← Service Worker (offline support)
│   ├── offline.html        ← Shown when no internet
│   ├── icon-192.png        ← Add this manually (see Step 6)
│   └── icon-512.png        ← Add this manually (see Step 6)
├── /src/
│   └── app.js              ← Access gate reference (logic is in index.html)
├── supabase-setup.sql      ← Run this in Supabase SQL editor
├── package.json
├── netlify.toml
└── README.md               ← This file
```

---

## Security Notes

- Webhook signature is verified with HMAC-SHA256 — only real Whop events are accepted
- Access re-verified every 30 minutes — prevents URL sharing bypass
- Service role key is server-side only — never exposed to the browser
- RLS enabled in Supabase — no direct client DB access possible
