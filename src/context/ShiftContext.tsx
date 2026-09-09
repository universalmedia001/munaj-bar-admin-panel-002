import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { shiftService } from '../services/shiftService';
import { getSupabase } from '../lib/supabase';
import { Shift, ShiftSummaryData } from '../types';
import { useAuth } from './AuthContext';
import { sanitizeErrorMessage } from '../utils/formatters';

interface ShiftContextType {
  activeShift: Shift | null;
  currentShift: Shift | null;
  shiftSummary: ShiftSummaryData | null;
  isLoading: boolean;
  error: string | null;
  isShiftActive: boolean;
  isOpenShiftModalOpen: boolean;
  isCloseShiftModalOpen: boolean;
  openShiftModal: () => void;
  closeShiftModal: () => void;
  openCloseShiftModal: () => void;
  closeCloseShiftModal: () => void;
  startShift: (openingCash: number) => Promise<Shift>;
  endShift: (endingCash: number) => Promise<any>;
  refreshShift: () => Promise<void>;
  clearError: () => void;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export const ShiftProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState<boolean>(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState<boolean>(false);

  const refreshShift = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      console.log('[SHIFT] Auth user: none');
      setActiveShift(null);
      setShiftSummary(null);
      return;
    }

    try {
      setIsLoading(true);
      const shift = await shiftService.getActiveShift(user.id);
      setActiveShift(shift);

      if (shift && (shift.status === 'open' || shift.status === 'active')) {
        const summary = await shiftService.getShiftSummary(shift.id);
        setShiftSummary(summary);
      } else {
        setShiftSummary(null);
      }
    } catch (err: any) {
      console.error('[SHIFT] Error refreshing shift:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  // Initial load and Realtime subscription for public.shifts
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setActiveShift(null);
      setShiftSummary(null);
      return;
    }

    // Load current shift when user is available
    refreshShift();

    // Setup Supabase Realtime for this worker's shifts
    const supabase = getSupabase();
    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const channelName = `worker_shifts_${user.id}_${uniqueId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
          filter: `worker_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[SHIFT] Realtime shift event:', payload);
          const newOrUpdated = (payload.new || {}) as Shift;
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (newOrUpdated.status === 'open' || newOrUpdated.status === 'active') {
              console.log('[SHIFT] Setting currentShift:', newOrUpdated);
              setActiveShift(newOrUpdated);
              shiftService
                .getShiftSummary(newOrUpdated.id)
                .then(setShiftSummary)
                .catch((err) => console.error('[SHIFT] Error loading realtime summary:', err));
            } else if (newOrUpdated.status === 'closed') {
              console.log('[SHIFT] Shift closed in realtime:', newOrUpdated);
              setActiveShift((curr) => (curr?.id === newOrUpdated.id ? null : curr));
              setShiftSummary((curr) => (curr?.shift_id === newOrUpdated.id ? null : curr));
            }
          } else if (payload.eventType === 'DELETE') {
            const old = (payload.old || {}) as { id?: string };
            setActiveShift((curr) => (curr?.id === old.id ? null : curr));
            setShiftSummary((curr) => (curr?.shift_id === old.id ? null : curr));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, refreshShift]);

  const startShift = async (openingCash: number): Promise<Shift> => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[SHIFT] Opening shift...');
      const newShift = await shiftService.openShift(openingCash);
      
      console.log('[SHIFT] Setting currentShift:', newShift);
      setActiveShift(newShift);
      setIsOpenShiftModalOpen(false);

      if (newShift && newShift.id) {
        setShiftSummary({
          shift_id: newShift.id,
          worker_id: newShift.worker_id,
          status: 'open',
          started_at: newShift.started_at,
          ended_at: null,
          opening_cash: Number(newShift.opening_cash || 0),
          cash_sales: 0,
          pos_sales: 0,
          transfer_sales: 0,
          total_sales: 0,
          transaction_count: 0,
          expected_cash: Number(newShift.opening_cash || 0),
          ending_cash: null,
          cash_difference: null,
        });

        // Background update summary from RPC
        shiftService.getShiftSummary(newShift.id).then((summary) => {
          if (summary) setShiftSummary(summary);
        }).catch((err) => {
          console.warn('[SHIFT] Initial summary fetch notice:', err);
        });
      }

      // Immediately refetch/reload to confirm state synchronization
      await refreshShift();
      return newShift;
    } catch (err: any) {
      const msg = sanitizeErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const endShift = async (endingCash: number) => {
    if (!activeShift) throw new Error('No active shift to close');
    try {
      setIsLoading(true);
      setError(null);
      const result = await shiftService.closeShift(activeShift.id, endingCash);
      setActiveShift(null);
      setShiftSummary(null);
      setIsCloseShiftModalOpen(false);
      return result;
    } catch (err: any) {
      const msg = sanitizeErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const isShiftActive = Boolean(activeShift && (activeShift.status === 'open' || activeShift.status === 'active'));

  return (
    <ShiftContext.Provider
      value={{
        activeShift,
        currentShift: activeShift,
        shiftSummary,
        isLoading,
        error,
        isShiftActive,
        isOpenShiftModalOpen,
        isCloseShiftModalOpen,
        openShiftModal: () => setIsOpenShiftModalOpen(true),
        closeShiftModal: () => setIsOpenShiftModalOpen(false),
        openCloseShiftModal: () => setIsCloseShiftModalOpen(true),
        closeCloseShiftModal: () => setIsCloseShiftModalOpen(false),
        startShift,
        endShift,
        refreshShift,
        clearError: () => setError(null),
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
};

export const useShift = (): ShiftContextType => {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error('useShift must be used within a ShiftProvider');
  }
  return context;
};

