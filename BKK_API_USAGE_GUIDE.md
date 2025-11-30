# BKK API Features - Usage Guide

This guide explains how to use all the BKK API features that have been implemented in the AI Smart City application.

## 🚀 Quick Start

### Prerequisites
1. **Backend Server Running**: Make sure the backend is running on `http://localhost:3001`
2. **BKK API Key**: Set `BKK_API_KEY=your_key_here` in your `.env` file
3. **Enable BKK API**: Set `BKK_API_ENABLED=true` in your `.env` file

---

## 📍 Feature 1: View Transport Stops

### How to Use:
1. **Open the Transport Panel** (middle panel on the right side)
2. The app automatically loads nearby transport stops when you allow location access
3. You'll see stops organized by type:
   - 🚇 **Metro Stations** (red)
   - 🚋 **Tram Stops** (green)
   - 🚌 **Bus Stops** (blue)

### What You Get:
- Stop names and locations
- Routes serving each stop
- Click any stop to get directions

---

## 🚗 Feature 2: Real-Time Vehicle Tracking

### How to Use:
1. **Click on any transport stop** in the Transport Panel
2. The app automatically:
   - Fetches vehicles serving that stop
   - Displays them on the map with vehicle icons
   - Updates positions every 30 seconds

### What You See:
- **Vehicle Markers** on the map:
  - 🚇 Metro vehicles (red circles)
  - 🚋 Tram vehicles (green circles)
  - 🚌 Bus vehicles (blue circles)
- **Vehicle Icons Rotate** to show direction of travel
- **Click a vehicle** to see:
  - Route number
  - Vehicle ID
  - Direction (bearing in degrees)
  - Wheelchair accessibility (♿)

### Example:
```
1. Click "Deák Ferenc tér M" stop
2. See vehicles on map: 🚇 M2, 🚌 Bus 5
3. Vehicles update automatically every 30 seconds
```

---

## 🗺️ Feature 3: Route Shapes & Details

### How to Use:
1. **Click on a route badge** (the colored pill next to route numbers in Transport Panel)
   - Example: Click the "M2" badge or "5" badge
2. The route shape appears on the map as a dashed colored line

### What You See:
- **Route Path**: Dashed line showing the complete route path
- **Route Color**: Color-coded by route type
- **Click the route line** to see route details

### Example:
```
1. Click "M2" badge in Transport Panel
2. See red dashed line showing M2 metro route path
3. Click the line to see route information
```

---

## 📋 Feature 4: Trip Information

### How to Use:
1. **Via API Endpoint** (for developers):
   ```
   GET /api/transport/trip/:tripId
   ```
2. **Via Chat**: Ask the AI assistant about trip schedules

### What You Get:
- Complete trip schedule
- All stops with arrival/departure times
- Stop sequence
- Trip destination (headsign)

---

## 🔄 Feature 5: Real-Time Arrivals

### How to Use:
1. **Click on any transport stop** in the Transport Panel
2. Arrivals are automatically fetched and displayed
3. Or use the arrivals endpoint directly

### What You See:
- Next arriving vehicles
- Estimated arrival times
- Delays (if any)
- Route and destination

---

## 🛣️ Feature 6: Journey Planning (BKK API)

### How to Use:
1. **In Transport Panel**: 
   - Select "Public Transport" mode (🚌 icon)
   - Enter destination address or coordinates
   - Click "Go" button
2. **Via Chat**: Ask "How do I get from X to Y by public transport?"
3. **Via Map**: Click a destination marker and select "Public Transport"

### What You Get:
- ✅ **Step-by-step journey plan** with detailed instructions
- ✅ **Multiple transport modes** (walking + metro/tram/bus)
- ✅ **Transfer information** (how many transfers needed)
- ✅ **Duration and distance** (total travel time)
- ✅ **Route visualization** on map (colored polyline)
- ✅ **Real-time BKK data** (uses live API)

### Example:
```
Route planned: 5.2 km in 25 minutes by public transport.

Step 1: Walk to Deák Ferenc tér M (3 min, 200m)
Step 2: Take M2 metro to Széll Kálmán tér M (8 min)
Step 3: Walk to destination (5 min, 400m)
```

**📖 For detailed guide, see: `BKK_JOURNEY_PLANNING_GUIDE.md`**

---

## 🚨 Feature 7: Transport Disruptions

### How to Use:
1. **Automatic**: Disruptions are shown in the Transport Panel
2. **Via Moodboard**: Click transport status for details
3. **Via API**: `GET /api/transport/disruptions`

### What You See:
- Active disruptions
- Affected routes
- Alternative suggestions

---

## 💬 Feature 8: Community Feedback

