import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Carrot,
  ChevronDown,
  Grid2x2,
  Info,
  Leaf,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sprout,
  Store,
  Wheat,
  X,
} from 'lucide-react';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { getProduceImage } from './produceImages';
import { MarketplaceSubnav, ProduceCard } from './ProduceCard';
import type {
  CropCategoryKey,
  MarketplaceItem,
  MarketplaceOverviewResponse,
  MarketplaceSearchResponse,
} from './types';
import {
  formatColomboShortDate,
  formatKg,
  matchesSearchQuery,
  normalizeCropKey,
} from './utils';
import './ym11.css';

function CategoryIcon({ category }: { category: CropCategoryKey }) {
  switch (category) {
    case 'vegetables':
      return <Sprout size={18} aria-hidden="true" />;
    case 'fruits':
      return <Store size={18} aria-hidden="true" />;
    case 'leafy_greens':
      return <Leaf size={18} aria-hidden="true" />;
    case 'root_crops':
      return <Carrot size={18} aria-hidden="true" />;
    case 'grains':
      return <Wheat size={18} aria-hidden="true" />;
    default:
      return <Grid2x2 size={18} aria-hidden="true" />;
  }
}

function buildMarketplaceSearchParams(filters: {
  q?: string;
  cropId?: string;
  gradeId?: string;
  district?: string;
  pricePreset?: string;
  availability?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.cropId) params.set('cropId', filters.cropId);
  if (filters.gradeId) params.set('gradeIds', filters.gradeId);
  if (filters.district) params.set('district', filters.district);
  if (filters.availability) params.set('availability', filters.availability);
  if (filters.pricePreset === 'under_200') {
    params.set('maxPriceCents', '20000');
  } else if (filters.pricePreset === '200_400') {
    params.set('minPriceCents', '20000');
    params.set('maxPriceCents', '40000');
  } else if (filters.pricePreset === 'over_400') {
    params.set('minPriceCents', '40000');
  }
  return params;
}

