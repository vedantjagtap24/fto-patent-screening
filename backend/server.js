const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || process.env.RAILWAY_PORT || 3001;

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Static file serving (consolidated path checking)
const buildPaths = [
  path.join(__dirname, '../frontend/build'),
  path.join(process.cwd(), 'frontend/build'),
  '/app/frontend/build'
];

const buildPath = buildPaths.find(p => fs.existsSync(p));
if (buildPath) {
  app.use(express.static(buildPath));
  console.log('Static files served from:', buildPath);
}

// Utility functions (consolidated)
const findPublicationNumber = (claim) => {
  const possibleColumns = [
    'Publication Number', 'Publication', 'Pub Number', 'Patent Number',
    'Patent Publication', 'Publication No', 'Pub No', 'Patent No',
    'PublicationNumber', 'PatentNumber'
  ];
  
  // Try exact matches first
  for (const col of possibleColumns) {
    if (claim[col] && claim[col] !== 'N/A' && claim[col] !== '') {
      return claim[col];
    }
  }
  
  // Try partial matches
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
};

const createErrorResult = (claimNumber, features, publicationNumber, index) => {
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
};

// API Routes
app.get('/health', (req, res) => {
  try {
    res.status(200).json({ 
      status: 'Backend is running!',
      timestamp: new Date().toISOString(),
      port: port,
      env: process.env.NODE_ENV || 'development',
      openaiConfigured: !!process.env.OPENAI_API_KEY
    });
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({ error: 'Health check failed', message: error.message });
  }
});

// Single claim analysis function
async function analyzeSingleClaim(claim, claimNumber, features) {
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

  // Add feature flags to result
  Object.keys(analysis).forEach(key => {
    result[key] = analysis[key]?.present || false;
  });
  
  return result;
}

// Main analysis endpoint
app.post('/analyze-all-claims', async (req, res) => {
  try {
    const { claims, features } = req.body;
    console.log(`Starting analysis of ${claims.length} claims with ${features.length} features`);
    
    const results = [];
    const batchSize = 10;
    const totalClaims = claims.length;
    
    // Process in batches
    for (let i = 0; i < totalClaims; i += batchSize) {
      const batch = claims.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalClaims/batchSize)}`);
      
      const batchPromises = batch.map(async (claim, batchIndex) => {
        const globalIndex = i + batchIndex;
        
        const claimText = claim.Claims || claim.claims || claim.Claim || claim.claim || '';
        const claimNumber = claim['S.No.'] || claim['S.No'] || claim['Claim Number'] || claim['Claim #'] || (globalIndex + 1);
        const publicationNumber = findPublicationNumber(claim);
        
        try {
          const analysis = await analyzeSingleClaim(claimText, claimNumber, features);
          return { ...analysis, publicationNumber, index: globalIndex };
        } catch (error) {
          console.error(`Error processing claim ${claimNumber}:`, error);
          return createErrorResult(claimNumber, features, publicationNumber, globalIndex);
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Rate limiting between batches
      if (i + batchSize < totalClaims) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Sort results by index and remove index field
    results.sort((a, b) => a.index - b.index);
    const finalResults = results.map(({ index, ...result }) => result);
    
    console.log(`Analysis completed. Processed ${finalResults.length} claims.`);
    
    res.json({
      success: true,
      totalProcessed: finalResults.length,
      results: finalResults
    });

  } catch (error) {
    console.error('Error in analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process claims',
      message: error.message,
      results: []
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  const indexPaths = [
    path.join(__dirname, '../frontend/build/index.html'),
    path.join(process.cwd(), 'frontend/build/index.html'),
    '/app/frontend/build/index.html'
  ];
  
  const indexPath = indexPaths.find(p => fs.existsSync(p));
  
  if (indexPath) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend build not found');
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  console.log('OpenAI API Key present:', !!process.env.OPENAI_API_KEY);
  console.log('Build path found:', !!buildPath);
  console.log('Server started successfully!');
});