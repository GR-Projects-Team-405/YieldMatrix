import { ContentCard } from '../../components/ContentCard';
// YM26 · Shermi Weerasinghe · Admin operations
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Order operations", "Dispatch and driver assignment", "Incident review", "Dispute resolution"];
export default function YM26() {
  return <ContentCard title="YM26 · Admin operations" subtitle="Owner: Shermi Weerasinghe">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
