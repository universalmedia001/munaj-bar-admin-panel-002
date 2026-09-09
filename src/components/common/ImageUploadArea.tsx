import React, { useState, useRef } from 'react';
import {
  Camera,
  UploadCloud,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Trash2,
} from 'lucide-react';
import { validateImageFile } from '../../services/storageService';

interface ImageUploadAreaProps {
  label?: string;
  sublabel?: string;
  helperText?: string;
  currentImageUrl?: string | null;
  onImageSelected?: (file: File) => void;
  onImageRemoved?: () => void;
  isUploading?: boolean;
  uploadProgressText?: string;
  disabled?: boolean;
  previewHeight?: string;
  aspectRatio?: 'square' | 'wide' | 'auto';
  className?: string;
  changeButtonText?: string;
  removeButtonText?: string;
}

export const ImageUploadArea: React.FC<ImageUploadAreaProps> = ({
  label = 'PRODUCT IMAGE',
  sublabel = 'Upload an image of this product',
  helperText = 'JPG, PNG or WEBP • Maximum 5MB',
  currentImageUrl,
  onImageSelected,
  onImageRemoved,
  isUploading = false,
  uploadProgressText = 'Uploading image...',
  disabled = false,
  previewHeight = 'h-48',
  aspectRatio = 'square',
  className = '',
  changeButtonText = 'CHANGE IMAGE',
  removeButtonText = 'REMOVE IMAGE',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  // Active display image: local preview (instant feedback) or currentImageUrl
  const activeImageUrl = localPreviewUrl || currentImageUrl;

  const handleFile = (file: File) => {
    setValidationError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setValidationError(validation.error || 'Please upload a JPG, PNG, or WEBP image under 5MB.');
      return;
    }

    // Generate instant local blob preview URL
    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(objectUrl);

    if (onImageSelected) {
      onImageSelected(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
    // Reset input value so re-uploading the same file works if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isUploading) return;
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChooseImageClick = () => {
    if (disabled || isUploading) return;
    fileInputRef.current?.click();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || isUploading) return;

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
    setValidationError(null);

    if (onImageRemoved) {
      onImageRemoved();
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <Camera className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>{label}</span>
          </label>
          {activeImageUrl && !isUploading && (
            <span className="text-[10px] text-[#22C55E] font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Image attached
            </span>
          )}
        </div>
      )}

      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Upload & Preview Container */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={!activeImageUrl && !isUploading ? handleChooseImageClick : undefined}
        className={`relative w-full rounded-2xl border-2 transition-all duration-200 overflow-hidden flex flex-col items-center justify-center p-4 select-none ${
          dragActive
            ? 'border-[#22C55E] bg-[#22C55E]/10 ring-2 ring-[#22C55E]/30'
            : activeImageUrl
            ? 'border-zinc-800 bg-[#0d0d0d]'
            : 'border-dashed border-zinc-700/80 bg-zinc-900/40 hover:border-zinc-500 hover:bg-zinc-900/70 cursor-pointer'
        } ${isUploading ? 'pointer-events-none opacity-90' : ''}`}
      >
        {/* Uploading State */}
        {isUploading ? (
          <div className={`w-full ${previewHeight} flex flex-col items-center justify-center gap-3 py-6`}>
            <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/10 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E] animate-pulse">
              <Loader2 className="w-6 h-6 animate-spin text-[#22C55E]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white tracking-wide">{uploadProgressText}</p>
              <p className="text-xs text-zinc-400 mt-0.5">Optimizing & saving securely...</p>
            </div>
          </div>
        ) : activeImageUrl ? (
          /* Preview State */
          <div className="w-full flex flex-col items-center gap-4 py-2">
            <div
              className={`relative w-full ${previewHeight} rounded-xl overflow-hidden bg-black/60 border border-zinc-800/80 flex items-center justify-center group`}
            >
              <img
                src={activeImageUrl}
                alt="Uploaded preview"
                className={`w-full h-full object-contain ${
                  aspectRatio === 'square' ? 'max-w-xs' : 'max-w-full'
                }`}
                onError={(e) => {
                  // Fallback if image fails to render
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                <button
                  type="button"
                  onClick={handleChooseImageClick}
                  disabled={disabled}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900/90 text-white hover:bg-zinc-800 text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 shadow-lg cursor-pointer transition-transform hover:scale-105"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#22C55E]" />
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={disabled}
                  className="px-3 py-1.5 rounded-lg bg-red-950/90 text-red-300 hover:bg-red-900/90 text-xs font-semibold flex items-center gap-1.5 border border-red-800 shadow-lg cursor-pointer transition-transform hover:scale-105"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  Remove
                </button>
              </div>
            </div>

            {/* Preview Action Buttons */}
            <div className="flex items-center gap-2.5 w-full justify-center">
              <button
                type="button"
                onClick={handleChooseImageClick}
                disabled={disabled}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border border-zinc-700 shadow-sm transition-all cursor-pointer hover:border-zinc-500"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#22C55E]" />
                {changeButtonText}
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="px-4 py-2 rounded-xl bg-red-950/40 hover:bg-red-950/80 text-red-300 hover:text-red-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border border-red-900/60 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                {removeButtonText}
              </button>
            </div>
          </div>
        ) : (
          /* Empty / Upload State */
          <div className="w-full flex flex-col items-center text-center py-6 px-4 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:scale-105 transition-all shadow-inner">
              <Camera className="w-7 h-7 text-[#22C55E]" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-white tracking-wide">{sublabel}</p>
              <p className="text-xs text-zinc-400">Drag and drop file here, or click button below</p>
            </div>

            <button
              type="button"
              onClick={handleChooseImageClick}
              disabled={disabled}
              className="mt-1 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[#22C55E] hover:text-[#22C55E] text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-zinc-700 hover:border-[#22C55E]/50 transition-all shadow-md cursor-pointer hover:scale-102"
            >
              <UploadCloud className="w-4 h-4 text-[#22C55E]" />
              Choose Image
            </button>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-zinc-500">
              <span className="bg-zinc-800/60 px-2 py-0.5 rounded text-zinc-400 font-mono">JPG, PNG or WEBP</span>
              <span>•</span>
              <span className="bg-zinc-800/60 px-2 py-0.5 rounded text-zinc-400 font-mono">Maximum 5MB</span>
            </div>
          </div>
        )}
      </div>

      {/* Validation Error Message */}
      {validationError && (
        <div className="flex items-center gap-2 p-2.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
};
