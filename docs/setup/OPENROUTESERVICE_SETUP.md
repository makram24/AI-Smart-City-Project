# OpenRouteService Setup Guide

## ✅ Status: API Key Obtained!

You've successfully obtained your OpenRouteService API key. Now let's configure it!

## Quick Setup

### Step 1: Add API Key to .env

1. Navigate to your backend directory:
   ```bash
   cd smart-city-app/backend
   ```

2. Open or create `.env` file:
   ```bash
   # If .env doesn't exist, copy from example
   cp env.example .env
   ```

3. Edit `.env` and add your OpenRouteService API key:
   ```env
   OPENROUTESERVICE_API_KEY=your_actual_api_key_here
   ```

### Step 2: Restart Backend Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 3: Test It!

Test the routing endpoint:
```bash
# Test walking route
curl "http://localhost:3001/api/routes?from=47.4979,19.0402&to=47.5079,19.0502&mode=walking"

# Test cycling route
curl "http://localhost:3001/api/routes?from=47.4979,19.0402&to=47.5079,19.0502&mode=cycling"
```

You should see:
- ✅ Real route geometry (coordinates for map)
- ✅ Turn-by-turn instructions
- ✅ Accurate distance and duration
- ✅ Multiple route steps

## What You Get with OpenRouteService

According to [openrouteservice.org](https://openrouteservice.org/), you now have access to:

### ✅ Directions API
- **Walking routes** - Pedestrian-friendly paths
- **Cycling routes** - Bike-optimized routes (regular, road, mountain, electric)
- **Driving routes** - Car and truck routing
- **Wheelchair routes** - Accessibility-focused routing
- **Rich route instructions** - Turn-by-turn directions
- **Route geometry** - Coordinates for map visualization

### ✅ Additional Features (Available)
- **Isochrones** - Reachability analysis (up to 500/day free)
- **Time-Distance Matrix** - Fast many-to-many calculations
- **Geocoding** - Address to coordinates conversion
- **POIs** - Points of interest along routes
- **Elevation** - Height information for routes

## Free Tier Limits

According to the [OpenRouteService website](https://openrouteservice.org/):
- **2,000 requests/day** for directions (free tier)
- **500 isochrones/day** (free tier)
- **Unlimited** for most other features

**Note:** This is plenty for development and testing!

## Current Implementation

Your app now supports:

1. **Walking Routes** - Real pedestrian paths
2. **Cycling Routes** - Bike-optimized routes
3. **Driving Routes** - Car routing (if needed)

All routes include:
- ✅ Accurate distance calculations
- ✅ Realistic duration estimates
- ✅ Turn-by-turn instructions
- ✅ Route geometry for map display

## Troubleshooting

### API Key Not Working?

1. **Check .env file:**
   ```bash
   cat smart-city-app/backend/.env | grep OPENROUTESERVICE
   ```
   Should show: `OPENROUTESERVICE_API_KEY=your_key`

2. **Check backend logs:**
   - Look for errors about authentication
   - Should see successful route requests

3. **Test directly:**
   ```bash
   curl "https://api.openrouteservice.org/v2/directions/foot-walking?api_key=YOUR_KEY&start=19.0402,47.4979&end=19.0502,47.5079"
   ```

### Still Using Fallback Routes?

If you see simple straight-line routes:
- ✅ Check that API key is in `.env`
- ✅ Restart backend server
- ✅ Check backend console for errors
- ✅ Verify API key is correct

## Next Steps

1. ✅ Add API key to `.env`
2. ✅ Restart backend
3. ✅ Test routing endpoints
4. ✅ Try routes in the frontend app
5. 🎉 Enjoy real routing!

## Documentation

- **Official Docs:** https://openrouteservice.org/dev/#/api-docs
- **API Playground:** https://openrouteservice.org/dev/#/api-docs/directions
- **Dashboard:** https://openrouteservice.org/dev/#/dashboard (login to see usage)

---

**You're all set!** Just add the key to `.env` and restart the backend. Real routing will work immediately! 🚀

