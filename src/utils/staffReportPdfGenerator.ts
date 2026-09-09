import jsPDF from 'jspdf';
import type { GeneratedStaffReport, BusinessSettings } from '../types';
import { formatDate, formatTime } from './formatters';

interface GeneratePdfReportOptions {
  report: GeneratedStaffReport;
  settings?: BusinessSettings | null;
}

/**
 * Formats currency safely for standard PDF core fonts (Helvetica) avoiding Unicode glyph issues
 */
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

export async function generateAndDownloadStaffReportPDF({
  report,
  settings,
}: GeneratePdfReportOptions): Promise<{ success: boolean; filename: string }> {
  try {
    const businessName = (settings?.worker_pos_name || settings?.business_name || 'MUNAJ BAR').toUpperCase();
    const currency = settings?.currency || 'NGN';
    const isIndividual = report.reportType === 'individual';
    const workerName = report.targetWorker?.full_name || 'All Workers';

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

    // Helper for adding new page with header
    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - margin - 10) {
        doc.addPage();
        y = margin;
        renderHeaderMinimal();
      }
    };

    const renderHeaderMinimal = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`${businessName} — STAFF PERFORMANCE REPORT (Continued)`, margin, y);
      doc.text(report.periodLabel, pageWidth - margin, y, { align: 'right' });
      y += 3;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    };

    // 1. MAIN REPORT HEADER
    // Brand Top Bar
    doc.setFillColor(15, 23, 42); // Dark luxury slate #0f172a
    doc.rect(margin, y, contentWidth, 24, 'F');

    // Emerald accent stripe on left
    doc.setFillColor(34, 197, 94); // #22c55e
    doc.rect(margin, y, 4, 24, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(businessName, margin + 8, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(200, 200, 200);
    doc.text('Premium Lounge & Bar Service — Management Control System', margin + 8, y + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(34, 197, 94);
    doc.text(
      isIndividual
        ? report.period === 'this_year'
          ? 'ANNUAL STAFF PERFORMANCE REPORT'
          : 'STAFF PERFORMANCE REPORT'
        : 'ALL STAFF PERFORMANCE REPORT',
      margin + 8,
      y + 20
    );

    // Right-aligned report date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(220, 220, 220);
    doc.text(`Generated: ${formatDate(report.generatedAt.toISOString())}`, pageWidth - margin - 4, y + 8, {
      align: 'right',
    });
    doc.text(`Time: ${formatTime(report.generatedAt.toISOString())}`, pageWidth - margin - 4, y + 13, {
      align: 'right',
    });

    y += 29;

    // 2. METADATA CARDS
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    if (isIndividual) {
      doc.text('WORKER / ATTENDANT:', margin + 4, y + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(workerName.toUpperCase(), margin + 4, y + 12);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('ROLE / POSITION:', margin + 65, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text((report.targetWorker?.role || 'Staff').toUpperCase(), margin + 65, y + 12);
    } else {
      doc.text('REPORT SCOPE:', margin + 4, y + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`ALL STAFF MEMBERS (${report.workerBreakdown.length} Workers)`, margin + 4, y + 12);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('REPORTING PERIOD:', margin + 120, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(report.periodLabel, margin + 120, y + 12);

    y += 21;

    // 3. EXECUTIVE SUMMARY 4-KPI TILES
    const kpiWidth = (contentWidth - 9) / 4;
    const kpis = isIndividual
      ? [
          { label: 'TOTAL REVENUE', value: formatPdfCurrency(report.totalRevenue, currency), highlight: true },
          { label: 'TOTAL TRANSACTIONS', value: String(report.totalTransactions), highlight: false },
          { label: 'TOTAL ITEMS SOLD', value: String(report.totalItemsSold), highlight: false },
          { label: 'AVERAGE TICKET', value: formatPdfCurrency(report.averageTicket, currency), highlight: false },
        ]
      : [
          { label: 'TOTAL STAFF', value: `${report.workerBreakdown.length} Members`, highlight: false },
          { label: 'TOTAL REVENUE', value: formatPdfCurrency(report.totalRevenue, currency), highlight: true },
          { label: 'TOTAL TRANSACTIONS', value: String(report.totalTransactions), highlight: false },
          { label: 'AVERAGE TICKET', value: formatPdfCurrency(report.averageTicket, currency), highlight: false },
        ];

    kpis.forEach((kpi, idx) => {
      const kpiX = margin + idx * (kpiWidth + 3);
      doc.setFillColor(kpi.highlight ? 240 : 248, kpi.highlight ? 253 : 250, kpi.highlight ? 244 : 252);
      doc.setDrawColor(kpi.highlight ? 187 : 226, kpi.highlight ? 247 : 232, kpi.highlight ? 208 : 240);
      doc.roundedRect(kpiX, y, kpiWidth, 18, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(kpi.highlight ? 21 : 100, kpi.highlight ? 128 : 116, kpi.highlight ? 61 : 139);
      doc.text(kpi.label, kpiX + 3, y + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(kpi.highlight ? 22 : 15, kpi.highlight ? 101 : 23, kpi.highlight ? 52 : 42);
      doc.text(kpi.value, kpiX + 3, y + 13);
    });

    y += 24;

    // 4. PAYMENT BREAKDOWN & SALES PERFORMANCE (2-Column Grid)
    checkPageBreak(45);

    const colWidth = (contentWidth - 6) / 2;

    // Left Column: Payment Breakdown
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, colWidth, 42, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(isIndividual ? 'PAYMENT BREAKDOWN' : 'ALL STAFF PAYMENT BREAKDOWN', margin + 4, y + 6);

    doc.setDrawColor(241, 245, 249);
    doc.line(margin + 4, y + 8.5, margin + colWidth - 4, y + 8.5);

    let py = y + 14;
    const paymentRows = [
      { label: 'Cash Sales', amount: report.paymentBreakdown.cash },
      { label: 'POS Sales', amount: report.paymentBreakdown.pos },
      { label: 'Transfer Sales', amount: report.paymentBreakdown.transfer },
    ];

    paymentRows.forEach((p) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(p.label, margin + 4, py);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(formatPdfCurrency(p.amount, currency), margin + colWidth - 4, py, { align: 'right' });
      py += 6.5;
    });

    // Total line
    doc.setDrawColor(203, 213, 225);
    doc.line(margin + 4, py - 1, margin + colWidth - 4, py - 1);
    py += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(22, 101, 52);
    doc.text('TOTAL REVENUE', margin + 4, py);
    doc.text(formatPdfCurrency(report.paymentBreakdown.total, currency), margin + colWidth - 4, py, {
      align: 'right',
    });

    // Right Column: Sales Performance Metrics
    const rightColX = margin + colWidth + 6;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(rightColX, y, colWidth, 42, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('SALES PERFORMANCE METRICS', rightColX + 4, y + 6);

    doc.setDrawColor(241, 245, 249);
    doc.line(rightColX + 4, y + 8.5, rightColX + colWidth - 4, y + 8.5);

    let sy = y + 14;
    const metricsRows = [
      { label: 'Completed Transactions', val: String(report.totalTransactions) },
      { label: 'Total Items Sold', val: String(report.totalItemsSold) },
      { label: 'Gross Revenue', val: formatPdfCurrency(report.totalGrossRevenue, currency) },
      { label: 'Discounts Given', val: `-${formatPdfCurrency(report.totalDiscounts, currency)}` },
    ];

    metricsRows.forEach((m) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(m.label, rightColX + 4, sy);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(m.val, rightColX + colWidth - 4, sy, { align: 'right' });
      sy += 6;
    });

    y += 48;

    // 5. ALL WORKERS BREAKDOWN TABLE (If All Workers report)
    if (!isIndividual && report.workerBreakdown.length > 0) {
      checkPageBreak(50);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('STAFF PERFORMANCE BREAKDOWN', margin, y);
      y += 4;

      // Table Header
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);

      doc.text('#', margin + 3, y + 4.5);
      doc.text('STAFF NAME', margin + 12, y + 4.5);
      doc.text('ROLE', margin + 65, y + 4.5);
      doc.text('ORDERS', margin + 105, y + 4.5, { align: 'right' });
      doc.text('ITEMS SOLD', margin + 135, y + 4.5, { align: 'right' });
      doc.text('REVENUE (NGN)', pageWidth - margin - 3, y + 4.5, { align: 'right' });

      y += 7;

      report.workerBreakdown.forEach((wb, idx) => {
        checkPageBreak(8);
        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(margin, y, contentWidth, 6.5, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(String(wb.rank), margin + 3, y + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(wb.worker.full_name, margin + 12, y + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text((wb.worker.role || 'Staff').toUpperCase(), margin + 65, y + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(String(wb.ordersCount), margin + 105, y + 4.5, { align: 'right' });
        doc.text(String(wb.itemsSoldCount), margin + 135, y + 4.5, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        doc.text(formatPdfCurrency(wb.netRevenue, currency), pageWidth - margin - 3, y + 4.5, {
          align: 'right',
        });

        y += 6.5;
      });

      // Total Row
      checkPageBreak(8);
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('GRAND TOTAL', margin + 12, y + 4.8);
      doc.text(String(report.totalTransactions), margin + 105, y + 4.8, { align: 'right' });
      doc.text(String(report.totalItemsSold), margin + 135, y + 4.8, { align: 'right' });
      doc.text(formatPdfCurrency(report.totalRevenue, currency), pageWidth - margin - 3, y + 4.8, {
        align: 'right',
      });
      y += 11;
    }

    // 6. TOP PRODUCTS SOLD TABLE
    if (report.topProducts.length > 0) {
      checkPageBreak(40);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(
        isIndividual ? `TOP PRODUCTS SOLD BY ${workerName.toUpperCase()}` : 'TOP PRODUCTS SOLD ACROSS ALL STAFF',
        margin,
        y
      );
      y += 4;

      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);

      doc.text('#', margin + 3, y + 4.5);
      doc.text('PRODUCT NAME', margin + 14, y + 4.5);
      doc.text('QUANTITY SOLD', margin + 125, y + 4.5, { align: 'right' });
      doc.text('TOTAL REVENUE (NGN)', pageWidth - margin - 3, y + 4.5, { align: 'right' });

      y += 7;

      report.topProducts.slice(0, 10).forEach((tp, idx) => {
        checkPageBreak(7);
        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(margin, y, contentWidth, 6, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(String(tp.rank), margin + 3, y + 4.2);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(tp.productName, margin + 14, y + 4.2);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`${tp.quantity} units`, margin + 125, y + 4.2, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        doc.text(formatPdfCurrency(tp.revenue, currency), pageWidth - margin - 3, y + 4.2, {
          align: 'right',
        });

        y += 6;
      });

      y += 6;
    }

    // 7. DAILY / PERIODIC BREAKDOWN
    if (report.dailyBreakdown.length > 1) {
      checkPageBreak(40);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('DAILY PERFORMANCE SUMMARY', margin, y);
      y += 4;

      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);

      doc.text('DATE', margin + 3, y + 4.5);
      doc.text('ORDERS COMPLETED', margin + 85, y + 4.5, { align: 'right' });
      doc.text('ITEMS SOLD', margin + 130, y + 4.5, { align: 'right' });
      doc.text('REVENUE (NGN)', pageWidth - margin - 3, y + 4.5, { align: 'right' });

      y += 7;

      report.dailyBreakdown.forEach((db, idx) => {
        checkPageBreak(7);
        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(margin, y, contentWidth, 6, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(db.dateLabel, margin + 3, y + 4.2);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(String(db.ordersCount), margin + 85, y + 4.2, { align: 'right' });
        doc.text(String(db.itemsSoldCount), margin + 130, y + 4.2, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        doc.text(formatPdfCurrency(db.revenue, currency), pageWidth - margin - 3, y + 4.2, {
          align: 'right',
        });

        y += 6;
      });

      // Total row
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('TOTAL', margin + 3, y + 4.8);
      doc.text(String(report.totalTransactions), margin + 85, y + 4.8, { align: 'right' });
      doc.text(String(report.totalItemsSold), margin + 130, y + 4.8, { align: 'right' });
      doc.text(formatPdfCurrency(report.totalRevenue, currency), pageWidth - margin - 3, y + 4.8, {
        align: 'right',
      });

      y += 12;
    }

    // 8. SHIFT PERFORMANCE & RECONCILIATION
    checkPageBreak(45);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(isIndividual ? 'SHIFT PERFORMANCE & RECONCILIATION' : 'ALL STAFF SHIFT RECONCILIATION', margin, y);
    y += 4;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 30, 2, 2, 'FD');

    const shiftColW = contentWidth / 5;
    const shiftKpis = [
      { label: 'TOTAL SHIFTS', value: String(report.shiftReconciliation.totalShifts) },
      { label: 'OPENING FLOATS', value: formatPdfCurrency(report.shiftReconciliation.totalOpeningFloats, currency) },
      { label: 'EXPECTED CASH', value: formatPdfCurrency(report.shiftReconciliation.totalExpectedCash, currency) },
      { label: 'ACTUAL ENDING', value: formatPdfCurrency(report.shiftReconciliation.totalActualCash, currency) },
      {
        label: 'CASH DIFFERENCE',
        value: `${report.shiftReconciliation.totalDifference >= 0 ? '+' : ''}${formatPdfCurrency(report.shiftReconciliation.totalDifference, currency)}`,
        status: report.shiftReconciliation.status,
      },
    ];

    shiftKpis.forEach((sk, idx) => {
      const sx = margin + idx * shiftColW;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text(sk.label, sx + 3, y + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      if (sk.status === 'SHORTAGE') {
        doc.setTextColor(220, 38, 38);
      } else if (sk.status === 'EXCESS') {
        doc.setTextColor(37, 99, 235);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(sk.value, sx + 3, y + 14);

      if (sk.status) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`[${sk.status}]`, sx + 3, y + 21);
      }
    });

    y += 35;

    // Worker Cash Differences list for All Workers
    if (!isIndividual && report.workerBreakdown.length > 0) {
      checkPageBreak(35);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('WORKER CASH DIFFERENCES SUMMARY:', margin, y);
      y += 4;

      report.workerBreakdown.forEach((wb) => {
        checkPageBreak(6);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(`•  ${wb.worker.full_name} (${wb.shiftsCount} shifts):`, margin + 3, y);

        const diffStr = `${wb.cashDifference >= 0 ? '+' : ''}${formatPdfCurrency(wb.cashDifference, currency)}`;
        if (wb.reconciliationStatus === 'SHORTAGE') {
          doc.setTextColor(220, 38, 38);
        } else if (wb.reconciliationStatus === 'EXCESS') {
          doc.setTextColor(37, 99, 235);
        } else {
          doc.setTextColor(22, 101, 52);
        }
        doc.text(`${diffStr}  [${wb.reconciliationStatus}]`, margin + 80, y);
        y += 5;
      });
      y += 4;
    }

    // 9. GRAND TOTAL HIGHLIGHT (for All Workers)
    if (!isIndividual) {
      checkPageBreak(35);

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'F');

      doc.setFillColor(34, 197, 94);
      doc.rect(margin, y, 4, 26, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text('GRAND BUSINESS TOTAL SUMMARY', margin + 8, y + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      doc.text(
        `Staff: ${report.workerBreakdown.length}  |  Shifts: ${report.shiftReconciliation.totalShifts}  |  Orders: ${report.totalTransactions}  |  Items: ${report.totalItemsSold}`,
        margin + 8,
        y + 14
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(34, 197, 94);
      doc.text(
        `TOTAL REVENUE: ${formatPdfCurrency(report.totalRevenue, currency)}`,
        pageWidth - margin - 6,
        y + 16,
        { align: 'right' }
      );

      y += 32;
    }

    // Page Numbering Footer on all pages
    const totalPages = doc.internal.pages.length - 1;
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `${businessName} Admin Control System  •  ${businessName} Official Management Report  •  Page ${p} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    }

    // Generate clean sanitized filename
    const periodTag =
      report.period === 'custom'
        ? `${report.startDate.toISOString().slice(0, 10)}_to_${report.endDate.toISOString().slice(0, 10)}`
        : report.period.replace(/_/g, '-');

    const sanitizedWorker = isIndividual
      ? (report.targetWorker?.full_name || 'Worker').replace(/[^a-zA-Z0-9_-]/g, '-')
      : 'All-Staff';

    const sanitizedBiz = businessName.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filename = `${sanitizedBiz}-${sanitizedWorker}-Report-${periodTag}.pdf`;

    // Multiplatform save handling (iOS, Android, Chrome/Safari/Edge)
    const isIOS =
      typeof navigator !== 'undefined' &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    if (isIOS) {
      try {
        const pdfBlob = doc.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 1000);
      } catch {
        doc.save(filename);
      }
    } else {
      doc.save(filename);
    }

    return { success: true, filename };
  } catch (error) {
    console.error('Error generating Staff Report PDF:', error);
    throw error;
  }
}
