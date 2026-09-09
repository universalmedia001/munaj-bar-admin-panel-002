import qz from 'qz-tray';
import type { SaleWithDetails, BusinessSettings } from '../types';
import { formatDate, formatTime } from '../utils/formatters';
import { formatWorkerDisplayName } from '../types';
import { supabase } from '../lib/supabase';

let securityConfigured = false;

function configureSecurity() {
  if (securityConfigured) return;

  qz.security.setCertificatePromise((resolve: (certificate: string) => void, reject: (error: unknown) => void) => {
    fetch('/api/qz/certificate')
      .then(async (response) => {
        if (!response.ok) throw new Error('QZ Tray certificate is not configured on the server.');
        resolve(await response.text());
      })
      .catch(reject);
  });
  qz.security.setSignaturePromise((dataToSign: string) => (resolve: (signature: string) => void, reject: (error: unknown) => void) => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => fetch('/api/qz/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ data: dataToSign }),
      }))
      .then(async (response) => {
        if (!response.ok) throw new Error('QZ Tray signing is not configured on the server.');
        resolve(await response.text());
      })
      .catch(reject);
  });
  securityConfigured = true;
}

export async function connectQzTray(): Promise<void> {
  configureSecurity();
  if (!qz.websocket.isActive()) {
    try {
      await qz.websocket.connect();
    } catch {
      throw new Error('Printer service is not connected. Please open QZ Tray and try again.');
    }
  }
}

export async function findQzPrinters(): Promise<string[]> {
  await connectQzTray();
  const printers = await qz.printers.find();
  return Array.isArray(printers) ? printers : printers ? [printers] : [];
}

function fit(value: string, width: number) {
  return value.length > width ? `${value.slice(0, Math.max(0, width - 1))}.` : value;
}

function columns(left: string, right: string, width: number) {
  const safeRight = fit(right, width);
  return `${fit(left, Math.max(1, width - safeRight.length - 1)).padEnd(Math.max(1, width - safeRight.length - 1), ' ')} ${safeRight.padStart(safeRight.length, ' ')}`;
}

export function buildEscPosReceipt(sale: SaleWithDetails, settings?: BusinessSettings | null): string {
  const width = 42;
  const businessName = settings?.worker_pos_name || settings?.business_name || 'MUNAJ BAR';
  const currency = settings?.currency || 'NGN';
  const footer = settings?.receipt_footer || `Thank you for patronizing ${businessName}.`;
  const cashier = formatWorkerDisplayName(sale.worker);
  const lines = [
    '\x1B@',
    '\x1Ba\x01',
    '\x1BE\x01',
    fit(businessName.toUpperCase(), width),
    '\x1BE\x00',
    'Premium Lounge & Bar Service',
    settings?.address || '',
    settings?.phone ? `Tel: ${settings.phone}` : '',
    '------------------------------------------',
    'RECEIPT',
    columns('Receipt No:', sale.receipt_number, width),
    columns('Date:', formatDate(sale.created_at), width),
    columns('Time:', formatTime(sale.created_at), width),
    columns('Cashier:', cashier, width),
    '------------------------------------------',
    'ITEM                 QTY       PRICE TOTAL',
    ...(sale.items || []).map((item) =>
      columns(`${fit(item.product_name, 19)} x${item.quantity}`, `${currency} ${Number(item.total).toFixed(2)}`, width)
    ),
    '------------------------------------------',
    columns('Subtotal:', `${currency} ${Number(sale.subtotal).toFixed(2)}`, width),
    sale.discount > 0 ? columns('Discount:', `-${currency} ${Number(sale.discount).toFixed(2)}`, width) : '',
    columns('TOTAL:', `${currency} ${Number(sale.total).toFixed(2)}`, width),
    columns('Payment:', sale.payment_method.toUpperCase(), width),
    '------------------------------------------',
    fit(footer, width),
    'Please keep this receipt for verification.',
    '\n\n\n',
    '\x1DV\x00',
  ].filter(Boolean);

  return `${lines.join('\n')}\n`;
}

export async function printReceiptDirectly(
  sale: SaleWithDetails,
  settings?: BusinessSettings | null
): Promise<string> {
  const printerName = settings?.receipt_printer_name?.trim();
  if (!printerName) throw new Error('No receipt printer found. Please select a printer in Settings.');

  await connectQzTray();
  const availablePrinters = await findQzPrinters();
  if (!availablePrinters.includes(printerName)) {
    throw new Error('No receipt printer found. Please select a printer in Settings.');
  }

  const config = qz.configs.create(printerName, { size: { width: 80, height: 0 }, units: 'mm' });
  await qz.print(config, [{ type: 'raw', format: 'command', data: buildEscPosReceipt(sale, settings) }]);
  return printerName;
}