### How to Use:
1. **Click on a route badge** in Transport Panel
2. Select "Submit Feedback" option
3. Rate the route reliability (1-5 stars)
4. Add optional comment

### What You See:
- Current community sentiment (👍/👎/➖)
- Average reliability score
- Number of reviews
- Your feedback is added to the community data

---

## 🧪 Feature 9: Test BKK API Connection

### How to Use:
1. **Open in browser**: `http://localhost:3001/api/transport/test-bkk`
2. **With custom location**: 
   ```
   http://localhost:3001/api/transport/test-bkk?lat=47.4979&lng=19.0402&radius=500
   ```

### What You Get:
- API configuration status
- Connection test results
- Sample stops and vehicles
- Error diagnostics if API fails

---

## 📱 Complete User Flow Examples

### Example 1: Track a Bus
```
1. Open Transport Panel
2. Find a bus stop (e.g., "Astoria")
3. Click on the stop
4. See bus vehicles appear on map 🚌
5. Click a vehicle to see route and direction
6. Vehicles update every 30 seconds automatically
```

### Example 2: Plan a Journey
```
1. Open Transport Panel
2. Enter destination in route planning section
3. Select "Public Transport" mode
4. See journey plan with:
   - Walking to stop
   - Bus/Tram/Metro routes
   - Transfers
   - Total duration
```

### Example 3: Explore a Route
```
1. Click on a route badge (e.g., "M2")
2. See route shape appear on map
3. See all stops on that route
4. Click route line for details
5. Submit feedback on route reliability
```

### Example 4: Check Arrivals
```
1. Click on any stop in Transport Panel
2. See real-time arrivals:
   - "M2 to Örs vezér tere - 2 min"
   - "Bus 5 to Rákospalota - 5 min"
3. Click vehicle to see it on map
```

---

## 🎯 API Endpoints Reference

### For Developers:

1. **Get Nearby Stops**
   ```
   GET /api/transport/stops?lat=47.4979&lng=19.0402&radius=500
   ```

2. **Get Vehicles for Stop**
   ```
   GET /api/transport/vehicles/:stopId
   ```

3. **Get Route Details**
   ```
   GET /api/transport/route/:routeId
   ```

4. **Get Trip Information**
   ```
   GET /api/transport/trip/:tripId
   ```

5. **Get Arrivals**
   ```
   GET /api/transport/arrivals/:stopId
   ```

6. **Plan Journey**
   ```
   GET /api/routes?from=47.4979,19.0402&to=47.5079,19.0502&mode=public_transport
   ```

7. **Get Disruptions**
   ```
   GET /api/transport/disruptions
   ```

8. **Test BKK API**
   ```
   GET /api/transport/test-bkk
   ```

---

## 💡 Tips & Tricks

1. **Auto-Updates**: Vehicle positions update every 30 seconds when a stop is selected
2. **Route Badges**: Click route badges to see route shapes and submit feedback
3. **Stop Clicking**: Click any stop to load vehicles and get directions
4. **Map Interaction**: Click vehicle markers to see details
5. **Multiple Routes**: You can view multiple route shapes at once
6. **Real-Time Data**: All vehicle data is real-time from BKK API

---

## 🔧 Troubleshooting

### Vehicles Not Showing?
- Check if BKK API is enabled: `BKK_API_ENABLED=true`
- Verify API key is set: `BKK_API_KEY=your_key`
- Check browser console for errors
- Try the test endpoint: `/api/transport/test-bkk`

### Route Shapes Not Appearing?
- Make sure you clicked a route badge (not just the stop)
- Check if route has shape data available
- Some routes may not have shape data in the API

### No Real-Time Updates?
- Vehicle updates happen every 30 seconds
- Make sure a stop is selected
- Check network connection
- Verify backend is running

---

## 📊 Data Flow

```
User clicks stop
    ↓
Frontend calls: GET /api/transport/vehicles/:stopId
    ↓
Backend calls: BKK API vehicles-for-stop endpoint
    ↓
Backend processes and returns vehicle positions
    ↓
Frontend displays vehicles on map
    ↓
Auto-updates every 30 seconds
```

---

## 🎨 Visual Guide

### Map Icons:
- 🚇 **Red Circle** = Metro vehicle
- 🚋 **Green Circle** = Tram vehicle  
- 🚌 **Blue Circle** = Bus vehicle
- **Rotated Icon** = Shows vehicle direction
- **Dashed Line** = Route shape/path

### Transport Panel:
- **Stop Names** = Click to load vehicles
- **Route Badges** = Click to show route shape
- **Confidence Indicators** = Click to submit feedback

---

Enjoy exploring Budapest's public transport system in real-time! 🚇🚋🚌

