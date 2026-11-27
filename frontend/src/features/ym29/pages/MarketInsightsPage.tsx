// YM29 · Yasindu Janapriya · Screen 1: Market Insights (Farmer & Buyer).

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, CloudSun, TrendingUp } from 'lucide-react';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ContentCard } from '../../../components/ContentCard';
import { EmptyState } from '../../../components/EmptyState';
import { SelectField } from '../../../components/SelectField';
import { StatCard } from '../../../components/StatCard';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import { fetchMarketInsights, fetchReferenceData } from '../api';
import { DemandForecastChart } from '../components/DemandForecastChart';
import { InsightStatePanel } from '../components/InsightStatePanel';
import { PriceRangeBar } from '../components/PriceRangeBar';
import { ProvenanceBar } from '../components/ProvenanceBar';
import { ReasonList } from '../components/ReasonList';
import { WeatherStrip } from '../components/WeatherStrip';
import {
  extractApiError,
  formatColomboDate,
  formatColomboTime,
  formatKg,
  formatLkr,
  formatPriceRange,
} from '../formatters';
import type { MarketInsightsResponse, ReferenceDataResponse } from '../types';

export default function MarketInsightsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reference, setReference] = useState<ReferenceDataResponse | null>(null);
  const [crop, setCrop] = useState(() => searchParams.get('crop') || 'Tomato');
  const [district, setDistrict] = useState(() => searchParams.get('district') || 'Colombo');
  const [grade, setGrade] = useState(() => searchParams.get('grade') || 'Grade A');
  const [demoMode, setDemoMode] = useState<boolean>(() => searchParams.get('demo') === 'true');
  const [modeInitialized, setModeInitialized] = useState(() => searchParams.has('demo'));

  const [data, setData] = useState<MarketInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    fetchReferenceData()
      .then((ref) => {
        if (!active) return;
        setReference(ref);
        if (!modeInitialized && !ref.db_connected) {
          setDemoMode(true);
          setModeInitialized(true);
        } else if (!modeInitialized) {
          setModeInitialized(true);
        }
      })
      .catch(() => {
        if (!active) return;
        if (!modeInitialized) {
          setDemoMode(true);
          setModeInitialized(true);
        }
      });
    return () => {
      active = false;
    };
  }, [modeInitialized]);

  useEffect(() => {
    if (!modeInitialized) return;
    let active = true;
    setLoading(true);
    setError(null);

    const nextParams = new URLSearchParams();
    nextParams.set('crop', crop);
    nextParams.set('district', district);
    nextParams.set('grade', grade);
    nextParams.set('demo', demoMode ? 'true' : 'false');
    setSearchParams(nextParams, { replace: true });

    fetchMarketInsights({ crop, district, grade, demo: demoMode })
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) {
          setError(extractApiError(err, 'Unable to load market insights.'));
          setData(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [crop, district, grade, demoMode, modeInitialized, reloadTick, setSearchParams]);

  const cropOptions = (reference?.crops || [{ id: 'Tomato', name: 'Tomato' }]).map((c) => ({
    value: c.name,
    label: c.name,
  }));
  const districtOptions = (reference?.districts || [{ name: 'Colombo', hub_label: 'Colombo' }]).map((d) => ({
    value: d.name,
    label: d.name,
  }));
  const gradeOptions = (reference?.grades || [{ id: 'Grade A', name: 'Grade A' }]).map((g) => ({
    value: g.name,
    label: g.name,
  }));

  const querySuffix = `?crop=${encodeURIComponent(crop)}&district=${encodeURIComponent(district)}&grade=${encodeURIComponent(grade)}&demo=${demoMode ? 'true' : 'false'}`;

  return (
    <div className="ym29-stack">
      <div className="ym29-header-row">
        <div className="ym29-header-copy">
          <p>Predictive crop demand, comparable price statistics, and separate operational weather context.</p>
          {data && (
            <ProvenanceBar
              status={data.status}
              dataDate={data.data_date}
              method={data.method}
              generatedAt={data.generated_at}
              isDemo={data.is_demo}
              isSampleWeather={data.weather.is_sample}
            />
          )}
        </div>

        <div className="ym29-header-actions">
          <div className="ym29-mode-toggle" role="group" aria-label="Data source mode">
            <button type="button" aria-pressed={!demoMode} onClick={() => setDemoMode(false)}>
              Live DB
            </button>
            <button type="button" aria-pressed={demoMode} onClick={() => setDemoMode(true)}>
              Demo preview
            </button>
          </div>
          <Link to={`advice${querySuffix}`}>
            <Button variant="outline">
              <CloudSun size={16} aria-hidden="true" />
              Price &amp; weather
            </Button>
          </Link>
          <Link to={`forecast${querySuffix}`}>
            <Button variant="primary">
              View forecast
              <ArrowUpRight size={16} aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>

      {reference && !reference.db_connected && (
        <Alert type="warning">
          Database is not connected yet (add <code>DATABASE_URL</code> to <code>backend/.env</code>). Showing clearly labelled Demo preview data so you can inspect all screens.
        </Alert>
      )}

      {demoMode && (
        <Alert type="info">
          Demo preview active — all forecast &amp; price numbers are labelled <strong>Demo data</strong>. Try <strong>Carrot + Jaffna</strong> for insufficient history or <strong>Beans + Jaffna</strong> for stale data.
        </Alert>
      )}

      <ContentCard>
        <div className="ym29-filter-grid">
          <SelectField label="Crop selection" value={crop} options={cropOptions} onChange={(e) => setCrop(e.target.value)} />
          <SelectField label="District / terminal" value={district} options={districtOptions} onChange={(e) => setDistrict(e.target.value)} />
          <SelectField label="Quality grade" value={grade} options={gradeOptions} onChange={(e) => setGrade(e.target.value)} />
        </div>
      </ContentCard>

      {error && (
        <InsightStatePanel
          status="error"
          description={error}
          actionLabel={!demoMode ? 'Switch to Demo preview' : 'Retry'}
          onAction={() => {
            if (!demoMode) setDemoMode(true);
            else setReloadTick((tick) => tick + 1);
          }}
        />
      )}

      {loading && <div className="ym29-skeleton">Loading market insights for {crop} in {district}…</div>}

      {!loading && data && (
        <>
          <div className="ym29-kpi-grid">
            <StatCard
              label="Top demand crop"
              value={data.kpis.top_demand_crop || '—'}
              subtext={data.kpis.top_demand_subtext}
            />
            <StatCard
              label={`Median price (${grade})`}
              value={formatLkr(data.kpis.suggested_price_cents)}
              subtext={
                data.price_stats.status === 'available'
                  ? `per kg · n = ${data.price_stats.observation_count} (14d)`
                  : 'Insufficient / stale observations'
              }
            />
            <StatCard
              label="Forecast MAE (kg)"
              value={formatKg(data.kpis.forecast_mae_kg, 1)}
              subtext={
                data.kpis.baseline_mae_kg !== null
                  ? `vs baseline ${formatKg(data.kpis.baseline_mae_kg, 1)} (14d holdout)`
                  : 'Awaiting stored evaluation'
              }
            />
            <StatCard
              label="Data last updated"
              value={formatColomboTime(data.kpis.last_updated_at)}
              subtext={data.data_date ? `${formatColomboDate(data.data_date)} · IST` : 'No stored data yet'}
            />
          </div>

          <div className="ym29-two-col">
            <section className="ym29-hero-card" aria-label="Demand forecast overview">
              <div className="ym29-stack" style={{ gap: 10 }}>
                <span className="ym29-hero-eyebrow">
                  {data.is_demo ? 'DEMO FORECAST PREVIEW' : 'DEMAND FORECAST'} · {formatColomboDate(data.data_date)}
                </span>
                <h2>Know the market before you plan.</h2>
                <p>
                  Compare the 7-day district demand outlook for <strong>{crop}</strong> in <strong>{district}</strong> against the 7-day weekday baseline. Price ranges and weather are presented separately — you stay in full control of your offer prices.
                </p>
              </div>
              <div className="ym29-hero-actions">
                <Link to={`forecast${querySuffix}`}>
                  <Button variant="secondary">
                    <TrendingUp size={16} aria-hidden="true" />
                    View 7-day forecast
                  </Button>
                </Link>
                <Link to={`advice${querySuffix}`}>
                  <Button variant="outline" style={{ background: 'rgba(255,255,255,0.12)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.35)' }}>
                    Price &amp; weather advice
                  </Button>
                </Link>
              </div>
            </section>

            <ContentCard title="Why this recommendation?" subtitle="Each evidence type is shown separately with its own date and scope.">
              <ReasonList reasons={data.reasons} />
            </ContentCard>
          </div>

          <div className="ym29-two-col">
            <ContentCard
              title="7-Day Demand Forecast by District"
              subtitle={`Projected intake volume in kg for ${district}${data.is_demo ? ' · DEMO DATA' : ''}`}
            >
              <div className="ym29-tabs" role="group" aria-label="Quick crop filter">
                {(reference?.crops || []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="ym29-tab"
                    aria-pressed={c.name === crop}
                    onClick={() => setCrop(c.name)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {data.forecast.status === 'available' && data.forecast.series.length > 0 ? (
                <DemandForecastChart
                  series={data.forecast.series}
                  peakDay={data.forecast.peak_day}
                  cropName={crop}
                  district={district}
                  compact
                />
              ) : (
                <InsightStatePanel
                  status={data.forecast.status}
                  description={data.forecast.explanation}
                  actionLabel={!demoMode ? 'Preview Demo Data' : undefined}
                  onAction={!demoMode ? () => setDemoMode(true) : undefined}
                />
              )}
            </ContentCard>

            <div className="ym29-stack" style={{ gap: 16 }}>
              <ContentCard title="Price statistics" subtitle={`Comparable ${grade} observations (last 14 days, n ≥ 5)`}>
                <PriceRangeBar price={data.price_stats} />
              </ContentCard>

              <ContentCard title={data.weather.is_sample ? 'Sample weather' : 'Weather context'} subtitle={`${district} · 5-day operational outlook`}>
                <WeatherStrip weather={data.weather} />
              </ContentCard>
            </div>
          </div>

          <ContentCard
            title="Crop Market Index & Demand Matrix"
            subtitle="Price statistics and demand forecasts are calculated and displayed separately."
          >
            {data.market_matrix.length === 0 ? (
              <EmptyState
                title="No market matrix rows yet"
                description="Once an admin approves and publishes market observation CSV data, crop-district summaries will appear here."
                action={
                  !demoMode ? (
                    <Button variant="outline" onClick={() => setDemoMode(true)}>
                      Preview Demo Matrix
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <Table headers={['Crop & grade', 'District', 'Demand trend', 'Price range (P25–P75)', 'Method', 'Evidence source', 'Details']}>
                {data.market_matrix.map((row) => (
                  <TableRow key={`${row.crop}-${row.grade}-${row.district}`}>
                    <td>
                      <strong>{row.crop}</strong> <span style={{ color: 'var(--muted)' }}>({row.grade})</span>
                    </td>
                    <td>{row.district}</td>
                    <td>
                      {row.status === 'available' ? (
                        <StatusBadge status={row.demand_trend_label} />
                      ) : (
                        <StatusBadge status={row.status === 'stale' ? 'Expired' : 'Pending'} />
                      )}
                      {row.status !== 'available' && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{row.demand_trend_label}</div>
                      )}
                    </td>
                    <td>{formatPriceRange(row.p25_cents, row.p75_cents)}</td>
                    <td>{row.method}</td>
                    <td>
                      <div>{row.evidence_source}</div>
                      <small style={{ color: 'var(--muted)' }}>{formatColomboDate(row.data_date)}</small>
                    </td>
                    <td>
                      <Link
                        className="ym29-link-inline"
                        to={`forecast?crop=${encodeURIComponent(row.crop)}&district=${encodeURIComponent(row.district)}&grade=${encodeURIComponent(row.grade)}&demo=${demoMode ? 'true' : 'false'}`}
                      >
                        View details →
                      </Link>
                    </td>
                  </TableRow>
                ))}
              </Table>
            )}
          </ContentCard>
        </>
      )}
    </div>
  );
}
