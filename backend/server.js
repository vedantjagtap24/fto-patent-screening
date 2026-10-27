const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || process.env.RAILWAY_PORT || 3001;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 6 });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

app.use(cors());
app.use(express.json({ limit: '100mb' }));

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No authorization token provided' });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

const buildPaths = [
  path.join(__dirname, 'public'),
  path.join(__dirname, '../frontend/build'),
  path.join(process.cwd(), 'frontend/build'),
  '/app/frontend/build'
];
const buildPath = buildPaths.find(p => fs.existsSync(p));
if (buildPath) {
  app.use(express.static(buildPath));
}

const findPublicationNumber = (claim) => {
  const columns = ['Publication Number', 'Publication', 'Pub Number', 'Patent Number', 'Patent Publication', 'Publication No', 'Pub No', 'Patent No', 'PublicationNumber', 'PatentNumber'];
  
  for (const col of columns) {
    if (claim[col] && claim[col] !== 'N/A' && claim[col] !== '') {
      return claim[col];
    }
  }
  
  const keys = Object.keys(claim);
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if ((lowerKey.includes('publication') || lowerKey.includes('patent') || lowerKey.includes('pub')) &&
        claim[key] && claim[key] !== 'N/A' && claim[key] !== '') {
      return claim[key];
    }
  }
  
  return 'N/A';
};

// Supabase returns at most 1000 rows per request, so page through larger tables
const PAGE_SIZE = 1000;
const fetchAll = async (buildQuery) => {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
};

const dbOperation = async (operation) => {
  try {
    const result = await operation();
    return { success: true, data: result.data, error: result.error };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'Backend is running',
    timestamp: new Date().toISOString(),
    port,
    env: process.env.NODE_ENV || 'development',
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    buildPath: buildPath || 'Not found'
  });
});

const projectRoutes = {
  create: async (req, res) => {
    const { name, description } = req.body;
    const result = await dbOperation(
      () => supabase.from('projects').insert([{
        user_id: req.user.id,
        name: name || 'New Analysis Project',
        description: description || '',
        status: 'draft'
      }]).select().single()
    );
    
    result.success ? res.json({ success: true, project: result.data }) : 
                    res.status(500).json({ error: 'Failed to create project', message: result.error });
  },

  list: async (req, res) => {
    const result = await dbOperation(
      () => supabase.from('projects').select('*').eq('user_id', req.user.id).order('updated_at', { ascending: false })
    );
    
    result.success ? res.json({ success: true, projects: result.data }) :
                    res.status(500).json({ error: 'Failed to fetch projects', message: result.error });
  }
};

const featureRoutes = {
  save: async (req, res) => {
    const { projectId } = req.params;
    const { features } = req.body;

    await supabase.from('features').delete().eq('project_id', projectId);
    
    const result = await dbOperation(
      () => supabase.from('features').insert(
        features.map((feature, index) => ({
          project_id: projectId,
          name: feature,
          order_index: index
        }))
      ).select()
    );

    result.success ? res.json({ success: true, features: result.data }) :
                    res.status(500).json({ error: 'Failed to save features', message: result.error });
  },

  get: async (req, res) => {
    const { projectId } = req.params;
    const result = await dbOperation(
      () => supabase.from('features').select('*').eq('project_id', projectId).order('order_index', { ascending: true })
    );

    result.success ? res.json({ success: true, features: result.data }) :
                    res.status(500).json({ error: 'Failed to fetch features', message: result.error });
  }
};

const claimRoutes = {
  save: async (req, res) => {
    const { projectId } = req.params;
    const { claims, append, offset = 0 } = req.body;

    // Large files arrive in chunks: the first replaces old claims, the rest append
    if (!append) {
      await supabase.from('analysis_summary').delete().eq('project_id', projectId);
      await supabase.from('patent_claims').delete().eq('project_id', projectId);
    }
    
    const result = await dbOperation(
      () => supabase.from('patent_claims').insert(
        claims.map((claim, index) => ({
          project_id: projectId,
          claim_number: claim['S.No.'] || claim['S.No'] || claim['Claim Number'] || claim['Claim #'] || (offset + index + 1),
          publication_number: findPublicationNumber(claim),
          claims_text: claim.Claims || claim.claims || claim.Claim || claim.claim || '',
          raw_data: claim
        }))
      ).select()
    );

    result.success && !result.error ? res.json({ success: true, saved: result.data.length }) :
                    res.status(500).json({ error: 'Failed to save claims', message: result.error?.message || result.error });
  },

  get: async (req, res) => {
    const { projectId } = req.params;
    try {
      const claims = await fetchAll(
        () => supabase.from('patent_claims').select('*').eq('project_id', projectId).order('claim_number', { ascending: true })
      );
      res.json({ success: true, claims });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch claims', message: error.message });
    }
  }
};

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
      { role: 'system', content: 'You are a patent analysis expert. Always respond with valid JSON. For relevant_claims, provide only claim numbers, not full text.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 2000,
    temperature: 0.1,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content.trim());
}

