import React, { useState } from 'react';
import { Printer, Check, Copy, Download, RefreshCw, FileText, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import type { SaleWithDetails, BusinessSettings } from '../../types';
import { formatWorkerDisplayName } from '../../types';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';
import { generateAndDownloadReceiptPDF } from '../../utils/pdfReceiptGenerator';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleWithDetails | null;
  settings?: BusinessSettings | null;
  onPrintLogged?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  settings,
  onPrintLogged,
}) => {
  const { user } = useAuth();
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadCount, setDownloadCount] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [printSuccess, setPrintSuccess] = useState<string | null>(null);

  if (!sale) return null;

  const businessName = settings?.worker_pos_name || settings?.business_name || 'MUNAJ BAR';
  const currency = settings?.currency || 'NGN';
  const footerText = settings?.receipt_footer || `Thank you for patronizing ${businessName}.`;
  const cashierName = formatWorkerDisplayName(sale.worker);
  const isReprint = downloadCount > 0;

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);
      setErrorMsg(null);

      // Generate and download PDF
      await generateAndDownloadReceiptPDF({
        sale,
        settings,
        isReprint: downloadCount > 0,
      });

      setDownloadCount((prev) => prev + 1);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);

      // Log receipt print/download event in database if user is authenticated
      if (user?.id) {
        try {
          await supabase.from('receipt_prints').insert({
            sale_id: sale.id,
            worker_id: user.id,
            printed_at: new Date().toISOString(),
          });
          onPrintLogged?.();
        } catch (logErr) {
          console.warn('Notice logging receipt print audit:', logErr);
        }
      }
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      setErrorMsg('Unable to generate receipt PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    try {
      setPrinting(true);
      setErrorMsg(null);
      setPrintSuccess(null);

      const receipt = document.getElementById('printable-receipt');
      const printWindow = window.open('', '_blank');

      if (!receipt || !printWindow) {
        throw new Error('Unable to open the receipt print preview.');
      }

      const clonedReceipt = receipt.cloneNode(true) as HTMLElement;
      const styles = Array.from(
        document.querySelectorAll('link[rel="stylesheet"], style'),
      )
        .map((style) => style.outerHTML)
        .join('');

      printWindow.document.open();
      printWindow.document.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <base href="${document.baseURI}" />
            ${styles}
            <style id="receipt-print-overrides">
              @page { size: 80mm auto; margin: 0; }
              html, body {
                width: 80mm !important;
                min-width: 80mm !important;
                max-width: 80mm !important;
                height: auto !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                display: block !important;
              }
              #printable-receipt {
                page: auto !important;
                position: static !important;
                width: 80mm !important;
                min-width: 80mm !important;
                max-width: 80mm !important;
                height: auto !important;
                min-height: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
                transform: none !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
                box-sizing: border-box !important;
              }
            </style>
          </head>
          <body></body>
        </html>
      `);
      printWindow.document.body.appendChild(printWindow.document.adoptNode(clonedReceipt));
      printWindow.document.close();

      await new Promise<void>((resolve, reject) => {
        const print = async () => {
          try {
            await printWindow.document.fonts.ready;

            const printableReceipt = printWindow.document.getElementById('printable-receipt');
            const printOverrides = printWindow.document.getElementById('receipt-print-overrides');

            if (!printableReceipt || !printOverrides) {
              throw new Error('Unable to prepare the receipt print preview.');
            }

            const receiptHeightPx = Math.ceil(printableReceipt.getBoundingClientRect().height);
            const receiptHeightMm = (receiptHeightPx * 25.4) / 96;

            printOverrides.textContent = `
              @page { size: 80mm ${receiptHeightMm}mm; margin: 0; }
              html, body {
                width: 80mm !important;
                height: ${receiptHeightMm}mm !important;
                min-height: 0 !important;
                max-height: none !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
              }
              #printable-receipt {
                width: 80mm !important;
                min-width: 80mm !important;
                max-width: 80mm !important;
                height: ${receiptHeightPx}px !important;
                min-height: 0 !important;
                max-height: none !important;
                margin: 0 !important;
                overflow: visible !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
            `;

            printWindow.focus();
            printWindow.print();
            printWindow.close();
            resolve();
          } catch (error) {
            printWindow.close();
            reject(error);
          }
        };

        if (printWindow.document.readyState === 'complete') {
          void print();
        } else {
          printWindow.addEventListener('load', () => void print(), { once: true });
        }
      });

      // Log receipt print event after the native print flow returns
      if (user?.id) {
        try {
          await supabase.from('receipt_prints').insert({
            sale_id: sale.id,
            worker_id: user.id,
            printed_at: new Date().toISOString(),
          });
          onPrintLogged?.();
        } catch (logErr) {
          console.warn('Notice logging receipt print event:', logErr);
        }
      }

      setDownloadCount((prev) => prev + 1);
      setPrintSuccess('Receipt sent to printer.');
      setTimeout(() => setPrintSuccess(null), 4000);
    } catch (err) {
      console.error('Error triggering receipt print:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Unable to print receipt.');
    } finally {
      setPrinting(false);
    }
  };

  const handleCopyReceipt = () => {
    const lines = [
      businessName,
      'Premium Lounge & Bar Service',
      settings?.address || '',
      settings?.phone ? `Tel: ${settings.phone}` : '',
      '================================',
      'RECEIPT',
      isReprint ? '*** DUPLICATE / REPRINT ***' : '',
      `Receipt No: ${sale.receipt_number}`,
      `Date: ${formatDate(sale.created_at)}`,
      `Time: ${formatTime(sale.created_at)}`,
      `Cashier: ${cashierName}`,
      '--------------------------------',
      'ITEM          QTY    PRICE    TOTAL',
      ...(sale.items || []).map((it) => {
        const itemP = formatCurrency(it.unit_price, currency);
        const itemT = formatCurrency(it.total, currency);
        return `${it.product_name.padEnd(14, ' ')} ${String(it.quantity).padEnd(4, ' ')} ${itemP.padEnd(8, ' ')} ${itemT}`;
      }),
      '--------------------------------',
      `Subtotal: ${formatCurrency(sale.subtotal, currency)}`,
      sale.discount > 0 ? `Discount: -${formatCurrency(sale.discount, currency)}` : '',
      `TOTAL (${currency}): ${formatCurrency(sale.total, currency)}`,
      `Payment: ${sale.payment_method.toUpperCase()}`,
      '--------------------------------',
      footerText,
      'Please keep this receipt for verification.',
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Receipt Preview — ${sale.receipt_number}`}
      subtitle={`Official transaction completed on ${formatDate(sale.created_at)} at ${formatTime(sale.created_at)}`}
      maxWidth="md"
    >
      <div className="flex flex-col gap-5">
        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {printSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-950/50 border border-emerald-800 rounded-xl text-xs text-emerald-300">
            <Check className="w-4 h-4 text-[#22C55E] shrink-0" />
            <span>{printSuccess}</span>
          </div>
        )}

        {/* Success Toast */}
        {downloadSuccess && (
          <div className="flex items-center justify-between p-3 bg-emerald-950/50 border border-emerald-800 rounded-xl text-xs text-emerald-300 animate-fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#22C55E] shrink-0" />
              <span>
                PDF Downloaded successfully: <strong>{businessName.replace(/[^a-zA-Z0-9_-]/g, '-')}-{sale.receipt_number}.pdf</strong>
              </span>
            </div>
            {isReprint && (
              <span className="text-[10px] bg-emerald-900/60 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Reprint Saved
              </span>
            )}
          </div>
        )}

        {/* High-Fidelity Printable Thermal Receipt Preview */}
        <div
          id="printable-receipt"
          className="bg-white text-zinc-900 p-6 sm:p-7 rounded-xl font-mono text-xs shadow-2xl select-text border border-zinc-200"
        >
          {/* Header */}
          <div className="text-center pb-3 border-b border-dashed border-zinc-400">
            {settings?.logo_url && (
              <div className="flex justify-center mb-2">
                <img
                  src={settings.logo_url}
                  alt={businessName}
                  className="max-h-12 max-w-[130px] object-contain mx-auto"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <h2 className="text-base font-extrabold uppercase tracking-wider text-black">
              {businessName}
            </h2>
            <p className="text-[11px] text-zinc-600 font-sans font-medium mt-0.5">
              Premium Lounge & Bar Service
            </p>
            {settings?.address && <p className="text-[10px] text-zinc-600 mt-0.5">{settings.address}</p>}
            {settings?.phone && <p className="text-[10px] text-zinc-600">Tel: {settings.phone}</p>}
            {settings?.email && <p className="text-[10px] text-zinc-600">{settings.email}</p>}

            <div className="mt-2.5 inline-block border border-zinc-800 px-3 py-0.5 rounded text-[11px] font-bold tracking-widest text-black">
              RECEIPT
            </div>

            {isReprint && (
              <div className="mt-1 text-[10px] font-bold text-red-600 tracking-wider">
                *** DUPLICATE / REPRINT ***
              </div>
            )}
          </div>

          {/* Meta Information */}
          <div className="py-2.5 border-b border-dashed border-zinc-400 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-zinc-500">Receipt No:</span>
              <span className="font-bold text-black font-mono">{sale.receipt_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Date:</span>
              <span className="text-zinc-800">{formatDate(sale.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Time:</span>
              <span className="text-zinc-800">{formatTime(sale.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Cashier:</span>
              <span className="font-semibold text-black">{cashierName}</span>
            </div>
          </div>

          {/* Items Section */}
          <div className="py-3 border-b border-dashed border-zinc-400">
            <div className="grid grid-cols-12 font-bold text-zinc-700 pb-1.5 text-[10px] uppercase tracking-wider border-b border-zinc-300">
              <span className="col-span-5">ITEM</span>
              <span className="col-span-2 text-center">QTY</span>
              <span className="col-span-2 text-right">PRICE</span>
              <span className="col-span-3 text-right">TOTAL</span>
            </div>
            <div className="space-y-2 pt-2">
              {(sale.items || []).map((it) => (
                <div key={it.id} className="grid grid-cols-12 items-baseline text-[11px]">
                  <span className="col-span-5 font-semibold text-black truncate pr-1">
                    {it.product_name}
                  </span>
                  <span className="col-span-2 text-center text-zinc-600 font-medium">
                    {it.quantity}
                  </span>
                  <span className="col-span-2 text-right text-zinc-700 font-mono text-[10px]">
                    {formatCurrency(it.unit_price, currency)}
                  </span>
                  <span className="col-span-3 text-right font-bold text-black font-mono">
                    {formatCurrency(it.total, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Totals */}
          <div className="py-2.5 border-b border-dashed border-zinc-400 space-y-1.5 text-[11px]">
            <div className="flex justify-between text-zinc-600">
              <span>Subtotal:</span>
              <span className="font-mono text-zinc-800">{formatCurrency(sale.subtotal, currency)}</span>
            </div>
            {sale.discount > 0 ? (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span className="font-mono">-{formatCurrency(sale.discount, currency)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-zinc-500 text-[10px]">
                <span>Discount:</span>
                <span className="font-mono">{formatCurrency(0, currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-sm text-black pt-1.5 border-t border-zinc-300">
              <span>TOTAL ({currency}):</span>
              <span className="font-mono text-emerald-700 text-base">{formatCurrency(sale.total, currency)}</span>
            </div>
            <div className="flex justify-between text-[11px] pt-1">
              <span className="text-zinc-600">Payment:</span>
              <span className="font-bold text-black uppercase tracking-wider">{sale.payment_method}</span>
            </div>
          </div>

          {/* Footer Notes */}
          <div className="text-center pt-3.5 text-[10px] text-zinc-600 space-y-1">
            <p className="font-semibold text-zinc-800 uppercase">{footerText}</p>
            <p className="text-[9px] text-zinc-500">Please keep this receipt for verification.</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyReceipt}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-[#22C55E]" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={printing}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{printing ? 'Printing...' : 'Print Receipt'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-extrabold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-lg shadow-emerald-950/40 disabled:opacity-50 cursor-pointer"
            >
              {downloading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {downloading
                  ? 'Generating PDF...'
                  : isReprint
                  ? 'Download PDF Again (Reprint)'
                  : 'Download Receipt PDF'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
