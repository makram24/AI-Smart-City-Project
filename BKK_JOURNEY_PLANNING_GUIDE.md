# BKK Journey Planning - Complete Guide

Yes! **You can plan trips using the BKK API**. The journey planning feature is fully implemented and integrated into the app. Here's how to use it:

---

## 🚀 Quick Start

### Method 1: Transport Panel (Easiest)

1. **Open Transport Panel** (middle panel on the right)
2. **Select "Public Transport" mode** (🚌 icon)
3. **Enter your destination** in the input field
   - Can be an address: `"Parliament, Budapest"`
   - Or coordinates: `"47.5079,19.0502"`
4. **Click "Go"** button
5. **See your journey plan**:
   - Route appears on map
   - Step-by-step instructions in chat
   - Duration and transfers shown

### Method 2: Via AI Chat

Ask the AI assistant:
- `"How do I get to Parliament by public transport?"`
- `"Plan a trip to Széchenyi Thermal Bath using BKK"`
- `"Show me the route to Heroes' Square by metro"`

The AI will:
1. Geocode your destination
2. Plan the journey using BKK API
3. Display route on map
4. Show step-by-step instructions

### Method 3: From Map Markers

1. **Click any marker** on the map (restaurant, museum, etc.)
2. **Click "Get Directions"** button
3. **Select "Public Transport"** mode
4. **Journey plan appears** automatically

---

## 📋 What You Get

### Journey Information:
- ✅ **Total Duration** (e.g., "25 minutes")
- ✅ **Number of Transfers** (e.g., "1 transfer")
- ✅ **Step-by-Step Instructions**:
  - Walk to nearest stop
  - Take metro/tram/bus
  - Transfer information
  - Walk to destination
- ✅ **Route Visualization** on map
- ✅ **Real-time Data** from BKK API

### Example Journey Plan:
```
Route planned: 5.2 km in 25 minutes by public transport.

Step 1: Walk to Deák Ferenc tér M (3 min, 200m)
Step 2: Take M2 metro to Széll Kálmán tér M (8 min)
Step 3: Walk to destination (5 min, 400m)
```

---

## 🎯 Detailed Usage Examples

### Example 1: Plan Trip to Parliament

**Via Transport Panel:**
1. Open Transport Panel
2. Select "Public Transport" mode
3. Enter: `"Parliament, Budapest"`
4. Click "Go"
5. See route: Your location → Nearest stop → Metro/Bus → Parliament

**Via Chat:**
```
You: "How do I get to Parliament by public transport?"
AI: "Planning your journey to Parliament..."
     [Route appears on map]
     "Route planned: 3.5 km in 18 minutes by public transport.
      Walk to Deák Ferenc tér M → Take M2 to Kossuth Lajos tér M → Walk to Parliament"
```

### Example 2: Plan Trip to Thermal Bath

**Via Map:**
1. Search for "thermal baths" (or click thermal bath marker)
2. Click on a thermal bath marker
3. Click "Get Directions"
4. Select "Public Transport"
5. Journey plan appears

**Via Chat:**
```
You: "Plan a trip to Széchenyi Thermal Bath"
AI: "Planning your journey to Széchenyi Thermal Bath..."
     [Route appears on map]
     "Route planned: 6.8 km in 32 minutes by public transport.
      Walk to Astoria → Take Bus 72 to Széchenyi fürdő → Walk to entrance"
```

### Example 3: Plan Trip with Coordinates

**Via Transport Panel:**
1. Select "Public Transport" mode
2. Enter coordinates: `"47.5079,19.0502"`
3. Click "Go"
4. Journey plan appears

---

## 🔧 Technical Details

### API Endpoint:
```
GET /api/routes?from=47.4979,19.0402&to=47.5079,19.0502&mode=public_transport
```

### Backend Implementation:
- Uses BKK FUTÁR API `/plan-trip` endpoint
- Handles multiple coordinate formats automatically
- Falls back to mock data if API unavailable
- Returns step-by-step journey plan

### Response Format:
```json
{
  "id": "1234567890",
  "mode": "public_transport",
  "from": "Starting point",
  "to": "Destination",
  "distance": "5.2 km",
  "duration": "25 minutes",
  "transfers": 1,
  "steps": [
    {
      "type": "walk",
      "from": "Starting point",
      "to": "Deák Ferenc tér M",
      "duration": 3,
      "distance": 200
    },
    {
      "type": "metro",
      "route": "M2",
      "from": "Deák Ferenc tér M",
      "to": "Széll Kálmán tér M",
      "duration": 8
    },
    {
      "type": "walk",
      "from": "Széll Kálmán tér M",
      "to": "Destination",
      "duration": 5,
      "distance": 400
    }
  ],
  "polyline": [[47.4979, 19.0402], [47.5079, 19.0502], ...]
}
```

