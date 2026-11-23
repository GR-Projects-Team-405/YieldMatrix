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

interface SearchFilterDraft {
  q: string;
  cropId: string;
  category: string;
  gradeIds: string[];
  district: string;
  minPriceLkr: string;
  maxPriceLkr: string;
  availability: SearchAvailabilityMode;
  minKg: string;
  sort: SearchSortMode;
  page?: number;
}

export default function MarketplaceSearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [result, setResult] = useState<MarketplaceSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());

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
        const parsed = new URLSearchParams(paramsKey);
        const params: Record<string, string> = {};
        parsed.forEach((value, key) => {
          if (value) params[key] = value;
        });
        const { data } = await api.get<MarketplaceSearchResponse>('/ym11/marketplace/search', {
          params,
          signal,
        });
        if (signal?.aborted) return;
        setResult(data);
      } catch (err) {
        if (
          signal?.aborted ||
          (err as { code?: string })?.code === 'ERR_CANCELED' ||
          (err as { name?: string })?.name === 'CanceledError'
        ) {
          return;
        }
        setError('Could not load search results. Check your filters and try again.');
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [paramsKey]
  );

  useEffect(() => {
    const parsed = new URLSearchParams(paramsKey);
    setQInput(parsed.get('q') || '');
    setCropId(parsed.get('cropId') || '');
    setCategory(parsed.get('category') || '');
    setGradeIds((parsed.get('gradeIds') || '').split(',').filter(Boolean));
    setDistrict(parsed.get('district') || '');
    const minC = parsed.get('minPriceCents');
    const maxC = parsed.get('maxPriceCents');
    setMinPriceLkr(minC ? String(Number(minC) / 100) : '');
    setMaxPriceLkr(maxC ? String(Number(maxC) / 100) : '');
    setAvailability((parsed.get('availability') as SearchAvailabilityMode) || 'all');
    setMinKg(parsed.get('minKg') || '');
    setSort((parsed.get('sort') as SearchSortMode) || 'price_asc');
  }, [paramsKey]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSearch(controller.signal);
    return () => controller.abort();
  }, [fetchSearch]);

  function commitFilters(overrides?: Partial<SearchFilterDraft>) {
    setValidationError('');
    const draft: SearchFilterDraft = {
      q: overrides?.q ?? qInput,
      cropId: overrides?.cropId ?? cropId,
      category: overrides?.category ?? category,
      gradeIds: overrides?.gradeIds ?? gradeIds,
      district: overrides?.district ?? district,
      minPriceLkr: overrides?.minPriceLkr ?? minPriceLkr,
      maxPriceLkr: overrides?.maxPriceLkr ?? maxPriceLkr,
      availability: overrides?.availability ?? availability,
      minKg: overrides?.minKg ?? minKg,
      sort: overrides?.sort ?? sort,
      page: overrides?.page ?? 1,
    };

    const next = new URLSearchParams();
    if (draft.q.trim()) next.set('q', draft.q.trim());
    if (draft.cropId) next.set('cropId', draft.cropId);
    if (draft.category) next.set('category', draft.category);
    if (draft.gradeIds.length > 0) next.set('gradeIds', draft.gradeIds.join(','));
    if (draft.district) next.set('district', draft.district);

    if (draft.minPriceLkr.trim() !== '') {
      const val = Number(draft.minPriceLkr);
      if (!Number.isFinite(val) || val < 0) {
        setValidationError('Minimum price must be a non-negative LKR amount.');
        return;
      }
      next.set('minPriceCents', String(Math.round(val * 100)));
    }
    if (draft.maxPriceLkr.trim() !== '') {
      const val = Number(draft.maxPriceLkr);
      if (!Number.isFinite(val) || val < 0) {
        setValidationError('Maximum price must be a non-negative LKR amount.');
        return;
      }
      next.set('maxPriceCents', String(Math.round(val * 100)));
    }
    if (
      draft.minPriceLkr.trim() !== '' &&
      draft.maxPriceLkr.trim() !== '' &&
      Number(draft.minPriceLkr) > Number(draft.maxPriceLkr)
    ) {
      setValidationError('Maximum price must be greater than or equal to minimum price.');
      return;
    }

    if (draft.minKg.trim() !== '') {
      if (!/^\d+(?:\.\d{1,3})?$/.test(draft.minKg.trim())) {
        setValidationError('Minimum quantity must be a non-negative kg number (up to 3 decimals).');
        return;
      }
      next.set('minKg', draft.minKg.trim());
    }

    if (draft.availability && draft.availability !== 'all') {
      next.set('availability', draft.availability);
    }
    if (draft.sort && draft.sort !== 'price_asc') {
      next.set('sort', draft.sort);
    }
    if (draft.page && draft.page > 1) {
      next.set('page', String(draft.page));
    }

    setSearchParams(next);
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    commitFilters({ page: 1 });
  }

  function clearAllFilters() {
    setValidationError('');
    setSearchParams(new URLSearchParams());
  }

  function removeSingleParam(key: string, valueToRemove?: string) {
    const next = new URLSearchParams(paramsKey);
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
    const nextGrades = gradeIds.includes(id)
      ? gradeIds.filter((item) => item !== id)
      : [...gradeIds, id];
    setGradeIds(nextGrades);
    commitFilters({ gradeIds: nextGrades, page: 1 });
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

  const activeParams = new URLSearchParams(paramsKey);
  const chips: { key: string; label: string; value?: string }[] = [];
  if (activeParams.get('q')) chips.push({ key: 'q', label: `"${activeParams.get('q')}"` });
  if (activeParams.get('cropId')) {
    const found = filterCrops.find((c) => c.id === activeParams.get('cropId'));
    chips.push({ key: 'cropId', label: found?.name || 'Crop filter' });
  }
  if (activeParams.get('category')) {
    const found = filterCategories.find((c) => c.key === activeParams.get('category'));
    chips.push({ key: 'category', label: found?.label || activeParams.get('category') || '' });
  }
  for (const gid of (activeParams.get('gradeIds') || '').split(',').filter(Boolean)) {
    const found = filterGrades.find((g) => g.id === gid);
    chips.push({ key: 'gradeIds', label: found?.name || 'Grade', value: gid });
  }
  if (activeParams.get('district')) {
    chips.push({ key: 'district', label: activeParams.get('district') || '' });
  }
  if (activeParams.get('availability') && activeParams.get('availability') !== 'all') {
    const found = AVAILABILITY_OPTIONS.find((a) => a.value === activeParams.get('availability'));
    chips.push({ key: 'availability', label: found?.label || '' });
  }
  if (activeParams.get('minKg')) {
    chips.push({ key: 'minKg', label: `Min ${activeParams.get('minKg')} kg` });
  }
  if (activeParams.get('minPriceCents')) {
    chips.push({
      key: 'minPriceCents',
      label: `Min LKR ${Number(activeParams.get('minPriceCents')) / 100}/kg`,
    });
  }
  if (activeParams.get('maxPriceCents')) {
    chips.push({
      key: 'maxPriceCents',
      label: `Max LKR ${Number(activeParams.get('maxPriceCents')) / 100}/kg`,
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
      <ContentCard className="ym11-mkt-search-card">
        <form className="ym11-search-bar" onSubmit={handleFormSubmit}>
          <div className="ym11-search-input-wrap">
            <Search size={17} className="ym11-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="ym11-search-input ym11-search-input--soft"
              placeholder="Search by crop, grower farm, grade, or district…"
              aria-label="Search marketplace harvests"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" className="ym11-search-btn">
            <Search size={15} aria-hidden="true" />
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
              onChange={(e) => {
                const nextCrop = e.target.value;
                setCropId(nextCrop);
                commitFilters({ cropId: nextCrop, page: 1 });
              }}
            />

            <SelectField
              label="Category"
              value={category}
              options={[
                { value: '', label: 'All categories' },
                ...filterCategories.map((c) => ({ value: c.key, label: c.label })),
              ]}
              onChange={(e) => {
                const nextCategory = e.target.value;
                setCategory(nextCategory);
                commitFilters({ category: nextCategory, page: 1 });
              }}
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
              onChange={(e) => {
                const nextDistrict = e.target.value;
                setDistrict(nextDistrict);
                commitFilters({ district: nextDistrict, page: 1 });
              }}
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
                      onChange={() => {
                        setAvailability(opt.value);
                        commitFilters({ availability: opt.value, page: 1 });
                      }}
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
                commitFilters({ sort: nextSort, page: 1 });
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
                      onClick={() => commitFilters({ page: result.pagination.page - 1 })}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={result.pagination.page >= result.pagination.totalPages}
                      onClick={() => commitFilters({ page: result.pagination.page + 1 })}
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
