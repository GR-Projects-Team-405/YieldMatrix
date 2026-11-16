import { ContentCard } from '../../components/ContentCard';
// YM11 · Meranga Akash · Buyer marketplace
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Buyer / Shop dashboard", "Marketplace", "Search and filtered results", "Harvest availability"];
export default function YM11() {
  return <ContentCard title="YM11 · Buyer marketplace" subtitle="Owner: Meranga Akash">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
