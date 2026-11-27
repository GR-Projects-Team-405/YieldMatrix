import { Route, Routes } from 'react-router-dom';
import TraceRecords from './TraceRecords';
import BatchTraceHistory from './BatchTraceHistory';
import QRPreview from './QRPreview';
import VerificationDetails from './VerificationDetails';

export default function YM25() {
  return (
    <Routes>
      <Route index element={<TraceRecords />} />
      <Route path="records" element={<TraceRecords />} />
      <Route path="history/:batchId" element={<BatchTraceHistory />} />
      <Route path="preview/:batchId" element={<QRPreview />} />
      <Route path="qr/:batchId" element={<QRPreview />} />
      <Route path="verify/:batchId" element={<VerificationDetails />} />
      <Route path="*" element={<p className="text-sm text-[var(--muted)]">Page not found.</p>} />
    </Routes>
  );
}