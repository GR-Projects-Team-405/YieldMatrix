import { ContentCard } from '../../components/ContentCard';
// YM24 · Sasindu Lakshan · Delivery & incidents
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Delivery handover", "Delivery history", "Delivery details", "Incidents list", "Report incident"];
export default function YM24() {
  return <ContentCard title="YM24 · Delivery &amp; incidents" subtitle="Owner: Sasindu Lakshan">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
