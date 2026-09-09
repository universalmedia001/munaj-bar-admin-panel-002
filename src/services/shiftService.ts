import { getSupabase } from '../lib/supabase';
import { Shift, ShiftSummaryData } from '../types';

export const shiftService = {
  async getDefaultOpeningCashFloat(): Promise<number> {
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('business_settings')
        .select('default_opening_cash_float')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && typeof data.default_opening_cash_float === 'number' && data.default_opening_cash_float >= 0) {
        return data.default_opening_cash_float;
      }
    } catch (err) {
      console.warn('[SHIFT] Notice fetching default opening cash float:', err);
    }

    try {
      const stored = localStorage.getItem('munaj_default_opening_float');
      if (stored) return Number(stored) || 50000;
    } catch (_) {}

    return 50000;
  },

  async getActiveShift(targetUserId?: string): Promise<Shift | null> {
    try {
      const supabase = getSupabase();
      let userId = targetUserId;
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
      }

      if (!userId) {
        return null;
      }

      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('worker_id', userId)
        .in('status', ['open', 'active'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[SHIFT] Notice fetching current shift:', error.message);
        return null;
      }

      return data;
    } catch (err) {
      console.warn('[SHIFT] Network / fetch notice getting active shift:', err);
      return null;
    }
  },

  async openShift(customOpeningCash?: number): Promise<Shift> {
    const supabase = getSupabase();
    
    // Authoritative Admin Configured Float retrieval
    let configuredFloat = 50000;
    try {
      configuredFloat = await this.getDefaultOpeningCashFloat();
    } catch (_) {
      configuredFloat = typeof customOpeningCash === 'number' ? customOpeningCash : 50000;
    }

    const openingCash = configuredFloat;
    console.log('[SHIFT] Opening shift with admin configured float:', { openingCash });

    // Try RPC first for transactional safety
    const { data, error } = await supabase.rpc('open_worker_shift', {
      p_opening_cash: Number(openingCash) || 0,
    });

    if (error) {
      console.error('[SHIFT] open_worker_shift error:', error);
      // Fallback to direct insert if RPC not yet created in Supabase
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: shift, error: insertError } = await supabase
          .from('shifts')
          .insert({
            worker_id: user.id,
            opening_cash: Number(openingCash) || 0,
            status: 'open',
            started_at: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (insertError) throw insertError;
        console.log('[SHIFT] Open shift fallback result:', shift);
        return shift;
      }
      throw error;
    }

    const newShift = (Array.isArray(data) ? data[0] : data) as Shift;
    console.log('[SHIFT] Open shift result:', newShift);
    return newShift;
  },

  async getShiftSummary(shiftId: string): Promise<ShiftSummaryData> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_shift_summary', {
      p_shift_id: shiftId,
    });

    if (error) {
      // Fallback calculation in frontend if RPC missing
      const { data: shift } = await supabase
        .from('shifts')
        .select('*')
        .eq('id', shiftId)
        .single();

      if (!shift) throw new Error('Shift not found');

      const { data: sales } = await supabase
        .from('sales')
        .select('*')
        .eq('shift_id', shiftId)
        .eq('status', 'completed');

      const list = sales || [];
      const cash_sales = list.filter((s) => s.payment_method === 'cash').reduce((acc, s) => acc + Number(s.total), 0);
      const pos_sales = list.filter((s) => s.payment_method === 'pos').reduce((acc, s) => acc + Number(s.total), 0);
      const transfer_sales = list.filter((s) => s.payment_method === 'transfer').reduce((acc, s) => acc + Number(s.total), 0);
      const total_sales = list.reduce((acc, s) => acc + Number(s.total), 0);
      const expected_cash = Number(shift.opening_cash) + cash_sales;

      return {
        shift_id: shift.id,
        worker_id: shift.worker_id,
        status: shift.status,
        started_at: shift.started_at,
        ended_at: shift.ended_at,
        opening_cash: Number(shift.opening_cash),
        cash_sales,
        pos_sales,
        transfer_sales,
        total_sales,
        transaction_count: list.length,
        expected_cash,
        ending_cash: shift.ending_cash,
        cash_difference: shift.cash_difference,
      };
    }

    return data as ShiftSummaryData;
  },

  async closeShift(shiftId: string, endingCash: number): Promise<{ shift: Shift; summary: any }> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('close_worker_shift', {
      p_shift_id: shiftId,
      p_ending_cash: Number(endingCash) || 0,
    });

    if (error) {
      // Fallback direct update
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        const summary = await this.getShiftSummary(shiftId);
        const difference = Number(endingCash) - summary.expected_cash;

        const { data: updatedShift, error: updateError } = await supabase
          .from('shifts')
          .update({
            ending_cash: Number(endingCash),
            expected_cash: summary.expected_cash,
            cash_difference: difference,
            ended_at: new Date().toISOString(),
            status: 'closed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', shiftId)
          .select('*')
          .single();

        if (updateError) throw updateError;
        return { shift: updatedShift, summary: { ...summary, ending_cash: Number(endingCash), cash_difference: difference } };
      }
      throw error;
    }

    return data;
  },

  async getWorkerShiftHistory(): Promise<Shift[]> {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('worker_id', user.id)
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching shift history:', error);
      throw error;
    }
    return data || [];
  },
};
