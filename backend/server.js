const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || process.env.RAILWAY_PORT || 3001;

console.log('Starting server...');
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

// Determine build path
let buildPath;
const buildPath1 = path.join(__dirname, '../frontend/build');
const buildPath2 = path.join(process.cwd(), 'frontend/build');
const buildPath3 = '/app/frontend/build';
const buildPath4 = path.join(__dirname, 'frontend/build');

if (fs.existsSync(buildPath4)) {
  buildPath = buildPath4;
} else if (fs.existsSync(buildPath1)) {
  buildPath = buildPath1;
} else if (fs.existsSync(buildPath2)) {
  buildPath = buildPath2;
} else if (fs.existsSync(buildPath3)) {
  buildPath = buildPath3;
} else {
  buildPath = buildPath2;
}

console.log('Using build path:', buildPath);

if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  console.log('Static files middleware added');
}

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  try {
    res.status(200).json({ 
      status: 'Backend is running!',
      timestamp: new Date().toISOString(),
      buildExists: fs.existsSync(buildPath),
      port: port,
      env: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({ error: 'Health check failed', message: error.message });
  }
});

// NEW: Real-time progress endpoint using Server-Sent Events
app.post('/analyze-all-claims-stream', async (req, res) => {
  try {
    const { claims, features } = req.body;
    console.log(`Starting streaming analysis of ${claims.length} claims with ${features.length} features`);
    
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const results = [];
    const batchSize = 5; // Smaller batches for more frequent updates
    const totalClaims = claims.length;
    
    // Send initial progress
    sendProgress({
      type: 'progress',
      progress: 0,
      processedCount: 0,
      totalCount: totalClaims,
      message: 'Starting analysis...'
    });

    for (let i = 0; i < totalClaims; i += batchSize) {
      const batch = claims.slice(i, i + batchSize);
      const batchNumber = Math.floor(i/batchSize) + 1;
      const totalBatches = Math.ceil(totalClaims/batchSize);
      
      console.log(`Processing batch ${batchNumber}/${totalBatches}`);
      
      // Process each claim in the batch sequentially for real-time updates
      for (let j = 0; j < batch.length; j++) {
        const claim = batch[j];
        const globalIndex = i + j;
        const claimText = claim.Claims || claim.claims || claim.Claim || claim.claim || '';
        const claimNumber = claim['S.No.'] || claim['S.No'] || claim['Claim Number'] || claim['Claim #'] || (globalIndex + 1);
        const publicationNumber = findPublicationNumber(claim);
        
        // Send progress before processing this claim
        sendProgress({
          type: 'processing_claim',
          progress: Math.round((globalIndex / totalClaims) * 100),
          processedCount: globalIndex,
          totalCount: totalClaims,
          message: `Analyzing patent ${claimNumber}...`,
          currentClaim: claimNumber
        });
        
        try {
          const analysis = await analyzeSingleClaim(claimText, claimNumber, features, claims);
          const result = { ...analysis, publicationNumber, index: globalIndex };
          results.push(result);
          
          // Send progress after completing this claim
          sendProgress({
            type: 'claim_completed',
            progress: Math.round(((globalIndex + 1) / totalClaims) * 100),
            processedCount: globalIndex + 1,
            totalCount: totalClaims,
            message: `Completed patent ${claimNumber}`,
            claimNumber: claimNumber
          });
          
        } catch (error) {
          console.error(`Error processing claim ${claimNumber}:`, error);
          const errorResult = createErrorResult(claimNumber, features, publicationNumber, globalIndex);
          results.push(errorResult);
          
          sendProgress({
            type: 'claim_error',
            progress: Math.round(((globalIndex + 1) / totalClaims) * 100),
            processedCount: globalIndex + 1,
            totalCount: totalClaims,
            message: `Error processing patent ${claimNumber}`,
            claimNumber: claimNumber,
            error: error.message
          });
        }
        
        // Small delay between claims to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Send batch completion
      const completedSoFar = i + batch.length;
      sendProgress({
        type: 'batch_completed',
        progress: Math.round((completedSoFar / totalClaims) * 100),
        processedCount: completedSoFar,
        totalCount: totalClaims,
        message: `Completed batch ${batchNumber}/${totalBatches}`
      });
      
      // Delay between batches
      if (i + batchSize < totalClaims) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    results.sort((a, b) => a.index - b.index);
    const finalResults = results.map(({ index, ...result }) => result);
    
    // Send completion
    sendProgress({
      type: 'completed',
      progress: 100,
      processedCount: totalClaims,
      totalCount: totalClaims,
      message: 'Analysis complete!',
      results: finalResults
    });
    
    console.log(`Streaming analysis completed. Processed ${finalResults.length} claims.`);
    res.end();

  } catch (error) {
    console.error('Error in streaming analysis:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Failed to process claims',
      message: error.message
    })}\n\n`);
    res.end();
  }
});

// Keep the original batch endpoint as fallback
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
    'Publication Number', 'Publication', 'Pub Number', 'Patent Number',
    'Patent Publication', 'Publication No', 'Pub No', 'Patent No',
    'PublicationNumber', 'PatentNumber'
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

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.get('*', (req, res) => {
  let indexPath;
  const indexPath1 = path.join(__dirname, '../frontend/build', 'index.html');
  const indexPath2 = path.join(process.cwd(), 'frontend/build', 'index.html');
  const indexPath3 = '/app/frontend/build/index.html';
  const indexPath4 = path.join(__dirname, 'frontend/build', 'index.html');
  
  if (fs.existsSync(indexPath4)) {
    indexPath = indexPath4;
  } else if (fs.existsSync(indexPath1)) {
    indexPath = indexPath1;
  } else if (fs.existsSync(indexPath2)) {
    indexPath = indexPath2;
  } else if (fs.existsSync(indexPath3)) {
    indexPath = indexPath3;
  } else {
    indexPath = indexPath2;
  }
  
  console.log('Serving index.html for route:', req.path);
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`Frontend build not found. Tried: ${indexPath}`);
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  console.log('Server started successfully!');
});