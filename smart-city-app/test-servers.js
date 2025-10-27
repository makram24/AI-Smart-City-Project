const http = require('http');

// Test if backend is running
const testBackend = () => {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/health',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`Backend Status: ${res.statusCode}`);
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Backend Response:', data);
    });
  });

  req.on('error', (error) => {
    console.log('Backend Error:', error.message);
  });

  req.end();
};

// Test if frontend is running
const testFrontend = () => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`Frontend Status: ${res.statusCode}`);
  });

  req.on('error', (error) => {
    console.log('Frontend Error:', error.message);
  });

  req.end();
};

console.log('Testing servers...');
testBackend();
testFrontend();
