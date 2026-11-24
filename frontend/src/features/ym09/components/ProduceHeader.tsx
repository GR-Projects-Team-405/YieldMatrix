import { useNavigate } from 'react-router-dom';
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
 * In Phase 2, "+ Add Produce" navigates to the Add Produce Listing page (/farmer/produce/new).
 */
export function ProduceHeader({ onAddClick }: ProduceHeaderProps) {
  const navigate = useNavigate();

  const handleAdd = () => {
    if (onAddClick) {
      onAddClick();
    } else {
      navigate('/farmer/produce/new');
    }
  };

  return (
    <div className="ym09-produce-header-row">
      <p className="ym09-produce-header-desc">
        Manage verified harvested stock, track market commitments, and publish active trade listings across certified Sri Lankan facilities.
      </p>

      <div style={{ flexShrink: 0 }}>
        <Button
          variant="primary"
          title="Add a new produce listing from harvested batch stock"
          onClick={handleAdd}
          aria-label="Add Produce Listing"
        >
          <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
          <span>Add Produce</span>
        </Button>
      </div>
    </div>
  );
}
