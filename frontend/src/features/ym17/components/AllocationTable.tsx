import { ArrowUpRight } from 'lucide-react';
import { StatusBadge } from '../../../components/StatusBadge';
import type { AllocationItem } from '../types';

interface AllocationTableProps {
  allocations: AllocationItem[];
}

/** Explanations shown with the disabled controls (Task 02 will enable them). */
const REVIEW_TITLE = 'Allocation review will be available in Task 02';
const DETAILS_TITLE = 'Allocation details will be available in Task 02';

/**
 * Allocation Requests table matching Figma mockup:
 * - Columns: ALLOCATION / BUYER, PRODUCE / BATCH, QUANTITY, AGREED VALUE, RESERVATION EXPIRES, STATUS, ACTIONS
 *
 * The action cell is derived from the row itself:
 * - awaiting + live hold  -> Review Request (disabled until Task 02)
 * - awaiting + dead hold  -> unavailable hold state, never an actionable request
 * - anything else         -> unavailable View Details (no decision button)
 */
export function AllocationTable({ allocations }: AllocationTableProps) {
  return (
    <div className="ym-table-scroll rounded-lg border border-[var(--border)] overflow-hidden">
      <table className="ym-table w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-[var(--table-head)] border-b border-[var(--border)]">
            <th scope="col" className="p-3.5 text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
              ALLOCATION / BUYER
            </th>
            <th scope="col" className="p-3.5 text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
              PRODUCE / BATCH
            </th>
            <th scope="col" className="p-3.5 text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
              QUANTITY
            </th>
            <th scope="col" className="p-3.5 text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
              AGREED VALUE
            </th>
            <th scope="col" className="p-3.5 text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
              RESERVATION EXPIRES
            </th>
            <th scope="col" className="p-3.5 text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
              STATUS
            </th>
            <th scope="col" className="p-3.5 text-xs font-semibold tracking-wider text-[var(--muted)] uppercase text-center">
              ACTIONS
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
          {allocations.map((item) => {
            const awaiting = item.status === 'held';
            const reviewable = awaiting && item.holdState === 'active';
            const holdLabel =
              item.holdState === 'expired'
                ? 'Hold expired'
                : item.holdState === 'consumed'
                  ? 'Hold used'
                  : 'No active hold';

            return (
              <tr key={item.allocationId} className="ym-table-row hover:bg-[var(--canvas)] transition-colors">
                {/* Allocation / Buyer */}
                <td className="p-3.5 align-middle">
                  <div className="font-semibold text-[var(--text)]">{item.buyerName}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5" title={item.allocationId}>
                    {item.allocationReference}
                  </div>
                </td>

                {/* Produce / Batch */}
                <td className="p-3.5 align-middle">
                  <div className="text-[var(--text)] font-medium">
                    {item.cropName} &middot; {item.gradeName}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-0.5" title={item.batchId}>
                    {item.batchReference}
                  </div>
                </td>

                {/* Quantity */}
                <td className="p-3.5 align-middle text-[var(--text)] font-normal whitespace-nowrap">
                  {item.agreedKg}
                </td>

                {/* Agreed Value */}
                <td className="p-3.5 align-middle font-semibold text-[var(--text)] whitespace-nowrap">
                  {item.agreedValueFormatted}
                </td>

                {/* Reservation Expires */}
                <td className="p-3.5 align-middle whitespace-nowrap">
                  <div className="text-[var(--text)]">{item.reservationExpiryFormatted}</div>
                  <div
                    className={`text-xs mt-0.5 ${
                      item.isExpiringSoon || item.holdState === 'expired'
                        ? 'text-[#b45309] font-medium'
                        : 'text-[var(--muted)]'
                    }`}
                  >
                    {item.expirySubtext}
                  </div>
                </td>

                {/* Status */}
                <td className="p-3.5 align-middle whitespace-nowrap">
                  <StatusBadge status={item.statusDisplay} />
                </td>

                {/* Actions */}
                <td className="p-3.5 align-middle text-center whitespace-nowrap">
                  {reviewable ? (
                    <button
                      type="button"
                      disabled
                      title={REVIEW_TITLE}
                      className="ym-button ym-button--primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg opacity-95 cursor-not-allowed"
                    >
                      <span>Review Request</span>
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </button>
                  ) : awaiting ? (
                    <span className="ym-status ym-tone--neutral" title={DETAILS_TITLE}>
                      {holdLabel}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title={DETAILS_TITLE}
                      className="ym-button ym-button--unavailable inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg"
                    >
                      View Details
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
