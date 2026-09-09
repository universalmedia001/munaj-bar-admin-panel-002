import { supabase } from '../lib/supabase';

// Supported formats and size constraints
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates image file type and size.
 * Allows: JPG/JPEG, PNG, WEBP. Max size: 5MB.
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const fileType = file.type?.toLowerCase();
  const fileName = file.name?.toLowerCase() || '';
  const isTypeValid =
    ALLOWED_IMAGE_TYPES.includes(fileType) ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.webp');

  if (!isTypeValid) {
    return {
      valid: false,
      error: 'Please upload a JPG, PNG, or WEBP image under 5MB.',
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Please upload a JPG, PNG, or WEBP image under 5MB.',
    };
  }

  return { valid: true };
}

/**
 * Optimizes an image client-side via HTML5 Canvas before uploading.
 * Resizes very large photos down to max dimensions (e.g. 1200x1200) and compresses to WebP/JPEG,
 * keeping file sizes lightweight for fast rendering across POS, Receipts, and mobile browsers.
 */
export async function optimizeImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.88
): Promise<{ blob: Blob; mimeType: string }> {
  return new Promise((resolve) => {
    // If browser doesn't support Image / Canvas, return original file
    if (typeof window === 'undefined' || (!window.createImageBitmap && !window.FileReader)) {
      resolve({ blob: file, mimeType: file.type || 'image/jpeg' });
      return;
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      if (!e.target?.result) {
        resolve({ blob: file, mimeType: file.type || 'image/jpeg' });
        return;
      }
      img.src = e.target.result as string;
    };

    reader.onerror = () => {
      resolve({ blob: file, mimeType: file.type || 'image/jpeg' });
    };

    img.onload = () => {
      try {
        let { width, height } = img;

        // Calculate aspect-ratio preserving dimensions
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ blob: file, mimeType: file.type || 'image/jpeg' });
          return;
        }

        // Draw image to canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Determine optimal format: preserve PNG for transparency, otherwise use WebP/JPEG
        const targetMime = file.type === 'image/png' ? 'image/png' : 'image/webp';

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, mimeType: targetMime });
            } else {
              resolve({ blob: file, mimeType: file.type || 'image/jpeg' });
            }
          },
          targetMime,
          quality
        );
      } catch (err) {
        console.warn('[StorageService] Image optimization fallback to raw file:', err);
        resolve({ blob: file, mimeType: file.type || 'image/jpeg' });
      }
    };

    img.onerror = () => {
      resolve({ blob: file, mimeType: file.type || 'image/jpeg' });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Diagnostic logger for Supabase Storage operations.
 * Captures all critical debug details in developer console cleanly.
 */
interface StorageDiagnosticContext {
  operation: 'product_image_upload' | 'business_logo_upload' | 'file_delete' | 'bucket_check';
  bucket: string;
  filePath: string;
  fileInfo?: { name: string; size: number; mimeType: string; originalSize: number };
  user?: { id?: string; email?: string } | null;
  error?: any;
  statusCode?: string | number;
}

function logStorageDiagnostic(context: StorageDiagnosticContext) {
  const isExpectedFallback =
    context.statusCode === 404 ||
    context.statusCode === '404' ||
    context.error?.message?.toLowerCase().includes('bucket not found');

  if (isExpectedFallback) {
    console.info(
      `[MUNAJ Storage] Storage bucket '${context.bucket}' not yet provisioned in Supabase project. Engaging automatic inline data optimization fallback.`
    );
    return;
  }

  console.group(`[MUNAJ Storage Diagnostic] ${context.operation.toUpperCase()}`);
  console.warn('Storage Bucket:', context.bucket);
  console.warn('Upload / Target Path:', context.filePath);
  if (context.fileInfo) {
    console.info(
      `File Details: ${context.fileInfo.name} | Processed: ${(context.fileInfo.size / 1024).toFixed(1)} KB (Original: ${(context.fileInfo.originalSize / 1024).toFixed(1)} KB) | MIME: ${context.fileInfo.mimeType}`
    );
  }
  console.info('Authenticated User:', context.user ? `${context.user.id} (${context.user.email})` : 'Anonymous / No active session');
  if (context.statusCode) {
    console.warn('HTTP / Storage Status Code:', context.statusCode);
  }
  if (context.error) {
    console.warn('Supabase Storage Response:', context.error?.message || context.error);
  }
  console.groupEnd();
}

/**
 * Translates low-level Supabase Storage or Network errors into single, clear,
 * actionable user-facing messages.
 */
export function formatStorageErrorMessage(error: any, fallbackMessage: string = 'Unable to upload image.'): string {
  if (!error) return fallbackMessage;

  const errMsg = typeof error === 'string' ? error : error?.message || error?.error || '';
  const lowerMsg = errMsg.toLowerCase();
  const statusCode = error?.statusCode || error?.status;

  if (lowerMsg.includes('session expired') || lowerMsg.includes('jwt') || lowerMsg.includes('not logged in')) {
    return 'Your session has expired. Please sign in again.';
  }

  if (statusCode === 401 || statusCode === '401' || lowerMsg.includes('unauthorized') || lowerMsg.includes('row-level security')) {
    return "You don't have permission to upload the business logo.";
  }

  if (statusCode === 403 || statusCode === '403' || lowerMsg.includes('permission denied') || lowerMsg.includes('policy')) {
    return "You don't have permission to upload the business logo.";
  }

  if (statusCode === 404 || statusCode === '404' || lowerMsg.includes('bucket not found')) {
    return 'Storage bucket not found. Please contact an administrator.';
  }

  if (statusCode === 413 || lowerMsg.includes('payload too large') || lowerMsg.includes('entity too large') || lowerMsg.includes('file size')) {
    return 'Image must be 5MB or smaller.';
  }

  if (lowerMsg.includes('mime') || lowerMsg.includes('format') || lowerMsg.includes('invalid file')) {
    return 'Invalid image format. Use JPG, PNG, or WEBP.';
  }

  if (lowerMsg.includes('network') || lowerMsg.includes('failed to fetch')) {
    return 'Network request failed. Please check your internet connection.';
  }

  return errMsg || fallbackMessage;
}

/**
 * Helper to auto-create a bucket if permissions allow and bucket is missing.
 */
async function tryEnsureBucketExists(bucketName: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: MAX_IMAGE_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_IMAGE_TYPES,
    });
    if (!error) {
      console.info(`[StorageService] Successfully initialized storage bucket '${bucketName}'.`);
      return true;
    }
  } catch {
    // Ignore and proceed to next step
  }
  return false;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(blob);
  });
}

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

