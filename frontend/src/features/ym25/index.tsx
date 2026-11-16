import { ContentCard } from '../../components/ContentCard';
// YM25 · Shathir Sheriff · Traceability
// Keep module pages and local routes here; WorkspaceLayout owns the sidebar and topbar.
const assignedPages = ["Trace records", "Batch trace history", "QR preview", "Verification details"];
export default function YM25() {
  return <ContentCard title="YM25 · Traceability" subtitle="Owner: Shathir Sheriff">
    <p className="module-note">Build middle content here without sidebars or topbars. Use the shared YM components.</p>
    <h3 className="module-heading">Assigned pages</h3>
    <ul className="assigned-pages">{assignedPages.map((page) => <li key={page}>{page}</li>)}</ul>
  </ContentCard>;
}
