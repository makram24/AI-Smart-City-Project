# BKK FUTÁR API Setup Guide

## Your API Key

You have a BKK FUTÁR API key:
```
your_key_here
```

**Status:** Created (Activation pending - 2 days) ⏳  
**Company:** BME  
**Purpose:** AI Smart City Project for Budapest

⚠️ **Important:** BKK requires **2 days** for API key activation after creation. Until then, the API will return errors and the application will automatically use mock data.

## Configuration

Add your API key to the backend `.env` file:

```bash
cd smart-city-app/backend
```

Edit or create `.env` file:

```env
BKK_API_KEY=your_key_here
BKK_API_ENABLED=true
```

## API Endpoints

### Base URLs

1. **FUTÁR API** (JSON format, for application use):
   ```
   https://go.bkk.hu/api/query/v1/ws/otp/api/where
   ```

2. **GTFS-realtime** (Protocol Buffers, for real-time data):
   ```
   https://go.bkk.hu/api/query/v1/ws/gtfs-rt/full
   ```

### Available Endpoints

#### 1. Get Stops Near Location
```
GET https://go.bkk.hu/api/query/v1/ws/otp/api/where/stops-for-location
Parameters:
  - lat: latitude
  - lon: longitude
  - radius: radius in meters
  - key: YOUR_API_KEY
```

#### 2. Get Arrivals and Departures
```
GET https://go.bkk.hu/api/query/v1/ws/otp/api/where/arrivals-and-departures-for-stop
Parameters:
  - stopId: stop identifier
  - key: YOUR_API_KEY
  - minutesBefore: 0
  - minutesAfter: 30
```

#### 3. Plan Trip
```
GET https://go.bkk.hu/api/query/v1/ws/otp/api/where/plan-trip
Parameters:
  - fromPlace: "lat,lng"
  - toPlace: "lat,lng"
  - key: YOUR_API_KEY
  - mode: "TRANSIT,WALK"
  - numItineraries: 1
```

#### 4. Real-Time Alerts (GTFS-realtime)
```
GET https://go.bkk.hu/api/query/v1/ws/gtfs-rt/full/Alerts.txt?key=YOUR_API_KEY
```

#### 5. Vehicle Positions (GTFS-realtime)
```
GET https://go.bkk.hu/api/query/v1/ws/gtfs-rt/full/VehiclePositions.pb?key=YOUR_API_KEY
```

#### 6. Trip Updates (GTFS-realtime)
```
GET https://go.bkk.hu/api/query/v1/ws/gtfs-rt/full/TripUpdates.pb?key=YOUR_API_KEY
```

## Rate Limiting

⚠️ **Important:** Data is updated every 10 seconds or more. Do not refresh requests more frequently than every 5 seconds.

BKK reserves the right to limit keys for users with significantly higher load than normal. For business use or special needs, contact: bkk@bkk.hu

## Activation Status

### Current Status: ⏳ Waiting for Activation

Your API key was created on **11/23/2025 7:31 PM**. BKK requires **2 days** for activation, so your key should be active around **11/25/2025 7:31 PM**.

### How to Check if API is Active

1. **Check Backend Logs:**
   When the API becomes active, you'll see:
   ```
   ✅ BKK API active! Retrieved X real stops
   ```

2. **Test Directly:**
   ```bash
   curl "https://go.bkk.hu/api/query/v1/ws/otp/api/where/stops-for-location?lat=47.4979&lon=19.0402&radius=500&key=your_key_here"
   ```
   
   - **If active:** You'll get real BKK data
   - **If not active:** You'll get an error (401/403), and the app will use mock data

3. **Check Application:**
   - The app currently uses mock data (this is expected)
   - Once active, it will automatically switch to real data
   - No code changes needed!

## Testing

### Test with cURL

```bash
# Get stops near Deák Ferenc tér
curl "https://go.bkk.hu/api/query/v1/ws/otp/api/where/stops-for-location?lat=47.4979&lon=19.0402&radius=500&key=your_key_here"

# Get alerts
curl "https://go.bkk.hu/api/query/v1/ws/gtfs-rt/full/Alerts.txt?key=your_key_here"
```

### Test in Application

1. Start the backend server:
   ```bash
   cd smart-city-app/backend
   npm run dev
   ```

2. Test endpoints:
   ```bash
   # Get nearby stops
   curl "http://localhost:3001/api/transport/stops?lat=47.4979&lng=19.0402&radius=500"
   
   # Get arrivals (replace stop_001 with actual stop ID)
   curl "http://localhost:3001/api/transport/arrivals/stop_001"
   
   # Get disruptions
   curl "http://localhost:3001/api/transport/disruptions"
   ```

## Documentation

- **OpenAPI Specification:** `futar-openapi.yaml` (available from BKK)
- **Apiary Documentation:** https://bkkfutar.docs.apiary.io/
- **GTFS-realtime Protocol:** https://developers.google.com/transit/gtfs-realtime
- **GTFS Static Data:** Available as `budapest_gtfs.zip`

## License

BKK data is available under **Creative Commons 4.0 International (CC BY 4.0)** license.

You must attribute: "Data source: BKK Zrt., CC BY 4.0"

Full license: https://creativecommons.org/licenses/by/4.0/deed.en

## Implementation Status

✅ **Implemented in the codebase:**
- Nearby stops fetching
- Real-time arrivals
- Journey planning
- Transport alerts

🔄 **Available but not yet implemented:**
- Vehicle positions (GTFS-realtime)
- Trip updates (GTFS-realtime)
- GTFS static data parsing

## Troubleshooting

### API Key Not Working / Still Getting Mock Data

**Most Common Issue: API Key Not Yet Activated**
- ✅ **This is normal!** BKK requires 2 days for activation
- The application will automatically use mock data until the key is active
- Check backend logs for activation status
- After 2 days, the API will automatically start working

**Other Issues:**
- Verify the key is activated in Key Management (after 2 days)
- Check that `BKK_API_ENABLED=true` in `.env`
- Ensure the key is passed as query parameter `key`
- Check backend console for error messages

### Rate Limiting
- Reduce request frequency (minimum 5 seconds between requests)
- Implement caching for frequently accessed data
- Contact BKK for higher rate limits if needed

### Protocol Buffers (GTFS-realtime)
- For production, use a GTFS-realtime library
- Text format (`.txt`) is available for debugging
- Binary format (`.pb`) is more efficient

## Next Steps

1. ✅ Add API key to `.env` file
2. ✅ Test endpoints with real data
3. 🔄 Implement caching for stops and routes
4. 🔄 Add real-time vehicle position tracking
5. 🔄 Parse GTFS static data for route information

