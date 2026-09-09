export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkerRole = 'cashier' | 'bar_worker' | 'sales_worker' | 'admin' | 'manager';
export type ShiftStatus = 'open' | 'active' | 'closed';
export type PaymentMethod = 'cash' | 'pos' | 'transfer';
export type SaleStatus = 'completed' | 'cancelled';
export type StockMovementType = 'restock' | 'adjustment' | 'damage' | 'correction' | 'sale';
export type NotificationType = 'info' | 'warning' | 'sale' | 'shift' | 'stock' | 'system';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role: WorkerRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          role?: WorkerRole;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          role?: WorkerRole;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category_id: string | null;
          selling_price: number;
          cost_price: number;
          stock_quantity: number;
          minimum_stock_level: number;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category_id?: string | null;
          selling_price: number;
          cost_price?: number;
          stock_quantity?: number;
          minimum_stock_level?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category_id?: string | null;
          selling_price?: number;
          cost_price?: number;
          stock_quantity?: number;
          minimum_stock_level?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      shifts: {
        Row: {
          id: string;
          worker_id: string;
          opening_cash: number;
          ending_cash: number | null;
          expected_cash: number | null;
          cash_difference: number | null;
          started_at: string;
          ended_at: string | null;
          status: ShiftStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          opening_cash?: number;
          ending_cash?: number | null;
          expected_cash?: number | null;
          cash_difference?: number | null;
          started_at?: string;
          ended_at?: string | null;
          status?: ShiftStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          opening_cash?: number;
          ending_cash?: number | null;
          expected_cash?: number | null;
          cash_difference?: number | null;
          started_at?: string;
          ended_at?: string | null;
          status?: ShiftStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      sales: {
        Row: {
          id: string;
          receipt_number: string;
          worker_id: string;
          shift_id: string;
          subtotal: number;
          discount: number;
          total: number;
          payment_method: PaymentMethod;
          status: SaleStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          receipt_number: string;
          worker_id: string;
          shift_id: string;
          subtotal: number;
          discount?: number;
          total: number;
          payment_method: PaymentMethod;
          status?: SaleStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          receipt_number?: string;
          worker_id?: string;
          shift_id?: string;
          subtotal?: number;
          discount?: number;
          total?: number;
          payment_method?: PaymentMethod;
          status?: SaleStatus;
          created_at?: string;
        };
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          total: number;
        };
        Insert: {
          id?: string;
          sale_id: string;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          total: number;
        };
        Update: {
          id?: string;
          sale_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
          total?: number;
        };
      };
      receipt_prints: {
        Row: {
          id: string;
          sale_id: string;
          worker_id: string;
          printed_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          worker_id: string;
          printed_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          worker_id?: string;
          printed_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string | null;
          sender_id: string | null;
          title: string;
          message: string;
          type: NotificationType;
          is_read: boolean;
          reference_type: string | null;
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id?: string | null;
          sender_id?: string | null;
          title: string;
          message: string;
          type?: NotificationType;
          is_read?: boolean;
          reference_type?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string | null;
          sender_id?: string | null;
          title?: string;
          message?: string;
          type?: NotificationType;
          is_read?: boolean;
          reference_type?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_name: string;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          description: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_name?: string;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          description: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          actor_name?: string;
          action?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          description?: string;
          metadata?: Json;
          created_at?: string;
        };
      };
      stock_movements: {
        Row: {
          id: string;
          product_id: string;
          quantity_change: number;
          quantity_before: number;
          quantity_after: number;
          movement_type: StockMovementType;
          reason: string | null;
          reference_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          quantity_change: number;
          quantity_before: number;
          quantity_after: number;
          movement_type: StockMovementType;
          reason?: string | null;
          reference_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          quantity_change?: number;
          quantity_before?: number;
          quantity_after?: number;
          movement_type?: StockMovementType;
          reason?: string | null;
          reference_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      business_settings: {
        Row: {
          id: string;
          business_name: string;
          currency_code: string;
          currency_symbol: string;
          phone: string;
          email: string;
          address: string;
          receipt_header: string;
          receipt_footer: string;
          logo_url?: string | null;
          default_opening_cash_float?: number;
          worker_pos_branding?: {
            site_name: string;
            primary_color: string;
            logo_url?: string | null;
          } | null;
          admin_branding?: {
            primary_color: string;
            logo_url?: string | null;
          } | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_name?: string;
          currency_code?: string;
          currency_symbol?: string;
          phone?: string;
          email?: string;
          address?: string;
          receipt_header?: string;
          receipt_footer?: string;
          logo_url?: string | null;
          default_opening_cash_float?: number;
          worker_pos_branding?: {
            site_name: string;
            primary_color: string;
            logo_url?: string | null;
          } | null;
          admin_branding?: {
            primary_color: string;
            logo_url?: string | null;
          } | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_name?: string;
          currency_code?: string;
          currency_symbol?: string;
          phone?: string;
          email?: string;
          address?: string;
          receipt_header?: string;
          receipt_footer?: string;
          logo_url?: string | null;
          default_opening_cash_float?: number;
          worker_pos_branding?: {
            site_name: string;
            primary_color: string;
            logo_url?: string | null;
          } | null;
          admin_branding?: {
            primary_color: string;
            logo_url?: string | null;
          } | null;
          updated_at?: string;
        };
      };
    };
    Functions: {
      complete_sale: {
        Args: {
          p_shift_id: string;
          p_items: Json;
          p_payment_method: string;
          p_discount?: number;
        };
        Returns: Json;
      };
      open_worker_shift: {
        Args: {
          p_opening_cash: number;
        };
        Returns: Json;
      };
      get_shift_summary: {
        Args: {
          p_shift_id: string;
        };
        Returns: Json;
      };
      close_worker_shift: {
        Args: {
          p_shift_id: string;
          p_ending_cash: number;
        };
        Returns: Json;
      };
      log_receipt_print: {
        Args: {
          p_sale_id: string;
        };
        Returns: Json;
      };
    };
  };
}
