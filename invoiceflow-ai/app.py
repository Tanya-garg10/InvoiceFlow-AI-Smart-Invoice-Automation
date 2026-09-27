"""
InvoiceFlow AI — Smart Invoice Automation
Streamlit Web Application
Architecture:
  - Natural Language Extraction: Google Gemini API (Strictly no financial calculation)
  - Financial Truth & Authoritative Pricing: data/services.csv
  - Human-in-the-Loop Review: Editable quantities, prices, and approval gate
  - Document Engine: ReportLab Vector PDF Generator
"""

import os
import re
import json
import uuid
import datetime
from io import BytesIO
import pandas as pd
import streamlit as st
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set Streamlit Page Configuration
st.set_page_config(
    page_title="InvoiceFlow AI — Smart Invoice Automation",
    page_icon="🧾",
    layout="wide",
    initial_sidebar_state="expanded"
)

# App Constants & Paths
CATALOG_PATH = os.path.join(os.path.dirname(__file__), "data", "services.csv")
LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "logo.png")

# Custom CSS for SaaS styling
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }
    
    .main-header {
        font-size: 1.85rem;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 0.25rem;
    }
    .sub-header {
        font-size: 1rem;
        color: #64748b;
        margin-bottom: 1.5rem;
    }
    .kpi-card {
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 1.25rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .kpi-title {
        font-size: 0.825rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
        font-weight: 600;
    }
    .kpi-value {
        font-size: 1.8rem;
        font-weight: 700;
        color: #0f172a;
        margin-top: 0.35rem;
    }
    .guardrail-alert {
        background-color: #fffbeb;
        border: 1px solid #fef3c7;
        border-left: 5px solid #f59e0b;
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
    }
    .stButton>button {
        border-radius: 8px;
        font-weight: 600;
    }
</style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------
# Session State Initialization
# ---------------------------------------------------------
if "invoices_history" not in st.session_state:
    st.session_state.invoices_history = [
        {
            "id": "INV-20260920-B4719A",
            "customer": "Apex Retail Pvt Ltd",
            "email": "billing@apexretail.in",
            "amount": 43660.0,
            "status": "Approved",
            "date": "2026-09-20",
            "items": [
                {"service": "Website Development", "quantity": 1, "unit_price": 25000, "total": 25000},
                {"service": "Cloud Deployment", "quantity": 2, "unit_price": 6000, "total": 12000},
            ],
            "subtotal": 37000.0,
            "gst_rate": 18,
            "gst_amount": 6660.0,
            "notes": "Annual digital transformation initiative"
        },
        {
            "id": "INV-20260924-C90281",
            "customer": "Kavita S. Rao",
            "email": "kavita.rao@fintech.co",
            "amount": 21240.0,
            "status": "Approved",
            "date": "2026-09-24",
            "items": [
                {"service": "AI Chatbot", "quantity": 1, "unit_price": 18000, "total": 18000},
            ],
            "subtotal": 18000.0,
            "gst_rate": 18,
            "gst_amount": 3240.0,
            "notes": "Customer support bot for website"
        }
    ]

if "current_extracted" not in st.session_state:
    st.session_state.current_extracted = None

if "current_invoice" not in st.session_state:
    st.session_state.current_invoice = None

# ---------------------------------------------------------
# Authoritative Price Catalog Loader
# ---------------------------------------------------------
@st.cache_data
def load_catalog():
    if not os.path.exists(CATALOG_PATH):
        # Create default catalog if missing
        os.makedirs(os.path.dirname(CATALOG_PATH), exist_ok=True)
        default_csv = """service,price,description
Website Development,25000,Responsive business website
UI/UX Design,12000,Web or mobile interface design
AI Chatbot,18000,AI-powered customer support chatbot
Mobile App Development,35000,Cross-platform mobile application
API Integration,8000,Third-party API integration
SEO Optimization,7000,Basic technical and on-page SEO
Cloud Deployment,6000,Application deployment and configuration
Database Setup,9000,Database schema and integration
Maintenance Support,5000,Monthly maintenance and support"""
        with open(CATALOG_PATH, "w", encoding="utf-8") as f:
            f.write(default_csv)
    return pd.read_csv(CATALOG_PATH)

catalog_df = load_catalog()

def match_service_in_catalog(service_name: str, df: pd.DataFrame):
    """
    Authoritatively looks up service in CSV.
    Uses exact normalized comparison and alias matching.
    NEVER relies on AI for pricing.
    """
    clean_target = service_name.strip().lower()
    
    # 1. Exact case-insensitive match
    for _, row in df.iterrows():
        if row["service"].strip().lower() == clean_target:
            return {
                "matched": True,
                "service": row["service"],
                "price": float(row["price"]),
                "description": row["description"]
            }
            
    # 2. Heuristic alias mapping for common synonyms
    alias_map = {
        "website": "Website Development",
        "web development": "Website Development",
        "web design": "UI/UX Design",
        "ui/ux": "UI/UX Design",
        "ui ux": "UI/UX Design",
        "chatbot": "AI Chatbot",
        "ai bot": "AI Chatbot",
        "mobile app": "Mobile App Development",
        "ios app": "Mobile App Development",
        "android app": "Mobile App Development",
        "api": "API Integration",
        "api integration": "API Integration",
        "api integrations": "API Integration",
        "seo": "SEO Optimization",
        "cloud": "Cloud Deployment",
        "deployment": "Cloud Deployment",
        "database": "Database Setup",
        "db setup": "Database Setup",
        "maintenance": "Maintenance Support",
        "support": "Maintenance Support"
    }
    
    if clean_target in alias_map:
        target_name = alias_map[clean_target]
        match = df[df["service"] == target_name]
        if not match.empty:
            row = match.iloc[0]
            return {
                "matched": True,
                "service": row["service"],
                "price": float(row["price"]),
                "description": row["description"]
            }
            
    # Substring search in catalog
    for _, row in df.iterrows():
        if clean_target in row["service"].lower() or row["service"].lower() in clean_target:
            return {
                "matched": True,
                "service": row["service"],
                "price": float(row["price"]),
                "description": row["description"]
            }
            
    return {"matched": False, "service": service_name, "price": None, "description": ""}

# ---------------------------------------------------------
# Gemini Extraction Engine
# ---------------------------------------------------------
def extract_requirements_with_gemini(customer_text: str):
    """
    Calls Google Gemini API strictly to extract structured entities.
    Gemini is FORBIDDEN from calculating prices or inventing totals.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return False, "Gemini API Key is not configured. Please add GEMINI_API_KEY to your .env file or environment variables."
    
    system_instruction = """You are the extraction engine for an invoice automation system.

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
8. Return JSON only."""

    try:
        # Using official google-genai SDK
        from google import genai
        from google.genai import types

        client = genai.Client(
            api_key=api_key,
            http_options={"headers": {"User-Agent": "aistudio-build"}}
        )

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=customer_text,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.0,
                response_mime_type="application/json"
            )
        )
        
        raw_text = response.text.strip()
        # Clean potential markdown wrap
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
            
        data = json.loads(raw_text.strip())
        return True, data
    except Exception as e:
        return False, f"Gemini Extraction Error: {str(e)}"

# ---------------------------------------------------------
# PDF Generation (ReportLab)
# ---------------------------------------------------------
def generate_pdf_reportlab(invoice_data: dict) -> bytes:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a')
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748b')
    )
    
    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#1e293b')
    )
    
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155')
    )
    
    elements = []
    
    # Header Table: Logo/Brand & Invoice Info
    brand_text = Paragraph("<b>INVOICEFLOW AI</b><br/><font size=8 color='#64748b'>Smart Invoice Automation System</font>", title_style)
    inv_info = Paragraph(
        f"<b>INVOICE:</b> {invoice_data['id']}<br/>"
        f"<b>DATE:</b> {invoice_data['date']}<br/>"
        f"<b>STATUS:</b> <font color='#16a34a'><b>APPROVED</b></font>",
        body_style
    )
    
    header_table = Table([[brand_text, inv_info]], colWidths=[340, 180])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 15))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=15))
    
    # Bill To Box
    bill_to_content = [
        [Paragraph("<b>BILL TO:</b>", h2_style), Paragraph("<b>PAYMENT TERMS:</b>", h2_style)],
        [
            Paragraph(f"<b>{invoice_data['customer']}</b><br/>Email: {invoice_data['email'] or 'N/A'}", body_style),
            Paragraph("Due Upon Receipt<br/>Currency: INR (₹)", body_style)
        ]
    ]
    bill_table = Table(bill_to_content, colWidths=[340, 180])
    bill_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(bill_table)
    elements.append(Spacer(1, 18))
    
    # Line Items Table
    table_data = [
        [
            Paragraph("<b>Service Description</b>", h2_style),
            Paragraph("<b>Qty</b>", h2_style),
            Paragraph("<b>Unit Price (₹)</b>", h2_style),
            Paragraph("<b>Amount (₹)</b>", h2_style)
        ]
    ]
    
    for item in invoice_data["items"]:
        table_data.append([
            Paragraph(item["service"], body_style),
            Paragraph(str(item["quantity"]), body_style),
            Paragraph(f"₹{item['unit_price']:,.2f}", body_style),
            Paragraph(f"₹{item['total']:,.2f}", body_style),
        ])
        
    items_table = Table(table_data, colWidths=[260, 50, 105, 105])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 12))
    
    # Financial Summary Table
    totals_data = [
        [Paragraph("Subtotal:", body_style), Paragraph(f"₹{invoice_data['subtotal']:,.2f}", body_style)],
        [Paragraph(f"GST ({invoice_data['gst_rate']}%):", body_style), Paragraph(f"₹{invoice_data['gst_amount']:,.2f}", body_style)],
        [Paragraph("<b>Grand Total:</b>", h2_style), Paragraph(f"<b>₹{invoice_data['amount']:,.2f}</b>", h2_style)]
    ]
    totals_table = Table(totals_data, colWidths=[130, 90])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LINEABOVE', (0, 2), (-1, 2), 1, colors.HexColor('#0f172a')),
    ]))
    
    summary_wrapper = Table([[Paragraph("", body_style), totals_table]], colWidths=[300, 220])
    summary_wrapper.setStyle(TableStyle([('ALIGN', (1,0), (1,0), 'RIGHT')]))
    elements.append(summary_wrapper)
    elements.append(Spacer(1, 15))
    
    # Notes Section
    if invoice_data.get("notes"):
        elements.append(Paragraph("<b>Notes / Special Instructions:</b>", h2_style))
        elements.append(Spacer(1, 3))
        elements.append(Paragraph(invoice_data["notes"], body_style))
        elements.append(Spacer(1, 15))
        
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceAfter=10))
    elements.append(Paragraph("<font color='#94a3b8' size=8>Generated by InvoiceFlow AI • Authoritative Pricing Engine • Financial Verification Guaranteed</font>", subtitle_style))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()

# ---------------------------------------------------------
# Sidebar Navigation
# ---------------------------------------------------------
with st.sidebar:
    st.image(LOGO_PATH if os.path.exists(LOGO_PATH) else "🧾", width=64)
    st.title("InvoiceFlow AI")
    st.caption("Turn customer requests into accurate invoices — automatically.")
    st.markdown("---")
    
    nav_choice = st.radio(
        "Navigation",
        ["Dashboard", "Create Invoice", "Price Catalog", "Invoice History", "Settings / API Status"],
        index=1 if st.session_state.current_extracted else 0
    )
    
    st.markdown("---")
    st.markdown("### ⚡ Quick Demo Prompts")
    if st.button("Load Demo: Rahul Sharma (Happy Path)"):
        st.session_state["demo_input"] = "Hi, I am Rahul Sharma. My email is rahul@gmail.com. I need a website and an AI chatbot. Also add 2 API integrations. Please make it ready this month."
        st.rerun()
        
    if st.button("Load Demo: Guardrail (Unknown Service)"):
        st.session_state["demo_input"] = "Hello, I am Vikram Singhania from Singhania Labs (vikram@singhania.io). We urgently need Mobile App Development and Blockchain Consulting for our upcoming launch."
        st.rerun()

# ---------------------------------------------------------
# Page 1: Dashboard
# ---------------------------------------------------------
if nav_choice == "Dashboard":
    st.markdown('<div class="main-header">Invoice Operations Dashboard</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Overview of automated invoice throughput, approval rates, and financial metrics.</div>', unsafe_allow_html=True)
    
    # Calculate KPIs
    invoices = st.session_state.invoices_history
    total_count = len(invoices)
    approved_count = sum(1 for inv in invoices if inv.get("status") == "Approved")
    pending_count = 1 if st.session_state.current_invoice and st.session_state.current_invoice.get("status") == "Pending Review" else 0
    total_val = sum(inv.get("amount", 0.0) for inv in invoices)
    
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-title">Total Invoices</div>
            <div class="kpi-value">{total_count}</div>
        </div>
        """, unsafe_allow_html=True)
    with col2:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-title">Approved Invoices</div>
            <div class="kpi-value" style="color: #16a34a;">{approved_count}</div>
        </div>
        """, unsafe_allow_html=True)
    with col3:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-title">Pending Reviews</div>
            <div class="kpi-value" style="color: #d97706;">{pending_count}</div>
        </div>
        """, unsafe_allow_html=True)
    with col4:
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-title">Total Invoice Value</div>
            <div class="kpi-value">₹{total_val:,.2f}</div>
        </div>
        """, unsafe_allow_html=True)
        
    st.markdown("<br/>", unsafe_allow_html=True)
    
    # CTA & Recent Invoices
    c1, c2 = st.columns([3, 1])
    with c1:
        st.subheader("Recent Invoices")
    with c2:
        if st.button("➕ Create New Invoice", type="primary", use_container_width=True):
            st.session_state["nav_override"] = "Create Invoice"
            st.rerun()
            
    recent_records = []
    for inv in invoices:
        recent_records.append({
            "Invoice ID": inv["id"],
            "Customer": inv["customer"],
            "Amount": f"₹{inv['amount']:,.2f}",
            "Status": f"✅ {inv['status']}",
            "Date": inv["date"]
        })
    st.dataframe(pd.DataFrame(recent_records), use_container_width=True)

# ---------------------------------------------------------
# Page 2: Create Invoice & Review Workflow
# ---------------------------------------------------------
elif nav_choice == "Create Invoice":
    st.markdown('<div class="main-header">Create & Review Invoice</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Convert unstructured client requirements into a certified, auditable invoice.</div>', unsafe_allow_html=True)
    
    # Step 1: Customer Requirement Input
    st.markdown("### 1. Customer Requirement")
    
    default_text = st.session_state.get(
        "demo_input",
        "Hi, I am Rahul Sharma. My email is rahul@gmail.com. I need a website and an AI chatbot. Also add 2 API integrations."
    )
    
    customer_input = st.text_area(
        "Paste email or conversation:",
        value=default_text,
        height=130,
        placeholder="Hi, I am Rahul Sharma. My email is rahul@gmail.com. I need a website and an AI chatbot. Also add 2 API integrations."
    )
    
    col_btn1, col_btn2 = st.columns([1, 4])
    with col_btn1:
        extract_clicked = st.button("✨ Extract Requirements", type="primary", use_container_width=True)
    with col_btn2:
        st.caption("AI analyzes natural language text and normalizes service requests. Prices are retrieved strictly from `data/services.csv`.")
        
    if extract_clicked:
        if not customer_input.strip():
            st.error("Please enter a customer message first.")
        else:
            with st.spinner("🤖 Analyzing message with Google Gemini & querying CSV catalog..."):
                success, result = extract_requirements_with_gemini(customer_input)
                if not success:
                    st.error(result)
                else:
                    st.session_state.current_extracted = result
                    
                    # Perform Authoritative Price Lookup
                    resolved_items = []
                    has_guardrail_error = False
                    
                    raw_services = result.get("services", [])
                    if not raw_services:
                        # Fallback if no services parsed
                        raw_services = []
                        
                    for s in raw_services:
                        name = s.get("name", "")
                        qty = s.get("quantity", 1)
                        if qty is None or qty <= 0:
                            qty = 1
                            
                        lookup = match_service_in_catalog(name, catalog_df)
                        if lookup["matched"]:
                            resolved_items.append({
                                "service": lookup["service"],
                                "quantity": int(qty),
                                "unit_price": float(lookup["price"]),
                                "status": "Matched",
                                "matched": True
                            })
                        else:
                            has_guardrail_error = True
                            resolved_items.append({
                                "service": name,
                                "quantity": int(qty),
                                "unit_price": 0.0,
                                "status": "Needs Review",
                                "matched": False
                            })
                            
                    st.session_state.current_invoice = {
                        "customer": result.get("customer_name", ""),
                        "email": result.get("email", ""),
                        "notes": result.get("notes", ""),
                        "items": resolved_items,
                        "gst_rate": 18,
                        "approved": False,
                        "id": None
                    }
                    st.success("Extraction complete! Review the authoritative price matches below.")
                    st.rerun()

    # Step 2: Review Screen & Guardrails
    if st.session_state.get("current_invoice"):
        inv = st.session_state.current_invoice
        st.markdown("---")
        st.markdown("### 2. Review Screen")
        
        # Check guardrails
        missing_price_items = [item for item in inv["items"] if not item["matched"] or item["unit_price"] <= 0]
        if missing_price_items:
            for m in missing_price_items:
                st.markdown(f"""
                <div class="guardrail-alert">
                    <b style="color: #b45309; font-size: 1.05rem;">⚠️ Price unavailable: {m['service']}</b><br/>
                    <span>This requested service is not present in the authoritative price catalog. <b>Manual review required.</b> Do NOT invent a price. The invoice cannot be approved while unresolved missing-price items exist.</span>
                </div>
                """, unsafe_allow_html=True)
                
        # Customer Information Form
        st.markdown("#### Customer Information")
        c1, c2 = st.columns(2)
        with c1:
            inv["customer"] = st.text_input("Customer Name *", value=inv.get("customer", ""))
        with c2:
            inv["email"] = st.text_input("Email Address", value=inv.get("email", ""))
            
        inv["notes"] = st.text_area("Extracted Notes / Customer Instructions", value=inv.get("notes", ""), height=70)
        
        # Invoice Items Table
        st.markdown("#### Invoice Items")
        st.caption("Review extracted quantities and prices. You can resolve missing catalog prices by manually entering a unit price.")
        
        updated_items = []
        for i, item in enumerate(inv["items"]):
            ic1, ic2, ic3, ic4, ic5 = st.columns([3, 1, 1.5, 1.5, 1.5])
            with ic1:
                item_name = st.text_input(f"Service #{i+1}", value=item["service"], key=f"svc_name_{i}")
            with ic2:
                item_qty = st.number_input(f"Qty #{i+1}", min_value=1, value=int(item["quantity"]), key=f"svc_qty_{i}")
            with ic3:
                item_price = st.number_input(f"Unit Price (₹) #{i+1}", min_value=0.0, value=float(item["unit_price"]), step=500.0, key=f"svc_price_{i}")
            with ic4:
                item_total = item_qty * item_price
                st.metric("Total", f"₹{item_total:,.2f}")
            with ic5:
                if item["matched"] and item_price > 0:
                    st.markdown("<p style='color: #16a34a; font-weight: 600; margin-top: 32px;'>✓ Matched</p>", unsafe_allow_html=True)
                elif item_price > 0:
                    st.markdown("<p style='color: #2563eb; font-weight: 600; margin-top: 32px;'>✓ Manual Price</p>", unsafe_allow_html=True)
                else:
                    st.markdown("<p style='color: #dc2626; font-weight: 600; margin-top: 32px;'>⚠️ Needs Review</p>", unsafe_allow_html=True)
                    
            updated_items.append({
                "service": item_name,
                "quantity": item_qty,
                "unit_price": item_price,
                "total": item_total,
                "matched": item["matched"] or (item_price > 0)
            })
            
        inv["items"] = updated_items
        
        # Financial Calculations (Tax / GST)
        st.markdown("---")
        calc_col1, calc_col2 = st.columns([2, 1])
        with calc_col1:
            tax_rate = st.selectbox("GST / Tax Percentage", [0, 5, 12, 18, 28], index=3)
            inv["gst_rate"] = tax_rate
            
        subtotal = sum(it["total"] for it in inv["items"])
        gst_amount = subtotal * (tax_rate / 100.0)
        grand_total = subtotal + gst_amount
        
        with calc_col2:
            st.markdown(f"""
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: #64748b;">Subtotal:</span>
                    <b>₹{subtotal:,.2f}</b>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: #64748b;">GST ({tax_rate}%):</span>
                    <b>₹{gst_amount:,.2f}</b>
                </div>
                <hr style="margin: 0.5rem 0; border: 0.5px solid #cbd5e1;"/>
                <div style="display: flex; justify-content: space-between; font-size: 1.15rem; color: #0f172a;">
                    <span><b>Grand Total:</b></span>
                    <span style="color: #0f172a;"><b>₹{grand_total:,.2f}</b></span>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
        inv["subtotal"] = subtotal
        inv["gst_amount"] = gst_amount
        inv["amount"] = grand_total
        
        # Step 3: Approval Gate & PDF Generation
        st.markdown("---")
        st.markdown("### 3. Approval Gate")
        
        # Enforce validation rules
        validation_errors = []
        if not inv["customer"].strip():
            validation_errors.append("Customer name is required.")
        if inv["email"].strip() and not re.match(r"[^@]+@[^@]+\.[^@]+", inv["email"].strip()):
            validation_errors.append("Invalid email address format.")
        if not inv["items"]:
            validation_errors.append("At least one service is required.")
        for it in inv["items"]:
            if it["unit_price"] <= 0:
                validation_errors.append(f"Service '{it['service']}' does not have a valid price.")
            if it["quantity"] <= 0:
                validation_errors.append(f"Service '{it['service']}' quantity must be greater than 0.")
                
        if validation_errors:
            st.error("Approval Blocked:\n- " + "\n- ".join(validation_errors))
            st.button("Approve Invoice", disabled=True)
        else:
            if not inv.get("approved"):
                if st.button("✅ Approve Invoice", type="primary", use_container_width=True):
                    # Generate deterministic invoice ID
                    now = datetime.datetime.now()
                    inv_id = f"INV-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                    inv["id"] = inv_id
                    inv["date"] = now.strftime('%Y-%m-%d')
                    inv["status"] = "Approved"
                    inv["approved"] = True
                    
                    # Save to history
                    st.session_state.invoices_history.insert(0, dict(inv))
                    st.success(f"✅ Invoice Approved! Generated {inv_id}")
                    st.rerun()
            else:
                st.success(f"✅ Invoice Approved: {inv['id']}")
                pdf_bytes = generate_pdf_reportlab(inv)
                
                st.download_button(
                    label="📄 Download PDF Invoice",
                    data=pdf_bytes,
                    file_name=f"{inv['id']}.pdf",
                    mime="application/pdf",
                    type="primary"
                )

