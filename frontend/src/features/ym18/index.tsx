import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { MyOrdersPage } from './MyOrdersPage';

// YM18 · Nipuni Thakshila · Buyer orders
export default function YM18() {
  return (
    <div className="ym18-container bg-[#F6F7F3] min-h-full">
      {/* Seamless header integration with Figma design */}
      <style>{`
        .workspace-content > .page-heading {
          display: none;
        }
      `}</style>
      <Routes>
        <Route index element={<MyOrdersPage />} />
        <Route path="*" element={<MyOrdersPage />} />
      </Routes>
    </div>
  );
}
