import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertCircle, RefreshCw, X, Shield, Key, Globe, Server, Lock } from 'lucide-react';
import { getSupabaseConfig, resetSupabaseClient, getSupabase } from '../lib/supabase';

interface ConfigGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TestStepResult {
  status: 'idle' | 'running' | 'success' | 'error';
  message: string;
  details?: string;
  statusCode?: number | string;
}

interface DiagnosticResults {
  urlConfig: TestStepResult;
  keyConfig: TestStepResult;
  restApi: TestStepResult;
  databaseTable: TestStepResult;
  authConnectivity: TestStepResult;
}

export const ConfigGuideModal: React.FC<ConfigGuideModalProps> = ({ isOpen, onClose }) => {
  const config = getSupabaseConfig();
  const [customUrl, setCustomUrl] = useState(config.url || '');
  const [customKey, setCustomKey] = useState(config.anonKey || '');
  const [isRunningAll, setIsRunningAll] = useState(false);

  const [diagnostics, setDiagnostics] = useState<DiagnosticResults>({
    urlConfig: { status: 'idle', message: 'Not checked' },
    keyConfig: { status: 'idle', message: 'Not checked' },
    restApi: { status: 'idle', message: 'Not checked' },
    databaseTable: { status: 'idle', message: 'Not checked' },
    authConnectivity: { status: 'idle', message: 'Not checked' },
  });

  const runAllDiagnostics = async (testUrl = customUrl, testKey = customKey) => {
    setIsRunningAll(true);
    const trimmedUrl = testUrl.trim();
    const trimmedKey = testKey.trim();

    const results: DiagnosticResults = {
      urlConfig: { status: 'running', message: 'Validating URL format...' },
      keyConfig: { status: 'idle', message: 'Waiting...' },
      restApi: { status: 'idle', message: 'Waiting...' },
      databaseTable: { status: 'idle', message: 'Waiting...' },
      authConnectivity: { status: 'idle', message: 'Waiting...' },
    };
    setDiagnostics({ ...results });

    // Step A: Supabase URL Configuration Check
    if (!trimmedUrl) {
      results.urlConfig = {
        status: 'error',
        message: 'Supabase URL is missing',
        details: 'VITE_SUPABASE_URL is not set or empty.',
      };
      setDiagnostics({ ...results });
      setIsRunningAll(false);
      return;
    } else if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      results.urlConfig = {
        status: 'error',
        message: 'Invalid URL scheme',
        details: `URL must start with https:// (got: ${trimmedUrl})`,
      };
      setDiagnostics({ ...results });
      setIsRunningAll(false);
      return;
    } else {
      results.urlConfig = {
        status: 'success',
        message: 'Configured & Valid URL',
        details: trimmedUrl,
      };
    }
    setDiagnostics({ ...results });

    // Step B: Public API Key Configuration Check
    results.keyConfig = { status: 'running', message: 'Validating API Key format...' };
    setDiagnostics({ ...results });

    if (!trimmedKey) {
      results.keyConfig = {
        status: 'error',
        message: 'Supabase API Key is missing',
        details: 'VITE_SUPABASE_ANON_KEY is not set or empty.',
      };
      setDiagnostics({ ...results });
      setIsRunningAll(false);
      return;
    } else if (trimmedKey.includes('your-anon-key') || trimmedKey.includes('placeholder')) {
      results.keyConfig = {
        status: 'error',
        message: 'Placeholder API key detected',
        details: 'Please replace the placeholder key with your actual Supabase Anon/Publishable Key.',
      };
      setDiagnostics({ ...results });
      setIsRunningAll(false);
      return;
    } else {
      const maskedKey = trimmedKey.length > 16 
        ? `${trimmedKey.slice(0, 10)}...${trimmedKey.slice(-6)}` 
        : '***';
      results.keyConfig = {
        status: 'success',
        message: 'Public Key configured',
        details: `Key format detected (${maskedKey})`,
      };
    }
    setDiagnostics({ ...results });

    // Initialize or Reset Client with current test values
    const client = resetSupabaseClient(trimmedUrl, trimmedKey);

    // Step C: Supabase REST/API Connectivity Check
    results.restApi = { status: 'running', message: 'Testing REST API endpoint reachability...' };
    setDiagnostics({ ...results });

    try {
      const startTime = performance.now();
      const restEndpoint = `${trimmedUrl.replace(/\/$/, '')}/rest/v1/`;
      const response = await fetch(restEndpoint, {
        headers: {
          apikey: trimmedKey,
          Authorization: `Bearer ${trimmedKey}`,
        },
      });
      const latency = Math.round(performance.now() - startTime);

      if (response.ok || response.status === 200 || response.status === 404) {
        results.restApi = {
          status: 'success',
          message: 'REST API endpoint reachable',
          details: `HTTP ${response.status} (${latency}ms) - Supabase Gateway responded successfully`,
          statusCode: response.status,
        };
      } else {
        const text = await response.text();
        results.restApi = {
          status: 'error',
          message: `REST API returned HTTP ${response.status}`,
          details: text || response.statusText,
          statusCode: response.status,
        };
      }
    } catch (err: any) {
      results.restApi = {
        status: 'error',
        message: 'Failed to reach Supabase REST API',
        details: err.message || String(err),
      };
    }
    setDiagnostics({ ...results });

    // Step D: Database Table Accessibility Check (Testing `products` table)
    results.databaseTable = { status: 'running', message: 'Querying public.products table...' };
    setDiagnostics({ ...results });

    try {
      const { data, error, status, statusText } = await client
        .from('products')
        .select('*')
        .limit(1);

      if (error) {
        results.databaseTable = {
          status: 'error',
          message: `Table query failed: ${error.message}`,
          details: `Code: ${error.code || 'N/A'} | Status: ${status} (${statusText || 'Error'}) | Details: ${error.details || 'None'} | Hint: ${error.hint || 'None'}`,
          statusCode: status,
        };
      } else {
        const recordCount = Array.isArray(data) ? data.length : 0;
        results.databaseTable = {
          status: 'success',
          message: 'public.products table query succeeded',
          details: `HTTP ${status} (${statusText || 'OK'}) | Read ${recordCount} record(s) successfully`,
          statusCode: status,
        };
      }
    } catch (err: any) {
      results.databaseTable = {
        status: 'error',
        message: 'Exception while querying products table',
        details: err.message || String(err),
      };
    }
    setDiagnostics({ ...results });

    // Step E: Authentication Connectivity Check
    results.authConnectivity = { status: 'running', message: 'Verifying Supabase Auth service...' };
    setDiagnostics({ ...results });

    try {
      const { data: authData, error: authError } = await client.auth.getSession();

      if (authError) {
        results.authConnectivity = {
          status: 'error',
          message: `Auth verification failed: ${authError.message}`,
          details: authError.name || 'AuthError',
          statusCode: authError.status,
        };
      } else {
        results.authConnectivity = {
          status: 'success',
          message: 'Auth service active & responsive',
          details: authData?.session ? 'Existing session detected' : 'No active session (Ready for login)',
        };
      }
    } catch (err: any) {
      results.authConnectivity = {
        status: 'error',
        message: 'Exception during Auth verification',
        details: err.message || String(err),
      };
    }
    setDiagnostics({ ...results });
    setIsRunningAll(false);
  };

  useEffect(() => {
    if (isOpen) {
      runAllDiagnostics(customUrl, customKey);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndTest = (e: React.FormEvent) => {
    e.preventDefault();
    runAllDiagnostics(customUrl, customKey);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#111111] border border-[#262626] rounded-2xl max-w-xl w-full p-6 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#222222]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-500/15 text-green-400 flex items-center justify-center font-bold">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Supabase Connection Diagnostics
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Multi-tier backend reachability & database verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717A] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnostics Results List */}
        <div className="space-y-2.5 mb-6">
          
          {/* Test A: Supabase URL */}
          <div className="p-3 bg-[#181818] border border-[#262626] rounded-xl flex items-start justify-between text-xs">
            <div className="flex items-start space-x-2.5">
              <Globe className="w-4 h-4 text-[#A1A1AA] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white flex items-center space-x-1.5">
                  <span>A. Supabase URL Configuration</span>
                </div>
                <div className="text-[11px] text-[#A1A1AA] mt-0.5">{diagnostics.urlConfig.message}</div>
                {diagnostics.urlConfig.details && (
                  <div className="text-[10px] font-mono text-[#71717A] mt-0.5 break-all">
                    {diagnostics.urlConfig.details}
                  </div>
                )}
              </div>
            </div>
            <StatusBadge result={diagnostics.urlConfig} />
          </div>

          {/* Test B: Public API Key */}
          <div className="p-3 bg-[#181818] border border-[#262626] rounded-xl flex items-start justify-between text-xs">
            <div className="flex items-start space-x-2.5">
              <Key className="w-4 h-4 text-[#A1A1AA] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white flex items-center space-x-1.5">
                  <span>B. Public API Key Configuration</span>
                </div>
                <div className="text-[11px] text-[#A1A1AA] mt-0.5">{diagnostics.keyConfig.message}</div>
                {diagnostics.keyConfig.details && (
                  <div className="text-[10px] font-mono text-[#71717A] mt-0.5 break-all">
                    {diagnostics.keyConfig.details}
                  </div>
                )}
              </div>
            </div>
            <StatusBadge result={diagnostics.keyConfig} />
          </div>

          {/* Test C: REST API */}
          <div className="p-3 bg-[#181818] border border-[#262626] rounded-xl flex items-start justify-between text-xs">
            <div className="flex items-start space-x-2.5">
              <Server className="w-4 h-4 text-[#A1A1AA] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white flex items-center space-x-1.5">
                  <span>C. Supabase REST / API Connectivity</span>
                </div>
                <div className="text-[11px] text-[#A1A1AA] mt-0.5">{diagnostics.restApi.message}</div>
                {diagnostics.restApi.details && (
                  <div className="text-[10px] font-mono text-[#71717A] mt-0.5 break-all">
                    {diagnostics.restApi.details}
                  </div>
                )}
              </div>
            </div>
            <StatusBadge result={diagnostics.restApi} />
          </div>

          {/* Test D: Database Table Accessibility */}
          <div className="p-3 bg-[#181818] border border-[#262626] rounded-xl flex items-start justify-between text-xs">
            <div className="flex items-start space-x-2.5">
              <Database className="w-4 h-4 text-[#A1A1AA] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white flex items-center space-x-1.5">
                  <span>D. Database Table Accessibility (<code>products</code>)</span>
                </div>
                <div className="text-[11px] text-[#A1A1AA] mt-0.5">{diagnostics.databaseTable.message}</div>
                {diagnostics.databaseTable.details && (
                  <div className="text-[10px] font-mono text-[#71717A] mt-0.5 break-all">
                    {diagnostics.databaseTable.details}
                  </div>
                )}
              </div>
            </div>
            <StatusBadge result={diagnostics.databaseTable} />
          </div>

          {/* Test E: Authentication Connectivity */}
          <div className="p-3 bg-[#181818] border border-[#262626] rounded-xl flex items-start justify-between text-xs">
            <div className="flex items-start space-x-2.5">
              <Lock className="w-4 h-4 text-[#A1A1AA] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white flex items-center space-x-1.5">
                  <span>E. Authentication Service Connectivity</span>
                </div>
                <div className="text-[11px] text-[#A1A1AA] mt-0.5">{diagnostics.authConnectivity.message}</div>
                {diagnostics.authConnectivity.details && (
                  <div className="text-[10px] font-mono text-[#71717A] mt-0.5 break-all">
                    {diagnostics.authConnectivity.details}
                  </div>
                )}
              </div>
            </div>
            <StatusBadge result={diagnostics.authConnectivity} />
          </div>

        </div>

        {/* Form Controls */}
        <form onSubmit={handleSaveAndTest} className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1">
              Supabase Project URL
            </label>
            <input
              type="text"
              required
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://audhnjptgfwpqophgfvy.supabase.co"
              className="w-full bg-[#181818] border border-[#2c2c2c] focus:border-green-500 text-white rounded-xl px-3 py-2 text-xs outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#A1A1AA] uppercase mb-1">
              Supabase Public Anon Key
            </label>
            <input
              type="password"
              required
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="sb_publishable_... or JWT anon key"
              className="w-full bg-[#181818] border border-[#2c2c2c] focus:border-green-500 text-white rounded-xl px-3 py-2 text-xs outline-none font-mono"
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <button
              type="submit"
              disabled={isRunningAll}
              className="flex-1 bg-green-500 hover:bg-green-400 disabled:bg-green-800 text-black font-extrabold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-green-900/30 cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningAll ? 'animate-spin' : ''}`} />
              <span>{isRunningAll ? 'RUNNING DIAGNOSTICS...' : 'RE-RUN ALL DIAGNOSTIC TESTS'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-[#222222] hover:bg-[#2c2c2c] text-[#A1A1AA] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ result: TestStepResult }> = ({ result }) => {
  switch (result.status) {
    case 'running':
      return (
        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold shrink-0 animate-pulse">
          TESTING
        </span>
      );
    case 'success':
      return (
        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[10px] font-bold shrink-0 flex items-center space-x-1">
          <CheckCircle2 className="w-3 h-3" />
          <span>PASS</span>
        </span>
      );
    case 'error':
      return (
        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] font-bold shrink-0 flex items-center space-x-1">
          <AlertCircle className="w-3 h-3" />
          <span>FAIL</span>
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 bg-[#262626] text-[#71717A] rounded text-[10px] font-bold shrink-0">
          IDLE
        </span>
      );
  }
};
