import { jsPDF } from 'jspdf';
import { CompletedSaleResult, SaleWithItems } from '../types';
import { formatDate, formatTime, getSaleSeller } from './formatters';

export interface ReceiptPDFOptions {
  isReprint?: boolean;
  workerNameFallback?: string;
  printedBy?: string;
  brandName?: string;
  brandColor?: string;
  primaryColor?: string;
  logoUrl?: string | null;
}

/**
 * Loads an image from URL or DataURL and prepares it for jsPDF embedding
 */
export async function loadReceiptLogo(url: string | null | undefined): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  
  // If already a Data URL, create image to get dimensions
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 100;
          canvas.height = img.naturalHeight || img.height || 100;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          resolve({
            dataUrl,
            width: canvas.width,
            height: canvas.height,
          });
        } catch {
          // If tainted canvas due to CORS or any issue, if already data URL we can use directly
          if (url.startsWith('data:image')) {
            resolve({
              dataUrl: url,
              width: img.naturalWidth || 100,
              height: img.naturalHeight || 100,
            });
          } else {
            resolve(null);
          }
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Formats amount into clean Nigerian Naira representation for POS receipts
 */
const formatPdfNaira = (amount: number | string | undefined | null): string => {
  const num = Number(amount) || 0;
  return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

/**
 * Generates a clean 80mm thermal-style PDF receipt for Worker POS
 */
export function generateReceiptPDF(
  sale: CompletedSaleResult | SaleWithItems,
  options: ReceiptPDFOptions = {},
  logoImage?: { dataUrl: string; width: number; height: number } | null
): jsPDF {
  const { isReprint = false, brandName = 'MUNAJ BAR' } = options;

  const receiptNumber = sale.receipt_number || 'MB-000000';
  const createdAt = sale.created_at || new Date().toISOString();
  const dateStr = formatDate(createdAt);
  const timeStr = formatTime(createdAt);
  const paymentMethod = (sale.payment_method || 'CASH').toUpperCase();
  const subtotal = Number(sale.subtotal || 0);
  const discount = Number(sale.discount || 0);
  const total = Number(sale.total || 0);

  // Sold By is the worker recorded on the sale, never the person viewing or printing it.
  const seller = getSaleSeller(sale);
  const sellerName = seller.name;
  const sellerRole = seller.role;
  const sellerDisplay = sellerRole && sellerRole !== 'Staff' ? `${sellerName} (${sellerRole})` : sellerName;
  const printedBy = options.printedBy?.trim();

  // Normalized items
  const rawItems = sale.items || [];
  const items = rawItems.map((item: any) => ({
    name: item.product_name || item.product?.name || item.name || 'Item',
    quantity: item.quantity || 1,
    unitPrice: Number(item.unit_price || item.product?.selling_price || item.price || 0),
    total: Number(item.total || (Number(item.unit_price || 0) * (item.quantity || 1))),
  }));

  // Extra height for logo if present
  const logoExtraHeight = logoImage ? 16 : 0;
  const printedByExtraHeight = printedBy ? 6 : 0;

  // Calculate dynamic page height to fit all items cleanly on 80mm width paper
  const estimatedHeight = Math.max(
    135,
    65 + logoExtraHeight + printedByExtraHeight + items.length * 8 + (discount > 0 ? 10 : 0) + (isReprint ? 12 : 0) + 40
  );

  // Initialize jsPDF in 80mm roll format
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, estimatedHeight],
  });

  const pageWidth = 80;
  const margin = 4;
  const contentWidth = pageWidth - margin * 2; // 72mm

  let y = 6;

  // Helper for drawing centered text
  const drawCenteredText = (text: string, fontSize: number, isBold: boolean = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.text(text, pageWidth / 2, y, { align: 'center' });
    y += fontSize * 0.45 + 1.2;
  };

  // If Logo Image is provided, render it at top of receipt
  if (logoImage && logoImage.dataUrl) {
    try {
      const maxW = 24;
      const maxH = 14;
      let imgW = maxW;
      let imgH = (logoImage.height / logoImage.width) * maxW;
      if (imgH > maxH) {
        imgH = maxH;
        imgW = (logoImage.width / logoImage.height) * maxH;
      }
      const imgX = (pageWidth - imgW) / 2;
      doc.addImage(logoImage.dataUrl, 'PNG', imgX, y, imgW, imgH);
      y += imgH + 2;
    } catch (imgErr) {
      console.warn('PDF logo render notice:', imgErr);
    }
  }

  // Helper for drawing horizontal dashed line
  const drawDashedLine = () => {
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0); // reset
    y += 3.5;
  };

  // Helper for two-column key-value text
  const drawRow = (
    label: string,
    value: string,
    fontSize: number = 9,
    isBold: boolean = false,
    valueColor: [number, number, number] = [0, 0, 0]
  ) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(80, 80, 80);
    doc.text(label, margin, y);
    doc.setTextColor(...valueColor);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += fontSize * 0.45 + 1.2;
  };

  // 1. BRAND HEADER (DYNAMIC WORKER POS NAME)
  drawCenteredText(brandName.toUpperCase(), 13, true);
  drawCenteredText('Premium Lounge & Bar Service', 7.5, false);
  y += 1;
  drawCenteredText('RECEIPT', 9.5, true);
  y += 1.5;

  // 2. METADATA SECTION
  drawDashedLine();
  drawRow('Receipt No:', receiptNumber, 8.5, true);
  drawRow('Date:', dateStr, 8);
  drawRow('Time:', timeStr, 8);
  drawRow('Sold By:', sellerDisplay, 8.5, true);
  if (printedBy) {
    drawRow('Printed By:', printedBy, 7.5, false, [100, 100, 100]);
  }
  y += 1;

  // 3. ITEMS TABLE
  drawDashedLine();

  // Column Headers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text('ITEM', margin, y);
  doc.text('QTY', margin + 35, y, { align: 'center' });
  doc.text('PRICE', margin + 50, y, { align: 'right' });
  doc.text('TOTAL', pageWidth - margin, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 3.2;

  // Item Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  items.forEach((item) => {
    // Truncate/wrap item name if needed
    const itemName = item.name.length > 18 ? `${item.name.substring(0, 16)}..` : item.name;
    
    doc.setFont('helvetica', 'normal');
    doc.text(itemName, margin, y);
    
    doc.setFont('helvetica', 'bold');
    doc.text(String(item.quantity), margin + 35, y, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.text(formatPdfNaira(item.unitPrice), margin + 50, y, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.text(formatPdfNaira(item.total), pageWidth - margin, y, { align: 'right' });
    
    y += 4;
  });

  y += 1;
  drawDashedLine();

  // 4. TOTALS SECTION
  drawRow('Subtotal:', formatPdfNaira(subtotal), 8.5);
  if (discount > 0) {
    drawRow('Discount:', `-${formatPdfNaira(discount)}`, 8.5, true, [200, 30, 30]);
  }

  y += 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('TOTAL (NGN):', margin, y);
  doc.text(formatPdfNaira(total), pageWidth - margin, y, { align: 'right' });
  y += 5.5;

  drawRow('Payment:', paymentMethod, 8.5, true);
  y += 1;
  drawDashedLine();

  // 5. FOOTER
  drawCenteredText('Thank you for patronizing MUNAJ BAR.', 7.5, true);
  drawCenteredText('Please keep this receipt for verification.', 7, false);

  // 6. REPRINT / DUPLICATE BANNER
  if (isReprint) {
    y += 2;
    doc.setDrawColor(180, 50, 50);
    doc.setLineWidth(0.3);
    doc.rect(margin + 2, y, contentWidth - 4, 6);
    y += 4.2;
    doc.setTextColor(180, 30, 30);
    drawCenteredText('*** DUPLICATE / REPRINT ***', 8, true);
    doc.setTextColor(0, 0, 0);
  }

  return doc;
}

