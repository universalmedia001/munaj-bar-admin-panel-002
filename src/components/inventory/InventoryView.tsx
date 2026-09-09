import React, { useState, useMemo } from 'react';
import {
  Boxes,
  ArrowUpDown,
  Plus,
  Search,
  AlertTriangle,
  PackageX,
  History,
  ShieldCheck,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import type { Product, StockMovementWithDetails, BusinessSettings, StockMovementType } from '../../types';
import { formatCurrency, formatDateTime, formatRelativeTime } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { Modal } from '../common/Modal';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';
import { deleteStockMovement } from '../../services/deleteManagementService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface InventoryViewProps {
  products: Product[];
  movements: StockMovementWithDetails[];
  settings: BusinessSettings | null;
  onRefresh: () => void;
  loading: boolean;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  movements,
  settings,
  onRefresh,
  loading,
}) => {
  const { user } = useAuth();
  const currency = settings?.currency || 'NGN';

  const [activeTab, setActiveTab] = useState<'inventory' | 'movements'>('inventory');
  const [search, setSearch] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<StockMovementType>('restock');
  const [adjustQuantity, setAdjustQuantity] = useState<string>('10');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete Movement Modal State
  const [movementToDelete, setMovementToDelete] = useState<StockMovementWithDetails | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingMovement, setIsDeletingMovement] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reverseInventoryEffect, setReverseInventoryEffect] = useState(true);

  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager' || (user?.role as string) === 'super_admin';

  const promptDeleteMovement = (m: StockMovementWithDetails) => {
    setMovementToDelete(m);
    setDeleteError(null);
    setReverseInventoryEffect(true);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteMovement = async () => {
    if (!movementToDelete) return;
    try {
      setIsDeletingMovement(true);
      setDeleteError(null);

      const result = await deleteStockMovement(
        movementToDelete.id,
        user ? { id: user.id, fullName: user.full_name } : undefined,
        reverseInventoryEffect
      );

      if (!result.success) {
        setDeleteError(result.message);
        return;
      }

      setIsDeleteModalOpen(false);
      setMovementToDelete(null);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete stock movement record.';
      setDeleteError(msg);
    } finally {
      setIsDeletingMovement(false);
    }
  };

  const openAdjustment = (product: Product) => {
    setSelectedProduct(product);
    setAdjustType('restock');
    setAdjustQuantity('10');
    setAdjustReason('Weekly delivery / bar restock');
    setErrorMsg(null);
    setIsAdjustModalOpen(true);
  };

  const calculateResultingStock = () => {
    if (!selectedProduct) return 0;
    const qty = parseInt(adjustQuantity, 10);
    if (isNaN(qty)) return selectedProduct.stock_quantity;

    if (adjustType === 'restock') {
      return selectedProduct.stock_quantity + Math.abs(qty);
    }
    if (adjustType === 'damage' || adjustType === 'correction') {
      return selectedProduct.stock_quantity - Math.abs(qty);
    }
    // general adjustment
    return selectedProduct.stock_quantity + qty;
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const rawQty = parseInt(adjustQuantity, 10);
    if (isNaN(rawQty) || rawQty === 0) {
      setErrorMsg('Please enter a non-zero adjustment quantity.');
      return;
    }
    if (!adjustReason.trim()) {
      setErrorMsg('A reason for this stock adjustment is mandatory for auditability.');
      return;
    }

    let delta = rawQty;
    if (adjustType === 'damage' || adjustType === 'correction') {
      delta = -Math.abs(rawQty);
    } else if (adjustType === 'restock') {
      delta = Math.abs(rawQty);
    }

    const nextStock = selectedProduct.stock_quantity + delta;
    if (nextStock < 0) {
      setErrorMsg(`Invalid adjustment: Cannot reduce stock below 0. (Current: ${selectedProduct.stock_quantity}, Change: ${delta})`);
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);

      // Attempt calling adjust_stock RPC
      const { data: rpcResult, error: rpcErr } = await supabase.rpc('adjust_stock', {
        p_product_id: selectedProduct.id,
        p_quantity_change: delta,
        p_type: adjustType,
        p_reason: adjustReason.trim(),
      });

      if (rpcErr) {
        console.warn('RPC adjust_stock error, applying atomic fallback:', rpcErr.message);

        // Fallback update
        const { error: updateErr } = await supabase
          .from('products')
          .update({ stock_quantity: nextStock, updated_at: new Date().toISOString() })
          .eq('id', selectedProduct.id);

        if (updateErr) throw updateErr;

        // Record stock movement (supports inventory_movements and stock_movements)
        const movePayload = {
          product_id: selectedProduct.id,
          type: adjustType,
          quantity: delta,
          quantity_before: selectedProduct.stock_quantity,
          quantity_after: nextStock,
          reason: adjustReason.trim(),
          created_by: user?.id || null,
        };

        try {
          let { error: moveErr } = await supabase
            .from('inventory_movements' as any)
            .insert(movePayload);

          if (moveErr && (moveErr.code === 'PGRST205' || moveErr.message?.includes('inventory_movements'))) {
            const res2 = await supabase.from('stock_movements' as any).insert(movePayload);
            moveErr = res2.error;
          }

          if (moveErr) {
            if (moveErr.code === '42501' || moveErr.message?.includes('row-level security')) {
              console.info('[InventoryView] Stock movement insert restricted by RLS policy.');
            } else {
              console.warn('[InventoryView] Stock movement insert note:', moveErr.message);
            }
          }
        } catch (moveEx) {
          console.warn('[InventoryView] Stock movement exception note:', moveEx);
        }

        // Log activity (safe non-blocking)
        try {
          const { error: actErr } = await supabase.from('activity_logs').insert({
            action: 'stock_adjusted',
            description: `Stock adjusted for ${selectedProduct.name} (${selectedProduct.stock_quantity} → ${nextStock}) [${adjustType}: ${adjustReason}]`,
            metadata: { product_id: selectedProduct.id, type: adjustType, reason: adjustReason },
          });
          if (actErr) {
            if (actErr.code === '42501' || actErr.message?.includes('row-level security')) {
              console.info('[InventoryView] Activity log insert restricted by RLS policy.');
            } else {
              console.warn('[InventoryView] Activity log notice:', actErr.message);
            }
          }
        } catch (actEx) {
          console.warn('[InventoryView] Activity log exception note:', actEx);
        }
      }

      setIsAdjustModalOpen(false);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to adjust stock.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  // Inventory Filtering
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const isLow = p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock_level;
      const isOut = p.stock_quantity <= 0;

      if (stockStatusFilter === 'in_stock' && (isLow || isOut)) return false;
      if (stockStatusFilter === 'low_stock' && !isLow) return false;
      if (stockStatusFilter === 'out_of_stock' && !isOut) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [products, stockStatusFilter, search]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] p-5 rounded-2xl border border-zinc-800/80">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            Inventory & Stock Audit
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Realtime bottle stock counts, low stock thresholds, and immutable movement history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'inventory'
                ? 'bg-[#22C55E] text-black font-bold shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Current Stock ({products.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'movements'
                ? 'bg-[#22C55E] text-black font-bold shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Stock Movements Log ({movements.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'inventory' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-[#111111] p-4 rounded-2xl border border-zinc-800/80 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search inventory items..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs placeholder:text-zinc-500 outline-none"
              />
            </div>

            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E]"
            >
              <option value="all">All Stock Statuses</option>
              <option value="in_stock">In Stock (Healthy)</option>
              <option value="low_stock">Low Stock (At or Below Threshold)</option>
              <option value="out_of_stock">Out of Stock (0 Available)</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 overflow-hidden">
            {filteredProducts.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Boxes}
                  title="No inventory records found"
                  description="Add products to your catalog to start managing stock levels."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#141414] border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Product Name</th>
                      <th className="py-3.5 px-4 text-center">Current Stock</th>
                      <th className="py-3.5 px-4 text-center">Min Level</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Retail Value</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredProducts.map((p) => {
                      const isLow = p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock_level;
                      const isOut = p.stock_quantity <= 0;

                      return (
                        <tr key={p.id} className="hover:bg-zinc-900/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white text-xs">{p.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              ID: {p.id ? `${p.id.slice(0, 8)}...` : 'N/A'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`text-sm font-mono font-extrabold ${
                                isOut
                                  ? 'text-red-400'
                                  : isLow
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {p.stock_quantity}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-zinc-400">
                            {p.minimum_stock_level}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge
                              variant={isOut ? 'red' : isLow ? 'orange' : 'green'}
                              size="sm"
                            >
                              {isOut ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'IN STOCK'}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-zinc-300">
                            {formatCurrency(p.stock_quantity * p.selling_price, currency)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => openAdjustment(p)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-sm"
                            >
                              <ArrowUpDown className="w-3.5 h-3.5" />
                              <span>Adjust Stock</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Movements Log Tab */
        <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 overflow-hidden">
          {movements.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={History}
                title="No stock movements logged yet"
                description="Stock adjustments and sales will generate an immutable audit trail here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141414] border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Product</th>
                    <th className="py-3.5 px-4 text-center">Type</th>
                    <th className="py-3.5 px-4 text-center">Change</th>
                    <th className="py-3.5 px-4 text-center">Before → After</th>
                    <th className="py-3.5 px-4">Reason / Reference</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {movements.map((m) => {
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m.id} className="hover:bg-zinc-900/60 transition-colors">
                        <td className="py-3.5 px-4 text-zinc-400 whitespace-nowrap">
                          {formatDateTime(m.created_at)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          {m.product?.name || 'Product'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge
                            variant={
                              m.type === 'restock'
                                ? 'green'
                                : m.type === 'sale'
                                ? 'blue'
                                : m.type === 'damage'
                                ? 'red'
                                : 'orange'
                            }
                            size="sm"
                          >
                            {m.type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold">
                          <span
                            className={
                              isPositive ? 'text-emerald-400' : 'text-red-400'
                            }
                          >
                            {isPositive ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-zinc-300">
                          {m.quantity_before} → <span className="font-bold text-white">{m.quantity_after}</span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300 font-medium">
                          {m.reason}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {isAdminOrManager && (
                            <button
                              onClick={() => promptDeleteMovement(m)}
                              title="Delete Movement Record"
                              className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {selectedProduct && (
        <Modal
          isOpen={isAdjustModalOpen}
          onClose={() => setIsAdjustModalOpen(false)}
          title={`Adjust Stock — ${selectedProduct.name}`}
          subtitle={`Current In-Stock Count: ${selectedProduct.stock_quantity} units`}
          maxWidth="md"
        >
          <form onSubmit={handleStockAdjustment} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Adjustment Type *
              </label>
              <select
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value as StockMovementType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none"
              >
                <option value="restock">Restock (+ Add inventory from supplier)</option>
                <option value="adjustment">General Count Adjustment</option>
                <option value="damage">Damage / Breakage / Expired (- Deduct)</option>
                <option value="correction">Audit Correction (- Deduct / Align)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Quantity Units *
              </label>
              <input
                type="number"
                min="1"
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(e.target.value)}
                placeholder="e.g. 24"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none font-mono"
              />
            </div>

            {/* Calculated Preview Card */}
            <div className="bg-[#181818] p-3.5 rounded-xl border border-zinc-800 flex items-center justify-between text-xs font-mono">
              <div className="text-zinc-400">
                <span>Before: </span>
                <strong className="text-white">{selectedProduct.stock_quantity}</strong>
              </div>
              <div className="text-zinc-400">
                <span>Change: </span>
                <strong
                  className={
                    adjustType === 'restock' ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {adjustType === 'restock' ? `+${adjustQuantity}` : `-${adjustQuantity}`}
                </strong>
              </div>
              <div className="text-zinc-400">
                <span>Resulting: </span>
                <strong className="text-[#22C55E] text-sm">
                  {calculateResultingStock()}
                </strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Audit Reason *
              </label>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={2}
                placeholder="e.g. Received weekly crate batch #104 / Broken bottle in freezer"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50"
              >
                {saving ? 'Recording...' : 'Commit Stock Adjustment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Stock Movement Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setMovementToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDeleteMovement}
        title="Delete Stock Movement Record?"
        subtitle="Inventory Audit Trail Deletion"
        description={
          <div>
            <p className="text-zinc-300">
              Are you sure you want to delete this <strong className="text-white">{movementToDelete?.type.toUpperCase()}</strong> record for <strong className="text-white">"{movementToDelete?.product?.name || 'Product'}"</strong>?
            </p>
            <p className="text-zinc-400 mt-2">
              This action will physically remove this audit log entry from the database.
            </p>
            <label className="flex items-center gap-2 mt-4 text-xs text-zinc-300 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={reverseInventoryEffect}
                onChange={(e) => setReverseInventoryEffect(e.target.checked)}
                className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-950"
              />
              <span>Reverse inventory quantity impact on the product</span>
            </label>
          </div>
        }
        itemName={movementToDelete?.product?.name || 'Stock Movement'}
        itemType="Movement Record"
        itemDetails={
          movementToDelete
            ? [
                { label: 'Product', value: movementToDelete.product?.name || 'Product' },
                { label: 'Type', value: movementToDelete.type.toUpperCase() },
                { label: 'Quantity', value: `${movementToDelete.quantity > 0 ? '+' : ''}${movementToDelete.quantity}` },
                { label: 'Before → After', value: `${movementToDelete.quantity_before} → ${movementToDelete.quantity_after}` },
                { label: 'Reason', value: movementToDelete.reason },
                { label: 'Date', value: formatDateTime(movementToDelete.created_at) },
              ]
            : []
        }
        warningNotice="This will permanently delete this audit record from the database. This action cannot be undone."
        confirmLabel="DELETE RECORD"
        confirmVariant="danger"
        requiresConfirmationText={false}
        loading={isDeletingMovement}
        error={deleteError}
      />
    </div>
  );
};
