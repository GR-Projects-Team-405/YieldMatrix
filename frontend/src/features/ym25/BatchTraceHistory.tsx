import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, QrCode } from 'lucide-react';

// Reusable components from frontend/src/components/
import { Table, TableRow } from '../../components/Table';
import { Button } from '../../components/Button';

import type { BatchSummaryInfo, BatchTimelineEvent } from './types';

// Demonstration baseline records
const BATCH_SUMMARIES: Record<string, BatchSummaryInfo> = {
  'YM25-B001': {
    batchId: 'YM25-B001',
    cropGrade: 'Tomatoes · Grade A',
    farmOrigin: 'Green Valley Farm',
    harvestDate: '28 Oct 2026',
    quantityAgreedPrice: '400 kg · LKR 200/kg',
    allocationId: 'ALC-1042',
    orderId: 'ORD-8821',
    tripId: 'TRP-771',
    buyerAcceptance: 'Accepted',
    status: 'Delivered',
  },
  'YM25-B002': {
    batchId: 'YM25-B002',
    cropGrade: 'Carrots · Grade A',
    farmOrigin: 'Highland Harvest',
    harvestDate: '27 Oct 2026',
    quantityAgreedPrice: '350 kg · LKR 180/kg',
    allocationId: 'ALC-1043',
    orderId: 'ORD-8822',
    tripId: 'TRP-772',
    buyerAcceptance: 'Pending',
    status: 'In Transit',
  },
  'YM25-B003': {
    batchId: 'YM25-B003',
    cropGrade: 'Lettuce · Grade Premium',
    farmOrigin: 'Sunrise Organics',
    harvestDate: '26 Oct 2026',
    quantityAgreedPrice: '200 kg · LKR 250/kg',
    allocationId: 'ALC-1044',
    orderId: 'ORD-8823',
    tripId: 'TRP-773',
    buyerAcceptance: 'Accepted',
    status: 'Verified',
  },
  'YM25-B004': {
    batchId: 'YM25-B004',
    cropGrade: 'Spinach · Grade B',
    farmOrigin: 'Green Valley Farm',
    harvestDate: '25 Oct 2026',
    quantityAgreedPrice: '150 kg · LKR 160/kg',
    allocationId: 'ALC-1045',
    orderId: 'ORD-8824',
    tripId: 'TRP-774',
    buyerAcceptance: 'Processing',
    status: 'Processing',
  },
  'YM25-B005': {
    batchId: 'YM25-B005',
    cropGrade: 'Cabbage · Grade A',
    farmOrigin: 'Highland Harvest',
    harvestDate: '24 Oct 2026',
    quantityAgreedPrice: '500 kg · LKR 140/kg',
    allocationId: 'ALC-1046',
    orderId: 'ORD-8825',
    tripId: 'TRP-775',
    buyerAcceptance: 'Accepted',
    status: 'Delivered',
  },
};

const TIMELINE_EVENTS: BatchTimelineEvent[] = [
  {
    id: 'evt-1',
    timestamp: '28 Oct 2026, 06:15',
    actor: 'Green Valley Farm',
    location: 'Farm Gate',
    quantity: '400 kg',
    outcome: 'Harvested',
    tone: 'success',
  },
  {
    id: 'evt-2',
    timestamp: '28 Oct 2026, 07:00',
    actor: 'YieldMatrix',
    location: 'Online reservation',
    quantity: '400 kg',
    outcome: 'Reserved',
    tone: 'success',
  },
  {
    id: 'evt-3',
    timestamp: '28 Oct 2026, 07:15',
    actor: 'Green Valley Farm',
    location: 'Supplier workspace',
    quantity: '400 kg',
    outcome: 'Supplier accepted',
    tone: 'success',
  },
  {
    id: 'evt-4',
    timestamp: '28 Oct 2026, 07:30',
    actor: 'Dispatch team',
    location: 'Trip TRP-771',
    quantity: '400 kg',
    outcome: 'Confirmed / dispatched',
    tone: 'success',
  },
  {
    id: 'evt-5',
    timestamp: '28 Oct 2026, 08:30',
    actor: 'YieldMatrix Ops',
    location: 'Packhouse',
    quantity: '400 kg',
    outcome: 'Packed',
    tone: 'success',
  },
  {
    id: 'evt-6',
    timestamp: '28 Oct 2026, 10:45',
    actor: 'Driver S. Sheriff',
    location: 'Packhouse',
    quantity: '400 kg',
    outcome: 'Collected',
    tone: 'info',
  },
  {
    id: 'evt-7',
    timestamp: '28 Oct 2026, 14:20',
    actor: 'Buyer Logistics',
    location: 'Buyer DC',
    quantity: '400 kg',
    outcome: 'Delivered',
    tone: 'success',
  },
  {
    id: 'evt-8',
    timestamp: '28 Oct 2026, 15:10',
    actor: 'Buyer QA',
    location: 'Buyer DC',
    quantity: '400 kg',
    outcome: 'Accepted',
    tone: 'success',
  },
];

