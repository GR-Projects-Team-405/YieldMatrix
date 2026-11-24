import React, { useEffect, useId, useRef, useState } from 'react';
import { Eye, Info, ShoppingBag, ShoppingCart, Table2, X } from 'lucide-react';
import { Button } from '../../../../components/Button';
import type {
  ProduceListingDetailView,
  ListingAllocationRecord,
  ListingOrderRecord,
} from '../../types/produce';
import {
  formatDisplayDateColombo,
  formatDisplayDateTimeColombo,
  formatKg,
  formatLkrPrice,
  formatLkrTotal,
  getAllocationStatusTone,
  getOrderStatusTone,
} from '../../utils/produceFormatters';

interface AllocationsTabProps {
  listing: ProduceListingDetailView;
  onViewAllocation?: (allocation: ListingAllocationRecord) => void;
  onViewOrder?: (order: ListingOrderRecord) => void;
}

type InspectedRecord =
  | { kind: 'allocation'; data: ListingAllocationRecord }
  | { kind: 'order'; data: ListingOrderRecord };

export const AllocationsTab: React.FC<AllocationsTabProps> = ({
  listing,
  onViewAllocation,
  onViewOrder,
}) => {
  const [inspectedRecord, setInspectedRecord] = useState<InspectedRecord | null>(null);
  const dialogTitleId = useId();
  const closeDialogBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!inspectedRecord) return;

    const previousFocus = document.activeElement;
    closeDialogBtnRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setInspectedRecord(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [inspectedRecord]);

  const allocations = listing.allocations || [];
  const orders = listing.orders || [];

  const totalKg = listing.offeredKg || 0;
  const availableKg = listing.availableKg || 0;
  const reservedKg = listing.reservedKg || 0;
  const orderedKg = orders.reduce((sum, o) => sum + (o.orderKg || 0), 0);

  const handleViewAllocation = (alloc: ListingAllocationRecord) => {
    if (onViewAllocation) {
      onViewAllocation(alloc);
      return;
    }
    setInspectedRecord({ kind: 'allocation', data: alloc });
  };

  const handleViewOrder = (order: ListingOrderRecord) => {
    if (onViewOrder) {
      onViewOrder(order);
      return;
    }
    setInspectedRecord({ kind: 'order', data: order });
  };

  return (
    <>
      <div className="ym09-allocations-layout" data-testid="allocations-tab">
        {/* Left Column: Allocations and Orders Tables */}
        <div className="ym09-allocations-tables-col">
          {/* Card 1: Current Allocations */}
          <section className="ym09-details-card" aria-labelledby="current-allocations-title">
            <header className="ym09-details-card-header">
              <div>
                <h3 id="current-allocations-title" className="ym09-details-card-title">
                  <ShoppingBag size={20} aria-hidden="true" />
                  Current Allocations
                </h3>
                <p className="ym09-details-card-subtitle">
                  Buyer allocations and order progress for this listing.
                </p>
              </div>
            </header>

            <div className="ym-table-scroll">
              <table className="ym-table">
                <thead>
                  <tr>
                    <th>Allocation ID</th>
                    <th>Buyer / Shop</th>
                    <th>Allocated Qty</th>
                    <th>Status</th>
                    <th>Allocated On</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)' }}>
                        No active allocations for this listing.
                      </td>
                    </tr>
                  ) : (
                    allocations.map((alloc) => {
                      const toneClass = `ym-tone--${getAllocationStatusTone(alloc.status, alloc.displayStatus)}`;

                      return (
                        <tr key={alloc.id} className="ym-table-row">
                          <td style={{ fontWeight: 600, color: 'var(--text)' }}>{alloc.id}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <ShoppingBag
                                size={15}
                                style={{ color: 'var(--muted)', flexShrink: 0 }}
                                aria-hidden="true"
                              />
                              <span>{alloc.buyerName}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 500 }}>{formatKg(alloc.allocatedKg)}</td>
                          <td>
                            <span className={`ym-status ${toneClass}`}>
                              {alloc.displayStatus || alloc.status}
                            </span>
                          </td>
                          <td style={{ color: 'var(--muted)', fontSize: '13px' }}>
                            {formatDisplayDateColombo(alloc.allocatedOn)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="icon-button ym09-icon-action-btn"
                              title="View allocation summary"
                              aria-label={`View allocation ${alloc.id}`}
                              onClick={() => handleViewAllocation(alloc)}
                            >
                              <Eye size={15} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Card 2: Orders */}
          <section className="ym09-details-card" aria-labelledby="orders-title">
            <header className="ym09-details-card-header">
              <div>
                <h3 id="orders-title" className="ym09-details-card-title">
                  <ShoppingCart size={20} aria-hidden="true" />
                  Orders
                </h3>
                <p className="ym09-details-card-subtitle">
                  Confirmed purchase orders from buyers for this listing.
                </p>
              </div>
            </header>

            <div className="ym-table-scroll">
              <table className="ym-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Buyer / Shop</th>
                    <th>Order Qty</th>
                    <th>Order Value</th>
                    <th>Status</th>
                    <th>Order Date</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)' }}>
                        No purchase orders recorded for this listing.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const toneClass = `ym-tone--${getOrderStatusTone(order.status, order.displayStatus)}`;

                      const valueLKR =
                        order.orderValueCents !== null && order.orderValueCents !== undefined
                          ? formatLkrTotal(order.orderValueCents)
                          : '—';

                      return (
                        <tr key={order.id} className="ym-table-row">
                          <td style={{ fontWeight: 600, color: 'var(--text)' }}>{order.id}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <ShoppingBag
                                size={15}
                                style={{ color: 'var(--muted)', flexShrink: 0 }}
                                aria-hidden="true"
                              />
                              <span>{order.buyerName}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 500 }}>{formatKg(order.orderKg)}</td>
                          <td style={{ fontWeight: 600 }}>{valueLKR}</td>
                          <td>
                            <span className={`ym-status ${toneClass}`}>
                              {order.displayStatus || order.status}
                            </span>
                          </td>
                          <td style={{ color: 'var(--muted)', fontSize: '13px' }}>
                            {formatDisplayDateColombo(order.orderDate)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="icon-button ym09-icon-action-btn"
                              title="View order summary"
                              aria-label={`View order ${order.id}`}
                              onClick={() => handleViewOrder(order)}
                            >
                              <Eye size={15} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Column: Quantity Summary Sidebar */}
        <aside className="ym09-summary-sidebar" aria-labelledby="quantity-summary-title">
          <div className="ym09-details-card">
            <header className="ym09-details-card-header" style={{ marginBottom: '16px' }}>
              <h3 id="quantity-summary-title" className="ym09-details-card-title">
                <Table2 size={20} aria-hidden="true" />
                Quantity Summary
              </h3>
            </header>

            <table className="ym09-kv-table">
              <tbody>
                <tr className="ym09-kv-row">
                  <th scope="row" className="ym09-kv-key">Total Quantity</th>
                  <td className="ym09-kv-val font-semibold">{formatKg(totalKg)}</td>
                </tr>
                <tr className="ym09-kv-row">
                  <th scope="row" className="ym09-kv-key">Reserved (Allocations)</th>
                  <td className="ym09-kv-val">{formatKg(reservedKg)}</td>
                </tr>
                <tr className="ym09-kv-row">
                  <th scope="row" className="ym09-kv-key">Ordered (Confirmed)</th>
                  <td className="ym09-kv-val">{formatKg(orderedKg)}</td>
                </tr>
              </tbody>
            </table>

            <div className="ym09-available-bar">
              <span>Available Quantity</span>
              <span style={{ fontSize: '18px', fontWeight: 700 }}>{formatKg(availableKg)}</span>
            </div>

            <div className="ym09-notice-box-blue" role="note">
              <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
              <div>
                Reserved quantity includes active allocations. Ordered quantity includes confirmed buyer orders.
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Allocation / Order Inspection Dialog */}
      {inspectedRecord && (
        <div
          className="ym09-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          onClick={() => setInspectedRecord(null)}
        >
          <div className="ym09-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              ref={closeDialogBtnRef}
              type="button"
              className="ym09-modal-close-btn"
              onClick={() => setInspectedRecord(null)}
              aria-label="Close details dialog"
              title="Close (Esc)"
            >
              <X size={18} aria-hidden="true" />
            </button>

            <h3 id={dialogTitleId} className="ym09-modal-title">
              {inspectedRecord.kind === 'allocation' ? 'Allocation Details' : 'Order Details'}
            </h3>

            {inspectedRecord.kind === 'allocation' ? (
              <table className="ym09-kv-table">
                <tbody>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Allocation ID</th>
                    <td className="ym09-kv-val">{inspectedRecord.data.id}</td>
                  </tr>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Order ID</th>
                    <td className="ym09-kv-val">{inspectedRecord.data.orderId}</td>
                  </tr>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Buyer / Shop</th>
                    <td className="ym09-kv-val">{inspectedRecord.data.buyerName}</td>
                  </tr>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Allocated Qty</th>
                    <td className="ym09-kv-val">{formatKg(inspectedRecord.data.allocatedKg)}</td>
                  </tr>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Agreed Unit Price</th>
                    <td className="ym09-kv-val">{formatLkrPrice(inspectedRecord.data.agreedUnitPriceCents)}</td>
                  </tr>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Agreed Value</th>
                    <td className="ym09-kv-val">{formatLkrTotal(inspectedRecord.data.agreedValueCents)}</td>
                  </tr>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Status</th>
                    <td className="ym09-kv-val">
                      <span
                        className={`ym-status ym-tone--${getAllocationStatusTone(
                          inspectedRecord.data.status,
                          inspectedRecord.data.displayStatus
                        )}`}
                      >
                        {inspectedRecord.data.displayStatus || inspectedRecord.data.status}
                      </span>
                    </td>
                  </tr>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Allocated On</th>
                    <td className="ym09-kv-val">
                      {formatDisplayDateTimeColombo(inspectedRecord.data.allocatedOn)}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <table className="ym09-kv-table">
                <tbody>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Order ID</th>
                    <td className="ym09-kv-val">{inspectedRecord.data.id}</td>
                  </tr>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Buyer / Shop</th>
                    <td className="ym09-kv-val">{inspectedRecord.data.buyerName}</td>
                  </tr>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Order Qty</th>
                    <td className="ym09-kv-val">{formatKg(inspectedRecord.data.orderKg)}</td>
                  </tr>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Order Value</th>
                    <td className="ym09-kv-val">
                      {inspectedRecord.data.orderValueCents !== null &&
                      inspectedRecord.data.orderValueCents !== undefined
                        ? formatLkrTotal(inspectedRecord.data.orderValueCents)
                        : '—'}
                    </td>
                  </tr>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Status</th>
                    <td className="ym09-kv-val">
                      <span
                        className={`ym-status ym-tone--${getOrderStatusTone(
                          inspectedRecord.data.status,
                          inspectedRecord.data.displayStatus
                        )}`}
                      >
                        {inspectedRecord.data.displayStatus || inspectedRecord.data.status}
                      </span>
                    </td>
                  </tr>
                  <tr className="ym09-kv-row">
                    <th scope="row" className="ym09-kv-key">Order Date</th>
                    <td className="ym09-kv-val">
                      {formatDisplayDateTimeColombo(inspectedRecord.data.orderDate)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <Button variant="outline" onClick={() => setInspectedRecord(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