/**
 * Generates and triggers downloading of receipt PDF with mobile & desktop compatibility
 */
export async function downloadReceiptPDF(
  sale: CompletedSaleResult | SaleWithItems,
  options: ReceiptPDFOptions = {}
): Promise<{ success: boolean; filename: string }> {
  try {
    const rawNumber = sale.receipt_number || 'MB-000001';
    const cleanNumber = rawNumber.replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `MUNAJ-BAR-${cleanNumber}.pdf`;

    let logoImage = null;
    if (options.logoUrl) {
      try {
        logoImage = await loadReceiptLogo(options.logoUrl);
      } catch {}
    }

    const doc = generateReceiptPDF(sale, options, logoImage);

    // Generate PDF Blob
    const blob = doc.output('blob');

    // 1. Check if direct browser save via Blob URL is supported
    const blobUrl = URL.createObjectURL(blob);

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // Standard download anchor trigger
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    // Append, click, remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // If on iOS or mobile device where iframe download might be sandboxed,
    // also provide a fallback popup or direct window open
    if (isIOS || (isMobile && typeof window !== 'undefined')) {
      // In iOS Safari, openBlob fallback ensures user sees the document immediately if download doesn't trigger
      try {
        const canShare =
          typeof navigator.share === 'function' &&
          typeof navigator.canShare === 'function';
        if (canShare) {
          const file = new File([blob], filename, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            // Web Share API is optional, link.click() usually handles downloads
          }
        }
      } catch (shareErr) {
        console.warn('Share API notice:', shareErr);
      }
    }

    // Cleanup Blob URL after delay
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60000);

    return { success: true, filename };
  } catch (error) {
    console.error('Error generating or downloading PDF receipt:', error);
    throw error;
  }
}

