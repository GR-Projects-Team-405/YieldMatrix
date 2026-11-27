import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  Check,
  Clock,
  AlertCircle,
  RefreshCw,
  Calendar,
  MapPin,
  Package,
  ShieldCheck,
  CheckCircle2,
  Info,
  XCircle
} from 'lucide-react';
import api from '../../services/api';
import type {
  OrderTimelineResponse,
  TimelineStage,
  OrderDisplayStatus
} from './types';

export const OrderTimelinePage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<OrderTimelineResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);

  const fetchTimeline = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const response = await api.get<OrderTimelineResponse>(`/ym18/orders/${orderId}/timeline`);
      if (response.data?.order && response.data?.stages) {
        setData(response.data);
      } else {
        setNotFound(true);
      }
    } catch (err: any) {
      console.error('Failed to load order timeline:', err);
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(err.response?.data?.error || 'Unable to retrieve order timeline.');
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

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

  if (loading) {
    return (
      <div className="space-y-4 max-w-[1100px] mx-auto pb-12 font-sans bg-[#F6F7F3]">
        <div className="h-6 w-36 bg-[#EEF2ED] rounded-md animate-pulse" />
        <div className="h-28 bg-white border border-[#E0E7E1] rounded-[8px] animate-pulse" />
        <div className="h-96 bg-white border border-[#E0E7E1] rounded-[8px] animate-pulse" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-[700px] mx-auto py-12 px-4 text-center font-sans">
        <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-10 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#FFF0E3] text-[#854500] mx-auto flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-semibold text-[#263A31]">Order Not Found</h2>
          <p className="text-xs text-[#78877D] max-w-md mx-auto">
            The requested order could not be located in your buyer account.
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

  if (error || !data) {
    return (
      <div className="max-w-[700px] mx-auto py-12 px-4 text-center font-sans">
        <div className="bg-white border border-[#FCEBEA] rounded-[8px] p-10 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#FCEBEA] text-[#A51C19] mx-auto flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-semibold text-[#263A31]">Error Loading Timeline</h2>
          <p className="text-xs text-[#78877D] max-w-md mx-auto">{error}</p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={fetchTimeline}
              className="inline-flex items-center gap-2 h-[36px] px-4 bg-[#315A42] hover:bg-[#264834] text-white rounded-[8px] text-[13px] font-semibold transition-colors"
            >
              <RefreshCw size={14} />
              Try Again
            </button>
            <Link
              to={`/buyer/orders/${orderId}`}
              className="inline-flex items-center gap-2 h-[36px] px-4 border border-[#E0E7E1] bg-white text-[#263A31] hover:border-[#315A42] rounded-[8px] text-[13px] font-semibold transition-colors"
            >
              Back to Order
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { order, stages, progressPercentage, deliveryInfo } = data;

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto pb-16 font-sans bg-[#F6F7F3]">
      {/* 1. Top Back Navigation */}
      <div>
        <Link
          to={`/buyer/orders/${order.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#315A42] hover:underline transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Order Details
        </Link>
      </div>

      {/* 2. Top Header Bar: Order ID, Status, and Delivery Tracking Navigation */}
      <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-5 shadow-[0_1px_3px_rgba(38,58,49,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[#263A31] tracking-tight">
              Order Timeline · {order.orderCode}
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

        {/* Action Button: Navigate to Delivery Tracking */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate(`/buyer/orders/${order.id}/delivery`)}
            className="h-[36px] px-3.5 bg-[#315A42] hover:bg-[#264834] text-white text-[13px] font-semibold rounded-[8px] transition-all inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Truck size={15} />
            Track Delivery
          </button>
        </div>
      </div>

      {/* 3. Order Summary & Fulfillment Progress */}
      <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-5 shadow-[0_1px_3px_rgba(38,58,49,0.03)] space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
          <div>
            <span className="text-[11px] text-[#78877D] block font-medium">Produce</span>
            <span className="text-sm font-bold text-[#263A31] block mt-0.5">
              {order.productName}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#78877D] block font-medium">Quantity</span>
            <span className="text-sm font-bold text-[#263A31] block mt-0.5">
              {Math.round(order.quantityKg)} Kg
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#78877D] block font-medium">Total Value</span>
            <span className="text-sm font-bold text-[#315A42] block mt-0.5">
              {order.formattedTotalPrice}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#78877D] block font-medium">Destination</span>
            <span className="text-sm font-semibold text-[#263A31] block mt-0.5 truncate" title={order.destination}>
              {order.destinationDistrict} Hub
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="pt-2 border-t border-[#E0E7E1]">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-semibold text-[#263A31]">Fulfillment Progress</span>
            <span className="font-bold text-[#315A42]">
              {order.displayStatus === 'Canceled' ? 'Canceled' : `${progressPercentage}% Completed`}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#EEF2ED] overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                order.displayStatus === 'Canceled'
                  ? 'bg-[#A51C19]'
                  : 'bg-[#315A42]'
              }`}
              style={{ width: `${order.displayStatus === 'Canceled' ? 100 : progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4. Vertical Timeline Card */}
      <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-6 md:p-8 shadow-[0_1px_3px_rgba(38,58,49,0.03)] space-y-6">
        <div>
          <h2 className="text-[13px] font-semibold text-[#263A31] uppercase tracking-wider">
            Order Progress & Milestones
          </h2>
          <p className="text-xs text-[#78877D] mt-0.5">
            Chronological audit trail across fulfillment and logistics stages
          </p>
        </div>

        {/* Vertical Timeline Stages */}
        <div className="relative pl-2 md:pl-4 space-y-8">
          {stages.map((stage, idx) => {
            const isLast = idx === stages.length - 1;

            // Indicator styles
            const isCompleted = stage.status === 'completed';
            const isCurrent = stage.status === 'current';
            const isCancelled = stage.status === 'cancelled';
            const isPending = stage.status === 'pending';

            return (
              <div key={stage.id} className="relative flex items-start gap-4 md:gap-6 group">
                {/* Connecting Vertical Line */}
                {!isLast && (
                  <div
                    className={`absolute left-[15px] top-[30px] bottom-[-32px] w-[2px] ${
                      isCompleted ? 'bg-[#315A42]' : 'border-l-2 border-dashed border-[#E0E7E1]'
                    }`}
                  />
                )}

                {/* Step Circle Indicator */}
                <div className="relative z-10 flex-shrink-0">
                  {isCompleted ? (
                    // Green indicator for completed stage
                    <div className="w-8 h-8 rounded-full bg-[#315A42] text-white flex items-center justify-center shadow-xs">
                      <Check size={16} strokeWidth={2.5} />
                    </div>
                  ) : isCurrent ? (
                    // Orange indicator for current stage
                    <div className="w-8 h-8 rounded-full bg-[#E7A06C] text-white flex items-center justify-center ring-4 ring-[#E7A06C]/25 shadow-xs animate-pulse">
                      <Clock size={16} strokeWidth={2.5} />
                    </div>
                  ) : isCancelled ? (
                    // Red indicator for cancelled stage
                    <div className="w-8 h-8 rounded-full bg-[#FCEBEA] border border-[#A51C19]/30 text-[#A51C19] flex items-center justify-center">
                      <XCircle size={18} />
                    </div>
                  ) : (
                    // Muted indicator for pending upcoming stage
                    <div className="w-8 h-8 rounded-full bg-[#F6F7F3] border border-[#E0E7E1] text-[#78877D] flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#E0E7E1]" />
                    </div>
                  )}
                </div>

                {/* Stage Content Card */}
                <div
                  className={`flex-grow rounded-[8px] p-4 transition-all border ${
                    isCurrent
                      ? 'bg-[#FFF0E3]/30 border-[#E7A06C]/40 shadow-xs'
                      : isCompleted
                      ? 'bg-white border-[#E0E7E1]'
                      : isCancelled
                      ? 'bg-[#FCEBEA]/40 border-[#A51C19]/30'
                      : 'bg-[#F6F7F3]/60 border-[#E0E7E1]/60 opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5">
                    <div className="flex items-center gap-2.5">
                      <h3
                        className={`text-[15px] ${
                          isCurrent
                            ? 'font-bold text-[#263A31]'
                            : isCompleted
                            ? 'font-semibold text-[#263A31]'
                            : 'font-medium text-[#78877D]'
                        }`}
                      >
                        {stage.stageName}
                      </h3>

                      {/* Status Tag */}
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          isCompleted
                            ? 'bg-[#EAF2E8] text-[#315A42] border border-[#315A42]/20'
                            : isCurrent
                            ? 'bg-[#FFF0E3] text-[#854500] border border-[#E7A06C]/50'
                            : isCancelled
                            ? 'bg-[#FCEBEA] text-[#A51C19] border border-[#A51C19]/30'
                            : 'bg-[#F6F7F3] text-[#78877D] border border-[#E0E7E1]'
                        }`}
                      >
                        {isCompleted
                          ? 'Completed'
                          : isCurrent
                          ? 'Current Stage'
                          : isCancelled
                          ? 'Canceled'
                          : 'Pending'}
                      </span>
                    </div>

                    {/* Date and Time (Only for completed or current stages) */}
                    <div className="flex items-center gap-2">
                      {stage.formattedTimestamp ? (
                        <div className="flex items-center gap-1.5 text-xs text-[#263A31] font-medium">
                          <Clock size={13} className="text-[#315A42]" />
                          <span>{stage.formattedTimestamp}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#78877D] italic">
                          {isCurrent ? 'In Progress' : 'Pending'}
                        </span>
                      )}

                      {/* Explicit identifier for development sample timestamps */}
                      {stage.isSampleData && stage.formattedTimestamp && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-[#F6F7F3] text-[#78877D] border border-[#E0E7E1] font-normal"
                          title="This event timestamp was simulated from lifecycle milestones for demonstration"
                        >
                          Sample Audit Data
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stage Description */}
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      isPending ? 'text-[#78877D]' : 'text-[#263A31]'
                    }`}
                  >
                    {stage.description}
                  </p>

                  {/* Actor / Responsibility Note */}
                  {stage.actor && (
                    <div className="mt-2.5 pt-2 border-t border-[#E0E7E1]/50 text-[11px] text-[#78877D] flex items-center gap-1.5">
                      <span className="font-medium text-[#263A31]">Responsible Partner:</span>
                      <span>{stage.actor}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Relevant Order & Delivery Information Footer Card */}
      <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-5 shadow-[0_1px_3px_rgba(38,58,49,0.03)] grid grid-cols-1 md:grid-cols-2 gap-5 text-[13px]">
        {/* Delivery Details */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[#263A31] uppercase tracking-wider flex items-center gap-1.5">
            <MapPin size={14} className="text-[#315A42]" />
            Delivery Destination
          </h4>
          <p className="font-semibold text-[#263A31]">
            {deliveryInfo?.destination || order.destination}
          </p>
          <p className="text-xs text-[#78877D]">
            Target Delivery Date: <span className="font-medium text-[#263A31]">{deliveryInfo?.scheduledDeliveryDate || order.deliveryDate}</span>
          </p>
        </div>

        {/* Carrier Status & Security */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[#263A31] uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#315A42]" />
            Custody & Smart Escrow
          </h4>
          <p className="text-xs text-[#78877D] leading-relaxed">
            All stages are tracked via YieldMatrix immutable custody transfer logs. Escrow payment is automatically settled upon delivery confirmation.
          </p>
        </div>
      </div>
    </div>
  );
};
