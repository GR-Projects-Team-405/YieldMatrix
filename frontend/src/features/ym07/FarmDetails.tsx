import { Link } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';

export default function FarmDetails() {
  return (
    <ContentCard title="Farm details">
      <p>Farm details will appear here when the farm API is connected.</p>
      <ul>
        <li><Link to="edit">Edit farm</Link></li>
        <li><Link to="/farmer/farms">Back to My farms</Link></li>
      </ul>
    </ContentCard>
  );
}
