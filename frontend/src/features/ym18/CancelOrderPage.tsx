import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  ShieldAlert,
  Send,
  X,
  RotateCcw,
  Package,
  Calendar,
  Building,
  ChevronRight,
  Info
} from 'lucide-react';
import api from '../../services/api';
import type {
  OrderDetailsApiResponse,
  BuyerOrder,
  OrderDisplayStatus,
  CancellationReason,
  CancelOrderApiResponse
} from './types';

const REASON_OPTIONS: CancellationReason[] = [
  'Ordered by mistake',
  'No longer required',
  'Delivery delay',
  'Incorrect order details',
  'Other'
];

export const CancelOrderPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  // Order state
  const [order, setOrder] = useState<BuyerOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);

  // Form state
  const [reason, setReason] = useState<CancellationReason | ''>('');
  const [additionalDetails, setAdditionalDetails] = useState<string>('');
  const [formValidationError, setFormValidationError] = useState<string | null>(null);

  // Submission state
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitResult, setSubmitResult] = useState<CancelOrderApiResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchOrderDetails = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setFetchError(null);
    setNotFound(false);

    try {
      const response = await api.get<OrderDetailsApiResponse>(`/ym18/orders/${orderId}`);
      if (response.data?.order) {
        setOrder(response.data.order);
      } else {
        setNotFound(true);
      }
    } catch (err: any) {
      console.error('Failed to load order for cancellation:', err);
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        setFetchError(err.response?.data?.error || 'Unable to load order details for cancellation.');
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  // Handle open confirmation dialog
  const handleOpenConfirmDialog = (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationError(null);
    setSubmitError(null);

    if (!reason) {
      setFormValidationError('Please select a cancellation reason from the dropdown.');
      return;
    }

    if (reason === 'Other' && !additionalDetails.trim()) {
      setFormValidationError('Please provide additional details when selecting "Other".');
      return;
    }

    setIsConfirmDialogOpen(true);
  };

  // Submit cancellation to backend
  const handleConfirmSubmit = async () => {
    if (!orderId || !reason) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await api.post<CancelOrderApiResponse>(`/ym18/orders/${orderId}/cancel`, {
        reason,
        additionalDetails: additionalDetails.trim()
      });

      setIsConfirmDialogOpen(false);
      // Immediately redirect buyer to My Orders page with success message
      navigate('/buyer/orders', {
        state: {
          successMessage: `Order ${order?.orderCode || orderId} has been cancelled successfully.`
        }
      });
    } catch (err: any) {
      console.error('Failed to submit cancellation request:', err);
      const errMsg = err.response?.data?.error || 'An error occurred while submitting your cancellation request.';
      setSubmitError(errMsg);
      setIsConfirmDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeClass = (status: OrderDisplayStatus) => {
    switch (status) {
      case 'Pending':
        return 'bg-[#FFF0E3] text-[#854500] border border-[#E7A06C]/40';
      case 'Processing':
        return 'bg-[#EEF2ED] text-[#315A42] border border-[#315A42]/30';
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

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4 max-w-[860px] mx-auto pb-12 font-sans bg-[#F6F7F3]">
        <div className="h-6 w-40 bg-[#EEF2ED] rounded-md animate-pulse" />
        <div className="h-32 bg-white border border-[#E0E7E1] rounded-[8px] animate-pulse" />
        <div className="h-72 bg-white border border-[#E0E7E1] rounded-[8px] animate-pulse" />
      </div>
    );
  }

  // Not found
  if (notFound || !order) {
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

  const isAlreadyCancelled = order.displayStatus === 'Canceled';
  const isDelivered = order.displayStatus === 'Delivered';

  return (
    <div className="space-y-5 max-w-[860px] mx-auto pb-12 font-sans bg-[#F6F7F3] text-[#263A31]">
      {/* 1. Breadcrumbs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 text-xs text-[#78877D]">
          <Link to="/buyer/orders" className="hover:text-[#315A42] hover:underline transition-colors">
            My Orders
          </Link>
          <ChevronRight size={13} className="text-[#78877D]" />
          <Link to={`/buyer/orders/${order.id}`} className="hover:text-[#315A42] hover:underline transition-colors font-medium text-[#315A42]">
            {order.orderCode}
          </Link>
          <ChevronRight size={13} className="text-[#78877D]" />
          <span className="text-[#263A31] font-semibold">Cancellation Request</span>
        </div>

        <Link
          to={`/buyer/orders/${order.id}`}
          className="inline-flex items-center gap-1.5 h-[36px] px-3 bg-white border border-[#E0E7E1] hover:bg-[#EEF2ED] text-[#315A42] rounded-[8px] text-[13px] font-semibold transition-colors shadow-2xs self-start sm:self-auto"
        >
          <ArrowLeft size={14} />
          Back to Order Details
        </Link>
      </div>

      {/* 2. Success Result Banner (After Successful Submission) */}
      {submitResult && (
        <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-6 shadow-xs space-y-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                submitResult.requiresApproval
                  ? 'bg-[#FFF0E3] text-[#854500]'
                  : 'bg-[#EAF2E8] text-[#315A42]'
              }`}
            >
              {submitResult.requiresApproval ? <Clock size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#263A31]">
                {submitResult.requiresApproval
                  ? 'Cancellation Request Submitted for Review'
                  : 'Order Successfully Cancelled'}
              </h2>
              <p className="text-xs text-[#78877D] leading-relaxed">
                {submitResult.message}
              </p>
            </div>
          </div>

          {/* Refund Notice Box */}
          <div className="bg-[#EEF2ED] rounded-[6px] p-4 border border-[#315A42]/20 space-y-1.5 text-xs">
            <span className="font-bold text-[#315A42] block">Important Refund & Escrow Information:</span>
            <p className="text-[#263A31] leading-relaxed">
              {submitResult.refundNotice}
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => navigate('/buyer/orders')}
              className="h-[36px] px-4 bg-[#315A42] hover:bg-[#264834] text-white rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer"
            >
              Return to My Orders
            </button>
            <button
              onClick={() => navigate(`/buyer/orders/${order.id}`)}
              className="h-[36px] px-4 bg-white border border-[#E0E7E1] hover:bg-[#EEF2ED] text-[#315A42] rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer"
            >
              View Order Details
            </button>
          </div>
        </div>
      )}

      {/* 3. Global Submit Error Banner */}
      {submitError && (
        <div className="bg-[#FCEBEA] border border-[#A51C19]/30 rounded-[8px] p-4 flex items-start gap-3 text-xs text-[#A51C19]">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Cancellation Request Failed</span>
            <p className="leading-relaxed">{submitError}</p>
          </div>
        </div>
      )}

      {/* 4. Order Summary Card */}
      {!submitResult && (
        <>
          <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E0E7E1]">
              <div>
                <h1 className="text-base font-bold text-[#315A42]">Request Order Cancellation</h1>
                <p className="text-xs text-[#78877D] mt-0.5">
                  Review order terms and submit a formal cancellation request.
                </p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(order.displayStatus)} self-start sm:self-auto`}>
                {order.displayStatus}
              </span>
            </div>

            {/* Order Highlights Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-[#F6F7F3] rounded-[6px] p-3.5 border border-[#E0E7E1]">
              <div>
                <span className="text-[11px] uppercase font-bold text-[#78877D] tracking-wider">Order ID</span>
                <p className="text-xs font-bold text-[#263A31] mt-0.5 font-mono">{order.orderCode}</p>
              </div>
              <div>
                <span className="text-[11px] uppercase font-bold text-[#78877D] tracking-wider">Produce Name</span>
                <p className="text-xs font-bold text-[#263A31] mt-0.5">{order.productName}</p>
              </div>
              <div>
                <span className="text-[11px] uppercase font-bold text-[#78877D] tracking-wider">Quantity</span>
                <p className="text-xs font-bold text-[#263A31] mt-0.5">{order.quantityKg} Kg</p>
              </div>
              <div>
                <span className="text-[11px] uppercase font-bold text-[#78877D] tracking-wider">Total Amount</span>
                <p className="text-xs font-bold text-[#315A42] mt-0.5">{order.formattedTotalPrice}</p>
              </div>
            </div>

            {/* Status-specific warning banners */}
            {isAlreadyCancelled && (
              <div className="bg-[#FCEBEA] border border-[#A51C19]/30 rounded-[6px] p-3.5 flex items-start gap-2.5 text-xs text-[#A51C19]">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">This order has already been cancelled.</span>
                  <p className="mt-0.5 leading-relaxed">
                    Reason logged: {order.cancellationReason || 'No reason specified'}. Duplicate cancellation requests are prohibited.
                  </p>
                </div>
              </div>
            )}

            {isDelivered && (
              <div className="bg-[#FFF0E3] border border-[#E7A06C]/50 rounded-[6px] p-3.5 flex items-start gap-2.5 text-xs text-[#854500]">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-[#E7A06C]" />
                <div>
                  <span className="font-bold">Delivered orders cannot be cancelled.</span>
                  <p className="mt-0.5 leading-relaxed">
                    Produce handover has already been confirmed. If there is a dispute regarding quality or missing quantities, please file an issue via Resolution Support.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 5. Cancellation Request Form */}
          <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-5 shadow-xs space-y-5">
            <h2 className="text-xs font-bold text-[#315A42] uppercase tracking-wider">
              Cancellation Details
            </h2>

            {formValidationError && (
              <div className="bg-[#FCEBEA] border border-[#A51C19]/30 rounded-[6px] p-3 text-xs text-[#A51C19] flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{formValidationError}</span>
              </div>
            )}

            <form onSubmit={handleOpenConfirmDialog} className="space-y-4">
              {/* Reason Dropdown */}
              <div>
                <label className="block text-xs font-bold text-[#263A31] mb-1.5">
                  Cancellation Reason <span className="text-red-500">*</span>
                </label>
                <select
                  disabled={isAlreadyCancelled || isDelivered}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value as CancellationReason);
                    setFormValidationError(null);
                  }}
                  className="w-full h-[40px] px-3 bg-white border border-[#E0E7E1] rounded-[8px] text-xs text-[#263A31] focus:outline-none focus:border-[#315A42] disabled:bg-[#F6F7F3] disabled:text-[#78877D] cursor-pointer"
                >
                  <option value="">-- Select a cancellation reason --</option>
                  {REASON_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Additional Details Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#263A31]">
                    Additional Details <span className="text-[#78877D] font-normal">(Optional)</span>
                  </label>
                  <span className="text-[11px] text-[#78877D]">
                    {additionalDetails.length} / 500 characters
                  </span>
                </div>
                <textarea
                  disabled={isAlreadyCancelled || isDelivered}
                  rows={4}
                  maxLength={500}
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  placeholder="Provide any additional explanation or context regarding this cancellation request..."
                  className="w-full p-3 bg-white border border-[#E0E7E1] rounded-[8px] text-xs text-[#263A31] focus:outline-none focus:border-[#315A42] disabled:bg-[#F6F7F3] disabled:text-[#78877D] leading-relaxed resize-none"
                />
              </div>

              {/* 6. Important Policy & Refund Information Box */}
              <div className="bg-[#F6F7F3] border border-[#E0E7E1] rounded-[8px] p-4 space-y-2.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-[#315A42]">
                  <Info size={14} className="text-[#315A42]" />
                  <span>Important Cancellation & Refund Guidelines</span>
                </div>
                <ul className="space-y-1.5 text-[#78877D] list-disc list-inside leading-relaxed text-[11px]">
                  <li>
                    <strong className="text-[#263A31]">Pending Orders:</strong> Orders that have not yet been accepted by farm suppliers will be cancelled immediately without penalty.
                  </li>
                  <li>
                    <strong className="text-[#263A31]">Processing or In Transit Orders:</strong> Subject to coordinator and cooperative review. Submitting a request does not guarantee immediate cancellation.
                  </li>
                  <li>
                    <strong className="text-[#263A31]">Refund Reconciliation:</strong> Submitting a request does not mean funds have been refunded. Once approved, the escrow deposit is released and credited back to your buyer wallet within 1-3 business days.
                  </li>
                  <li>
                    <strong className="text-[#263A31]">Finality:</strong> Completed cancellations cannot be reversed or reactivated.
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate(`/buyer/orders/${order.id}`)}
                  className="h-[36px] px-4 bg-white border border-[#E0E7E1] hover:bg-[#EEF2ED] text-[#263A31] rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAlreadyCancelled || isDelivered || isSubmitting}
                  className="inline-flex items-center gap-1.5 h-[36px] px-4 bg-[#315A42] hover:bg-[#264834] disabled:bg-[#78877D]/40 disabled:cursor-not-allowed text-white rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <Send size={13} />
                  Submit Cancellation Request
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* 7. Confirmation Dialog Modal */}
      {isConfirmDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
          <div className="bg-white border border-[#E0E7E1] rounded-[8px] max-w-md w-full p-6 shadow-xl space-y-4 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0E7E1]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FCEBEA] text-[#A51C19] flex items-center justify-center">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#263A31]">Confirm Cancellation Request</h3>
                  <p className="text-[11px] text-[#78877D]">{order.orderCode} • {order.productName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmDialogOpen(false)}
                className="text-[#78877D] hover:text-[#263A31] p-1 rounded cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[#263A31] leading-relaxed">
                Are you sure you want to cancel Order <strong>{order.orderCode}</strong> for <strong>{order.formattedTotalPrice}</strong>?
              </p>

              <div className="bg-[#F6F7F3] rounded-[6px] p-3 border border-[#E0E7E1] space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#78877D]">Selected Reason:</span>
                  <span className="font-bold text-[#263A31]">{reason}</span>
                </div>
                {additionalDetails.trim() && (
                  <div className="pt-1 border-t border-[#E0E7E1] text-[#78877D]">
                    <span>Details:</span> {additionalDetails.trim()}
                  </div>
                )}
              </div>

              <div className="bg-[#FCEBEA] p-2.5 rounded-[6px] border border-[#A51C19]/20 text-[11px] text-[#A51C19] leading-relaxed">
                <strong className="block mb-0.5">Please Note:</strong>
                Immediate cancellation cannot be undone once confirmed. Your order status will immediately be updated to Canceled, and smart escrow holds will be released for refund.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E0E7E1]">
              <button
                type="button"
                onClick={() => setIsConfirmDialogOpen(false)}
                disabled={isSubmitting}
                className="h-[36px] px-3.5 bg-white border border-[#E0E7E1] text-[#263A31] hover:bg-[#EEF2ED] rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 h-[36px] px-4 bg-[#A51C19] hover:bg-[#851614] text-white rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <RotateCcw size={13} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Confirm & Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
