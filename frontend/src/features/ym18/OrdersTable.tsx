import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { BuyerOrder, OrderDisplayStatus } from './types';

interface OrdersTableProps {
  orders: BuyerOrder[];
  onViewDetails?: (order: BuyerOrder) => void;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({ orders, onViewDetails }) => {
  const navigate = useNavigate();

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

  // Helper to extract clean date (e.g. "6 Nov 2026")
  const formatTableDate = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.split(' - ')[0] || dateStr;
  };

  const handleRowClick = (order: BuyerOrder) => {
    if (onViewDetails) onViewDetails(order);
    navigate(`/buyer/orders/${order.id}`);
  };

  return (
    <div className="w-full overflow-hidden border border-[#E0E7E1] rounded-[8px] bg-white shadow-[0_1px_3px_rgba(38,58,49,0.03)]">
      <div className="overflow-x-auto w-full">
        <table className="w-full min-w-[800px] text-left border-collapse">
          {/* Table Header: Light green background #EEF2ED */}
          <thead>
            <tr className="bg-[#EEF2ED] border-b border-[#E0E7E1] text-[12px] font-semibold text-[#263A31] uppercase tracking-wider">
              <th scope="col" className="py-3.5 px-4 text-left">
                Order ID
              </th>
              <th scope="col" className="py-3.5 px-4 text-left">
                Product
              </th>
              <th scope="col" className="py-3.5 px-4 text-left">
                Order Date
              </th>
              <th scope="col" className="py-3.5 px-4 text-left">
                Quantity
              </th>
              <th scope="col" className="py-3.5 px-4 text-left">
                Total Amount
              </th>
              <th scope="col" className="py-3.5 px-4 text-center">
                Status
              </th>
              <th scope="col" className="py-3.5 px-4 text-right">
                Action
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#E0E7E1] text-[13px] bg-white">
            {orders.map((order) => (
              <tr
                key={order.id}
                className="hover:bg-[#F6F7F3] transition-colors duration-150 group"
              >
                {/* 1. Order ID - Highlighted with Primary Green #315A42 */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <span className="font-semibold text-[#315A42] tracking-tight">
                    {order.orderCode}
                  </span>
                </td>

                {/* 2. Product */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <span className="font-semibold text-[#263A31]">
                    {order.productName}
                  </span>
                </td>

                {/* 3. Order Date */}
                <td className="py-3.5 px-4 whitespace-nowrap text-[#263A31]">
                  <span>{formatTableDate(order.orderDate)}</span>
                </td>

                {/* 4. Quantity */}
                <td className="py-3.5 px-4 whitespace-nowrap text-[#263A31]">
                  <span className="font-medium">
                    {Math.round(order.quantityKg)} Kg
                  </span>
                </td>

                {/* 5. Total Amount */}
                <td className="py-3.5 px-4 whitespace-nowrap text-[#263A31]">
                  <span className="font-semibold">
                    {order.formattedTotalPrice}
                  </span>
                </td>

                {/* 6. Status Badge */}
                <td className="py-3.5 px-4 whitespace-nowrap text-center">
                  <span
                    className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide ${getStatusBadgeStyle(
                      order.displayStatus
                    )}`}
                  >
                    {order.displayStatus}
                  </span>
                </td>

                {/* 7. Action Button: 36px height, 12px padding, 8px radius */}
                <td className="py-3.5 px-4 whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => handleRowClick(order)}
                    className="h-[36px] px-3 bg-[#315A42] hover:bg-[#264834] text-white text-[13px] font-semibold rounded-[8px] transition-all duration-150 shadow-xs cursor-pointer inline-flex items-center justify-center"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

