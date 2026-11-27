// YM29 · Yasindu Janapriya · Screen 3: Price & Weather Advice (FR-AI-11 advisory-only).

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, CloudRain, ShieldCheck, Sun } from 'lucide-react';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ContentCard } from '../../../components/ContentCard';
import { SelectField } from '../../../components/SelectField';
import { Table, TableRow } from '../../../components/Table';
import { fetchPriceWeatherAdvice, fetchReferenceData } from '../api';
import { InsightStatePanel } from '../components/InsightStatePanel';
import { PriceRangeBar } from '../components/PriceRangeBar';
import { ProvenanceBar } from '../components/ProvenanceBar';
import {
  extractApiError,
  formatColomboDate,
  formatColomboDateTime,
} from '../formatters';
import type { PriceWeatherAdviceResponse, ReferenceDataResponse } from '../types';

export default function PriceWeatherAdvicePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reference, setReference] = useState<ReferenceDataResponse | null>(null);
  const [crop, setCrop] = useState(() => searchParams.get('crop') || 'Tomato');
  const [district, setDistrict] = useState(() => searchParams.get('district') || 'Colombo');
  const [grade, setGrade] = useState(() => searchParams.get('grade') || 'Grade A');
  const [demoMode, setDemoMode] = useState<boolean>(() => searchParams.get('demo') === 'true');
  const [modeInitialized, setModeInitialized] = useState(() => searchParams.has('demo'));

  const [data, setData] = useState<PriceWeatherAdviceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchReferenceData()
      .then((ref) => {
        if (!active) return;
        setReference(ref);
        if (!modeInitialized && !ref.db_connected) {
          setDemoMode(true);
        }
        setModeInitialized(true);
      })
      .catch(() => {
        if (!active) return;
        if (!modeInitialized) setDemoMode(true);
        setModeInitialized(true);
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

    fetchPriceWeatherAdvice({ crop, district, grade, demo: demoMode })
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) {
          setError(extractApiError(err, 'Unable to load price and weather advice.'));
          setData(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [crop, district, grade, demoMode, modeInitialized, setSearchParams]);

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

  const navQuery = `?crop=${encodeURIComponent(crop)}&district=${encodeURIComponent(district)}&grade=${encodeURIComponent(grade)}&demo=${demoMode ? 'true' : 'false'}`;

  return (
    <div className="ym29-stack">
      <div className="ym29-header-row">
        <div className="ym29-header-copy">
          <Link to={`..${navQuery}`} className="ym29-link-inline" style={{ marginBottom: 8 }}>
            <ArrowLeft size={15} aria-hidden="true" />
            Back to Market insights
          </Link>
          <p>Compare district price statistics, weather context, and rule-based advisory notes separately.</p>
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
          <Link to={`../forecast${navQuery}`}>
            <Button variant="primary">
              View 7-day forecast
              <ArrowUpRight size={16} aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>

      <ContentCard>
        <div className="ym29-filter-grid">
          <SelectField label="Crop / commodity" value={crop} options={cropOptions} onChange={(e) => setCrop(e.target.value)} />
          <SelectField label="Selected grade" value={grade} options={gradeOptions} onChange={(e) => setGrade(e.target.value)} />
          <SelectField label="District / terminal" value={district} options={districtOptions} onChange={(e) => setDistrict(e.target.value)} />
        </div>
      </ContentCard>

      <div className="ym29-disclaimer-bar" role="note">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={18} aria-hidden="true" />
          You decide your offer price. YieldMatrix never auto-sets prices, confirms orders, or locks dispatch slots.
        </span>
      </div>

      {error && (
        <InsightStatePanel
          status="error"
          description={error}
          actionLabel={!demoMode ? 'Switch to Demo preview' : undefined}
          onAction={!demoMode ? () => setDemoMode(true) : undefined}
        />
      )}

      {loading && <div className="ym29-skeleton">Loading price statistics and weather context for {crop} in {district}…</div>}

      {!loading && data && (
        <>
          <section className="ym29-hero-card" aria-label="Advisory summary across three separated sources">
            <div>
              <span className="ym29-hero-eyebrow">
                RULE-BASED ADVISORY SUMMARY · {data.is_demo ? 'DEMO DATA' : 'LIVE DATA'}
              </span>
              <h2 style={{ fontSize: 22, marginTop: 6 }}>
                Three separate evidence inputs for {crop} ({grade}) in {district}
              </h2>
              <p style={{ marginTop: 6 }}>
                Demand forecast, statistical price range, and weather context are kept independent. Review all three before deciding your offer price.
              </p>
            </div>

            <div className="ym29-hero-pillars">
              {data.reasons.map((reason, idx) => (
                <div key={reason.category} className="ym29-hero-pillar">
                  <strong>
                    {idx + 1}. {reason.evidence_type} · {formatColomboDate(reason.date)}
                  </strong>
                  <span>{reason.text}</span>
                  <span style={{ opacity: 0.85, fontSize: 11 }}>{reason.scope}</span>
                </div>
              ))}
            </div>
          </section>

          <ContentCard
            title={`Recent Comparable Prices — ${crop} in ${district}`}
            subtitle="P25 to P75 statistical range from the preceding 14 days (requires at least 5 comparable observations per grade)."
          >
            <div className="ym29-three-col">
              {data.grade_prices.map((gradeStats) => {
                const isSelected = gradeStats.grade.toLowerCase() === grade.toLowerCase();
                return (
                  <div
                    key={gradeStats.grade}
                    className={`ym29-grade-card ${isSelected ? 'ym29-grade-card--selected' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <strong style={{ fontSize: 16 }}>{gradeStats.grade}</strong>
                      {isSelected && <span className="ym29-chip ym29-chip--live">Selected</span>}
                    </div>
                    <PriceRangeBar price={gradeStats} />
                  </div>
                );
              })}
            </div>
          </ContentCard>

          <ContentCard
            title="Weather context for harvest and transit"
            subtitle="Operational weather outlook across key corridors. Weather is displayed for planning context only — it is not a demand-model input."
          >
            <div className="ym29-four-col">
              {data.corridor_weather.map((w) => {
                const peakRain = w.days.reduce((best, d) => (d.rain_mm > best.rain_mm ? d : best), w.days[0]);
                const highRisk = w.risk_level === 'high';
                return (
                  <div key={w.district} className={`ym29-corridor-card ${highRisk ? 'ym29-corridor-card--high' : ''}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span className={`ym29-chip ${w.is_sample ? 'ym29-chip--demo' : 'ym29-chip--info'}`}>
                        {w.is_sample ? 'Sample weather' : 'Open-Meteo'}
                      </span>
                      {peakRain && peakRain.rain_mm >= 8 ? (
                        <CloudRain size={16} aria-hidden="true" />
                      ) : (
                        <Sun size={16} aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <strong style={{ fontSize: 16 }}>{w.district}</strong>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{w.hub_label}</div>
                    </div>
                    {w.days[0] && (
                      <div style={{ fontSize: 13 }}>
                        Today: <strong>{Math.round(w.days[0].temp_max)}°C / {Math.round(w.days[0].temp_min)}°C</strong> ·{' '}
                        {w.days[0].rain_mm.toFixed(1)} mm rain
                      </div>
                    )}
                    <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{w.summary}</p>
                    <small style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Risk: <strong>{w.risk_level}</strong> · {w.transit_note}
                    </small>
                  </div>
                );
              })}
            </div>
          </ContentCard>

          <ContentCard
            title="Advisory Evidence Matrix & Data Provenance"
            subtitle="Each evidence type is reported with its own source, date, and scope."
          >
            <Table headers={['Advice element', 'Evidence type', 'Supporting source', 'Data date', 'Method / scope', 'Updated (IST)']}>
              {data.evidence_matrix.map((row) => (
                <TableRow key={row.element}>
                  <td><strong>{row.element}</strong></td>
                  <td><span className="ym29-chip">{row.evidence_type}</span></td>
                  <td>{row.supporting_source}</td>
                  <td>{formatColomboDate(row.data_date)}</td>
                  <td>{row.method_scope}</td>
                  <td>{formatColomboDateTime(row.updated_at)}</td>
                </TableRow>
              ))}
            </Table>
          </ContentCard>

          <ContentCard>
            <div className="ym29-header-row" style={{ alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: 16 }}>Advisory guidance only</strong>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  Review the 7-day demand forecast and price percentiles before creating any listing or demand in your trading workspace.
                </p>
              </div>
              <div className="ym29-header-actions">
                <Link to={`..${navQuery}`}>
                  <Button variant="outline">Back to Market insights</Button>
                </Link>
                <Link to={`../forecast${navQuery}`}>
                  <Button variant="primary">View 7-day forecast</Button>
                </Link>
              </div>
            </div>
          </ContentCard>
        </>
      )}

      {!loading && !data && !error && (
        <Alert type="info">Select a crop, grade, and district to view price and weather advice.</Alert>
      )}
    </div>
  );
}
