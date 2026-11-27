import { useLocation } from 'react-router-dom';
import DeliveryHistory from './DeliveryHistory';
import DeliveryDetails from './DeliveryDetails';
import DeliveryHandover from './DeliveryHandover';
import IncidentsList from './IncidentsList';
import ReportIncident from './ReportIncident';

export default function YM24() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean); // ['driver','history','1041']
  const section = parts[1];
  const sub = parts[2];

  if (section === 'history') {
    return sub ? <DeliveryDetails tripId={sub} /> : <DeliveryHistory />;
  }
  if (section === 'handover') {
    return <DeliveryHandover />;
  }
  if (section === 'incidents') {
    return sub === 'new' ? <ReportIncident /> : <IncidentsList />;
  }
  return <p>Page not found.</p>;
}