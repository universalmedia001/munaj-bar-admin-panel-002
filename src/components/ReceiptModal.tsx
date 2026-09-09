import React, { useState, useEffect } from 'react';
import { Download, Check, X, Sparkles, ArrowRight, Printer, FileText } from 'lucide-react';
import { CompletedSaleResult, SaleWithItems, Profile } from '../types';
import { formatNaira, formatDateTime, formatTime, formatDate, getSaleSeller } from '../utils/formatters';
import { receiptService } from '../services/receiptService';
import { adminService } from '../services/adminService';
import { useAuth } from '../context/AuthContext';
import { useWorkerBranding } from '../context/WorkerBrandingContext';
import { downloadReceiptPDF } from '../utils/pdfGenerator';

interface ReceiptModalProps {
  sale: CompletedSaleResult | SaleWithItems | null;
  isOpen: boolean;
  onClose: () => void;
  isReprint?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  isOpen,
  onClose,
  isReprint = false,
}) => {
  const { profile } = useAuth();
  const { workerSiteName, workerPrimaryColor, textColor, businessLogo } = useWorkerBranding();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [resolvedWorker, setResolvedWorker] = useState<Profile | null>((sale as any)?.worker || null);

  useEffect(() => {
    if (sale && !(sale as any).worker && (sale as any).worker_id) {
      let isMounted = true;
      adminService.getAllWorkers().then((workers) => {
        if (!isMounted) return;
        const match = workers.find((w) => w.id === (sale as any).worker_id);
        if (match) {
          setResolvedWorker(match);
        }
      }).catch((err) => {
        console.warn('Notice loading worker profile in modal:', err);
      });
      return () => {
        isMounted = false;
      };
    } else {
      setResolvedWorker((sale as any)?.worker || null);
    }
  }, [sale]);

  if (!isOpen || !sale) return null;

  const receiptNumber = sale.receipt_number || 'MB-000000';
  const createdAt = sale.created_at || new Date().toISOString();
  const paymentMethod = (sale.payment_method || 'cash').toUpperCase();
  const subtotal = Number(sale.subtotal || 0);
  const discount = Number(sale.discount || 0);
  const total = Number(sale.total || 0);
  
  // Resolve authoritative seller identity from sale.worker / resolvedWorker / sale.worker_name
  // NEVER fallback to the currently logged-in viewer (Cashier)
  const effectiveSale = resolvedWorker ? { ...sale, worker: resolvedWorker } : sale;
  const seller = getSaleSeller(effectiveSale);
  const sellerName = seller.name;
  const sellerRole = seller.role;

  // Viewer printing information (if different from seller or if viewing/printing)
  const viewerName = profile?.full_name?.trim();

  // Normalize items array
  const items = sale.items || [];

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      
      // Log reprint in background
      if (sale.id && isReprint) {
        receiptService.logReceiptPrint(sale.id).catch((err) => {
          console.warn('Could not log receipt print:', err);
        });
      }

      await downloadReceiptPDF(effectiveSale, {
        isReprint,
        workerNameFallback: sellerName,
        printedBy: viewerName,
        brandName: workerSiteName,
        primaryColor: workerPrimaryColor,
        logoUrl: businessLogo,
      });

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Error downloading PDF receipt:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleNativePrint = () => {
    try {
      setIsPrinting(true);
      if (sale.id) {
        receiptService.logReceiptPrint(sale.id).catch((err) => {
          console.warn('Could not log print:', err);
        });
      }
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 50);
    } catch (err) {
      console.error('Print error:', err);
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in print:p-0 print:bg-white overflow-y-auto">
      <div className="bg-[#111111] border border-[#262626] rounded-2xl max-w-sm w-full p-4 sm:p-6 shadow-2xl relative overflow-hidden print:border-none print:shadow-none print:p-0 print:bg-white print:text-black print:max-w-none my-auto">
        
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between mb-3.5 print:hidden">
          <div className="flex items-center space-x-2">
            <span 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: isReprint ? '#f59e0b' : workerPrimaryColor }}
            />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {isReprint ? 'DUPLICATE / REPRINT RECEIPT' : 'SALE COMPLETED ✓'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717A] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* RECEIPT PREVIEW (80mm Thermal Slip Representation)        */}
        {/* ========================================================= */}
        <div 
          id="printable-thermal-receipt" 
          className="bg-white text-black p-4 sm:p-5 rounded-xl font-mono text-[11px] sm:text-[12px] leading-relaxed shadow-inner border border-zinc-200 select-text print:rounded-none print:border-none print:shadow-none print:p-2"
        >
          {/* Header */}
          <div className="text-center pb-2.5 border-b border-dashed border-zinc-400">
            {businessLogo && (
              <div className="mb-2 flex justify-center">
                <img
                  id="receipt-thermal-business-logo"
                  src={businessLogo}
                  alt={workerSiteName}
                  className="max-h-12 max-w-[140px] object-contain mx-auto print:max-h-12 filter grayscale contrast-125"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <h2 className="text-base sm:text-lg font-black tracking-wider text-black">
              {workerSiteName}
            </h2>
            <p className="text-[10px] text-zinc-600 font-sans mt-0.5">
              Premium Lounge & Bar Service
            </p>
            <div className="mt-1 text-[11px] font-bold tracking-widest text-zinc-800">
              RECEIPT
            </div>
          </div>

          {/* Metadata info */}
          <div className="py-2.5 border-b border-dashed border-zinc-300 text-[11px] space-y-0.5">
            <div className="flex justify-between">
              <span className="text-zinc-600">Receipt No:</span>
              <span className="font-bold text-black">{receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Date:</span>
              <span>{formatDate(createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Time:</span>
              <span>{formatTime(createdAt)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-600">Sold By:</span>
              <span className="font-semibold text-black">
                {sellerName}{sellerRole && sellerRole !== 'Staff' ? ` (${sellerRole})` : ''}
              </span>
            </div>
            {viewerName && (
              <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-0.5">
                <span>Printed By:</span>
                <span className="font-medium text-zinc-700">{viewerName}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="py-2.5 border-b border-dashed border-zinc-300">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-600 font-bold">
                  <th className="pb-1 text-left">ITEM</th>
                  <th className="pb-1 text-center">QTY</th>
                  <th className="pb-1 text-right">PRICE</th>
                  <th className="pb-1 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((item: any, idx: number) => {
                  const name = item.product_name || item.product?.name || item.name || 'Item';
                  const qty = item.quantity || 1;
                  const price = Number(item.unit_price || item.product?.selling_price || item.price || 0);
                  const totalItem = Number(item.total || price * qty);

                  return (
                    <tr key={item.id || idx}>
                      <td className="py-1 pr-1 font-medium max-w-[130px] break-words">
                        {name}
                      </td>
                      <td className="py-1 text-center font-bold">{qty}</td>
                      <td className="py-1 text-right whitespace-nowrap">
                        {formatNaira(price)}
                      </td>
                      <td className="py-1 text-right font-bold whitespace-nowrap">
                        {formatNaira(totalItem)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="py-2.5 border-b border-dashed border-zinc-400 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-zinc-600">Subtotal:</span>
              <span className="font-semibold">{formatNaira(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-600 font-medium">
                <span>Discount:</span>
                <span>-{formatNaira(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs sm:text-sm font-black pt-1 border-t border-zinc-200 text-black">
              <span>TOTAL (NGN):</span>
              <span className="text-base">{formatNaira(total)}</span>
            </div>
            <div className="flex justify-between pt-1 text-[11px]">
              <span className="text-zinc-600">Payment:</span>
              <span className="font-bold uppercase bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-300">
                {paymentMethod}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-2.5 text-[10px] text-zinc-600 font-sans space-y-1">
            <p className="font-semibold text-zinc-800">
              Thank you for patronizing {workerSiteName}.
            </p>
            <p className="text-[9px] text-zinc-500">
              Please keep this receipt for verification.
            </p>
            {isReprint && (
              <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest pt-1 border-t border-dashed border-zinc-300 mt-2">
                *** DUPLICATE / REPRINT ***
              </p>
            )}
          </div>
        </div>

        {/* Download Success Notice */}
        {downloadSuccess && (
          <div 
            className="mt-3 p-2.5 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold animate-fade-in print:hidden border"
            style={{
              backgroundColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.15)',
              borderColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)',
              color: workerPrimaryColor,
            }}
          >
            <Check className="w-4 h-4" />
            <span>PDF Downloaded Successfully!</span>
          </div>
        )}

        {/* Modal Buttons (Hidden in Print) */}
        <div className="mt-4 space-y-2.5 print:hidden">
          {/* Action Buttons Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Primary Action: PRINT RECEIPT */}
            <button
              id="native-print-receipt-btn"
              onClick={handleNativePrint}
              disabled={isPrinting}
              style={{
                backgroundColor: workerPrimaryColor,
                color: textColor,
                boxShadow: `0 8px 20px -4px rgba(var(--worker-primary-rgb, 183, 255, 0), 0.35)`,
              }}
              className="w-full font-black py-3 px-3 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'PRINTING...' : 'PRINT RECEIPT'}</span>
            </button>

            {/* DOWNLOAD PDF */}
            <button
              id="download-receipt-pdf-btn"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="w-full bg-[#1c1c1c] hover:bg-[#252525] border border-[#2a2a2a] text-white font-bold py-3 px-3 rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isDownloading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isDownloading ? 'SAVING...' : 'DOWNLOAD PDF'}</span>
            </button>
          </div>

          {/* Dismiss / Continue */}
          <button
            id="continue-selling-btn"
            onClick={onClose}
            className="w-full bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] text-zinc-400 hover:text-white font-semibold py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <span>{isReprint ? 'Close Window' : 'Done / Return to Register'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};

