import { ContentCard } from '../../components/ContentCard';
// YM18 · Nipuni Thakshila · Buyer orders
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["My orders", "Order details", "Order timeline", "Delivery tracking", "Cancellation request"];
export default function YM18() {
  return <ContentCard title="YM18 · Buyer orders" subtitle="Owner: Nipuni Thakshila">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
