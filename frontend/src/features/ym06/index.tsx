import { ContentCard } from '../../components/ContentCard';
// YM06 · Eshan Harshana · Farmer overview
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Farmer dashboard", "Sales performance", "Upcoming harvest overview", "Completed orders overview"];
export default function YM06() {
  return <ContentCard title="YM06 · Farmer overview" subtitle="Owner: Eshan Harshana">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
