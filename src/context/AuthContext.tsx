import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../types';
import { isWorkerDeleted } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  role: UserRole | null;
  isAdminOrManager: boolean;
  accountTerminationNotice: string | null;
  clearTerminationNotice: () => void;
  validateCurrentSession: () => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpAdmin: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TERMINATION_NOTICE_STORAGE_KEY = 'munaj_termination_notice';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [accountTerminationNotice, setAccountTerminationNotice] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(TERMINATION_NOTICE_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const fetchingProfileUserIdRef = useRef<string | null>(null);
  const profileRequestsRef = useRef(new Map<string, Promise<Profile | null>>());

  const clearTerminationNotice = useCallback(() => {
    setAccountTerminationNotice(null);
    try {
      sessionStorage.removeItem(TERMINATION_NOTICE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  /**
   * Forces complete termination of the active user session when an account
   * has been deleted or deactivated. Cleans up all storage, notifies the user,
   * and redirects to login.
   */
  const forceAccountTermination = useCallback(async (reason: string) => {
    console.warn('[MUNAJ Auth] Force account termination triggered:', reason);

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[MUNAJ Auth] Error during force signOut:', e);
    }

    // Clear local authentication artifacts and cached worker credentials
    try {
      localStorage.removeItem('munaj_cached_worker');
      localStorage.removeItem('munaj_active_shift');
      // Clear Supabase token caches
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('auth-token'))) {
          localStorage.removeItem(key);
        }
      }
      sessionStorage.setItem(TERMINATION_NOTICE_STORAGE_KEY, reason);
    } catch (storageErr) {
      console.warn('[MUNAJ Auth] Storage cleanup warning:', storageErr);
    }

    setUser(null);
    setSession(null);
    setProfile(null);
    setAccountTerminationNotice(reason);
    setLoading(false);
  }, []);

  /**
   * Validates that the currently authenticated user still exists in Supabase Auth
   * and that their profile in public.profiles is active.
   * If the account was deleted or deactivated, immediately forces logout.
   */
  const validateCurrentSession = useCallback(async (): Promise<boolean> => {
    const currentUserId = userRef.current?.id || sessionRef.current?.user?.id;
    if (!currentUserId) return true;

    try {
      // 1. Verify user exists in Supabase Auth
      const { data: authUserData, error: authError } = await supabase.auth.getUser();
      if (authError || !authUserData?.user) {
        console.warn('[MUNAJ Auth] Auth session validation failed - account deleted or token invalid:', authError?.message);
        await forceAccountTermination(
          'Your account has been deleted. Please contact an administrator if you believe this was a mistake.'
        );
        return false;
      }

      // 2. Verify worker record in public.profiles table
      const { data: profileRow, error: profileErr } = await supabase
        .from('profiles')
        .select('id, role, is_active, full_name')
        .eq('id', currentUserId)
        .maybeSingle();

      if (profileErr) {
        console.warn('[MUNAJ Auth] Profile validation network notice:', profileErr.message);
        return true;
      }

      if (!profileRow || isWorkerDeleted(profileRow)) {
        // Record was removed from profiles or marked deleted -> account was deleted!
        console.warn(`[MUNAJ Auth] Profile row for user ${currentUserId} was deleted. Forcing immediate logout.`);
        await forceAccountTermination(
          'Your account has been deleted. Please contact an administrator if you believe this was a mistake.'
        );
        return false;
      }

      if (profileRow.is_active === false) {
        // Worker was marked inactive
        console.warn(`[MUNAJ Auth] Worker account ${currentUserId} has been deactivated.`);
        await forceAccountTermination(
          'Your account has been deactivated. Please contact an administrator if you believe this was a mistake.'
        );
        return false;
      }

      return true;
    } catch (err) {
      console.warn('[MUNAJ Auth] Exception during session validation:', err);
      return true;
    }
  }, [forceAccountTermination]);

  /**
   * Fetches the user profile from public.profiles.
   * Does NOT auto-provision if the profile is missing (prevents reviving deleted users).
   */
  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      if (!userId) return null;

      const existingRequest = profileRequestsRef.current.get(userId);
      if (existingRequest) return existingRequest;

      const request = (async () => {
        fetchingProfileUserIdRef.current = userId;
        setProfileLoading(true);
        setProfileError(null);

        try {
          console.log(`[MUNAJ Auth] Fetching profile record for user: ${userId}`);
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (error) {
            console.warn('[MUNAJ Auth] Profile fetch query warning:', error.message);
            setProfileError(error.message);
            throw error;
          }

          if (data) {
            if (isWorkerDeleted(data)) {
              console.info(`[MUNAJ Auth] Profile record for user ID: ${userId} is marked deleted.`);
              return null;
            }
            console.log(`[MUNAJ Auth] Profile resolved: ${data.full_name} | Role: ${data.role} | Active: ${data.is_active}`);
            return data as Profile;
          }

          console.info(`[MUNAJ Auth] No profile record found for user ID: ${userId}. Account may have been deleted.`);
          return null;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown profile error';
          console.error('[MUNAJ Auth] Failed to fetch user profile:', msg);
          setProfileError(msg);
          throw err;
        } finally {
          fetchingProfileUserIdRef.current = null;
          setProfileLoading(false);
        }
      })();

      profileRequestsRef.current.set(userId, request);
      void request
        .finally(() => {
          if (profileRequestsRef.current.get(userId) === request) {
            profileRequestsRef.current.delete(userId);
          }
        })
        .catch(() => undefined);

      return request;
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      const p = await fetchProfile(user.id);
      if (p) {
        setProfile(p);
      }
    }
  }, [user, fetchProfile]);

  // Main authentication initialization and listeners
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        console.log('[MUNAJ Auth] Initializing session via supabase.auth.getSession()...');
        const {
          data: { session: initialSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.warn('[MUNAJ Auth] getSession error:', sessionError.message);
        }

        if (!mounted) return;

        if (initialSession?.user) {
          // Verify user validity with active Supabase endpoint
          const { data: verifiedUserData, error: verifyError } = await supabase.auth.getUser();

          if (verifyError || !verifiedUserData?.user) {
            console.warn('[MUNAJ Auth] Stored session failed user verification against active backend:', verifyError?.message);
            await forceAccountTermination(
              'Your account has been deleted. Please contact an administrator if you believe this was a mistake.'
            );
            return;
          }

          // Check if profile exists and is active
          const userProfile = await fetchProfile(verifiedUserData.user.id);

          if (!userProfile) {
            console.warn(`[MUNAJ Auth] Active session exists but profile ${verifiedUserData.user.id} is missing. User deleted.`);
            await forceAccountTermination(
              'Your account has been deleted. Please contact an administrator if you believe this was a mistake.'
            );
            return;
          }

          if (userProfile.is_active === false) {
            console.warn(`[MUNAJ Auth] Active session exists but profile ${verifiedUserData.user.id} is inactive.`);
            await forceAccountTermination(
              'Your account has been deactivated. Please contact an administrator if you believe this was a mistake.'
            );
            return;
          }

          if (mounted) {
            setSession(initialSession);
            setUser(verifiedUserData.user);
            setProfile(userProfile);
          }
        } else {
          console.log('[MUNAJ Auth] No persistent session found on startup.');
          if (mounted) {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error('[MUNAJ Auth] Error during auth initialization:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`[MUNAJ Auth] onAuthStateChange event: ${event}`, newSession?.user?.id ? `(User: ${newSession.user.id})` : '(No Session)');
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (newSession?.user) {
        try {
          const userProfile = await fetchProfile(newSession.user.id);
          if (!mounted) return;
          if (!userProfile) {
            forceAccountTermination(
              'Your account has been deleted. Please contact an administrator if you believe this was a mistake.'
            );
          } else if (userProfile.is_active === false) {
            forceAccountTermination(
              'Your account has been deactivated. Please contact an administrator if you believe this was a mistake.'
            );
          } else {
            setSession(newSession);
            setUser(newSession.user);
            setProfile(userProfile);
          }
        } catch {
          if (mounted) {
            console.warn('[MUNAJ Auth] Profile verification failed; retaining the session without terminating it.');
          }
        }
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, forceAccountTermination]);

  // Realtime Profile Listener & Periodic Session Validation Guard
  useEffect(() => {
    if (!user?.id) return;

    const currentUserId = user.id;
    console.log(`[MUNAJ Auth] Establishing realtime account validity listener for user: ${currentUserId}`);

    // Realtime channel to detect immediate profile deletion or deactivation
    const profileChannel = supabase
      .channel(`profile-validity-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUserId}`,
        },
        (payload) => {
          console.warn('[MUNAJ Auth] REALTIME: Profile DELETE event detected for current user:', payload);
          forceAccountTermination(
            'Your account has been deleted. Please contact an administrator if you believe this was a mistake.'
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUserId}`,
        },
        (payload) => {
          console.log('[MUNAJ Auth] REALTIME: Profile UPDATE event detected:', payload);
          const updated = payload.new as any;
          if (updated && updated.is_active === false) {
            forceAccountTermination(
              'Your account has been deactivated. Please contact an administrator if you believe this was a mistake.'
            );
          } else if (updated) {
            setProfile(updated as Profile);
          }
        }
      )
      .subscribe();

    // Heartbeat session verification every 3 seconds
    const interval = setInterval(() => {
      validateCurrentSession();
    }, 3000);

    // Verify session when window regains focus or visibility
    const handleFocus = () => {
      validateCurrentSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        validateCurrentSession();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(profileChannel);
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, forceAccountTermination, validateCurrentSession]);

  /**
   * Signs in user and verifies their account is active.
   * If the profile does not exist (account deleted) or is deactivated,
   * rejects the sign-in and logs out immediately.
   */
  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    clearTerminationNotice();
    try {
      console.log(`[MUNAJ Auth] Executing signInWithPassword for: ${email.trim()}`);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.warn('[MUNAJ Auth] signInWithPassword error:', error.message);
        return { error: error.message };
      }

      if (data.user) {
        // Query profiles to confirm account still exists and is not deleted or deactivated
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profErr) {
          console.warn('[MUNAJ Auth] Profile check notice on login:', profErr.message);
          return { error: 'Unable to verify your account profile. Please try again.' };
        }

        if (!prof || isWorkerDeleted(prof)) {
          console.warn('[MUNAJ Auth] Account rejection: Account is deleted for user ID:', data.user.id);
          await supabase.auth.signOut();
          const deletedMsg = 'Your account has been deleted. Please contact an administrator if you believe this was a mistake.';
          setAccountTerminationNotice(deletedMsg);
          return { error: deletedMsg };
        }

        if (prof.is_active === false) {
          console.warn('[MUNAJ Auth] Account rejection: Account is deactivated for user ID:', data.user.id);
          await supabase.auth.signOut();
          const deactMsg = 'Your account has been deactivated. Please contact an administrator if you believe this was a mistake.';
          setAccountTerminationNotice(deactMsg);
          return { error: deactMsg };
        }

        console.log('[MUNAJ Auth] Login successful and profile verified:', prof.full_name, prof.role);
        setUser(data.user);
        setSession(data.session);
        setProfile(prof as Profile);
      }

      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign in. Please try again.';
      console.error('[MUNAJ Auth] Login exception:', msg);
      return { error: msg };
    }
  };

  const signUpAdmin = async (email: string, password: string, fullName: string): Promise<{ error: string | null }> => {
    clearTerminationNotice();
    try {
      console.log(`[MUNAJ Auth] Registering new admin account: ${email.trim()}`);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'admin',
          },
        },
      });

      if (error) {
        console.warn('[MUNAJ Auth] signUpAdmin error:', error.message);
        const errLower = error.message.toLowerCase();
        if (
          errLower.includes('rate limit') ||
          errLower.includes('over_email_send_rate_limit') ||
          errLower.includes('too many requests') ||
          (error as any).status === 429
        ) {
          return { error: 'Account registration is temporarily rate-limited by Supabase. Please wait a few moments before trying again.' };
        }
        return { error: error.message };
      }

      if (data.user) {
        // Upsert into profiles table
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName.trim(),
          email: email.trim(),
          role: 'admin',
          is_active: true,
          updated_at: new Date().toISOString(),
        });

        if (profileError) {
          console.warn('[MUNAJ Auth] Profile creation warning:', profileError.message);
        }

        const p = await fetchProfile(data.user.id);
        if (p) {
          setProfile(p);
        }
      }

      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign up failed';
      return { error: msg };
    }
  };

  const signOut = async () => {
    console.log('[MUNAJ Auth] Explicit user-invoked signOut() initiated');
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[MUNAJ Auth] Error during Supabase signOut:', err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
    }
  };

  const role = profile?.role ?? null;
  const isAdminOrManager = role === 'admin' || role === 'manager' || role === 'super_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        profileLoading,
        profileError,
        role,
        isAdminOrManager,
        accountTerminationNotice,
        clearTerminationNotice,
        validateCurrentSession,
        signIn,
        signUpAdmin,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
