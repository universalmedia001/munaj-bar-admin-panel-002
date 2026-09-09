export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'manager' | 'cashier' | 'bar_worker' | 'sales_worker';
export type PaymentMethod = 'cash' | 'pos' | 'transfer';
export type ShiftStatus = 'active' | 'closed';
export type SaleStatus = 'completed' | 'cancelled';
export type StockMovementType = 'sale' | 'restock' | 'adjustment' | 'damage' | 'correction';
export type NotificationType = 'new_sale' | 'shift_started' | 'shift_closed' | 'low_stock' | 'out_of_stock' | 'admin_message' | 'system';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role: UserRole;
          phone?: string | null;
          avatar_url?: string | null;
          status?: string | null;
          is_active?: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          role?: UserRole;
          phone?: string | null;
          avatar_url?: string | null;
          status?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          role?: UserRole;
          phone?: string | null;
          avatar_url?: string | null;
          status?: string | null;
          is_active?: boolean;
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
      stock_movements: {
        Row: {
          id: string;
          product_id: string;
          type: StockMovementType;
          quantity: number;
          quantity_before: number;
          quantity_after: number;
          reason: string;
          reference_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          type: StockMovementType;
          quantity: number;
          quantity_before: number;
          quantity_after: number;
          reason: string;
          reference_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          type?: StockMovementType;
          quantity?: number;
          quantity_before?: number;
          quantity_after?: number;
          reason?: string;
          reference_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      shifts: {
        Row: {
          id: string;
          worker_id: string | null;
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
          worker_id: string | null;
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
          worker_id: string | null;
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
          user_id?: string | null;
          recipient_id?: string | null;
          title: string;
          message: string;
          type: NotificationType;
          reference_type?: string | null;
          reference_id?: string | null;
          sale_id?: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          recipient_id?: string | null;
          title: string;
          message: string;
          type: NotificationType;
          reference_type?: string | null;
          reference_id?: string | null;
          sale_id?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          recipient_id?: string | null;
          title?: string;
          message?: string;
          type?: NotificationType;
          reference_type?: string | null;
          reference_id?: string | null;
          sale_id?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id?: string | null;
          actor_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          description: string;
          metadata?: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          actor_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          description: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          actor_id?: string | null;
          action?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          description?: string;
          metadata?: Json;
          created_at?: string;
        };
      };
      business_settings: {
        Row: {
          id: string;
          business_name: string;
          logo_url: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          currency: string;
          receipt_footer: string;
          updated_at: string;
          updated_by: string | null;
          worker_pos_name: string | null;
          worker_pos_color: string | null;
          default_opening_cash?: number | null;
          receipt_printer_name?: string | null;
        };
        Insert: {
          id?: string;
          business_name?: string;
          logo_url?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          currency?: string;
          receipt_footer?: string;
          updated_at?: string;
          updated_by?: string | null;
          worker_pos_name?: string | null;
          worker_pos_color?: string | null;
          default_opening_cash?: number | null;
          receipt_printer_name?: string | null;
        };
        Update: {
          id?: string;
          business_name?: string;
          logo_url?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          currency?: string;
          receipt_footer?: string;
          updated_at?: string;
          updated_by?: string | null;
          worker_pos_name?: string | null;
          worker_pos_color?: string | null;
          default_opening_cash?: number | null;
          receipt_printer_name?: string | null;
        };
      };
    };
    Functions: {
      generate_receipt_number: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      open_shift: {
        Args: {
          p_opening_cash: number;
        };
        Returns: Json;
      };
      close_shift: {
        Args: {
          p_shift_id: string;
          p_ending_cash: number;
        };
        Returns: Json;
      };
      adjust_stock: {
        Args: {
          p_product_id: string;
          p_quantity_change: number;
          p_type: string;
          p_reason: string;
        };
        Returns: Json;
      };
      complete_sale: {
        Args: {
          p_shift_id: string;
          p_items: Json;
          p_payment_method: string;
          p_discount?: number;
        };
        Returns: Json;
      };
      send_broadcast_notification: {
        Args: {
          p_title: string;
          p_message: string;
          p_recipient_ids?: string[] | null;
        };
        Returns: number;
      };
      log_activity_event: {
        Args: {
          p_action: string;
          p_entity_type: string;
          p_entity_id: string;
          p_description: string;
          p_metadata?: Json;
        };
        Returns: string;
      };
    };
  };
}
