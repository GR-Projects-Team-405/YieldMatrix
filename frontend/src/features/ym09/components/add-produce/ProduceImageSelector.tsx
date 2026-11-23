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
      {/* Thumbnail and Upload Dropzone Row (Matching Screenshot) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '90px 1fr',
          gap: '12px',
          alignItems: 'stretch',
        }}
      >
        {/* Active Selected Image Thumbnail with Active Indicator */}
        <div
          style={{
            position: 'relative',
            width: '90px',
            height: '90px',
            borderRadius: '14px',
            overflow: 'hidden',
            border: '2px solid var(--green)',
            boxShadow: '0 2px 8px rgba(49, 90, 66, 0.15)',
          }}
        >
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
          {/* Active check indicator badge */}
          <div
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              color: 'var(--green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}
            title="Selected agricultural placeholder"
          >
            <Check size={12} strokeWidth={3} />
          </div>
        </div>

        {/* Illustrative Upload Dropzone Box (Matching Screenshot) */}
        <div
          title="Image upload is scheduled for a future backend storage stage. Local verified placeholder is active."
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '14px',
            border: '2px dashed #a3c4a8',
            backgroundColor: 'rgba(234, 242, 232, 0.4)',
            padding: '12px',
            textAlign: 'center',
            cursor: 'default',
            userSelect: 'none',
          }}
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
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
                style={{
                  padding: 0,
                  margin: 0,
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: isSelected ? '2px solid var(--green)' : '1px solid var(--border)',
                  background: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  opacity: isSelected ? 1 : 0.7,
                  transition: 'opacity 0.15s, border 0.15s',
                }}
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
