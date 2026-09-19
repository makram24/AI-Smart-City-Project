# Debugging OpenRouteService Integration

## Current Issue
The API is still returning fallback routes ("Start from origin") instead of real OpenRouteService data.

## Diagnostic Steps

### 1. Check Backend Console on Startup

When you start the backend (`npm run dev`), you should see one of these messages:

**✅ If key is loaded:**
```
✅ OpenRouteService API key found - real routing enabled
```

**❌ If key is NOT loaded:**
```
💡 OpenRouteService API key not found - using fallback routes
   Add OPENROUTESERVICE_API_KEY to .env file to enable real routing
```

### 2. Check Console When Making API Call

When you make a routing request, you should see:

**If API is working:**
```
🔍 Attempting OpenRouteService API call for foot-walking...
📡 OpenRouteService response status: 200
✅ OpenRouteService returned X segments
✅ OpenRouteService: Retrieved real walking route
```

**If API fails:**
```
🔍 Attempting OpenRouteService API call for foot-walking...
❌ Error fetching foot-walking route from OpenRouteService:
   Status: 401 (or 403)
   Status Text: Unauthorized
   ⚠️ Authentication failed - check API key
```

### 3. Verify .env File

Check that the key is in the correct location and format:

```powershell
cd smart-city-app/backend
Get-Content .env | Select-String "OPENROUTESERVICE"
```

Should show:
```
OPENROUTESERVICE_API_KEY=your_key_here
```

**Common Issues:**
- ❌ Extra spaces: `OPENROUTESERVICE_API_KEY = key`
- ❌ Quotes: `OPENROUTESERVICE_API_KEY="key"`
- ❌ Wrong location: Key in wrong `.env` file

### 4. Test API Key Directly

Test if the API key works with a direct curl call:

```powershell
$key = "your_key_here"

$body = @{
    coordinates = @(@(19.0402, 47.4979), @(19.0502, 47.5079))
    format = "json"
    instructions = $true
    instructions_format = "text"
} | ConvertTo-Json

$headers = @{
    "Authorization" = $key
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "https://api.openrouteservice.org/v2/directions/foot-walking" -Method Post -Body $body -Headers $headers
```

**If this works:** The API key is valid, issue is with backend configuration
**If this fails:** The API key might be invalid or expired

### 5. Check Server Restart

**CRITICAL:** After adding/changing `.env`, you MUST restart the server:

1. Stop server (Ctrl+C)
2. Wait a few seconds
3. Start again: `npm run dev`

The `.env` file is only read when the server starts!

### 6. Check Health Endpoint

```powershell
curl "http://localhost:3001/api/health"
```

Look for:
```json
{
  "features": {
    "openRouteService": true  // Should be true if key is loaded
  }
}
```

If `openRouteService: false`, the key is not being loaded.

## Most Common Issues

1. **Server not restarted** - Most common! Restart after changing .env
2. **Wrong .env location** - Must be in `smart-city-app/backend/.env`
3. **Key format issue** - No spaces, no quotes around the key
4. **Invalid API key** - Key might be expired or incorrect

## Next Steps

1. **Check backend console** - Look for the startup messages
2. **Check for error messages** - When making API calls
3. **Verify .env location** - Must be in backend directory
4. **Restart server** - After any .env changes
5. **Test health endpoint** - Verify key is loaded

## What to Share

If still not working, please share:
1. Backend console output on startup
2. Backend console output when making a routing request
3. Result of health check endpoint
4. Result of direct API test (step 4 above)

This will help identify the exact issue!

