import { Link } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';

export default function AddFarm() {
  return (
    <ContentCard title="Add farm">
      <p>The farm registration form will appear here.</p>
      <Link to="/farmer/farms">Back to My farms</Link>
    </ContentCard>
  );
}
