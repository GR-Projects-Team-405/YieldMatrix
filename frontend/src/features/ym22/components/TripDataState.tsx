import { CircleAlert, RefreshCw } from 'lucide-react';
export default function TripDataState({ loading, error, empty, onRetry }: { loading:boolean; error:string; empty:boolean; onRetry:()=>void }) {
  if (error) return <div className="ym22-error" role="alert"><CircleAlert size={18}/><span>{error}</span><button onClick={onRetry}><RefreshCw size={15}/> Retry</button></div>;
  if (loading) return <div className="ym22-table-state" role="status">Loading assigned trips…</div>;
  if (empty) return <div className="ym22-table-state">No trips match these filters.</div>;
  return null;
}
