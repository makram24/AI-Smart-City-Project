#!/usr/bin/env node

const axios = require('axios');

async function testServers() {
  console.log('🧪 Testing AI Smart City Application...\n');

  // Test Backend Health
  try {
    console.log('1. Testing Backend Health...');
    const backendResponse = await axios.get('http://localhost:3001/api/health', { timeout: 5000 });
    console.log('✅ Backend is running!');
    console.log(`   Status: ${backendResponse.data.status}`);
    console.log(`   Message: ${backendResponse.data.message}`);
    console.log(`   Features: ${JSON.stringify(backendResponse.data.features)}\n`);
  } catch (error) {
    console.log('❌ Backend is not responding');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test Frontend
  try {
    console.log('2. Testing Frontend...');
    const frontendResponse = await axios.get('http://localhost:3000', { timeout: 5000 });
    console.log('✅ Frontend is running!');
    console.log(`   Status: ${frontendResponse.status}\n`);
  } catch (error) {
    console.log('❌ Frontend is not responding');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test Chat API
  try {
    console.log('3. Testing Chat API...');
    const chatResponse = await axios.post('http://localhost:3001/api/chat', {
      message: 'Find pharmacies near me',
      userLocation: { lat: 47.4979, lng: 19.0402 }
    }, { timeout: 10000 });
    
    console.log('✅ Chat API is working!');
    console.log(`   Response: ${chatResponse.data.text}`);
    console.log(`   Markers: ${chatResponse.data.markers?.length || 0} found\n`);
  } catch (error) {
    console.log('❌ Chat API is not working');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test Places Search API
  try {
    console.log('4. Testing Places Search API...');
    const placesResponse = await axios.get('http://localhost:3001/api/places/search', {
      params: {
        query: 'pharmacy',
        lat: 47.4979,
        lng: 19.0402,
        radius: 1000
      },
      timeout: 10000
    });
    
    console.log('✅ Places Search API is working!');
    console.log(`   Found ${placesResponse.data.places?.length || 0} places\n`);
  } catch (error) {
    console.log('❌ Places Search API is not working');
    console.log(`   Error: ${error.message}\n`);
  }

  console.log('🎯 Test Summary:');
  console.log('   - Visit http://localhost:3000 to see the frontend');
  console.log('   - Backend API is available at http://localhost:3001');
  console.log('   - Check the browser console for any errors');
  console.log('   - Try asking: "Find pharmacies near me" or "Restaurants nearby"');
}

testServers().catch(console.error);
