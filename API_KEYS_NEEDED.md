# API Keys Needed for Phase 3

## ✅ Already Have

### 1. **BKK FUTÁR API** (Budapest Public Transport)
- **Status:** ✅ Key created, waiting for activation (2 days)
- **Key:** `your_key_here`
- **Activation:** Expected ~11/25/2025
- **Action:** Already configured, just wait for activation
- **Cost:** Free

---

## ✅ Already Have (Just Need to Configure)

### 2. **OpenRouteService** (Advanced Routing)
**Priority:** HIGH - Needed for real routing (walking, cycling, driving)
**Status:** ✅ API Key Obtained!

**What it does:**
- Real turn-by-turn directions
- Route geometry for map visualization
- Multiple transport modes (walking, cycling, driving)
- According to [openrouteservice.org](https://openrouteservice.org/), you get:
  - Walking, cycling, driving routes
  - Up to 2,000 requests/day (free tier)
  - Isochrones (500/day free)
  - Time-distance matrices
  - And more!

**Next Step - Add to `.env`:**
```env
OPENROUTESERVICE_API_KEY=your_actual_api_key_here
```

**See `OPENROUTESERVICE_SETUP.md` for detailed setup instructions!**

---

### 3. **Weather API** (Weather Data)
**Priority:** ✅ DONE - Using Open-Meteo (FREE, no API key needed!)

**What it does:**
- Current weather conditions
- 5-day forecast
- Weather context for route recommendations (e.g., "too rainy for cycling")

**Status:** ✅ **Already implemented!**
- Using **Open-Meteo** (100% free, no API key needed)
- Unlimited requests
- Works immediately
- No signup required

**Optional:** If you want to use OpenWeatherMap instead:
1. Visit: https://openweathermap.org/api
2. Sign up (free)
3. Get API key
4. Add to `.env`: `OPENWEATHER_API_KEY=your_key_here`
5. The app will automatically use OpenWeatherMap if key is provided

**Current setup:** Open-Meteo (no action needed!)

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

### Essential APIs:
- [x] **OpenRouteService** - ✅ API key obtained (just add to `.env`)
- [x] **Weather API** - ✅ DONE! Using Open-Meteo (no key needed)
- [x] **BKK FUTÁR** - ✅ Key created (waiting for activation ~2 days)

### Already Have:
- [x] **BKK FUTÁR** - Key created, waiting for activation

### Optional:
- [ ] **OpenAI** - Only if you want enhanced AI (costs money)
- [ ] **MOL Bubi** - Research if API exists

---

## 🚀 Quick Start Guide

### Step 1: OpenRouteService ✅ DONE!
- ✅ API key obtained
- Now add it to your `.env` file (see Step 3 below)

### Step 2: Weather API ✅ DONE!
- **No action needed!** The app now uses Open-Meteo automatically
- It's 100% free, no API key required
- Works immediately without any setup
- If you prefer OpenWeatherMap, you can add `OPENWEATHER_API_KEY` to `.env` (optional)

### Step 3: Update .env File
Your complete `.env` should look like:
```env
PORT=3001
NODE_ENV=development

# API Keys
OPENROUTESERVICE_API_KEY=paste_your_openrouteservice_key_here
# OPENWEATHER_API_KEY=your_openweather_key (optional - Open-Meteo used by default)

# BKK FUTÁR API (already have)
BKK_API_KEY=your_key_here
BKK_API_ENABLED=true

# Optional
# OPENAI_API_KEY=your_openai_key
# MOL_BUBI_API_ENABLED=false
```

**Important:** Replace `paste_your_openrouteservice_key_here` with your actual OpenRouteService API key!

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
| **Weather (Open-Meteo)** | Free | Unlimited ✅ |
| **OpenAI** | Paid | ~$0.002/1K tokens |
| **MOL Bubi** | Unknown | Unknown |

**Total for essential APIs:** $0 (all free!)

---

## 🎯 Priority Order

1. **OpenRouteService** ⭐⭐⭐ (HIGH) ✅ DONE!
   - ✅ API key obtained
   - ✅ Just needs to be added to `.env` file
   - ✅ Will enable real routing with turn-by-turn directions

2. **Weather API** ⭐⭐⭐ (HIGH) ✅ DONE!
   - ✅ Using Open-Meteo (free, no key needed)
   - ✅ Already implemented
   - ✅ Works immediately
   - ✅ Enhances route recommendations

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

## ✅ Current Status & Next Steps

### What's Done:
- ✅ OpenRouteService API key obtained
- ✅ Weather API working (Open-Meteo, no key needed)
- ✅ BKK FUTÁR key created (waiting for activation)

### Action Required:
1. **Add OpenRouteService key to `.env`:**
   ```bash
   cd smart-city-app/backend
   # Edit .env file and add:
   OPENROUTESERVICE_API_KEY=your_actual_key_here
   ```

2. **Restart backend server:**
   ```bash
   npm run dev
   ```

3. **Test it:**
   ```bash
   curl "http://localhost:3001/api/routes?from=47.4979,19.0402&to=47.5079,19.0502&mode=walking"
   ```

4. **Check backend logs** for "✅ OpenRouteService active!" messages

The app will automatically use real routing when the key is configured!