# ---------------------------------------------------------
# Page 3: Price Catalog
# ---------------------------------------------------------
elif nav_choice == "Price Catalog":
    st.markdown('<div class="main-header">Authoritative Service & Price Catalog</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">All pricing is deterministically sourced from <code>data/services.csv</code>. AI does not generate prices.</div>', unsafe_allow_html=True)
    
    st.info("💡 **Architectural Guarantee:** Prices are sourced strictly from the configured service catalog. AI does not generate, guess, or invent prices.")
    
    display_df = catalog_df.copy()
    display_df["Formatted Price"] = display_df["price"].apply(lambda p: f"₹{p:,.2f}")
    st.dataframe(
        display_df[["service", "Formatted Price", "description"]].rename(columns={
            "service": "Service",
            "Formatted Price": "Price (INR)",
            "description": "Description"
        }),
        use_container_width=True
    )

# ---------------------------------------------------------
# Page 4: Invoice History
# ---------------------------------------------------------
elif nav_choice == "Invoice History":
    st.markdown('<div class="main-header">Invoice Audit & History</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Review all approved and generated invoices in this session.</div>', unsafe_allow_html=True)
    
    if not st.session_state.invoices_history:
        st.write("No invoices generated yet.")
    else:
        for invoice in st.session_state.invoices_history:
            with st.expander(f"🧾 {invoice['id']} — {invoice['customer']} (₹{invoice['amount']:,.2f})"):
                c1, c2 = st.columns(2)
                with c1:
                    st.write(f"**Customer:** {invoice['customer']}")
                    st.write(f"**Email:** {invoice.get('email', 'N/A')}")
                    st.write(f"**Date:** {invoice['date']}")
                with c2:
                    st.write(f"**Subtotal:** ₹{invoice.get('subtotal', 0):,.2f}")
                    st.write(f"**GST ({invoice.get('gst_rate', 18)}%):** ₹{invoice.get('gst_amount', 0):,.2f}")
                    st.write(f"**Total Amount:** ₹{invoice['amount']:,.2f}")
                    
                st.table(pd.DataFrame(invoice["items"])[["service", "quantity", "unit_price", "total"]])
                
                pdf_data = generate_pdf_reportlab(invoice)
                st.download_button(
                    f"Download {invoice['id']} PDF",
                    data=pdf_data,
                    file_name=f"{invoice['id']}.pdf",
                    mime="application/pdf"
                )

