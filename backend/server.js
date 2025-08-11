const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || process.env.RAILWAY_PORT || 3001;

console.log('Starting server...');
console.log('Environment variables:');
console.log('PORT:', process.env.PORT);
console.log('RAILWAY_PORT:', process.env.RAILWAY_PORT);
console.log('Using port:', port);
console.log('OpenAI API Key present:', !!process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.ip || 'unknown'}`);
  next();
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// FIXED: Proper static file serving for Railway
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

// FIXED: Use the correct path based on Railway's structure
const buildPath = path.join(__dirname, '../frontend/build');

console.log('Build path:', buildPath);
console.log('Build path exists:', fs.existsSync(buildPath));

if (fs.existsSync(buildPath)) {
  console.log('Build directory contents:', fs.readdirSync(buildPath));
  
  // Serve static files from React build
  app.use(express.static(buildPath));
  console.log('✅ Static files middleware added for path:', buildPath);
} else {
  console.log('❌ ERROR: Build directory not found at:', buildPath);
  
  // Try alternative paths
  const altPath1 = path.join(process.cwd(), 'frontend/build');
  const altPath2 = '/app/frontend/build';
  
  console.log('Trying alternative path 1:', altPath1, 'exists:', fs.existsSync(altPath1));
  console.log('Trying alternative path 2:', altPath2, 'exists:', fs.existsSync(altPath2));
  
  if (fs.existsSync(altPath1)) {
    app.use(express.static(altPath1));
    console.log('✅ Using alternative path 1:', altPath1);
  } else if (fs.existsSync(altPath2)) {
    app.use(express.static(altPath2));
    console.log('✅ Using alternative path 2:', altPath2);
  }
}

// Test endpoints
app.get('/test', (req, res) => {
  console.log('TEST endpoint hit');
  res.send('Server is alive!');
});

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

// Patent analysis endpoint
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
        
        const claimText = claim.Claims || claim.claims || claim.Claim || claim.claim || '';
        const claimNumber = claim['S.No.'] || claim['S.No'] || claim['Claim Number'] || claim['Claim #'] || (globalIndex + 1);
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
  
  for (const col of possibleColumns) {
    if (claim[col] && claim[col] !== 'N/A' && claim[col] !== '') {
      return claim[col];
    }
  }
  
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
    model: 'gpt-4o',
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

// FIXED: Serve React app for all non-API routes (MUST be last)
app.get('*', (req, res) => {
  console.log('Serving React app for route:', req.path);
  
  const indexPath = path.join(__dirname, '../frontend/build/index.html');
  
  console.log('Index.html path:', indexPath);
  console.log('Index.html exists:', fs.existsSync(indexPath));
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Try alternative paths
    const altIndexPath1 = path.join(process.cwd(), 'frontend/build/index.html');
    const altIndexPath2 = '/app/frontend/build/index.html';
    
    if (fs.existsSync(altIndexPath1)) {
      console.log('Using alternative index path 1:', altIndexPath1);
      res.sendFile(altIndexPath1);
    } else if (fs.existsSync(altIndexPath2)) {
      console.log('Using alternative index path 2:', altIndexPath2);
      res.sendFile(altIndexPath2);
    } else {
      console.log('❌ No index.html found at any path');
      res.status(404).send(`Frontend build not found. Tried: ${indexPath}, ${altIndexPath1}, ${altIndexPath2}`);
    }
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${port}`);
  console.log('✅ Server started successfully!');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Railway PORT provided:', !!process.env.PORT);
  console.log('Actual port used:', port);
});