# AI Smart City Project - Phase 2 Complete! 🎉

A web application with an interactive map on the left and AI chat interface on the right, designed for Budapest city services and navigation.

## 🚀 Phase 2 Features (NEW!)

- **Real Geospatial Data**: Integration with Nominatim and Overpass API
- **AI-Powered Chat**: OpenAI integration with specialized tools
- **Smart Place Search**: Find pharmacies, restaurants, banks, hospitals, and more
- **Route Planning**: Basic directions with geocoding
- **Enhanced Map Visualization**: Custom markers, route polylines, legend
- **Location Context**: "What's nearby" functionality
- **Fallback System**: Works with or without backend connection

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** with TypeScript
- **Tailwind CSS** for styling
- **Leaflet** for map functionality with custom markers
- **Lucide React** for icons
- **shadcn/ui** components
- **Axios** for API communication

### Backend
- **Express.js** with TypeScript
- **OpenAI API** integration (optional)
- **Nominatim** for geocoding
- **Overpass API** for place search
- **CORS** for cross-origin requests
- **dotenv** for environment variables

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OpenAI API key (optional, for enhanced AI responses)

### Frontend Setup
```bash
cd smart-city-app
npm install
npm run dev
```

### Backend Setup
```bash
cd smart-city-app/backend
npm install
npm run dev
```

### Environment Variables
Create a `.env` file in the backend directory:
```env
PORT=3001
NODE_ENV=development
OPENAI_API_KEY=your_openai_key_here
```

## 🎯 Usage

1. **Start the application**: Visit `http://localhost:3000`
2. **Allow location access**: The app will request your current location
3. **Try these queries**:
   - "Find pharmacies near me"
   - "Restaurants nearby"
   - "Route to Buda Castle"
   - "What's around here?"
   - "Find banks near me"
   - "Directions to city center"
4. **View results**: Markers appear on the map with custom colors and detailed popups

## 🔧 Development

### Project Structure
```
smart-city-app/
├── src/
│   ├── app/           # Next.js app directory
│   ├── components/   # React components
│   │   ├── ui/       # Reusable UI components
│   │   ├── Map.tsx   # Enhanced map with custom markers
│   │   └── Chat.tsx  # Chat interface
│   └── lib/          # Services and utilities
│       ├── api.ts    # API service layer
│       ├── geospatial.ts # Geospatial services
│       ├── routing.ts    # Routing services
│       └── ai-tools.ts   # AI tool functions
├── backend/
│   ├── src/          # Backend source code
│   └── dist/         # Compiled JavaScript
└── public/           # Static assets
```

### Available Scripts

#### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

#### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript
- `npm run start` - Start production server

## 🌍 API Endpoints

### Health Check
```
GET /api/health
```

### Enhanced Chat
```
POST /api/chat
Content-Type: application/json
{
  "message": "Find pharmacies near me",
  "userLocation": { "lat": 47.4979, "lng": 19.0402 }
}
```

### Places Search
```
GET /api/places/search?query=pharmacy&lat=47.4979&lng=19.0402&radius=1000
```

### Geocoding
```
GET /api/geocode?address=Buda Castle
```

### Routes
```
GET /api/routes?from=47.4979,19.0402&to=47.5079,19.0502
```

## 🎨 Enhanced Features

### Map Visualization
- **Custom Markers**: Color-coded by type (pharmacy=green, restaurant=amber, etc.)
- **Route Polylines**: Blue lines showing directions
- **Legend**: Visual guide for marker types
- **Route Info**: Distance and duration overlay
- **User Location**: Cyan marker for current position

### AI Tools
- **Find Places**: Search for specific services
- **Get Directions**: Route planning with geocoding
- **Location Context**: Discover what's nearby
- **Service Search**: Specialized searches for different amenities

### Smart Responses
- **Context-Aware**: Responses based on user location
- **Fallback System**: Works offline with mock data
- **Error Handling**: Graceful degradation
- **Real-time Updates**: Live map updates

## 🚀 Phase 3 Features (In Progress)

- [x] Real routing integration (OpenRouteService) ✅
- [x] Public transport data (BKK FUTÁR API) ✅
- [x] Shared mobility (MOL Bubi bikes API) ✅
- [x] Weather integration ✅
- [ ] Real-time transport updates (polling mechanisms)
- [ ] Advanced map features (clustering, heatmaps)
- [ ] Caching layer (Redis/in-memory)

## 🐛 Troubleshooting

### Common Issues

1. **Map not loading**: Check if Leaflet CSS is properly imported
2. **Location not detected**: Ensure HTTPS or localhost for geolocation
3. **Backend not responding**: Check if port 3001 is available
4. **No AI responses**: Verify OpenAI API key is set (optional)
5. **Places not found**: Check Overpass API availability

### Development Tips

- Use browser dev tools to inspect network requests
- Check console for any JavaScript errors
- Verify environment variables are set correctly
- Test API endpoints with Postman or curl
- Monitor API rate limits for external services

## 📝 License

This project is part of the AI Smart City initiative for Budapest.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Phase 2 Complete!** ✅
- ✅ Geospatial data integration
- ✅ AI chat integration  
- ✅ Core AI tools development
- ✅ Map visualization features

**Phase 3 In Progress!** 🚀
- ✅ OpenRouteService integration for advanced routing
- ✅ BKK FUTÁR API integration (with fallback)
- ✅ MOL Bubi API integration (with fallback)
- ✅ Enhanced weather service
- ✅ Real API support with graceful fallbacks

See `PHASE3_IMPLEMENTATION.md` for detailed implementation guide.