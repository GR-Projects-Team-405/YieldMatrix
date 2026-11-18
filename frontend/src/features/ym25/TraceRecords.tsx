import { useState, useMemo, useEffect } from 'react';
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

import type { TraceRecord, TraceStats } from './types';

const INITIAL_STATS: TraceStats = {
  totalBatches: 48,
  delivered: 42,
  verifiedRate: '98%',
  scanCount: '1.2K',
};

const INITIAL_RECORDS: TraceRecord[] = [
  { id: 'YM25-B001', produce: 'Tomatoes', farm: 'Green Valley Farm', harvestDate: '28 Oct 2026', status: 'Delivered' },
  { id: 'YM25-B002', produce: 'Carrots', farm: 'Highland Harvest', harvestDate: '27 Oct 2026', status: 'In Transit' },
  { id: 'YM25-B003', produce: 'Lettuce', farm: 'Sunrise Organics', harvestDate: '26 Oct 2026', status: 'Verified' },
  { id: 'YM25-B004', produce: 'Spinach', farm: 'Green Valley Farm', harvestDate: '25 Oct 2026', status: 'Processing' },
  { id: 'YM25-B005', produce: 'Cabbage', farm: 'Highland Harvest', harvestDate: '24 Oct 2026', status: 'Delivered' },
];

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
  const ITEMS_PER_PAGE = 5;

  // Filter records based on search input (Batch ID, Produce, or Farm)
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return INITIAL_RECORDS;
    return INITIAL_RECORDS.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.produce.toLowerCase().includes(q) ||
        r.farm.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Reset to page 1 whenever the search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Dynamic pagination calculations
  const totalRecords = filteredRecords.length;
  const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE) || 1;

  // Slice the 5 records for the active page
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  // Indexes for the "Showing X–Y of Z records" text
  const startIndex = totalRecords === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalRecords);

  const tableHeaders = [
    'Batch ID',
    'Produce',
    'Farm',
    'Harvest Date',
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

      {/* 4 Stat Cards matching your UI design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Batches */}
        <StatCard
          icon={
            <div className="w-8 h-8 rounded-full bg-[#eaf2e8] flex items-center justify-center text-[#315A42]">
              <Sprout size={16} />
            </div>
          }
          label="Total Batches"
          value={INITIAL_STATS.totalBatches}
        />

        {/* Delivered */}
        <StatCard
          icon={
            <div className="w-8 h-8 rounded-full bg-[#e8f2f8] flex items-center justify-center text-[#245b80]">
              <Truck size={16} />
            </div>
          }
          label="Delivered"
          value={INITIAL_STATS.delivered}
        />

        {/* Verified */}
        <StatCard
          icon={
            <div className="w-8 h-8 rounded-full bg-[#eaf2e8] flex items-center justify-center text-[#315A42]">
              <CheckCircle2 size={16} />
            </div>
          }
          label="Verified"
          value={INITIAL_STATS.verifiedRate}
        />

        {/* Scan Count */}
        <StatCard
          icon={
            <div className="w-8 h-8 rounded-full bg-[#f3e8ff] flex items-center justify-center text-[#7c3aed]">
              <Scan size={16} />
            </div>
          }
          label="Scan Count"
          value={INITIAL_STATS.scanCount}
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
      {filteredRecords.length > 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden">
          <Table headers={tableHeaders}>
            {paginatedRecords.map((record) => (
              <TableRow key={record.id}>
                <td className="font-semibold text-[var(--text)]">{record.id}</td>
                <td>{record.produce}</td>
                <td>{record.farm}</td>
                <td className="text-[var(--muted)]">{record.harvestDate}</td>
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
                        navigate(`history/${record.id}`);
                      }}
                      className="!h-8 !px-3 !py-1 text-[13px] gap-1.5 hover:!border-[#315A42] hover:!text-[#315A42] hover:!bg-[#eaf2e8] shadow-sm"
                      title={`View trace history for ${record.id}`}
                      aria-label={`View trace history for batch ${record.id}`}
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
      ) : (
        <EmptyState
          title="No trace records found"
          description="We couldn't find any batches matching your search query. Try searching by a different crop, farm, or ID."
        />
      )}

      {/* Dynamic Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
        <p className="text-[13px] text-[var(--muted)]">
          {totalRecords === 0
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
            Array.from({ length: totalPages - 1 }, (_, index) => index + 2).map((page) => (
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
