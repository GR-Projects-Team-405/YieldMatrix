import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';

export default function CreateDemand() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    crop_name: '',
    grade_name: '',
    quantity_kg: '',
    destination: '',
    destination_district: '',
    delivery_from: '',
    delivery_until: '',
    budget_lkr: '',
    allow_partial: false,
  });

  const cropOptions = ['Tomato', 'Carrot', 'Cabbage', 'Potato', 'Beans'];
  const gradeOptions = ['Grade A', 'Grade B', 'Grade C'];

  // Works for both event objects and raw values
  const setField = (field: string, e: any) => {
    const raw = e?.target?.value !== undefined ? e.target.value : e;
    const checked = e?.target?.type === 'checkbox' ? e.target.checked : undefined;
    setFormData((prev) => ({
      ...prev,
      [field]: checked !== undefined ? checked : raw,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    console.log('🚀 FRONTEND SENDING TO BACKEND:', formData);
    setLoading(true);
    try {
      await api.post('/ym13/demands', formData);
      navigate('/buyer/demands');
    } catch (err: any) {
      console.error('API Error:', err.response?.data);
      setError(err.response?.data?.error || 'Failed to create demand.');
    } finally {
      setLoading(false);
    }
  };

  // Shared styling for native selects to match the design system
  const selectClass =
    'h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-[15px] text-[#263A31] ' +
    'focus:border-[#315A42] focus:outline-none focus:ring-2 focus:ring-[#315A42]/30';

  return (
    <ContentCard title="Create New Demand" subtitle="Specify what you need and farmers will send you offers.">
      {error && <Alert type="error" className="mb-6">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Row 1: Crop & Grade — native controlled selects */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="crop_name" className="block mb-2 text-sm font-medium text-[#263A31]">Crop</label>
            <select
              id="crop_name"
              className={selectClass}
              value={formData.crop_name}
              onChange={(e) => setField('crop_name', e)}
              required
            >
              <option value="" disabled>Select a crop</option>
              {cropOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="grade_name" className="block mb-2 text-sm font-medium text-[#263A31]">Grade</label>
            <select
              id="grade_name"
              className={selectClass}
              value={formData.grade_name}
              onChange={(e) => setField('grade_name', e)}
              required
            >
              <option value="" disabled>Select a grade</option>
              {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Quantity & Budget */}
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

        {/* Row 3: Destination & District */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField
            label="Destination Address"
            type="text"
            placeholder="e.g., 123 Main Street, Colombo"
            value={formData.destination}
            onChange={(e: any) => setField('destination', e)}
            required
          />
          <InputField
            label="Destination District"
            type="text"
            placeholder="e.g., Colombo"
            value={formData.destination_district}
            onChange={(e: any) => setField('destination_district', e)}
            required
          />
        </div>

        {/* Row 4: Delivery Window */}
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

        {/* Row 5: Partial Fulfillment */}
        <div className="flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id="allow_partial"
            checked={formData.allow_partial}
            onChange={(e) => setField('allow_partial', e)}
            className="h-5 w-5 rounded border-gray-300 text-[#315A42] focus:ring-[#315A42]"
          />
          <label htmlFor="allow_partial" className="text-sm font-medium text-[#263A31]">
            Allow partial fulfillment (Accept multiple smaller offers to meet the total quantity)
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
          <Button variant="outline" type="button" onClick={() => navigate('/buyer/demands')} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Post Demand'}
          </Button>
        </div>
      </form>
    </ContentCard>
  );
}