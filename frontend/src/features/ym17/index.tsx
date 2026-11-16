import { ContentCard } from '../../components/ContentCard';
// YM17 · Nimesh De Alwis · Farmer allocations
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Allocation inbox", "Allocation details", "Allocation decision review", "Allocation history"];
export default function YM17() {
  return <ContentCard title="YM17 · Farmer allocations" subtitle="Owner: Nimesh De Alwis">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
