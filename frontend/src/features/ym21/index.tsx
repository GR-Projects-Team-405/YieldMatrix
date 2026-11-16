import { ContentCard } from '../../components/ContentCard';
// YM21 · Rashmika Ravihara · Driver overview & vehicle
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Driver dashboard", "My vehicle", "Edit vehicle", "Driver availability"];
export default function YM21() {
  return <ContentCard title="YM21 · Driver overview &amp; vehicle" subtitle="Owner: Rashmika Ravihara">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
