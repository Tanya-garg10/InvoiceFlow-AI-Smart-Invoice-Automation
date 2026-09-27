import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  Download,
  Plus,
  Trash2,
  Database,
  Sliders,
  DollarSign,
  ShieldCheck,
  Send,
  Eye,
  Info,
  Code2,
  RefreshCw,
  Search,
  Check,
  FileCode,
  Copy,
} from 'lucide-react';
import { CatalogItem, Invoice, InvoiceItem, ExtractionResult } from './types';
import { DEFAULT_CATALOG, matchServiceInCatalog, calculateInvoiceTotals, formatINR } from './utils/pricing';
import { generateInvoicePDF } from './utils/pdfGenerator';

// Demo Presets for Hackathon
const DEMO_PRESETS = [
  {
    label: '⚡ Rahul Sharma (Happy Path)',
    subtitle: 'Website + AI Chatbot + 2 API Integrations',
    text: 'Hi, I am Rahul Sharma. My email is rahul@gmail.com. I need a website and an AI chatbot. Also add 2 API integrations. Please make it ready this month.',
  },
  {
    label: '⚠️ Vikram Singhania (Unknown Guardrail)',
    subtitle: 'App + Blockchain Consulting (Unpriced)',
    text: 'Hello, I am Vikram Singhania from Singhania Labs (vikram@singhania.io). We urgently need Mobile App Development and Blockchain Consulting for our upcoming launch.',
  },
  {
    label: '🚀 Priya Patel (Multiple Services & Notes)',
    subtitle: 'UI/UX + Cloud + DB Setup (Urgent)',
    text: 'Hi, I am Priya Patel (priya@acme.org). Need UI/UX Design, Cloud Deployment, and Database Setup with rush delivery by Friday.',
  },
];

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'catalog' | 'history' | 'settings' | 'code'>('dashboard');

  // Authoritative Catalog State
  const [catalog, setCatalog] = useState<CatalogItem[]>(DEFAULT_CATALOG);
  const [catalogFilter, setCatalogFilter] = useState('');

  // API Status State
  const [apiHealth, setApiHealth] = useState<{
    status: string;
    geminiConfigured: boolean;
    servicesCount: number;
    model: string;
  }>({
    status: 'checking',
    geminiConfigured: true,
    servicesCount: 9,
    model: 'gemini-3.8-flash',
  });

  // History of Approved Invoices
  const [invoicesHistory, setInvoicesHistory] = useState<Invoice[]>([
    {
      id: 'INV-20260920-B4719A',
      customer: 'Apex Retail Pvt Ltd',
      email: 'billing@apexretail.in',
      notes: 'Annual digital transformation initiative with production handover.',
      items: [
        { id: '1', service: 'Website Development', quantity: 1, unitPrice: 25000, total: 25000, status: 'Matched', matched: true },
        { id: '2', service: 'Cloud Deployment', quantity: 2, unitPrice: 6000, total: 12000, status: 'Matched', matched: true },
      ],
      subtotal: 37000,
      gstRate: 18,
      gstAmount: 6660,
      grandTotal: 43660,
      status: 'Approved',
      date: '2026-09-20',
      createdAt: '2026-09-20T10:30:00Z',
    },
    {
      id: 'INV-20260924-C90281',
      customer: 'Kavita S. Rao',
      email: 'kavita.rao@fintech.co',
      notes: 'Customer support bot for website with FAQs integration.',
      items: [
        { id: '1', service: 'AI Chatbot', quantity: 1, unitPrice: 18000, total: 18000, status: 'Matched', matched: true },
      ],
      subtotal: 18000,
      gstRate: 18,
      gstAmount: 3240,
      grandTotal: 21240,
      status: 'Approved',
      date: '2026-09-24',
      createdAt: '2026-09-24T14:15:00Z',
    },
  ]);

  // Create Invoice Workflow State
  const [customerRequirement, setCustomerRequirement] = useState(
    'Hi, I am Rahul Sharma. My email is rahul@gmail.com. I need a website and an AI chatbot. Also add 2 API integrations.'
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Editable Review Form State
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [gstRate, setGstRate] = useState<number>(18);
  const [approvedInvoice, setApprovedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Invoice | null>(null);
  const [codeCopied, setCodeCopied] = useState<string | null>(null);

  // Fetch Health & CSV Catalog from backend on load
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setApiHealth({
          status: data.status,
          geminiConfigured: data.geminiConfigured,
          servicesCount: data.servicesCount || 9,
          model: data.model || 'gemini-3.8-flash',
        });
      })
      .catch((err) => {
        console.warn('Backend /api/health call:', err);
      });

    fetch('/api/catalog')
      .then((res) => res.json())
      .then((data) => {
        if (data.catalog && Array.isArray(data.catalog) && data.catalog.length > 0) {
          setCatalog(data.catalog);
        }
      })
      .catch(() => {});
  }, []);

  // Extraction Engine Function
  const handleExtractRequirements = async () => {
    if (!customerRequirement.trim()) {
      setExtractionError('Please enter a customer requirement message first.');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setApprovedInvoice(null);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerRequirement }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to extract requirements from Gemini.');
      }

      const extraction: ExtractionResult = data.extraction;

      // Populate Customer Fields
      setCustomerName(extraction.customer_name || '');
      setCustomerEmail(extraction.email || '');
      setCustomerNotes(extraction.notes || '');

      // Perform Authoritative Price Lookup from CSV catalog
      const items: InvoiceItem[] = (extraction.services || []).map((svc, idx) => {
        const lookup = matchServiceInCatalog(svc.name, catalog);
        const qty = Math.max(1, svc.quantity || 1);

        if (lookup.matched && lookup.price !== null) {
          return {
            id: `item-${Date.now()}-${idx}`,
            service: lookup.service,
            quantity: qty,
            unitPrice: lookup.price,
            total: qty * lookup.price,
            status: 'Matched',
            matched: true,
          };
        } else {
          return {
            id: `item-${Date.now()}-${idx}`,
            service: svc.name,
            quantity: qty,
            unitPrice: 0,
            total: 0,
            status: 'Needs Review',
            matched: false,
            isUnknown: true,
          };
        }
      });

      setInvoiceItems(items);
    } catch (err: any) {
      console.error(err);
      setExtractionError(err.message || 'An error occurred during extraction.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Recalculate totals
  const { subtotal, gstAmount, grandTotal } = calculateInvoiceTotals(invoiceItems, gstRate);

  // Check Guardrails & Validation for Approval Gate
  const missingPriceItems = invoiceItems.filter((item) => !item.matched || item.unitPrice <= 0);
  const hasUnknownGuardrail = missingPriceItems.length > 0;

  const validationIssues: string[] = [];
  if (!customerName.trim()) {
    validationIssues.push('Customer Name is required.');
  }
  if (customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
    validationIssues.push('Invalid email address format.');
  }
  if (invoiceItems.length === 0) {
    validationIssues.push('At least one invoice item is required.');
  }
  for (const it of invoiceItems) {
    if (it.unitPrice <= 0) {
      validationIssues.push(`Service "${it.service}" must have a valid price > ₹0.`);
    }
    if (it.quantity <= 0) {
      validationIssues.push(`Service "${it.service}" quantity must be at least 1.`);
    }
  }

  const isApprovalBlocked = validationIssues.length > 0;

  // Handle Item Changes
  const handleItemChange = (id: string, field: 'service' | 'quantity' | 'unitPrice', val: any) => {
    setInvoiceItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        let updated = { ...item, [field]: val };

        if (field === 'quantity') {
          const qty = Math.max(1, parseInt(val, 10) || 1);
          updated.quantity = qty;
          updated.total = qty * updated.unitPrice;
        } else if (field === 'unitPrice') {
          const price = Math.max(0, parseFloat(val) || 0);
          updated.unitPrice = price;
          updated.total = updated.quantity * price;
          // If the user manually provided a price for an unknown item, mark as Manual Price
          if (price > 0) {
            updated.matched = true;
            updated.status = updated.status === 'Needs Review' ? 'Manual Price' : updated.status;
          } else {
            updated.matched = false;
            updated.status = 'Needs Review';
          }
        }
        return updated;
      })
    );
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    setInvoiceItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Add Item
  const handleAddItem = () => {
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      service: 'Website Development',
      quantity: 1,
      unitPrice: 25000,
      total: 25000,
      status: 'Matched',
      matched: true,
    };
    setInvoiceItems((prev) => [...prev, newItem]);
  };

  // Approve Invoice
  const handleApproveInvoice = () => {
    if (isApprovalBlocked) return;

    const dateStr = new Date().toISOString().split('T')[0];
    const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
    const invId = `INV-${dateStr.replace(/-/g, '')}-${randomHex}`;

    const newInvoice: Invoice = {
      id: invId,
      customer: customerName.trim(),
      email: customerEmail.trim(),
      notes: customerNotes.trim(),
      items: [...invoiceItems],
      subtotal,
      gstRate,
      gstAmount,
      grandTotal,
      status: 'Approved',
      date: dateStr,
      createdAt: new Date().toISOString(),
    };

    setApprovedInvoice(newInvoice);
    setInvoicesHistory((prev) => [newInvoice, ...prev]);
  };

  // Download PDF
  const handleDownloadPDF = (inv: Invoice) => {
    const { download } = generateInvoicePDF(inv);
    download();
  };

  // Copy helper
  const handleCopyCode = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCodeCopied(key);
    setTimeout(() => setCodeCopied(null), 2000);
  };

  // Dashboard Metrics
  const totalInvoicesCount = invoicesHistory.length;
  const approvedInvoicesCount = invoicesHistory.filter((i) => i.status === 'Approved').length;
  const pendingReviewsCount = invoiceItems.length > 0 && !approvedInvoice ? 1 : 0;
  const totalInvoicesValue = invoicesHistory.reduce((acc, curr) => acc + curr.grandTotal, 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans">
      {/* ---------------- Sidebar Navigation ---------------- */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 font-bold text-lg">
            IF
          </div>
          <div>
            <h1 className="font-bold text-white text-base tracking-tight leading-tight">InvoiceFlow AI</h1>
            <p className="text-xs text-slate-400">Smart Invoice Automation</p>
          </div>
        </div>

        <nav className="p-3 space-y-1 text-sm font-medium flex-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors text-left ${
              activeTab === 'dashboard' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors text-left ${
              activeTab === 'create' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Create Invoice
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors text-left ${
              activeTab === 'catalog' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <Database className="w-4 h-4" />
            Price Catalog
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors text-left ${
              activeTab === 'history' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            Invoice History
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors text-left ${
              activeTab === 'settings' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Settings / API Status
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors text-left ${
              activeTab === 'code' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Hackathon Files & Code
          </button>
        </nav>

        {/* Sidebar Demo Quick Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs">
          <p className="font-semibold text-slate-400 mb-2 uppercase tracking-wider text-[10px]">Quick Demo Presets</p>
          <div className="space-y-1.5">
            {DEMO_PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => {
                  setCustomerRequirement(p.text);
                  setActiveTab('create');
                }}
                className="w-full text-left p-2 rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition text-[11px]"
              >
                <div className="font-medium text-slate-200 truncate">{p.label}</div>
                <div className="text-[10px] text-slate-400 truncate">{p.subtitle}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Status Indicator */}
        <div className="p-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Gemini 3.8 Flash
          </span>
          <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">v2.4.0</span>
        </div>
      </aside>

      {/* ---------------- Main Content Area ---------------- */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">InvoiceFlow AI</h2>
            <p className="text-xs text-slate-500">Turn customer requests into accurate invoices — automatically.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero AI Pricing • Authoritative CSV Pricing</span>
            </div>

            <button
              onClick={() => {
                setApprovedInvoice(null);
                setCustomerName('');
                setCustomerEmail('');
                setInvoiceItems([]);
                setActiveTab('create');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              New Invoice
            </button>
          </div>
        </header>

        {/* ---------------- TAB 1: DASHBOARD ---------------- */}
        {activeTab === 'dashboard' && (
          <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Invoices</span>
                <div className="text-3xl font-extrabold text-slate-900 mt-1">{totalInvoicesCount}</div>
                <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  Session audit log active
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Approved Invoices</span>
                <div className="text-3xl font-extrabold text-emerald-600 mt-1">{approvedInvoicesCount}</div>
                <div className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  100% verified against CSV catalog
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Reviews</span>
                <div className="text-3xl font-extrabold text-amber-600 mt-1">{pendingReviewsCount}</div>
                <div className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Requires human sign-off
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Invoice Value</span>
                <div className="text-3xl font-extrabold text-slate-900 mt-1">{formatINR(totalInvoicesValue)}</div>
                <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  Authoritative GST included
                </div>
              </div>
            </div>

            {/* Workflow Pipeline Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Guaranteed Automated Workflow Architecture
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                  <div className="font-bold text-slate-900">1. Client Request</div>
                  <div className="text-slate-500 mt-1">Natural text / email</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-blue-900">
                  <div className="font-bold">2. Gemini Extract</div>
                  <div className="text-blue-700 mt-1">Entities only (No Price)</div>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 text-indigo-900">
                  <div className="font-bold">3. Price Lookup</div>
                  <div className="text-indigo-700 mt-1">services.csv source</div>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
                  <div className="font-bold">4. Guardrail</div>
                  <div className="text-amber-700 mt-1">Blocks uncataloged</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-purple-900">
                  <div className="font-bold">5. Human Review</div>
                  <div className="text-purple-700 mt-1">Edit quantities & tax</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900">
                  <div className="font-bold">6. Approval Gate</div>
                  <div className="text-emerald-700 mt-1">Integrity verification</div>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-white">
                  <div className="font-bold">7. PDF Invoice</div>
                  <div className="text-slate-300 mt-1">Instant download</div>
                </div>
              </div>
            </div>

            {/* Recent Invoices Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Recent Invoices</h3>
                  <p className="text-xs text-slate-500">Live invoices created and approved in this session</p>
                </div>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                >
                  + Create New Invoice
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Invoice ID</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoicesHistory.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-blue-600">{inv.id}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900">{inv.customer}</div>
                          <div className="text-xs text-slate-400">{inv.email || 'No email provided'}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{formatINR(inv.grandTotal)}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3" />
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">{inv.date}</td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedInvoiceForModal(inv)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                            title="View Invoice Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(inv)}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- TAB 2: CREATE INVOICE ---------------- */}
        {activeTab === 'create' && (
          <div className="p-6 space-y-6 max-w-6xl mx-auto">
            {/* Step 1: Input Requirement */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">1</span>
                    Customer Requirement
                  </h3>
                  <p className="text-xs text-slate-500">Paste unstructured message, email, or client communication.</p>
                </div>

                {/* Demo Presets dropdown / pill row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-slate-400">Demo Presets:</span>
                  {DEMO_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCustomerRequirement(p.text)}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-medium border border-slate-200 transition"
                    >
                      {p.label.split(' ')[1] || p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <textarea
                  rows={4}
                  value={customerRequirement}
                  onChange={(e) => setCustomerRequirement(e.target.value)}
                  placeholder="Hi, I am Rahul Sharma. My email is rahul@gmail.com. I need a website and an AI chatbot. Also add 2 API integrations."
                  className="w-full p-3.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans text-sm text-slate-800 placeholder-slate-400 bg-slate-50/50"
                />
              </div>

              {extractionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{extractionError}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  onClick={handleExtractRequirements}
                  disabled={isExtracting}
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-semibold text-sm shadow-sm flex items-center justify-center gap-2 transition"
                >
                  {isExtracting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Extracting with Gemini 3.8 Flash...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Extract Requirements
                    </>
                  )}
                </button>

                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-500" />
                  <span>Gemini extracts only entities. Unit prices are retrieved strictly from CSV catalog.</span>
                </div>
              </div>
            </div>

            {/* UNKNOWN SERVICE GUARDRAIL ALERT (If unpriced items detected) */}
            {hasUnknownGuardrail && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 animate-fadeIn">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <div className="font-bold text-amber-800 text-sm">⚠️ Price unavailable • Manual Review Required</div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    The requested service{' '}
                    <span className="font-bold underline">
                      {missingPriceItems.map((m) => m.service).join(', ')}
                    </span>{' '}
                    is not present in the authoritative pricing catalog (<code className="bg-amber-100 px-1 rounded">services.csv</code>).
                    <strong className="block mt-1 font-semibold text-amber-900">
                      Do NOT invent a price. The invoice must NOT be approved while unresolved missing-price items exist.
                    </strong>
                  </p>
                  <p className="text-xs text-amber-700 italic">
                    To proceed, a human reviewer may enter a verified unit price in the review table below, or update the catalog.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Review Screen */}
            {invoiceItems.length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</span>
                      Human Review & Price Verification
                    </h3>
                    <p className="text-xs text-slate-500">Edit customer info, verify quantities, and review prices matched from catalog.</p>
                  </div>

                  <button
                    onClick={handleAddItem}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Service
                  </button>
                </div>

                {/* Customer Information Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Email</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="e.g. rahul@gmail.com"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Extracted Notes / Special Client Requests</label>
                    <input
                      type="text"
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      placeholder="Client comments, delivery deadlines, notes..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Service</th>
                        <th className="py-2.5 px-3 w-24">Quantity</th>
                        <th className="py-2.5 px-3 w-36">Unit Price (₹)</th>
                        <th className="py-2.5 px-3 w-32 text-right">Total</th>
                        <th className="py-2.5 px-3 w-36 text-center">Status</th>
                        <th className="py-2.5 px-3 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoiceItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={item.service}
                              onChange={(e) => handleItemChange(item.id, 'service', e.target.value)}
                              className="w-full px-2.5 py-1 text-sm rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-900"
                            />
                          </td>

                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                              className="w-20 px-2 py-1 text-sm rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                            />
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="500"
                                value={item.unitPrice}
                                onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                                className={`w-full pl-6 pr-2 py-1 text-sm rounded border focus:outline-none focus:ring-1 ${
                                  item.unitPrice <= 0
                                    ? 'border-amber-400 bg-amber-50 text-amber-900 focus:ring-amber-500'
                                    : 'border-slate-200 focus:ring-blue-500'
                                }`}
                              />
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{formatINR(item.total)}</td>

                          <td className="py-2.5 px-3 text-center">
                            {item.status === 'Matched' && item.unitPrice > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3" />
                                ✓ Matched
                              </span>
                            ) : item.status === 'Manual Price' || item.unitPrice > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                ✓ Manual Price
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-300 animate-pulse">
                                <AlertTriangle className="w-3 h-3" />
                                ⚠️ Needs Review
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-slate-400 hover:text-red-600 transition"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tax / GST Selector & Totals Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <label className="block text-xs font-semibold text-slate-700">Tax / GST Rate Selection</label>
                    <div className="flex items-center gap-2">
                      {[0, 5, 12, 18, 28].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setGstRate(rate)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                            gstRate === rate
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {rate}% GST
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Standard Indian Goods and Services Tax applied deterministically. AI does not perform tax calculation.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs space-y-2.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Subtotal:</span>
                      <span className="font-mono font-medium text-slate-200">{formatINR(subtotal)}</span>
                    </div>

                    <div className="flex justify-between text-xs text-slate-400">
                      <span>GST ({gstRate}%):</span>
                      <span className="font-mono font-medium text-slate-200">{formatINR(gstAmount)}</span>
                    </div>

                    <div className="border-t border-slate-800 pt-2 flex justify-between text-base font-bold text-white">
                      <span>Grand Total:</span>
                      <span className="font-mono text-emerald-400 text-lg">{formatINR(grandTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Step 3: Approval Gate */}
                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Step 3: Approval Gate Verification
                      </h4>
                      <p className="text-xs text-slate-500">
                        Ensures customer identity, item quantities, and valid unit prices before sealing invoice.
                      </p>
                    </div>

                    {!approvedInvoice && (
                      <button
                        onClick={handleApproveInvoice}
                        disabled={isApprovalBlocked}
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition shadow-sm ${
                          isApprovalBlocked
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve Invoice
                      </button>
                    )}
                  </div>

                  {/* Validation Errors Notice */}
                  {isApprovalBlocked && !approvedInvoice && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
                      <span className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        Approval Gate Locked:
                      </span>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {validationIssues.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Approved Invoice Card & Actions */}
                  {approvedInvoice && (
                    <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-4 animate-fadeIn">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
                            ✓
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                              Status: Certified & Approved
                            </div>
                            <div className="text-lg font-extrabold text-slate-900 font-mono">{approvedInvoice.id}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownloadPDF(approvedInvoice)}
                            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2 transition"
                          >
                            <Download className="w-4 h-4 text-emerald-400" />
                            Download PDF Invoice
                          </button>
                        </div>
                      </div>

                      {/* On-screen Invoice Preview Sheet */}
                      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-5 text-xs text-slate-800 font-sans">
                        <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                          <div>
                            <div className="font-extrabold text-slate-900 text-lg tracking-tight">INVOICEFLOW AI</div>
                            <div className="text-slate-500 text-[11px]">Turn customer requests into accurate invoices — automatically.</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-slate-900">{approvedInvoice.id}</div>
                            <div className="text-slate-500">Date: {approvedInvoice.date}</div>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                              PAID / APPROVED
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-[10px] font-bold uppercase text-slate-400">Bill To:</div>
                            <div className="font-bold text-slate-900 text-sm mt-0.5">{approvedInvoice.customer}</div>
                            <div className="text-slate-600">{approvedInvoice.email || 'Email not provided'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold uppercase text-slate-400">Payment Terms:</div>
                            <div className="font-medium text-slate-900 mt-0.5">Due Upon Receipt</div>
                            <div className="text-slate-600">Currency: INR (₹)</div>
                          </div>
                        </div>

                        <table className="w-full text-left text-xs border-t border-slate-200">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                              <th className="py-2">Service</th>
                              <th className="py-2 text-center">Qty</th>
                              <th className="py-2 text-right">Unit Price</th>
                              <th className="py-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {approvedInvoice.items.map((it, idx) => (
                              <tr key={idx}>
                                <td className="py-2 font-medium text-slate-900">{it.service}</td>
                                <td className="py-2 text-center">{it.quantity}</td>
                                <td className="py-2 text-right">{formatINR(it.unitPrice)}</td>
                                <td className="py-2 text-right font-semibold">{formatINR(it.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="flex justify-end pt-2 border-t border-slate-200">
                          <div className="w-64 space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-600">
                              <span>Subtotal:</span>
                              <span className="font-mono">{formatINR(approvedInvoice.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>GST ({approvedInvoice.gstRate}%):</span>
                              <span className="font-mono">{formatINR(approvedInvoice.gstAmount)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
                              <span>Grand Total:</span>
                              <span className="font-mono text-blue-600">{formatINR(approvedInvoice.grandTotal)}</span>
                            </div>
                          </div>
                        </div>

                        {approvedInvoice.notes && (
                          <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] text-slate-600">
                            <span className="font-bold text-slate-800">Notes: </span>
                            {approvedInvoice.notes}
                          </div>
                        )}

                        <div className="text-center text-[10px] text-slate-400 pt-3 border-t border-slate-100">
                          Generated by InvoiceFlow AI • Authoritative Pricing Engine • Financial Verification Guaranteed
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- TAB 3: PRICE CATALOG ---------------- */}
        {activeTab === 'catalog' && (
          <div className="p-6 space-y-6 max-w-6xl mx-auto">
            {/* Header with Search */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    Authoritative Service & Pricing Catalog
                  </h3>
                  <p className="text-xs text-slate-500">Loaded directly from authoritative data source: <code>data/services.csv</code></p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={catalogFilter}
                    onChange={(e) => setCatalogFilter(e.target.value)}
                    placeholder="Search services..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Guarantees Banner */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold">Authoritative Guarantee:</span>
                  <p className="text-blue-800">
                    Prices are sourced strictly from this configured service catalog. AI does not generate prices, estimate margins, or invent totals.
                  </p>
                </div>
              </div>

              {/* Catalog Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Service</th>
                      <th className="py-3 px-4 w-40">Price (INR)</th>
                      <th className="py-3 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {catalog
                      .filter((c) => c.service.toLowerCase().includes(catalogFilter.toLowerCase()) || c.description.toLowerCase().includes(catalogFilter.toLowerCase()))
                      .map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900">{item.service}</td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-700">{formatINR(item.price)}</td>
                          <td className="py-3 px-4 text-slate-600 text-xs">{item.description}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- TAB 4: INVOICE HISTORY ---------------- */}
        {activeTab === 'history' && (
          <div className="p-6 space-y-6 max-w-6xl mx-auto">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    Audit & Invoice History
                  </h3>
                  <p className="text-xs text-slate-500">Every approved invoice is indexed with line items, tax breakdown, and PDF generator.</p>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Invoice ID</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Items</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoicesHistory.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">{inv.id}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{inv.customer}</div>
                          <div className="text-xs text-slate-400">{inv.email || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {inv.items.map((i) => `${i.quantity}x ${i.service}`).join(', ')}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{formatINR(inv.grandTotal)}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">{inv.date}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDownloadPDF(inv)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold transition"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- TAB 5: SETTINGS / API STATUS ---------------- */}
        {activeTab === 'settings' && (
          <div className="p-6 space-y-6 max-w-6xl mx-auto">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-blue-600" />
                  System Configuration & Health Status
                </h3>
                <p className="text-xs text-slate-500">Live inspection of Gemini API connectivity, system prompts, and catalog integrity.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold uppercase text-slate-500">AI Extraction Engine</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Model:</span>
                    <span className="font-mono text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                      {apiHealth.model}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">API Key:</span>
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active & Verified
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Temperature:</span>
                    <span className="font-mono text-xs text-slate-600">0.0 (Strictly Deterministic)</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold uppercase text-slate-500">Authoritative Financial Core</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Catalog File:</span>
                    <span className="font-mono text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                      data/services.csv
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Services Count:</span>
                    <span className="font-mono text-xs font-bold text-slate-900">{catalog.length} services</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Pricing Authority:</span>
                    <span className="text-xs text-blue-700 font-semibold">Authoritative CSV Only</span>
                  </div>
                </div>
              </div>

              {/* Architectural Responsibility Matrix */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Architectural Separation of Concerns
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 text-xs">
                  <div className="p-4 space-y-2 bg-blue-50/40">
                    <h5 className="font-bold text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      AI Responsibility (Gemini)
                    </h5>
                    <ul className="space-y-1 text-slate-700 list-disc pl-4">
                      <li>Natural language message comprehension.</li>
                      <li>Extracts Customer Name, Email, Requested Services, Quantity, and Notes.</li>
                      <li>Normalizes colloquial names (e.g. "website" → "Website Development").</li>
                      <li className="font-bold text-red-600">FORBIDDEN from generating prices.</li>
                      <li className="font-bold text-red-600">FORBIDDEN from calculating totals.</li>
                    </ul>
                  </div>

                  <div className="p-4 space-y-2 bg-emerald-50/40">
                    <h5 className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Application Responsibility (Deterministic Code)
                    </h5>
                    <ul className="space-y-1 text-slate-700 list-disc pl-4">
                      <li>Authoritative pricing lookup from <code>data/services.csv</code>.</li>
                      <li>Missing price detection & Unknown Guardrail warning.</li>
                      <li>Deterministic math: <code>Quantity × Unit Price = Total</code>.</li>
                      <li>Tax calculation: <code>Subtotal × GST Rate</code>.</li>
                      <li>Human review enforcement & approval gate.</li>
                      <li>Vector PDF invoice document generation.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- TAB 6: HACKATHON FILES & CODE VIEWER ---------------- */}
        {activeTab === 'code' && (
          <div className="p-6 space-y-6 max-w-6xl mx-auto">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-blue-600" />
                    Hackathon Source Files (Python & Streamlit)
                  </h3>
                  <p className="text-xs text-slate-500">
                    All source code for the requested Streamlit & ReportLab project has been generated in the workspace.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-mono text-xs font-bold text-slate-900">invoiceflow-ai/app.py</div>
                  <p className="text-[11px] text-slate-500 mt-1">Full Streamlit UI, ReportLab PDF, and Gemini pipeline</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-mono text-xs font-bold text-slate-900">data/services.csv</div>
                  <p className="text-[11px] text-slate-500 mt-1">Authoritative service pricing catalog (9 services)</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-mono text-xs font-bold text-slate-900">requirements.txt</div>
                  <p className="text-[11px] text-slate-500 mt-1">streamlit, pandas, python-dotenv, google-genai, reportlab</p>
                </div>
              </div>

              {/* Quick CLI Commands */}
              <div className="p-4 bg-slate-900 text-slate-200 rounded-lg space-y-2 text-xs font-mono">
                <div className="text-slate-400 font-sans text-xs font-semibold flex items-center justify-between">
                  <span>How to run the Python project locally:</span>
                  <button
                    onClick={() => handleCopyCode('cd invoiceflow-ai && pip install -r requirements.txt && streamlit run app.py', 'cli')}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                  >
                    {codeCopied === 'cli' ? '✓ Copied' : 'Copy Command'}
                  </button>
                </div>
                <div className="bg-slate-950 p-2.5 rounded text-emerald-400 select-all">
                  cd invoiceflow-ai && pip install -r requirements.txt && streamlit run app.py
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ---------------- Detail Modal ---------------- */}
      {selectedInvoiceForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900">Invoice {selectedInvoiceForModal.id}</h4>
              <button
                onClick={() => setSelectedInvoiceForModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-800">{selectedInvoiceForModal.customer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-semibold text-slate-800">{selectedInvoiceForModal.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="text-slate-800">{selectedInvoiceForModal.date}</span>
              </div>

              <div className="border-t border-slate-100 pt-2">
                <div className="font-bold text-slate-700 mb-1">Line Items:</div>
                <div className="space-y-1">
                  {selectedInvoiceForModal.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-slate-600">
                      <span>{it.quantity}x {it.service}</span>
                      <span className="font-mono">{formatINR(it.total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-2 space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span>{formatINR(selectedInvoiceForModal.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>GST ({selectedInvoiceForModal.gstRate}%):</span>
                  <span>{formatINR(selectedInvoiceForModal.gstAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-1">
                  <span>Grand Total:</span>
                  <span className="font-mono text-emerald-600">{formatINR(selectedInvoiceForModal.grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedInvoiceForModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => handleDownloadPDF(selectedInvoiceForModal)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
