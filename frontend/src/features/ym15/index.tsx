import { ContentCard } from '../../components/ContentCard';
// YM15 · Nadisha Buddhini · Bulk matching
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Bulk matching request", "Complete match results", "Grower allocation breakdown", "Partial match and shortage results"];
export default function YM15() {
  return <ContentCard title="YM15 · Bulk matching" subtitle="Owner: Nadisha Buddhini">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
