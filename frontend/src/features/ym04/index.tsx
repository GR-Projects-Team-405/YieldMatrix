import { ContentCard } from '../../components/ContentCard';
// YM04 · Chamasha Saminidi Stuwart · Reference data & audit
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Reference data overview", "Crop management", "Grade management", "Audit trail", "Audit event details"];
export default function YM04() {
  return <ContentCard title="YM04 · Reference data &amp; audit" subtitle="Owner: Chamasha Saminidi Stuwart">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
