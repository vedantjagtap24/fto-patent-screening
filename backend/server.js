const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = 3001;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// NEW: Server-Sent Events endpoint for real-time progress
app.get('/analyze-stream', async (req, res) => {
  const { claims: claimsStr, features: featuresStr } = req.query;
  
  try {
    const claims = JSON.parse(decodeURIComponent(claimsStr));
    const features = JSON.parse(decodeURIComponent(featuresStr));
    
    console.log(`Starting streaming analysis of ${claims.length} claims with ${features.length} features`);
    
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const totalClaims = claims.length;
    let processedCount = 0;

    // Process claims one by one for real-time updates
    for (let i = 0; i < totalClaims; i++) {
      const claim = claims[i];
      const claimText = claim.Claims || claim.claims || claim.Claim || claim.claim || '';
      const claimNumber = claim['S.No.'] || claim['S.No'] || claim['Claim Number'] || claim['Claim #'] || (i + 1);
      const publicationNumber = findPublicationNumber(claim);
      
      try {
        // Send progress update
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          processed: processedCount,
          total: totalClaims,
          currentClaim: claimNumber
        })}\n\n`);

        // Analyze the claim
        const analysis = await analyzeSingleClaim(claimText, claimNumber, features, claims);
        const result = { ...analysis, publicationNumber };
        
        // Send result
        res.write(`data: ${JSON.stringify({
          type: 'result',
          result: result
        })}\n\n`);
        
        processedCount++;
        
        // Small delay to prevent overwhelming the client
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error processing claim ${claimNumber}:`, error);
        const errorResult = createErrorResult(claimNumber, features, publicationNumber, i);
        
        res.write(`data: ${JSON.stringify({
          type: 'result',
          result: errorResult
        })}\n\n`);
        
        processedCount++;
      }
    }
    
    // Send completion signal
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      totalProcessed: processedCount
    })}\n\n`);
    
    res.end();
    console.log(`Streaming analysis completed. Processed ${processedCount} claims.`);
    
  } catch (error) {
    console.error('Error in streaming analysis:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
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

app.get('/health', (req, res) => {
  res.json({ status: 'Backend is running!' });
});

app.listen(port, () => {
  console.log(`Batch processing backend server running at http://localhost:${port}`);
});