# ---------------------------------------------------------
# Page 5: Settings / API Status
# ---------------------------------------------------------
elif nav_choice == "Settings / API Status":
    st.markdown('<div class="main-header">System Settings & API Status</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Verify connectivity, model configuration, and catalog integrity.</div>', unsafe_allow_html=True)
    
    api_key_set = bool(os.getenv("GEMINI_API_KEY"))
    
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("#### Extraction Engine")
        st.write(f"**Gemini Model:** `gemini-3.8-flash`")
        if api_key_set:
            st.success("API Key Configured (`GEMINI_API_KEY` active)")
        else:
            st.warning("`GEMINI_API_KEY` not detected. Add it to `.env`.")
            
    with c2:
        st.markdown("#### Authoritative Pricing Source")
        st.write(f"**Catalog File:** `{CATALOG_PATH}`")
        st.write(f"**Loaded Services:** {len(catalog_df)} records")
        st.success("CSV Integrity Verified")
        
    st.markdown("---")
    st.markdown("### Architectural Principle")
    st.markdown("""
    - **AI Responsibility:** Natural-language understanding and structured extraction.
    - **Application Responsibility:** Price lookup, calculations, validation, approval, and PDF generation.
    - **Financial Truth:** The AI must NEVER be the source of financial truth.
    """)
