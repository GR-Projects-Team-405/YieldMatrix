import { ContentCard } from '../../components/ContentCard';
// YM20 · Praveena Buddini · Order & transaction records
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Transaction history", "Transaction details", "Order summary", "Allocation settlement details"];
export default function YM20() {
  return <ContentCard title="YM20 · Order &amp; transaction records" subtitle="Owner: Praveena Buddini">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
