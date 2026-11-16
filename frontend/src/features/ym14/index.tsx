import { ContentCard } from '../../components/ContentCard';
// YM14 · Mohomad Mushrif · Offers & commitments
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Received offer details", "Offer comparison", "Commitments list", "Commitment details", "Harvest change review"];
export default function YM14() {
  return <ContentCard title="YM14 · Offers &amp; commitments" subtitle="Owner: Mohomad Mushrif">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
