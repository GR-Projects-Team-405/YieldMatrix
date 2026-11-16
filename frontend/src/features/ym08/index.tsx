import { ContentCard } from '../../components/ContentCard';
// YM08 · Imalka Deshan · Harvest management
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Harvest calendar", "Harvest batch list", "Add harvest batch", "Harvest batch details", "Update harvest batch"];
export default function YM08() {
  return <ContentCard title="YM08 · Harvest management" subtitle="Owner: Imalka Deshan">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
