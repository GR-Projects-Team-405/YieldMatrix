import { ContentCard } from '../../components/ContentCard';
import { useSearchParams } from 'react-router-dom';
import BuyerRegistration from './BuyerRegistration';
// YM03 · Chamalsha Induwara · Sign up & Login
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Choose account role", "Farmer sign up and login", "Buyer / Shop sign up and login", "Driver sign up and login", "Approval status"];
export default function YM03() {
  const [searchParams] = useSearchParams();
  if (searchParams.get('role') === 'buyer') return <BuyerRegistration />;
  return <ContentCard title="YM03 · Sign up &amp; Login" subtitle="Owner: Chamalsha Induwara">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
