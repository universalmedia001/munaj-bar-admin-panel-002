import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Power,
  Layers,
  Check,
  AlertCircle,
  TrendingUp,
  Tag,
  DollarSign,
  Boxes,
  Eye,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { Product, Category, BusinessSettings } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { Modal } from '../common/Modal';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';
import { ImageUploadArea } from '../common/ImageUploadArea';
import {
  deleteOrArchiveProduct,
  bulkDeleteProducts,
  deleteCategory,
} from '../../services/deleteManagementService';
import {
  uploadProductImage,
  deleteStorageFile,
} from '../../services/storageService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface ProductsViewProps {
  products: Product[];
  categories: Category[];
  settings: BusinessSettings | null;
  onRefresh: () => void;
  loading: boolean;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  categories,
  settings,
  onRefresh,
  loading,
}) => {
  const { user } = useAuth();
  const currency = settings?.currency || 'NGN';

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Bulk Selection State
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Single Product Delete State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteProductModalOpen, setIsDeleteProductModalOpen] = useState(false);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [productDeleteError, setProductDeleteError] = useState<string | null>(null);

  // Bulk Delete Modal State
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  // Category Delete State
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [categoryDeleteError, setCategoryDeleteError] = useState<string | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Add / Edit Product Modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    category_id: '',
    selling_price: '',
    cost_price: '',
    stock_quantity: '0',
    minimum_stock_level: '5',
    image_url: '',
    is_active: true,
  });

  // Add / Edit Category Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryIsActive, setCategoryIsActive] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryTab, setCategoryTab] = useState<'create' | 'list'>('create');

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryIsActive(true);
    setCategoryError(null);
    setCategoryTab('create');
    setIsCategoryModalOpen(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryIsActive(cat.is_active);
    setCategoryError(null);
    setCategoryTab('create');
    setIsCategoryModalOpen(true);
  };

  const openManageCategories = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryIsActive(true);
    setCategoryError(null);
    setCategoryTab('list');
    setIsCategoryModalOpen(true);
  };

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openAddProduct = () => {
    setEditingProduct(null);
    setSelectedImageFile(null);
    setIsUploadingImage(false);
    setImageRemoved(false);
    setProductForm({
      name: '',
      description: '',
      category_id: categories[0]?.id || '',
      selling_price: '',
      cost_price: '',
      stock_quantity: '0',
      minimum_stock_level: '5',
      image_url: '',
      is_active: true,
    });
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setSelectedImageFile(null);
    setIsUploadingImage(false);
    setImageRemoved(false);
    setProductForm({
      name: p.name,
      description: p.description || '',
      category_id: p.category_id || '',
      selling_price: p.selling_price.toString(),
      cost_price: p.cost_price.toString(),
      stock_quantity: p.stock_quantity.toString(),
      minimum_stock_level: p.minimum_stock_level.toString(),
      image_url: p.image_url || '',
      is_active: p.is_active,
    });
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const promptDeleteProduct = (p: Product) => {
    setProductToDelete(p);
    setProductDeleteError(null);
    setIsDeleteProductModalOpen(true);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      setIsDeletingProduct(true);
      setProductDeleteError(null);
      const res = await deleteOrArchiveProduct(productToDelete.id, productToDelete.name, user?.id);

      if (!res.success) {
        setProductDeleteError(res.message);
        return;
      }

      showToast(res.message, res.action === 'archived' ? 'info' : 'success');
      setIsDeleteProductModalOpen(false);
      setProductToDelete(null);
      setSelectedProductIds((prev) => prev.filter((id) => id !== productToDelete.id));
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete product.';
      setProductDeleteError(msg);
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const promptDeleteCategory = (cat: Category) => {
    const prodsInCat = products.filter((p) => p.category_id === cat.id);
    if (prodsInCat.length > 0) {
      setCategoryError(
        `Cannot delete "${cat.name}": It contains ${prodsInCat.length} product(s). Please move or delete the products first.`
      );
      return;
    }
    setCategoryToDelete(cat);
    setCategoryDeleteError(null);
    setIsDeleteCategoryModalOpen(true);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      setIsDeletingCategory(true);
      setCategoryDeleteError(null);
      const res = await deleteCategory(categoryToDelete.id, categoryToDelete.name, user?.id);

      if (!res.success) {
        setCategoryDeleteError(res.message);
        return;
      }

      showToast(res.message, 'success');
      setIsDeleteCategoryModalOpen(false);
      setCategoryToDelete(null);
      if (selectedCategory === categoryToDelete.id) {
        setSelectedCategory('all');
      }
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete category.';
      setCategoryDeleteError(msg);
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const handleToggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirmBulkDelete = async () => {
    const prodsToDel = products.filter((p) => selectedProductIds.includes(p.id));
    if (prodsToDel.length === 0) return;

    try {
      setIsBulkDeleting(true);
      setBulkDeleteError(null);
      const res = await bulkDeleteProducts(
        prodsToDel.map((p) => ({ id: p.id, name: p.name })),
        user?.id
      );

      if (!res.success && res.failedCount === prodsToDel.length) {
        setBulkDeleteError(res.message);
        return;
      }

      showToast(res.message, 'success');
      setIsBulkDeleteModalOpen(false);
      setSelectedProductIds([]);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bulk deletion error.';
      setBulkDeleteError(msg);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      setFormError('Product name is required.');
      return;
    }
    const sellPriceRaw = parseFloat(productForm.selling_price);
    if (isNaN(sellPriceRaw) || sellPriceRaw < 0) {
      setFormError('Please enter a valid non-negative selling price.');
      return;
    }
    const MAX_PRICE = 9999999999.99;
    if (sellPriceRaw > MAX_PRICE) {
      setFormError(`Selling price cannot exceed ₦${MAX_PRICE.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
      return;
    }
    const sellPrice = Math.round(sellPriceRaw * 100) / 100;

    const costPriceRaw = parseFloat(productForm.cost_price || '0');
    if (isNaN(costPriceRaw) || costPriceRaw < 0) {
      setFormError('Cost price must be non-negative.');
      return;
    }
    if (costPriceRaw > MAX_PRICE) {
      setFormError(`Cost price cannot exceed ₦${MAX_PRICE.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
      return;
    }
    const costPrice = Math.round(costPriceRaw * 100) / 100;

    const stockQty = parseInt(productForm.stock_quantity || '0', 10);
    if (isNaN(stockQty) || stockQty < 0) {
      setFormError('Stock quantity must be a non-negative integer.');
      return;
    }
    const MAX_STOCK = 10000000;
    if (stockQty > MAX_STOCK) {
      setFormError(`Stock quantity cannot exceed ${MAX_STOCK.toLocaleString()} units.`);
      return;
    }

    const minStock = parseInt(productForm.minimum_stock_level || '5', 10);
    if (isNaN(minStock) || minStock < 0) {
      setFormError('Low stock threshold must be a non-negative integer.');
      return;
    }
    if (minStock > MAX_STOCK) {
      setFormError(`Low stock threshold cannot exceed ${MAX_STOCK.toLocaleString()} units.`);
      return;
    }

    const formatSupabaseError = (error: any, context: string): string => {
      console.error(`[ProductsView] ${context}:`, error);
      if (!error) return `${context}: Unknown error.`;

      if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('wrong key type') || error.details?.includes('decode the JWT')) {
        return `${context}: Your login session has expired or belongs to a previous Supabase project. Please sign out and log back in.`;
      }

      if (error.code === 'PGRST205' || error.message?.includes('Could not find the table') || error.message?.includes('schema cache')) {
        return `${context}: Database tables have not been created yet in this new Supabase project. Please run the SQL migration (found in supabase/migration.sql) in your Supabase SQL Editor.`;
      }

      if (error.code === '22003' || error.message?.includes('numeric field overflow')) {
        return `${context}: A numeric value (Price or Stock) exceeded the database maximum limit (₦9,999,999,999.99). Please enter a valid smaller amount.`;
      }

      const message = error.message || (typeof error === 'string' ? error : 'Unknown error');
      const code = error.code ? `[Code: ${error.code}]` : '';
      const details = error.details ? `Details: ${error.details}` : '';
      const hint = error.hint ? `Hint: ${error.hint}` : '';

      const parts = [
        code ? `${code} ${message}` : message,
        details,
        hint,
      ].filter(Boolean);

      return `${context}: ${parts.join(' — ')}`;
    };

    try {
      setSaving(true);
      setFormError(null);

      // Determine final image URL
      let finalImageUrl: string | null = productForm.image_url.trim() || null;
      let previousImageUrl: string | null = editingProduct?.image_url || null;

      if (selectedImageFile) {
        setIsUploadingImage(true);
        const uploadResult = await uploadProductImage(
          selectedImageFile,
          editingProduct?.id || (productForm.name ? productForm.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : undefined)
        );

        if (!uploadResult.success) {
          setFormError(uploadResult.error || 'Image upload failed. Please check your connection and try again.');
          setSaving(false);
          setIsUploadingImage(false);
          return;
        }
        finalImageUrl = uploadResult.url;
      } else if (imageRemoved) {
        finalImageUrl = null;
      }

      if (editingProduct) {
        // 1. Update product in public.products
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: productForm.name.trim(),
            description: productForm.description.trim() || null,
            category_id: productForm.category_id || null,
            selling_price: sellPrice,
            cost_price: costPrice,
            stock_quantity: stockQty,
            minimum_stock_level: minStock,
            image_url: finalImageUrl,
            is_active: productForm.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProduct.id);

        if (updateError) {
          const formatted = formatSupabaseError(updateError, 'Failed to update product');
          setFormError(formatted);
          return;
        }

        // Clean up previous image file if it was replaced or removed
        if (previousImageUrl && previousImageUrl !== finalImageUrl) {
          deleteStorageFile(previousImageUrl).catch((err) =>
            console.warn('[ProductsView] Old image cleanup note:', err)
          );
        }

        // 2. Log activity in public.activity_logs (safe non-blocking)
        try {
          const { error: logError } = await supabase.from('activity_logs').insert({
            action: 'product_updated',
            description: `Updated product "${productForm.name}" (Price: ${formatCurrency(sellPrice, currency)})`,
            metadata: { product_id: editingProduct.id, price: sellPrice, has_image: !!finalImageUrl },
          });

          if (logError) {
            if (logError.code === '42501' || logError.message?.includes('row-level security')) {
              console.info('[ProductsView] Activity log insert restricted by RLS policy.');
            } else {
              console.warn('[ProductsView] Activity log notice:', logError.message);
            }
          }
        } catch (logErr) {
          console.warn('[ProductsView] Activity log exception note:', logErr);
        }
      } else {
        // 1. Insert product in public.products
        const { data: newProd, error: insertError } = await supabase
          .from('products')
          .insert({
            name: productForm.name.trim(),
            description: productForm.description.trim() || null,
            category_id: productForm.category_id || null,
            selling_price: sellPrice,
            cost_price: costPrice,
            stock_quantity: stockQty,
            minimum_stock_level: minStock,
            image_url: finalImageUrl,
            is_active: productForm.is_active,
          })
          .select()
          .single();

        if (insertError) {
          const formatted = formatSupabaseError(insertError, 'Failed to create product in products table');
          setFormError(formatted);
          return;
        }

        // 2. If initial stock was provided, record initial stock movement (supports inventory_movements & stock_movements)
        if (newProd && stockQty > 0) {
          const movePayload = {
            product_id: newProd.id,
            type: 'restock',
            quantity: stockQty,
            quantity_before: 0,
            quantity_after: stockQty,
            reason: 'Initial stock creation',
          };

          try {
            // First attempt: live Supabase table 'inventory_movements'
            let { error: stockMoveError } = await supabase
              .from('inventory_movements' as any)
              .insert(movePayload);

            // Fallback attempt: 'stock_movements' if schema cache doesn't find inventory_movements
            if (stockMoveError && (stockMoveError.code === 'PGRST205' || stockMoveError.message?.includes('inventory_movements'))) {
              const res2 = await supabase.from('stock_movements' as any).insert(movePayload);
              stockMoveError = res2.error;
            }

            if (stockMoveError) {
              if (stockMoveError.code === '42501' || stockMoveError.message?.includes('row-level security')) {
                console.info('[ProductsView] Initial stock movement log restricted by RLS policy.');
              } else {
                console.warn('[ProductsView] Initial stock movement recording note:', stockMoveError.message);
              }
            }
          } catch (moveEx) {
            console.warn('[ProductsView] Initial stock movement exception note:', moveEx);
          }
        }

        // 3. Log activity in public.activity_logs (safe non-blocking)
        try {
          const { error: logError } = await supabase.from('activity_logs').insert({
            action: 'product_created',
            description: `Created new product "${productForm.name}" with opening stock of ${stockQty}`,
            metadata: { product_id: newProd?.id || null, has_image: !!finalImageUrl },
          });

          if (logError) {
            if (logError.code === '42501' || logError.message?.includes('row-level security')) {
              console.info('[ProductsView] Activity log insert restricted by RLS policy.');
            } else {
              console.warn('[ProductsView] Activity log notice:', logError.message);
            }
          }
        } catch (logErr) {
          console.warn('[ProductsView] Activity log exception note:', logErr);
        }
      }

      setIsProductModalOpen(false);
      onRefresh();
    } catch (err: unknown) {
      const formatted = formatSupabaseError(err, 'Failed to save product');
      setFormError(formatted);
    } finally {
      setSaving(false);
      setIsUploadingImage(false);
    }
  };

  const toggleProductStatus = async (p: Product) => {
    try {
      const newStatus = !p.is_active;
      const { error } = await supabase
        .from('products')
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', p.id);

      if (error) throw error;

      try {
        await supabase.from('activity_logs').insert({
          action: newStatus ? 'product_activated' : 'product_deactivated',
          description: `${newStatus ? 'Activated' : 'Deactivated'} product "${p.name}"`,
          metadata: { product_id: p.id },
        });
      } catch (logErr) {
        console.warn('[ProductsView] Activity log toggle note:', logErr);
      }

      onRefresh();
    } catch (err) {
      console.error('Error toggling product status:', err);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (categorySaving) return;

    const cleanName = categoryName.trim();
    if (!cleanName) {
      setCategoryError('Category name is required.');
      return;
    }

    const formatCategoryError = (errMessage: string): string => {
      const lower = errMessage.toLowerCase();
      if (
        lower.includes('duplicate') ||
        lower.includes('unique') ||
        lower.includes('already exists') ||
        lower.includes('23505')
      ) {
        return 'Category already exists.';
      }
      if (
        lower.includes('row-level security') ||
        lower.includes('violates row-level security') ||
        lower.includes('42501') ||
        lower.includes('permission denied')
      ) {
        return 'Permission denied by Row-Level Security. Please ensure your account has an active admin or manager role in Supabase.';
      }
      return errMessage;
    };

    // 1. Client-side duplicate check (case-insensitive)
    const existsLocally = categories.some((c) => {
      if (editingCategory && c.id === editingCategory.id) return false;
      return c.name.trim().toLowerCase() === cleanName.toLowerCase();
    });

    if (existsLocally) {
      setCategoryError('Category already exists.');
      return;
    }

    try {
      setCategorySaving(true);
      setCategoryError(null);

      // 2. Pre-flight database check
      let query = supabase.from('categories').select('id, name').ilike('name', cleanName);
      if (editingCategory) {
        query = query.neq('id', editingCategory.id);
      }
      const { data: dbDuplicate } = await query.maybeSingle();

      if (dbDuplicate) {
        setCategoryError('Category already exists.');
        setCategorySaving(false);
        return;
      }

      if (editingCategory) {
        // Edit existing category
        const { error } = await supabase
          .from('categories')
          .update({
            name: cleanName,
            is_active: categoryIsActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCategory.id);

        if (error) {
          setCategoryError(formatCategoryError(error.message));
          setCategorySaving(false);
          return;
        }

        try {
          await supabase.from('activity_logs').insert({
            action: 'category_updated',
            description: `Updated drink category "${cleanName}" (${categoryIsActive ? 'Active' : 'Inactive'})`,
            metadata: { category_id: editingCategory.id },
          });
        } catch {
          // Non-blocking log
        }
      } else {
        // Create new unique category
        const { data: newCat, error } = await supabase
          .from('categories')
          .insert({
            name: cleanName,
            is_active: categoryIsActive,
          })
          .select()
          .single();

        if (error) {
          setCategoryError(formatCategoryError(error.message));
          setCategorySaving(false);
          return;
        }

        try {
          await supabase.from('activity_logs').insert({
            action: 'category_created',
            description: `Added drink category "${cleanName}"`,
            metadata: { category_id: newCat?.id },
          });
        } catch {
          // Non-blocking log
        }
      }

      setCategoryName('');
      setEditingCategory(null);
      setIsCategoryModalOpen(false);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating category.';
      setCategoryError(formatCategoryError(msg));
    } finally {
      setCategorySaving(false);
    }
  };

  // Filter Logic
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.category_id !== selectedCategory) return false;
      if (statusFilter === 'active' && !p.is_active) return false;
      if (statusFilter === 'inactive' && p.is_active) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [products, selectedCategory, statusFilter, search]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
            toastMessage.type === 'error'
              ? 'bg-red-950/80 border-red-800 text-red-200'
              : toastMessage.type === 'info'
              ? 'bg-blue-950/80 border-blue-800 text-blue-200'
              : 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : toastMessage.type === 'info' ? (
              <AlertTriangle className="w-4 h-4 text-blue-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="font-medium">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-zinc-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] p-5 rounded-2xl border border-zinc-800/80">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            Bar Products & Pricing
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Maintain the drink catalog, retail selling prices, cost baselines, and active inventory status.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={openManageCategories}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Manage Categories</span>
          </button>
          <button
            onClick={openAddProduct}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Category Tabs & Filter Controls */}
      <div className="bg-[#111111] p-4 rounded-2xl border border-zinc-800/80 space-y-3">
        {/* Category horizontal scroll list */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-[#22C55E] text-black font-bold shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            All Products ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.category_id === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <div
                key={cat.id}
                className={`inline-flex items-center rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#22C55E] text-black font-bold shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <button
                  onClick={() => setSelectedCategory(cat.id)}
                  className="px-3.5 py-1.5 flex items-center gap-1.5"
                >
                  <span>{cat.name}</span>
                  <span className={`text-[11px] ${isSelected ? 'text-black/80' : 'text-zinc-500'}`}>({count})</span>
                </button>
                <button
                  type="button"
                  title={`Edit category ${cat.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditCategory(cat);
                  }}
                  className={`pr-2.5 pl-0.5 py-1.5 transition-colors ${
                    isSelected ? 'text-black/70 hover:text-black' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <button
            onClick={openAddCategory}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-[#22C55E] bg-zinc-900/80 border border-dashed border-zinc-700 hover:border-[#22C55E] transition-colors flex items-center gap-1 whitespace-nowrap"
          >
            <Plus className="w-3 h-3" />
            <span>New Category</span>
          </button>
        </div>

        {/* Search & Status filter */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-zinc-800/60">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by brand or name..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs placeholder:text-zinc-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white outline-none focus:border-[#22C55E]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only (POS Visible)</option>
              <option value="inactive">Deactivated (Hidden)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {selectedProductIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-emerald-500/40 text-xs shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-[#22C55E]/20 text-[#22C55E] flex items-center justify-center font-bold font-mono text-xs">
              {selectedProductIds.length}
            </span>
            <span className="font-bold text-white">
              {selectedProductIds.length} product{selectedProductIds.length > 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedProductIds([])}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl transition-colors"
            >
              Deselect All
            </button>
            <button
              onClick={() => {
                setBulkDeleteError(null);
                setIsBulkDeleteModalOpen(true);
              }}
              className="px-3.5 py-1.5 text-xs font-bold text-red-200 hover:text-white bg-red-950/80 hover:bg-red-900 border border-red-800/80 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedProductIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-[#111111] rounded-2xl border border-zinc-800/80 overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Package}
              title="No products found"
              description="Create your first bar product or adjust your filters above."
              actionLabel="Add Product Now"
              onAction={openAddProduct}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141414] border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredProducts.length > 0 &&
                        filteredProducts.every((p) => selectedProductIds.includes(p.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          const currentFilteredIds = filteredProducts.map((p) => p.id);
                          setSelectedProductIds((prev) => Array.from(new Set([...prev, ...currentFilteredIds])));
                        } else {
                          const currentFilteredSet = new Set(filteredProducts.map((p) => p.id));
                          setSelectedProductIds((prev) => prev.filter((id) => !currentFilteredSet.has(id)));
                        }
                      }}
                      className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
                      title="Select all filtered products"
                    />
                  </th>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Selling Price</th>
                  <th className="py-3.5 px-4 text-right">Cost Price</th>
                  <th className="py-3.5 px-4 text-center">Stock Level</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredProducts.map((product) => {
                  const isLow = product.stock_quantity > 0 && product.stock_quantity <= product.minimum_stock_level;
                  const isOut = product.stock_quantity <= 0;
                  const isSelected = selectedProductIds.includes(product.id);

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-zinc-900/60 transition-colors group ${
                        isSelected ? 'bg-emerald-950/20' : ''
                      }`}
                    >
                      <td className="py-3.5 pl-4 pr-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectProduct(product.id)}
                          className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 overflow-hidden shrink-0 relative">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                  const fb = e.currentTarget.parentElement?.querySelector('.no-img-fb');
                                  if (fb) (fb as HTMLElement).classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div
                              className={`no-img-fb w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 ${
                                product.image_url ? 'hidden' : ''
                              }`}
                              title="No Image"
                            >
                              <Package className="w-4 h-4 text-zinc-600" />
                            </div>
                          </div>
                          <div>
                            <p className="font-bold text-white text-xs">{product.name}</p>
                            {product.description && (
                              <p className="text-[11px] text-zinc-500 truncate max-w-xs">{product.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-zinc-300">
                        {categoryMap.get(product.category_id || '') || 'Uncategorized'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white text-xs">
                        {formatCurrency(product.selling_price, currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-zinc-400">
                        {formatCurrency(product.cost_price, currency)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 font-mono">
                          <span
                            className={`font-bold ${
                              isOut
                                ? 'text-red-400'
                                : isLow
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {product.stock_quantity}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            (min: {product.minimum_stock_level})
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant={product.is_active ? 'green' : 'zinc'} size="sm">
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => toggleProductStatus(product)}
                            title={product.is_active ? 'Deactivate Product' : 'Activate Product'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              product.is_active
                                ? 'text-emerald-400 hover:bg-emerald-950/40'
                                : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditProduct(product)}
                            title="Edit Product"
                            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => promptDeleteProduct(product)}
                            title="Delete / Archive Product"
                            className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-950/40 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? `Edit ${editingProduct.name}` : 'Add New Bar Product'}
        subtitle="Configures pricing and inventory parameters for Worker POS"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Product Name *
              </label>
              <input
                type="text"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="e.g. Heineken Lager 330ml / Jameson Black Barrel"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Category *
              </label>
              <select
                value={productForm.category_id}
                onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Selling Price (₦) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="9999999999.99"
                value={productForm.selling_price}
                onChange={(e) => setProductForm({ ...productForm, selling_price: e.target.value })}
                placeholder="e.g. 2500"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Cost Price (₦)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="9999999999.99"
                value={productForm.cost_price}
                onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
                placeholder="e.g. 1800"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {editingProduct ? 'Current Stock Qty' : 'Opening Stock Qty'} *
              </label>
              <input
                type="number"
                min="0"
                max="10000000"
                value={productForm.stock_quantity}
                onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                placeholder="e.g. 50"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Low Stock Threshold (Alert level)
              </label>
              <input
                type="number"
                min="0"
                max="10000000"
                value={productForm.minimum_stock_level}
                onChange={(e) => setProductForm({ ...productForm, minimum_stock_level: e.target.value })}
                placeholder="e.g. 5"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <ImageUploadArea
                label="Product Image"
                sublabel="Upload an image of this product"
                helperText="JPG, PNG or WEBP • Maximum 5MB"
                currentImageUrl={
                  imageRemoved
                    ? null
                    : selectedImageFile
                    ? URL.createObjectURL(selectedImageFile)
                    : productForm.image_url || null
                }
                onImageSelected={(file) => {
                  setSelectedImageFile(file);
                  setImageRemoved(false);
                  setFormError(null);
                }}
                onImageRemoved={() => {
                  setSelectedImageFile(null);
                  setImageRemoved(true);
                  setProductForm((prev) => ({ ...prev, image_url: '' }));
                }}
                isUploading={isUploadingImage}
                uploadProgressText="Uploading image..."
                disabled={saving || isUploadingImage}
                previewHeight="h-44"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Description / Notes
              </label>
              <textarea
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                rows={2}
                placeholder="Tasting notes, volume, or special serving notes..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none resize-none"
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_active_check"
                checked={productForm.is_active}
                onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900"
              />
              <label htmlFor="is_active_check" className="text-xs font-medium text-zinc-300 cursor-pointer">
                Product is Active (Visible on Worker POS terminals for selling)
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            {editingProduct ? (
              <button
                type="button"
                onClick={() => {
                  const prod = editingProduct;
                  setIsProductModalOpen(false);
                  promptDeleteProduct(prod);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Product</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || isUploadingImage}
                className="px-5 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50 flex items-center gap-2"
              >
                {isUploadingImage ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Uploading Image...</span>
                  </>
                ) : saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : editingProduct ? (
                  'Save Changes'
                ) : (
                  'Create Product'
                )}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Category Management / Creation / Edit Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
          setCategoryError(null);
        }}
        title={editingCategory ? 'Edit Drink Category' : 'Drink Categories'}
        subtitle={
          editingCategory
            ? `Update settings and active status for "${editingCategory.name}"`
            : 'Organize catalog items into discoverable menu groupings'
        }
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Sub Navigation Tabs */}
          {!editingCategory && (
            <div className="flex border-b border-zinc-800 pb-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategoryTab('create');
                  setCategoryError(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  categoryTab === 'create'
                    ? 'bg-[#22C55E] text-black font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Category</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoryTab('list');
                  setCategoryError(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  categoryTab === 'list'
                    ? 'bg-[#22C55E] text-black font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All Categories ({categories.length})</span>
              </button>
            </div>
          )}

          {/* Error Banner */}
          {categoryError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{categoryError}</div>
            </div>
          )}

          {categoryTab === 'create' || editingCategory ? (
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => {
                    setCategoryName(e.target.value);
                    if (categoryError) setCategoryError(null);
                  }}
                  placeholder="e.g. Energy Drinks, Cocktails, Cognac, Spirits"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="category_active_check"
                  checked={categoryIsActive}
                  onChange={(e) => setCategoryIsActive(e.target.checked)}
                  className="rounded border-zinc-700 text-[#22C55E] focus:ring-[#22C55E] bg-zinc-900"
                />
                <label htmlFor="category_active_check" className="text-xs font-medium text-zinc-300 cursor-pointer">
                  Category is Active (Visible on POS category filters)
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-800/80">
                {editingCategory ? (
                  <button
                    type="button"
                    onClick={() => {
                      const cat = editingCategory;
                      setIsCategoryModalOpen(false);
                      promptDeleteCategory(cat);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-xl transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Category</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryName('');
                        setCategoryTab('list');
                        setCategoryError(null);
                      }}
                      className="px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800/80 rounded-xl"
                    >
                      Back to List
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryModalOpen(false);
                      setEditingCategory(null);
                      setCategoryError(null);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={categorySaving || !categoryName.trim()}
                    className="px-4 py-2 text-xs font-bold text-black bg-[#22C55E] hover:bg-[#1ea750] rounded-xl transition-all disabled:opacity-50"
                  >
                    {categorySaving
                      ? 'Saving...'
                      : editingCategory
                      ? 'Update Category'
                      : 'Create Category'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {categories.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-500">
                  No categories found. Click &quot;Add New Category&quot; to create one.
                </div>
              ) : (
                categories.map((cat) => {
                  const productCount = products.filter((p) => p.category_id === cat.id).length;
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                        <div>
                          <p className="text-xs font-bold text-white">{cat.name}</p>
                          <p className="text-[11px] text-zinc-400">
                            {productCount} product{productCount !== 1 ? 's' : ''} &bull;{' '}
                            <span className={cat.is_active ? 'text-emerald-400' : 'text-zinc-500'}>
                              {cat.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditCategory(cat)}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => promptDeleteCategory(cat)}
                          title="Delete Category"
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-950/60 text-zinc-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Single Product Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteProductModalOpen}
        onClose={() => {
          setIsDeleteProductModalOpen(false);
          setProductToDelete(null);
          setProductDeleteError(null);
        }}
        onConfirm={handleConfirmDeleteProduct}
        title="Delete Product?"
        subtitle="Catalog inventory and POS visibility management"
        description={
          <div>
            <p className="text-zinc-300">
              Are you sure you want to delete <strong className="text-white">"{productToDelete?.name}"</strong>?
            </p>
            <p className="text-zinc-400 mt-2">
              This action will permanently delete this product from the database. Historical sales and receipt logs will remain fully preserved with their item names and prices.
            </p>
          </div>
        }
        itemName={productToDelete?.name}
        itemType="Bar Product"
        itemDetails={
          productToDelete
            ? [
                { label: 'Selling Price', value: formatCurrency(productToDelete.selling_price, currency) },
                { label: 'Cost Price', value: formatCurrency(productToDelete.cost_price, currency) },
                { label: 'Current Stock', value: `${productToDelete.stock_quantity} units` },
                { label: 'Category', value: categoryMap.get(productToDelete.category_id || '') || 'None' },
              ]
            : []
        }
        confirmLabel="Confirm Delete Product"
        confirmVariant="danger"
        loading={isDeletingProduct}
        error={productDeleteError}
      />

      {/* Bulk Delete Products Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => {
          setIsBulkDeleteModalOpen(false);
          setBulkDeleteError(null);
        }}
        onConfirm={handleConfirmBulkDelete}
        title={`Delete ${selectedProductIds.length} Selected Products?`}
        subtitle="Batch removal and safe archiving of inventory items"
        description={
          <div>
            <p className="text-zinc-300">
              You are about to delete <strong className="text-white">{selectedProductIds.length}</strong> selected products.
            </p>
            <p className="text-zinc-400 mt-2">
              Products with existing sales transactions will be <strong className="text-amber-300">safely archived & deactivated</strong> to preserve audit histories, while unreferenced products will be permanently removed.
            </p>
          </div>
        }
        itemType="Bulk Selection"
        itemDetails={[
          { label: 'Selected Count', value: `${selectedProductIds.length} items` },
        ]}
        warningNotice="This bulk action will modify active menu listings immediately."
        confirmLabel={`Delete ${selectedProductIds.length} Products`}
        confirmVariant="danger"
        requiresConfirmationText={selectedProductIds.length >= 5}
        confirmationKeyword="DELETE"
        loading={isBulkDeleting}
        error={bulkDeleteError}
      />

      {/* Delete Category Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteCategoryModalOpen}
        onClose={() => {
          setIsDeleteCategoryModalOpen(false);
          setCategoryToDelete(null);
          setCategoryDeleteError(null);
        }}
        onConfirm={handleConfirmDeleteCategory}
        title="Delete Drink Category?"
        subtitle="Remove category grouping from product catalog"
        description={
          <div>
            <p className="text-zinc-300">
              Are you sure you want to delete category <strong className="text-white">"{categoryToDelete?.name}"</strong>?
            </p>
          </div>
        }
        itemName={categoryToDelete?.name}
        itemType="Drink Category"
        confirmLabel="Delete Category"
        confirmVariant="danger"
        loading={isDeletingCategory}
        error={categoryDeleteError}
      />
    </div>
  );
};
