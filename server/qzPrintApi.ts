import type { IncomingMessage, ServerResponse } from 'http';
import { createSign } from 'crypto';
import { createClient } from '@supabase/supabase-js';

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export async function handleQzPrintApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const pathname = (req.url || '').split('?')[0];
  if (pathname !== '/api/qz/certificate' && pathname !== '/api/qz/sign') return false;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  const certificate = process.env.QZ_CERTIFICATE || '';
  const privateKey = process.env.QZ_PRIVATE_KEY || '';
  if (!certificate || !privateKey) {
    res.statusCode = 503;
    res.end('QZ Tray signing is not configured on the server.');
    return true;
  }

  if (pathname === '/api/qz/certificate' && req.method === 'GET') {
    res.statusCode = 200;
    res.end(certificate);
    return true;
  }

  if (pathname === '/api/qz/sign' && req.method === 'POST') {
    try {
      const authHeader = req.headers.authorization;
      const supabaseUrl = process.env.SUPABASE_URL || 'https://audhnjptgfwpqophgfvy.supabase.co';
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!token || !anonKey) {
        res.statusCode = 401;
        res.end('Authorized administrator session required.');
        return true;
      }

      const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: userData, error: userError } = await userClient.auth.getUser(token);
      if (userError || !userData.user) {
        res.statusCode = 401;
        res.end('Authorized administrator session required.');
        return true;
      }
      const { data: profile } = await userClient
        .from('profiles')
        .select('role, is_active')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (!profile?.is_active || !['admin', 'manager'].includes(String(profile.role).toLowerCase())) {
        res.statusCode = 403;
        res.end('Only active administrators can sign QZ Tray requests.');
        return true;
      }

      const body = JSON.parse(await readBody(req)) as { data?: string };
      if (!body.data) {
        res.statusCode = 400;
        res.end('QZ signing data is required.');
        return true;
      }
      const signer = createSign('SHA512');
      signer.update(body.data);
      signer.end();
      res.statusCode = 200;
      res.end(signer.sign(privateKey, 'base64'));
    } catch {
      res.statusCode = 400;
      res.end('Unable to sign QZ Tray request.');
    }
    return true;
  }

  res.statusCode = 405;
  res.end('Method not allowed.');
  return true;
}