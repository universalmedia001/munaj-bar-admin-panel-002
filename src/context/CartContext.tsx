import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem, PaymentMethod, Product } from '../types';

interface CartContextType {
  items: CartItem[];
  paymentMethod: PaymentMethod;
  discount: number;
  subtotal: number;
  total: number;
  totalQuantity: number;
  addItem: (product: Product, quantity?: number) => { success: boolean; message?: string };
  updateQuantity: (productId: string, quantity: number) => { success: boolean; message?: string };
  removeItem: (productId: string) => void;
  clearCart: () => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setDiscount: (discount: number) => void;
  getItemQuantity: (productId: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState<number>(0);

  const getItemQuantity = (productId: string): number => {
    const item = items.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  const addItem = (product: Product, quantity: number = 1): { success: boolean; message?: string } => {
    if (product.stock_quantity <= 0) {
      return { success: false, message: `This product is currently out of stock: ${product.name}` };
    }

    const currentQty = getItemQuantity(product.id);
    const targetQty = currentQty + quantity;

    if (targetQty > product.stock_quantity) {
      return {
        success: false,
        message: `Only ${product.stock_quantity} ${product.name} units are available.`,
      };
    }

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.product.id === product.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: targetQty,
        };
        return next;
      }
      return [...prev, { product, quantity }];
    });

    return { success: true };
  };

  const updateQuantity = (productId: string, quantity: number): { success: boolean; message?: string } => {
    if (quantity <= 0) {
      removeItem(productId);
      return { success: true };
    }

    const item = items.find((i) => i.product.id === productId);
    if (!item) return { success: false, message: 'Item not in cart' };

    if (quantity > item.product.stock_quantity) {
      return {
        success: false,
        message: `Only ${item.product.stock_quantity} ${item.product.name} units are available.`,
      };
    }

    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
    return { success: true };
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const clearCart = () => {
    setItems([]);
    setDiscount(0);
    setPaymentMethod('cash');
  };

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.product.selling_price) * item.quantity,
    0
  );

  const total = Math.max(0, subtotal - discount);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        paymentMethod,
        discount,
        subtotal,
        total,
        totalQuantity,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        setPaymentMethod,
        setDiscount,
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
