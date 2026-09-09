import React, { useState, useEffect } from 'react';
import { Boxes, X, AlertCircle } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Product, StockMovementType } from '../../types';

interface StockAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  onSuccess: () => void;
}

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess,
}) => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantityChange, setQuantityChange] = useState<string>('');
  const [movementType, setMovementType] = useState<StockMovementType>('restock');
  const [reason, setReason] = useState<string>('Restock delivery from supplier');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      adminService.getAdminProducts({ status: 'all' }).then(setAllProducts).catch(console.error);
      if (product) {
        setSelectedProductId(product.id);
      } else if (allProducts.length > 0) {
        setSelectedProductId(allProducts[0].id);
      }
      setQuantityChange('');
      setMovementType('restock');
      setReason('Restock delivery from supplier');
      setError(null);
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  const currentProduct = product || allProducts.find((p) => p.id === selectedProductId);
  const currentStock = currentProduct?.stock_quantity || 0;
  const numChange = Number(quantityChange) || 0;
  const calculatedNewStock = Math.max(0, currentStock + numChange);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProductId) {
      setError('Please select a product.');
      return;
    }
    if (numChange === 0) {
      setError('Quantity change cannot be 0.');
      return;
    }
    if (currentStock + numChange < 0) {
      setError('Cannot reduce stock below 0 units.');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason or note for this stock adjustment.');
      return;
    }

    try {
      setIsSubmitting(true);
      await adminService.adjustStock({
        productId: selectedProductId,
        quantityChange: numChange,
        movementType,
        reason: reason.trim(),
        currentStock,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to adjust stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#111111] border border-[#262626] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 lg:p-5 border-b border-[#222222] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Boxes className="w-4 h-4 text-amber-400" />
            <span>Stock Inventory Adjustment</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[#A1A1AA] hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Select Product */}
          <div>
            <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
              Select Product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              disabled={!!product}
              className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500 disabled:opacity-60"
            >
              {allProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current: {p.stock_quantity})
                </option>
              ))}
            </select>
          </div>

          {/* Current Stock vs New Stock Preview Box */}
          <div className="p-4 rounded-xl bg-[#181818] border border-[#262626] grid grid-cols-3 text-center">
            <div>
              <span className="text-[11px] text-[#A1A1AA]">Current</span>
              <p className="text-base font-bold text-white mt-0.5">{currentStock}</p>
            </div>
            <div>
              <span className="text-[11px] text-[#A1A1AA]">Adjustment</span>
              <p className={`text-base font-bold mt-0.5 ${numChange > 0 ? 'text-green-400' : numChange < 0 ? 'text-red-400' : 'text-[#71717A]'}`}>
                {numChange > 0 ? `+${numChange}` : numChange}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-[#A1A1AA]">New Stock</span>
              <p className="text-base font-bold text-amber-400 mt-0.5">{calculatedNewStock}</p>
            </div>
          </div>

          {/* Adjustment Quantity Input */}
          <div>
            <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
              Quantity Change (Use negative for reduction)
            </label>
            <input
              type="number"
              required
              placeholder="e.g. +24 for restock, or -2 for broken bottles"
              value={quantityChange}
              onChange={(e) => setQuantityChange(e.target.value)}
              className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white font-bold focus:outline-hidden focus:border-amber-500"
            />
          </div>

          {/* Movement Type */}
          <div>
            <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
              Movement Reason Type
            </label>
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as StockMovementType)}
              className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500"
            >
              <option value="restock">Restock / New Shipment (+)</option>
              <option value="adjustment">Manual Adjustment</option>
              <option value="damage">Breakage / Damage (-)</option>
              <option value="correction">Audit Correction</option>
              <option value="count_adjustment">Physical Count Reconciliation</option>
            </select>
          </div>

          {/* Reason / Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
              Audit Note / Reason <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Received carton from Nigerian Breweries"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-xs font-semibold text-[#E4E4E7]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || numChange === 0}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Apply Stock Change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
