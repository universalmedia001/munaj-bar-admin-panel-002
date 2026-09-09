import { getSupabase } from '../lib/supabase';
import { Category, Product } from '../types';
import { SEED_CATEGORIES, SEED_PRODUCTS } from '../data/seedData';

const CACHE_KEY_CATEGORIES = 'munaj_cached_categories';
const CACHE_KEY_PRODUCTS = 'munaj_cached_products';

const getCachedCategories = (): Category[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_CATEGORIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return SEED_CATEGORIES;
};

const setCachedCategories = (categories: Category[]) => {
  try {
    localStorage.setItem(CACHE_KEY_CATEGORIES, JSON.stringify(categories));
  } catch {}
};

const getCachedProducts = (): Product[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PRODUCTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return SEED_PRODUCTS;
};

const setCachedProducts = (products: Product[]) => {
  try {
    localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(products));
  } catch {}
};

export const productService = {
  async getCategories(): Promise<Category[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.warn('Notice from Supabase categories query, using fallback cache:', error.message);
        return getCachedCategories();
      }

      if (data && data.length > 0) {
        setCachedCategories(data);
        return data;
      }
      return getCachedCategories();
    } catch (err) {
      console.warn('Network / fetch notice for categories, serving local cache:', err);
      return getCachedCategories();
    }
  },

  async getActiveProducts(): Promise<Product[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.warn('Notice from Supabase products query, using fallback cache:', error.message);
        return getCachedProducts();
      }

      if (data && data.length > 0) {
        setCachedProducts(data);
        return data;
      }
      return getCachedProducts();
    } catch (err) {
      console.warn('Network / fetch notice for products, serving local cache:', err);
      return getCachedProducts();
    }
  },

  subscribeToProducts(onChange: (updatedProduct: Product) => void) {
    try {
      const supabase = getSupabase();
      const channel = supabase
        .channel('products-inventory-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'products',
          },
          (payload) => {
            if (payload.new) {
              const updated = payload.new as Product;
              // Update local cache
              const current = getCachedProducts();
              const next = current.map((p) => (p.id === updated.id ? { ...p, ...updated } : p));
              setCachedProducts(next);
              onChange(updated);
            }
          }
        )
        .subscribe();

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch {}
      };
    } catch (err) {
      console.warn('Realtime subscription skipped:', err);
      return () => {};
    }
  },
};

