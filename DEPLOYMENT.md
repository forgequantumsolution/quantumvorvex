# Vercel Deployment Guide — Quantum Vorvex

## Prerequisites
- GitHub account with the repo pushed
- Vercel account (free at vercel.com)
- Neon.tech account (free PostgreSQL at neon.tech)

---

## Step 1 — Get a Free PostgreSQL Database (Neon.tech)

1. Go to **https://neon.tech** → Sign up free
2. Create a new project → name it `quantum-vorvex`
3. Copy the **Connection String** (looks like):
   ```
   postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Keep this URL — you'll need it in Step 3.

---

## Step 2 — Deploy to Vercel

1. Go to **https://vercel.com** → New Project
2. Import your GitHub repo: `forgequantumsolution/quantumvorvex`
3. Vercel auto-detects settings — **override these**:
   - **Framework Preset**: Other
   - **Build Command**: `node scripts/vercel-build.js`
   - **Output Directory**: `client/dist`
   - **Install Command**: `npm install && npm install --prefix server && npm install --prefix client`
4. Click **Environment Variables** (before deploying) → add all variables from Step 3
5. Click **Deploy**

---

## Step 3 — Environment Variables (add in Vercel Dashboard)

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | Your Neon.tech PostgreSQL URL | ✅ Yes |
| `JWT_SECRET` | Random 32+ char string (see below) | ✅ Yes |
| `NODE_ENV` | `production` | ✅ Yes |
| `CLIENT_URL` | `https://your-app.vercel.app` | ✅ Yes |
| `MESSAGING_PROVIDER` | `mock` | ✅ Yes |
| `LOG_LEVEL` | `info` | Optional |

**Generate a strong JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 4 — After First Deploy

1. Open your Vercel URL (e.g. `https://quantum-vorvex.vercel.app`)
2. The database tables are created automatically on first deploy
3. Log in with the default credentials:
   - **Email**: `admin@hotel.com`
   - **Password**: `admin123`
4. ⚠️ **Change the password immediately** in Settings → Users & Access

---

## Step 5 — Update CLIENT_URL

After your Vercel URL is assigned:
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Update `CLIENT_URL` to your actual Vercel URL
3. Redeploy (Vercel Dashboard → Deployments → Redeploy)

---

## Local Development (unchanged)

```bash
# Install dependencies
npm run install:all

# Start both servers
npm run dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:5000
```

Local dev still uses SQLite (`server/prisma/dev.db`) — no Neon.tech needed locally.

---

## Troubleshooting

### "DATABASE_URL is not set"
→ Add it in Vercel Dashboard → Settings → Environment Variables → Redeploy

### "prisma db push failed"
→ Check your Neon.tech connection string is correct (include `?sslmode=require` at the end)

### "Cannot find module" errors
→ Run `npm install` (root) to install all server dependencies at root level

### API returns 404 for all routes
→ Check `vercel.json` rewrites — `/api/:path*` must point to `/api/index`

### CORS errors in browser
→ Update `CLIENT_URL` in Vercel env vars to your exact Vercel URL (no trailing slash)

### File uploads not persisting
→ Vercel has an ephemeral filesystem. For persistent uploads, use Cloudinary or Vercel Blob:
   ```bash
   npm install @vercel/blob
   ```
   Then update `documentsController.js` to use Vercel Blob storage.
