import jsPDF from 'jspdf';
import type { SaleWithDetails, BusinessSettings } from '../types';
import { formatWorkerDisplayName } from '../types';
import { formatDate, formatTime } from './formatters';

interface GenerateReceiptPdfOptions {
  sale: SaleWithDetails;
  settings?: BusinessSettings | null;
  isReprint?: boolean;
}

/**
 * Formats currency safely for standard PDF core fonts (Helvetica/Courier)
 * avoiding Unicode font encoding corruption in mobile PDF engines.
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

/**
 * Loads an image from a URL or Data URI and returns an HTMLImageElement
 * for embedding into jsPDF without crashing.
 */
function loadImageAsync(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
    // Timeout after 1.5s if slow CDN
    setTimeout(() => resolve(null), 1500);
  });
}

export async function generateAndDownloadReceiptPDF({
  sale,
  settings,
  isReprint = false,
}: GenerateReceiptPdfOptions): Promise<{ success: boolean; filename: string }> {
  try {
    const businessName = (settings?.worker_pos_name || settings?.business_name || 'MUNAJ BAR').toUpperCase();
    const currency = settings?.currency || 'NGN';
    const footerText = settings?.receipt_footer || `Thank you for patronizing ${settings?.worker_pos_name || settings?.business_name || 'MUNAJ BAR'}.`;
    const cashierName = formatWorkerDisplayName(sale.worker);
    const items = sale.items || [];

    // Attempt to load logo image if configured
    let logoImg: HTMLImageElement | null = null;
    if (settings?.logo_url) {
      try {
        logoImg = await loadImageAsync(settings.logo_url);
      } catch {
        logoImg = null;
      }
    }

    // Calculate dynamic receipt height: 80mm width, base height ~160mm + extra if logo
    const logoHeightAddition = logoImg ? 14 : 0;
    const baseHeight = 160 + logoHeightAddition;
    const dynamicHeight = Math.max(160, baseHeight + items.length * 9);
    
    // Create jsPDF document with 80mm width standard thermal slip format
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, dynamicHeight],
    });

    const pageWidth = 80;
    const margin = 5;
    const contentWidth = pageWidth - margin * 2;
    let y = 7;

    // 0. Business Logo (if available)
    if (logoImg) {
      try {
        const maxLogoW = 24;
        const maxLogoH = 12;
        const aspect = logoImg.width / logoImg.height;
        let drawW = maxLogoW;
        let drawH = drawW / aspect;
        if (drawH > maxLogoH) {
          drawH = maxLogoH;
          drawW = drawH * aspect;
        }
        const drawX = (pageWidth - drawW) / 2;
        doc.addImage(logoImg, 'PNG', drawX, y, drawW, drawH);
        y += drawH + 2.5;
      } catch (imgErr) {
        console.warn('Notice adding logo to receipt PDF:', imgErr);
      }
    }

    // 1. Business Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(businessName, pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('Premium Lounge & Bar Service', pageWidth / 2, y, { align: 'center' });
    y += 4;

    if (settings?.address) {
      doc.text(settings.address, pageWidth / 2, y, { align: 'center' });
      y += 3.5;
    }
    if (settings?.phone) {
      doc.text(`Tel: ${settings.phone}`, pageWidth / 2, y, { align: 'center' });
      y += 3.5;
    }
    if (settings?.email) {
      doc.text(settings.email, pageWidth / 2, y, { align: 'center' });
      y += 3.5;
    }

    y += 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text('OFFICIAL SALES RECEIPT', pageWidth / 2, y, { align: 'center' });
    y += 4.5;

    // Reprint Banner if duplicate / reprint
    if (isReprint) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 0, 0);
      doc.text('*** DUPLICATE / REPRINT ***', pageWidth / 2, y, { align: 'center' });
      y += 4.5;
    }

    // Divider Line
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4.5;

    // 2. Receipt Metadata
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);

    // Receipt No
    doc.text('Receipt No:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.text(sale.receipt_number, pageWidth - margin, y, { align: 'right' });
    y += 4;

    // Date
    doc.setFont('helvetica', 'normal');
    doc.text('Date:', margin, y);
    doc.text(formatDate(sale.created_at), pageWidth - margin, y, { align: 'right' });
    y += 4;

    // Time
    doc.text('Time:', margin, y);
    doc.text(formatTime(sale.created_at), pageWidth - margin, y, { align: 'right' });
    y += 4;

    // Cashier
    doc.text('Cashier:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.text(cashierName, pageWidth - margin, y, { align: 'right' });
    y += 4;

    // Status
    doc.setFont('helvetica', 'normal');
    doc.text('Status:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(sale.status === 'completed' ? 16 : 180, sale.status === 'completed' ? 140 : 0, 40);
    doc.text(sale.status.toUpperCase(), pageWidth - margin, y, { align: 'right' });
    y += 4.5;

    // Divider Line
    doc.setTextColor(30, 30, 30);
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    // 3. Item Table Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text('ITEM', margin, y);
    doc.text('QTY', margin + 33, y, { align: 'center' });
    doc.text('PRICE', margin + 49, y, { align: 'right' });
    doc.text('TOTAL', pageWidth - margin, y, { align: 'right' });
    y += 2.5;

    doc.setDrawColor(210, 210, 210);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3.5;

    // 4. Item Rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(20, 20, 20);

    for (const item of items) {
      const name = item.product_name || 'Item';
      const qty = `x${item.quantity}`;
      const unitPrice = formatPdfCurrency(item.unit_price, currency);
      const itemTotal = formatPdfCurrency(item.total, currency);

      // Truncate or wrap item name if needed
      const splitName = doc.splitTextToSize(name, 30);
      doc.text(splitName[0] || name, margin, y);
      doc.text(qty, margin + 33, y, { align: 'center' });
      doc.text(unitPrice, margin + 49, y, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(itemTotal, pageWidth - margin, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      y += 4;
      if (splitName.length > 1) {
        doc.setFontSize(7);
        doc.setTextColor(90, 90, 90);
        doc.text(splitName[1], margin, y);
        doc.setFontSize(8);
        doc.setTextColor(20, 20, 20);
        y += 3.5;
      }
    }

    y += 1;
    // Divider Line
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4.5;

    // 5. Financial Summary
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Subtotal:', margin, y);
    doc.text(formatPdfCurrency(sale.subtotal, currency), pageWidth - margin, y, { align: 'right' });
    y += 4;

    if (sale.discount && sale.discount > 0) {
      doc.setTextColor(180, 0, 0);
      doc.text('Discount:', margin, y);
      doc.text(`-${formatPdfCurrency(sale.discount, currency)}`, pageWidth - margin, y, { align: 'right' });
      doc.setTextColor(20, 20, 20);
      y += 4;
    }

    // Grand Total (Highlight box)
    y += 1;
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 3.5, contentWidth, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('TOTAL (NGN):', margin + 2, y + 1);
    doc.text(formatPdfCurrency(sale.total, currency), pageWidth - margin - 2, y + 1, { align: 'right' });
    y += 8;

    // Payment Method
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Payment:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.text((sale.payment_method || 'CASH').toUpperCase(), pageWidth - margin, y, { align: 'right' });
    y += 5.5;

    // Divider Line
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // 6. Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 70);
    const splitFooter = doc.splitTextToSize(footerText, contentWidth);
    for (const fLine of splitFooter) {
      doc.text(fLine, pageWidth / 2, y, { align: 'center' });
      y += 3.5;
    }
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text('Please keep this receipt for verification.', pageWidth / 2, y, { align: 'center' });

    // File name format: <BUSINESS_NAME>-MB-000001.pdf
    const sanitizedReceiptNo = sale.receipt_number.replace(/[^a-zA-Z0-9_-]/g, '-');
    const sanitizedBiz = businessName.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filename = `${sanitizedBiz}-${sanitizedReceiptNo}.pdf`;

    // Multiplatform mobile & desktop save handling
    const isIOS =
      typeof navigator !== 'undefined' &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    if (isIOS) {
      try {
        // For iOS/Safari: generate blob url and open in a new tab or trigger a link
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
      // Android, Windows, macOS Chrome/Edge
      doc.save(filename);
    }

    return { success: true, filename };
  } catch (error) {
    console.error('Error generating PDF receipt:', error);
    throw error;
  }
}
