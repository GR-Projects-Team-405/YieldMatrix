import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  ArrowRight,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { MarketplaceSubnav, ProduceCard } from './ProduceCard';
import type {
  MarketplaceSearchResponse,
  SearchAvailabilityMode,
  SearchSortMode,
} from './types';
import './ym11.css';

const AVAILABILITY_OPTIONS: { value: SearchAvailabilityMode; label: string }[] = [
  { value: 'all', label: 'All availability' },
  { value: 'available_now', label: 'Available now' },
  { value: 'within_7_days', label: 'Available within 7 days' },
  { value: 'within_30_days', label: 'Available within 30 days' },
  { value: 'planned', label: 'Planned future harvests' },
];

export default function MarketplaceSearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [result, setResult] = useState<MarketplaceSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());

  // Local filter form controls synced with URL params
  const [qInput, setQInput] = useState(searchParams.get('q') || '');
  const [cropId, setCropId] = useState(searchParams.get('cropId') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [gradeIds, setGradeIds] = useState<string[]>(
    (searchParams.get('gradeIds') || '').split(',').filter(Boolean)
  );
  const [district, setDistrict] = useState(searchParams.get('district') || '');
  const [minPriceLkr, setMinPriceLkr] = useState(() => {
    const cents = searchParams.get('minPriceCents');
    return cents ? String(Number(cents) / 100) : '';
  });
  const [maxPriceLkr, setMaxPriceLkr] = useState(() => {
    const cents = searchParams.get('maxPriceCents');
    return cents ? String(Number(cents) / 100) : '';
  });
  const [availability, setAvailability] = useState<SearchAvailabilityMode>(
    (searchParams.get('availability') as SearchAvailabilityMode) || 'all'
  );
  const [minKg, setMinKg] = useState(searchParams.get('minKg') || '');
  const [sort, setSort] = useState<SearchSortMode>(
    (searchParams.get('sort') as SearchSortMode) || 'price_asc'
  );
  const [validationError, setValidationError] = useState('');

  const paramsKey = searchParams.toString();

  const fetchSearch = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const params: Record<string, string> = {};
        searchParams.forEach((value, key) => {
          if (value) params[key] = value;
        });
        const { data } = await api.get<MarketplaceSearchResponse>('/ym11/marketplace/search', {
          params,
          signal,
        });
        setResult(data);
      } catch (err) {
        if ((err as { name?: string })?.name === 'CanceledError') return;
        setError('Could not load search results. Check your filters and try again.');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paramsKey]
  );

  useEffect(() => {
    setQInput(searchParams.get('q') || '');
    setCropId(searchParams.get('cropId') || '');
    setCategory(searchParams.get('category') || '');
    setGradeIds((searchParams.get('gradeIds') || '').split(',').filter(Boolean));
    setDistrict(searchParams.get('district') || '');
    const minC = searchParams.get('minPriceCents');
    const maxC = searchParams.get('maxPriceCents');
    setMinPriceLkr(minC ? String(Number(minC) / 100) : '');
    setMaxPriceLkr(maxC ? String(Number(maxC) / 100) : '');
    setAvailability((searchParams.get('availability') as SearchAvailabilityMode) || 'all');
    setMinKg(searchParams.get('minKg') || '');
    setSort((searchParams.get('sort') as SearchSortMode) || 'price_asc');
  }, [paramsKey, searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSearch(controller.signal);
    return () => controller.abort();
  }, [fetchSearch]);

  function applyFilters(overrides?: { page?: number; sort?: SearchSortMode }) {
    setValidationError('');
    const next = new URLSearchParams();
    if (qInput.trim()) next.set('q', qInput.trim());
    if (cropId) next.set('cropId', cropId);
    if (category) next.set('category', category);
    if (gradeIds.length > 0) next.set('gradeIds', gradeIds.join(','));
    if (district) next.set('district', district);

    if (minPriceLkr.trim() !== '') {
      const val = Number(minPriceLkr);
      if (!Number.isFinite(val) || val < 0) {
        setValidationError('Minimum price must be a non-negative LKR amount.');
        return;
      }
      next.set('minPriceCents', String(Math.round(val * 100)));
    }
    if (maxPriceLkr.trim() !== '') {
      const val = Number(maxPriceLkr);
      if (!Number.isFinite(val) || val < 0) {
        setValidationError('Maximum price must be a non-negative LKR amount.');
        return;
      }
      next.set('maxPriceCents', String(Math.round(val * 100)));
    }
    if (minPriceLkr.trim() !== '' && maxPriceLkr.trim() !== '' && Number(minPriceLkr) > Number(maxPriceLkr)) {
      setValidationError('Maximum price must be greater than or equal to minimum price.');
      return;
    }

    if (minKg.trim() !== '') {
      if (!/^\d+(?:\.\d{1,3})?$/.test(minKg.trim())) {
        setValidationError('Minimum quantity must be a non-negative kg number (up to 3 decimals).');
        return;
      }
      next.set('minKg', minKg.trim());
    }

    if (availability && availability !== 'all') next.set('availability', availability);
    const chosenSort = overrides?.sort ?? sort;
    if (chosenSort && chosenSort !== 'price_asc') next.set('sort', chosenSort);
    if (overrides?.page && overrides.page > 1) next.set('page', String(overrides.page));

    setSearchParams(next);
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    applyFilters({ page: 1 });
  }

  function clearAllFilters() {
    setValidationError('');
    setSearchParams(new URLSearchParams());
  }

  function removeSingleParam(key: string, valueToRemove?: string) {
    const next = new URLSearchParams(searchParams);
    if (key === 'gradeIds' && valueToRemove) {
      const remaining = (next.get('gradeIds') || '')
        .split(',')
        .filter((id) => id && id !== valueToRemove);
      if (remaining.length > 0) next.set('gradeIds', remaining.join(','));
      else next.delete('gradeIds');
    } else {
      next.delete(key);
    }
    next.delete('page');
    setSearchParams(next);
  }

  function toggleGrade(id: string) {
    setGradeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSaved(id: string) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filterCrops = result?.filters.crops || [];
  const filterGrades = result?.filters.grades || [];
  const filterDistricts = result?.filters.districts || [];
  const filterCategories = result?.filters.categories || [];

  // Build removable active filter chips
  const chips: { key: string; label: string; value?: string }[] = [];
  if (searchParams.get('q')) chips.push({ key: 'q', label: `"${searchParams.get('q')}"` });
  if (searchParams.get('cropId')) {
    const found = filterCrops.find((c) => c.id === searchParams.get('cropId'));
    chips.push({ key: 'cropId', label: found?.name || 'Crop filter' });
  }
  if (searchParams.get('category')) {
    const found = filterCategories.find((c) => c.key === searchParams.get('category'));
    chips.push({ key: 'category', label: found?.label || searchParams.get('category') || '' });
  }
  for (const gid of (searchParams.get('gradeIds') || '').split(',').filter(Boolean)) {
    const found = filterGrades.find((g) => g.id === gid);
    chips.push({ key: 'gradeIds', label: found?.name || 'Grade', value: gid });
  }
  if (searchParams.get('district')) {
    chips.push({ key: 'district', label: searchParams.get('district') || '' });
  }
  if (searchParams.get('availability') && searchParams.get('availability') !== 'all') {
    const found = AVAILABILITY_OPTIONS.find((a) => a.value === searchParams.get('availability'));
    chips.push({ key: 'availability', label: found?.label || '' });
  }
  if (searchParams.get('minKg')) {
    chips.push({ key: 'minKg', label: `Min ${searchParams.get('minKg')} kg` });
  }
  if (searchParams.get('minPriceCents')) {
    chips.push({
      key: 'minPriceCents',
      label: `Min LKR ${Number(searchParams.get('minPriceCents')) / 100}/kg`,
    });
  }
  if (searchParams.get('maxPriceCents')) {
    chips.push({
      key: 'maxPriceCents',
      label: `Max LKR ${Number(searchParams.get('maxPriceCents')) / 100}/kg`,
    });
  }

  return (
    <div className="ym11-overview">
      <section className="ym11-header" aria-label="Marketplace search heading">
        <div>
          <p className="ym11-eyebrow">Marketplace search</p>
          <h2 className="ym11-greeting">Search Results</h2>
          <p className="ym11-subtitle">
            Find the right produce, suppliers and available quantities.
          </p>
        </div>
      </section>

      <MarketplaceSubnav />

      {/* Top Search Bar */}
      <ContentCard>
        <form className="ym11-search-bar" onSubmit={handleFormSubmit}>
          <div className="ym11-search-input-wrap">
            <Search size={18} className="ym11-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="ym11-search-input"
              placeholder="Search by crop, grower farm, grade, or district…"
              aria-label="Search marketplace harvests"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary">
            <Search size={16} aria-hidden="true" />
            Search
          </Button>
        </form>
      </ContentCard>

      <div className="ym11-search-layout">
        {/* Left Filter Sidebar */}
        <ContentCard>
          <form className="ym11-filter-sidebar" onSubmit={handleFormSubmit}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="ym11-card-title" style={{ fontSize: 16 }}>
                Filters
              </h3>
              <button
                type="button"
                className="ym11-inline-link"
                style={{ marginTop: 0, background: 'none', border: 0 }}
                onClick={clearAllFilters}
              >
                Clear all
              </button>
            </div>

            {validationError && <Alert type="error">{validationError}</Alert>}

            <SelectField
              label="Crop"
              value={cropId}
              options={[
                { value: '', label: 'All crops' },
                ...filterCrops.map((c) => ({ value: c.id, label: c.name })),
              ]}
              onChange={(e) => setCropId(e.target.value)}
            />

            <SelectField
              label="Category"
              value={category}
              options={[
                { value: '', label: 'All categories' },
                ...filterCategories.map((c) => ({ value: c.key, label: c.label })),
              ]}
              onChange={(e) => setCategory(e.target.value)}
            />

            <div className="ym11-filter-group">
              <span className="ym11-filter-group-title">Grade</span>
              <div className="ym11-check-list">
                {filterGrades.map((grade) => (
                  <label className="ym11-check-item" key={grade.id}>
                    <input
                      type="checkbox"
                      checked={gradeIds.includes(grade.id)}
                      onChange={() => toggleGrade(grade.id)}
                    />
                    <span>{grade.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <SelectField
              label="District"
              value={district}
              options={[
                { value: '', label: 'All districts' },
                ...filterDistricts.map((d) => ({ value: d, label: d })),
              ]}
              onChange={(e) => setDistrict(e.target.value)}
            />

            <div className="ym11-filter-group">
              <span className="ym11-filter-group-title">Price range (LKR/kg)</span>
              <div className="ym11-price-inputs">
                <InputField
                  label="Min"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={minPriceLkr}
                  onChange={(e) => setMinPriceLkr(e.target.value)}
                />
                <InputField
                  label="Max"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="500"
                  value={maxPriceLkr}
                  onChange={(e) => setMaxPriceLkr(e.target.value)}
                />
              </div>
            </div>

            <div className="ym11-filter-group">
              <span className="ym11-filter-group-title">Harvest availability</span>
              <div className="ym11-check-list">
                {AVAILABILITY_OPTIONS.map((opt) => (
                  <label className="ym11-check-item" key={opt.value}>
                    <input
                      type="radio"
                      name="ym11-availability"
                      checked={availability === opt.value}
                      onChange={() => setAvailability(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <InputField
              label="Minimum quantity"
              type="number"
              min="0"
              step="0.001"
              unit="kg"
              placeholder="e.g. 200"
              value={minKg}
              onChange={(e) => setMinKg(e.target.value)}
            />

            <Button type="submit" variant="primary" style={{ width: '100%' }}>
              Apply filters
            </Button>
          </form>
        </ContentCard>

        {/* Right Matching Results */}
        <div>
          <div className="ym11-section-head">
            <div>
              <h3 className="ym11-card-title">Matching Harvests</h3>
              <p className="ym11-card-sub">
                {loading
                  ? 'Searching harvests…'
                  : `Showing ${result?.items.length ?? 0} of ${result?.pagination.totalItems ?? 0} matching listings`}
              </p>
            </div>
            <SelectField
              label="Sort by"
              className="ym11-range-select"
              value={sort}
              options={[
                { value: 'price_asc', label: 'Price — Low to High' },
                { value: 'price_desc', label: 'Price — High to Low' },
                { value: 'quantity_desc', label: 'Quantity — High to Low' },
                { value: 'harvest_asc', label: 'Earliest harvest' },
                { value: 'newest', label: 'Newest first' },
              ]}
              onChange={(e) => {
                const nextSort = e.target.value as SearchSortMode;
                setSort(nextSort);
                applyFilters({ page: 1, sort: nextSort });
              }}
            />
          </div>

          {chips.length > 0 && (
            <div className="ym11-chips-row" aria-label="Active filters">
              {chips.map((chip) => (
                <span className="ym11-chip" key={`${chip.key}-${chip.value || chip.label}`}>
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    aria-label={`Remove filter ${chip.label}`}
                    onClick={() => removeSingleParam(chip.key, chip.value)}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Bulk Matching Callout */}
          <div className="ym11-bulk-callout">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="ym11-insights-icon" style={{ width: 34, height: 34 }} aria-hidden="true">
                <ArrowLeftRight size={16} />
              </span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Need more than one farm can supply?
                </p>
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                  YieldMatrix can help you build a combined supply using multiple growers.
                </p>
              </div>
            </div>
            <Link className="ym11-inline-link" style={{ marginTop: 0 }} to="/buyer/bulk-matching">
              Find bulk matches
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          {loading ? (
            <ContentCard>
              <div className="ym11-loading-card" role="status">
                <RefreshCw size={18} aria-hidden="true" />
                <span>Loading matching harvests…</span>
              </div>
            </ContentCard>
          ) : error ? (
            <ContentCard>
              <div className="ym11-error-box">
                <Alert type="error">{error}</Alert>
                <Button variant="outline" onClick={() => void fetchSearch()}>
                  <RefreshCw size={15} aria-hidden="true" />
                  Retry
                </Button>
              </div>
            </ContentCard>
          ) : !result || result.items.length === 0 ? (
            <EmptyState
              title="No matching harvests found"
              description="Try widening your filters, lowering the minimum quantity, or posting a bulk demand request for growers."
              action={
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Button variant="outline" onClick={clearAllFilters}>
                    Clear filters
                  </Button>
                  <Button variant="primary" onClick={() => navigate('/buyer/demands')}>
                    Create demand
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <div className="ym11-produce-grid ym11-produce-grid--two">
                {result.items.map((item) => (
                  <ProduceCard
                    key={item.id}
                    item={item}
                    saved={savedIds.has(item.id)}
                    onToggleSave={toggleSaved}
                    showAvailabilityButton
                  />
                ))}
              </div>

              {result.pagination.totalPages > 1 && (
                <div className="ym11-pagination">
                  <span>
                    Page {result.pagination.page} of {result.pagination.totalPages} ({result.pagination.totalItems}{' '}
                    total)
                  </span>
                  <div className="ym11-pagination-actions">
                    <Button
                      variant="outline"
                      disabled={result.pagination.page <= 1}
                      onClick={() => applyFilters({ page: result.pagination.page - 1 })}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={result.pagination.page >= result.pagination.totalPages}
                      onClick={() => applyFilters({ page: result.pagination.page + 1 })}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