---

## 💡 Tips & Tricks

### 1. **Always Uses Your Current Location**
- The journey always starts from your current GPS location
- No need to enter starting point
- Automatically finds nearest transport stop

### 2. **Smart Geocoding**
- Enter addresses in any format:
  - `"Parliament, Budapest"`
  - `"Kossuth Lajos tér 1-3"`
  - `"Heroes' Square"`
- Or use coordinates: `"47.5079,19.0502"`

### 3. **Multiple Transport Modes**
- Journey can include:
  - Walking to/from stops
  - Metro (M1, M2, M3, M4)
  - Tram (1, 2, 4, 6, etc.)
  - Bus (any route)
  - Transfers between modes

### 4. **Real-Time Data**
- Uses live BKK API data
- Considers current schedules
- Shows actual travel times

### 5. **Route Visualization**
- Route appears as colored line on map
- Shows all stops along the way
- Click route to see details

---

## 🚨 Troubleshooting

### "No route found"
- **Check destination**: Make sure address is in Budapest
- **Check location**: Ensure you're in Budapest area
- **Try coordinates**: Use lat/lng if address fails
- **Check API**: Verify BKK API is enabled

### Route not appearing on map
- **Check browser console** for errors
- **Verify backend** is running
- **Check network** connection
- **Try refreshing** the page

### Wrong route shown
- **Check destination** spelling
- **Try different address format**
- **Use coordinates** for exact location
- **Check if location is in Budapest**

### API errors
- **Check `.env` file**: `BKK_API_ENABLED=true` and `BKK_API_KEY=your_key`
- **Test API**: Visit `/api/transport/test-bkk`
- **Check backend logs** for detailed errors

---

## 📊 Journey Planning Flow

```
User enters destination
    ↓
Frontend geocodes destination (if needed)
    ↓
Frontend calls: GET /api/routes?from=user_location&to=destination&mode=public_transport
    ↓
Backend calls: BKK API /plan-trip endpoint
    ↓
Backend processes response:
    - Extracts itinerary
    - Parses legs (walk, metro, tram, bus)
    - Calculates duration and transfers
    ↓
Backend returns journey plan
    ↓
Frontend displays:
    - Route on map (polyline)
    - Step-by-step instructions in chat
    - Duration and distance
```

---

## 🎨 Visual Guide

### Transport Panel:
```
┌─────────────────────────────┐
│ Route Planning              │
├─────────────────────────────┤
│ Mode: [🚶] [🚴] [🚌]        │
│                             │
│ Destination:                │
│ [📍] [Enter address...] [Go]│
└─────────────────────────────┘
```

### Journey Plan Display:
```
Route planned: 5.2 km in 25 minutes by public transport.

Step 1: Walk to Deák Ferenc tér M (3 min, 200m)
Step 2: Take M2 metro to Széll Kálmán tér M (8 min)
Step 3: Walk to destination (5 min, 400m)

[Route shown on map as colored line]
```

---

## 🔗 Related Features

### Combine with Other Features:
1. **View Real-Time Vehicles**: After planning, click stops to see vehicles
2. **Check Arrivals**: See when next vehicle arrives
3. **View Route Shapes**: Click route badges to see full route path
4. **Submit Feedback**: Rate route reliability after your trip
5. **Safety Analysis**: Check route safety before traveling

---

## ✅ Summary

**Yes, you can plan trips using BKK API!**

**3 Ways to Use:**
1. ✅ **Transport Panel** - Select mode, enter destination, click Go
2. ✅ **AI Chat** - Ask "How do I get to X by public transport?"
3. ✅ **Map Markers** - Click marker → Get Directions → Public Transport

**What You Get:**
- ✅ Step-by-step journey plan
- ✅ Route visualization on map
- ✅ Duration and transfer information
- ✅ Real-time BKK data

**Try it now:**
1. Open Transport Panel
2. Select "Public Transport" mode
3. Enter: `"Parliament, Budapest"`
4. Click "Go"
5. See your journey plan! 🚇🚋🚌

---

Enjoy planning your trips around Budapest with BKK! 🗺️

