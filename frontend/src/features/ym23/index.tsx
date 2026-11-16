import { ContentCard } from '../../components/ContentCard';
// YM23 · Sandeepa Subashini · Pickup management
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Pickup stops", "Pickup stop details", "Record pickup", "Pickup history"];
export default function YM23() {
  return <ContentCard title="YM23 · Pickup management" subtitle="Owner: Sandeepa Subashini">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
