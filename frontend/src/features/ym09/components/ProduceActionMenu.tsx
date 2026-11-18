import { useEffect, useRef, useState } from 'react';
import { Eye, MoreHorizontal, PauseCircle, Pencil, Trash2 } from 'lucide-react';

interface ProduceActionMenuProps {
  produceName: string;
}

/**
 * Context action menu for produce cards and table rows.
 *
 * In accordance with Phase 2 instructions, all action workflows
 * (View Details, Edit, Pause, Archive) are explicitly non-functional
 * and marked as disabled with helper text indicating they belong to
 * subsequent development stages.
 */
export function ProduceActionMenu({ produceName }: ProduceActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-label={`Actions for ${produceName}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--muted)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Produce listing actions"
          style={{
            position: 'absolute',
            right: 0,
            bottom: '100%',
            marginBottom: '6px',
            width: '240px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            padding: '6px',
            zIndex: 40,
            display: 'grid',
            gap: '2px',
          }}
        >
          <button
            type="button"
            role="menuitem"
            disabled
            title="Produce Listing Details is assigned for a future development stage"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'var(--muted)',
              background: 'none',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              cursor: 'not-allowed',
              opacity: 0.7,
            }}
          >
            <Eye size={14} aria-hidden="true" />
            <span>View details <small style={{ fontSize: '10px', color: 'var(--muted)' }}>(Stage YM09-04)</small></span>
          </button>

          <button
            type="button"
            role="menuitem"
            disabled
            title="Edit Produce Listing is assigned for a future development stage"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'var(--muted)',
              background: 'none',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              cursor: 'not-allowed',
              opacity: 0.7,
            }}
          >
            <Pencil size={14} aria-hidden="true" />
            <span>Edit listing <small style={{ fontSize: '10px', color: 'var(--muted)' }}>(Stage YM09-03)</small></span>
          </button>

          <button
            type="button"
            role="menuitem"
            disabled
            title="Pause Listing action requires backend workflow implementation"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'var(--muted)',
              background: 'none',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              cursor: 'not-allowed',
              opacity: 0.7,
            }}
          >
            <PauseCircle size={14} aria-hidden="true" />
            <span>Pause listing <small style={{ fontSize: '10px', color: 'var(--muted)' }}>(Pending backend)</small></span>
          </button>

          <button
            type="button"
            role="menuitem"
            disabled
            title="Archive action requires backend workflow implementation"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'var(--muted)',
              background: 'none',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              cursor: 'not-allowed',
              opacity: 0.7,
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>Archive <small style={{ fontSize: '10px', color: 'var(--muted)' }}>(Pending backend)</small></span>
          </button>
        </div>
      )}
    </div>
  );
}
