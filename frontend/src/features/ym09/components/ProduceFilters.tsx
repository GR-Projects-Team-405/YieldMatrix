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
 * 1. Category pill buttons with live item counts
 * 2. Search input field with search icon
 * 3. Status filter select dropdown
 * 4. Farm filter select dropdown (dynamically populated from listing data)
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
  // Generate farm options with "Farm: All" as default
  const farmSelectOptions = [
    { value: 'all', label: 'Farm: All' },
    ...farmOptions.map((f) => ({ value: f.id, label: f.name })),
  ];

  return (
    <div className="ym09-produce-filters" style={{ display: 'grid', gap: '16px' }}>
      {/* 1. Category Pills Bar */}
      <div
        role="tablist"
        aria-label="Filter produce by category"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {CATEGORY_DEFINITIONS.map(({ key, label, iconName }) => {
          const isSelected = selectedCategory === key;
          const count = categoryCounts[key] ?? 0;
          const icon = CATEGORY_ICON_MAP[iconName];

          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onCategoryChange(key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '40px',
                padding: '0 16px',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: isSelected ? 600 : 500,
                border: isSelected ? '1px solid #315A42' : '1px solid var(--border)',
                background: isSelected ? '#315A42' : 'var(--surface)',
                color: isSelected ? '#ffffff' : 'var(--text)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.15s, color 0.15s',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
              <span>{label}</span>
              <span
                style={{
                  fontSize: '12px',
                  opacity: isSelected ? 0.9 : 0.7,
                  marginLeft: '2px',
                }}
              >
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Search, Status, Farm & View Toggle Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Search Input Field */}
        <div
          style={{
            position: 'relative',
            flex: '1 1 300px',
            maxWidth: '520px',
            minWidth: '240px',
          }}
        >
          <Search
            size={18}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search produce (e.g., Tomato, Carrot...)"
            aria-label="Search produce listings"
            style={{
              width: '100%',
              height: '48px',
              padding: '0 16px 0 42px',
              borderRadius: '12px',
              border: '1px solid var(--control-border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        {/* Filters and View Controls Group */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          {/* Status Select */}
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label="Filter listings by status"
            style={{
              height: '48px',
              padding: '0 32px 0 14px',
              borderRadius: '12px',
              border: '1px solid var(--control-border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '14px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Farm Select (Dynamically Populated) */}
          <select
            value={selectedFarm}
            onChange={(e) => onFarmChange(e.target.value)}
            aria-label="Filter listings by farm"
            style={{
              height: '48px',
              padding: '0 32px 0 14px',
              borderRadius: '12px',
              border: '1px solid var(--control-border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '14px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {farmSelectOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* View Mode Toggle Buttons */}
          <div
            style={{
              display: 'inline-flex',
              height: '48px',
              borderRadius: '12px',
              border: '1px solid var(--control-border)',
              background: 'var(--surface)',
              padding: '4px',
              gap: '4px',
            }}
            role="group"
            aria-label="Listing view display mode"
          >
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              onClick={() => onViewModeChange('grid')}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: viewMode === 'grid' ? '#315A42' : 'transparent',
                color: viewMode === 'grid' ? '#ffffff' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'background-color 0.15s, color 0.15s',
              }}
            >
              <LayoutGrid size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Table list view"
              aria-pressed={viewMode === 'table'}
              onClick={() => onViewModeChange('table')}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: viewMode === 'table' ? '#315A42' : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'background-color 0.15s, color 0.15s',
              }}
            >
              <List size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
