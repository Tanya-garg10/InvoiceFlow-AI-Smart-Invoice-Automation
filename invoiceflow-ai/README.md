# InvoiceFlow AI — Smart Invoice Automation

> **Turn customer requests into accurate invoices — automatically.**

Built for the 180-minute hackathon challenge.

---

## 🌟 Objective

InvoiceFlow AI is an end-to-end AI-powered invoice automation system that converts a customer's unstructured natural-language requirement into a professional, review-ready invoice with strict price integrity.

### Core Workflow:
```
Customer Message ──▶ AI Extraction (Gemini) ──▶ Authoritative Price Lookup (services.csv)
                           │                                  │
                           ▼                                  ▼
                   Entity Separation                  Zero AI Pricing
                           │                                  │
                           └───────────────┬──────────────────┘
                                           ▼
                                   Guardrail Validation
                                   (Missing Price Flag)
                                           │
                                           ▼
                                   Human Review Screen
                               (Editable Qty / Unit Price)
                                           │
                                           ▼
                                   Strict Approval Gate
                                           │
                                           ▼
                                  PDF Invoice Generation
                                       (ReportLab)
```

---

## 🛡️ Core Architecture Principle

| AI Responsibility | Application Responsibility |
| :--- | :--- |
| **Natural Language Understanding**: Parses emails, chats, or transcripts. | **Authoritative Price Lookup**: Queries strictly from `data/services.csv`. |
| **Entity Extraction**: Normalizes service names, extracts quantities, customer names, emails, and notes. | **Deterministic Arithmetic**: Multiplies `Qty × Unit Price`, calculates subtotal, GST (18%), and grand totals. |
| **Unknown Service Detection**: Identifies services not in the catalog. | **Guardrail Enforcement**: Hard blocks invoice approval if missing-price items exist. |
| **Strict JSON Output**: Zero markdown fences, predictable schema. | **Document Rendering**: ReportLab vector PDF generator and audit history. |

> **Critical Guardrail:** The AI is **never** permitted to generate prices, estimate rates, or calculate totals. The CSV catalog is the sole source of financial truth.

---

## 📁 Project Structure

```text
invoiceflow-ai/
├── app.py                  # Main Streamlit web application
├── requirements.txt        # Production dependencies
├── README.md               # Documentation & hackathon guide
├── PROMPT.md               # Gemini prompt specification & JSON schema
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
│
├── data/
│   └── services.csv        # Authoritative service & pricing catalog
│
└── assets/
    └── logo.png            # Application branding logo
```

---

## 🚀 Quickstart & Setup

### 1. Prerequisites
- Python 3.9+ (Python 3.10 recommended)
- Google Gemini API Key

### 2. Installation
```bash
# Clone or navigate to the project directory
cd invoiceflow-ai

# Create and activate virtual environment (optional but recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```
Add your Gemini API Key:
```env
GEMINI_API_KEY="your_gemini_api_key_here"
```

### 4. Run the Streamlit Application
```bash
streamlit run app.py
```
Open your browser at `http://localhost:8501`.

---

## 📋 Authoritative Pricing Catalog (`data/services.csv`)

| Service | Price (INR) | Description |
| :--- | :--- | :--- |
| **Website Development** | ₹25,000 | Responsive business website |
| **UI/UX Design** | ₹12,000 | Web or mobile interface design |
| **AI Chatbot** | ₹18,000 | AI-powered customer support chatbot |
| **Mobile App Development** | ₹35,000 | Cross-platform mobile application |
| **API Integration** | ₹8,000 | Third-party API integration |
| **SEO Optimization** | ₹7,000 | Basic technical and on-page SEO |
| **Cloud Deployment** | ₹6,000 | Application deployment and configuration |
| **Database Setup** | ₹9,000 | Database schema and integration |
| **Maintenance Support** | ₹5,000 | Monthly maintenance and support |

---

## 🧪 Hackathon Demo Test Cases

### Test Case 1: Standard Happy Path (Rahul Sharma)
- **Input:**
  > `"Hi, I am Rahul Sharma. My email is rahul@gmail.com. I need a website and an AI chatbot. Also add 2 API integrations. Please make it ready this month."`
- **Expected AI Extraction:**
  - Customer: `Rahul Sharma`
  - Email: `rahul@gmail.com`
  - Services:
    1. Website Development (Qty: 1)
    2. AI Chatbot (Qty: 1)
    3. API Integration (Qty: 2)
  - Notes: `Please make it ready this month.`
- **Authoritative Calculations:**
  - Website Development: 1 × ₹25,000 = ₹25,000
  - AI Chatbot: 1 × ₹18,000 = ₹18,000
  - API Integration: 2 × ₹8,000 = ₹16,000
  - **Subtotal:** ₹59,000
  - **GST (18%):** ₹10,620
  - **Grand Total:** ₹69,620
- **Validation:** All items matched. Approval gate unlocked. PDF ready for download.

---

### Test Case 2: Unknown Service Guardrail (Judging Feature)
- **Input:**
  > `"Hello, I am Vikram Singhania from Singhania Labs (vikram@singhania.io). We need Mobile App Development and Blockchain Consulting for our launch."`
- **Expected Behavior:**
  - Mobile App Development → Matched (₹35,000)
  - Blockchain Consulting → **⚠️ Price unavailable / Manual review required**
  - **Approval Gate:** Approval is **strictly blocked** with warning:
    `Service 'Blockchain Consulting' does not have a valid price.`
  - **Resolution:** Human reviewer enters unit price manually or updates catalog. Once priced, approval gate immediately unlocks.

---

### Test Case 3: Empty / Incomplete Input Validation
- **Input:** Empty prompt or non-contact message.
- **Expected Behavior:** Friendly validation banner prevents extraction crashes or requires valid customer name before approval.

---

## 📑 Generated PDF Sample Features
- Document Title: `INVOICEFLOW AI`
- Generated Invoice ID: e.g., `INV-20260927-A82F31`
- Customer Bill To details
- Itemized pricing table with quantities, unit prices, and line totals
- Tax breakdown (Subtotal, GST 18%, Grand Total)
- Notes & instructions
- Footer: `"Generated by InvoiceFlow AI • Authoritative Pricing Engine • Financial Verification Guaranteed"`
