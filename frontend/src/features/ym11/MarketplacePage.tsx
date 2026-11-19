import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Apple,
  ArrowRight,
  CalendarClock,
  Carrot,
  Grid2x2,
  Leaf,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sprout,
  Wheat,
} from 'lucide-react';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { SelectField } from '../../components/SelectField';
import { StatusBadge } from '../../components/StatusBadge';
import { MarketplaceSubnav, ProduceCard } from './ProduceCard';
import type { CropCategoryKey, MarketplaceOverviewResponse } from './types';
import { formatColomboShortDate, formatKg } from './utils';
import './ym11.css';

function CategoryIcon({ category }: { category: CropCategoryKey }) {
  switch (category) {
    case 'vegetables':
      return <Sprout size={18} aria-hidden="true" />;
    case 'fruits':
      return <Apple size={18} aria-hidden="true" />;
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

  const loadMarketplace = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<MarketplaceOverviewResponse>('/ym11/marketplace', { signal });
      setData(response.data);
    } catch (err) {
      if ((err as { name?: string })?.name === 'CanceledError') return;
      setError('Could not load the marketplace right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadMarketplace(controller.signal);
    return () => controller.abort();
  }, [loadMarketplace]);

  function toggleSaved(id: string) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (queryText.trim()) params.set('q', queryText.trim());
    if (cropId) params.set('cropId', cropId);
    if (gradeId) params.set('gradeIds', gradeId);
    if (district) params.set('district', district);
    if (availability) params.set('availability', availability);
    if (pricePreset === 'under_200') params.set('maxPriceCents', '20000');
    else if (pricePreset === '200_400') {
      params.set('minPriceCents', '20000');
      params.set('maxPriceCents', '40000');
    } else if (pricePreset === 'over_400') params.set('minPriceCents', '40000');

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

  const cropOptions = [
    { value: '', label: 'All crops' },
    ...data.filters.crops.map((c) => ({ value: c.id, label: c.name })),
  ];
  const gradeOptions = [
    { value: '', label: 'All grades' },
    ...data.filters.grades.map((g) => ({ value: g.id, label: g.name })),
  ];
  const districtOptions = [
    { value: '', label: 'All districts' },
    ...data.filters.districts.map((d) => ({ value: d, label: d })),
  ];

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
          <Button variant="primary" onClick={() => navigate('/buyer/demands')}>
            <Plus size={16} aria-hidden="true" />
            Create demand
          </Button>
        </div>
      </section>

      <MarketplaceSubnav />

      {/* Search & Quick Filters */}
      <ContentCard>
        <form onSubmit={handleSearchSubmit}>
          <div className="ym11-search-bar">
            <div className="ym11-search-input-wrap">
              <Search size={18} className="ym11-search-icon" aria-hidden="true" />
              <input
                type="search"
                className="ym11-search-input"
                placeholder="Search produce, farms, or districts (e.g. Tomatoes, Nuwara Eliya)"
                aria-label="Search marketplace produce"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary">
              <Search size={16} aria-hidden="true" />
              Search
            </Button>
          </div>

          <div className="ym11-quick-filters">
            <span className="ym11-quick-filter-label">Filter by</span>
            <SelectField
              label="Crop"
              className="ym11-quick-select"
              value={cropId}
              options={cropOptions}
              onChange={(e) => setCropId(e.target.value)}
            />
            <SelectField
              label="Grade"
              className="ym11-quick-select"
              value={gradeId}
              options={gradeOptions}
              onChange={(e) => setGradeId(e.target.value)}
            />
            <SelectField
              label="District"
              className="ym11-quick-select"
              value={district}
              options={districtOptions}
              onChange={(e) => setDistrict(e.target.value)}
            />
            <SelectField
              label="Price range"
              className="ym11-quick-select"
              value={pricePreset}
              options={[
                { value: '', label: 'Any price' },
                { value: 'under_200', label: 'Under LKR 200/kg' },
                { value: '200_400', label: 'LKR 200 – 400/kg' },
                { value: 'over_400', label: 'Above LKR 400/kg' },
              ]}
              onChange={(e) => setPricePreset(e.target.value)}
            />
            <SelectField
              label="Harvest availability"
              className="ym11-quick-select"
              value={availability}
              options={[
                { value: '', label: 'All availability' },
                { value: 'available_now', label: 'Available now' },
                { value: 'within_7_days', label: 'Within 7 days' },
                { value: 'within_30_days', label: 'Within 30 days' },
                { value: 'planned', label: 'Planned future harvests' },
              ]}
              onChange={(e) => setAvailability(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => navigate('/buyer/marketplace/search')}
              style={{ height: 40, padding: '0 14px', fontSize: 13 }}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              More filters
            </Button>
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
              className="ym11-category-card"
              onClick={() => navigate(`/buyer/marketplace/search?category=${encodeURIComponent(cat.key)}`)}
            >
              <span className={`ym11-category-icon ym11-cat--${cat.key}`}>
                <CategoryIcon category={cat.key} />
              </span>
              <div className="ym11-category-foot">
                <div>
                  <p className="ym11-category-name">{cat.label}</p>
                  <p className="ym11-category-count">
                    {cat.count ?? 0} {(cat.count ?? 0) === 1 ? 'listing' : 'listings'}
                  </p>
                </div>
                <ArrowRight size={14} aria-hidden="true" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Fresh Harvests Available Now */}
      <section aria-label="Fresh harvests available now">
        <div className="ym11-section-head">
          <div>
            <h3 className="ym11-card-title">Fresh harvests available now</h3>
            <p className="ym11-card-sub">
              Explore active produce listings from approved farmers ({formatKg(data.summary.availableNowTotalKg)} total available).
            </p>
          </div>
          <Link className="ym11-inline-link" style={{ marginTop: 0 }} to="/buyer/marketplace/search?availability=available_now">
            View all harvests
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {data.availableNow.length === 0 ? (
          <EmptyState
            title="No ready harvests right now"
            description="Approved grower listings will appear here as soon as stock is harvested and listed. You can also post a demand request."
            action={
              <Button variant="primary" onClick={() => navigate('/buyer/demands')}>
                Create demand
              </Button>
            }
          />
        ) : (
          <div className="ym11-produce-grid">
            {data.availableNow.map((item) => (
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
      <ContentCard>
        <div className="ym11-card-top">
          <div>
            <p className="ym11-eyebrow">Planned supply</p>
            <h3 className="ym11-card-title">Coming soon</h3>
            <p className="ym11-card-sub">Explore planned harvests and future supply opportunities.</p>
          </div>
          <StatusBadge status="Pending" />
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
              <article className="ym11-coming-card" key={item.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span className="ym11-panel-tag">
                    <CalendarClock size={12} aria-hidden="true" />
                    Expected harvest
                  </span>
                  <StatusBadge status="Pending" />
                </div>
                <div>
                  <h4 className="ym11-produce-name">
                    {item.cropName}{' '}
                    <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--muted)' }}>
                      · {item.gradeName}
                    </span>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span className="ym11-grower-detail" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} aria-hidden="true" />
                    {item.district}
                  </span>
                  <Link
                    className="ym11-inline-link"
                    style={{ marginTop: 0 }}
                    to={`/buyer/marketplace/harvest-availability?cropId=${encodeURIComponent(item.cropId)}`}
                  >
                    View availability
                    <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </ContentCard>

      {/* Bottom CTA */}
      <section className="ym11-cta-banner" aria-label="Create custom demand">
        <div className="ym11-cta-left">
          <span className="ym11-cta-badge" aria-hidden="true">
            <Sprout size={22} />
          </span>
          <div>
            <h3 className="ym11-card-title">Can&apos;t find the quantity you need?</h3>
            <p className="ym11-card-sub">
              Create a demand request and let approved farmers respond with their offers.
            </p>
          </div>
        </div>
        <Button variant="primary" onClick={() => navigate('/buyer/demands')}>
          Create demand
          <ArrowRight size={15} aria-hidden="true" />
        </Button>
      </section>
    </div>
  );
}
