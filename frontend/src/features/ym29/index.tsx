import { ContentCard } from '../../components/ContentCard';
// YM29 · Yasindu Janapriya · Market information
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Market insights", "Demand forecast details (7-day forecast)", "Price and weather advice", "Admin market data", "Data upload review"];
export default function YM29() {
  return <ContentCard title="YM29 · Market information" subtitle="Owner: Yasindu Janapriya">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
