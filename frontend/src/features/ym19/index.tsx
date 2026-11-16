import { ContentCard } from '../../components/ContentCard';
// YM19 · Pasan Kalhara · Acceptance & disputes
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Delivery acceptance review", "Partial acceptance", "My disputes", "Dispute details"];
export default function YM19() {
  return <ContentCard title="YM19 · Acceptance &amp; disputes" subtitle="Owner: Pasan Kalhara">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
