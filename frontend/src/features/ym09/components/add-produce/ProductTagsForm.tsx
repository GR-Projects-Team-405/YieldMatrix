import { useState } from 'react';
import { Tag, Plus, X } from 'lucide-react';
import { Button } from '../../../../components/Button';

interface ProductTagsFormProps {
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function ProductTagsForm({ tags, onAddTag, onRemoveTag }: ProductTagsFormProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTagText, setNewTagText] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagText.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAddTag(trimmed);
      setNewTagText('');
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTagText('');
    }
  };

  return (
    <section className="ym-content-card ym09-form-section">
      {/* Standardized Section Header Banner */}
      <div className="ym09-section-badge">
        <span className="ym09-section-badge-num">4</span>
        <Tag size={16} aria-hidden="true" />
        <span>Product Tags</span>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
          justifyContent: 'space-between',
        }}
      >
        {/* Tags List */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '999px',
                backgroundColor: 'var(--canvas)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                title={`Remove ${tag} tag`}
                aria-label={`Remove ${tag} tag`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: 'var(--muted)',
                  borderRadius: '50%',
                }}
              >
                <X size={14} />
              </button>
            </span>
          ))}

          {/* Inline Add Tag Input */}
          {isAdding && (
            <form onSubmit={handleAddSubmit} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="text"
                autoFocus
                placeholder="Tag name..."
                value={newTagText}
                onChange={(e) => setNewTagText(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  height: '38px',
                  borderRadius: '19px',
                  border: '1px solid var(--control-border)',
                  padding: '0 12px',
                  fontSize: '13px',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text)',
                  width: '130px',
                }}
              />
              <Button type="submit" variant="primary" style={{ height: '38px', padding: '0 12px', borderRadius: '19px', fontSize: '13px' }}>
                Add
              </Button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                aria-label="Cancel adding tag"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={16} />
              </button>
            </form>
          )}
        </div>

        {/* Add Tag Button */}
        {!isAdding && (
          <Button
            type="button"
            variant="primary"
            onClick={() => setIsAdding(true)}
            style={{
              height: '40px',
              borderRadius: '20px',
              fontWeight: 600,
              padding: '0 16px',
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
            <span>Add tag</span>
          </Button>
        )}
      </div>

      <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '16px', lineHeight: 1.5, margin: '16px 0 0 0' }}>
        Tags enhance marketplace discovery across buyers searching for specific agricultural attributes.
      </p>
    </section>
  );
}