const getStatusToneClass = (status: string) => {
  switch (status) {
    case 'Delivered':
    case 'Verified':
      return 'ym-tone--success';
    case 'Processing':
      return 'ym-tone--warning';
    case 'In Transit':
      return 'ym-tone--info';
    default:
      return 'ym-tone--neutral';
  }
};

const getEventToneClass = (tone: BatchTimelineEvent['tone']) => {
  switch (tone) {
    case 'success':
      return 'ym-tone--success';
    case 'info':
      return 'ym-tone--info';
    case 'warning':
      return 'ym-tone--warning';
    default:
      return 'ym-tone--neutral';
  }
};

const TABLE_HEADERS = [
  'Event Timestamp',
  'Actor',
  'Location',
  'Quantity',
  'Outcome',
];

export default function BatchTraceHistory() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();

  // Find record or default to YM25-B001 template
  const activeBatchId = batchId || 'YM25-B001';
  const batch: BatchSummaryInfo = BATCH_SUMMARIES[activeBatchId] || {
    ...BATCH_SUMMARIES['YM25-B001'],
    batchId: activeBatchId,
  };

  return (
    <div className="space-y-6">
      {/* Back navigation link */}
      <div>
        <Link
          to="../.."
          relative="path"
          className="inline-flex items-center gap-2 text-[14px] font-medium text-[var(--muted)] hover:text-[#315A42] transition"
        >
          <ArrowLeft size={16} />
          <span>Back To Trace Records</span>
        </Link>
      </div>

      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-[26px] font-bold text-[var(--text)] tracking-tight">
          Batch Trace History
        </h1>
        <p className="text-[14px] text-[var(--muted)] mt-1">
          Completed Journey of Batch {batch.batchId}
        </p>
      </div>

      {/* Batch Summary Card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--text)]">Batch Summary</h2>
            <p className="text-[13px] text-[var(--muted)] mt-0.5">
              Demonstration sample data for delivered batch {batch.batchId}
            </p>
          </div>
          <span className={`ym-status self-start sm:self-auto ${getStatusToneClass(batch.status)}`}>
            {batch.status}
          </span>
        </div>

        {/* 2 rows of 4 summary boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[var(--canvas)] rounded-[8px] p-3.5">
            <p className="text-[12px] text-[var(--muted)] font-medium">Crop / Grade</p>
            <p className="text-[14px] font-semibold text-[var(--text)] mt-1">{batch.cropGrade}</p>
          </div>
          <div className="bg-[var(--canvas)] rounded-[8px] p-3.5">
            <p className="text-[12px] text-[var(--muted)] font-medium">Farm Origin</p>
            <p className="text-[14px] font-semibold text-[var(--text)] mt-1">{batch.farmOrigin}</p>
          </div>
          <div className="bg-[var(--canvas)] rounded-[8px] p-3.5">
            <p className="text-[12px] text-[var(--muted)] font-medium">Harvest Date</p>
            <p className="text-[14px] font-semibold text-[var(--text)] mt-1">{batch.harvestDate}</p>
          </div>
          <div className="bg-[var(--canvas)] rounded-[8px] p-3.5">
            <p className="text-[12px] text-[var(--muted)] font-medium">Quantity / agreed price</p>
            <p className="text-[14px] font-semibold text-[var(--text)] mt-1">{batch.quantityAgreedPrice}</p>
          </div>
          <div className="bg-[var(--canvas)] rounded-[8px] p-3.5">
            <p className="text-[12px] text-[var(--muted)] font-medium">Allocation ID</p>
            <p className="text-[14px] font-semibold text-[var(--text)] mt-1">{batch.allocationId}</p>
          </div>
          <div className="bg-[var(--canvas)] rounded-[8px] p-3.5">
            <p className="text-[12px] text-[var(--muted)] font-medium">Order ID</p>
            <p className="text-[14px] font-semibold text-[var(--text)] mt-1">{batch.orderId}</p>
          </div>
          <div className="bg-[var(--canvas)] rounded-[8px] p-3.5">
            <p className="text-[12px] text-[var(--muted)] font-medium">Trip ID</p>
            <p className="text-[14px] font-semibold text-[var(--text)] mt-1">{batch.tripId}</p>
          </div>
          <div className="bg-[var(--canvas)] rounded-[8px] p-3.5">
            <p className="text-[12px] text-[var(--muted)] font-medium">Buyer Acceptance</p>
            <p className="text-[14px] font-semibold text-[var(--text)] mt-1">{batch.buyerAcceptance}</p>
          </div>
        </div>
      </div>

      {/* Event Timeline Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden">
        <Table headers={TABLE_HEADERS}>
          {TIMELINE_EVENTS.map((event) => (
            <TableRow key={event.id}>
              <td className="text-[14px] text-[var(--text)]">{event.timestamp}</td>
              <td className="text-[14px] text-[var(--text)]">{event.actor}</td>
              <td className="text-[14px] text-[var(--text)]">{event.location}</td>
              <td className="text-[14px] text-[var(--text)]">{event.quantity}</td>
              <td>
                <span className={`ym-status ${getEventToneClass(event.tone)}`}>
                  {event.outcome}
                </span>
              </td>
            </TableRow>
          ))}
        </Table>
      </div>

      {/* Bottom Grid: QR Access & Ledger Integrity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Batch Trace / QR Access */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-[18px] font-semibold text-[var(--text)] mb-4">
              Batch Trace / QR Access
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-[var(--canvas)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                <QrCode size={38} className="text-[#315A42]" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[var(--text)]">
                  QR Trace ID: TRC-{batch.batchId}
                </p>
                <p className="text-[12px] text-[var(--muted)]">
                  QR preview only — not connected to a live trace service.
                </p>
                <div className="pt-2">
                  <Button
                    variant="primary"
                    onClick={() => navigate(`../../qr/${batch.batchId}`, { relative: 'path' })}
                    className="!h-9 !px-4 text-[13px] font-medium"
                  >
                    Trace preview · Demo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Local Ledger Integrity */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-6">
          <h3 className="text-[18px] font-semibold text-[var(--text)] mb-4">
            Local Ledger Integrity
          </h3>

          {/* Demonstration Notice Banner */}
          <div className="bg-[var(--soft)] text-[var(--accent-text)] rounded-[8px] px-3.5 py-2 text-[13px] font-medium flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#315A42]" />
            <span>Demonstration only · no live verification</span>
          </div>

          {/* Checklist */}
          <ul className="space-y-2.5 text-[13px] text-[var(--text)]">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 size={16} className="text-[#315A42] flex-shrink-0" />
              <span>Sample event fingerprints · local chain demonstration.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 size={16} className="text-[#315A42] flex-shrink-0" />
              <span>Anchored hashes can reveal later record changes.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 size={16} className="text-[#315A42] flex-shrink-0" />
              <span>Does not prove original claims or produce quality.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}