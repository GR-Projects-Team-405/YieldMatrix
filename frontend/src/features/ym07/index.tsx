import { ContentCard } from '../../components/ContentCard';
// YM07 · Hathiff Haleem · Farm management
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["My farms", "Farm details", "Add farm", "Edit farm"];
export default function YM07() {
  return <ContentCard title="YM07 · Farm management" subtitle="Owner: Hathiff Haleem">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
