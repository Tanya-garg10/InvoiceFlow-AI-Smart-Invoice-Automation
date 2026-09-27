export interface CatalogItem {
  service: string;
  price: number;
  description: string;
}

export interface ExtractedService {
  name: string;
  quantity: number;
}

export interface ExtractionResult {
  customer_name: string;
  email: string;
  services: ExtractedService[];
  notes: string;
}

export interface InvoiceItem {
  id: string;
  service: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: 'Matched' | 'Needs Review' | 'Manual Price';
  matched: boolean;
  isUnknown?: boolean;
}

export interface Invoice {
  id: string;
  customer: string;
  email: string;
  notes: string;
  items: InvoiceItem[];
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  grandTotal: number;
  status: 'Pending Review' | 'Approved';
  date: string;
  createdAt: string;
}
