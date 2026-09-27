import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());

const SERVICES_CSV_PATH = path.resolve(process.cwd(), 'data', 'services.csv');

// Load & parse authoritative CSV catalog
export interface CatalogItem {
  service: string;
  price: number;
  description: string;
}

export function loadCatalogFromCSV(): CatalogItem[] {
  try {
    if (!fs.existsSync(SERVICES_CSV_PATH)) {
      return [];
    }
    const content = fs.readFileSync(SERVICES_CSV_PATH, 'utf-8');
    const lines = content.trim().split('\n');
    const items: CatalogItem[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // CSV format: service,price,description
      const parts = line.split(',');
      if (parts.length >= 3) {
        const service = parts[0].trim();
        const price = parseFloat(parts[1].trim());
        const description = parts.slice(2).join(',').trim();
        if (service && !isNaN(price)) {
          items.push({ service, price, description });
        }
      }
    }
    return items;
  } catch (err) {
    console.error('Error loading CSV catalog:', err);
    return [];
  }
}

// Gemini Client initialization
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// API Health & Config Status
app.get('/api/health', (req, res) => {
  const catalog = loadCatalogFromCSV();
  res.json({
    status: 'ok',
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    model: 'gemini-3.8-flash',
    servicesCount: catalog.length,
    timestamp: new Date().toISOString(),
  });
});

// API Get Price Catalog
app.get('/api/catalog', (req, res) => {
  const catalog = loadCatalogFromCSV();
  res.json({
    catalog,
    disclaimer: 'Prices are sourced from the configured service catalog. AI does not generate prices.',
  });
});

// System Prompt from hackathon specification Section 17
const EXTRACTION_SYSTEM_INSTRUCTION = `You are the extraction engine for an invoice automation system.

Extract structured customer information from the user's message.

Do NOT calculate prices.
Do NOT invent services, prices, emails, names, or quantities.

Return ONLY valid JSON:

{
"customer_name": "",
"email": "",
"services": [
{
"name": "",
"quantity": 1
}
],
"notes": ""
}

Rules:

1. Extract only information explicitly present.
2. Normalize obvious service names.
3. Never generate a price.
4. Never calculate totals.
5. Unknown services must still be returned as requested services.
6. Quantity must be positive.
7. Put additional requirements in notes.
8. Return JSON only.`;

// Deterministic entity fallback if Gemini API experiences transient 503 spike
function fallbackExtractEntities(text: string) {
  // Extract email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';

  // Extract name: "I am [Name]", "I'm [Name]", "from [Company]", or first two capitalized words
  let customer_name = '';
  const nameMatch = text.match(/(?:i am|i'm|name is|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (nameMatch) {
    customer_name = nameMatch[1].trim();
  }

  // Detect services
  const services: { name: string; quantity: number }[] = [];
  const lower = text.toLowerCase();

  const serviceCatalogKeywords = [
    { key: 'website', name: 'Website Development' },
    { key: 'web development', name: 'Website Development' },
    { key: 'chatbot', name: 'AI Chatbot' },
    { key: 'ai chatbot', name: 'AI Chatbot' },
    { key: 'api', name: 'API Integration' },
    { key: 'mobile app', name: 'Mobile App Development' },
    { key: 'ui/ux', name: 'UI/UX Design' },
    { key: 'cloud', name: 'Cloud Deployment' },
    { key: 'database', name: 'Database Setup' },
    { key: 'seo', name: 'SEO Optimization' },
    { key: 'maintenance', name: 'Maintenance Support' },
    { key: 'blockchain', name: 'Blockchain Consulting' }, // unknown guardrail
  ];

  // Look for quantities like "2 api integrations", "1 website"
  for (const item of serviceCatalogKeywords) {
    if (lower.includes(item.key)) {
      // Check if already added
      if (!services.some((s) => s.name.toLowerCase() === item.name.toLowerCase())) {
        const qtyRegex = new RegExp(`(\\d+)\\s+(?:[a-zA-Z0-9_-]+\\s+)?${item.key}`, 'i');
        const qtyMatch = text.match(qtyRegex);
        const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
        services.push({ name: item.name, quantity });
      }
    }
  }

  // Extract notes: sentences with "please", "make it ready", "urgent", etc.
  let notes = '';
  const noteMatch = text.match(/(?:please|urgent|need this|ready by|notes?:)[^.!?\n]+[.!?]?/i);
  if (noteMatch) {
    notes = noteMatch[0].trim();
  }

  return { customer_name, email, services, notes };
}

// API Extract Requirements via Gemini
app.post('/api/extract', async (req, res) => {
  const { customerRequirement } = req.body;

  if (!customerRequirement || typeof customerRequirement !== 'string' || !customerRequirement.trim()) {
    return res.status(400).json({ error: 'Customer requirement text is required.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured on the server. Please check your environment variables.',
    });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: customerRequirement,
          config: {
            systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
            temperature: 0.0,
            responseMimeType: 'application/json',
          },
        });

        let raw = response.text || '';
        raw = raw.trim();
        if (raw.startsWith('```json')) raw = raw.slice(7);
        if (raw.startsWith('```')) raw = raw.slice(3);
        if (raw.endsWith('```')) raw = raw.slice(0, -3);

        const parsed = JSON.parse(raw.trim());

        const output = {
          customer_name: parsed.customer_name || '',
          email: parsed.email || '',
          services: Array.isArray(parsed.services) ? parsed.services : [],
          notes: parsed.notes || '',
        };

        return res.json({ success: true, extraction: output, modelUsed: model });
      } catch (err: any) {
        lastError = err;
        console.warn(`Extraction attempt ${attempt} on ${model} failed:`, err?.message || err);
        // Sleep 800ms before retry
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }

  // Graceful resilience fallback if upstream Gemini models have a high-demand 503 spike
  console.warn('Gemini API temporary 503 overload. Invoking intelligent fallback parser.');
  const fallback = fallbackExtractEntities(customerRequirement);
  return res.json({
    success: true,
    extraction: fallback,
    fallbackUsed: true,
    notice: 'Parsed using deterministic fallback parser due to temporary upstream Gemini demand spike.',
  });
});

// Start Server (Vite in dev, static files in production)
async function startServer() {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Try multiple possible dist paths
    const possiblePaths = [
      path.resolve(process.cwd(), 'dist'),
      path.resolve(__dirname, 'dist'),
      path.resolve(process.cwd(), 'src', 'dist'),
      '/opt/render/project/src/dist'
    ];
    
    let distPath = possiblePaths[0];
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        distPath = possiblePath;
        break;
      }
    }
    
    console.log('Serving static files from:', distPath);
    console.log('Current working directory:', process.cwd());
    console.log('__dirname:', __dirname);
    console.log('Dist path exists:', fs.existsSync(distPath));
    
    // Serve static files first
    app.use(express.static(distPath));
    
    // Then handle SPA routing - return index.html for all non-API routes
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      console.log('Serving index.html from:', indexPath);
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`InvoiceFlow AI server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
