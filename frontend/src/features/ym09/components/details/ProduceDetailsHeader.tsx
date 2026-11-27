import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProduceDetailsHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
}

export function ProduceDetailsHeader({
  title = 'Produce Listing Details',
  subtitle = 'Complete information about this produce listing.',
  onBack,
}: ProduceDetailsHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/farmer/produce');
    }
  };

  return (
    <div className="ym09-details-header">
      <button
        type="button"
        onClick={handleBack}
        className="ym09-details-back-btn"
        aria-label="Back to My Produce"
        title="Back to My Produce"
      >
        <ArrowLeft size={20} aria-hidden="true" />
      </button>

      <div className="ym09-details-title-wrap">
        <h1 className="ym09-details-page-title">{title}</h1>
        <p className="ym09-details-page-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
