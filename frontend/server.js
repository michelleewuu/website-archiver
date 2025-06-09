const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.url === '/app.js') {
    console.log('Headers:', req.headers);
  }
  next();
});

// Explicitly handle app.js
app.get('/app.js', (req, res) => {
  console.log('Attempting to serve app.js');
  const filePath = path.join(__dirname, 'app.js');
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error('app.js file not found at:', filePath);
    res.status(404).send('app.js not found');
    return;
  }

  // Set appropriate headers
  res.set({
    'Content-Type': 'application/javascript',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });

  // Stream the file instead of reading it all at once
  const stream = fs.createReadStream(filePath, 'utf8');
  
  stream.on('error', (error) => {
    console.error('Error streaming app.js:', error);
    res.status(500).send('Error loading app.js');
  });

  stream.on('open', () => {
    console.log('Successfully opened app.js for streaming');
  });

  stream.on('end', () => {
    console.log('Finished streaming app.js');
  });

  stream.pipe(res);
});

// Serve static files from the current directory
app.use(express.static(__dirname, {
  setHeaders: (res, path) => {
    console.log(`Serving static file: ${path}`);
  }
}));

// Serve index.html for all routes
app.get('*', (req, res) => {
  console.log(`Serving index.html for ${req.url}`);
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Frontend server running at http://localhost:${port}`);
  console.log(`Serving files from: ${__dirname}`);
  console.log('Available files:', fs.readdirSync(__dirname).join(', '));
}); 