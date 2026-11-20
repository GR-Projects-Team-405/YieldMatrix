import React from 'react';
import { Routes, Route, useParams, useNavigate, Link } from 'react-router-dom';
import { MyOrdersPage } from './MyOrdersPage';
import { OrderDetailsPage } from './OrderDetailsPage';
import { OrderTimelinePage } from './OrderTimelinePage';
import { Truck, ArrowLeft } from 'lucide-react';

/** Quick placeholder for Delivery Tracking (YM18 Page 4) */
function DeliveryTrackingPlaceholder() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  return (
    <div className="max-w-[1000px] mx-auto py-10 px-4 font-sans bg-[#F6F7F3]">
      <Link to={`/buyer/orders/${orderId}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#315A42] hover:underline mb-4">
        <ArrowLeft size={16} /> Back to Order Details
      </Link>
      <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-8 text-center space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-[#EEF2ED] text-[#315A42] mx-auto flex items-center justify-center">
          <Truck size={24} />
        </div>
        <h2 className="text-xl font-semibold text-[#263A31]">Real-Time Delivery & Logistics Tracking</h2>
        <p className="text-xs text-[#78877D] max-w-md mx-auto">
          Real-time carrier GPS coordinates, pickup stop checkpoints, and handover custody telemetry for Order {orderId}.
        </p>
        <div className="pt-2">
          <button onClick={() => navigate(`/buyer/orders/${orderId}`)} className="h-[36px] px-4 bg-[#315A42] text-white rounded-[8px] text-[13px] font-semibold cursor-pointer">
            Return to Order
          </button>
        </div>
      </div>
    </div>
  );
}

// YM18 · Nipuni Thakshila · Buyer orders
export default function YM18() {
  return (
    <div className="ym18-container bg-[#F6F7F3] min-h-full">
      <style>{`
        .workspace-content > .page-heading {
          display: none;
        }
      `}</style>
      <Routes>
        <Route index element={<MyOrdersPage />} />
        <Route path=":orderId" element={<OrderDetailsPage />} />
        <Route path=":orderId/timeline" element={<OrderTimelinePage />} />
        <Route path=":orderId/delivery" element={<DeliveryTrackingPlaceholder />} />
        <Route path="*" element={<MyOrdersPage />} />
      </Routes>
    </div>
  );
}
