import { ContentCard } from '../../components/ContentCard';
// YM05 · Chamidu Pethum · Notifications
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Notification centre", "Notification details", "Notification preferences", "Market advisory preferences"];
export default function YM05() {
  return <ContentCard title="YM05 · Notifications" subtitle="Owner: Chamidu Pethum">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
