import { ContentCard } from '../../components/ContentCard';
// YM28 · Umindu Isith · Buyer wallet & reconciliation
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Buyer wallet", "Simulated funding", "Held funds by order", "Refund details", "Admin reconciliation"];
export default function YM28() {
  return <ContentCard title="YM28 · Buyer wallet &amp; reconciliation" subtitle="Owner: Umindu Isith">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
