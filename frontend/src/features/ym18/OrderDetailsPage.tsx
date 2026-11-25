import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Package,
  Truck,
  Clock,
  Download,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  User,
  Sprout,
  DollarSign,
  XCircle,
  Info
} from 'lucide-react';
import api from '../../services/api';
import type { BuyerOrder, OrderDisplayStatus, FarmerAllocation, OrderDetailsApiResponse } from './types';

export const OrderDetailsPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<BuyerOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);

  // Fetch full order details
  const fetchOrderDetails = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const response = await api.get<OrderDetailsApiResponse>(`/ym18/orders/${orderId}`);
      if (response.data?.order) {
        setOrder(response.data.order);
      } else {
        setNotFound(true);
      }
    } catch (err: any) {
      console.error('Failed to load order details:', err);
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(err.response?.data?.error || 'Unable to retrieve order details. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  // Status badge styling
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

  // Produce Image Helper
  const getProductImage = (cropName: string) => {
    const lower = cropName.toLowerCase();
    if (lower.includes('tomato')) {
      return 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=80';
    }
    if (lower.includes('rice')) {
      return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80';
    }
    if (lower.includes('leaf') || lower.includes('green') || lower.includes('cabbage')) {
      return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80';
    }
    if (lower.includes('carrot')) {
      return 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=500&auto=format&fit=crop&q=80';
    }
    return 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=500&auto=format&fit=crop&q=80';
  };

  // Receipt download / print handler
  const handleDownloadReceipt = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-[1200px] mx-auto pb-12 font-sans bg-[#F6F7F3]">
        <div className="h-6 w-32 bg-[#EEF2ED] rounded-md animate-pulse" />
        <div className="h-24 bg-white border border-[#E0E7E1] rounded-[8px] animate-pulse" />
        <div className="h-64 bg-white border border-[#E0E7E1] rounded-[8px] animate-pulse" />
        <div className="h-48 bg-white border border-[#E0E7E1] rounded-[8px] animate-pulse" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-[800px] mx-auto py-12 px-4 text-center font-sans">
        <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-10 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#FFF0E3] text-[#854500] mx-auto flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-semibold text-[#263A31]">Order Not Found</h2>
          <p className="text-xs text-[#78877D] max-w-md mx-auto">
            The requested order ID does not exist or you do not have permission to view it.
          </p>
          <div className="pt-2">
            <Link
              to="/buyer/orders"
              className="inline-flex items-center gap-2 h-[36px] px-4 bg-[#315A42] hover:bg-[#264834] text-white rounded-[8px] text-[13px] font-semibold transition-colors"
            >
              <ArrowLeft size={15} />
              Back to My Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-[800px] mx-auto py-12 px-4 text-center font-sans">
        <div className="bg-white border border-[#FCEBEA] rounded-[8px] p-10 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#FCEBEA] text-[#A51C19] mx-auto flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-semibold text-[#263A31]">Error Loading Order</h2>
          <p className="text-xs text-[#78877D] max-w-md mx-auto">
            {error || 'Unable to display order details.'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={fetchOrderDetails}
              className="inline-flex items-center gap-2 h-[36px] px-4 bg-[#315A42] hover:bg-[#264834] text-white rounded-[8px] text-[13px] font-semibold transition-colors"
            >
              <RefreshCw size={14} />
              Try Again
            </button>
            <Link
              to="/buyer/orders"
              className="inline-flex items-center gap-2 h-[36px] px-4 border border-[#E0E7E1] bg-white text-[#263A31] hover:border-[#315A42] rounded-[8px] text-[13px] font-semibold transition-colors"
            >
              Back to Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const allocations: FarmerAllocation[] = order.allocations || [];
  const payment = order.paymentSummary;
  const delivery = order.deliveryInfo;

  return (
    <div className="space-y-4 max-w-[1300px] mx-auto pb-16 font-sans bg-[#F6F7F3]">
      {/* 1. Back Link */}
      <div>
        <Link
          to="/buyer/orders"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#315A42] hover:underline transition-colors"
        >
          <ArrowLeft size={16} />
          Back to My Orders
        </Link>
      </div>

      {/* 2. Top Header Bar: Order ID, Status, and Action Buttons */}
      <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-5 shadow-[0_1px_3px_rgba(38,58,49,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[#263A31] tracking-tight">
              Order {order.orderCode}
            </h1>
            <span
              className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeStyle(
                order.displayStatus
              )}`}
            >
              {order.displayStatus}
            </span>
          </div>
          <p className="text-xs text-[#78877D] mt-1 font-normal flex items-center gap-2">
            <Calendar size={13} className="text-[#315A42]" />
            Placed on {order.orderDate}
          </p>
        </div>

        {/* Action Buttons: 36px height, 8px radius */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download Receipt Button */}
          <button
            type="button"
            onClick={handleDownloadReceipt}
            className="h-[36px] px-3 bg-white border border-[#E0E7E1] hover:border-[#315A42] text-[#315A42] text-[13px] font-semibold rounded-[8px] transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Download or Print Order Receipt"
          >
            <Download size={14} />
            Download Receipt
          </button>

          {/* View Timeline Button */}
          <button
            type="button"
            onClick={() => navigate(`/buyer/orders/${order.id}/timeline`)}
            className="h-[36px] px-3 bg-white border border-[#315A42]/30 hover:border-[#315A42] hover:bg-[#EEF2ED] text-[#315A42] text-[13px] font-semibold rounded-[8px] transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Clock size={14} />
            View Timeline
          </button>

          {/* Track Delivery Button */}
          <button
            type="button"
            onClick={() => navigate(`/buyer/orders/${order.id}/delivery`)}
            className="h-[36px] px-3.5 bg-[#315A42] hover:bg-[#264834] text-white text-[13px] font-semibold rounded-[8px] transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Truck size={14} />
            Track Delivery
          </button>

          {/* Cancel Order Button */}
          {order.displayStatus !== 'Delivered' && order.displayStatus !== 'Canceled' && (
            <button
              type="button"
              onClick={() => navigate(`/buyer/orders/${order.id}/cancel`)}
              className="h-[36px] px-3 bg-white border border-[#A51C19]/30 hover:border-[#A51C19] hover:bg-[#FCEBEA] text-[#A51C19] text-[13px] font-semibold rounded-[8px] transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Cancel Order"
            >
              <XCircle size={14} />
              Cancel Order
            </button>
          )}
        </div>
      </div>

      {/* Cancellation Notice if Canceled */}
      {order.displayStatus === 'Canceled' && (
        <div className="p-3.5 bg-[#FCEBEA] border border-[#A51C19]/20 rounded-[8px] text-xs shadow-2xs">
          <span className="font-semibold text-[#A51C19] block mb-0.5">
            Cancellation Notice:
          </span>
          <p className="text-[#A51C19]">{order.cancellationReason || 'This order has been cancelled and smart escrow funds are being returned.'}</p>
        </div>
      )}

      {/* 3. Product Overview Card with Image, Quantity, Date & Price */}
      <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-5 shadow-[0_1px_3px_rgba(38,58,49,0.03)]">
        <h2 className="text-[12px] font-semibold text-[#78877D] uppercase tracking-wider mb-4">
          Product & Order Overview
        </h2>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Product Image */}
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-[8px] overflow-hidden border border-[#E0E7E1] flex-shrink-0 bg-[#F6F7F3] relative">
            <img
              src={getProductImage(order.productName)}
              alt={order.productName}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to stylized crop icon placeholder
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center -z-0 text-[#315A42]">
              <Sprout size={32} />
            </div>
          </div>

          {/* Product Info Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-grow w-full">
            <div>
              <span className="text-[11px] text-[#78877D] block font-medium">Product</span>
              <span className="text-base font-bold text-[#263A31] block mt-0.5">
                {order.productName}
              </span>
              <span className="text-[11px] text-[#315A42] font-medium block mt-0.5">
                Verified Fresh Produce
              </span>
            </div>

            <div>
              <span className="text-[11px] text-[#78877D] block font-medium">Ordered Quantity</span>
              <span className="text-base font-bold text-[#263A31] block mt-0.5">
                {Math.round(order.quantityKg)} Kg
              </span>
              <span className="text-[11px] text-[#78877D] block mt-0.5">
                {allocations.length} Farm Allocation{allocations.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-[#78877D] block font-medium">Order Date</span>
              <span className="text-sm font-semibold text-[#263A31] block mt-0.5">
                {order.orderDate.split(' - ')[0]}
              </span>
              <span className="text-[11px] text-[#78877D] block mt-0.5">
                {order.orderDate.split(' - ')[1] || 'Standard Fulfillment'}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-[#78877D] block font-medium">Total Price</span>
              <span className="text-base font-bold text-[#315A42] block mt-0.5">
                {order.formattedTotalPrice}
              </span>
              <span className="text-[11px] text-[#78877D] block mt-0.5">
                All Taxes & Escrow Included
              </span>
            </div>
          </div>
        </div>

        {/* Cancellation Notice if Applicable */}
        {order.displayStatus === 'Canceled' && order.cancellationReason && (
          <div className="mt-4 p-3 bg-[#FCEBEA] border border-[#A51C19]/20 rounded-[8px] text-xs">
            <span className="font-semibold text-[#A51C19] block mb-0.5">
              Cancellation Reason:
            </span>
            <p className="text-[#A51C19]">{order.cancellationReason}</p>
          </div>
        )}
      </div>

      {/* 4. Farmer Allocation Details (One order may contain multiple farmer allocations) */}
      <div className="bg-white border border-[#E0E7E1] rounded-[8px] overflow-hidden shadow-[0_1px_3px_rgba(38,58,49,0.03)]">
        <div className="p-4 border-b border-[#E0E7E1] bg-[#EEF2ED] flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-semibold text-[#263A31] uppercase tracking-wider flex items-center gap-2">
              <Sprout size={16} className="text-[#315A42]" />
              Farmer Allocation Details
            </h2>
            <p className="text-[11px] text-[#78877D] mt-0.5">
              Batch sourcing breakdown per cooperative farmer partner
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white text-[#315A42] border border-[#E0E7E1]">
            {allocations.length} Allocation{allocations.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[750px] text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#F6F7F3] border-b border-[#E0E7E1] text-[11px] font-semibold text-[#78877D] uppercase tracking-wider">
                <th className="py-3 px-4">Farmer Name</th>
                <th className="py-3 px-4">Farm & Location</th>
                <th className="py-3 px-4">Produce & Grade</th>
                <th className="py-3 px-4">Allocated Qty</th>
                <th className="py-3 px-4">Agreed Unit Price</th>
                <th className="py-3 px-4">Agreed Total</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E7E1] bg-white">
              {allocations.length > 0 ? (
                allocations.map((alloc) => (
                  <tr key={alloc.id} className="hover:bg-[#F6F7F3] transition-colors">
                    {/* Farmer Name */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#EEF2ED] text-[#315A42] flex items-center justify-center font-bold text-xs flex-shrink-0">
                          <User size={14} />
                        </div>
                        <span className="font-semibold text-[#263A31]">
                          {alloc.farmerName}
                        </span>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-[#263A31]">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-[#315A42] flex-shrink-0" />
                        <div>
                          <span className="font-medium block">{alloc.farmName}</span>
                          <span className="text-[11px] text-[#78877D] block">{alloc.location}</span>
                        </div>
                      </div>
                    </td>

                    {/* Produce & Grade */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-[#263A31]">
                      <span className="font-medium">{alloc.cropName}</span>
                      <span className="text-[11px] text-[#78877D] block">{alloc.gradeName}</span>
                    </td>

                    {/* Allocated Qty */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-semibold text-[#263A31]">
                      {alloc.allocatedKg} Kg
                    </td>

                    {/* Agreed Price */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-[#263A31]">
                      {alloc.formattedUnitPrice}
                    </td>

                    {/* Total Value */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-bold text-[#315A42]">
                      {alloc.formattedAgreedValue}
                    </td>

                    {/* Allocation Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF2ED] text-[#315A42] border border-[#315A42]/20 capitalize">
                        {alloc.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 px-4 text-center text-[#78877D]">
                    Direct farm allocation details verified under {order.productName} ({order.quantityKg} Kg)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Payment Summary & Delivery Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Column A: Payment Summary */}
        <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-5 shadow-[0_1px_3px_rgba(38,58,49,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-[#E0E7E1] pb-3">
            <h3 className="text-sm font-semibold text-[#263A31] flex items-center gap-2">
              <DollarSign size={16} className="text-[#315A42]" />
              Payment Summary
            </h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EAF2E8] text-[#315A42] flex items-center gap-1">
              <ShieldCheck size={12} />
              {payment?.escrowStatus || 'Escrow Secured'}
            </span>
          </div>

          <div className="space-y-2.5 text-[13px]">
            <div className="flex justify-between items-center text-[#78877D]">
              <span>Agreed Subtotal</span>
              <span className="font-medium text-[#263A31]">{order.formattedTotalPrice}</span>
            </div>

            <div className="flex justify-between items-center text-[#78877D]">
              <span>Platform & Fulfillment Fee</span>
              <span className="font-medium text-[#263A31]">Included (0.00 LKR)</span>
            </div>

            <div className="flex justify-between items-center text-[#78877D]">
              <span>Buyer Escrow Allocation</span>
              <span className="font-medium text-[#315A42]">100% Funded</span>
            </div>

            <div className="border-t border-[#E0E7E1] pt-2.5 flex justify-between items-center">
              <span className="font-bold text-[#263A31]">Total Payment</span>
              <span className="font-bold text-base text-[#315A42]">{order.formattedTotalPrice}</span>
            </div>
          </div>

          <div className="p-3 bg-[#F6F7F3] border border-[#E0E7E1] rounded-[8px] text-[11px] text-[#78877D] flex items-start gap-2">
            <ShieldCheck size={16} className="text-[#315A42] flex-shrink-0 mt-0.5" />
            <p>
              YieldMatrix smart escrow holds funds until the order is officially accepted and inspected upon delivery.
            </p>
          </div>
        </div>

        {/* Column B: Delivery & Logistics Information */}
        <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-5 shadow-[0_1px_3px_rgba(38,58,49,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-[#E0E7E1] pb-3">
            <h3 className="text-sm font-semibold text-[#263A31] flex items-center gap-2">
              <Truck size={16} className="text-[#315A42]" />
              Delivery Information
            </h3>
            <span className="text-xs font-semibold text-[#315A42]">
              {order.destinationDistrict} Hub
            </span>
          </div>

          <div className="space-y-3 text-[13px]">
            <div>
              <span className="text-[11px] text-[#78877D] block font-medium">Delivery Address</span>
              <p className="font-semibold text-[#263A31] mt-0.5 flex items-start gap-1.5">
                <MapPin size={14} className="text-[#315A42] flex-shrink-0 mt-0.5" />
                {order.destination}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#E0E7E1]">
              <div>
                <span className="text-[11px] text-[#78877D] block font-medium">Destination District</span>
                <span className="font-medium text-[#263A31]">{order.destinationDistrict}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#78877D] block font-medium">Scheduled Delivery Date</span>
                <span className="font-medium text-[#263A31]">{delivery?.scheduledDeliveryDate || order.deliveryDate}</span>
              </div>
            </div>

            {delivery?.trip ? (
              <div className="p-3 bg-[#EEF2ED] rounded-[8px] border border-[#315A42]/20 text-xs text-[#263A31] space-y-1">
                <span className="font-semibold text-[#315A42] block">Assigned Transport Carrier</span>
                <p>Driver: {delivery.trip.driverName || 'Licensed Agrologistics Driver'}</p>
                <p>Vehicle: {delivery.trip.vehicleNumber || 'Standard Temperature-Controlled Vehicle'}</p>
              </div>
            ) : (
              <div className="p-3 bg-[#F6F7F3] rounded-[8px] border border-[#E0E7E1] text-[11px] text-[#78877D]">
                <span>Logistics Status: Direct route calculated. Driver dispatch assigned upon order packaging.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

