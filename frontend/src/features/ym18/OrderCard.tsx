import React from 'react';
import type { BuyerOrder, OrderDisplayStatus } from './types';

interface OrderCardProps {
  order: BuyerOrder;
  onViewDetails: (order: BuyerOrder) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onViewDetails }) => {
  // Official YieldMatrix status badge palette
  const getStatusBadgeStyle = (status: OrderDisplayStatus) => {
    switch (status) {
      case 'Pending':
        return 'bg-[#FFF0E3] text-[#854500] border border-[#E7A06C]/40';
      case 'Processing':
        return 'bg-[#EAF2E8] text-[#315A42] border border-[#315A42]/20';
      case 'In Transit':
        return 'bg-[#FFF0E3] text-[#854500] border border-[#E7A06C]/40';
      case 'Delivered':
        return 'bg-[#EAF2E8] text-[#315A42] border border-[#315A42]/20';
      case 'Canceled':
        return 'bg-[#FCEBEA] text-[#A51C19] border border-[#A51C19]/20';
      default:
        return 'bg-[#EAF2E8] text-[#315A42] border border-[#315A42]/20';
    }
  };

  return (
    <div className="bg-white border border-[#dce3db] hover:border-[#315A42]/40 rounded-[12px] p-5 md:py-5 md:px-7 shadow-[0_1px_3px_rgba(38,58,49,0.04)] transition-all hover:shadow-[0_4px_16px_rgba(49,90,66,0.08)]">
      {/* Desktop & Tablet Layout matching Figma */}
      <div className="hidden lg:flex items-center justify-between gap-4">
        {/* 1. Order ID */}
        <div className="w-[130px] flex-shrink-0">
          <span className="text-[15px] font-semibold text-[#263A31] tracking-tight">
            {order.orderCode}
          </span>
        </div>

        {/* Divider */}
        <div className="h-10 w-[1px] bg-[#dce3db] flex-shrink-0" />

        {/* 2. Product Name & Date */}
        <div className="w-[210px] flex-shrink-0">
          <h4 className="text-sm font-semibold text-[#263A31] leading-tight">
            {order.productName}
          </h4>
          <p className="text-xs text-[#596c60] mt-0.5 font-normal">
            {order.orderDate}
          </p>
        </div>

        {/* Divider */}
        <div className="h-10 w-[1px] bg-[#dce3db] flex-shrink-0" />

        {/* 3. Quantity */}
        <div className="w-[110px] flex-shrink-0">
          <span className="text-sm font-semibold text-[#263A31]">
            {Math.round(order.quantityKg)} Kg
          </span>
        </div>

        {/* Divider */}
        <div className="h-10 w-[1px] bg-[#dce3db] flex-shrink-0" />

        {/* 4. Total Amount */}
        <div className="w-[170px] flex-shrink-0">
          <span className="text-sm font-semibold text-[#263A31] leading-tight block">
            {order.formattedTotalPrice}
          </span>
          <span className="text-xs text-[#596c60] font-normal">
            Total Amount
          </span>
        </div>

        {/* Divider */}
        <div className="h-10 w-[1px] bg-[#dce3db] flex-shrink-0" />

        {/* 5. Status Badge */}
        <div className="w-[120px] flex justify-center flex-shrink-0">
          <span
            className={`inline-flex items-center justify-center px-3.5 py-1 rounded-full text-[11px] font-semibold ${getStatusBadgeStyle(
              order.displayStatus
            )}`}
          >
            {order.displayStatus}
          </span>
        </div>

        {/* 6. View Details Button: 48px height, 13px text matching navbar */}
        <div className="w-[130px] flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={() => onViewDetails(order)}
            className="h-[48px] px-5 bg-[#315A42] hover:bg-[#264834] text-white text-[13px] font-semibold rounded-[12px] transition-all duration-150 shadow-xs cursor-pointer inline-flex items-center justify-center"
          >
            View Details
          </button>
        </div>
      </div>

      {/* Mobile / Narrow Screen Responsive Layout */}
      <div className="flex flex-col gap-3 lg:hidden">
        <div className="flex items-center justify-between border-b border-[#dce3db] pb-2.5">
          <span className="text-sm font-semibold text-[#263A31]">
            {order.orderCode}
          </span>
          <span
            className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStatusBadgeStyle(
              order.displayStatus
            )}`}
          >
            {order.displayStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div>
            <span className="text-[11px] text-[#596c60] block font-medium">Product</span>
            <span className="font-semibold text-[#263A31]">{order.productName}</span>
            <span className="text-[10px] text-[#596c60] block mt-0.5">{order.orderDate}</span>
          </div>
          <div>
            <span className="text-[11px] text-[#596c60] block font-medium">Quantity</span>
            <span className="font-semibold text-[#263A31]">{Math.round(order.quantityKg)} Kg</span>
          </div>
          <div>
            <span className="text-[11px] text-[#596c60] block font-medium">Total Amount</span>
            <span className="font-semibold text-[#263A31]">{order.formattedTotalPrice}</span>
          </div>
          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={() => onViewDetails(order)}
              className="h-[40px] px-4 bg-[#315A42] hover:bg-[#264834] text-white text-xs font-semibold rounded-[12px] transition-colors cursor-pointer inline-flex items-center justify-center"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
