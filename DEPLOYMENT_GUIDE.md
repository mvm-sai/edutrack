# 🚀 EduTrack — Complete Deployment Guide (Free Tier)

**Deployment Architecture:**
```
Vercel (Frontend)  →  Koyeb (Backend + Bot)  →  Supabase (PostgreSQL)
```

**Total Cost: $0/month** ✨

---

## 📋 Pre-Deployment Checklist

- [ ] Supabase account created (free tier)
- [ ] Koyeb account created (free tier)
- [ ] Vercel account created (free tier)
- [ ] GitHub account with repository pushed
- [ ] Node.js 18+ installed locally
- [ ] Docker installed locally (for testing)

---

## 🔧 Step 1: Setup Supabase Database

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Fill in:
   - **Project Name:** edutrack-prod
   - **Database Password:** [Generate strong password]
   - **Region:** Choose closest to your users
   - **Pricing Plan:** Free
4. Click **Create new project** (wait 2-3 minutes for setup)

### 1.2 Get Database Connection String

1. Go to **Settings → Database** in your Supabase project
2. Find **URI** section
3. Copy the connection string (starts with `postgresql://`)
4. Replace `[YOUR-PASSWORD]` with your actual database password
5. Format: `postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres`

### 1.3 Run Database Migrations

**Locally (to test migrations):**
```bash
# Install dependencies
cd backend
npm install pg migrate-up

# Create migrations
npm run migrate:create

# Run migrations
npm run migrate:up
```

**Or directly in Supabase SQL editor:**
1. Go to **SQL Editor** in Supabase
2. Click **New Query**
3. Paste the SQL from [migrations/001-initial.sql](./migrations/001-initial.sql)
4. Click **Run**

---

## 🐳 Step 2: Deploy Backend to Koyeb

### 2.1 Push Code to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: EduTrack deployment setup"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/edutrack.git
git push -u origin main
```

### 2.2 Deploy on Koyeb

1. Go to [koyeb.com](https://koyeb.com)
2. Sign up with GitHub
3. Click **Create App**
4. Select **GitHub** as source
5. Choose your **edutrack** repository
6. Select **main** branch
7. Configure:
   - **Repository:** edutrack
   - **Buildpack:** Docker
   - **Dockerfile path:** `backend/Dockerfile`
   - **Run command:** `npm start`

### 2.3 Set Environment Variables on Koyeb

In the **Variables** section, add:

```env
NODE_ENV=production
PORT=8000
JWT_SECRET=your-super-secret-key-min-32-chars-long
JWT_EXPIRES_IN=24h
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
FRONTEND_URL=https://edutrack-frontend.vercel.app
WA_DELAY_MIN=8000
WA_DELAY_MAX=15000
WA_MAX_RETRIES=2
WA_RETRY_DELAY=5000
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
CHROMIUM_BIN=/usr/bin/chromium-browser
```

### 2.4 Set Up Persistent Storage

**For WhatsApp session persistence (.wwebjs_auth):**

1. In Koyeb dashboard, go to **Volumes**
2. Create a new volume: `whatsapp-sessions`
3. Mount point: `/app/backend/.wwebjs_auth`
4. Size: 1GB (free tier limit)

---

## 🎨 Step 3: Deploy Frontend to Vercel

### 3.1 Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Import Project**
3. Select **GitHub** and your **edutrack** repo
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### 3.2 Add Environment Variables

In **Settings → Environment Variables**, add:

```env
VITE_API_URL=https://edutrack-api.koyeb.app/api
VITE_APP_NAME=EduTrack
```

### 3.3 Deploy

Click **Deploy** and wait for build to complete (~2 min)

**Your frontend is now live at:** `https://edutrack-[random].vercel.app`

---

## 🤖 Step 4: Setup WhatsApp Session Persistence

### 4.1 Initialize WhatsApp on Koyeb

1. After Koyeb deployment completes, get the app URL
2. Visit: `https://edutrack-api.koyeb.app/api/whatsapp/qr`
3. Scan the QR code with WhatsApp
4. Session is now saved in `/app/backend/.wwebjs_auth` (persistent volume)

### 4.2 Session Auto-Recovery

The backend automatically:
- Loads session from persistent storage on restart
- Regenerates QR code if session expires
- Retries connection with exponential backoff

---

## 🔐 Step 5: Security Configuration

### 5.1 CORS Configuration

Already configured for:
- `https://edutrack-[random].vercel.app` (auto-added)
- All `*.vercel.app` domains
- Production domain

### 5.2 Rate Limiting

Enabled on:
- `/api/auth/login` → 5 requests per 15 minutes
- `/api/attendance/submit` → 30 requests per minute
- `/api/whatsapp/pair` → 3 requests per minute

