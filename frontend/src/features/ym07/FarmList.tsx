import { Link } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';

export default function FarmList() {
  return (
    <ContentCard title="My farms">
      <p>Farm records will appear here when the farm API is connected.</p>
      <Link to="new">Add farm</Link>
    </ContentCard>
  );
}
