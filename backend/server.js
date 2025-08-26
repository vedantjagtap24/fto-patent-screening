const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || process.env.RAILWAY_PORT || 3001;

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Supabase (using service role key for server-side operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Authentication middleware
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

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

// Utility functions
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

// API Routes
app.get('/health', (req, res) => {
  try {
    res.status(200).json({ 
      status: 'Backend is running!',
      timestamp: new Date().toISOString(),
      port: port,
      env: process.env.NODE_ENV || 'development',
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    });
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({ error: 'Health check failed', message: error.message });
  }
});

// Create or get current project
app.post('/api/projects', authenticateUser, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const { data, error } = await supabase
      .from('projects')
      .insert([
        {
          user_id: req.user.id,
          name: name || 'New Analysis Project',
          description: description || '',
          status: 'draft'
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, project: data });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project', message: error.message });
  }
});

// Get user's projects
app.get('/api/projects', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, projects: data });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects', message: error.message });
  }
});

// Save features for a project
app.post('/api/projects/:projectId/features', authenticateUser, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { features } = req.body;

    // First, delete existing features
    await supabase
      .from('features')
      .delete()
      .eq('project_id', projectId);

    // Insert new features
    const featureData = features.map((feature, index) => ({
      project_id: projectId,
      name: feature,
      order_index: index
    }));

    const { data, error } = await supabase
      .from('features')
      .insert(featureData)
      .select();

    if (error) throw error;

    res.json({ success: true, features: data });
  } catch (error) {
    console.error('Error saving features:', error);
    res.status(500).json({ error: 'Failed to save features', message: error.message });
  }
});

// Get features for a project
app.get('/api/projects/:projectId/features', authenticateUser, async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from('features')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    res.json({ success: true, features: data });
  } catch (error) {
    console.error('Error fetching features:', error);
    res.status(500).json({ error: 'Failed to fetch features', message: error.message });
  }
});

// Save patent claims for a project
app.post('/api/projects/:projectId/claims', authenticateUser, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { claims } = req.body;

    // First, delete existing claims
    await supabase
      .from('patent_claims')
      .delete()
      .eq('project_id', projectId);

    // Insert new claims
    const claimData = claims.map((claim, index) => ({
      project_id: projectId,
      claim_number: claim['S.No.'] || claim['S.No'] || claim['Claim Number'] || claim['Claim #'] || (index + 1),
      publication_number: findPublicationNumber(claim),
      claims_text: claim.Claims || claim.claims || claim.Claim || claim.claim || '',
      raw_data: claim
    }));

    const { data, error } = await supabase
      .from('patent_claims')
      .insert(claimData)
      .select();

    if (error) throw error;

    res.json({ success: true, claims: data });
  } catch (error) {
    console.error('Error saving claims:', error);
    res.status(500).json({ error: 'Failed to save claims', message: error.message });
  }
});

// Get claims for a project
app.get('/api/projects/:projectId/claims', authenticateUser, async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from('patent_claims')
      .select('*')
      .eq('project_id', projectId)
      .order('claim_number', { ascending: true });

    if (error) throw error;

    res.json({ success: true, claims: data });
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims', message: error.message });
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
  
  return analysis;
}

// Save analysis results to database
async function saveAnalysisResults(projectId, claimId, features, analysisResult) {
  try {
    // Calculate rank and feature count
    const featureCount = Object.keys(analysisResult).filter(key => 
      key.startsWith('feature_') && analysisResult[key]?.present === true
    ).length;
    
    let rank = null;
    if (featureCount === features.length) rank = 1;
    else if (featureCount >= Math.ceil(features.length * 0.75)) rank = 2;
    else if (featureCount >= Math.ceil(features.length * 0.5)) rank = 3;
    else if (featureCount >= 1) rank = 4;

    // Save analysis summary
    const { error: summaryError } = await supabase
      .from('analysis_summary')
      .insert([{
        project_id: projectId,
        claim_id: claimId,
        rank: rank,
        feature_count: featureCount,
        total_features: features.length,
        detailed_analysis: analysisResult
      }]);

    if (summaryError) throw summaryError;

    return { rank, featureCount };
  } catch (error) {
    console.error('Error saving analysis results:', error);
    throw error;
  }
}

