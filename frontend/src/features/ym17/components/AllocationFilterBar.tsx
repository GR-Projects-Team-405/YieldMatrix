import { Search } from 'lucide-react';
import { ALLOCATION_STATUSES } from '../api';
import { statusLabel } from '../format';
import type { TabKey } from '../types';

interface AllocationFilterBarProps {
  activeTab: TabKey;
  onTabChange?: (tab: TabKey) => void;
  search: string;
  onSearchChange?: (val: string) => void;
  statusFilter: string;
  onStatusChange?: (val: string) => void;
  cropFilter: string;
  onCropChange?: (val: string) => void;
  sortOrder: string;
  onSortChange?: (val: string) => void;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'awaiting', label: 'Awaiting Response' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
  { key: 'expired', label: 'Expired' },
];

/** The Accepted tab groups several statuses; the API only filters one at a time. */
const ACCEPTED_UNAVAILABLE =
  'Accepted groups several statuses (supplier accepted through to accepted), but the API accepts one status per request — grouped filtering arrives in a later task.';

/** No crop reference endpoint exists yet, so the list could not be verified. */
const CROP_UNAVAILABLE =
  'Crop filtering needs a crop reference endpoint; none exists yet, so this list cannot be verified.';

/**
 * Filter bar matching Figma design:
 * - Status tabs (All, Awaiting Response, Accepted, Declined, Expired)
 * - Search input with search icon
 * - Status filter dropdown
 * - Crop filter dropdown
 * - Sort order dropdown
 *
 * Tabs, search, status and sort are live. The Accepted tab and the crop
 * dropdown stay disabled with an explanation (see the note below the controls)
 * rather than pretending to filter by something the API cannot express.
 */
export function AllocationFilterBar({
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  cropFilter,
  onCropChange,
  sortOrder,
  onSortChange,
}: AllocationFilterBarProps) {
  return (
    <div className="space-y-4 mb-4">
      {/* Status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Filter allocations by status">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const unavailable = tab.key === 'accepted';
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={unavailable}
              title={unavailable ? ACCEPTED_UNAVAILABLE : undefined}
              onClick={() => onTabChange?.(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                unavailable ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                isActive
                  ? 'bg-[var(--soft)] text-[var(--accent-text)] font-semibold shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--canvas)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter controls row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search (debounced by the parent before it reaches the API) */}
        <div className="md:col-span-5 relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search buyer, crop or allocation ID"
            aria-label="Search buyer, crop or allocation ID"
            maxLength={100}
            className="w-full h-11 pl-10 pr-3 rounded-xl border border-[var(--control-border)] bg-[var(--surface)] text-[var(--text)] text-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-text)]"
          />
        </div>

        {/* Status filter dropdown: one status per request, exactly as the API behaves */}
        <div className="md:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange?.(e.target.value)}
            aria-label="Filter by status"
            className="w-full h-11 px-3 rounded-xl border border-[var(--control-border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-text)]"
          >
            <option value="">Status: All</option>
            {ALLOCATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </div>

        {/* Crop filter dropdown: disabled until a verified crop reference list exists */}
        <div className="md:col-span-2">
          <select
            value={cropFilter}
            onChange={(e) => onCropChange?.(e.target.value)}
            disabled
            aria-label="Filter by crop"
            title={CROP_UNAVAILABLE}
            className="w-full h-11 px-3 rounded-xl border border-[var(--control-border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-text)]"
          >
            <option value="">Crop: All</option>
            <option value="Tomato">Tomato</option>
            <option value="Carrot">Carrot</option>
            <option value="Cabbage">Cabbage</option>
            <option value="Potato">Potato</option>
            <option value="Beans">Beans</option>
          </select>
        </div>

        {/* Sort dropdown */}
        <div className="md:col-span-3">
          <select
            value={sortOrder}
            onChange={(e) => onSortChange?.(e.target.value)}
            aria-label="Sort allocations"
            className="w-full h-11 px-3 rounded-xl border border-[var(--control-border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-text)]"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="expiry">Expiry date</option>
          </select>
        </div>
      </div>

      {/* Why two controls are still unavailable */}
      <p className="text-xs text-[var(--muted)] leading-relaxed">
        <strong className="font-semibold text-[var(--text)]">Accepted</strong> stays off until grouped status filtering
        is supported &mdash; the API accepts one status per request.{' '}
        <strong className="font-semibold text-[var(--text)]">Crop</strong> stays off because no crop reference endpoint
        exists yet, so the option list cannot be verified.
      </p>
    </div>
  );
}
