# Deployment Guide

This guide covers deploying Restaurant Menu Finder to production using Vercel (frontend) and Railway (backend).

## Prerequisites

- GitHub account
- Vercel account (free tier OK) — https://vercel.com
- Railway account (free tier OK) — https://railway.app
- Google Places API key
- OpenAI API key (optional, for faster menu extraction)

---

## Step 1: Deploy Frontend to Vercel

### Option A: Automatic (Recommended)

1. Go to https://vercel.com/new
2. Click **Import Git Repository**
3. Search for and select `Restaurant-Menu-Finder`
4. Vercel auto-detects the Vite app
5. Click **Deploy**
6. Wait ~2 min for deployment to complete
7. Your frontend URL will be something like `https://restaurant-menu-finder.vercel.app`

### Option B: Manual CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

### Set Environment Variables (Optional)

In Vercel dashboard:
1. Go to project → Settings → Environment Variables
2. Add `VITE_API_URL` = your Railway backend URL (from Step 2 below)
3. Redeploy

---

## Step 2: Deploy Backend to Railway

### 1. Connect to Railway

1. Go to https://railway.app
2. Click **Create New Project**
3. Select **Deploy from GitHub**
4. Authorize Railway with GitHub
5. Select the `Restaurant-Menu-Finder` repository
6. Railway auto-detects Python and creates a PostgreSQL database

### 2. Set Environment Variables

In Railway dashboard → Variables:

```
GOOGLE_PLACES_API_KEY=your_api_key_here
OPENAI_API_KEY=your_api_key_here (optional)
DATABASE_URL=automatically_set_by_railway
```

### 3. Deploy

1. Railway auto-deploys when you push to main
2. Monitor build logs in the Railway dashboard
3. Once deployed, you'll get a public URL like `https://restaurant-menu-finder-prod-xxx.railway.app`

---

## Step 3: Connect Frontend to Backend

Once the backend is deployed, update the frontend to use the backend URL:

### Option A: Environment Variable (Recommended)

In Vercel dashboard:
1. Settings → Environment Variables
2. Add `VITE_API_URL=https://your-railway-url.railway.app`
3. Redeploy

### Option B: Hardcode (Quick)

Edit `frontend/src/api.ts`:
```typescript
const api = axios.create({ 
  baseURL: 'https://your-railway-url.railway.app/api' 
})
```

Commit and push — Vercel auto-redeploys.

---

## Troubleshooting

### Frontend builds but backend API fails

- Check Railway logs for Python errors
- Verify environment variables are set in Railway
- Check CORS settings in `backend/main.py`

### Backend deploys but frontend can't reach it

- Verify `VITE_API_URL` is set in Vercel
- Check that the Railway URL is public (not private)
- Browser console should show the full API URL being called

### Playwright/Chromium errors on Railway

- Railway doesn't have Chromium pre-installed
- Solution: Use the httpx-only scraping path (no JavaScript rendering)
- Or use a larger Railway plan that includes headless browsers

### Out of OpenAI quota

- Menus still work via heuristic parser (no API calls)
- Check `[LLM] extraction failed` logs
- Set `OPENAI_API_KEY` to empty string to disable LLM entirely

---

## Monitoring

### Vercel
- Dashboard: https://vercel.com/dashboard
- Check deployment logs for build errors
- Analytics available on Pro plan

### Railway
- Dashboard: https://railway.app
- Real-time logs in the project view
- Monitor resource usage (CPU, memory)

---

## Cost

**Vercel (Frontend)**
- Free tier: up to 100 GB bandwidth/month
- Plenty for a portfolio project

**Railway (Backend)**
- Free tier: $5 credits/month
- Estimated cost: ~$2–5/month for light usage
- Can be higher with frequent scraping + Playwright

---

## Local Testing Before Deploy

```bash
# Test frontend build
cd frontend
npm run build
npm run preview

# Test backend
cd ../backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Next Steps

- [ ] Update `VITE_API_URL` in frontend after backend deploys
- [ ] Test live deployment in a real browser
- [ ] Monitor logs for the first week
- [ ] Consider adding automated tests before each deploy
- [ ] Set up GitHub Actions for CI/CD (optional)

---

For questions, check the [README](README.md) or open an issue on GitHub.
