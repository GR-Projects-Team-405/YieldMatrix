import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { Table, TableRow } from '../../components/Table';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { ConfirmDialog } from '../../components/ConfirmDialog';

type Response = {
  id: string;
  farmer_name: string;
  farm_name: string;
  quantity_kg: string;
  unit_price_cents: string; // Postgres BIGINT returns as string
  planned_harvest_date: string;
  status: string;
  created_at: string;
};

export default function DemandResponses() {
  const { id } = useParams<{ id: string }>(); // demandId
  const navigate = useNavigate();
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State for the confirmation dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<{ id: string; action: 'accepted' | 'rejected' } | null>(null);

  const fetchResponses = () => {
    setLoading(true);
    api.get<{ responses: Response[] }>(`/ym13/demands/${id}/responses`)
      .then(({ data }) => setResponses(data.responses))
      .catch(() => setError('Could not load responses.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchResponses();
  }, [id]);

  const handleActionClick = (offerId: string, action: 'accepted' | 'rejected') => {
    setSelectedOffer({ id: offerId, action });
    setDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedOffer) return;
    setDialogOpen(false);
    
    try {
      await api.patch(`/ym13/demands/${id}/responses/${selectedOffer.id}`, { action: selectedOffer.action });
      // Refresh the list to show the new status
      fetchResponses(); 
    } catch (err) {
      setError(`Failed to ${selectedOffer.action} offer.`);
    }
  };

  // Helper to format LKR cents to LKR
  const formatLKR = (centsStr: string) => {
    const cents = Number(centsStr);
    if (isNaN(cents)) return 'N/A';
    return `LKR ${(cents / 100).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
  };

  if (loading) return <p className="p-8 text-gray-500">Loading responses...</p>;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <ContentCard title="Farmer Responses" subtitle={`Reviewing offers for Demand #${id?.substring(0, 8)}...`}>
      <div className="mb-6">
        <Button variant="outline" onClick={() => navigate(`/buyer/demands/${id}`)}>
          ← Back to Demand Details
        </Button>
      </div>

      {responses.length === 0 ? (
        <Alert type="info">No farmers have responded to this demand yet.</Alert>
      ) : (
        <Table headers={['Farmer', 'Farm', 'Quantity', 'Price/kg', 'Harvest Date', 'Status', 'Actions']}>
          {responses.map((res) => (
            <TableRow key={res.id}>
              <td className="p-3 font-medium text-[#263A31]">{res.farmer_name}</td>
              <td className="p-3 text-gray-600">{res.farm_name}</td>
              <td className="p-3">{res.quantity_kg} kg</td>
              <td className="p-3 font-semibold text-[#315A42]">{formatLKR(res.unit_price_cents)}</td>
              <td className="p-3 text-sm text-gray-500">
                {res.planned_harvest_date ? new Date(res.planned_harvest_date).toLocaleDateString() : 'N/A'}
              </td>
              <td className="p-3">
                <StatusBadge status={res.status} />
              </td>
              <td className="p-3">
                {res.status === 'pending' ? (
                  <div className="flex gap-2">
                    <Button 
                      variant="primary" 
                      onClick={() => handleActionClick(res.id, 'accepted')}
                    >
                      Accept
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleActionClick(res.id, 'rejected')}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">No actions</span>
                )}
              </td>
            </TableRow>
          ))}
        </Table>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={dialogOpen}
        title={selectedOffer?.action === 'accepted' ? 'Accept Offer?' : 'Reject Offer?'}
        message={
          selectedOffer?.action === 'accepted' 
            ? 'Are you sure you want to accept this farmer\'s offer? This will move it to the next stage.' 
            : 'Are you sure you want to reject this offer? This action cannot be undone.'
        }
        onCancel={() => setDialogOpen(false)}
        onConfirm={confirmAction}
        confirmText={selectedOffer?.action === 'accepted' ? 'Yes, Accept' : 'Yes, Reject'}
        confirmVariant={selectedOffer?.action === 'accepted' ? 'primary' : 'danger'}
      />
    </ContentCard>
  );
}