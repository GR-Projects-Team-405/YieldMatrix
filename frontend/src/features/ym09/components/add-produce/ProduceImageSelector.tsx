import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { IMAGE_UNAVAILABLE_MESSAGE } from '../../constants/produceConstants';

interface ProduceImageSelectorProps {
  imageUrl?: string;
}

/**
 * Displays the current listing image status without synthetic placeholder artwork
 * or unimplemented upload controls.
 */
export function ProduceImageSelector({ imageUrl }: ProduceImageSelectorProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  const hasValidImage = Boolean(!imageError && imageUrl);

  return (
    <section
      className="ym-content-card ym09-form-section"
      aria-label="Produce image status"
    >
      <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <strong style={{ fontSize: '14px', color: 'var(--text)' }}>Produce Image</strong>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Backend media pending</span>
        </div>

        <div className="ym09-image-unavailable-card">
          {hasValidImage ? (
            <img
              src={imageUrl}
              alt="Produce listing"
              onError={() => setImageError(true)}
              style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '10px', display: 'block' }}
            />
          ) : (
            <div className="ym09-image-unavailable-content">
              <ImageOff size={24} color="var(--muted)" aria-hidden="true" />
              <span className="ym09-image-unavailable-text">{IMAGE_UNAVAILABLE_MESSAGE}</span>
              <span className="ym09-image-unavailable-subtext">
                Image upload and storage will be integrated in a future release.
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
