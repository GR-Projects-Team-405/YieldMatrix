import { Link } from 'react-router-dom';
import { StatusBadge } from '../../../components/StatusBadge';
import type { HistoryItem } from '../types';

interface HistoryTableProps {
  allocations: HistoryItem[];
}

const INBOX_PATH = '/farmer/allocations';

/**
 * Farmer Allocation History table.
 *
 * Distinctly separates the original Farmer Decision (audit-backed) from the
 * current Operational Status (fulfillment/order outcome).
 */
export function HistoryTable({ allocations }: HistoryTableProps) {
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
              QUANTITY &amp; PRICE
            </th>
            <th scope="col" className="p-3.5 text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
              AGREED VALUE
            </th>
            <th scope="col" className="p-3.5 text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
              FARMER DECISION
            </th>
            <th scope="col" className="p-3.5 text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
              OPERATIONAL STATUS
            </th>
            <th scope="col" className="p-3.5 text-xs font-semibold tracking-wider text-[var(--muted)] uppercase text-center">
              ACTIONS
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
          {allocations.map((item) => {
            const decisionTone =
              item.farmerDecision === 'accepted'
                ? 'success'
                : item.farmerDecision === 'declined'
                  ? 'error'
                  : 'neutral';

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

                {/* Quantity & Unit Price */}
                <td className="p-3.5 align-middle whitespace-nowrap">
                  <div className="text-[var(--text)] font-medium">{item.agreedKg}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">{item.agreedUnitPriceFormatted}</div>
                </td>

                {/* Agreed Value */}
                <td className="p-3.5 align-middle font-semibold text-[var(--text)] whitespace-nowrap">
                  {item.agreedValueFormatted}
                </td>

                {/* Farmer Decision (Audit-backed) */}
                <td className="p-3.5 align-middle whitespace-nowrap">
                  <span className={`ym-status ym-tone--${decisionTone}`}>
                    {item.farmerDecisionDisplay}
                  </span>
                  <div className="text-xs text-[var(--muted)] mt-1" title="Decision Timestamp (Asia/Colombo)">
                    {item.farmerDecisionAtFormatted}
                  </div>
                  {item.farmerDecisionReason && (
                    <div
                      className="text-xs text-[#a51c19] mt-0.5 max-w-[200px] truncate"
                      title={item.farmerDecisionReason}
                    >
                      Reason: {item.farmerDecisionReason}
                    </div>
                  )}
                </td>

                {/* Operational Status & Order Lifecycle */}
                <td className="p-3.5 align-middle whitespace-nowrap">
                  <StatusBadge status={item.operationalStatusDisplay} />
                  <div className="text-xs text-[var(--muted)] mt-1">
                    Order: {item.orderStatusDisplay}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-0.5" title="Allocation Creation Date">
                    Created: {item.createdAtFormatted}
                  </div>
                </td>

                {/* Actions */}
                <td className="p-3.5 align-middle text-center whitespace-nowrap">
                  <Link
                    to={`${INBOX_PATH}/${item.allocationId}`}
                    title="View Allocation Details"
                    className="ym-button ym-button--outline inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer hover:text-[var(--text)] hover:bg-[var(--canvas)]"
                  >
                    View Details
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
