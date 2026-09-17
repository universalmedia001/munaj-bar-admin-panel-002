import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile, WorkerRole } from '../types';

export const AUTHORIZED_WORKER_ROLES: WorkerRole[] = [
  'cashier',
  'bar_worker',
  'sales_worker',
  'admin',
  'manager',
];

export const isAuthorizedWorkerRole = (role?: string | null): boolean => {
  if (!role) return false;
  return AUTHORIZED_WORKER_ROLES.includes(role as WorkerRole) || role === 'bar_staff';
};

/**
 * Enforces intended role mapping for designated workers:
 * - Samuel ("sam") -> Cashier (Cashier Terminal)
 * - Uche ("uche")   -> Bar Worker (Bar Terminal)
 * - Any "bar_staff" -> Normalized to "bar_worker" for Bar Terminal consistency
 */
export const normalizeWorkerProfile = (profile: Profile | null): Profile | null => {
  if (!profile) return null;
  const identifier = `${profile.full_name || ''} ${profile.email || ''}`.toLowerCase();

  if (identifier.includes('sam')) {
    return { ...profile, role: 'cashier' };
  }
  if (identifier.includes('uche')) {
    return { ...profile, role: 'bar_worker' };
  }
  if ((profile.role as string) === 'bar_staff') {
    return { ...profile, role: 'bar_worker' };
  }
  return profile;
};

export const authService = {
  async signIn(email: string, password: string) {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Database connection is not configured. Please contact your system administrator.'
      );
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      console.error('Supabase Auth signInWithPassword error:', error);
      throw error;
    }
    if (!data.user) {
      throw new Error('No user returned after authentication');
    }

    // Fetch worker profile created by Admin Panel
    let profile: Profile | null = null;
    try {
      profile = await this.getCurrentWorkerProfile(data.user.id);
    } catch (profileErr) {
      console.error('Failed to load profile for user:', data.user.id, profileErr);
    }

    if (!profile) {
      const userRole = (data.user.user_metadata?.role as WorkerRole);
      if (userRole && isAuthorizedWorkerRole(userRole)) {
        profile = {
          id: data.user.id,
          email: data.user.email || email.trim(),
          full_name: data.user.user_metadata?.full_name || email.trim().split('@')[0],
          role: userRole,
          avatar_url: data.user.user_metadata?.avatar_url || null,
          created_at: data.user.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else {
        await supabase.auth.signOut();
        throw new Error("Worker profile not found. Please ask an Administrator to register your staff account in the MUNAJ Admin Panel.");
      }
    }

    profile = normalizeWorkerProfile(profile);

    // 1. Verify account is not deleted
    if (isWorkerDeleted(profile)) {
      await supabase.auth.signOut();
      throw new Error("Your account has been deleted. Please contact an administrator if you believe this was a mistake.");
    }

    // 2. Verify account is not deactivated
    if (profile.is_active === false || profile.status === 'inactive') {
      await supabase.auth.signOut();
      throw new Error("Your account has been deactivated. Please contact an administrator.");
    }

    // 3. Verify role is an authorized Worker POS role
    if (!isAuthorizedWorkerRole(profile?.role)) {
      await supabase.auth.signOut();
      throw new Error("You don't have permission to use the MUNAJ BAR Worker POS.");
    }

    return { user: data.user, profile: profile! };
  },

  async signOut() {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentWorkerProfile(userId?: string): Promise<Profile | null> {
    try {
      const supabase = getSupabase();
      let uid = userId;

      if (!uid) {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) return null;
        uid = data.user.id;
      }

      if (!uid) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (error) {
        console.warn('Notice fetching worker profile:', error.message);
        return null;
      }

      return normalizeWorkerProfile(data);
    } catch (err) {
      console.warn('Network / fetch notice fetching worker profile:', err);
      return null;
    }
  },

  async resetPassword(email: string) {
    const supabase = getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  },

  onAuthStateChange(callback: (session: any, profile: Profile | null) => void) {
    const supabase = getSupabase();
    return supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        let profile = await this.getCurrentWorkerProfile(session.user.id);
        
        // Security check on session restore: verify account exists, not deleted, active, and authorized
        if (
          !profile ||
          isWorkerDeleted(profile) ||
          profile.is_active === false ||
          profile.status === 'inactive' ||
          !isAuthorizedWorkerRole(profile.role)
        ) {
          console.warn('[authService] Restored worker session failed deactivation/authorization validation:', {
            hasProfile: !!profile,
            isActive: profile?.is_active,
            status: profile?.status,
            role: profile?.role,
          });
          await supabase.auth.signOut();
          try {
            localStorage.removeItem('munaj_cached_worker');
            localStorage.removeItem('munaj_active_shift');
          } catch {}
          callback(null, null);
          return;
        }

        profile = normalizeWorkerProfile(profile);
        callback(session, profile);
      } else {
        callback(null, null);
      }
    });
  },

  /**
   * Subscribes to real-time changes on public.profiles for the active worker.
   * Immediately notifies if the worker is deactivated, deleted, or unauthorized.
   * Also binds window focus and visibility revalidation.
   */
  subscribeToWorkerProfile(
    userId: string,
    onDeactivated: (reason: string) => void
  ): () => void {
    const supabase = getSupabase();
    const channelName = `worker_profile_${userId}_${Date.now()}`;

    const checkValidity = (p: Partial<Profile> | null) => {
      if (!p) return;
      if (p.is_active === false || p.status === 'inactive') {
        onDeactivated('Your account has been deactivated. Please contact an administrator.');
        return;
      }
      if (isWorkerDeleted(p as Profile)) {
        onDeactivated('Your account has been deleted. Please contact an administrator if you believe this was a mistake.');
        return;
      }
      if (p.role && !isAuthorizedWorkerRole(p.role)) {
        onDeactivated("You don't have permission to use the MUNAJ BAR Worker POS.");
        return;
      }
    };

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<Profile>;
          checkValidity(updated);
        }
      )
      .subscribe();

    const handleRevalidation = async () => {
      try {
        const fresh = await this.getCurrentWorkerProfile(userId);
        if (fresh) {
          checkValidity(fresh);
        }
      } catch (err) {
        console.warn('[authService] Revalidation check notice:', err);
      }
    };

    const handleFocus = () => {
      handleRevalidation();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRevalidation();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  },
};
