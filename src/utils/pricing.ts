import { CatalogItem, InvoiceItem } from '../types';

export const DEFAULT_CATALOG: CatalogItem[] = [
  { service: 'Website Development', price: 25000, description: 'Responsive business website' },
  { service: 'UI/UX Design', price: 12000, description: 'Web or mobile interface design' },
  { service: 'AI Chatbot', price: 18000, description: 'AI-powered customer support chatbot' },
  { service: 'Mobile App Development', price: 35000, description: 'Cross-platform mobile application' },
  { service: 'API Integration', price: 8000, description: 'Third-party API integration' },
  { service: 'SEO Optimization', price: 7000, description: 'Basic technical and on-page SEO' },
  { service: 'Cloud Deployment', price: 6000, description: 'Application deployment and configuration' },
  { service: 'Database Setup', price: 9000, description: 'Database schema and integration' },
  { service: 'Maintenance Support', price: 5000, description: 'Monthly maintenance and support' },
];

const ALIAS_MAP: Record<string, string> = {
  website: 'Website Development',
  'web development': 'Website Development',
  'web design': 'UI/UX Design',
  'ui/ux': 'UI/UX Design',
  'ui ux': 'UI/UX Design',
  design: 'UI/UX Design',
  chatbot: 'AI Chatbot',
  'ai bot': 'AI Chatbot',
  'ai chatbot': 'AI Chatbot',
  'mobile app': 'Mobile App Development',
  'ios app': 'Mobile App Development',
  'android app': 'Mobile App Development',
  'app development': 'Mobile App Development',
  api: 'API Integration',
  'api integration': 'API Integration',
  'api integrations': 'API Integration',
  apis: 'API Integration',
  seo: 'SEO Optimization',
  'seo optimization': 'SEO Optimization',
  cloud: 'Cloud Deployment',
  'cloud deployment': 'Cloud Deployment',
  deployment: 'Cloud Deployment',
  database: 'Database Setup',
  'database setup': 'Database Setup',
  'db setup': 'Database Setup',
  maintenance: 'Maintenance Support',
  'maintenance support': 'Maintenance Support',
  support: 'Maintenance Support',
};

export interface MatchResult {
  matched: boolean;
  service: string;
  price: number | null;
  description: string;
}

export function matchServiceInCatalog(serviceName: string, catalog: CatalogItem[]): MatchResult {
  const cleanTarget = serviceName.trim().toLowerCase();

  // 1. Exact case-insensitive match
  for (const item of catalog) {
    if (item.service.toLowerCase() === cleanTarget) {
      return {
        matched: true,
        service: item.service,
        price: item.price,
        description: item.description,
      };
    }
  }

  // 2. Alias mapping
  if (ALIAS_MAP[cleanTarget]) {
    const canonicalName = ALIAS_MAP[cleanTarget];
    const match = catalog.find((c) => c.service === canonicalName);
    if (match) {
      return {
        matched: true,
        service: match.service,
        price: match.price,
        description: match.description,
      };
    }
  }

  // 3. Substring match
  for (const item of catalog) {
    const itemLower = item.service.toLowerCase();
    if (cleanTarget.includes(itemLower) || itemLower.includes(cleanTarget)) {
      return {
        matched: true,
        service: item.service,
        price: item.price,
        description: item.description,
      };
    }
  }

  // Guardrail: Service unknown in authoritative catalog
  return {
    matched: false,
    service: serviceName,
    price: null,
    description: '',
  };
}

export function calculateInvoiceTotals(items: InvoiceItem[], gstRate: number) {
  const subtotal = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const gstAmount = subtotal * (gstRate / 100);
  const grandTotal = subtotal + gstAmount;

  return {
    subtotal,
    gstAmount,
    grandTotal,
  };
}

export function formatINR(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(val);
}
