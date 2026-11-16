import { ContentCard } from '../../components/ContentCard';
// YM32 · Sewmini Wijesiri · Profile
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["My profile", "Edit profile"];
export default function YM32() {
  return <ContentCard title="YM32 · Profile" subtitle="Owner: Sewmini Wijesiri">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
