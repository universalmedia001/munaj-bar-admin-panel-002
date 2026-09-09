import { getSupabase } from '../lib/supabase';

export const receiptService = {
  async logReceiptPrint(saleId: string) {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase.rpc('log_receipt_print', {
        p_sale_id: saleId,
      });
      if (error) {
        // Fallback direct insert if RPC missing
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('receipt_prints').insert({
            sale_id: saleId,
            worker_id: user.id,
            printed_at: new Date().toISOString(),
          });
        }
      }
      return data;
    } catch (err) {
      console.warn('Could not log receipt print:', err);
    }
  },

  triggerBrowserPrint() {
    window.print();
  },
};
