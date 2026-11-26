import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../../components/StatusBadge';
import type { AllocationItem } from '../types';

interface AllocationTableProps {
  allocations: AllocationItem[];
}

/** Absolute path of the Allocation Inbox (see App.tsx). */
const INBOX_PATH = '/farmer/allocations';

/**
 * Allocation Requests table matching Figma mockup:
 * - Columns: ALLOCATION / BUYER, PRODUCE / BATCH, QUANTITY, AGREED VALUE, RESERVATION EXPIRES, STATUS, ACTIONS
 *
 * The action cell is derived from the row itself:
 * - awaiting + live hold  -> Review Request (opens the Allocation Details page)
 * - awaiting + dead hold  -> unavailable hold state, never an actionable request
 * - anything else         -> View Details (same read-only details page)
 * Neither action submits a decision; that arrives with Decision Review.
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
                </td>

                {/* Produce / Batch */}
                <td className="p-3.5 align-middle">
                  <div className="text-[var(--text)] font-medium">
                    {item.cropName} &middot; {item.gradeName}
                  </div>
                  {item.batchDisplayId && (
                    <div className="text-xs text-[var(--muted)] mt-0.5">Batch {item.batchDisplayId}</div>
                  )}
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
                  {/* Stored status stays server-authoritative; when the hold is
                      dead the row is still `held` but can no longer be acted on,
                      so the effective eligibility is spelled out beneath it. */}
                  {item.status === 'held' && item.holdState !== 'active' && (
                    <div className="text-xs text-[#b45309] mt-1">
                      {item.holdState === 'expired'
                        ? 'Response window closed'
                        : item.holdState === 'consumed'
                          ? 'Hold used'
                          : 'No live hold'}
                    </div>
                  )}
                </td>

                {/* Actions */}
                <td className="p-3.5 align-middle text-center whitespace-nowrap">
                  {reviewable ? (
                    <Link
                      to={`${INBOX_PATH}/${item.allocationId}`}
                      title="Open Allocation Details"
                      className="ym-button ym-button--primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg"
                    >
                      <span>Review Request</span>
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                  ) : awaiting ? (
                    <span className="ym-status ym-tone--neutral" title="This hold is no longer actionable">
                      {holdLabel}
                    </span>
                  ) : (
                    <Link
                      to={`${INBOX_PATH}/${item.allocationId}`}
                      title="Open Allocation Details"
                      className="ym-button ym-button--outline inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      View Details
                    </Link>
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
