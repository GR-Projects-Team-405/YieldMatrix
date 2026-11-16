import { ContentCard } from '../../components/ContentCard';
// YM30 · Yugen Suresh · People & access
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Admin dashboard", "Account details", "Approval requests", "Suspended accounts", "People & access"];
export default function YM30() {
  return <ContentCard title="YM30 · People &amp; access" subtitle="Owner: Yugen Suresh">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
