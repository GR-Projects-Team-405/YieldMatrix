import { ContentCard } from '../../components/ContentCard';
// YM22 · Rukshan Senevirathna · Trips & routes
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Assigned trips", "Trip details", "Pickup sequence", "Route overview"];
export default function YM22() {
  return <ContentCard title="YM22 · Trips &amp; routes" subtitle="Owner: Rukshan Senevirathna">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
