import { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Boxes, CalendarDays, Check, Clock3, MapPin, Package, ShieldCheck, Sprout } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { EmptyState } from '../../../components/EmptyState';
import { formatDate, formatNumber, type PublicHarvest, type TraceEvent, ym01Get } from '../api';
import HarvestCard from '../components/HarvestCard';
import HarvestImage from '../components/HarvestImage';
import PublicFooter from '../components/PublicFooter';
import PublicNavbar from '../components/PublicNavbar';

type PageState = 'loading' | 'ready' | 'not-found' | 'error';

const statusLabel = (status: string) => status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function HarvestDetails() {
  const { '*': wildcard } = useParams();
  const id = decodeURIComponent(wildcard?.split('/')[0] ?? '');
  const [harvest, setHarvest] = useState<PublicHarvest | null>(null);
  const [related, setRelated] = useState<PublicHarvest[]>([]);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [traceState, setTraceState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setHarvest(null); setRelated([]); setTrace([]); setPageState('loading'); setTraceState('loading'); setErrorMessage('');
    ym01Get<PublicHarvest>(`harvests/${encodeURIComponent(id)}`, { signal: controller.signal }).then(async ({ data }) => {
      if (!data.success || !data.data) { setPageState('not-found'); return; }
      const detail = data.data;
      setHarvest(detail);
      setPageState('ready');

      const traceToken = detail.publicTraceToken;
      if (!traceToken) setTraceState('error');
      else {
        ym01Get<TraceEvent[]>(`harvests/${encodeURIComponent(traceToken)}/traceability`, { signal: controller.signal }).then(({ data: traceResponse }) => {
          if (controller.signal.aborted) return;
          setTrace(traceResponse.success ? traceResponse.data ?? [] : []);
          setTraceState('ready');
        }).catch(() => { if (!controller.signal.aborted) setTraceState('error'); });
      }

      ym01Get<PublicHarvest[]>('harvests', { params: { crop: detail.cropName, limit: 4, sort: 'newest' }, signal: controller.signal }).then(({ data: relatedResponse }) => {
        if (!controller.signal.aborted && relatedResponse.success) setRelated((relatedResponse.data ?? []).filter((item) => item.id !== detail.id).slice(0, 3));
      }).catch(() => {});
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const status = (error as { response?: { status?: number } })?.response?.status;
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (status === 404) setPageState('not-found');
      else { setErrorMessage(message || 'Harvest details could not be loaded. Please try again.'); setPageState('error'); }
    });
    return () => controller.abort();
  }, [id]);

  return <div className="ym-public-site">
    <PublicNavbar />
    <main className="detail-page ym-container">
      <div className="detail-breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/catalogue">Marketplace</Link><span>/</span><span>{harvest?.cropName ?? 'Harvest details'}</span></div>
      {pageState === 'loading' && <div className="detail-loading"><div className="detail-skeleton-image" /><div className="detail-skeleton-copy"><span /><span /><span /><span /></div></div>}
      {pageState === 'not-found' && <EmptyState title="Harvest not found" description="This listing may have expired or is no longer available in the public marketplace." action={<Link className="button button-primary" to="/catalogue"><ArrowLeft size={16} /> Back to marketplace</Link>} />}
      {pageState === 'error' && <EmptyState title="Harvest details are unavailable" description={errorMessage} action={<Link className="button button-primary" to="/catalogue"><ArrowLeft size={16} /> Back to marketplace</Link>} />}
      {pageState === 'ready' && harvest && <>
        <section className="detail-topline"><div><span className="status-live-dot" /> Public listing <span className={`status-chip status-${harvest.listingStatus}`}>{statusLabel(harvest.listingStatus)}</span></div><Link className="back-link" to="/catalogue"><ArrowLeft size={16} /> Back to harvests</Link></section>
        <section className="detail-main-grid">
          <div className="detail-image-panel"><HarvestImage cropName={harvest.cropName} className="detail-main-image" /><div className="image-attribution-note">Illustrative crop image</div><div className="detail-image-facts"><span><MapPin size={15} /> {harvest.district} District</span><span><CalendarDays size={15} /> Harvest {formatDate(harvest.harvestDate)}</span></div></div>
          <div className="detail-product-panel">
            <div className="detail-kickers"><span className="eyebrow">PUBLIC HARVEST · {harvest.grade}</span><span className="status-verified"><BadgeCheck size={15} /> Approved listing</span></div>
            <h1>{harvest.cropName}<span>{harvest.grade}</span></h1>
            {harvest.gradeDescription && <p className="detail-description">{harvest.gradeDescription}</p>}
            <div className="detail-farm-line"><span><Sprout size={18} /></span><div><small>OFFERED BY</small><strong>{harvest.farmName}</strong><p><MapPin size={13} /> {harvest.district} District</p></div></div>
            <div className="detail-price-row"><div><small>PRICE PER KILOGRAM</small><strong>LKR {formatNumber(harvest.unitPriceLkrPerKg, 2)} <span>/ kg</span></strong></div><div className="detail-stock"><Package size={17} /><span>{formatNumber(harvest.availableQuantityKg, 3)} kg available</span></div></div>
            {Number(harvest.availableQuantityKg) > 0 && harvest.listingStatus.toLowerCase() === 'active'
              ? <Link className="button button-primary detail-explore-button" to={`/catalogue/${encodeURIComponent(harvest.id)}/purchase?action=buy`}>Buy Now <Package size={16} /></Link>
              : <p className="detail-unavailable-note">This listing is not currently available to purchase.</p>}
            <p className="detail-privacy"><ShieldCheck size={14} /> Public information only. Contact and pickup details are protected.</p>
          </div>
        </section>

        <section className="detail-information"><div className="detail-section-heading"><span className="eyebrow">HARVEST INFORMATION</span><h2>Clear details for better decisions.</h2><p>Harvest and listing information provided by the current public record.</p></div>
          <div className="detail-facts-grid">
            <Fact icon={<CalendarDays size={18} />} label="Harvest date" value={formatDate(harvest.harvestDate)} />
            <Fact icon={<Package size={18} />} label="Planned quantity" value={`${formatNumber(harvest.plannedQuantityKg, 3)} kg`} />
            <Fact icon={<Check size={18} />} label="Actual quantity" value={harvest.actualQuantityKg === null ? 'Not recorded' : `${formatNumber(harvest.actualQuantityKg, 3)} kg`} />
            <Fact icon={<Package size={18} />} label="Offered quantity" value={`${formatNumber(harvest.offeredQuantityKg, 3)} kg`} />
            <Fact icon={<Boxes size={18} />} label="Available now" value={`${formatNumber(harvest.availableQuantityKg, 3)} kg`} />
            <Fact icon={<Clock3 size={18} />} label="Listing valid until" value={formatDate(harvest.listingValidUntil)} />
            <Fact icon={<BadgeCheck size={18} />} label="Harvest status" value={statusLabel(harvest.harvestStatus)} />
            <Fact icon={<MapPin size={18} />} label="Farm district" value={`${harvest.district} District`} />
          </div>
        </section>

        <section className="trace-section"><div className="trace-heading"><div><span className="eyebrow">PUBLIC TRACEABILITY</span><h2>A transparent harvest journey.</h2><p>Only public milestones and approved event details are shown here.</p></div><div className="trace-badge"><ShieldCheck size={18} /><span>Public record</span></div></div>
          {traceState === 'loading' && <div className="trace-loading"><span /><span /><span /></div>}
          {traceState === 'error' && <div className="trace-note trace-note-error">Traceability information is temporarily unavailable. Harvest details remain available above.</div>}
          {traceState === 'ready' && trace.length === 0 && <div className="trace-note"><span className="trace-empty-icon"><Clock3 size={18} /></span><div><strong>No public events yet</strong><p>Traceability updates will appear here when public harvest events are recorded.</p></div></div>}
          {traceState === 'ready' && trace.length > 0 && <ol className="trace-timeline">{trace.map((event, index) => <li key={`${event.eventType}-${event.eventDateTime}-${index}`}><span className="trace-step-icon"><Check size={15} /></span><div className="trace-event"><div><strong>{event.description || statusLabel(event.eventType)}</strong><span className={`trace-verify trace-${event.verificationStatus}`}>{statusLabel(event.verificationStatus)}</span></div><p>{event.locality || 'Public harvest milestone'}</p><time dateTime={event.eventDateTime}>{formatDate(event.eventDateTime)}</time></div></li>)}</ol>}
        </section>

        {related.length > 0 && <section className="related-harvests"><div className="section-heading section-heading-tight"><div><span className="eyebrow">DISCOVER MORE</span><h2>Other available harvests</h2></div><Link className="text-link" to={`/catalogue?crop=${encodeURIComponent(harvest.cropName)}`}>View marketplace <ArrowLeft className="button-arrow" size={16} /></Link></div><div className="harvest-grid">{related.map((item) => <HarvestCard harvest={item} key={item.id} />)}</div></section>}
      </>}
    </main>
    <PublicFooter />
  </div>;
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <article className="detail-fact"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

