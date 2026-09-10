import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../types';
import { isWorkerDeleted } from '../types';

export interface AuthContextType {
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
  signIn: (email: string, password: string) => Promise<{ error: string | null; needsEmailVerification?: boolean }>;
  signUpAdmin: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: string | null; needsEmailVerification?: boolean }>;
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
   * has genuinely been deleted or deactivated in Supabase.
   */
  const forceAccountTermination = useCallback(async (reason: string) => {
    console.warn('[MUNAJ Auth] Force account termination triggered:', reason);

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[MUNAJ Auth] Error during force signOut:', e);
    }

    try {
      localStorage.removeItem('munaj_cached_worker');
      localStorage.removeItem('munaj_active_shift');
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
   *
   * Note: Missing or delayed profile rows during initial creation are NOT
   * treated as account deletion. Only explicit deletion or deactivation flags trigger logout.
   */
  const validateCurrentSession = useCallback(async (): Promise<boolean> => {
    const currentUserId = userRef.current?.id || sessionRef.current?.user?.id;
    if (!currentUserId) return true;

    try {
      // 1. Verify user exists in Supabase Auth
      const { data: authUserData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        const msg = authError.message.toLowerCase();
        // Only force terminate if explicit confirmation that user does not exist in Auth
        if (msg.includes('user not found') || msg.includes('invalid claim') || (authError as any).status === 404) {
          console.warn('[MUNAJ Auth] Auth session validation failed - user not found in Auth backend:', authError.message);
          await forceAccountTermination(
            'Your account has been deleted. Please contact an administrator if you believe this was a mistake.'
          );
          return false;
        }
        console.warn('[MUNAJ Auth] Auth session validation network notice:', authError.message);
        return true;
      }

      if (!authUserData?.user) {
        return true;
      }

      // 2. Check profile record in public.profiles table
      const { data: profileRow, error: profileErr } = await supabase
        .from('profiles')
        .select('id, role, is_active, full_name, status')
        .eq('id', currentUserId)
        .maybeSingle();

      if (profileErr) {
        console.warn('[MUNAJ Auth] Profile validation network notice:', profileErr.message);
        return true;
      }

      // ONLY terminate if profile explicitly exists and is marked deleted
      if (profileRow && isWorkerDeleted(profileRow)) {
        console.warn(`[MUNAJ Auth] Profile row for user ${currentUserId} is marked deleted. Forcing logout.`);
        await forceAccountTermination(
          'Your account has been deleted. Please contact an administrator if you believe this was a mistake.'
        );
        return false;
      }

      // ONLY terminate if profile explicitly has is_active === false
      if (profileRow && profileRow.is_active === false) {
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
   * Fetches the user profile from public.profiles or provisions/synthesizes
   * the active profile for authenticated administrators.
   */
  const fetchProfile = useCallback(
    async (userId: string, userObj?: User | null): Promise<Profile | null> => {
      if (!userId) return null;

      const existingRequest = profileRequestsRef.current.get(userId);
      if (existingRequest) return existingRequest;

      const request = (async () => {
        fetchingProfileUserIdRef.current = userId;
        setProfileLoading(true);
        setProfileError(null);

        try {
          console.log(`[MUNAJ Auth] Resolving profile record for user ID: ${userId}`);
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (error) {
            console.warn('[MUNAJ Auth] Profile fetch query warning:', error.message);
          }

          if (data) {
            if (isWorkerDeleted(data)) {
              console.info(`[MUNAJ Auth] Profile record for user ID: ${userId} is marked deleted.`);
              return data as Profile;
            }
            console.log(`[MUNAJ Auth] Profile resolved from DB: ${data.full_name} | Role: ${data.role} | Active: ${data.is_active}`);
            return data as Profile;
          }

          // Profile row not found in public.profiles yet (e.g. newly verified admin).
          // Check authenticated user context
          const currentUser = userObj || userRef.current || (await supabase.auth.getUser()).data.user;
          if (currentUser && currentUser.id === userId) {
            const role = (currentUser.user_metadata?.role as UserRole) || 'admin';
            const fullName =
              currentUser.user_metadata?.full_name ||
              (currentUser.email ? currentUser.email.split('@')[0] : 'Administrator');

            // Attempt 1: Insert into public.profiles with current user session
            try {
              const { data: created, error: createError } = await supabase
                .from('profiles')
                .upsert({
                  id: userId,
                  full_name: fullName,
                  email: currentUser.email || '',
                  role: role,
                  is_active: true,
                  updated_at: new Date().toISOString(),
                })
                .select('*')
                .maybeSingle();

              if (!createError && created) {
                console.log(`[MUNAJ Auth] Successfully created profile in database: ${created.full_name} (${created.role})`);
                return created as Profile;
              }
            } catch (upsertErr) {
              console.warn('[MUNAJ Auth] Profile self-upsert notice:', upsertErr);
            }

            // Attempt 2: Backend ensure-profile helper
            try {
              const sessionRes = await supabase.auth.getSession();
              const token = sessionRes.data.session?.access_token;
              if (token) {
                const apiRes = await fetch('/api/admin/ensure-profile', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                });
                if (apiRes.ok) {
                  const apiData = await apiRes.json();
                  if (apiData.profile) {
                    console.log('[MUNAJ Auth] Profile confirmed via backend ensure-profile:', apiData.profile.role);
                    return apiData.profile as Profile;
                  }
                }
              }
            } catch (apiErr) {
              console.warn('[MUNAJ Auth] Backend ensure-profile notice:', apiErr);
            }

            // Attempt 3: Construct synthesized active admin Profile so newly verified admin is never blocked
            const syntheticProfile: Profile = {
              id: userId,
              full_name: fullName,
              email: currentUser.email || '',
              role: role,
              is_active: true,
              created_at: currentUser.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            console.log(`[MUNAJ Auth] Using active admin profile for newly verified admin: ${fullName} (${role})`);
            return syntheticProfile;
          }

          console.info(`[MUNAJ Auth] No profile record found for user ID: ${userId}.`);
          return null;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown profile error';
          console.error('[MUNAJ Auth] Failed to fetch user profile:', msg);
          setProfileError(msg);
          return null;
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
      const p = await fetchProfile(user.id, user);
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

        // Check if there is an auth code in URL search params (PKCE redirect from email)
        if (typeof window !== 'undefined' && window.location.search) {
          const searchParams = new URLSearchParams(window.location.search);
          const code = searchParams.get('code');
          if (code) {
            console.log('[MUNAJ Auth] Verification code detected in URL query, exchanging for session...');
            try {
              const { data: exchangeData, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
              if (exchangeErr) {
                console.warn('[MUNAJ Auth] exchangeCodeForSession notice:', exchangeErr.message);
              } else if (exchangeData.session) {
                console.log('[MUNAJ Auth] Session successfully established via exchangeCodeForSession');
              }
            } catch (exchangeEx) {
              console.warn('[MUNAJ Auth] Code exchange exception:', exchangeEx);
            }
          }
        }

        const {
          data: { session: initialSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.warn('[MUNAJ Auth] getSession error:', sessionError.message);
        }

        if (!mounted) return;

        if (initialSession?.user) {
          const userObj = initialSession.user;
          const userProfile = await fetchProfile(userObj.id, userObj);

          if (userProfile && isWorkerDeleted(userProfile)) {
            console.warn(`[MUNAJ Auth] Profile ${userObj.id} is explicitly marked deleted.`);
            await forceAccountTermination(
              'Your account has been deleted. Please contact an administrator if you believe this was a mistake.'
            );
            return;
          }

          if (userProfile && userProfile.is_active === false) {
            console.warn(`[MUNAJ Auth] Profile ${userObj.id} is explicitly deactivated.`);
            await forceAccountTermination(
              'Your account has been deactivated. Please contact an administrator if you believe this was a mistake.'
            );
            return;
          }

          if (mounted) {
            setSession(initialSession);
            setUser(userObj);
            setProfile(userProfile);
            clearTerminationNotice();

            // Clean up verification tokens from URL if present
            if (
              typeof window !== 'undefined' &&
              (window.location.hash.includes('access_token') || window.location.search.includes('code='))
            ) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
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
          const userProfile = await fetchProfile(newSession.user.id, newSession.user);
          if (!mounted) return;

          if (userProfile && isWorkerDeleted(userProfile)) {
            forceAccountTermination(
              'Your account has been deleted. Please contact an administrator if you believe this was a mistake.'
            );
            return;
          }

          if (userProfile && userProfile.is_active === false) {
            forceAccountTermination(
              'Your account has been deactivated. Please contact an administrator if you believe this was a mistake.'
            );
            return;
          }

          setSession(newSession);
          setUser(newSession.user);
          setProfile(userProfile);
          clearTerminationNotice();

          // Clean up verification tokens from URL if present
          if (
            typeof window !== 'undefined' &&
            (window.location.hash.includes('access_token') || window.location.search.includes('code='))
          ) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (authErr) {
          console.warn('[MUNAJ Auth] Profile resolution notice on auth change:', authErr);
          if (mounted) {
            setSession(newSession);
            setUser(newSession.user);
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
  }, [fetchProfile, forceAccountTermination, clearTerminationNotice]);

  // Realtime Profile Listener & Periodic Session Validation Guard
  useEffect(() => {
    if (!user?.id) return;

    const currentUserId = user.id;
    console.log(`[MUNAJ Auth] Establishing realtime account validity listener for user: ${currentUserId}`);

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

    // Heartbeat session verification every 10 seconds
    const interval = setInterval(() => {
      validateCurrentSession();
    }, 10000);

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
   * Signs in admin user with email and password.
   * Checks for verified email and admin/manager authorization.
   */
  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: string | null; needsEmailVerification?: boolean }> => {
    clearTerminationNotice();
    try {
      console.log(`[MUNAJ Auth] Executing signInWithPassword for: ${email.trim()}`);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.warn('[MUNAJ Auth] signInWithPassword error:', error.message);
        if (error.message.toLowerCase().includes('email not confirmed')) {
          return {
            error: 'Your email address has not been verified yet. Please check your inbox for the confirmation link.',
            needsEmailVerification: true,
          };
        }
        return { error: error.message };
      }

      if (data.user) {
        // Check email confirmation status
        if (!data.user.email_confirmed_at) {
          await supabase.auth.signOut();
          return {
            error: 'Your email address has not been verified yet. Please check your inbox for the confirmation link.',
            needsEmailVerification: true,
          };
        }

        const userProfile = await fetchProfile(data.user.id, data.user);

        if (userProfile && isWorkerDeleted(userProfile)) {
          console.warn('[MUNAJ Auth] Account rejection: Account is deleted for user ID:', data.user.id);
          await supabase.auth.signOut();
          const deletedMsg = 'Your account has been deleted. Please contact an administrator if you believe this was a mistake.';
          setAccountTerminationNotice(deletedMsg);
          return { error: deletedMsg };
        }

        if (userProfile && userProfile.is_active === false) {
          console.warn('[MUNAJ Auth] Account rejection: Account is deactivated for user ID:', data.user.id);
          await supabase.auth.signOut();
          const deactMsg = 'Your account has been deactivated. Please contact an administrator if you believe this was a mistake.';
          setAccountTerminationNotice(deactMsg);
          return { error: deactMsg };
        }

        const role = userProfile?.role || (data.user.user_metadata?.role as string);
        if (role !== 'admin' && role !== 'manager' && role !== 'super_admin') {
          await supabase.auth.signOut();
          return {
            error: `Administrative Access Restricted: Account ${data.user.email} has the role of ${role}. Only Admins and Managers can enter.`,
          };
        }

        console.log('[MUNAJ Auth] Login successful and profile verified:', userProfile?.full_name || data.user.email, role);
        setUser(data.user);
        setSession(data.session);
        if (userProfile) setProfile(userProfile);
      }

      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign in. Please try again.';
      console.error('[MUNAJ Auth] Login exception:', msg);
      return { error: msg };
    }
  };

  /**
   * Registers a new administrator account. Supabase sends the confirmation email
   * with a redirect link pointing directly to the app.
   */
  const signUpAdmin = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error: string | null; needsEmailVerification?: boolean }> => {
    clearTerminationNotice();
    try {
      const cleanEmail = email.trim();
      const cleanName = fullName.trim();
      console.log(`[MUNAJ Auth] Registering new admin account: ${cleanEmail}`);

      const emailRedirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            role: 'admin',
          },
          emailRedirectTo,
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
          return {
            error: 'Account registration is temporarily rate-limited by Supabase. Please wait a few moments before trying again.',
          };
        }
        return { error: error.message };
      }

      // Check if email confirmation is required
      const needsEmailVerification = !data.session || !data.user?.email_confirmed_at;

      if (data.user && !needsEmailVerification) {
        const p = await fetchProfile(data.user.id, data.user);
        if (p) setProfile(p);
        setUser(data.user);
        setSession(data.session);
      }

      return { error: null, needsEmailVerification };
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
