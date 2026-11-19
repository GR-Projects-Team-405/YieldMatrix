import React from 'react';
import { X, MapPin, Package } from 'lucide-react';
import type { BuyerOrder } from './types';

interface OrderDetailsModalProps {
  order: BuyerOrder | null;
  onClose: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#263A31]/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-[8px] max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#E0E7E1] shadow-xl p-5 md:p-6"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E0E7E1]">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-xl font-semibold text-[#263A31]">
                {order.orderCode}
              </h3>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-[#EAF2E8] text-[#315A42] border border-[#315A42]/20">
                {order.displayStatus}
              </span>
            </div>
            <p className="text-xs text-[#78877D] mt-0.5">
              Placed on {order.orderDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#78877D] hover:text-[#263A31] hover:bg-[#EEF2ED] transition-colors"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 mt-4">
          {/* Order Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-[#F6F7F3] border border-[#E0E7E1] p-3 rounded-[8px]">
              <span className="text-[11px] text-[#78877D] block font-medium">Produce</span>
              <span className="text-[13px] font-semibold text-[#263A31] mt-0.5 block">
                {order.productName}
              </span>
            </div>
            <div className="bg-[#F6F7F3] border border-[#E0E7E1] p-3 rounded-[8px]">
              <span className="text-[11px] text-[#78877D] block font-medium">Total Quantity</span>
              <span className="text-[13px] font-semibold text-[#263A31] mt-0.5 block">
                {Math.round(order.quantityKg)} Kg
              </span>
            </div>
            <div className="bg-[#F6F7F3] border border-[#E0E7E1] p-3 rounded-[8px]">
              <span className="text-[11px] text-[#78877D] block font-medium">Total Amount</span>
              <span className="text-[13px] font-semibold text-[#315A42] mt-0.5 block">
                {order.formattedTotalPrice}
              </span>
            </div>
          </div>

          {/* Delivery & Destination Details */}
          <div className="bg-[#F6F7F3] border border-[#E0E7E1] p-3.5 rounded-[8px] space-y-2">
            <h4 className="text-xs font-semibold text-[#263A31] flex items-center gap-1.5">
              <MapPin size={14} className="text-[#315A42]" />
              Delivery Information
            </h4>
            <div className="text-xs text-[#78877D] grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] text-[#78877D] block">Destination Address</span>
                <span className="font-medium text-[#263A31]">
                  {order.destination || 'Colombo Hub'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#78877D] block">District</span>
                <span className="font-medium text-[#263A31]">
                  {order.destinationDistrict || 'Western Province'}
                </span>
              </div>
            </div>
          </div>

          {/* Cancellation Reason if Canceled */}
          {order.cancellationReason && (
            <div className="p-3 bg-[#FCEBEA] border border-[#A51C19]/20 rounded-[8px] text-xs">
              <span className="font-semibold text-[#A51C19] block mb-0.5">
                Cancellation Reason:
              </span>
              <p className="text-[#A51C19]">
                {order.cancellationReason}
              </p>
            </div>
          )}

          {/* Products Breakdown Table */}
          <div>
            <h4 className="text-xs font-semibold text-[#263A31] mb-2 flex items-center gap-1.5">
              <Package size={14} className="text-[#315A42]" />
              Allocated Produce Items
            </h4>
            <div className="border border-[#E0E7E1] rounded-[8px] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EEF2ED] text-[11px] font-semibold text-[#263A31] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">Unit Price</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E7E1]">
                  {order.products && order.products.length > 0 ? (
                    order.products.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#F6F7F3]">
                        <td className="py-2.5 px-3 font-semibold text-[#263A31]">
                          {item.crop_name}
                        </td>
                        <td className="py-2.5 px-3 text-[#263A31]">
                          {item.agreed_kg} Kg
                        </td>
                        <td className="py-2.5 px-3 text-[#263A31]">
                          LKR {(item.agreed_unit_price_cents / 100).toFixed(2)}/Kg
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EAF2E8] text-[#315A42]">
                            {item.allocation_status || 'Allocated'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-center text-[#78877D]">
                        Produce details recorded under {order.productName} ({order.quantityKg} Kg)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-5 pt-3 border-t border-[#E0E7E1] flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-[36px] px-4 rounded-[8px] border border-[#E0E7E1] text-[#315A42] hover:border-[#315A42] hover:bg-[#EEF2ED] text-[13px] font-semibold transition-colors inline-flex items-center justify-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
