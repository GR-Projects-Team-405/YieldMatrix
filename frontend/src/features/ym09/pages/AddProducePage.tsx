import { useNavigate } from 'react-router-dom';
import { ProduceListingForm } from '../components/add-produce/ProduceListingForm';

/**
 * Add Produce Listing Page (/farmer/produce/new)
 * Uses the shared ProduceListingForm in 'create' mode.
 */
export default function AddProducePage() {
  const navigate = useNavigate();

  return (
    <ProduceListingForm
      mode="create"
      pageTitle="Add Produce Listing"
      pageSubtitle="Publish a harvested product for buyers on the marketplace."
      submitButtonLabel="Publish Listing"
      onCancel={() => navigate('/farmer/produce')}
    />
  );
}
