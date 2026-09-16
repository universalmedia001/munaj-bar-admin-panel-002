import { supabase } from '../lib/supabase';

export type BackupType = 'MANUAL' | 'BEFORE_RESET' | 'PRE_RESTORE';
export type BackupStatus = 'CREATING' | 'SUCCESS' | 'FAILED';

export interface BackupRecord {
  id: string;
  created_at: string;
  backup_type: BackupType;
  status: BackupStatus;
  schema_version: string;
  record_counts: Record<string, number>;
  notes: string | null;
  created_by: string | null;
}

export interface BackupResult {
  success: boolean;
  backup_id?: string;
  backup_type?: BackupType;
  record_counts?: Record<string, number>;
  created_at?: string;
  message?: string;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  partial?: boolean;
  pre_restore_backup_id?: string;
  record_counts?: Record<string, number>;
  warnings?: string[];
  message?: string;
  error?: string;
}

/**
 * Creates a business data backup in Supabase.
 * Uses the server-side endpoint for privileged access and verification.
 */
export async function createBackup(backupType: BackupType = 'MANUAL'): Promise<BackupResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    return { success: false, error: 'You must be signed in as an administrator.' };
  }

  try {
    const response = await fetch('/api/admin/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ backup_type: backupType }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return {
        success: true,
        backup_id: data.backup_id,
        backup_type: data.backup_type,
        record_counts: data.record_counts,
        created_at: data.created_at,
        message: data.message,
      };
    }

    return {
      success: false,
      error: data.error || 'Failed to create backup.',
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error during backup.' };
  }
}

/**
 * Lists all successful backups from Supabase.
 */
export async function listBackups(): Promise<{ success: boolean; backups: BackupRecord[]; error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    return { success: false, backups: [], error: 'You must be signed in as an administrator.' };
  }

  try {
    const response = await fetch('/api/admin/backups', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return { success: true, backups: data.backups || [] };
    }

    return { success: false, backups: [], error: data.error || 'Failed to list backups.' };
  } catch (err: any) {
    return { success: false, backups: [], error: err?.message || 'Network error.' };
  }
}

/**
 * Restores business data from a backup into the original Supabase tables.
 * Automatically creates a PRE_RESTORE safety backup first.
 */
export async function restoreBackup(backupId: string): Promise<RestoreResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    return { success: false, error: 'You must be signed in as an administrator.' };
  }

  try {
    const response = await fetch('/api/admin/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ backup_id: backupId }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return {
        success: true,
        partial: data.partial,
        pre_restore_backup_id: data.pre_restore_backup_id,
        record_counts: data.record_counts,
        warnings: data.warnings,
        message: data.message,
      };
    }

    return {
      success: false,
      error: data.error || 'Failed to restore backup.',
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error during restore.' };
  }
}