/**
 * Uploads a Product Image to Supabase Storage.
 * If Supabase Storage bucket is missing or unconfigured (404 Bucket not found),
 * gracefully falls back to an optimized base64 Data URL so product creation never fails.
 */
export async function uploadProductImage(file: File, productId?: string): Promise<UploadResult> {
  // 1. Validate file type and size
  const validation = validateImageFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 2. Fetch authenticated user context for diagnostics
  let currentUser: { id?: string; email?: string } | null = null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      currentUser = {
        id: sessionData.session.user.id,
        email: sessionData.session.user.email,
      };
    }
  } catch (authErr) {
    console.warn('[StorageService] Auth state check notice:', authErr);
  }

  const primaryBucket = 'product-images';
  const fallbackBuckets = ['business-assets', 'products', 'munaj-assets', 'public-assets'];
  const bucketsToTry = [primaryBucket, ...fallbackBuckets];

  try {
    // 3. Optimize image for fast performance across POS & mobile (max 800x800 for quick loads)
    const { blob, mimeType } = await optimizeImage(file, 800, 800, 0.85);

    // 4. Generate unique file path: products/{cleanId}_{timestamp}_{random}.{ext}
    const ext = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg';
    const cleanId = productId ? productId.toLowerCase().replace(/[^a-z0-9_-]/g, '-') : 'prod';
    const filePath = `products/${cleanId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    let lastUploadError: any = null;
    let successfulBucket: string | null = null;

    // 5. Attempt upload to primary and fallback storage buckets
    for (const bucket of bucketsToTry) {
      try {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, blob, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: true,
          });

        if (!uploadError) {
          successfulBucket = bucket;
          break;
        }

        lastUploadError = uploadError;

        // If bucket not found, try to auto-create it then retry once
        const isNotFound =
          uploadError.message?.toLowerCase().includes('bucket not found') ||
          uploadError.message?.toLowerCase().includes('not found') ||
          (uploadError as any).statusCode === 404 ||
          (uploadError as any).statusCode === '404';

        if (isNotFound) {
          const created = await tryEnsureBucketExists(bucket);
          if (created) {
            const { error: retryError } = await supabase.storage
              .from(bucket)
              .upload(filePath, blob, {
                contentType: mimeType,
                cacheControl: '3600',
                upsert: true,
              });

            if (!retryError) {
              successfulBucket = bucket;
              break;
            }
            lastUploadError = retryError;
          }
        }
      } catch (tryEx) {
        lastUploadError = tryEx;
      }
    }

    // 6. If storage bucket upload succeeded, return CDN public URL
    if (successfulBucket) {
      const { data: publicData } = supabase.storage.from(successfulBucket).getPublicUrl(filePath);
      console.info(`[StorageService] Product image uploaded to Supabase Storage bucket '${successfulBucket}/${filePath}'. Public URL: ${publicData.publicUrl}`);
      return {
        success: true,
        url: publicData.publicUrl,
        path: `${successfulBucket}/${filePath}`,
      };
    }

    // 7. If storage bucket is not found (404) or failed, fall back to optimized inline Base64 Data URL
    logStorageDiagnostic({
      operation: 'product_image_upload',
      bucket: primaryBucket,
      filePath,
      fileInfo: {
        name: file.name,
        size: blob.size,
        mimeType,
        originalSize: file.size,
      },
      user: currentUser,
      error: lastUploadError,
      statusCode: lastUploadError?.statusCode || lastUploadError?.status || 404,
    });

    console.warn(
      `[StorageService] Notice: Supabase Storage bucket '${primaryBucket}' is not available (Error: ${lastUploadError?.message || 'Bucket not found'}). Using optimized inline base64 image data URL so product creation completes seamlessly.`
    );

    const fallbackDataUrl = await blobToDataUrl(blob);
    return {
      success: true,
      url: fallbackDataUrl,
      path: `inline/${filePath}`,
    };
  } catch (err: unknown) {
    logStorageDiagnostic({
      operation: 'product_image_upload',
      bucket: primaryBucket,
      filePath: `products/${productId || 'new'}_unknown`,
      fileInfo: {
        name: file.name,
        size: file.size,
        mimeType: file.type,
        originalSize: file.size,
      },
      user: currentUser,
      error: err,
    });

    // Even on canvas/optimization error, attempt raw file data URL fallback
    try {
      const rawDataUrl = await blobToDataUrl(file);
      return {
        success: true,
        url: rawDataUrl,
        path: 'inline/raw-fallback',
      };
    } catch {
      return {
        success: false,
        error: 'Image upload failed. Please check your connection and try again.',
      };
    }
  }
}

/**
 * Uploads a Business Logo to Supabase Storage.
 * Falls back to optimized inline base64 Data URL if bucket is not found.
 */
export async function uploadBusinessLogo(file: File): Promise<UploadResult> {
  // 1. Validate file type and size
  const validation = validateImageFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 2. Fetch authenticated user context for diagnostics
  let currentUser: { id?: string; email?: string } | null = null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      currentUser = {
        id: sessionData.session.user.id,
        email: sessionData.session.user.email,
      };
    }
  } catch (authErr) {
    console.warn('[StorageService] Auth state check notice:', authErr);
  }

  const primaryBucket = 'business-assets';
  const fallbackBuckets = ['product-images', 'munaj-assets', 'public-assets', 'products'];
  const bucketsToTry = [primaryBucket, ...fallbackBuckets];

  try {
    // 3. Optimize logo (preserve PNG transparency, max 600x600)
    const isPng = file.type === 'image/png';
    const { blob, mimeType } = await optimizeImage(file, 600, 600, 0.90);

    // 4. Generate unique file path
    const ext = isPng ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const filePath = `logos/munaj_logo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    let lastUploadError: any = null;
    let successfulBucket: string | null = null;

    // 5. Attempt upload to primary and fallback buckets
    for (const bucket of bucketsToTry) {
      try {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, blob, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: true,
          });

        if (!uploadError) {
          successfulBucket = bucket;
          break;
        }

        lastUploadError = uploadError;

        // If bucket not found, try to auto-create it then retry once
        const isNotFound =
          uploadError.message?.toLowerCase().includes('bucket not found') ||
          uploadError.message?.toLowerCase().includes('not found') ||
          (uploadError as any).statusCode === 404 ||
          (uploadError as any).statusCode === '404';

        if (isNotFound) {
          const created = await tryEnsureBucketExists(bucket);
          if (created) {
            const { error: retryError } = await supabase.storage
              .from(bucket)
              .upload(filePath, blob, {
                contentType: mimeType,
                cacheControl: '3600',
                upsert: true,
              });

            if (!retryError) {
              successfulBucket = bucket;
              break;
            }
            lastUploadError = retryError;
          }
        }
      } catch (tryEx) {
        lastUploadError = tryEx;
      }
    }

    // 6. If storage bucket upload succeeded, return CDN public URL
    if (successfulBucket) {
      const { data: publicData } = supabase.storage.from(successfulBucket).getPublicUrl(filePath);
      console.info(`[StorageService] Business logo uploaded to Supabase Storage '${successfulBucket}/${filePath}'. Public URL: ${publicData.publicUrl}`);
      return {
        success: true,
        url: publicData.publicUrl,
        path: `${successfulBucket}/${filePath}`,
      };
    }

    // 7. If storage bucket is not found (404) or failed, fall back to optimized inline Base64 Data URL
    logStorageDiagnostic({
      operation: 'business_logo_upload',
      bucket: primaryBucket,
      filePath,
      fileInfo: {
        name: file.name,
        size: blob.size,
        mimeType,
        originalSize: file.size,
      },
      user: currentUser,
      error: lastUploadError,
      statusCode: lastUploadError?.statusCode || lastUploadError?.status || 404,
    });

    console.warn(
      `[StorageService] Notice: Supabase Storage bucket '${primaryBucket}' is not available. Using optimized inline base64 image data URL for logo.`
    );

    const fallbackDataUrl = await blobToDataUrl(blob);
    return {
      success: true,
      url: fallbackDataUrl,
      path: `inline/${filePath}`,
    };
  } catch (err: unknown) {
    logStorageDiagnostic({
      operation: 'business_logo_upload',
      bucket: primaryBucket,
      filePath: 'logos/munaj_logo_unknown',
      fileInfo: {
        name: file.name,
        size: file.size,
        mimeType: file.type,
        originalSize: file.size,
      },
      user: currentUser,
      error: err,
    });

    try {
      const rawDataUrl = await blobToDataUrl(file);
      return {
        success: true,
        url: rawDataUrl,
        path: 'inline/raw-fallback',
      };
    } catch {
      return {
        success: false,
        error: 'Unable to upload business logo. Please check your connection and try again.',
      };
    }
  }
}

/**
 * Safely removes an image file from Supabase Storage if it belongs to our buckets.
 */
export async function deleteStorageFile(urlOrPath: string): Promise<boolean> {
  if (!urlOrPath || typeof urlOrPath !== 'string') return false;

  try {
    // Extract bucket and path if it is a Supabase public URL
    // e.g. https://...supabase.co/storage/v1/object/public/product-images/products/foo.webp
    const match = urlOrPath.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (match) {
      const bucket = match[1];
      const path = match[2];
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) {
        logStorageDiagnostic({
          operation: 'file_delete',
          bucket,
          filePath: path,
          error,
        });
        return false;
      }
      return true;
    }

    // If path format: "bucket/path"
    if (urlOrPath.includes('/')) {
      const parts = urlOrPath.split('/');
      const bucket = parts[0];
      const path = parts.slice(1).join('/');
      const { error } = await supabase.storage.from(bucket).remove([path]);
      return !error;
    }
  } catch (err) {
    console.warn('[StorageService] Storage file deletion notice:', err);
  }
  return false;
}

