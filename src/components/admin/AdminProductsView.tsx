import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  ToggleLeft, 
  ToggleRight, 
  Boxes, 
  Tag, 
  FolderPlus, 
  Check, 
  X, 
  RefreshCw,
  AlertTriangle,
  PackageCheck,
  PackageX,
  Trash2
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Category, Product } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface AdminProductsViewProps {
  onOpenStockAdjustModal: (product: Product) => void;
}

export const AdminProductsView: React.FC<AdminProductsViewProps> = ({
  onOpenStockAdjustModal,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // New Category Input
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [isSavingCategory, setIsSavingCategory] = useState<boolean>(false);

  // Form State for Add / Edit Product
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    selling_price: '',
    cost_price: '',
    stock_quantity: '',
    minimum_stock_level: '5',
    image_url: '',
    is_active: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [prods, cats] = await Promise.all([
        adminService.getAdminProducts({
          categoryId: selectedCategory,
          status: selectedStatus,
          searchQuery,
          stockFilter,
        }),
        adminService.getAllCategories(),
      ]);

      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error('Error loading products/categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedStatus, stockFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      category_id: categories.length > 0 ? categories[0].id : '',
      selling_price: '',
      cost_price: '',
      stock_quantity: '0',
      minimum_stock_level: '5',
      image_url: '',
      is_active: true,
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      description: p.description || '',
      category_id: p.category_id || '',
      selling_price: String(p.selling_price),
      cost_price: String(p.cost_price || 0),
      stock_quantity: String(p.stock_quantity),
      minimum_stock_level: String(p.minimum_stock_level),
      image_url: p.image_url || '',
      is_active: p.is_active,
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleToggleActive = async (p: Product) => {
    try {
      await adminService.toggleProductActive(p.id, !p.is_active);
      loadData();
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Product name is required.');
      return;
    }

    const sellingPrice = Number(formData.selling_price);
    const costPrice = Number(formData.cost_price || 0);
    const stockQty = Number(formData.stock_quantity || 0);
    const minStock = Number(formData.minimum_stock_level || 5);

    if (isNaN(sellingPrice) || sellingPrice < 0) {
      setFormError('Selling price must be 0 or greater.');
      return;
    }
    if (isNaN(costPrice) || costPrice < 0) {
      setFormError('Cost price must be 0 or greater.');
      return;
    }
    if (isNaN(stockQty) || stockQty < 0) {
      setFormError('Stock quantity cannot be negative.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingProduct) {
        // Edit
        await adminService.updateProduct(editingProduct.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category_id: formData.category_id || null,
          selling_price: sellingPrice,
          cost_price: costPrice,
          minimum_stock_level: minStock,
          image_url: formData.image_url.trim() || null,
          is_active: formData.is_active,
        });
      } else {
        // Create
        await adminService.createProduct({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category_id: formData.category_id || null,
          selling_price: sellingPrice,
          cost_price: costPrice,
          stock_quantity: stockQty,
          minimum_stock_level: minStock,
          image_url: formData.image_url.trim() || null,
          is_active: formData.is_active,
        });
      }

      setIsAddModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      setIsSavingCategory(true);
      await adminService.createCategory(newCategoryName);
      setNewCategoryName('');
      const updatedCats = await adminService.getAllCategories();
      setCategories(updatedCats);
    } catch (err: any) {
      alert('Error creating category: ' + err.message);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleToggleCategoryActive = async (cat: Category) => {
    try {
      await adminService.updateCategory(cat.id, cat.name, !cat.is_active);
      const updatedCats = await adminService.getAllCategories();
      setCategories(updatedCats);
      loadData();
    } catch (err: any) {
      alert('Error updating category: ' + err.message);
    }
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      setIsDeleting(true);
      await adminService.deleteProduct(productToDelete.id);
      setProductToDelete(null);
      loadData();
    } catch (err: any) {
      alert('Error deleting product: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      setIsDeleting(true);
      await adminService.deleteCategory(categoryToDelete.id);
      setCategoryToDelete(null);
      const updatedCats = await adminService.getAllCategories();
      setCategories(updatedCats);
      loadData();
    } catch (err: any) {
      alert('Error deleting category: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] border border-[#222222] p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Package className="w-5 h-5 text-green-400" />
            <span>Product Catalog & Bar Menu</span>
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Total {products.length} products listed • Changes sync instantly with Worker POS terminals
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-xs font-semibold text-white transition-colors"
          >
            <Tag className="w-3.5 h-3.5 text-blue-400" />
            <span>Manage Categories</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-black text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#111111] border border-[#222222] p-4 rounded-2xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white placeholder-[#71717A] focus:outline-hidden focus:border-green-500"
            />
          </form>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {!c.is_active && '(Inactive)'}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
          >
            <option value="all">All Statuses (Active & Inactive)</option>
            <option value="active">Active on POS</option>
            <option value="inactive">Deactivated (Hidden)</option>
          </select>

          {/* Stock Level Filter */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
          >
            <option value="all">All Stock Levels</option>
            <option value="low">Low Stock Only</option>
            <option value="out">Out of Stock Only</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#222222] bg-[#141414] text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider">
                <th className="py-3.5 px-4">Product</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-right">Selling Price</th>
                <th className="py-3.5 px-4 text-right">Cost Price</th>
                <th className="py-3.5 px-4 text-center">Margin %</th>
                <th className="py-3.5 px-4 text-center">Stock Level</th>
                <th className="py-3.5 px-4 text-center">POS Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#1A1A1A] text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#71717A]">
                    <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading product catalog...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#71717A]">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No products found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const cat = categories.find((c) => c.id === p.category_id);
                  const margin = p.selling_price > 0 && p.cost_price > 0
                    ? Math.round(((p.selling_price - p.cost_price) / p.selling_price) * 100)
                    : 0;

                  const isLow = p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock_level;
                  const isOut = p.stock_quantity <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-[#161616] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-cover bg-[#1A1A1A] border border-[#2A2A2A] shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-xs font-bold text-[#71717A] shrink-0">
                              {p.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate max-w-[200px]">
                              {p.name}
                            </p>
                            {p.description && (
                              <p className="text-[11px] text-[#71717A] truncate max-w-[200px]">
                                {p.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-[#A1A1AA]">
                        <span className="px-2 py-0.5 rounded-md bg-[#1A1A1A] border border-[#262626] text-[11px]">
                          {cat?.name || 'Uncategorized'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-white">
                        {formatCurrency(p.selling_price)}
                      </td>

                      <td className="py-3 px-4 text-right text-[#A1A1AA]">
                        {p.cost_price > 0 ? formatCurrency(p.cost_price) : '—'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {margin > 0 ? (
                          <span className="text-[11px] font-bold text-green-400">
                            {margin}%
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#71717A]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          isOut
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : isLow
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-green-500/10 text-green-400 border border-green-500/20'
                        }`}>
                          {isOut ? '0 (Out)' : `${p.stock_quantity} units`}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                            p.is_active
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                          }`}
                        >
                          {p.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenStockAdjustModal(p)}
                            className="p-1.5 rounded-lg bg-[#1A1A1A] hover:bg-amber-500/20 hover:text-amber-400 text-[#A1A1AA] transition-colors"
                            title="Adjust Stock Quantity"
                          >
                            <Boxes className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg bg-[#1A1A1A] hover:bg-blue-500/20 hover:text-blue-400 text-[#A1A1AA] transition-colors"
                            title="Edit Product Details"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setProductToDelete(p)}
                            className="p-1.5 rounded-lg bg-[#1A1A1A] hover:bg-red-500/20 hover:text-red-400 text-[#A1A1AA] transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-[#262626] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 lg:p-5 border-b border-[#222222] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-green-400" />
                <span>{editingProduct ? 'Edit Product' : 'Add New Product to Bar'}</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-[#A1A1AA] hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
                  {formError}
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                  Product Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Heineken (Bottle) 330ml"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
                />
              </div>

              {/* Category & Image URL Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
                  >
                    <option value="">None / Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">Image URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
                  />
                </div>
              </div>

              {/* Prices: Selling Price & Cost Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                    Selling Price (₦) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    required
                    placeholder="e.g. 2500"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white font-bold focus:outline-hidden focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">Cost Price (₦)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="e.g. 1800"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
                  />
                </div>
              </div>

              {/* Stock: Opening Stock & Minimum Stock Threshold */}
              <div className="grid grid-cols-2 gap-3">
                {!editingProduct && (
                  <div>
                    <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                      Opening Stock (Units)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                      className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">
                    Min Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minimum_stock_level}
                    onChange={(e) => setFormData({ ...formData, minimum_stock_level: e.target.value })}
                    className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[#E4E4E7] mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Notes on bottle size, serving style..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#181818] border border-[#262626]">
                <div>
                  <p className="text-xs font-bold text-white">Active for Sales</p>
                  <p className="text-[11px] text-[#A1A1AA]">When active, this product appears immediately in the Worker POS.</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 accent-green-500 rounded"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-xs font-semibold text-[#E4E4E7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-black text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-[#262626] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 lg:p-5 border-b border-[#222222] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-400" />
                <span>Bar Product Categories</span>
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 text-[#A1A1AA] hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Create Category Form */}
              <form onSubmit={handleCreateCategory} className="flex gap-2">
                <input
                  type="text"
                  placeholder="New category name (e.g. Cocktails)..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-white focus:outline-hidden focus:border-green-500"
                />
                <button
                  type="submit"
                  disabled={isSavingCategory || !newCategoryName.trim()}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-black font-bold text-xs rounded-xl disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </form>

              {/* Categories List */}
              <div className="divide-y divide-[#1A1A1A] max-h-64 overflow-y-auto custom-scrollbar border border-[#222222] rounded-xl bg-[#141414]">
                {categories.map((c) => (
                  <div key={c.id} className="p-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      {c.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleCategoryActive(c)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                          c.is_active
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {c.is_active ? 'Active' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => setCategoryToDelete(c)}
                        className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Product Safety Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-red-500/30 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Bar Product?</h3>
                <p className="text-xs text-zinc-400">This action will remove the product from active bar menu.</p>
              </div>
            </div>
            <div className="bg-[#181818] border border-[#262626] p-3 rounded-xl">
              <p className="text-xs font-semibold text-white">{productToDelete.name}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Current stock: <span className="text-white font-mono">{productToDelete.stock_quantity} units</span> • Price: <span className="text-green-400">{formatCurrency(productToDelete.selling_price)}</span>
              </p>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Historical sales receipts referencing this product will be safely preserved. If sales constraints exist, the product will be safely archived.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222222]">
              <button
                onClick={() => setProductToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-xs font-semibold text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteProduct}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Safety Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-red-500/30 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Category?</h3>
                <p className="text-xs text-zinc-400">Remove "{categoryToDelete.name}" category.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222222]">
              <button
                onClick={() => setCategoryToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-xs font-semibold text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteCategory}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
