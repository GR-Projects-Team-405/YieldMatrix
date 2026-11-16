import { ContentCard } from '../../components/ContentCard';
// YM27 · Udith Rashan · Farmer wallet
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Farmer wallet", "Farmer wallet transactions", "Settlement breakdown", "Simulated payout request", "Payout history"];
export default function YM27() {
  return <ContentCard title="YM27 · Farmer wallet" subtitle="Owner: Udith Rashan">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
