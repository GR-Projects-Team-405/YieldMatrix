import { useState, useEffect, useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronDown,
  Check,
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
import {
  getApiErrorMessage,
  getTraceRecords,
  formatTraceDate,
  formatTraceQuantity,
  type TraceDateRange,
  type TraceRecordDto,
  type TraceStatusFilter,
} from './api';

import type { TraceRecord } from './types';

interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterSelectProps<T extends string> {
  label: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
  icon: typeof Calendar;
}

function FilterSelect<T extends string>({ label, value, options, onChange, icon: Icon }: FilterSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (open) selectedOptionRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  const moveFocus = (direction: 1 | -1) => {
    const buttons = Array.from(containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = currentIndex < 0
      ? (direction === 1 ? 0 : buttons.length - 1)
      : (currentIndex + direction + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex h-12 min-w-[164px] items-center gap-2 rounded-xl border border-[var(--control-border)] bg-[var(--surface)] px-3.5 text-sm font-medium text-[var(--text)] shadow-sm transition hover:border-[var(--accent-text)] hover:bg-[var(--canvas)] focus-visible:ring-2 focus-visible:ring-[var(--accent-text)] focus-visible:ring-offset-2"
      >
        <Icon size={16} className="shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
        <span className="flex-1 text-left">{selectedOption?.label}</span>
        <ChevronDown size={16} className={`shrink-0 text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={id}
          role="listbox"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              moveFocus(event.key === 'ArrowDown' ? 1 : -1);
            } else if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault();
              const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
              (event.key === 'Home' ? buttons?.[0] : buttons?.[buttons.length - 1])?.focus();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
              triggerRef.current?.focus();
            }
          }}
          className="absolute right-0 z-30 mt-2 w-full min-w-[200px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                ref={isSelected ? selectedOptionRef : undefined}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-text)] ${
                  isSelected
                    ? 'bg-[var(--soft)] font-semibold text-[var(--accent-text)]'
                    : 'text-[var(--text)] hover:bg-[var(--canvas)]'
                }`}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={16} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  const [dateRange, setDateRange] = useState<TraceDateRange>('all');
  const [statusFilter, setStatusFilter] = useState<TraceStatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [records, setRecords] = useState<TraceRecordDto[]>([]);
  const [summary, setSummary] = useState({ total: 0, delivered: 0, verified: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateRange, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getTraceRecords(currentPage, searchQuery.trim(), dateRange, statusFilter, controller.signal)
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
  }, [currentPage, searchQuery, dateRange, statusFilter]);

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
        <div className="self-start sm:self-auto">
          <FilterSelect
            label="Filter by harvest date"
            value={dateRange}
            onChange={setDateRange}
            icon={Calendar}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
              { value: 'all', label: 'All time' },
            ]}
          />
        </div>
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
        <FilterSelect
          label="Filter trace records by status"
          value={statusFilter}
          onChange={setStatusFilter}
          icon={Filter}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'Processing', label: 'Processing' },
            { value: 'In Transit', label: 'In Transit' },
            { value: 'Verified', label: 'Verified' },
            { value: 'Delivered', label: 'Delivered' },
          ]}
        />
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
