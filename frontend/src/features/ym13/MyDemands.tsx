import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { Table, TableRow } from '../../components/Table';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Alert } from '../../components/Alert';

// Define the shape of the data we expect from the backend
type Demand = {
  id: string;
  crop_name: string;
  grade_name: string;
  quantity_kg: string;
  destination: string;
  status: string;
  created_at: string;
};

export default function MyDemands() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    
    // Call the backend API we just built
    api.get<{ demands: Demand[] }>('/ym13/demands')
      .then(({ data }) => {
        if (active) setDemands(data.demands);
      })
      .catch(() => {
        if (active) setError('Could not load demands. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; }; // Cleanup to prevent memory leaks
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Loading demands...</p>;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <ContentCard title="My Demands" subtitle="Manage your active and past produce requests">
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => navigate('/buyer/demands/new')}>
          Create New Demand
        </Button>
      </div>

      {demands.length === 0 ? (
        <EmptyState 
          title="No demands yet" 
          description="Create your first demand to start receiving offers from farmers." 
        />
      ) : (
        <Table 
          headers={['Crop', 'Grade', 'Quantity (kg)', 'Destination', 'Status', 'Date']}
        >
          {demands.map((demand) => (
            <TableRow 
              key={demand.id} 
              onClick={() => navigate(`/buyer/demands/${demand.id}`)}
              className="cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <td className="p-3 font-medium text-gray-900">{demand.crop_name}</td>
              <td className="p-3">{demand.grade_name}</td>
              <td className="p-3">{demand.quantity_kg}</td>
              <td className="p-3">{demand.destination}</td>
              <td className="p-3">
                <StatusBadge status={demand.status} />
              </td>
              <td className="p-3 text-sm text-gray-500">
                {new Date(demand.created_at).toLocaleDateString()}
              </td>
            </TableRow>
          ))}
        </Table>
      )}
    </ContentCard>
  );
}