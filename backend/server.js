const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

console.log('Starting server...');
console.log('Port:', port);
console.log('OpenAI API Key present:', !!process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Debug: Check if build directory exists
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

// List what's actually in the container
console.log('Contents of /app:', fs.readdirSync('/app'));
if (fs.existsSync('/app/frontend')) {
  console.log('Contents of /app/frontend:', fs.readdirSync('/app/frontend'));
} else {
  console.log('/app/frontend does not exist');
}

// Try multiple possible paths
const buildPath1 = path.join(__dirname, '../frontend/build');
const buildPath2 = path.join(process.cwd(), 'frontend/build');
const buildPath3 = '/app/frontend/build';
const buildPath4 = path.join(__dirname, 'frontend/build'); // Since __dirname is /app

console.log('Build path 1 (relative):', buildPath1, 'exists:', fs.existsSync(buildPath1));
console.log('Build path 2 (from cwd):', buildPath2, 'exists:', fs.existsSync(buildPath2));
console.log('Build path 3 (absolute):', buildPath3, 'exists:', fs.existsSync(buildPath3));
console.log('Build path 4 (direct):', buildPath4, 'exists:', fs.existsSync(buildPath4));

// Use the path that exists
let buildPath;
if (fs.existsSync(buildPath4)) {
  buildPath = buildPath4;
} else if (fs.existsSync(buildPath1)) {
  buildPath = buildPath1;
} else if (fs.existsSync(buildPath2)) {
  buildPath = buildPath2;
} else if (fs.existsSync(buildPath3)) {
  buildPath = buildPath3;
} else {
  console.log('ERROR: No build directory found at any expected location');
  buildPath = buildPath2; // fallback
}

console.log('Using build path:', buildPath);

if (fs.existsSync(buildPath)) {
  console.log('Build directory contents:', fs.readdirSync(buildPath));
  // Serve static files from React build
  app.use(express.static(buildPath));
  console.log('Static files middleware added');
} else {
  console.log('WARNING: Build directory not found!');
}

// Health check endpoint (simplified)
app.get('/health', (req, res) => {
  console.log('Health check requested from:', req.ip);
  console.log('Request headers:', req.headers);
  try {
    res.status(200).json({ 
      status: 'Backend is running!',
      timestamp: new Date().toISOString(),
      buildExists: fs.existsSync(buildPath),
      port: port,
      env: process.env.NODE_ENV || 'development'
    });
    console.log('Health check response sent successfully');
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({ error: 'Health check failed', message: error.message });
  }
});

// Basic test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint requested');
  res.json({ message: 'API is working!' });
});

// Analyze all claims endpoint (simplified for now)
app.post('/analyze-all-claims', async (req, res) => {
  try {
    console.log('Analyze all claims endpoint hit');
    const { claims, features } = req.body;
    
    if (!claims || !features) {
      return res.status(400).json({
        success: false,
        error: 'Missing claims or features data'
      });
    }

    console.log(`Processing ${claims.length} claims with ${features.length} features`);
    
    // For now, return a simple response to test if basic functionality works
    res.json({
      success: true,
      message: 'Endpoint working - full AI analysis temporarily disabled for debugging',
      totalProcessed: claims.length,
      results: []
    });

  } catch (error) {
    console.error('Error in analyze-all-claims:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Serve React app for all non-API routes (IMPORTANT: This must be at the end)
app.get('*', (req, res) => {
  // Use the same buildPath logic for index.html
  let indexPath;
  const indexPath1 = path.join(__dirname, '../frontend/build', 'index.html');
  const indexPath2 = path.join(process.cwd(), 'frontend/build', 'index.html');
  const indexPath3 = '/app/frontend/build/index.html';
  const indexPath4 = path.join(__dirname, 'frontend/build', 'index.html'); // Since __dirname is /app
  
  if (fs.existsSync(indexPath4)) {
    indexPath = indexPath4;
  } else if (fs.existsSync(indexPath1)) {
    indexPath = indexPath1;
  } else if (fs.existsSync(indexPath2)) {
    indexPath = indexPath2;
  } else if (fs.existsSync(indexPath3)) {
    indexPath = indexPath3;
  } else {
    indexPath = indexPath2; // fallback
  }
  
  console.log('Serving index.html for route:', req.path);
  console.log('Index.html path:', indexPath);
  console.log('Index.html exists:', fs.existsSync(indexPath));
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.log('Available files in /app:', fs.readdirSync('/app'));
    res.status(404).send(`Frontend build not found. Tried: ${indexPath}. Available files: ${fs.readdirSync('/app').join(', ')}`);
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  console.log('Server started successfully!');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Railway PORT provided:', !!process.env.PORT);
});