import { useEffect, useRef, useState } from 'react';
import { ImageOff, Trash2, Upload, X } from 'lucide-react';
import { IMAGE_UNAVAILABLE_MESSAGE } from '../../constants/produceConstants';

export interface ProduceImageSelectorProps {
  mode?: 'create' | 'edit';
  imageUrl?: string;
  imageStorageEnabled?: boolean;
  selectedFile: File | null;
  hasExistingImage: boolean;
  imageError: string | null;
  uploadProgress: number | null;
  isUploading: boolean;
  isRemoving: boolean;
  disabled?: boolean;
  onSelectFile: (file: File | null) => void;
  onClearSelectedFile: () => void;
  onRemoveExistingImage: () => Promise<void>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Interactive produce image picker & preview supporting JPEG/PNG/WebP uploads to Cloudinary,
 * upload progress, replacement preview, and confirmed removal of persisted images.
 */
export function ProduceImageSelector({
  mode = 'create',
  imageUrl,
  imageStorageEnabled = true,
  selectedFile,
  hasExistingImage,
  imageError,
  uploadProgress,
  isUploading,
  isRemoving,
  disabled = false,
  onSelectFile,
  onClearSelectedFile,
  onRemoveExistingImage,
}: ProduceImageSelectorProps) {
  const [previewLoadError, setPreviewLoadError] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewLoadError(false);
  }, [imageUrl]);

  useEffect(() => {
    if (!hasExistingImage) {
      setConfirmRemoveOpen(false);
    }
  }, [hasExistingImage]);

  const hasValidImage = Boolean(!previewLoadError && imageUrl);
  const busy = disabled || isUploading || isRemoving;
  const uploadDisabled = !imageStorageEnabled || busy;

  const statusBadgeText = !imageStorageEnabled
    ? 'Temporarily unavailable'
    : selectedFile
      ? 'Ready to upload'
      : hasExistingImage
        ? 'Saved image'
        : 'Optional';

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    onSelectFile(file);
    // Reset input value so picking the same file again after clearing works cleanly
    e.target.value = '';
  };

  const handleConfirmRemove = async () => {
    await onRemoveExistingImage();
    setConfirmRemoveOpen(false);
  };

  return (
    <section
      className="ym-content-card ym09-form-section"
      aria-label="Produce image upload and preview"
    >
      <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <strong style={{ fontSize: '14px', color: 'var(--text)' }}>Produce Image</strong>
          <span className="ym09-image-status-pill">{statusBadgeText}</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileInputChange}
          disabled={uploadDisabled}
          aria-label="Upload produce image"
          style={{ display: 'none' }}
        />

        <div className="ym09-image-unavailable-card">
          {hasValidImage ? (
            <img
              src={imageUrl}
              alt={selectedFile ? `Selected preview: ${selectedFile.name}` : 'Produce listing'}
              onError={() => setPreviewLoadError(true)}
              style={{
                width: '100%',
                height: '156px',
                objectFit: 'cover',
                borderRadius: '10px',
                display: 'block',
              }}
            />
          ) : (
            <div className="ym09-image-unavailable-content">
              <ImageOff size={24} color="var(--muted)" aria-hidden="true" />
              <span className="ym09-image-unavailable-text">{IMAGE_UNAVAILABLE_MESSAGE}</span>
              <span className="ym09-image-unavailable-subtext">
                {imageStorageEnabled
                  ? 'Select a JPEG, PNG, or WebP photo (max 5 MB).'
                  : 'Image upload is temporarily unavailable until database support (listings.image_key) is enabled.'}
              </span>
            </div>
          )}
        </div>

        {!imageStorageEnabled && (
          <div className="ym09-image-disabled-banner" role="status">
            Image upload is temporarily unavailable until database support (<code>listings.image_key</code>) is enabled. You can continue saving listings without an image.
          </div>
        )}

        {selectedFile && (
          <div className="ym09-image-file-meta">
            <span className="ym09-image-file-name" title={selectedFile.name}>
              {selectedFile.name}
            </span>
            <span className="ym09-image-file-size">{formatFileSize(selectedFile.size)}</span>
          </div>
        )}

        {isUploading && (
          <div className="ym09-upload-progress-wrap" role="status" aria-live="polite">
            <div className="ym09-upload-progress-label">
              <span>Uploading image to storage...</span>
              <span>{uploadProgress ?? 0}%</span>
            </div>
            <div className="ym09-upload-progress-track">
              <div
                className="ym09-upload-progress-bar"
                style={{ width: `${Math.min(100, Math.max(0, uploadProgress ?? 0))}%` }}
              />
            </div>
          </div>
        )}

        {imageError && (
          <div className="ym09-image-error-box" role="alert">
            {imageError}
          </div>
        )}

        {confirmRemoveOpen ? (
          <div className="ym09-image-confirm-remove" role="alertdialog" aria-label="Confirm remove produce image">
            <p className="ym09-image-confirm-text">
              Remove the saved image from this listing?
            </p>
            <div className="ym09-image-actions-row">
              <button
                type="button"
                className="ym09-image-btn ym09-image-btn-secondary"
                onClick={() => setConfirmRemoveOpen(false)}
                disabled={isRemoving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ym09-image-btn ym09-image-btn-danger"
                onClick={handleConfirmRemove}
                disabled={isRemoving}
              >
                {isRemoving ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        ) : (
          <div className="ym09-image-actions-row">
            <button
              type="button"
              className="ym09-image-btn ym09-image-btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadDisabled}
            >
              <Upload size={14} aria-hidden="true" />
              <span>
                {!imageStorageEnabled
                  ? 'Upload Unavailable'
                  : hasExistingImage || selectedFile
                    ? 'Replace Image'
                    : 'Choose Image'}
              </span>
            </button>

            {selectedFile && imageStorageEnabled && (
              <button
                type="button"
                className="ym09-image-btn ym09-image-btn-secondary"
                onClick={onClearSelectedFile}
                disabled={busy}
              >
                <X size={14} aria-hidden="true" />
                <span>Clear</span>
              </button>
            )}

            {mode === 'edit' && hasExistingImage && !selectedFile && imageStorageEnabled && (
              <button
                type="button"
                className="ym09-image-btn ym09-image-btn-danger-outline"
                onClick={() => setConfirmRemoveOpen(true)}
                disabled={busy}
              >
                <Trash2 size={14} aria-hidden="true" />
                <span>Remove</span>
              </button>
            )}
          </div>
        )}

        <span className="ym09-image-helper-note">
          {imageStorageEnabled
            ? 'Allowed: JPEG, PNG, WebP • Max 5 MB. Stored securely via Cloudinary.'
            : 'Cloudinary integration is configured on the server and will activate once listings.image_key is added.'}
        </span>
      </div>
    </section>
  );
}
