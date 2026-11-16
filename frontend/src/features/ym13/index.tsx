import { ContentCard } from '../../components/ContentCard';
// YM13 · Migara Wijesinghe · Buyer demands
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["My demands", "Create demand", "Edit demand", "Demand details", "Responses to a demand"];
export default function YM13() {
  return <ContentCard title="YM13 · Buyer demands" subtitle="Owner: Migara Wijesinghe">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
