import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Download, Printer, X, ReceiptText, AlertCircle, RefreshCw, Clock, Check } from 'lucide-react';
import { saleService } from '../services/saleService';
import { getSupabase } from '../lib/supabase';
import { SaleWithItems } from '../types';
import { formatNaira, formatDateTime, formatTime, formatDate, getSaleSeller } from '../utils/formatters';
import { downloadReceiptPDF } from '../utils/pdfGenerator';
import { receiptService } from '../services/receiptService';
import { useAuth } from '../context/AuthContext';
import { useWorkerBranding } from '../context/WorkerBrandingContext';

interface ReceiptsLookupViewProps {
  onSelectSaleForReprint: (sale: SaleWithItems) => void;
}

export const ReceiptsLookupView: React.FC<ReceiptsLookupViewProps> = ({ onSelectSaleForReprint }) => {
  const { profile } = useAuth();
  const { workerSiteName, workerPrimaryColor, businessLogo } = useWorkerBranding();
  const [receipts, setReceipts] = useState<SaleWithItems[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Permanently load completed receipts from Supabase on mount and refresh
  const loadReceipts = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const allSales = await saleService.getWorkerSales('all');
      setReceipts(allSales);
    } catch (err: any) {
      console.error('Error loading receipts from Supabase:', err);
      setErrorMsg(err.message || 'Could not load receipts.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, []);

  useEffect(() => {
    const unsubscribe = saleService.subscribeToAllCompletedSales(() => {
      loadReceipts();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleDirectDownloadPDF = async (sale: SaleWithItems) => {
    try {
      setDownloadingId(sale.id);
      
      // Log reprint in background
      if (sale.id) {
        receiptService.logReceiptPrint(sale.id).catch((err) => {
          console.warn('Could not log print:', err);
        });
      }

      const seller = getSaleSeller(sale);

      await downloadReceiptPDF(sale, {
        isReprint: true,
        workerNameFallback: seller.name,
        printedBy: profile?.full_name?.trim(),
        brandName: workerSiteName,
        primaryColor: workerPrimaryColor,
        logoUrl: businessLogo,
      });

      setDownloadSuccessId(sale.id);
      setTimeout(() => {
        setDownloadSuccessId((prev) => (prev === sale.id ? null : prev));
      }, 3000);
    } catch (err: any) {
      console.error('Download error:', err);
      alert('Could not download PDF receipt. Please check your browser settings.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Filter receipts by search query
  const filteredReceipts = receipts.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const seller = getSaleSeller(s);
    return (
      s.receipt_number.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.payment_method.toLowerCase().includes(q) ||
      seller.name.toLowerCase().includes(q) ||
      seller.role.toLowerCase().includes(q) ||
      s.items?.some((i) => i.product_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111111] border border-[#222222] rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/15 text-green-400 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
              RECEIPT & REPRINT HISTORY
            </h2>
            <p className="text-xs text-[#A1A1AA]">
              Download PDF receipts or view customer thermal slips permanently saved in Supabase
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadReceipts}
            title="Refresh receipts from Supabase"
            className="px-3.5 py-2 rounded-xl bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] text-white text-xs font-bold transition-colors flex items-center space-x-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 shadow-xl">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="receipts-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by receipt # (e.g. MB-000001), staff name, item, or payment..."
            className="w-full bg-[#181818] border border-[#2c2c2c] focus:border-green-500 focus:ring-1 focus:ring-green-500 text-white rounded-xl pl-10 pr-10 py-3 text-xs sm:text-sm outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#71717A] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-2xl flex items-center space-x-3 text-red-300 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Receipts List */}
      {isLoading ? (
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">Loading receipts from Supabase...</p>
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-12 text-center text-[#666666]">
          <ReceiptText className="w-12 h-12 mx-auto mb-3 stroke-[1.5]" />
          <h4 className="text-base font-bold text-white mb-1">No receipts found</h4>
          <p className="text-xs text-[#888888]">
            {searchQuery
              ? `No completed receipts match "${searchQuery}".`
              : 'Complete your first sale in the POS Register to see it saved here permanently.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-[#A1A1AA] font-bold px-1 uppercase tracking-wider">
            Showing {filteredReceipts.length} {filteredReceipts.length === 1 ? 'Receipt' : 'Receipts'}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredReceipts.map((sale) => {
              const seller = getSaleSeller(sale);
              const isDownloading = downloadingId === sale.id;
              const isDownloaded = downloadSuccessId === sale.id;

              return (
                <div
                  key={sale.id}
                  className="bg-[#111111] border border-[#222222] hover:border-[#333333] rounded-2xl p-4 sm:p-5 shadow-lg transition-all flex flex-col justify-between space-y-3"
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#1f1f1f]">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-black text-base text-white">
                          {sale.receipt_number}
                        </span>
                        <span className="bg-green-500/15 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                          {sale.payment_method}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#71717A] flex items-center space-x-1.5 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{formatDateTime(sale.created_at)}</span>
                        <span>•</span>
                        <span className="text-[#A1A1AA] font-medium">{seller.name}</span>
                        <span className="text-[10px] bg-[#1a1a1a] text-[#888888] px-1.5 py-0.2 rounded border border-[#2c2c2c] font-medium">{seller.role}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#71717A] uppercase block">Total</span>
                      <span className="text-base sm:text-lg font-black text-green-400">
                        {formatNaira(sale.total)}
                      </span>
                    </div>
                  </div>

                  {/* Items summary */}
                  <div className="bg-[#161616] rounded-xl p-2.5 border border-[#222222] text-xs space-y-1">
                    {sale.items?.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-zinc-300">
                        <span className="truncate max-w-[200px]">
                          {item.quantity}x {item.product_name}
                        </span>
                        <span className="font-semibold text-white">{formatNaira(item.total)}</span>
                      </div>
                    ))}
                    {(sale.items?.length || 0) > 3 && (
                      <div className="text-[10px] text-[#71717A] italic">
                        + {(sale.items?.length || 0) - 3} more items...
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    {/* DOWNLOAD PDF BUTTON */}
                    <button
                      onClick={() => handleDirectDownloadPDF(sale)}
                      disabled={isDownloading}
                      className="flex-1 bg-green-500 hover:bg-green-400 disabled:bg-green-700 text-black font-extrabold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-green-900/30 transition-all cursor-pointer"
                    >
                      {isDownloading ? (
                        <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : isDownloaded ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isDownloading
                          ? 'DOWNLOADING...'
                          : isDownloaded
                          ? 'DOWNLOADED'
                          : 'DOWNLOAD PDF'}
                      </span>
                    </button>

                    {/* PREVIEW / REPRINT MODAL */}
                    <button
                      onClick={() => onSelectSaleForReprint(sale)}
                      title="View thermal preview & reprint options"
                      className="bg-[#1c1c1c] hover:bg-[#282828] border border-[#2a2a2a] text-white font-bold py-2.5 px-3.5 rounded-xl text-xs flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#A1A1AA]" />
                      <span>PREVIEW</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

