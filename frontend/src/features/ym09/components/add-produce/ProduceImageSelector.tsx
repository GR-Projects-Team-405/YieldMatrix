import { UploadCloud, Check } from 'lucide-react';
import { PRODUCE_PLACEHOLDERS } from '../../constants/produceConstants';
import type { ProducePlaceholderKey } from '../../types/produce';

interface ProduceImageSelectorProps {
  selectedKey: ProducePlaceholderKey;
  onSelectKey: (key: ProducePlaceholderKey) => void;
}

export function ProduceImageSelector({ selectedKey, onSelectKey }: ProduceImageSelectorProps) {
  const currentPlaceholder = PRODUCE_PLACEHOLDERS[selectedKey];

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {/* Thumbnail and Upload Dropzone Row */}
      <div className="ym09-image-selector-row">
        {/* Active Selected Image Thumbnail */}
        <div className="ym09-image-selected-box">
          <img
            src={currentPlaceholder.imageUrl}
            alt={currentPlaceholder.label}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: 'var(--surface)',
              color: 'var(--green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}
            title="Selected agricultural placeholder"
          >
            <Check size={12} strokeWidth={3} aria-hidden="true" />
          </div>
        </div>

        {/* Illustrative Upload Dropzone Box */}
        <div
          title="Image upload is scheduled for a future backend storage stage. Local verified placeholder is active."
          className="ym09-image-dropzone"
        >
          <UploadCloud size={24} color="var(--green)" aria-hidden="true" />
          <strong style={{ fontSize: '13px', color: 'var(--text)', marginTop: '4px' }}>
            Upload Images
          </strong>
          <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
            PNG, JPG (Max 5 MB)
          </span>
          <span style={{ fontSize: '10px', color: 'var(--accent-text)', marginTop: '2px', fontWeight: 500 }}>
            (Future stage • using verified placeholder)
          </span>
        </div>
      </div>

      {/* 5 Agricultural Placeholders Switcher */}
      <div>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--muted)',
            display: 'block',
            marginBottom: '8px',
          }}
        >
          Choose Agricultural Placeholder:
        </span>

        <div className="ym09-image-grid" role="group" aria-label="Choose agricultural placeholder image">
          {(Object.keys(PRODUCE_PLACEHOLDERS) as ProducePlaceholderKey[]).map((key) => {
            const item = PRODUCE_PLACEHOLDERS[key];
            const isSelected = selectedKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectKey(key)}
                title={`Select ${item.label}`}
                aria-label={`Select ${item.label}`}
                aria-pressed={isSelected}
                className={`ym09-image-option ${
                  isSelected ? 'ym09-image-option--selected' : ''
                }`}
              >
                <img
                  src={item.imageUrl}
                  alt={item.label}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