export interface CashierReportPeriodBreakdown {
  label: string;
  count: number;
  total: number;
}

export interface CashierReportPDFData {
  cashierName: string;
  periodLabel: string;
  periodType: 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'last30' | 'year' | 'all' | 'custom';
  startDateStr?: string;
  endDateStr?: string;
  totalSales: number;
  totalTransactions: number;
  totalItems: number;
  averageSale: number;
  paymentBreakdown: {
    cash: { count: number; total: number };
    pos: { count: number; total: number };
    transfer: { count: number; total: number };
  };
  breakdown?: CashierReportPeriodBreakdown[];
  transactions: SaleWithItems[];
  brandName?: string;
  primaryColor?: string;
}

/**
 * Generates an A4 format Cashier Sales Report PDF
 */
export function generateCashierReportPDF(data: CashierReportPDFData): jsPDF {
  const brandName = (data.brandName || 'MUNAJ BAR').toUpperCase();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  let y = 14;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 15) {
      doc.addPage();
      y = 15;
      // Add mini header on subsequent pages
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`${brandName} — CASHIER SALES REPORT (Continued)`, margin, y);
      doc.text(`${data.cashierName} • ${data.periodLabel}`, pageWidth - margin, y, { align: 'right' });
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 8;
      doc.setTextColor(0, 0, 0);
    }
  };

  // 1. HEADER SECTION
  doc.setFillColor(20, 20, 20);
  doc.rect(margin, y, contentWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(brandName, margin + 6, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 220, 180);
  doc.text('Premium Lounge & Bar Service • Official POS Report', margin + 6, y + 15);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CASHIER SALES REPORT', pageWidth - margin - 6, y + 10, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin - 6, y + 16, { align: 'right' });

  y += 28;

  // 2. CASHIER & REPORT PERIOD BANNER
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Cashier:', margin + 4, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.cashierName, margin + 20, y + 6);

  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text('Report Period:', margin + 85, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.periodLabel, margin + 112, y + 6);

  y += 18;

  // 3. EXECUTIVE METRICS SUMMARY (4 Cards)
  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 16;
  const metrics = [
    { label: 'TOTAL SALES', value: formatPdfNaira(data.totalSales), color: [16, 120, 60] },
    { label: 'TRANSACTIONS', value: String(data.totalTransactions), color: [30, 30, 30] },
    { label: 'ITEMS SOLD', value: String(data.totalItems), color: [30, 30, 30] },
    { label: 'AVERAGE SALE', value: formatPdfNaira(data.averageSale), color: [30, 30, 30] },
  ];

  metrics.forEach((m, idx) => {
    const cardX = margin + idx * (cardWidth + 3);
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(cardX, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(m.label, cardX + cardWidth / 2, y + 5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.value, cardX + cardWidth / 2, y + 12, { align: 'center' });
  });

  y += 20;

  // 4. PAYMENT BREAKDOWN
  checkPageBreak(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('PAYMENT METHOD BREAKDOWN', margin, y);
  y += 4;

  // Table header
  doc.setFillColor(235, 238, 240);
  doc.rect(margin, y, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text('METHOD', margin + 4, y + 4.5);
  doc.text('TRANSACTIONS', margin + 80, y + 4.5, { align: 'center' });
  doc.text('SHARE %', margin + 130, y + 4.5, { align: 'center' });
  doc.text('AMOUNT (NGN)', pageWidth - margin - 4, y + 4.5, { align: 'right' });
  y += 6.5;

  const paymentRows = [
    {
      name: 'Cash Payment',
      count: data.paymentBreakdown.cash.count,
      total: data.paymentBreakdown.cash.total,
    },
    {
      name: 'POS Card Payment',
      count: data.paymentBreakdown.pos.count,
      total: data.paymentBreakdown.pos.total,
    },
    {
      name: 'Bank Transfer',
      count: data.paymentBreakdown.transfer.count,
      total: data.paymentBreakdown.transfer.total,
    },
  ];

  paymentRows.forEach((row, i) => {
    const share = data.totalSales > 0 ? ((row.total / data.totalSales) * 100).toFixed(1) : '0.0';
    if (i % 2 === 1) {
      doc.setFillColor(252, 252, 252);
      doc.rect(margin, y, contentWidth, 5.5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    doc.text(row.name, margin + 4, y + 4);
    doc.text(String(row.count), margin + 80, y + 4, { align: 'center' });
    doc.text(`${share}%`, margin + 130, y + 4, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatPdfNaira(row.total), pageWidth - margin - 4, y + 4, { align: 'right' });
    y += 5.5;
  });

  // Total Payment Row
  doc.setFillColor(240, 245, 240);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('TOTAL REVENUE', margin + 4, y + 4.2);
  doc.text(String(data.totalTransactions), margin + 80, y + 4.2, { align: 'center' });
  doc.text('100.0%', margin + 130, y + 4.2, { align: 'center' });
  doc.setTextColor(16, 120, 60);
  doc.text(formatPdfNaira(data.totalSales), pageWidth - margin - 4, y + 4.2, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 10;

  // 5. PERIOD BREAKDOWN (If present, e.g., Daily / Monthly)
  if (data.breakdown && data.breakdown.length > 0) {
    checkPageBreak(30 + data.breakdown.length * 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('PERIOD CHRONOLOGICAL BREAKDOWN', margin, y);
    y += 4;

    doc.setFillColor(235, 238, 240);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text('PERIOD / DATE', margin + 4, y + 4.2);
    doc.text('ORDERS', margin + 100, y + 4.2, { align: 'center' });
    doc.text('TOTAL AMOUNT', pageWidth - margin - 4, y + 4.2, { align: 'right' });
    y += 6;

    data.breakdown.forEach((b, i) => {
      if (i % 2 === 1) {
        doc.setFillColor(252, 252, 252);
        doc.rect(margin, y, contentWidth, 5, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.text(b.label, margin + 4, y + 3.8);
      doc.text(`${b.count} orders`, margin + 100, y + 3.8, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatPdfNaira(b.total), pageWidth - margin - 4, y + 3.8, { align: 'right' });
      y += 5;
    });

    y += 5;
  }

  // 6. TRANSACTION HISTORY TABLE
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`TRANSACTION HISTORY (${data.transactions.length} Records)`, margin, y);
  y += 4;

  const drawTableHeader = () => {
    doc.setFillColor(30, 30, 30);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('RECEIPT NO', margin + 4, y + 4.2);
    doc.text('DATE', margin + 45, y + 4.2);
    doc.text('TIME', margin + 75, y + 4.2);
    doc.text('PAYMENT', margin + 105, y + 4.2);
    doc.text('ITEMS', margin + 138, y + 4.2, { align: 'center' });
    doc.text('TOTAL (NGN)', pageWidth - margin - 4, y + 4.2, { align: 'right' });
    y += 6;
  };

  drawTableHeader();

  if (data.transactions.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('No completed sales transactions found for this period.', margin + 4, y + 5);
    y += 8;
  } else {
    data.transactions.forEach((sale, i) => {
      checkPageBreak(7);
      
      if (i % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y, contentWidth, 5.2, 'F');
      }

      const dateStr = formatDate(sale.created_at);
      const timeStr = formatTime(sale.created_at);
      const itemsCount = sale.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text(sale.receipt_number || 'MB-000000', margin + 4, y + 3.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text(dateStr, margin + 45, y + 3.8);
      doc.text(timeStr, margin + 75, y + 3.8);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text((sale.payment_method || 'CASH').toUpperCase(), margin + 105, y + 3.8);

      doc.setFont('helvetica', 'normal');
      doc.text(String(itemsCount), margin + 138, y + 3.8, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(formatPdfNaira(sale.total), pageWidth - margin - 4, y + 3.8, { align: 'right' });

      y += 5.2;
    });
  }

  // 7. FINAL TOTAL SUMMARY LINE
  checkPageBreak(12);
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y + 1, pageWidth - margin, y + 1);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`TOTAL SALES (${data.transactions.length} transactions):`, margin + 4, y + 3);
  doc.setTextColor(16, 120, 60);
  doc.text(formatPdfNaira(data.totalSales), pageWidth - margin - 4, y + 3, { align: 'right' });

  // Page Numbers on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `MUNAJ BAR Worker POS System • Cashier: ${data.cashierName} • Page ${p} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  return doc;
}

/**
 * Builds standard automatic report filename based on period type, date, and cashier name
 */
export function getCashierReportFilename(data: CashierReportPDFData): string {
  const cleanWorker = (data.cashierName || 'Cashier').replace(/[^a-zA-Z0-9]/g, '');
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const yearStr = String(now.getFullYear());
  const monthName = now.toLocaleString('en-US', { month: 'long' });

  switch (data.periodType) {
    case 'today':
    case 'yesterday':
      return `MUNAJ-BAR-${cleanWorker}-Daily-Sales-${dateStr}.pdf`;
    case 'week':
    case 'last7':
      return `MUNAJ-BAR-${cleanWorker}-Weekly-Sales-${dateStr}.pdf`;
    case 'month':
    case 'last30':
      return `MUNAJ-BAR-${cleanWorker}-${monthName}-${yearStr}-Sales.pdf`;
    case 'year':
      return `MUNAJ-BAR-${cleanWorker}-${yearStr}-Annual-Sales.pdf`;
    case 'custom': {
      const s = data.startDateStr?.replace(/[^0-9-]/g, '') || dateStr;
      const e = data.endDateStr?.replace(/[^0-9-]/g, '') || dateStr;
      return `MUNAJ-BAR-${cleanWorker}-Sales-${s}-to-${e}.pdf`;
    }
    case 'all':
    default:
      return `MUNAJ-BAR-${cleanWorker}-All-Time-Sales.pdf`;
  }
}

/**
 * Generates and triggers downloading of Cashier Report PDF with universal device support
 */
export async function downloadCashierReportPDF(data: CashierReportPDFData): Promise<{ success: boolean; filename: string }> {
  try {
    const filename = getCashierReportFilename(data);
    const doc = generateCashierReportPDF(data);
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (isIOS || (isMobile && typeof window !== 'undefined')) {
      try {
        if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
          const file = new File([blob], filename, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            // share API supported
          }
        }
      } catch (err) {
        console.warn('Share API notice:', err);
      }
    }

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60000);

    return { success: true, filename };
  } catch (error) {
    console.error('Error generating cashier report PDF:', error);
    throw error;
  }
}
