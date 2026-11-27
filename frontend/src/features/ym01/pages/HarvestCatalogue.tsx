import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, ListFilter, MapPin, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../../components/EmptyState';
import { formatNumber, type PublicHarvest, ym01Get } from '../api';
import HarvestCard from '../components/HarvestCard';
import HarvestSkeleton from '../components/HarvestSkeleton';
import PublicFooter from '../components/PublicFooter';
import PublicNavbar from '../components/PublicNavbar';
import { sampleHarvests } from '../sampleHarvests';

const PAGE_SIZE_OPTIONS = [6, 12, 15, 24, 50];
const useSampleCatalogue = import.meta.env.DEV;

export default function HarvestCatalogue() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [crop, setCrop] = useState(() => searchParams.get('crop') ?? '');
  const [district, setDistrict] = useState(() => searchParams.get('district') ?? '');
  const [grade, setGrade] = useState('');
  const [sort, setSort] = useState(() => searchParams.get('sort') ?? 'newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [pageSize, setPageSize] = useState(24);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PublicHarvest[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [crops, setCrops] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    if (useSampleCatalogue) {
      setCrops([...new Set(sampleHarvests.map((harvest) => harvest.cropName))].sort());
      setDistricts([...new Set(sampleHarvests.map((harvest) => harvest.district))].sort());
      return () => controller.abort();
    }
    Promise.allSettled([
      ym01Get<string[]>('categories', { signal: controller.signal }),
      ym01Get<string[]>('districts', { signal: controller.signal }),
    ]).then(([cropResult, districtResult]) => {
      if (controller.signal.aborted) return;
      if (cropResult.status === 'fulfilled' && cropResult.value.data.success) setCrops(cropResult.value.data.data);
      if (districtResult.status === 'fulfilled' && districtResult.value.data.success) setDistricts(districtResult.value.data.data);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (useSampleCatalogue) {
      let filtered = sampleHarvests.filter((harvest) => {
        const searchMatches = !search.trim() || harvest.cropName.toLowerCase().includes(search.trim().toLowerCase());
        const cropMatches = !crop || harvest.cropName === crop;
        const districtMatches = !district || harvest.district === district;
        const gradeMatches = !grade.trim() || harvest.grade.toLowerCase().includes(grade.trim().toLowerCase());
        const price = harvest.unitPriceLkrPerKg;
        const minPriceMatches = minPrice === '' || price >= Number(minPrice);
        const maxPriceMatches = maxPrice === '' || price <= Number(maxPrice);
        return searchMatches && cropMatches && districtMatches && gradeMatches && minPriceMatches && maxPriceMatches;
      });
      filtered = filtered.sort((left, right) => {
        if (sort === 'price_asc') return left.unitPriceLkrPerKg - right.unitPriceLkrPerKg;
        if (sort === 'price_desc') return right.unitPriceLkrPerKg - left.unitPriceLkrPerKg;
        if (sort === 'harvest_date_asc') return Date.parse(left.harvestDate ?? '') - Date.parse(right.harvestDate ?? '');
        if (sort === 'harvest_date_desc') return Date.parse(right.harvestDate ?? '') - Date.parse(left.harvestDate ?? '');
        return right.id.localeCompare(left.id);
      });
      const resultCount = filtered.length;
      setRows(filtered.slice((page - 1) * pageSize, page * pageSize));
      setTotalRecords(resultCount);
      setTotalPages(Math.ceil(resultCount / pageSize));
      setState('ready');
      setErrorMessage('');
      return () => controller.abort();
    }
    const params: Record<string, string | number> = { page, limit: pageSize, sort };
    if (search.trim()) params.search = search.trim();
    if (crop) params.crop = crop;
    if (district) params.district = district;
    if (grade.trim()) params.grade = grade.trim();
    if (minPrice !== '') params.minPrice = minPrice;
    if (maxPrice !== '') params.maxPrice = maxPrice;
    setState('loading');
    setErrorMessage('');
    const timer = window.setTimeout(() => {
      ym01Get<PublicHarvest[]>('harvests', { params, signal: controller.signal }).then(({ data }) => {
        if (!data.success) throw new Error(data.message);
        setRows(data.data ?? []);
        setTotalRecords(data.pagination?.totalRecords ?? 0);
        setTotalPages(data.pagination?.totalPages ?? 0);
        setState('ready');
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setErrorMessage(message || 'We couldn’t load harvests right now. Please check your connection and try again.');
        setState('error');
      });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search, crop, district, grade, sort, minPrice, maxPrice, page, pageSize, reloadKey]);

  const filterCount = useMemo(() => [crop, district, grade, minPrice, maxPrice].filter(Boolean).length, [crop, district, grade, minPrice, maxPrice]);
  const clearFilters = () => { setSearch(''); setCrop(''); setDistrict(''); setGrade(''); setMinPrice(''); setMaxPrice(''); setSort('newest'); setPage(1); };
  const submitSearch = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setPage(1); };

  return <div className="ym-public-site">
    <PublicNavbar />
    <main className="catalogue-page">
      <section className="catalogue-hero"><div className="ym-container catalogue-hero-content"><div className="catalogue-breadcrumb"><Link to="/">Home</Link><span>/</span><span>Marketplace</span></div><div className="catalogue-title-row"><div><span className="eyebrow"><span className="eyebrow-dot" /> {useSampleCatalogue ? 'DEVELOPMENT SAMPLE CATALOGUE' : 'PUBLIC HARVEST MARKETPLACE'}</span><h1>Explore fresh harvests.</h1><p>{useSampleCatalogue ? 'Browse 24 illustrative harvest listings for development.' : 'Find available produce from approved farms across the network.'}</p></div><div className="catalogue-status"><span className="status-live-dot" /> {useSampleCatalogue ? 'Sample listings' : 'Live public listings'}</div></div>
        <div className="catalogue-stat-strip"><div><span>{useSampleCatalogue ? 'SAMPLE HARVESTS' : 'ELIGIBLE HARVESTS'}</span><strong>{state === 'loading' && !totalRecords ? '—' : formatNumber(totalRecords)}</strong></div><div><span>AVAILABLE DISTRICTS</span><strong>{districts.length || (state === 'ready' ? '0' : '—')}</strong></div><div><span>PER PAGE</span><strong>{pageSize}</strong></div></div>
      </div></section>

      <section className="ym-container catalogue-content">
        <div className="catalogue-toolbar">
          <form className="catalogue-search" onSubmit={submitSearch} role="search"><Search size={18} aria-hidden="true" /><label className="sr-only" htmlFor="catalogue-search">Search crops</label><input id="catalogue-search" value={search} maxLength={100} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search by crop name" /><button type="submit">Search</button></form>
          <button type="button" className={`filter-toggle${showFilters ? ' selected' : ''}`} onClick={() => setShowFilters((visible) => !visible)}><SlidersHorizontal size={17} /> Filters {filterCount > 0 && <span>{filterCount}</span>}</button>
          <label className="sort-select"><span>Sort by</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="newest">Recently listed</option><option value="harvest_date_asc">Harvest date: soonest</option><option value="harvest_date_desc">Harvest date: latest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></label>
        </div>
        <div className={`catalogue-filter-panel${showFilters ? ' expanded' : ''}`}>
          <label className="filter-field"><span>Crop</span><select value={crop} onChange={(event) => { setCrop(event.target.value); setPage(1); }}><option value="">All crops</option>{crops.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
          <label className="filter-field"><span>District</span><select value={district} onChange={(event) => { setDistrict(event.target.value); setPage(1); }}><option value="">All districts</option>{districts.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
          <label className="filter-field"><span>Grade</span><input list="ym-grade-options" value={grade} onChange={(event) => { setGrade(event.target.value); setPage(1); }} placeholder="Any grade" /><datalist id="ym-grade-options">{Array.from(new Set(rows.map((row) => row.grade))).map((name) => <option key={name} value={name} />)}</datalist></label>
          <div className="filter-field price-filter"><span>Price per kg · LKR</span><div><input aria-label="Minimum price per kilogram" type="number" min="0" step="0.01" value={minPrice} onChange={(event) => { setMinPrice(event.target.value); setPage(1); }} placeholder="Min" /><span>to</span><input aria-label="Maximum price per kilogram" type="number" min="0" step="0.01" value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value); setPage(1); }} placeholder="Max" /></div></div>
          {filterCount > 0 && <button type="button" className="clear-filters" onClick={clearFilters}><X size={14} /> Clear filters</button>}
        </div>
        <div className="catalogue-results-bar"><span><ListFilter size={15} /> {state === 'loading' ? 'Updating listings…' : `${formatNumber(totalRecords)} harvest${totalRecords === 1 ? '' : 's'} found`}</span>{(crop || district) && <span className="active-filter-note">{crop && <span>{crop}</span>}{district && <span><MapPin size={12} />{district}</span>}</span>}</div>

        {state === 'loading' && <HarvestSkeleton count={6} />}
        {state === 'error' && <EmptyState title="We couldn’t load the marketplace" description={errorMessage} action={<button type="button" className="button button-primary" onClick={() => setReloadKey((key) => key + 1)}>Try again</button>} />}
        {state === 'ready' && rows.length > 0 && <div className="harvest-grid catalogue-grid">{rows.map((harvest) => <HarvestCard harvest={harvest} key={harvest.id} />)}</div>}
        {state === 'ready' && rows.length === 0 && <EmptyState title="No matching harvests" description="Try a different crop, district or price range. New eligible listings will appear here when they’re available." action={<button type="button" className="button button-secondary" onClick={clearFilters}>Clear search and filters</button>} />}

        {state === 'ready' && totalRecords > 0 && <div className="pagination-bar"><label>Show <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{PAGE_SIZE_OPTIONS.map((size) => <option value={size} key={size}>{size}</option>)}</select> per page</label><div className="pagination-controls"><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={17} /> <span>Previous</span></button><span className="pagination-count">Page {page} of {totalPages || 1}</span><button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}><span>Next</span><ChevronRight size={17} /></button></div></div>}
      </section>

      <section className="catalogue-privacy"><div className="ym-container"><ShieldCheck size={17} /><p>Public marketplace listings include farm, crop and district details. Private contact information and pickup addresses are not displayed.</p></div></section>
    </main>
    <PublicFooter />
  </div>;
}
