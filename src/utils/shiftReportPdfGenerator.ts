import jsPDF from 'jspdf';
import type { GeneratedSingleShiftReport, BusinessSettings } from '../types';
import { formatDate, formatTime } from './formatters';

interface GenerateShiftPdfOptions {
  report: GeneratedSingleShiftReport;
  settings?: BusinessSettings | null;
}

/**
 * Formats currency safely for standard PDF core fonts (Helvetica) avoiding Unicode symbol corruption
 */
function formatPdfCurrency(amount: number | null | undefined, currency: string = 'NGN'): string {
  if (amount === null || amount === undefined) {
    return '—';
  }
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

export async function generateAndDownloadShiftReportPDF({
  report,
  settings,
}: GenerateShiftPdfOptions): Promise<{ success: boolean; filename: string }> {
  try {
    const businessName = (settings?.worker_pos_name || settings?.business_name || 'MUNAJ BAR').toUpperCase();
    const currency = settings?.currency || 'NGN';
    const isActive = report.isActive;

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

    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - margin - 10) {
        doc.addPage();
        y = margin;
        renderHeaderMinimal();
      }
    };

    const renderHeaderMinimal = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`${businessName} — SHIFT AUDIT REPORT (Continued)`, margin, y);
      doc.text(`${report.workerName} • ${report.dateLabel}`, pageWidth - margin, y, { align: 'right' });
      y += 3;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    };

    // 1. BRAND HERO HEADER
    doc.setFillColor(15, 23, 42); // Dark slate #0f172a
    doc.rect(margin, y, contentWidth, 25, 'F');

    // Accent left stripe (Emerald for closed / Amber for active)
    if (isActive) {
      doc.setFillColor(245, 158, 11); // Amber
    } else {
      doc.setFillColor(34, 197, 94); // Emerald
    }
    doc.rect(margin, y, 4, 25, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(businessName, margin + 8, y + 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(200, 200, 200);
    doc.text('Premium Lounge & Bar Service — Cash & Shift Audit Statement', margin + 8, y + 14.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    if (isActive) {
      doc.setTextColor(251, 191, 36);
      doc.text('ACTIVE / OPEN SHIFT AUDIT STATEMENT', margin + 8, y + 21);
    } else {
      doc.setTextColor(34, 197, 94);
      doc.text('OFFICIAL SHIFT PERFORMANCE & CASH RECONCILIATION', margin + 8, y + 21);
    }

    // Right Header Metadata
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(220, 220, 220);
    doc.text(`Generated: ${formatDate(report.generatedAt.toISOString())}`, pageWidth - margin - 4, y + 8.5, {
      align: 'right',
    });
    doc.text(`Time: ${formatTime(report.generatedAt.toISOString())}`, pageWidth - margin - 4, y + 13.5, {
      align: 'right',
    });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(isActive ? 251 : 34, isActive ? 191 : 197, isActive ? 36 : 94);
    doc.text(`STATUS: ${report.shift.status.toUpperCase()}`, pageWidth - margin - 4, y + 21, {
      align: 'right',
    });

    y += 30;

    // 2. SHIFT & WORKER INFORMATION BOX
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD');

    // Worker Col
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('STAFF / ATTENDANT:', margin + 4, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(report.workerName.toUpperCase(), margin + 4, y + 13);

    // Role Col
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('ROLE / POSITION:', margin + 65, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(report.workerRole, margin + 65, y + 13);

    // Date & Time Col
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('SHIFT SCHEDULE & DURATION:', margin + 115, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${report.dateLabel} (${report.durationLabel})`, margin + 115, y + 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(report.timeLabel, margin + 115, y + 15.5);

    y += 23;

    // Warning Banner if Payment Totals Mismatch
    if (report.paymentMismatch) {
      checkPageBreak(12);
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(margin, y, contentWidth, 9, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(185, 28, 28);
      doc.text('⚠ DATA INTEGRITY NOTICE: Shift payment breakdown does not equal gross total sales. Please review receipts.', margin + 4, y + 5.8);
      y += 12;
    }

    // 3. EXECUTIVE 4-KPI SUMMARY TILES
    const kpiW = (contentWidth - 9) / 4;
    const kpiCards = [
      {
        label: 'OPENING FLOAT',
        value: formatPdfCurrency(report.openingCash, currency),
        highlight: false,
        sub: 'Cash in drawer at start',
      },
      {
        label: 'TOTAL SHIFT SALES',
        value: formatPdfCurrency(report.totalSales, currency),
        highlight: true,
        sub: `${report.totalTransactions} completed sales`,
      },
      {
        label: 'EXPECTED CASH',
        value: formatPdfCurrency(report.expectedCash, currency),
        highlight: false,
        sub: 'Float + Cash Sales',
      },
      {
        label: 'ACTUAL ENDING CASH',
        value: isActive ? 'Not Reconciled' : formatPdfCurrency(report.actualEndingCash, currency),
        highlight: !isActive && report.reconciliationStatus === 'BALANCED',
        sub: isActive ? 'Shift currently active' : `Diff: ${report.discrepancy && report.discrepancy >= 0 ? '+' : ''}${formatPdfCurrency(report.discrepancy, currency)}`,
      },
    ];

    kpiCards.forEach((kpi, idx) => {
      const kx = margin + idx * (kpiW + 3);
      doc.setFillColor(kpi.highlight ? 240 : 248, kpi.highlight ? 253 : 250, kpi.highlight ? 244 : 252);
      doc.setDrawColor(kpi.highlight ? 187 : 226, kpi.highlight ? 247 : 232, kpi.highlight ? 208 : 240);
      doc.roundedRect(kx, y, kpiW, 20, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(kpi.highlight ? 21 : 100, kpi.highlight ? 128 : 116, kpi.highlight ? 61 : 139);
      doc.text(kpi.label, kx + 3, y + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(kpi.highlight ? 22 : 15, kpi.highlight ? 101 : 23, kpi.highlight ? 52 : 42);
      doc.text(kpi.value, kx + 3, y + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(110, 120, 135);
      doc.text(kpi.sub, kx + 3, y + 17);
    });

    y += 25;

    // 4. CASH RECONCILIATION & PAYMENT BREAKDOWN (2-Columns)
    checkPageBreak(52);
    const colW = (contentWidth - 6) / 2;

    // LEFT COL: Cash Drawer Reconciliation
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, colW, 48, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('CASH RECONCILIATION AUDIT', margin + 4, y + 6);

    doc.setDrawColor(241, 245, 249);
    doc.line(margin + 4, y + 8.5, margin + colW - 4, y + 8.5);

    let ry = y + 14;
    const reconLines = [
      { label: 'Opening Float Cash', val: formatPdfCurrency(report.openingCash, currency), bold: false },
      { label: 'Cash Sales Collected', val: `+ ${formatPdfCurrency(report.cashSales, currency)}`, bold: false, green: true },
      { label: 'Expected Drawer Cash', val: formatPdfCurrency(report.expectedCash, currency), bold: true },
      {
        label: 'Actual Ending Physical Cash',
        val: isActive ? 'Pending Closure' : formatPdfCurrency(report.actualEndingCash, currency),
        bold: true,
      },
    ];

    reconLines.forEach((r) => {
      doc.setFont('helvetica', r.bold ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(r.bold ? 15 : 71, r.bold ? 23 : 85, r.bold ? 42 : 105);
      doc.text(r.label, margin + 4, ry);

      doc.setFont('helvetica', 'bold');
      if (r.green) {
        doc.setTextColor(22, 101, 52);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(r.val, margin + colW - 4, ry, { align: 'right' });
      ry += 6.5;
    });

    // Divider for discrepancy
    doc.setDrawColor(203, 213, 225);
    doc.line(margin + 4, ry - 1, margin + colW - 4, ry - 1);
    ry += 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('CASH DISCREPANCY:', margin + 4, ry);

    if (isActive) {
      doc.setTextColor(100, 116, 139);
      doc.text('Pending Shift Closure', margin + colW - 4, ry, { align: 'right' });
    } else if (report.reconciliationStatus === 'SHORTAGE') {
      doc.setTextColor(220, 38, 38);
      doc.text(`${formatPdfCurrency(report.discrepancy, currency)} (SHORTAGE)`, margin + colW - 4, ry, {
        align: 'right',
      });
    } else if (report.reconciliationStatus === 'EXCESS') {
      doc.setTextColor(37, 99, 235);
      doc.text(`+${formatPdfCurrency(report.discrepancy, currency)} (EXCESS)`, margin + colW - 4, ry, {
        align: 'right',
      });
    } else {
      doc.setTextColor(22, 101, 52);
      doc.text(`${formatPdfCurrency(0, currency)} (BALANCED)`, margin + colW - 4, ry, {
        align: 'right',
      });
    }

    // RIGHT COL: Payment Method Channels
    const rightColX = margin + colW + 6;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(rightColX, y, colW, 48, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('PAYMENT CHANNELS BREAKDOWN', rightColX + 4, y + 6);

    doc.setDrawColor(241, 245, 249);
    doc.line(rightColX + 4, y + 8.5, rightColX + colW - 4, y + 8.5);

    let py = y + 14;
    const pms = [
      { label: 'Cash Tendered', val: formatPdfCurrency(report.cashSales, currency) },
      { label: 'POS Terminal (Card)', val: formatPdfCurrency(report.posSales, currency) },
      { label: 'Direct Bank Transfer', val: formatPdfCurrency(report.transferSales, currency) },
    ];

    pms.forEach((pm) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(pm.label, rightColX + 4, py);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(pm.val, rightColX + colW - 4, py, { align: 'right' });
      py += 6.5;
    });

    doc.setDrawColor(203, 213, 225);
    doc.line(rightColX + 4, py - 1, rightColX + colW - 4, py - 1);
    py += 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(22, 101, 52);
    doc.text('TOTAL SHIFT REVENUE', rightColX + 4, py);
    doc.text(formatPdfCurrency(report.totalSales, currency), rightColX + colW - 4, py, { align: 'right' });

    y += 54;

    // 5. SALES DURING THIS SHIFT TABLE
    checkPageBreak(40);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`SALES DURING THIS SHIFT (${report.totalTransactions} Transactions)`, margin, y);
    y += 4;

    // Table Header
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('RECEIPT #', margin + 3, y + 4.5);
    doc.text('TIME', margin + 40, y + 4.5);
    doc.text('PAYMENT METHOD', margin + 85, y + 4.5);
    doc.text('ITEMS', margin + 130, y + 4.5, { align: 'right' });
    doc.text('TOTAL (NGN)', pageWidth - margin - 3, y + 4.5, { align: 'right' });

    y += 7;

    if (report.transactions.length === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('NO SALES RECORDED — This shift has no completed sales transactions.', margin + 4, y + 5.2);
      y += 12;
    } else {
      report.transactions.forEach((sale, idx) => {
        checkPageBreak(7);
        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(margin, y, contentWidth, 6, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(22, 101, 52);
        doc.text(sale.receipt_number || 'MB-SALE', margin + 3, y + 4.2);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(formatTime(sale.created_at), margin + 40, y + 4.2);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text((sale.payment_method || 'CASH').toUpperCase(), margin + 85, y + 4.2);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(String(sale.items?.length || 1), margin + 130, y + 4.2, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(formatPdfCurrency(sale.total, currency), pageWidth - margin - 3, y + 4.2, {
          align: 'right',
        });

        y += 6;
      });

      // Total row for sales
      checkPageBreak(8);
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('TOTAL COMPLETED SALES', margin + 3, y + 4.8);
      doc.text(String(report.totalTransactions), margin + 40, y + 4.8);
      doc.text(formatPdfCurrency(report.totalSales, currency), pageWidth - margin - 3, y + 4.8, {
        align: 'right',
      });
      y += 11;
    }

    // 6. SALE ITEMS BREAKDOWN TABLE
    if (report.itemsSold.length > 0) {
      checkPageBreak(40);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`ITEMS SOLD DETAILS (${report.totalItemsCount} Total Units Dispatched)`, margin, y);
      y += 4;

      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, contentWidth, 7, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text('#', margin + 3, y + 4.5);
      doc.text('PRODUCT / ITEM NAME', margin + 12, y + 4.5);
      doc.text('QTY', margin + 105, y + 4.5, { align: 'right' });
      doc.text('UNIT PRICE', margin + 140, y + 4.5, { align: 'right' });
      doc.text('TOTAL (NGN)', pageWidth - margin - 3, y + 4.5, { align: 'right' });

      y += 7;

      report.itemsSold.forEach((item, idx) => {
        checkPageBreak(6.5);
        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(margin, y, contentWidth, 6, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(String(idx + 1), margin + 3, y + 4.2);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(item.productName, margin + 12, y + 4.2);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`${item.quantity}`, margin + 105, y + 4.2, { align: 'right' });
        doc.text(formatPdfCurrency(item.unitPrice, currency), margin + 140, y + 4.2, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        doc.text(formatPdfCurrency(item.total, currency), pageWidth - margin - 3, y + 4.2, {
          align: 'right',
        });

        y += 6;
      });

      // Total row for items
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('TOTAL UNITS SOLD', margin + 12, y + 4.8);
      doc.text(`${report.totalItemsCount} units`, margin + 105, y + 4.8, { align: 'right' });
      doc.text(formatPdfCurrency(report.totalSales, currency), pageWidth - margin - 3, y + 4.8, {
        align: 'right',
      });
      y += 12;
    }

    // 7. SUMMARY TOTALS HIGHLIGHT CARD
    checkPageBreak(30);

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'F');

    doc.setFillColor(isActive ? 245 : 34, isActive ? 158 : 197, isActive ? 11 : 94);
    doc.rect(margin, y, 4, 22, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('SHIFT TOTALS SUMMARY', margin + 8, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(
      `Transactions: ${report.totalTransactions}  |  Items: ${report.totalItemsCount}  |  Cash: ${formatPdfCurrency(report.cashSales, currency)}  |  POS: ${formatPdfCurrency(report.posSales, currency)}  |  Transfer: ${formatPdfCurrency(report.transferSales, currency)}`,
      margin + 8,
      y + 14
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(isActive ? 251 : 34, isActive ? 191 : 197, isActive ? 36 : 94);
    doc.text(
      `TOTAL: ${formatPdfCurrency(report.totalSales, currency)}`,
      pageWidth - margin - 6,
      y + 14,
      { align: 'right' }
    );

    y += 28;

    // 8. FOOTER WITH ADMIN STAMP & PAGE NUMBERING
    const totalPages = doc.internal.pages.length - 1;
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `${businessName}  •  Shift Report  •  Generated by: Admin  •  ${formatDate(report.generatedAt.toISOString())} at ${formatTime(report.generatedAt.toISOString())}`,
        margin,
        pageHeight - 7
      );
      doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    }

    // Filename generation
    const sanitizedWorker = report.workerName.replace(/[^a-zA-Z0-9_-]/g, '-');
    const shiftDateStr = report.startDate.toISOString().slice(0, 10);
    const startHour = String(report.startDate.getHours()).padStart(2, '0');
    const startMin = String(report.startDate.getMinutes()).padStart(2, '0');
    const sanitizedBiz = businessName.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filename = `${sanitizedBiz}-Shift-Report-${sanitizedWorker}-${shiftDateStr}-${startHour}${startMin}.pdf`;

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
  } catch (err) {
    console.error('Error generating Shift Report PDF:', err);
    throw err;
  }
}
