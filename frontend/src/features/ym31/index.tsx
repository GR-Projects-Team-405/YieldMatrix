import { ContentCard } from '../../components/ContentCard';
// YM31 · Ashen Lakmal · Help
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Help and support", "Common questions (FAQ)"];
export default function YM31() {
  return <ContentCard title="YM31 · Help" subtitle="Owner: Ashen Lakmal">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
