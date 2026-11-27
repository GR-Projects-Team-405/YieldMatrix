import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';

type DemandDetails = {
  id: string;
  crop_name: string;
  grade_name: string;
  quantity_kg: string;
  destination: string;
  destination_district: string;
  delivery_from: string;
  delivery_until: string;
  budget_cents: number | null;
  allow_partial: boolean;
  status: string;
  created_at: string;
};

export default function DemandDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [demand, setDemand] = useState<DemandDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get<{ demand: DemandDetails }>(`/ym13/demands/${id}`)
      .then(({ data }) => {
        if (active) setDemand(data.demand);
      })
      .catch(() => {
        if (active) setError('Could not load demand details. It may not exist or you do not have permission.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [id]);

  if (loading) return <p className="p-8 text-gray-500">Loading details...</p>;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!demand) return <Alert type="error">Demand not found.</Alert>;

  // Helper to format LKR cents to LKR
  const formatLKR = (cents: number | null) => {
    if (!cents) return 'Not specified';
    return `LKR ${(cents / 100).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
  };

  return (
    <ContentCard title="Demand Details" subtitle={`ID: ${demand.id.substring(0, 8)}...`}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-[#263A31]">
          {demand.crop_name} - {demand.grade_name}
        </h2>
        <StatusBadge status={demand.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <DetailRow label="Required Quantity" value={`${demand.quantity_kg} kg`} />
        <DetailRow label="Maximum Budget" value={formatLKR(demand.budget_cents)} />
        <DetailRow label="Destination" value={demand.destination} />
        <DetailRow label="Destination District" value={demand.destination_district} />
        <DetailRow label="Delivery From" value={new Date(demand.delivery_from).toLocaleDateString()} />
        <DetailRow label="Delivery Until" value={new Date(demand.delivery_until).toLocaleDateString()} />
        <DetailRow 
          label="Partial Fulfillment" 
          value={demand.allow_partial ? 'Allowed' : 'Not Allowed'} 
        />
        <DetailRow 
          label="Created On" 
          value={new Date(demand.created_at).toLocaleDateString()} 
        />
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
        <Button variant="outline" onClick={() => navigate('/buyer/demands')}>
          Back to My Demands
        </Button>
        
        {/* Only show Edit button if the demand is still 'open' or 'draft' */}
        {(demand.status === 'open' || demand.status === 'draft') && (
          <Button variant="secondary" onClick={() => navigate(`/buyer/demands/${id}/edit`)}>
            Edit Demand
          </Button>
        )}

        <Button variant="primary" onClick={() => navigate(`/buyer/demands/${id}/responses`)}>
          View Farmer Responses
        </Button>
      </div>
    </ContentCard>
  );
}

// Simple helper component for clean layout
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium text-gray-500 mb-1">{label}</span>
      <span className="text-base font-semibold text-[#263A31]">{value}</span>
    </div>
  );
}