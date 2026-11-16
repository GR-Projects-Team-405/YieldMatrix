import { ContentCard } from '../../components/ContentCard';
// YM09 · Imalka Randev · Produce listings
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["My produce", "Add produce listing", "Edit produce listing", "Produce listing details"];
export default function YM09() {
  return <ContentCard title="YM09 · Produce listings" subtitle="Owner: Imalka Randev">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
