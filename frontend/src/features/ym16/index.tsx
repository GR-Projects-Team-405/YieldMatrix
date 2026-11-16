import { ContentCard } from '../../components/ContentCard';
// YM16 · Nadula Hatharasingha · Reservations
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Reservation review", "Reservation status and countdown", "Farmer response summary", "Reservation confirmation result"];
export default function YM16() {
  return <ContentCard title="YM16 · Reservations" subtitle="Owner: Nadula Hatharasingha">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
