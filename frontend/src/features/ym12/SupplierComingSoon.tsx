import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
export function SupplierComingSoon({ title = 'Supplier profile coming soon' }: { title?: string }) {
  const navigate = useNavigate();
  return <div className="ym12-state-wrap"><EmptyState title={title}
    description={title === 'Performance page coming soon'
      ? 'Supplier performance details will be available soon.'
      : 'Supplier profile, comparison, and performance pages are being prepared for the YM12 module.'}
    action={<Button variant="outline" onClick={() => navigate('/buyer/produce')}>Back to produce</Button>} /></div>;
}
