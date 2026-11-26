import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';

type Demand = {
  id: string;
  crop_name: string;
  grade_name: string;
  quantity_kg: string;
  destination: string;
  destination_district: string;
  delivery_from: string;
  delivery_until: string;
  budget_cents: string | number | null;
  allow_partial: boolean;
  status: string;
};

export default function EditDemand() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cropGrade, setCropGrade] = useState({ crop: '', grade: '' });

  const [formData, setFormData] = useState({
    quantity_kg: '',
    destination: '',
    destination_district: '',
    delivery_from: '',
    delivery_until: '',
    budget_lkr: '',
    allow_partial: false,
  });

  // Load existing demand and pre-fill the form
  useEffect(() => {
    let active = true;
    api.get<{ demand: Demand }>(`/ym13/demands/${id}`)
      .then(({ data }) => {
        if (!active) return;
        const d = data.demand;
        setCropGrade({ crop: d.crop_name, grade: d.grade_name });
        setFormData({
          quantity_kg: d.quantity_kg,
          destination: d.destination,
          destination_district: d.destination_district,
          delivery_from: (d.delivery_from || '').slice(0, 10),
          delivery_until: (d.delivery_until || '').slice(0, 10),
          budget_lkr: d.budget_cents ? String(Number(d.budget_cents) / 100) : '',
          allow_partial: d.allow_partial,
        });
      })
      .catch(() => { if (active) setError('Could not load the demand to edit.'); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [id]);

  // Proven setField pattern (works with InputField)
  const setField = (field: string, e: any) => {
    const raw = e?.target?.value !== undefined ? e.target.value : e;
    const checked = e?.target?.type === 'checkbox' ? e.target.checked : undefined;
    setFormData((prev) => ({ ...prev, [field]: checked !== undefined ? checked : raw }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.patch(`/ym13/demands/${id}`, formData);
      navigate(`/buyer/demands/${id}`); // back to details after save
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update demand.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="p-8 text-gray-500">Loading demand...</p>;
  if (error && !formData.destination) return <Alert type="error">{error}</Alert>;

  return (
    <ContentCard title="Edit Demand" subtitle="Update the details of your open demand.">
      {error && formData.destination && <Alert type="error" className="mb-6">{error}</Alert>}

      {/* Read-only identity fields */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl bg-[#F6F7F3] p-4">
        <div>
          <span className="block text-sm font-medium text-gray-500">Crop</span>
          <span className="text-base font-semibold text-[#263A31]">{cropGrade.crop}</span>
        </div>
        <div>
          <span className="block text-sm font-medium text-gray-500">Grade</span>
          <span className="text-base font-semibold text-[#263A31]">{cropGrade.grade}</span>
        </div>
        <p className="md:col-span-2 text-xs text-gray-500">
          Crop and grade cannot be changed once offers have been received.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Quantity & Budget */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField
            label="Required Quantity"
            type="number"
            unit="kg"
            min="0"
            step="0.001"
            value={formData.quantity_kg}
            onChange={(e: any) => setField('quantity_kg', e)}
            required
          />
          <InputField
            label="Maximum Budget (Optional)"
            type="number"
            unit="LKR/kg"
            min="0"
            step="0.01"
            value={formData.budget_lkr}
            onChange={(e: any) => setField('budget_lkr', e)}
          />
        </div>

        {/* Destination & District */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField
            label="Destination Address"
            type="text"
            value={formData.destination}
            onChange={(e: any) => setField('destination', e)}
            required
          />
          <InputField
            label="Destination District"
            type="text"
            value={formData.destination_district}
            onChange={(e: any) => setField('destination_district', e)}
            required
          />
        </div>

        {/* Delivery Window */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField
            label="Delivery From"
            type="date"
            value={formData.delivery_from}
            onChange={(e: any) => setField('delivery_from', e)}
            required
          />
          <InputField
            label="Delivery Until"
            type="date"
            value={formData.delivery_until}
            onChange={(e: any) => setField('delivery_until', e)}
            required
          />
        </div>

        {/* Partial Fulfillment */}
        <div className="flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id="allow_partial"
            checked={formData.allow_partial}
            onChange={(e) => setField('allow_partial', e)}
            className="h-5 w-5 rounded border-gray-300 text-[#315A42] focus:ring-[#315A42]"
          />
          <label htmlFor="allow_partial" className="text-sm font-medium text-[#263A31]">
            Allow partial fulfillment
          </label>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
          <Button variant="outline" type="button" onClick={() => navigate(`/buyer/demands/${id}`)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </ContentCard>
  );
}