export default function MarketplacePage() {
  const navigate = useNavigate();

  const [data, setData] = useState<MarketplaceOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [queryText, setQueryText] = useState('');
  const [cropId, setCropId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [district, setDistrict] = useState('');
  const [pricePreset, setPricePreset] = useState('');
  const [availability, setAvailability] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());

  const [filteredItems, setFilteredItems] = useState<MarketplaceItem[] | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState('');

  const hasQuickFilter = Boolean(
    queryText.trim() || cropId || gradeId || district || pricePreset || availability
  );

  const loadMarketplace = useCallback(async (signal?: AbortSignal, silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError('');
    try {
      const response = await api.get<MarketplaceOverviewResponse>('/ym11/marketplace', { signal });
      if (signal?.aborted) return;
      setData(response.data);
    } catch (err) {
      if (
        signal?.aborted ||
        (err as { code?: string })?.code === 'ERR_CANCELED' ||
        (err as { name?: string })?.name === 'CanceledError'
      ) {
        return;
      }
      if (!silent) setError('Could not load the marketplace right now. Please try again.');
    } finally {
      if (!signal?.aborted && !silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadMarketplace(controller.signal);
    return () => controller.abort();
  }, [loadMarketplace]);

  // Auto-refresh marketplace & dynamic filter lists when user returns to this tab
  useEffect(() => {
    const handleFocus = () => {
      void loadMarketplace(undefined, true);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadMarketplace]);

  // Instant client-side filtering on the loaded DB items so search bar & dropdowns respond in 0ms
  const instantFilteredItems = useMemo(() => {
    if (!data || !hasQuickFilter) return null;
    const allItems = [...data.availableNow, ...data.comingSoon];
    const selectedCropName = cropId
      ? data.filters.crops.find((c) => c.id === cropId)?.name || ''
      : '';
    const targetCropKey = selectedCropName ? normalizeCropKey(selectedCropName) : '';

    const todayIso = new Date().toISOString().slice(0, 10);
    const in7DaysIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const in30DaysIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return allItems.filter((item) => {
      if (queryText.trim() && !matchesSearchQuery(item, queryText)) return false;
      if (cropId) {
        const matchesCrop =
          item.cropId === cropId ||
          (targetCropKey && normalizeCropKey(item.cropName) === targetCropKey);
        if (!matchesCrop) return false;
      }
      if (gradeId && item.gradeId !== gradeId) return false;
      if (district && item.district.trim().toLowerCase() !== district.trim().toLowerCase()) {
        return false;
      }
      if (pricePreset === 'under_200') {
        if (item.unitPriceCents === null || item.unitPriceCents > 20000) return false;
      } else if (pricePreset === '200_400') {
        if (item.unitPriceCents === null || item.unitPriceCents < 20000 || item.unitPriceCents > 40000) {
          return false;
        }
      } else if (pricePreset === 'over_400') {
        if (item.unitPriceCents === null || item.unitPriceCents < 40000) return false;
      }
      if (availability === 'available_now' && item.availabilityStatus !== 'available_now') {
        return false;
      }
      if (availability === 'planned' && item.availabilityStatus !== 'planned') {
        return false;
      }
      if (availability === 'within_7_days') {
        const ok =
          item.availabilityStatus === 'available_now' ||
          (item.availabilityStatus === 'planned' &&
            Boolean(item.plannedHarvestDate && item.plannedHarvestDate >= todayIso && item.plannedHarvestDate <= in7DaysIso));
        if (!ok) return false;
      }
      if (availability === 'within_30_days') {
        const ok =
          item.availabilityStatus === 'available_now' ||
          (item.availabilityStatus === 'planned' &&
            Boolean(item.plannedHarvestDate && item.plannedHarvestDate >= todayIso && item.plannedHarvestDate <= in30DaysIso));
        if (!ok) return false;
      }
      return true;
    });
  }, [data, hasQuickFilter, queryText, cropId, gradeId, district, pricePreset, availability]);

  // Background sync with backend search so newly added DB items/crops also arrive
  useEffect(() => {
    if (!hasQuickFilter) {
      setFilteredItems(null);
      setFilterError('');
      setFilterLoading(false);
      return;
    }

    const controller = new AbortController();
    const timerId = window.setTimeout(() => {
      setFilterLoading(true);
      setFilterError('');

      const params = buildMarketplaceSearchParams({
        q: queryText,
        cropId,
        gradeId,
        district,
        pricePreset,
        availability,
      });
      const paramsObj: Record<string, string> = {};
      params.forEach((value, key) => {
        paramsObj[key] = value;
      });

      api
        .get<MarketplaceSearchResponse>('/ym11/marketplace/search', {
          params: paramsObj,
          signal: controller.signal,
        })
        .then((res) => {
          if (controller.signal.aborted) return;
          setFilteredItems(res.data.items);
          if (res.data.filters) {
            setData((prev) => (prev ? { ...prev, filters: res.data.filters } : prev));
          }
        })
        .catch(() => {
          // Keep instant client-filtered results visible if background sync encounters transient network latency
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setFilterLoading(false);
          }
        });
    }, 300);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [hasQuickFilter, cropId, gradeId, district, pricePreset, availability, queryText]);

  function toggleSaved(id: string) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearQuickFilters() {
    setQueryText('');
    setCropId('');
    setGradeId('');
    setDistrict('');
    setPricePreset('');
    setAvailability('');
    setFilteredItems(null);
    setFilterError('');
  }

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    const params = buildMarketplaceSearchParams({
      q: queryText,
      cropId,
      gradeId,
      district,
      pricePreset,
      availability,
    });
    const qs = params.toString();
    navigate(`/buyer/marketplace/search${qs ? `?${qs}` : ''}`);
  }

  if (loading) {
    return (
      <ContentCard>
        <div className="ym11-loading-card" role="status">
          <RefreshCw size={18} aria-hidden="true" />
          <span>Loading Buyer Marketplace…</span>
        </div>
      </ContentCard>
    );
  }

  if (error || !data) {
    return (
      <ContentCard title="Marketplace unavailable">
        <div className="ym11-error-box">
          <Alert type="error">{error || 'Unable to load marketplace data.'}</Alert>
          <Button variant="outline" onClick={() => void loadMarketplace()}>
            <RefreshCw size={16} aria-hidden="true" />
            Retry
          </Button>
        </div>
      </ContentCard>
    );
  }

  const displayedHarvests = hasQuickFilter
    ? instantFilteredItems ?? filteredItems ?? []
    : data.availableNow;
  const fullSearchUrl = (() => {
    const qs = buildMarketplaceSearchParams({
      q: queryText,
      cropId,
      gradeId,
      district,
      pricePreset,
      availability,
    }).toString();
    return `/buyer/marketplace/search${qs ? `?${qs}` : ''}`;
  })();

  return (
    <div className="ym11-overview">
      {/* Page Header */}
      <section className="ym11-header" aria-label="Marketplace heading">
        <div>
          <p className="ym11-eyebrow">Trusted farmer network</p>
          <h2 className="ym11-greeting">Explore the Marketplace</h2>
          <p className="ym11-subtitle">
            Discover fresh harvests from trusted growers across Sri Lanka.
          </p>
        </div>
        <div className="ym11-header-actions">
          <Button
            variant="outline"
            onClick={() => navigate('/buyer/marketplace/harvest-availability')}
          >
            <CalendarDays size={16} aria-hidden="true" />
            Harvest availability
          </Button>
          <Button variant="primary" onClick={() => navigate('/buyer/demands')}>
            <Plus size={16} aria-hidden="true" />
            Create demand
          </Button>
        </div>
      </section>

      <MarketplaceSubnav />

      {/* Search & Inline Pill Filter Card */}
      <ContentCard className="ym11-mkt-search-card">
        <form onSubmit={handleSearchSubmit}>
          <div className="ym11-search-bar">
            <div className="ym11-search-input-wrap">
              <Search size={17} className="ym11-search-icon" aria-hidden="true" />
              <input
                type="search"
                className="ym11-search-input ym11-search-input--soft"
                placeholder="Search produce, farms, or districts (e.g. Tomatoes)"
                aria-label="Search marketplace produce"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
              />
              {queryText && (
                <button
                  type="button"
                  className="ym11-search-clear"
                  aria-label="Clear search query"
                  onClick={() => setQueryText('')}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
            <Button type="submit" variant="primary" className="ym11-search-btn">
              <Search size={15} aria-hidden="true" />
              Search
            </Button>
          </div>

          <div className="ym11-pill-filter-bar">
            <div className="ym11-pill-filters-left">
              <span className="ym11-pill-filter-heading">FILTER BY</span>

              <label className="ym11-pill-select">
                <select
                  aria-label="Filter by crop"
                  value={cropId}
                  onChange={(e) => setCropId(e.target.value)}
                >
                  <option value="">Crop</option>
                  {data.filters.crops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="ym11-pill-caret" aria-hidden="true" />
              </label>

              <label className="ym11-pill-select">
                <select
                  aria-label="Filter by grade"
                  value={gradeId}
                  onChange={(e) => setGradeId(e.target.value)}
                >
                  <option value="">Grade</option>
                  {data.filters.grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="ym11-pill-caret" aria-hidden="true" />
              </label>

              <label className="ym11-pill-select">
                <select
                  aria-label="Filter by district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                >
                  <option value="">District</option>
                  {data.filters.districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="ym11-pill-caret" aria-hidden="true" />
              </label>

              <label className="ym11-pill-select">
                <select
                  aria-label="Filter by price range"
                  value={pricePreset}
                  onChange={(e) => setPricePreset(e.target.value)}
                >
                  <option value="">Price range</option>
                  <option value="under_200">Under LKR 200/kg</option>
                  <option value="200_400">LKR 200 – 400/kg</option>
                  <option value="over_400">Above LKR 400/kg</option>
                </select>
                <ChevronDown size={13} className="ym11-pill-caret" aria-hidden="true" />
              </label>

              <label className="ym11-pill-select">
                <select
                  aria-label="Filter by harvest availability"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                >
                  <option value="">Harvest availability</option>
                  <option value="available_now">Available now</option>
                  <option value="within_7_days">Within 7 days</option>
                  <option value="within_30_days">Within 30 days</option>
                  <option value="planned">Planned future harvests</option>
                </select>
                <ChevronDown size={13} className="ym11-pill-caret" aria-hidden="true" />
              </label>

              {hasQuickFilter && (
                <button
                  type="button"
                  className="ym11-chip"
                  onClick={clearQuickFilters}
                  aria-label="Clear quick filters"
                >
                  <span>Clear filters</span>
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="ym11-pill-filters-right">
              <Link className="ym11-subtle-action" to="/buyer/marketplace/harvest-availability">
                <CalendarDays size={14} aria-hidden="true" />
                Harvest availability
              </Link>
              <Link className="ym11-subtle-action" to={fullSearchUrl}>
                <SlidersHorizontal size={14} aria-hidden="true" />
                More filters
              </Link>
            </div>
          </div>
        </form>
      </ContentCard>

      {/* Browse by Category */}
      <section aria-label="Browse by category">
        <div className="ym11-section-head">
          <div>
            <h3 className="ym11-card-title">Browse by category</h3>
            <p className="ym11-card-sub">Find produce faster by exploring popular crop groups.</p>
          </div>
        </div>

        <div className="ym11-category-grid">
          {data.categories.map((cat) => (
            <button
              type="button"
              key={cat.key}
              className={`ym11-category-card ym11-cat-card--${cat.key}`}
              onClick={() => navigate(`/buyer/marketplace/search?category=${encodeURIComponent(cat.key)}`)}
            >
              <span className={`ym11-category-ring ym11-cat-ring--${cat.key}`}>
                <span className={`ym11-category-icon ym11-cat--${cat.key}`}>
                  <CategoryIcon category={cat.key} />
                </span>
              </span>

              <div className="ym11-category-foot">
                <span className="ym11-category-name">{cat.label}</span>
                <ArrowRight size={14} className="ym11-category-arrow" aria-hidden="true" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Fresh Harvests Available Now (or Live Filtered Results) */}
      <section aria-label="Fresh harvests available now">
        <div className="ym11-section-head">
          <div>
            <h3 className="ym11-card-title">
              {hasQuickFilter ? 'Filtered harvests' : 'Fresh harvests available now'}
            </h3>
            <p className="ym11-card-sub">
              {hasQuickFilter
                ? `Showing ${displayedHarvests.length} matching ${displayedHarvests.length === 1 ? 'harvest' : 'harvests'}${filterLoading ? ' · syncing…' : ''}.`
                : 'Explore active produce listings from approved farmers.'}
            </p>
          </div>
          <Link
            className="ym11-inline-link"
            style={{ marginTop: 0 }}
            to={hasQuickFilter ? fullSearchUrl : '/buyer/marketplace/search?availability=available_now'}
          >
            {hasQuickFilter ? 'Open full search' : 'View all harvests'}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {filterError && <Alert type="error">{filterError}</Alert>}

        {displayedHarvests.length === 0 ? (
          <EmptyState
            title={hasQuickFilter ? 'No harvests match these filters' : 'No ready harvests right now'}
            description={
              hasQuickFilter
                ? 'Try clearing a filter or open advanced search to adjust your criteria.'
                : 'Approved grower listings will appear here as soon as stock is harvested and listed.'
            }
            action={
              hasQuickFilter ? (
                <Button variant="outline" onClick={clearQuickFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" onClick={() => navigate('/buyer/demands')}>
                  Create demand
                </Button>
              )
            }
          />
        ) : (
          <div className="ym11-produce-grid">
            {displayedHarvests.map((item) => (
              <ProduceCard
                key={item.id}
                item={item}
                saved={savedIds.has(item.id)}
                onToggleSave={toggleSaved}
              />
            ))}
          </div>
        )}
      </section>

      {/* Planned Supply / Coming Soon */}
      <section className="ym11-planned-section" aria-label="Planned supply coming soon">
        <div className="ym11-card-top">
          <div>
            <p className="ym11-eyebrow">Planned supply</p>
            <h3 className="ym11-card-title">Coming soon</h3>
            <p className="ym11-card-sub">Explore planned harvests and future supply opportunities.</p>
          </div>
          <span className="ym11-planned-notice-pill">
            <Info size={13} aria-hidden="true" />
            Not ready-to-purchase inventory
          </span>
        </div>

        {data.comingSoon.length === 0 ? (
          <EmptyState
            title="No upcoming planned harvests listed yet"
            description="Check the Harvest Availability calendar to track upcoming harvest schedules as growers register new batches."
            action={
              <Button variant="outline" onClick={() => navigate('/buyer/marketplace/harvest-availability')}>
                Open Harvest Availability
              </Button>
            }
          />
        ) : (
          <div className="ym11-coming-grid">
            {data.comingSoon.map((item) => (
              <article className="ym11-coming-split-card" key={item.id}>
                <div className="ym11-coming-photo-col">
                  <img
                    src={getProduceImage(item.cropName, item.category)}
                    alt={`${item.cropName} planned harvest`}
                    className="ym11-coming-photo"
                    loading="lazy"
                  />
                </div>
                <div className="ym11-coming-info-col">
                  <span className="ym11-expected-tag">
                    <CalendarClock size={11} aria-hidden="true" />
                    Expected harvest
                  </span>
                  <div>
                    <h4 className="ym11-coming-title">
                      {item.cropName} <span>{item.gradeName}</span>
                    </h4>
                    <p className="ym11-grower-detail">{item.farmName}</p>
                  </div>
                  <div className="ym11-produce-metrics">
                    <div>
                      <p className="ym11-metric-label">Expected quantity</p>
                      <p className="ym11-metric-val">Approx. {formatKg(item.availableKg)}</p>
                    </div>
                    <div>
                      <p className="ym11-metric-label">Expected date</p>
                      <p className="ym11-metric-val">{formatColomboShortDate(item.plannedHarvestDate)}</p>
                    </div>
                  </div>
                  <div className="ym11-coming-foot">
                    <span className="ym11-grower-detail" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} aria-hidden="true" />
                      {item.district}
                    </span>
                    <Link
                      className="ym11-inline-link"
                      style={{ marginTop: 0, fontSize: 12 }}
                      to={`/buyer/marketplace/harvest-availability?cropId=${encodeURIComponent(item.cropId)}`}
                    >
                      View availability
                      <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Bottom CTA Banner */}
      <section className="ym11-cta-banner ym11-cta-banner--hero" aria-label="Create custom demand">
        <div className="ym11-cta-circle-wrap" aria-hidden="true">
          <div className="ym11-cta-circle">
            <div className="ym11-cta-circle-inner">
              <Sprout size={26} />
            </div>
          </div>
        </div>
        <div className="ym11-cta-copy">
          <h3 className="ym11-card-title">Can&apos;t find the quantity you need?</h3>
          <p className="ym11-card-sub">
            Create a demand request and let farmers respond with their offers.
          </p>
        </div>
        <div className="ym11-cta-action">
          <Button variant="primary" onClick={() => navigate('/buyer/demands')}>
            Create demand
            <ArrowRight size={15} aria-hidden="true" />
          </Button>
        </div>
      </section>
    </div>
  );
}
