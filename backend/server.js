const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

console.log('Starting server...');
console.log('Port:', port);
console.log('OpenAI API Key present:', !!process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Debug: Check if build directory exists
const buildPath = path.join(__dirname, '../frontend/build');
console.log('Build path:', buildPath);
console.log('Build directory exists:', fs.existsSync(buildPath));

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
  console.log('Health check requested');
  res.json({ 
    status: 'Backend is running!',
    timestamp: new Date().toISOString(),
    buildExists: fs.existsSync(buildPath)
  });
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
  const indexPath = path.join(__dirname, '../frontend/build', 'index.html');
  console.log('Serving index.html for route:', req.path);
  console.log('Index.html path:', indexPath);
  console.log('Index.html exists:', fs.existsSync(indexPath));
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend build not found');
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  console.log('Server started successfully!');
});