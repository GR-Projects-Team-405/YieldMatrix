import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronDown,
  Search,
  Filter,
  Eye,
  Sprout,
  Truck,
  CheckCircle2,
  Scan,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// Reusable shared components from frontend/src/components/
import { Table, TableRow } from '../../components/Table';
import { Button } from '../../components/Button';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';
import { Alert } from '../../components/Alert';
import { getApiErrorMessage, getTraceRecords, formatTraceDate, formatTraceQuantity, type TraceRecordDto } from './api';

import type { TraceRecord } from './types';

const getStatusToneClass = (status: TraceRecord['status']) => {
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

export default function TraceRecords() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange] = useState('Last 30 days');
  const [currentPage, setCurrentPage] = useState(1);
  const [records, setRecords] = useState<TraceRecordDto[]>([]);
  const [summary, setSummary] = useState({ total: 0, delivered: 0, verified: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getTraceRecords(currentPage, searchQuery.trim(), controller.signal)
      .then(({ data }) => {
        setRecords(data.records);
        setSummary(data.summary);
        setTotalPages(Math.max(data.pagination.totalPages, 1));
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(getApiErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentPage, searchQuery]);

  const totalRecords = summary.total;
  const startIndex = totalRecords === 0 ? 0 : (currentPage - 1) * 5 + 1;
  const endIndex = Math.min(currentPage * 5, totalRecords);
  const firstVisiblePage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const visiblePages = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => firstVisiblePage + index);

  const tableHeaders = [
    'Batch ID',
    'Produce',
    'Farm',
    'Harvest Date',
    'Quantity',
    'Status',
    <div key="actions" className="text-center">Actions</div>,
  ];

  return (
    <div className="space-y-6">
      {/* Top Bar: Subtitle & Date Filter Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 -mt-2">
        <p className="text-[14px] text-[var(--muted)]">
          View and track the journey of harvested produce from farm to delivery.
        </p>
        <Button
          variant="outline"
          className="!h-10 !px-4 text-[13px] self-start sm:self-auto"
        >
          <Calendar size={15} className="text-[var(--muted)]" />
          <span>{dateRange}</span>
          <ChevronDown size={15} className="text-[var(--muted)] ml-1" />
        </Button>
      </div>

      {/* Metrics reflect the active search scope. Scan counts are not stored yet. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Batches */}
        <StatCard
          icon={
            <div className="w-8 h-8 rounded-full bg-[#eaf2e8] flex items-center justify-center text-[#315A42]">
              <Sprout size={16} />
            </div>
          }
          label="Total Batches"
          value={summary.total}
        />

        {/* Delivered */}
        <StatCard
          icon={
            <div className="w-8 h-8 rounded-full bg-[#e8f2f8] flex items-center justify-center text-[#245b80]">
              <Truck size={16} />
            </div>
          }
          label="Delivered"
          value={summary.delivered}
        />

        {/* Accepted batches */}
        <StatCard
          icon={
            <div className="w-8 h-8 rounded-full bg-[#eaf2e8] flex items-center justify-center text-[#315A42]">
              <CheckCircle2 size={16} />
            </div>
          }
          label="Verified batches"
          value={summary.verified}
        />

        {/* Scan Count */}
        <StatCard
          icon={
            <div className="w-8 h-8 rounded-full bg-[#f3e8ff] flex items-center justify-center text-[#7c3aed]">
              <Scan size={16} />
            </div>
          }
          label="Scan Count"
          value="—"
          subtext="Not tracked yet"
        />
      </div>

      {/* Search Bar & Filter Button */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by batch ID, produce or farm..."
            className="w-full h-[48px] pl-11 pr-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[14px] text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[#315A42] focus:border-transparent transition"
          />
        </div>
        <Button variant="outline" className="gap-2">
          <span>Filter</span>
          <Filter size={16} />
        </Button>
      </div>

      {/* Reusing Table and TableRow components */}
      {error && <Alert type="error">{error}</Alert>}
      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]" role="status">
          Loading trace records…
        </div>
      ) : records.length > 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden">
          <Table headers={tableHeaders}>
            {records.map((record) => (
              <TableRow key={record.id}>
                <td className="font-semibold text-[var(--text)]">{record.displayId}</td>
                <td>{record.produce}</td>
                <td>{record.farm}</td>
                <td className="text-[var(--muted)]">{formatTraceDate(record.harvestDate)}</td>
                <td className="text-[var(--muted)]">{formatTraceQuantity(record.quantityKg)}</td>
                <td>
                  <span className={`ym-status ${getStatusToneClass(record.status)}`}>
                    {record.status}
                  </span>
                </td>
                <td className="text-center">
                  <div className="flex items-center justify-center">
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`history/${encodeURIComponent(record.displayId)}`);
                      }}
                      className="!h-8 !px-3 !py-1 text-[13px] gap-1.5 hover:!border-[#315A42] hover:!text-[#315A42] hover:!bg-[#eaf2e8] shadow-sm"
                      title={`View trace history for ${record.displayId}`}
                      aria-label={`View trace history for batch ${record.displayId}`}
                    >
                      <Eye size={15} />
                      <span>View</span>
                    </Button>
                  </div>
                </td>
              </TableRow>
            ))}
          </Table>
        </div>
      ) : !error ? (
        <EmptyState
          title="No trace records found"
          description="We couldn't find any batches matching your search query. Try searching by a different crop, farm, or ID."
        />
      ) : null}

      {/* Dynamic Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
        <p className="text-[13px] text-[var(--muted)]">
          {loading
            ? 'Loading records…'
            : totalRecords === 0
            ? 'Showing 0 records'
            : `Showing ${startIndex}–${endIndex} of ${totalRecords} records`}
        </p>

        <div className="flex items-center gap-1.5">
          {/* Previous Page Button */}
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="w-9 h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--muted)] hover:bg-[var(--canvas)] disabled:opacity-40 disabled:cursor-not-allowed transition"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Page 1 (Always shown) */}
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            className={`w-9 h-9 rounded-lg text-[13px] font-medium transition ${
              currentPage === 1
                ? 'bg-[#315A42] text-white'
                : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--canvas)]'
            }`}
          >
            1
          </button>

          {/* Next pages: Only rendered if more than 5 batches (totalPages > 1) */}
          {totalPages > 1 &&
            visiblePages.map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`w-9 h-9 rounded-lg text-[13px] font-medium transition ${
                  currentPage === page
                    ? 'bg-[#315A42] text-white'
                    : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--canvas)]'
                }`}
              >
                {page}
              </button>
            ))}

          {/* Next Page Button */}
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage >= totalPages}
            className="w-9 h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--muted)] hover:bg-[var(--canvas)] disabled:opacity-40 disabled:cursor-not-allowed transition"
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