async function saveAnalysisResults(projectId, claimId, features, analysisResult) {
  const featureCount = Object.keys(analysisResult).filter(key => 
    key.startsWith('feature_') && analysisResult[key]?.present === true
  ).length;
  
  let rank = null;
  if (featureCount === features.length) rank = 1;
  else if (featureCount >= Math.ceil(features.length * 0.75)) rank = 2;
  else if (featureCount >= Math.ceil(features.length * 0.5)) rank = 3;
  else if (featureCount >= 1) rank = 4;

  const { error } = await supabase.from('analysis_summary').insert([{
    project_id: projectId,
    claim_id: claimId,
    rank,
    feature_count: featureCount,
    total_features: features.length,
    detailed_analysis: analysisResult
  }]);

  if (error) throw error;
  return { rank, featureCount };
}

const failedAnalysis = (featureNames) => {
  const analysis = {};
  featureNames.forEach((feature, index) => {
    analysis[`feature_${index + 1}`] = {
      feature_name: feature,
      present: false,
      confidence: "Low",
      reasoning: "Analysis failed - unable to process claim",
      relevant_claims: "N/A"
    };
  });
  return analysis;
};

// Analyses running in this server process, keyed by project id. A project marked
// 'processing' that isn't in here was interrupted (e.g. by a redeploy).
const activeRuns = new Map();