// Main analysis endpoint with database integration
app.post('/api/projects/:projectId/analyze', authenticateUser, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Update project status to processing
    await supabase
      .from('projects')
      .update({ status: 'processing' })
      .eq('id', projectId);

    // Get features and claims from database
    const { data: features, error: featuresError } = await supabase
      .from('features')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    if (featuresError) throw featuresError;

    const { data: claims, error: claimsError } = await supabase
      .from('patent_claims')
      .select('*')
      .eq('project_id', projectId)
      .order('claim_number', { ascending: true });

    if (claimsError) throw claimsError;

    if (!features.length || !claims.length) {
      return res.status(400).json({ error: 'No features or claims found for this project' });
    }

    const featureNames = features.map(f => f.name);
    console.log(`Starting analysis of ${claims.length} claims with ${features.length} features`);
    
    const results = [];
    const batchSize = 10;
    const totalClaims = claims.length;
    
    // Process in batches
    for (let i = 0; i < totalClaims; i += batchSize) {
      const batch = claims.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalClaims/batchSize)}`);
      
      const batchPromises = batch.map(async (claim) => {
        try {
          const analysis = await analyzeSingleClaim(claim.claims_text, claim.claim_number, featureNames);
          const { rank, featureCount } = await saveAnalysisResults(projectId, claim.id, featureNames, analysis);
          
          const result = {
            claimNumber: claim.claim_number,
            publicationNumber: claim.publication_number,
            features: featureNames,
            detailed_analysis: analysis,
            rank,
            featureCount
          };

          // Add feature flags to result
          featureNames.forEach((_, index) => {
            const key = `feature_${index + 1}`;
            result[key] = analysis[key]?.present || false;
          });

          return result;
        } catch (error) {
          console.error(`Error processing claim ${claim.claim_number}:`, error);
          
          // Create error result
          const errorResult = {
            claimNumber: claim.claim_number,
            publicationNumber: claim.publication_number,
            features: featureNames,
            detailed_analysis: {},
            rank: null,
            featureCount: 0
          };

          featureNames.forEach((feature, index) => {
            const key = `feature_${index + 1}`;
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
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Rate limiting between batches
      if (i + batchSize < totalClaims) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Update project status to completed
    await supabase
      .from('projects')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    console.log(`Analysis completed. Processed ${results.length} claims.`);
    
    res.json({
      success: true,
      totalProcessed: results.length,
      results: results
    });

  } catch (error) {
    console.error('Error in analysis:', error);
    
    // Update project status to error
    if (req.params.projectId) {
      await supabase
        .from('projects')
        .update({ status: 'error' })
        .eq('id', req.params.projectId);
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process claims',
      message: error.message,
      results: []
    });
  }
});

// Get analysis results for a project
app.get('/api/projects/:projectId/results', authenticateUser, async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data: results, error } = await supabase
      .from('analysis_summary')
      .select(`
        *,
        patent_claims (
          claim_number,
          publication_number
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Get features for this project
    const { data: features } = await supabase
      .from('features')
      .select('name')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    const featureNames = features?.map(f => f.name) || [];

    // Format results to match frontend expectations
    const formattedResults = results.map(result => {
      const formatted = {
        claimNumber: result.patent_claims.claim_number,
        publicationNumber: result.patent_claims.publication_number,
        features: featureNames,
        detailed_analysis: result.detailed_analysis,
        rank: result.rank,
        featureCount: result.feature_count
      };

      // Add feature flags
      if (result.detailed_analysis) {
        Object.keys(result.detailed_analysis).forEach(key => {
          if (key.startsWith('feature_')) {
            formatted[key] = result.detailed_analysis[key]?.present || false;
          }
        });
      }

      return formatted;
    });

    res.json({ success: true, results: formattedResults, features: featureNames });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results', message: error.message });
  }
});

// Legacy endpoint for backward compatibility (will be removed later)
app.post('/analyze-all-claims', async (req, res) => {
  res.status(400).json({
    error: 'This endpoint is deprecated. Please use the new project-based API.',
    message: 'Create a project first, then use /api/projects/:projectId/analyze'
  });
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
  console.log('Supabase configured:', !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY));
  console.log('Build path found:', !!buildPath);
  console.log('Server started successfully!');
});