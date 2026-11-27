import type { ReactNode } from 'react';
import {
  Apple,
  Flame,
  LayoutGrid,
  List,
  MoreHorizontal,
  Search,
  Sprout,
  Wheat,
} from 'lucide-react';
import { CATEGORY_DEFINITIONS } from '../constants/produceConstants';
import type { ProduceCategory, ProduceViewMode } from '../types/produce';

interface ProduceFiltersProps {
  search: string;
  onSearchChange: (search: string) => void;
  selectedCategory: ProduceCategory;
  onCategoryChange: (category: ProduceCategory) => void;
  categoryCounts: Record<ProduceCategory, number>;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  statusOptions: Array<{ value: string; label: string }>;
  selectedFarm: string;
  onFarmChange: (farm: string) => void;
  farmOptions: Array<{ id: string; name: string }>;
  viewMode: ProduceViewMode;
  onViewModeChange: (mode: ProduceViewMode) => void;
}

const CATEGORY_ICON_MAP: Record<string, ReactNode> = {
  grid: <LayoutGrid size={15} aria-hidden="true" />,
  vegetable: <Sprout size={15} aria-hidden="true" />,
  fruit: <Apple size={15} aria-hidden="true" />,
  grain: <Wheat size={15} aria-hidden="true" />,
  spice: <Flame size={15} aria-hidden="true" />,
  other: <MoreHorizontal size={15} aria-hidden="true" />,
};

/**
 * Filter controls for the My Produce page:
 * 1. Category toggle button group with live item counts
 * 2. Debounced search input field
 * 3. Status filter select dropdown
 * 4. Farm filter select dropdown
 * 5. Grid vs. Table view toggle
 */
export function ProduceFilters({
  search,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categoryCounts,
  selectedStatus,
  onStatusChange,
  statusOptions,
  selectedFarm,
  onFarmChange,
  farmOptions,
  viewMode,
  onViewModeChange,
}: ProduceFiltersProps) {
  const farmSelectOptions = [
    { value: 'all', label: 'Farm: All' },
    ...farmOptions.map((f) => ({ value: f.id, label: f.name })),
  ];

  return (
    <div className="ym09-produce-filters">
      {/* 1. Category Filter Toggle Group */}
      <div
        role="group"
        aria-label="Filter produce by category"
        className="ym09-filter-pills-row"
      >
        {CATEGORY_DEFINITIONS.map(({ key, label, iconName }) => {
          const isSelected = selectedCategory === key;
          const count = categoryCounts[key] ?? 0;
          const icon = CATEGORY_ICON_MAP[iconName];

          return (
            <button
              key={key}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onCategoryChange(key)}
              className={`ym09-filter-pill ${isSelected ? 'ym09-filter-pill--active' : ''}`}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
              <span>{label}</span>
              <span className="ym09-filter-pill-count">({count})</span>
            </button>
          );
        })}
      </div>

      {/* 2. Search, Status, Farm & View Toggle Bar */}
      <div className="ym09-filter-toolbar">
        {/* Search Input Field */}
        <div className="ym09-search-wrap">
          <Search
            size={18}
            aria-hidden="true"
            className="ym09-search-icon"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search produce (e.g., Tomato, Carrot...)"
            aria-label="Search produce listings"
            className="ym09-search-input"
          />
        </div>

        {/* Filters and View Controls Group */}
        <div className="ym09-filter-controls">
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label="Filter listings by status"
            className="ym09-filter-select"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={selectedFarm}
            onChange={(e) => onFarmChange(e.target.value)}
            aria-label="Filter listings by farm"
            className="ym09-filter-select"
          >
            {farmSelectOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* View Mode Toggle Buttons */}
          <div
            className="ym09-view-toggle"
            role="group"
            aria-label="Listing view display mode"
          >
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              onClick={() => onViewModeChange('grid')}
              className={`ym09-view-toggle-btn ${
                viewMode === 'grid' ? 'ym09-view-toggle-btn--active' : ''
              }`}
            >
              <LayoutGrid size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Table list view"
              aria-pressed={viewMode === 'table'}
              onClick={() => onViewModeChange('table')}
              className={`ym09-view-toggle-btn ${
                viewMode === 'table' ? 'ym09-view-toggle-btn--active' : ''
              }`}
            >
              <List size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
