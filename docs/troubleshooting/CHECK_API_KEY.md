# Check OpenRouteService API Key Configuration

## Quick Check

The routing endpoint is returning fallback routes ("Start from origin"), which means the OpenRouteService API key is not being detected.

## Steps to Fix

### 1. Check if .env file exists and has the key

```bash
cd smart-city-app/backend
```

Check if `.env` file exists:
```bash
# Windows PowerShell
Test-Path .env

# Or check contents (be careful, don't share your key!)
Get-Content .env | Select-String "OPENROUTESERVICE"
```

### 2. Add API Key to .env

If `.env` doesn't exist or doesn't have the key:

```bash
# Create .env from example if it doesn't exist
if (!(Test-Path .env)) { Copy-Item env.example .env }

# Edit .env file and add:
# OPENROUTESERVICE_API_KEY=your_actual_api_key_here
```

**Important:** Replace `your_actual_api_key_here` with your real OpenRouteService API key!

### 3. Verify .env Format

Your `.env` file should look like:
```env
PORT=3001
NODE_ENV=development

OPENROUTESERVICE_API_KEY=your_actual_key_here

# Other keys...
BKK_API_KEY=your_key_here
BKK_API_ENABLED=true
```

**Common mistakes:**
- ❌ Extra spaces: `OPENROUTESERVICE_API_KEY = key` (should be no spaces around `=`)
- ❌ Quotes: `OPENROUTESERVICE_API_KEY="key"` (quotes not needed)
- ❌ Wrong variable name: `ORS_API_KEY` (should be `OPENROUTESERVICE_API_KEY`)

### 4. Restart Backend Server

**IMPORTANT:** After adding/changing `.env`, you MUST restart the backend:

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

### 5. Check Backend Console

When you start the backend, you should see:
```
✅ OpenRouteService API key found - real routing enabled
```

If you see:
```
💡 OpenRouteService API key not found - using fallback routes
```
Then the key is not being loaded.

### 6. Test Again

After restarting, test the endpoint:
```powershell
curl "http://localhost:3001/api/routes?from=47.4979,19.0402&to=47.5079,19.0502&mode=walking"
```

**With real API, you should see:**
- ✅ Detailed turn-by-turn instructions (not "Start from origin")
- ✅ Multiple route steps
- ✅ Accurate route geometry

**Check backend console for:**
- `✅ OpenRouteService: Retrieved real walking route`

## Troubleshooting

### Key not loading?

1. **Check .env location:**
   - Must be in `smart-city-app/backend/.env`
   - Not in root directory
   - Not in `smart-city-app/.env`

2. **Check file encoding:**
   - Should be UTF-8
   - No BOM (Byte Order Mark)

3. **Check for typos:**
   - Variable name: `OPENROUTESERVICE_API_KEY` (all caps, underscores)
   - No extra spaces

4. **Verify key is correct:**
   - Copy key from OpenRouteService dashboard
   - Make sure no extra characters

### Still not working?

Check backend console for errors:
- Authentication errors (401/403) = invalid key
- Network errors = API down or connection issue
- No errors but still using fallback = key not in .env

## Quick Test Command

Test if the key is being read:
```powershell
# In backend directory
node -e "require('dotenv').config(); console.log('Key:', process.env.OPENROUTESERVICE_API_KEY ? 'Found!' : 'NOT FOUND')"
```

If it says "NOT FOUND", the key is not in `.env` or `.env` is not being loaded.

