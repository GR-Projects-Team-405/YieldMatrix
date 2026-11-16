import { ContentCard } from '../../components/ContentCard';
// YM12 · MHD Muhthas · Produce & suppliers
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Produce details", "Supplier profile", "Supplier comparison", "Supplier performance"];
export default function YM12() {
  return <ContentCard title="YM12 · Produce &amp; suppliers" subtitle="Owner: MHD Muhthas">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
