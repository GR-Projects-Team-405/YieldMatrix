import { ContentCard } from '../../components/ContentCard';
// YM02 · Ashen Ranasingha · Login & account access
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Admin signup and login", "Forgot password of all roles", "Reset password of all roles", "Account access status"];
export default function YM02() {
  return <ContentCard title="YM02 · Login &amp; account access" subtitle="Owner: Ashen Ranasingha">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
