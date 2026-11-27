import { Route, Routes } from 'react-router-dom';
import TransactionDetails from './TransactionDetails';
import TransactionHistory from './TransactionHistory';
import AllocationSettlement from './AllocationSettlement';
import OrderSummary from './OrderSummary';

// YM20 · Praveena Buddini · Order & transaction records
// Mounted at /buyer/records/* and /farmer/records/* in App.tsx
export default function YM20() {
  return (
    <Routes>
      <Route index element={<TransactionHistory />} />
      <Route path="transactions/:txId" element={<TransactionDetails />} />
      <Route path="orders/:orderId" element={<OrderSummary />} />
      <Route path="settlement/:orderId" element={<AllocationSettlement />} />
      <Route path="*" element={<TransactionHistory />} />
    </Routes>
  );
}