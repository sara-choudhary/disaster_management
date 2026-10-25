# Public Deployment Guide — Disaster-Resistant Emergency Communication Network

This guide details how to deploy your project to **Render** or **Vercel** with a public HTTPS link.

GitHub Repository:
**[https://github.com/sara-choudhary/disaster_management_v2](https://github.com/sara-choudhary/disaster_management_v2)**

---

## Method 1: Render.com (Recommended — Single Web Service)

Render builds and runs both the React frontend and FastAPI backend together on a single service with permanent HTTPS.

### Steps:
1. Go to [https://render.com](https://render.com) and click **Get Started for Free** (Sign in with your GitHub account).
2. Click the blue **New +** button in the top right, then select **Web Service**.
3. Choose **Build and deploy from a Git repository**, then select your repository: **`sara-choudhary/disaster_management_v2`**.
4. Configure the service settings:
   - **Name:** `disaster-emergency-network`
   - **Region:** Any (e.g., Singapore or Oregon)
   - **Branch:** `main`
   - **Root Directory:** *(leave blank)*
   - **Runtime:** `Python 3`
   - **Build Command:**
     ```bash
     pip install -r backend/requirements.txt && cd frontend && npm install && npm run build
     ```
   - **Start Command:**
     ```bash
     cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type:** `Free` ($0/month)
5. Click **Deploy Web Service**.
6. In ~2–3 minutes, your public URL will appear at the top of the dashboard:
   ```
   https://disaster-emergency-network.onrender.com
   ```
   - Opening this link loads the **React Frontend**.
   - Navigating to `/docs` opens the **Interactive Swagger API Documentation**.

---

## Method 2: Vercel (Frontend) + Render (Backend)

If you host the React frontend on Vercel's edge network:

1. Go to [https://vercel.com](https://vercel.com) and click **Add New Project**.
2. Import `sara-choudhary/disaster_management_v2`.
3. In settings:
   - **Root Directory:** select `frontend`
   - **Framework:** `Vite`
   - **Environment Variable:** Add `VITE_API_BASE_URL` with your deployed backend URL (e.g. `https://your-backend.onrender.com`).
4. Click **Deploy**. Vercel will assign a URL like `https://disaster-management-v2.vercel.app`.
