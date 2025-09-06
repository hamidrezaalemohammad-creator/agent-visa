# Agent Vista Deployment Guide

## Quick Deploy Options

### 1. Heroku (Recommended - Free Tier Available)

```bash
# 1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
# 2. Login to Heroku
heroku login

# 3. Initialize git repo (if not already done)
git init
git add .
git commit -m "Initial commit"

# 4. Create Heroku app
heroku create your-app-name-here

# 5. Set environment variables
heroku config:set NODE_ENV=production
# Optional: Add your API keys when you get them
# heroku config:set DDF_CLIENT_ID=your_client_id
# heroku config:set DDF_CLIENT_SECRET=your_client_secret
# heroku config:set GOOGLE_MAPS_API_KEY=your_api_key

# 6. Deploy
git push heroku main

# 7. Open your app
heroku open
```

### 2. Railway (Easiest)

1. Go to [railway.app](https://railway.app)
2. Connect your GitHub account
3. Click "Deploy from GitHub repo"
4. Select this project
5. Railway will auto-deploy when you push to GitHub

### 3. Render (Free)

1. Go to [render.com](https://render.com)
2. Connect your GitHub account
3. Create new Web Service
4. Set:
   - Build Command: `npm install`
   - Start Command: `node src/index.js`
   - Environment: `NODE_ENV=production`

### 4. Vercel (For static + serverless)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 5. DigitalOcean App Platform

1. Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. Create App
3. Connect GitHub repo
4. Configure:
   - Run Command: `node src/index.js`
   - Build Command: `npm install`

## Environment Variables for Production

Set these in your deployment platform:

- `NODE_ENV=production`
- `PORT` (usually auto-set by platform)
- `DDF_CLIENT_ID` (when you get DDF API access)
- `DDF_CLIENT_SECRET` (when you get DDF API access) 
- `GOOGLE_MAPS_API_KEY` (optional, for route optimization)

## Notes

- The app works without API keys (falls back to web scraping)
- Puppeteer may need additional configuration on some platforms
- Consider upgrading to paid tiers for better performance
- Set up monitoring and logging for production use

## Custom Domain

Most platforms allow custom domains:
- Heroku: `heroku domains:add yourdomain.com`
- Railway/Render: Available in dashboard settings
- DigitalOcean: Configure in App settings