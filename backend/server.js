import 'dotenv/config';
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';
import os from 'os';

const app = express();

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Trust proxy for Render's forwarded headers
app.set('trust proxy', 1);

app.use(cors())

// Request size limit and parsing
app.use(express.json({ 
  limit: '1mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch(e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));

const port = process.env.PORT || 3000;
const platform = os.platform();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const chat = model.startChat({
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 4096,
  },
});

const chatHistory = new Map();

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY missing in environment!');
  process.exit(1);
}

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/api/generate', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { prompt } = req.body;
    
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt required' });
    }

    const systemInstruction = `You are an expert AI assistant specializing in web development and programming. Operating System: ${platform}

Key Principles:
1. Provide clear, structured responses
2. Break down complex problems into manageable steps
3. Include code examples when relevant
4. Explain technical concepts in an accessible way
5. Focus on modern best practices and standards
6. Always consider security, performance, and accessibility

When providing code:
- Use modern syntax and patterns
- Include helpful comments
- Follow industry best practices
- Consider cross-browser compatibility
- Implement error handling
- Focus on clean, maintainable code

For web development:
- Recommend responsive design patterns
- Suggest semantic HTML structure
- Promote accessibility best practices
- Consider performance optimization
- Include security considerations

Current request: ${prompt}

Please provide a detailed, well-structured response that addresses all aspects of the request.`;

    const result = await model.generateContent([
      { text: systemInstruction },
      { text: prompt }
    ]);

    const response = await result.response;
    const text = response.text();

    return res.json({ 
      text: text
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
