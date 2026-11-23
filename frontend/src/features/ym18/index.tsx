import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { MyOrdersPage } from './MyOrdersPage';
import { OrderDetailsPage } from './OrderDetailsPage';
import { OrderTimelinePage } from './OrderTimelinePage';
import { DeliveryTrackingPage } from './DeliveryTrackingPage';

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
        <Route path=":orderId/delivery" element={<DeliveryTrackingPage />} />
        <Route path="*" element={<MyOrdersPage />} />
      </Routes>
    </div>
  );
}