// Runs after the HTTP response has been sent; progress is read back via /status
async function runAnalysis(projectId, run) {
  try {
    const [features, claims] = await Promise.all([
      fetchAll(() => supabase.from('features').select('*').eq('project_id', projectId).order('order_index', { ascending: true })),
      fetchAll(() => supabase.from('patent_claims').select('id, claim_number, claims_text').eq('project_id', projectId).order('claim_number', { ascending: true }))
    ]);
    const featureNames = features.map(f => f.name);
    const batchSize = 10;

    for (let i = 0; i < claims.length && !run.cancelled; i += batchSize) {
      const batch = claims.slice(i, i + batchSize);

      await Promise.all(batch.map(async (claim) => {
        try {
          const analysis = await analyzeSingleClaim(claim.claims_text, claim.claim_number, featureNames);
          await saveAnalysisResults(projectId, claim.id, featureNames, analysis);
        } catch (error) {
          // Record the failure so the claim still shows up and progress keeps counting
          await supabase.from('analysis_summary').insert([{
            project_id: projectId,
            claim_id: claim.id,
            rank: null,
            feature_count: 0,
            total_features: featureNames.length,
            detailed_analysis: failedAnalysis(featureNames)
          }]);
        }
      }));

      if (i + batchSize < claims.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // A cancelled run goes back to draft; its partial results stay viewable
    await supabase.from('projects').update({ 
      status: run.cancelled ? 'draft' : 'completed',
      updated_at: new Date().toISOString()
    }).eq('id', projectId);
  } catch (error) {
    console.error('Analysis failed for project', projectId, error);
    await supabase.from('projects').update({ status: 'error' }).eq('id', projectId);
  } finally {
    activeRuns.delete(projectId);
  }
}

const countRows = async (table, projectId) => {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('project_id', projectId);
  if (error) throw error;
  return count || 0;
};

const analysisRoutes = {
  analyze: async (req, res) => {
    const { projectId } = req.params;

    if (activeRuns.has(projectId)) {
      return res.status(409).json({ error: 'An analysis is already running for this project' });
    }

    try {
      const [featureCount, claimCount] = await Promise.all([
        countRows('features', projectId),
        countRows('patent_claims', projectId)
      ]);

      if (!featureCount || !claimCount) {
        return res.status(400).json({ error: 'No features or claims found for this project' });
      }

      // Clear results from any earlier run so they are not duplicated
      await supabase.from('analysis_summary').delete().eq('project_id', projectId);
      await supabase.from('projects').update({ status: 'processing' }).eq('id', projectId);

      const run = { cancelled: false };
      activeRuns.set(projectId, run);
      res.status(202).json({ success: true, started: true, total: claimCount });
      runAnalysis(projectId, run);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to start analysis', message: error.message });
    }
  },

  status: async (req, res) => {
    const { projectId } = req.params;

    try {
      const [{ data: project, error }, processed, total] = await Promise.all([
        supabase.from('projects').select('status').eq('id', projectId).single(),
        countRows('analysis_summary', projectId),
        countRows('patent_claims', projectId)
      ]);
      if (error) throw error;

      if (project.status === 'processing' && !activeRuns.has(projectId)) {
        await supabase.from('projects').update({ status: 'draft' }).eq('id', projectId);
        return res.json({ success: true, status: 'interrupted', processed, total });
      }

      const run = activeRuns.get(projectId);
      res.json({ success: true, status: run?.cancelled ? 'cancelling' : project.status, processed, total });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch status', message: error.message });
    }
  },

  cancel: async (req, res) => {
    const { projectId } = req.params;
    const run = activeRuns.get(projectId);

    if (run) {
      // The loop stops after the current batch of claims
      run.cancelled = true;
    } else {
      await supabase.from('projects').update({ status: 'draft' }).eq('id', projectId).eq('status', 'processing');
    }
    res.json({ success: true });
  },

  getResults: async (req, res) => {
    const { projectId } = req.params;

    try {
      const [resultsData, featuresData] = await Promise.all([
        fetchAll(() => supabase.from('analysis_summary').select(`*, patent_claims (claim_number, publication_number)`).eq('project_id', projectId).order('created_at', { ascending: true }).order('claim_id', { ascending: true })),
        supabase.from('features').select('name').eq('project_id', projectId).order('order_index', { ascending: true })
      ]);

      if (featuresData.error) throw new Error('Failed to fetch results');

      const featureNames = featuresData.data?.map(f => f.name) || [];
      const formattedResults = resultsData.map(result => {
        const formatted = {
          claimNumber: result.patent_claims.claim_number,
          publicationNumber: result.patent_claims.publication_number,
          features: featureNames,
          detailed_analysis: result.detailed_analysis,
          rank: result.rank,
          featureCount: result.feature_count
        };

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
      res.status(500).json({ error: 'Failed to fetch results', message: error.message });
    }
  }
};

app.post('/api/projects', authenticateUser, projectRoutes.create);
app.get('/api/projects', authenticateUser, projectRoutes.list);
app.post('/api/projects/:projectId/features', authenticateUser, featureRoutes.save);
app.get('/api/projects/:projectId/features', authenticateUser, featureRoutes.get);
app.post('/api/projects/:projectId/claims', authenticateUser, claimRoutes.save);
app.get('/api/projects/:projectId/claims', authenticateUser, claimRoutes.get);
app.post('/api/projects/:projectId/analyze', authenticateUser, analysisRoutes.analyze);
app.get('/api/projects/:projectId/status', authenticateUser, analysisRoutes.status);
app.post('/api/projects/:projectId/cancel', authenticateUser, analysisRoutes.cancel);
app.get('/api/projects/:projectId/results', authenticateUser, analysisRoutes.getResults);

app.post('/analyze-all-claims', (req, res) => {
  res.status(400).json({
    success: false,
    error: 'Please update to the new authentication system',
    message: 'This endpoint requires user authentication. Please log out and log back in.',
    results: []
  });
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.get('*', (req, res) => {
  const indexPaths = [
    path.join(__dirname, 'public/index.html'),
    path.join(__dirname, '../frontend/build/index.html'),
    path.join(process.cwd(), 'frontend/build/index.html'),
    '/app/frontend/build/index.html'
  ];
  
  const indexPath = indexPaths.find(p => fs.existsSync(p));
  
  if (indexPath) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head><title>FTO Patent Screening - Backend Running</title></head>
        <body>
          <h1>FTO Patent Screening Backend</h1>
          <p>Backend server is running successfully</p>
          <h3>Issue: Frontend build not found</h3>
          <p>The React frontend build files are missing.</p>
          <h3>System Status:</h3>
          <ul>
            <li>OpenAI API: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Missing'}</li>
            <li>Supabase: ${process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configured' : 'Missing'}</li>
            <li>Build Path: ${buildPath ? 'Found at ' + buildPath : 'Not found'}</li>
          </ul>
        </body>
      </html>
    `);
  }
});

app.listen(port, '0.0.0.0', () => {
  // Server started
});