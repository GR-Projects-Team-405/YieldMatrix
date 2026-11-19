import { Link } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';

export default function EditFarm() {
  return (
    <ContentCard title="Edit farm">
      <p>The farm editing form will appear here.</p>
      <Link to=".." relative="path">Back to farm details</Link>
    </ContentCard>
  );
}
