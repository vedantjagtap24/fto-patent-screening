const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
// Force Railway port or fallback
const port = process.env.PORT || process.env.RAILWAY_PORT || 3001;

console.log('Starting server...');
console.log('Available environment variables:');
console.log('PORT:', process.env.PORT);
console.log('RAILWAY_PORT:', process.env.RAILWAY_PORT);
console.log('Using port:', port);
console.log('OpenAI API Key present:', !!process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Add general request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.ip || 'unknown'}`);
  next();
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

// Simple test endpoint
app.get('/test', (req, res) => {
  console.log('TEST endpoint hit');
  res.send('Server is alive!');
});

// Root endpoint test
app.get('/ping', (req, res) => {
  console.log('PING endpoint hit');
  res.send('pong');
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested from:', req.ip || 'unknown');
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

// NEW: SSE endpoint for real-time progress
app.get('/analyze-stream', async (req, res) => {
  try {
    const claims = JSON.parse(req.query.claims);
    const features = JSON.parse(req.query.features);
    
    console.log(`Starting SSE analysis of ${claims.length} claims with ${features.length} features`);
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const sendUpdate = (data) => {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      res.write(message);
      console.log('SSE Update sent:', data.type, data.percentage ? `${data.percentage}%` : '');
    };

    // Send initial progress
    sendUpdate({ 
      type: 'progress', 
      processed: 0, 
      total: claims.length, 
      percentage: 0,
      message: `Initializing analysis of ${claims.length} patents...`
    });

    const results = [];
    const batchSize = 5; // Process 5 at a time for more frequent updates
    const totalBatches = Math.ceil(claims.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * batchSize;
      const endIdx = Math.min(startIdx + batchSize, claims.length);
      const batch = claims.slice(startIdx, endIdx);
      
      // Send batch start update
      sendUpdate({ 
        type: 'progress', 
        processed: startIdx, 
        total: claims.length, 
        percentage: Math.round((startIdx / claims.length) * 100),
        message: `Processing batch ${batchIndex + 1}/${totalBatches} (patents ${startIdx + 1}-${endIdx})...`
      });
      
      // Process batch in parallel
      const batchPromises = batch.map(async (claim, batchItemIndex) => {
        const globalIndex = startIdx + batchItemIndex;
        const claimText = claim.Claims || claim.claims || claim.Claim || claim.claim || '';
        const claimNumber = claim['S.No.'] || claim['S.No'] || claim['Claim Number'] || claim['Claim #'] || (globalIndex + 1);
        const publicationNumber = findPublicationNumber(claim);
        
        try {
          const analysis = await analyzeSingleClaim(claimText, claimNumber, features, claims);
          
          // Send individual completion update
          const completedCount = results.length + batchItemIndex + 1;
          sendUpdate({ 
            type: 'progress', 
            processed: completedCount, 
            total: claims.length, 
            percentage: Math.round((completedCount / claims.length) * 100),
            message: `Completed patent ${completedCount}/${claims.length} (${claimNumber})`
          });
          
          return { ...analysis, publicationNumber };
        } catch (error) {
          console.error(`Error processing claim ${claimNumber}:`, error);
          return createErrorResult(claimNumber, features, publicationNumber);
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Send batch completion update
      sendUpdate({ 
        type: 'progress', 
        processed: results.length, 
        total: claims.length, 
        percentage: Math.round((results.length / claims.length) * 100),
        message: `Batch ${batchIndex + 1}/${totalBatches} complete - ${results.length}/${claims.length} patents analyzed`
      });
      
      // Small delay between batches to prevent overwhelming
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Send final completion
    sendUpdate({
      type: 'complete',
      processed: claims.length,
      total: claims.length,
      percentage: 100,
      message: 'Analysis complete!',
      results: results
    });
    
    console.log(`SSE Analysis completed. Processed ${results.length} claims.`);
    
  } catch (error) {
    console.error('SSE Analysis error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: `Analysis failed: ${error.message}`
    })}\n\n`);
  }
  
  res.end();
});

