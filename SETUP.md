# Potluck — Setup Guide

> Your personal recipe cookbook. Save cooking reels → AI extracts the recipe → cook with your roommate.

---

## Step 1 — Install dependencies

You need Node.js 18+ installed. Then:

```bash
cd potluck
npm install
```

---

## Step 2 — Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign up free
2. Click **New Project**, give it a name (e.g. "potluck"), pick a region close to you
3. Wait ~2 min for it to provision

**Run the database schema:**
1. In the Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Paste the entire contents of `supabase/schema.sql` into the editor
4. Click **Run** (or Cmd+Enter)

**Get your API keys:**
1. Go to **Project Settings** (gear icon) → **API**
2. Copy **Project URL** → this is your `NEXT_PUBLIC_SUPABASE_URL`
3. Copy **anon / public** key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Step 3 — Get an Anthropic API key (Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com) → sign up free
2. Click **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-...`)

> Cost: ~$0.01–0.03 per recipe save. At personal use scale (50–100 saves/month) this is ~$1–3/month total.

---

## Step 4 — Create your `.env.local` file

In the `potluck/` folder, create a file called `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your anon key...
ANTHROPIC_API_KEY=sk-ant-...your key...
```

---

## Step 5 — Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → create your account → you're in!

---

## Step 6 — Deploy to Vercel (free, public URL)

You need a public URL so the iOS Shortcut can reach your app.

1. Go to [vercel.com](https://vercel.com) → sign up free with GitHub
2. Push this folder to a GitHub repo (private is fine):
   ```bash
   git init
   git add .
   git commit -m "init potluck"
   # Create a new private repo on github.com, then:
   git remote add origin https://github.com/YOUR_USERNAME/potluck.git
   git push -u origin main
   ```
3. In Vercel → **New Project** → import your repo → click **Deploy**
4. After deploy, go to **Settings → Environment Variables** and add your 3 env vars
5. Redeploy once (Settings → Deployments → Redeploy)

Your app will be live at something like `https://potluck-abc123.vercel.app`

---

## Step 7 — iOS Shortcut (the magic!)

This lets you share any Instagram/TikTok/YouTube reel directly to Potluck from the share sheet.

1. On your iPhone, open the **Shortcuts** app
2. Tap **+** to create a new shortcut
3. Add these actions in order:

   | # | Action | Setting |
   |---|--------|---------|
   | 1 | **Receive** | Receive: URLs, from Share Sheet |
   | 2 | **URL** | `https://YOUR-APP.vercel.app/save?url=` |
   | 3 | **Combine Text** | First input: (URL from step 2), Second input: (Shortcut Input) |
   | 4 | **Open URLs** | Open: (Combined Text from step 3) |

   > Tip: For step 3, use "Combine Text" with no separator between the base URL and the shared URL. Or just use "URL Encode" on the shared input and append.

4. Name the shortcut **"Save to Potluck"**
5. Tap the shortcut info (ⓘ) → enable **Show in Share Sheet**

**Now test it:**
Open Instagram → find a cooking reel → tap Share → scroll to find "Save to Potluck" → tap it → Safari opens your app → recipe is extracted automatically!

> If you don't see it in share sheet: Settings → Shortcuts → make sure the shortcut has share sheet enabled.

---

## Step 8 — Add to Home Screen (optional but nice)

In Safari on your iPhone:
1. Open your Vercel URL
2. Tap the Share button → **Add to Home Screen**
3. Name it "Potluck" → Add

Now it opens like a real app.

---

## For your roommate

1. They sign up at your Vercel URL
2. You go to **Household** tab → **Create** → create a household
3. Share the 8-character invite code with them
4. They go to **Household** → **Join** → enter the code
5. When saving recipes, you can both choose to save to your shared household

---

## Troubleshooting

**"Unauthorized" when saving a recipe**
→ Make sure you're logged in. The session might have expired — just log in again.

**Extraction returns wrong info**
→ The recipe review screen lets you edit everything before saving. Instagram sometimes blocks scraping, so Claude works from the URL alone — it still does a good job but you might need to tweak ingredients.

**Shortcut opens the wrong thing**
→ Make sure the URL in step 2 matches your exact Vercel URL (no trailing slash).

**Supabase "row level security" errors**
→ Double-check that you ran the full `schema.sql` — the RLS policies are at the bottom.
