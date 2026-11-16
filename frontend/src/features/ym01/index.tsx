import { ContentCard } from '../../components/ContentCard';
// YM01 · Aathil Hakam · Public pages
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Landing page", "Public harvest catalogue", "Public harvest details", "Role introduction"];
export default function YM01() {
  return <ContentCard title="YM01 · Public pages" subtitle="Owner: Aathil Hakam">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
