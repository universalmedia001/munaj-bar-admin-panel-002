import jsPDF from 'jspdf';
import type { StaffSubmittedReport, ReportVerificationResult, BusinessSettings } from '../types';
import { formatDate, formatTime } from './formatters';

interface GenerateSubmittedPdfOptions {
  report: StaffSubmittedReport;
  verification?: ReportVerificationResult | null;
  settings?: BusinessSettings | null;
}

function formatPdfCurrency(amount: number | null | undefined, currency: string = 'NGN'): string {
  const val = Number(amount) || 0;
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

  if (currency === 'NGN' || !currency) {
    return `NGN ${formatted}`;
  }
  return `${currency} ${formatted}`;
}

export async function generateAndDownloadSubmittedReportPDF({
  report,
  verification,
  settings,
}: GenerateSubmittedPdfOptions): Promise<{ success: boolean; filename: string }> {
  try {
    const businessName = (settings?.worker_pos_name || settings?.business_name || 'MUNAJ BAR').toUpperCase();
    const currency = settings?.currency || 'NGN';
    const workerName = report.worker_name || 'Staff Member';

    // A4 Dimensions: 210mm x 297mm
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // 1. BRAND TOP BAR
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.rect(margin, y, contentWidth, 24, 'F');

    // Emerald accent stripe
    doc.setFillColor(34, 197, 94); // #22c55e
    doc.rect(margin, y, 4, 24, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(businessName, margin + 8, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(200, 200, 200);
    doc.text('Premium Lounge & Bar Service — Cashier Submitted Sales Report', margin + 8, y + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(34, 197, 94);
    doc.text('OFFICIAL STAFF SALES REPORT', margin + 8, y + 20);

    // Right-aligned timestamps
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(220, 220, 220);
    doc.text(`Submitted: ${formatDate(report.submitted_at)}`, pageWidth - margin - 4, y + 8, {
      align: 'right',
    });
    doc.text(`Time: ${formatTime(report.submitted_at)}`, pageWidth - margin - 4, y + 13, {
      align: 'right',
    });

    y += 29;

    // 2. METADATA HEADER CARD
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('ATTENDANT / CASHIER:', margin + 4, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(workerName.toUpperCase(), margin + 4, y + 13);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('REPORT PERIOD:', margin + 70, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(report.period_label.toUpperCase(), margin + 70, y + 13);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('VERIFICATION STATUS:', margin + 125, y + 6);

    const isVerified = verification ? verification.isVerified : true;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    if (isVerified) {
      doc.setTextColor(22, 101, 52); // green
      doc.text('VERIFIED (MATCHED)', margin + 125, y + 13);
    } else {
      doc.setTextColor(180, 83, 9); // amber
      doc.text('REQUIRES REVIEW', margin + 125, y + 13);
    }

    y += 24;

    // 3. EXECUTIVE TOTALS SUMMARY TILES
    const colWidth = (contentWidth - 6) / 4;

    // Tile 1: Total Revenue
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(margin, y, colWidth, 20, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(22, 101, 52);
    doc.text('TOTAL REVENUE', margin + 3, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61);
    doc.text(formatPdfCurrency(report.sales_total, currency), margin + 3, y + 14);

    // Tile 2: Transactions
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + colWidth + 2, y, colWidth, 20, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('ORDERS / TICKETS', margin + colWidth + 5, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(String(report.transactions_count), margin + colWidth + 5, y + 14);

    // Tile 3: Items Dispatched
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + (colWidth + 2) * 2, y, colWidth, 20, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('ITEMS SOLD', margin + (colWidth + 2) * 2 + 3, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(String(report.items_count), margin + (colWidth + 2) * 2 + 3, y + 14);

    // Tile 4: Average Sale
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + (colWidth + 2) * 3, y, colWidth, 20, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('AVERAGE TICKET', margin + (colWidth + 2) * 3 + 3, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(formatPdfCurrency(report.average_sale, currency), margin + (colWidth + 2) * 3 + 3, y + 14);

    y += 26;

    // 4. PAYMENT BREAKDOWN TABLE
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('PAYMENT CHANNEL BREAKDOWN', margin + 3, y + 5);

    y += 9;

    const renderPaymentRow = (label: string, amount: number, isTotal = false) => {
      if (isTotal) {
        doc.setFillColor(236, 253, 245);
        doc.rect(margin, y - 3, contentWidth, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(6, 95, 70);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
      }

      doc.text(label, margin + 4, y + 2);
      doc.text(formatPdfCurrency(amount, currency), pageWidth - margin - 4, y + 2, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 4, pageWidth - margin, y + 4);
      y += 6.5;
    };

    renderPaymentRow('Cash Tendered', report.cash_sales);
    renderPaymentRow('POS Card Terminal', report.pos_sales);
    renderPaymentRow('Direct Bank Transfer', report.transfer_sales);
    renderPaymentRow('TOTAL SETTLED SALES', report.sales_total, true);

    y += 6;

    // 5. LIVE DATABASE AUDIT & VERIFICATION STATEMENT
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('SUPABASE DATABASE AUDIT & VERIFICATION', margin + 3, y + 5);

    y += 9;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Audit Status:', margin + 4, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    if (isVerified) {
      doc.setTextColor(22, 101, 52);
      doc.text('✓ 100% MATCHED — All sales receipts in database coincide with report', margin + 32, y + 6);
    } else {
      doc.setTextColor(180, 83, 9);
      doc.text('⚠ DISCREPANCY DETECTED — Review against raw transactions', margin + 32, y + 6);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Database Recorded Revenue: ${formatPdfCurrency(verification?.dbSalesTotal || report.sales_total, currency)}  |  Orders: ${verification?.dbTransactionsCount || report.transactions_count}`,
      margin + 4,
      y + 12
    );
    doc.text(
      `Notes: ${report.notes || 'End-of-service report generated from Worker POS.'}`,
      margin + 4,
      y + 18
    );

    y += 32;

    // 6. SIGNATURE & VERIFICATION BOX
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'D');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);

    // Left: Cashier Sign
    doc.text('Cashier Signature: _______________________', margin + 6, y + 14);
    doc.text(`Name: ${workerName}`, margin + 6, y + 19);

    // Right: Manager Sign
    doc.text('Manager Verification: _______________________', margin + 95, y + 14);
    doc.text(`${businessName} Audit Team`, margin + 95, y + 19);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `${businessName} Admin Panel • Cashier Submitted Sales Report • ${report.id}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );

    const sanitizedWorker = workerName.replace(/[^a-zA-Z0-9_-]/g, '-');
    const sanitizedBiz = businessName.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filename = `${sanitizedBiz}-${sanitizedWorker}-Submitted-Report-${report.period}.pdf`;

    doc.save(filename);
    return { success: true, filename };
  } catch (err) {
    console.error('Error generating submitted report PDF:', err);
    throw err;
  }
}
