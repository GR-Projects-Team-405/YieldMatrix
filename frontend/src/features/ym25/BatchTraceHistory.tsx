import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function BatchTraceHistory() {
  const { batchId } = useParams<{ batchId: string }>();
  return (
    <div className="space-y-4">
      <Link to=".." relative="path" className="inline-flex items-center gap-2 text-sm text-[#315A42] hover:underline">
        <ArrowLeft size={16} /> Back to trace records
      </Link>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-6">
        <h2 className="text-xl font-semibold mb-2">Batch Trace History: {batchId}</h2>
        <p className="text-sm text-[var(--muted)]">Timeline and custody milestones for this batch will appear here.</p>
      </div>
    </div>
  );
}