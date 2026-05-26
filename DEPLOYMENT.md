# Deployment Guide

This guide covers deploying Restaurant Menu Finder to production using **Vercel (frontend)** and **Render (backend)** — **completely free**.

## Prerequisites

- GitHub account (you have this ✓)
- Vercel account (free) — https://vercel.com
- Render account (free) — https://render.com
- Google Places API key
- OpenAI API key (optional, for faster menu extraction)

**Cost: $0/month** ✓

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

## Step 2: Deploy Backend to Render (FREE)

### 1. Create a New Service on Render

1. Go to https://render.com
2. Click **New +** → **Web Service**
3. Select **Deploy an existing repository**
4. Authorize Render with GitHub
5. Search for and select `Restaurant-Menu-Finder`
6. Click **Connect**

### 2. Configure the Service

In the Render form, fill in:

| Field | Value |
|-------|-------|
| **Name** | `restaurant-menu-finder-api` |
| **Environment** | `Python 3` |
| **Build Command** | `pip install -r backend/requirements.txt` |
| **Start Command** | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | `Free` (the slider on the right) |

### 3. Add Environment Variables

Click **Advanced** → **Add Environment Variable**:

```
GOOGLE_PLACES_API_KEY=your_api_key_here
OPENAI_API_KEY=your_api_key_here (optional)
```

### 4. Deploy

1. Click **Create Web Service**
2. Render builds and deploys automatically
3. Monitor logs in the dashboard
4. Once live, you'll get a URL like `https://restaurant-menu-finder-api.onrender.com`

**Note:** Free tier on Render spins down after 15 min of inactivity. First request after spin-down takes ~30 sec (acceptable for a portfolio).

---

## Step 3: Connect Frontend to Backend

Once Render backend is deployed, update the frontend to use the backend URL:

### Option A: Environment Variable (Recommended)

In Vercel dashboard:
1. Settings → Environment Variables
2. Add `VITE_API_URL=https://your-render-service.onrender.com`
3. Redeploy

### Option B: Hardcode (Quick)

Edit `frontend/src/api.ts`:
```typescript
const api = axios.create({ 
  baseURL: 'https://your-render-service.onrender.com/api' 
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

### Playwright/Chromium errors on Render

- Render's free tier doesn't have Chromium pre-installed
- Solution: The app falls back to httpx + heuristic parser (no JavaScript rendering)
- Works great for 90% of restaurant sites
- If you need Playwright, upgrade to a paid Render plan

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

### Render
- Dashboard: https://dashboard.render.com
- Real-time logs in the service view
- Monitor activity and spin-down events

---

## Cost

✅ **Completely FREE**

**Vercel (Frontend)**
- Free tier: up to 100 GB bandwidth/month
- Perfect for portfolio projects

**Render (Backend)**
- Free tier: always free
- Spins down after 15 min of inactivity (acceptable for portfolio)
- No credit card required

**Total cost: $0/month** ✓

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
