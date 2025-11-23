# API Keys Needed for Phase 3

## ✅ Already Have

### 1. **BKK FUTÁR API** (Budapest Public Transport)
- **Status:** ✅ Key created, waiting for activation (2 days)
- **Key:** `your_key_here`
- **Activation:** Expected ~11/25/2025
- **Action:** Already configured, just wait for activation
- **Cost:** Free

---

## 🔴 Required APIs (Need to Get)

### 2. **OpenRouteService** (Advanced Routing)
**Priority:** HIGH - Needed for real routing (walking, cycling, driving)

**What it does:**
- Real turn-by-turn directions
- Route geometry for map visualization
- Multiple transport modes (walking, cycling, driving)
- Currently using simple distance calculation as fallback

**How to get:**
1. Visit: https://openrouteservice.org/
2. Click "Sign Up" or "Get API Key"
3. Create free account
4. Get your API key from dashboard
5. **Free tier:** 2,000 requests/day (plenty for development)

**Add to `.env`:**
```env
OPENROUTESERVICE_API_KEY=your_key_here
```

**Time to get:** ~5 minutes

---

### 3. **OpenWeatherMap** (Weather Data)
**Priority:** MEDIUM - Nice to have for weather-aware recommendations

**What it does:**
- Current weather conditions
- 5-day forecast
- Weather alerts
- Weather context for route recommendations (e.g., "too rainy for cycling")

**How to get:**
1. Visit: https://openweathermap.org/api
2. Click "Sign Up" (top right)
3. Create free account
4. Go to "API keys" tab
5. Copy your API key
6. **Free tier:** 1,000 calls/day, 60 calls/minute

**Add to `.env`:**
```env
OPENWEATHER_API_KEY=your_key_here
```

**Time to get:** ~5 minutes

---

## 🟡 Optional APIs

### 4. **OpenAI API** (Enhanced AI Chat)
**Priority:** LOW - Already works without it (rule-based fallback)

**What it does:**
- Better AI responses
- More natural language understanding
- Context-aware conversations

**How to get:**
1. Visit: https://platform.openai.com/
2. Sign up / Log in
3. Go to API Keys section
4. Create new API key
5. **Cost:** Pay-as-you-go (~$0.002 per 1K tokens)

**Add to `.env`:**
```env
OPENAI_API_KEY=your_key_here
```

**Note:** App works fine without this - uses rule-based responses as fallback

---

### 5. **MOL Bubi API** (Budapest Bike Sharing)
**Priority:** LOW - May not have public API

**What it does:**
- Real-time bike station availability
- Bike locations and status

**Status:** 
- ❓ Unknown if public API exists
- Currently using mock data
- May need to contact MOL Bubi directly

**If API exists, add to `.env`:**
```env
MOL_BUBI_API_ENABLED=true
# May also need:
# MOL_BUBI_API_KEY=your_key_here
```

**Action:** Research if MOL Bubi has public API, or contact them

---

## 📋 Quick Setup Checklist

### Essential (Get These Now):
- [ ] **OpenRouteService** - Get free API key (~5 min)
- [ ] **OpenWeatherMap** - Get free API key (~5 min)

### Already Have:
- [x] **BKK FUTÁR** - Key created, waiting for activation

### Optional:
- [ ] **OpenAI** - Only if you want enhanced AI (costs money)
- [ ] **MOL Bubi** - Research if API exists

---

## 🚀 Quick Start Guide

### Step 1: Get OpenRouteService Key
1. Go to https://openrouteservice.org/
2. Sign up (free)
3. Copy API key
4. Add to `smart-city-app/backend/.env`:
   ```env
   OPENROUTESERVICE_API_KEY=paste_your_key_here
   ```

### Step 2: Get OpenWeatherMap Key
1. Go to https://openweathermap.org/api
2. Sign up (free)
3. Copy API key
4. Add to `smart-city-app/backend/.env`:
   ```env
   OPENWEATHER_API_KEY=paste_your_key_here
   ```

### Step 3: Update .env File
Your complete `.env` should look like:
```env
PORT=3001
NODE_ENV=development

# API Keys
OPENROUTESERVICE_API_KEY=your_openrouteservice_key
OPENWEATHER_API_KEY=your_openweather_key

# BKK FUTÁR API (already have)
BKK_API_KEY=your_key_here
BKK_API_ENABLED=true

# Optional
# OPENAI_API_KEY=your_openai_key
# MOL_BUBI_API_ENABLED=false
```

### Step 4: Restart Backend
```bash
cd smart-city-app/backend
npm run dev
```

---

## 💰 Cost Summary

| API | Cost | Free Tier |
|-----|------|-----------|
| **BKK FUTÁR** | Free | Unlimited |
| **OpenRouteService** | Free | 2,000 req/day |
| **OpenWeatherMap** | Free | 1,000 req/day |
| **OpenAI** | Paid | ~$0.002/1K tokens |
| **MOL Bubi** | Unknown | Unknown |

**Total for essential APIs:** $0 (all free!)

---

## 🎯 Priority Order

1. **OpenRouteService** ⭐⭐⭐ (HIGH)
   - Needed for real routing
   - Free, quick to get
   - Makes a big difference in user experience

2. **OpenWeatherMap** ⭐⭐ (MEDIUM)
   - Nice weather features
   - Free, quick to get
   - Enhances route recommendations

3. **BKK FUTÁR** ⭐⭐⭐ (HIGH)
   - Already have, just waiting
   - Essential for public transport
   - Will activate automatically

4. **OpenAI** ⭐ (LOW)
   - Optional enhancement
   - Costs money
   - App works without it

5. **MOL Bubi** ⭐ (LOW)
   - May not exist
   - Mock data works fine
   - Low priority

---

## 📝 Notes

- **All APIs have fallback to mock data** - App works without any keys!
- **Free tiers are generous** - Enough for development and testing
- **BKK API activation** - Takes 2 days, no action needed
- **Rate limits** - Be mindful of API rate limits in production

---

## ✅ After Getting Keys

Once you have the keys:
1. Add them to `.env` file
2. Restart backend server
3. Test endpoints to verify they work
4. Check backend logs for "✅ API active!" messages

The app will automatically use real data when keys are available!

