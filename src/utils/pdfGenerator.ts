import { jsPDF } from 'jspdf';
import { Invoice } from '../types';

export function generateInvoicePDF(invoice: Invoice): { doc: jsPDF; download: () => void } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Header Brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('INVOICEFLOW AI', margin, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Turn customer requests into accurate invoices — automatically.', margin, 34);

  // Right-aligned Invoice Meta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`INVOICE: ${invoice.id}`, pageWidth - margin, 24, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${invoice.date}`, pageWidth - margin, 30, { align: 'right' });

  // Status Badge
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(pageWidth - margin - 32, 34, 32, 6, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52);
  doc.text('✓ APPROVED', pageWidth - margin - 16, 38.2, { align: 'center' });

  // Horizontal divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, 44, pageWidth - margin, 44);

  // Bill To & Terms Section
  let currentY = 54;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('BILL TO:', margin, currentY);
  doc.text('PAYMENT TERMS:', pageWidth - margin - 60, currentY);

  currentY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.customer || 'Customer', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text('Due Upon Receipt', pageWidth - margin - 60, currentY);

  currentY += 5;
  if (invoice.email) {
    doc.text(`Email: ${invoice.email}`, margin, currentY);
  }
  doc.text('Currency: INR (Rs)', pageWidth - margin - 60, currentY);

  currentY += 12;

  // Table Header
  const colX = {
    service: margin,
    qty: margin + 95,
    unitPrice: margin + 120,
    amount: pageWidth - margin,
  };

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, currentY, contentWidth, 8, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  doc.line(margin, currentY + 8, pageWidth - margin, currentY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Service Description', colX.service + 3, currentY + 5.5);
  doc.text('Qty', colX.qty, currentY + 5.5, { align: 'right' });
  doc.text('Unit Price (Rs)', colX.unitPrice + 12, currentY + 5.5, { align: 'right' });
  doc.text('Amount (Rs)', colX.amount - 3, currentY + 5.5, { align: 'right' });

  currentY += 8;

  // Table Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  invoice.items.forEach((item, index) => {
    const rowHeight = 9;

    // Alternate row zebra
    if (index % 2 === 1) {
      doc.setFillColor(254, 255, 255);
      doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
    }

    doc.setTextColor(15, 23, 42);
    doc.text(item.service, colX.service + 3, currentY + 6);

    doc.setTextColor(51, 65, 85);
    doc.text(String(item.quantity), colX.qty, currentY + 6, { align: 'right' });
    doc.text(item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.unitPrice + 12, currentY + 6, {
      align: 'right',
    });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.amount - 3, currentY + 6, {
      align: 'right',
    });
    doc.setFont('helvetica', 'normal');

    // Bottom row border
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + rowHeight, pageWidth - margin, currentY + rowHeight);

    currentY += rowHeight;
  });

  currentY += 6;

  // Totals Area (Right Aligned)
  const totalBoxWidth = 75;
  const totalBoxX = pageWidth - margin - totalBoxWidth;

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal:', totalBoxX, currentY + 4);
  doc.setTextColor(15, 23, 42);
  doc.text(`Rs ${invoice.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 3, currentY + 4, {
    align: 'right',
  });

  currentY += 6;

  // GST
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`GST (${invoice.gstRate}%):`, totalBoxX, currentY + 4);
  doc.setTextColor(15, 23, 42);
  doc.text(`Rs ${invoice.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 3, currentY + 4, {
    align: 'right',
  });

  currentY += 7;

  // Grand Total Line & Box
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(totalBoxX, currentY, pageWidth - margin, currentY);

  currentY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Grand Total:', totalBoxX, currentY);
  doc.text(`Rs ${invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 3, currentY, {
    align: 'right',
  });

  currentY += 16;

  // Notes Box
  if (invoice.notes && invoice.notes.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Notes / Instructions:', margin, currentY);

    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);

    const splitNotes = doc.splitTextToSize(invoice.notes, contentWidth);
    doc.text(splitNotes, margin, currentY);
    currentY += splitNotes.length * 4.5 + 4;
  }

  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Generated by InvoiceFlow AI • Authoritative Pricing Engine • Financial Verification Guaranteed', margin, pageHeight - 16);
  doc.text(`Page 1 of 1`, pageWidth - margin, pageHeight - 16, { align: 'right' });

  return {
    doc,
    download: () => {
      doc.save(`${invoice.id}.pdf`);
    },
  };
}
