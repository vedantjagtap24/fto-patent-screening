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
app.use(express.json({ limit: '50mb' }));

app.post('/analyze-claim', async (req, res) => {
  try {
    const { claim, claimNumber } = req.body;
    
    const prompt = `Conduct a comprehensive analysis of the following patent claim to evaluate its relevance and alignment with our product features.

ANALYSIS REQUIREMENTS:
1. For each feature, provide:
   - Boolean determination (true/false)
   - Confidence level (High/Medium/Low)
   - Detailed reasoning explaining the determination
   - Specific claim numbers where features are found (if any)
   - Assessment of specification support

KEY FEATURES TO DETECT:
1. robotic_assisted: Instruments specifically designed for use with robotic surgery or robotic surgical systems
2. biomimicry: Instruments that mimic the human hand or have extended range of motion beyond natural human capability
3. tremor_reduction: Software or mechanical filtration of small, involuntary movements, control algorithms, sensors, actuators for tremor reduction
4. minimally_invasive: Instruments supporting minimally invasive procedures with enhanced dexterity, precision, smaller incisions

PATENT CLAIM:
${claim}

RESPONSE FORMAT (JSON only):
{
  "robotic_assisted": {
    "present": true/false,
    "confidence": "High/Medium/Low",
    "reasoning": "Detailed explanation of why this determination was made",
    "claims_found": ["claim numbers where this feature appears"],
    "specification_assessment": "Assessment of how well the specification supports this feature"
  },
  "biomimicry": {
    "present": true/false,
    "confidence": "High/Medium/Low", 
    "reasoning": "Detailed explanation of why this determination was made",
    "claims_found": ["claim numbers where this feature appears"],
    "specification_assessment": "Assessment of how well the specification supports this feature"
  },
  "tremor_reduction": {
    "present": true/false,
    "confidence": "High/Medium/Low",
    "reasoning": "Detailed explanation of why this determination was made", 
    "claims_found": ["claim numbers where this feature appears"],
    "specification_assessment": "Assessment of how well the specification supports this feature"
  },
  "minimally_invasive": {
    "present": true/false,
    "confidence": "High/Medium/Low",
    "reasoning": "Detailed explanation of why this determination was made",
    "claims_found": ["claim numbers where this feature appears"], 
    "specification_assessment": "Assessment of how well the specification supports this feature"
  }
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: 'You are a patent analysis expert specializing in surgical robotics. Conduct comprehensive feature mapping and assessment. Respond only with valid JSON containing detailed analysis for each feature.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.1
    });

    const content = response.choices[0].message.content.trim();
    const analysis = JSON.parse(content);
    
    const response_data = {
      claimNumber,
      robotic_assisted: analysis.robotic_assisted.present,
      biomimicry: analysis.biomimicry.present,
      tremor_reduction: analysis.tremor_reduction.present,
      minimally_invasive: analysis.minimally_invasive.present,
      detailed_analysis: analysis
    };
    
    res.json(response_data);
  } catch (error) {
    console.error('Error analyzing claim:', error);
    res.status(500).json({
      claimNumber: req.body.claimNumber,
      robotic_assisted: false,
      biomimicry: false,
      tremor_reduction: false,
      minimally_invasive: false,
      detailed_analysis: {
        robotic_assisted: {
          present: false,
          confidence: "Low",
          reasoning: "Analysis failed - unable to process claim",
          claims_found: [],
          specification_assessment: "Unable to assess due to processing error"
        },
        biomimicry: {
          present: false,
          confidence: "Low", 
          reasoning: "Analysis failed - unable to process claim",
          claims_found: [],
          specification_assessment: "Unable to assess due to processing error"
        },
        tremor_reduction: {
          present: false,
          confidence: "Low",
          reasoning: "Analysis failed - unable to process claim",
          claims_found: [],
          specification_assessment: "Unable to assess due to processing error"
        },
        minimally_invasive: {
          present: false,
          confidence: "Low",
          reasoning: "Analysis failed - unable to process claim",
          claims_found: [],
          specification_assessment: "Unable to assess due to processing error"
        }
      }
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'Backend is running!' });
});

app.listen(port, () => {
  console.log(`Enhanced backend server running at http://localhost:${port}`);
});