// KEEP: Original batch endpoint as fallback
app.post('/analyze-all-claims', async (req, res) => {
  try {
    const { claims, features } = req.body;
    console.log(`Starting batch analysis of ${claims.length} claims with ${features.length} features`);
    
    const results = [];
    const batchSize = 10;
    const totalClaims = claims.length;
    
    for (let i = 0; i < totalClaims; i += batchSize) {
      const batch = claims.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalClaims/batchSize)}`);
      
      const batchPromises = batch.map(async (claim, batchIndex) => {
        const globalIndex = i + batchIndex;
        
        // IMPROVED: Better claim text extraction
        const claimText = claim.Claims || claim.claims || claim.Claim || claim.claim || '';
        
        // IMPROVED: Better claim number extraction
        const claimNumber = claim['S.No.'] || claim['S.No'] || claim['Claim Number'] || claim['Claim #'] || (globalIndex + 1);
        
        // IMPROVED: Better publication number extraction with flexible column names
        const publicationNumber = findPublicationNumber(claim);
        
        try {
          const analysis = await analyzeSingleClaim(claimText, claimNumber, features, claims);
          return { ...analysis, publicationNumber, index: globalIndex };
        } catch (error) {
          console.error(`Error processing claim ${claimNumber}:`, error);
          return createErrorResult(claimNumber, features, publicationNumber, globalIndex);
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      if (i + batchSize < totalClaims) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    results.sort((a, b) => a.index - b.index);
    const finalResults = results.map(({ index, ...result }) => result);
    
    console.log(`Batch analysis completed. Processed ${finalResults.length} claims.`);
    
    res.json({
      success: true,
      totalProcessed: finalResults.length,
      results: finalResults
    });

  } catch (error) {
    console.error('Error in batch analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process claims batch',
      results: []
    });
  }
});

// IMPROVED: Flexible publication number detection
function findPublicationNumber(claim) {
  const possibleColumns = [
    'Publication Number',
    'Publication',
    'Pub Number', 
    'Patent Number',
    'Patent Publication',
    'Publication No',
    'Pub No',
    'Patent No',
    'PublicationNumber',
    'PatentNumber'
  ];
  
  // Try exact matches first
  for (const col of possibleColumns) {
    if (claim[col] && claim[col] !== 'N/A' && claim[col] !== '') {
      return claim[col];
    }
  }
  
  // Try case-insensitive partial matches
  const columns = Object.keys(claim);
  for (const column of columns) {
    const lowerColumn = column.toLowerCase();
    if ((lowerColumn.includes('publication') || 
         lowerColumn.includes('patent') || 
         lowerColumn.includes('pub')) &&
        claim[column] && 
        claim[column] !== 'N/A' && 
        claim[column] !== '') {
      return claim[column];
    }
  }
  
  return 'N/A';
}

async function analyzeSingleClaim(claim, claimNumber, features, allClaims) {
  const featureList = features.map((feature, index) => `${index + 1}. ${feature}`).join('\n');

  const prompt = `Analyze the following patent claim and determine if it contains the specified features.

FEATURES TO DETECT:
${featureList}

PATENT CLAIM:
${claim}

RESPONSE FORMAT (JSON only):
{
${features.map((feature, index) => `  "feature_${index + 1}": {
    "feature_name": "${feature}",
    "present": true/false,
    "confidence": "High/Medium/Low",
    "reasoning": "Brief explanation",
    "relevant_claims": "If feature is present, list claim numbers (e.g., '1, 2, 3') where this feature appears. If not present, use 'N/A'"
  }`).join(',\n')}
}

IMPORTANT: For relevant_claims, provide only claim numbers (like "1, 2, 3") not the full text content.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      {
        role: 'system',
        content: 'You are a patent analysis expert. Always respond with valid JSON. For relevant_claims, provide only claim numbers, not full text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 2000,
    temperature: 0.1
  });

  const content = response.choices[0].message.content.trim();
  const analysis = JSON.parse(content);
  
  const result = {
    claimNumber,
    features: features,
    detailed_analysis: analysis
  };

  Object.keys(analysis).forEach(key => {
    result[key] = analysis[key]?.present || false;
  });
  
  return result;
}

function createErrorResult(claimNumber, features, publicationNumber, index) {
  const errorResult = {
    claimNumber,
    publicationNumber,
    features: features,
    detailed_analysis: {},
    index
  };

  features.forEach((feature, featureIndex) => {
    const key = `feature_${featureIndex + 1}`;
    errorResult[key] = false;
    errorResult.detailed_analysis[key] = {
      feature_name: feature,
      present: false,
      confidence: "Low",
      reasoning: "Analysis failed - unable to process claim",
      relevant_claims: "N/A"
    };
  });

  return errorResult;
}

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
  console.log('Actual port used:', port);
  
  // Test immediate health check
  setTimeout(() => {
    console.log('Server self-test: attempting internal health check...');
  }, 2000);
});