import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { WorkerPosBranding } from '../types';
import { 
  brandingService, 
  DEFAULT_WORKER_BRANDING, 
  applyWorkerCssVariables, 
  getContrastTextColor, 
  normalizeHexColor 
} from '../services/brandingService';

interface WorkerBrandingContextValue {
  branding: WorkerPosBranding;
  workerPrimaryColor: string;
  workerSiteName: string;
  businessLogo: string | null;
  logoUrl: string | null;
  textColor: string;
  saveBranding: (newBranding: WorkerPosBranding) => Promise<WorkerPosBranding>;
  resetBranding: () => Promise<WorkerPosBranding>;
  isLoading: boolean;
}

const WorkerBrandingContext = createContext<WorkerBrandingContextValue | undefined>(undefined);

export const WorkerBrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize synchronously with cached value to prevent flash
  const [branding, setBranding] = useState<WorkerPosBranding>(() => {
    const cached = brandingService.getCachedWorkerBranding();
    applyWorkerCssVariables(cached);
    return cached;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync with Supabase on mount
  useEffect(() => {
    let isMounted = true;

    brandingService.getWorkerBranding().then((loaded) => {
      if (isMounted) {
        setBranding(loaded);
        setIsLoading(false);
      }
    }).catch((err) => {
      console.warn('Failed to load branding from network:', err);
      if (isMounted) setIsLoading(false);
    });

    // Realtime subscription: updates branding reactively WITHOUT reloading or resetting cart/sales/shifts!
    const unsubscribe = brandingService.subscribeToWorkerBranding((updated) => {
      setBranding(updated);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Handler to save branding
  const saveBranding = useCallback(async (newBranding: WorkerPosBranding): Promise<WorkerPosBranding> => {
    const saved = await brandingService.saveWorkerBranding(newBranding);
    setBranding(saved);
    return saved;
  }, []);

  // Handler to reset branding
  const resetBranding = useCallback(async (): Promise<WorkerPosBranding> => {
    const reset = await brandingService.resetWorkerBranding();
    setBranding(reset);
    return reset;
  }, []);

  const workerPrimaryColor = normalizeHexColor(branding.primary_color, DEFAULT_WORKER_BRANDING.primary_color);
  const workerSiteName = branding.site_name || DEFAULT_WORKER_BRANDING.site_name;
  const businessLogo = branding.logo_url || null;
  const logoUrl = branding.logo_url || null;
  const textColor = getContrastTextColor(workerPrimaryColor);

  return (
    <WorkerBrandingContext.Provider
      value={{
        branding,
        workerPrimaryColor,
        workerSiteName,
        businessLogo,
        logoUrl,
        textColor,
        saveBranding,
        resetBranding,
        isLoading,
      }}
    >
      {children}
    </WorkerBrandingContext.Provider>
  );
};

export const useWorkerBranding = (): WorkerBrandingContextValue => {
  const context = useContext(WorkerBrandingContext);
  if (!context) {
    // Return safe fallback if used outside provider
    const fallback = DEFAULT_WORKER_BRANDING;
    return {
      branding: fallback,
      workerPrimaryColor: fallback.primary_color,
      workerSiteName: fallback.site_name,
      businessLogo: null,
      logoUrl: null,
      textColor: '#000000',
      saveBranding: async (b) => b,
      resetBranding: async () => fallback,
      isLoading: false,
    };
  }
  return context;
};
