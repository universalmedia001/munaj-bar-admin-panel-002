import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { WorkerBranding } from '../types';
import {
  DEFAULT_WORKER_SITE_NAME,
  DEFAULT_WORKER_PRIMARY_COLOR,
} from '../types';
import {
  getWorkerBranding,
  saveWorkerBranding,
  resetWorkerBranding as resetWorkerBrandingService,
  subscribeToBrandingUpdates,
  applyBrandColorToDOM,
  getCachedWorkerBranding,
} from '../services/brandingService';

interface BrandingContextType {
  branding: WorkerBranding;
  workerPosName: string;
  workerPosColor: string;
  siteName: string;
  primaryColor: string;
  isLoading: boolean;
  isSaving: boolean;
  updateBranding: (newBranding: { site_name: string; primary_color: string }) => Promise<{ success: boolean; error?: string }>;
  resetBranding: () => Promise<{ success: boolean; error?: string }>;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize with cached or default branding immediately for zero-flicker UI
  const [branding, setBranding] = useState<WorkerBranding>(() => {
    const cached = getCachedWorkerBranding();
    applyBrandColorToDOM(cached.primary_color);
    return cached;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch latest branding from Supabase on mount
  const refreshBranding = useCallback(async () => {
    try {
      const latest = await getWorkerBranding();
      setBranding(latest);
    } catch (err) {
      console.warn('[BrandingContext] Refresh warning:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBranding();

    // Subscribe to realtime database changes and cross-tab broadcasts
    const unsubscribe = subscribeToBrandingUpdates((updatedBranding) => {
      setBranding(updatedBranding);
    });

    return () => {
      unsubscribe();
    };
  }, [refreshBranding]);

  // Update branding handler
  const updateBranding = async (newBranding: { site_name: string; primary_color: string }) => {
    setIsSaving(true);
    try {
      const result = await saveWorkerBranding(newBranding);
      if (result.success && result.data) {
        setBranding(result.data);
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to save branding settings.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update branding.' };
    } finally {
      setIsSaving(false);
    }
  };

  // Reset branding handler
  const resetBranding = async () => {
    setIsSaving(true);
    try {
      const result = await resetWorkerBrandingService();
      if (result.success && result.data) {
        setBranding(result.data);
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to reset branding.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to reset branding.' };
    } finally {
      setIsSaving(false);
    }
  };

  const activeSiteName = branding.site_name || DEFAULT_WORKER_SITE_NAME;
  const activePrimaryColor = branding.primary_color || DEFAULT_WORKER_PRIMARY_COLOR;

  // Keep document title synced with dynamic Worker POS branding
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${activeSiteName} - POS & Management Portal`;
    }
  }, [activeSiteName]);

  return (
    <BrandingContext.Provider
      value={{
        branding,
        workerPosName: activeSiteName,
        workerPosColor: activePrimaryColor,
        siteName: activeSiteName,
        primaryColor: activePrimaryColor,
        isLoading,
        isSaving,
        updateBranding,
        resetBranding,
        refreshBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};

export function useWorkerBranding(): BrandingContextType {
  const context = useContext(BrandingContext);
  if (!context) {
    // Fallback if accessed outside provider
    const fallback = getCachedWorkerBranding();
    const fbName = fallback.site_name || DEFAULT_WORKER_SITE_NAME;
    const fbColor = fallback.primary_color || DEFAULT_WORKER_PRIMARY_COLOR;
    return {
      branding: fallback,
      workerPosName: fbName,
      workerPosColor: fbColor,
      siteName: fbName,
      primaryColor: fbColor,
      isLoading: false,
      isSaving: false,
      updateBranding: async () => ({ success: false, error: 'BrandingProvider missing' }),
      resetBranding: async () => ({ success: false, error: 'BrandingProvider missing' }),
      refreshBranding: async () => {},
    };
  }
  return context;
}
