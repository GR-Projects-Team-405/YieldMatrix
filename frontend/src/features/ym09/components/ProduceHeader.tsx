import { Plus } from 'lucide-react';
import { Button } from '../../../components/Button';

interface ProduceHeaderProps {
  onAddClick?: () => void;
}

/**
 * Subbar / Header action row for the My Produce page.
 *
 * WorkspaceLayout already provides the primary semantic `<div className="page-heading"><h1>My produce</h1></div>`.
 * To avoid duplicate H1 headings without modifying WorkspaceLayout, this component renders
 * the page description and the "+ Add Produce" action button.
 *
 * In accordance with Phase 2 instructions, the "+ Add Produce" action
 * is explicitly disabled with an accessible tooltip because the Add Listing
 * workflow is scheduled for future development stage YM09-02.
 */
export function ProduceHeader({ onAddClick }: ProduceHeaderProps) {
  return (
    <div
      className="ym09-produce-header-row"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginTop: '-12px',
        marginBottom: '4px',
      }}
    >
      <p
        style={{
          color: 'var(--muted)',
          fontSize: '14px',
          lineHeight: 1.6,
          maxWidth: '760px',
          margin: 0,
        }}
      >
        Manage verified harvested stock, track market commitments, and publish active trade listings across certified Sri Lankan facilities.
      </p>

      <div style={{ flexShrink: 0 }}>
        <Button
          variant="primary"
          disabled
          title="Add Produce Listing workflow is scheduled for future stage YM09-02"
          onClick={onAddClick}
          aria-label="Add Produce (Scheduled for future stage)"
          style={{
            height: '48px',
            borderRadius: '12px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'not-allowed',
            opacity: 0.85,
          }}
        >
          <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
          <span>Add Produce</span>
        </Button>
      </div>
    </div>
  );
}
