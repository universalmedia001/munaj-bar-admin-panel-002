import type { IncomingMessage, ServerResponse } from 'http';
import { handleAdminDeleteWorker } from '../../server/adminDeleteWorker.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url || req.url === '/' || req.url === '') {
    req.url = '/api/admin/delete-worker';
  }
  const handled = await handleAdminDeleteWorker(req, res);
  if (!handled && !res.writableEnded) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
  }
}