### 5.3 Helmet Security Headers

Automatically enabled for:
- XSS Protection
- CSRF Protection
- Content Security Policy
- Clickjacking Protection

---

## ✅ Testing Deployment

### 4.1 Test Backend Health

```bash
curl https://edutrack-api.koyeb.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 123.45,
  "database": "connected"
}
```

### 4.2 Test WhatsApp Status

```bash
curl https://edutrack-api.koyeb.app/api/whatsapp/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4.3 Test Frontend

Visit: `https://edutrack-[random].vercel.app`
- Login with credentials
- Try marking attendance
- Verify WhatsApp QR code appears

---

## 🚨 Troubleshooting

### Koyeb Build Fails

**Error: "chromium-browser not found"**
- Solution: Dockerfile already includes chromium. Check build logs for full error.

**Error: "ECONNREFUSED" on DATABASE_URL**
- Solution: Verify DATABASE_URL is correct in Koyeb environment variables
- Test locally: `psql $DATABASE_URL -c "SELECT 1"`

### WhatsApp Not Connecting

**Error: "WhatsApp client not ready"**
1. Check Koyeb logs for QR code generation errors
2. Visit `/api/whatsapp/qr` endpoint
3. Scan QR code again
4. Wait 30-60 seconds for connection

### Frontend API Calls Fail

**CORS Error**
1. Verify `FRONTEND_URL` matches your Vercel domain exactly
2. Check Koyeb logs for CORS errors
3. Wait 5 minutes for DNS propagation

---

## 📊 Performance Optimization

### Caching Strategy
- Static assets cached: 1 year
- API responses cached: 5 minutes
- WhatsApp QR: refreshed every 10 seconds

### Database Optimization
- Connection pooling: 20 connections
- Query timeout: 30 seconds
- Indexes on: `(student_id, date)`, `(teacher_id)`, `(email)`

### Anti-Ban Protection
- Message delays: 8-15 seconds random
- Max retries: 2 with 5-second delays
- Rate limiting: 30 messages/minute per account
- Session rotation: automatic every 7 days

---

## 🔄 Automatic Backups

### Supabase Automatic Backups
- Daily backups: retained 7 days
- Point-in-time recovery: available
- Enable in **Settings → Database → Backups**

### Manual Backup
```bash
# Export database
pg_dump $DATABASE_URL > backup-$(date +%Y-%m-%d).sql

# Restore
psql $DATABASE_URL < backup-2026-05-22.sql
```

---

## 📱 Monitor & Maintain

### Koyeb Dashboard
- **Logs:** Real-time error tracking
- **Metrics:** CPU, Memory, Network usage
- **Deployments:** View deployment history

### Supabase Dashboard
- **Database stats:** Table sizes, connections
- **Query performance:** Slow query logs
- **Backups:** View and restore backups

### Vercel Dashboard
- **Deployments:** Track all pushes
- **Analytics:** Page load times
- **Error tracking:** Runtime errors

---

## 🆙 Update & Redeploy

### Backend Update
```bash
# Make changes locally
git add .
git commit -m "Update WhatsApp messaging logic"
git push origin main

# Koyeb auto-redeploys on push
# Watch deployment: Koyeb Dashboard → Logs
```

### Frontend Update
```bash
# Vercel auto-redeploys on push
# Build logs visible in Vercel Dashboard
```

### Database Migration
```bash
# Run SQL migration in Supabase SQL Editor
# Or use migration tool:
npm run migrate:up --version 002
```

---

## 💰 Free Tier Limits & Workarounds

| Service | Limit | Workaround |
|---------|-------|-----------|
| **Koyeb** | 2 free instances | Deploy only backend + bot to 1 instance |
| **Vercel** | Unlimited builds | No workaround needed |
| **Supabase** | 500MB database | Keep `whatsapp_queue` auto-cleaned (7 days) |
| **Bandwidth** | 50GB/month | Compress responses, optimize images |
| **Puppeteer** | Container restart loss | Use persistent volume for .wwebjs_auth |

---

## 🎯 Next Steps

1. **Immediate:** Verify all 3 services deployed successfully
2. **Day 1:** Configure custom domain (optional, costs $)
3. **Week 1:** Monitor performance & errors
4. **Month 1:** Set up automated backups & alerts

---

## 📞 Support

- **Supabase Docs:** https://supabase.com/docs
- **Koyeb Docs:** https://docs.koyeb.com
- **Vercel Docs:** https://vercel.com/docs
- **WhatsApp Web Issues:** https://github.com/pedroslopez/whatsapp-web.js/issues

---

**✨ Your app is now live and ready to serve thousands of students! 🎓**
