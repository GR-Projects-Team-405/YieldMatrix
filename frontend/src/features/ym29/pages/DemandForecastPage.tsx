// YM29 · Yasindu Janapriya · Screen 2: Demand Forecast Details (7-day projection vs baseline).

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ContentCard } from '../../../components/ContentCard';
import { SelectField } from '../../../components/SelectField';
import { StatCard } from '../../../components/StatCard';
import { Table, TableRow } from '../../../components/Table';
import { fetchDemandForecast, fetchReferenceData } from '../api';
import { DemandForecastChart } from '../components/DemandForecastChart';
import { InsightStatePanel } from '../components/InsightStatePanel';
import { ProvenanceBar } from '../components/ProvenanceBar';
import {
  extractApiError,
  formatColomboDate,
  formatKg,
  formatVariance,
} from '../formatters';
import type { DemandForecastResponse, ReferenceDataResponse } from '../types';

function downloadForecastCsv(data: DemandForecastResponse) {
  const header = 'date,crop,district,projected_kg,baseline_kg,variance_pct,rule_note,is_demo';
  const rows = data.series.map((pt) =>
    [
      pt.date,
      `"${data.selection.crop.name}"`,
      `"${data.selection.district}"`,
      pt.predicted_kg ?? '',
      pt.baseline_kg ?? '',
      pt.variance_pct ?? '',
      `"${pt.note.replaceAll('"', '""')}"`,
      data.is_demo ? 'true' : 'false',
    ].join(','),
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `demand-forecast-${data.selection.crop.name.toLowerCase()}-${data.selection.district.toLowerCase().replaceAll(' ', '-')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DemandForecastPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reference, setReference] = useState<ReferenceDataResponse | null>(null);
  const [crop, setCrop] = useState(() => searchParams.get('crop') || 'Tomato');
  const [district, setDistrict] = useState(() => searchParams.get('district') || 'Colombo');
  const [demoMode, setDemoMode] = useState<boolean>(() => searchParams.get('demo') === 'true');
  const [modeInitialized, setModeInitialized] = useState(() => searchParams.has('demo'));

  const [data, setData] = useState<DemandForecastResponse | null>(null);
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
    nextParams.set('demo', demoMode ? 'true' : 'false');
    setSearchParams(nextParams, { replace: true });

    fetchDemandForecast({ crop, district, demo: demoMode })
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) {
          setError(extractApiError(err, 'Unable to load demand forecast details.'));
          setData(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [crop, district, demoMode, modeInitialized, setSearchParams]);

  const cropOptions = (reference?.crops || [{ id: 'Tomato', name: 'Tomato' }]).map((c) => ({
    value: c.name,
    label: c.name,
  }));
  const districtOptions = (reference?.districts || [{ name: 'Colombo', hub_label: 'Colombo' }]).map((d) => ({
    value: d.name,
    label: d.name,
  }));

  const backQuery = `?crop=${encodeURIComponent(crop)}&district=${encodeURIComponent(district)}&demo=${demoMode ? 'true' : 'false'}`;

  return (
    <div className="ym29-stack">
      <div className="ym29-header-row">
        <div className="ym29-header-copy">
          <Link to={`..${backQuery}`} className="ym29-link-inline" style={{ marginBottom: 8 }}>
            <ArrowLeft size={15} aria-hidden="true" />
            Back to Market insights
          </Link>
          <p>7-day demand volume projection compared against the weekday-mean baseline (summed across grades per crop and district).</p>
          {data && (
            <ProvenanceBar
              status={data.status}
              dataDate={data.data_date}
              method={data.published_method_label}
              generatedAt={data.generated_at}
              isDemo={data.is_demo}
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
          <Button
            variant="primary"
            disabled={!data || data.status !== 'available' || data.series.length === 0}
            onClick={() => data && downloadForecastCsv(data)}
          >
            <Download size={16} aria-hidden="true" />
            Export forecast (.csv)
          </Button>
        </div>
      </div>

      <ContentCard>
        <div className="ym29-filter-grid">
          <SelectField label="Crop / commodity" value={crop} options={cropOptions} onChange={(e) => setCrop(e.target.value)} />
          <SelectField label="District" value={district} options={districtOptions} onChange={(e) => setDistrict(e.target.value)} />
          <div className="ym-field">
            <label htmlFor="ym29-horizon-readonly">Forecast horizon</label>
            <input
              id="ym29-horizon-readonly"
              type="text"
              readOnly
              value={
                data && data.series.length >= 2
                  ? `Next 7 Days (${formatColomboDate(data.series[0].date)} – ${formatColomboDate(data.series[data.series.length - 1].date)})`
                  : 'Next 7 Days (Fixed horizon)'
              }
            />
          </div>
        </div>
      </ContentCard>

      {error && (
        <InsightStatePanel
          status="error"
          description={error}
          actionLabel={!demoMode ? 'Switch to Demo preview' : undefined}
          onAction={!demoMode ? () => setDemoMode(true) : undefined}
        />
      )}

      {loading && <div className="ym29-skeleton">Loading 7-day forecast for {crop} in {district}…</div>}

      {!loading && data && (
        <>
          <div className="ym29-kpi-grid">
            <StatCard
              label="Peak demand day"
              value={data.peak_day ? formatColomboDate(data.peak_day.date, true) : '—'}
              subtext={
                data.peak_day
                  ? `${formatKg(data.peak_day.predicted_kg)} (${formatVariance(data.peak_day.variance_pct)} vs baseline)`
                  : 'No active forecast'
              }
              highlight={Boolean(data.peak_day)}
            />
            <StatCard
              label="7-day aggregate volume"
              value={formatKg(data.total_projected_kg)}
              subtext={`Expected ${district} intake (all grades)`}
            />
            <StatCard
              label="Model MAE (kg)"
              value={formatKg(data.model_mae_kg, 1)}
              subtext={data.model_version ? `Version: ${data.model_version}` : 'Pending ML model run'}
            />
            <StatCard
              label="Baseline MAE (kg)"
              value={formatKg(data.baseline_mae_kg, 1)}
              subtext="Same 14-day held-out evaluation split"
            />
          </div>

          {data.status !== 'available' ? (
            <ContentCard title="7-Day Volume Projection vs Baseline (kg)">
              <InsightStatePanel
                status={data.status}
                description={data.explanation}
                actionLabel={!demoMode ? 'Preview Demo Data' : undefined}
                onAction={!demoMode ? () => setDemoMode(true) : undefined}
              />
            </ContentCard>
          ) : (
            <>
              <ContentCard
                title="7-Day Volume Projection vs Baseline (kg)"
                subtitle={`Projected intake volume vs 7-day historical weekday baseline · ${crop} in ${district}`}
              >
                <div className="ym29-two-col">
                  <DemandForecastChart
                    series={data.series}
                    peakDay={data.peak_day}
                    cropName={crop}
                    district={district}
                  />

                  {data.peak_day && (
                    <div className="ym29-peak-box">
                      <span style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
                        Peak Day · {formatColomboDate(data.peak_day.date, true)}
                      </span>
                      <strong>{formatKg(data.peak_day.predicted_kg)}</strong>
                      <span className="ym29-chip ym29-chip--live" style={{ width: 'fit-content' }}>
                        {formatVariance(data.peak_day.variance_pct)} vs baseline
                      </span>
                      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
                        7-day weekday baseline: <strong>{formatKg(data.peak_day.baseline_kg)}</strong>
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Rule-based planning note: compare peak intake against baseline before arranging transport. Notes are rule-based, not learned causal explanations.
                      </p>
                    </div>
                  )}
                </div>
              </ContentCard>

              <ContentCard
                title="Daily forecast & rule-based planning notes"
                subtitle="Notes use day-of-week rules. They do not claim what the model learned."
              >
                <Table headers={['Date (IST)', 'Projected (kg)', '7d Baseline (kg)', 'Variance', 'Rule-based note (not learned)']}>
                  {data.series.map((pt) => {
                    const isPeak = data.peak_day?.date === pt.date;
                    return (
                      <TableRow key={pt.date} className={isPeak ? 'ym29-row-highlight' : ''}>
                        <td>
                          <strong>{formatColomboDate(pt.date, true)}</strong>
                          {isPeak && <span className="ym29-chip ym29-chip--demo" style={{ marginLeft: 8 }}>Peak</span>}
                        </td>
                        <td><strong>{formatKg(pt.predicted_kg)}</strong></td>
                        <td>{formatKg(pt.baseline_kg)}</td>
                        <td>{formatVariance(pt.variance_pct)}</td>
                        <td>{pt.note}</td>
                      </TableRow>
                    );
                  })}
                </Table>
              </ContentCard>
            </>
          )}

          <section className="ym29-hero-card" aria-label="Forecasting methodology and limitations">
            <div>
              <span className="ym29-hero-eyebrow">FORECASTING METHODOLOGY &amp; LIMITATIONS</span>
              <h2 style={{ fontSize: 22, marginTop: 6 }}>Published demand model governance</h2>
            </div>

            <div className="ym29-meta-grid">
              <div className="ym29-meta-tile">
                <span>Training data period</span>
                <strong>
                  {data.training_from && data.training_until
                    ? `${formatColomboDate(data.training_from)} – ${formatColomboDate(data.training_until)}`
                    : 'Minimum 56 gap-free days'}
                </strong>
                <small>Summed across grades per crop &amp; district</small>
              </div>
              <div className="ym29-meta-tile">
                <span>Held-out evaluation</span>
                <strong>
                  {data.evaluation_from && data.evaluation_until
                    ? `${formatColomboDate(data.evaluation_from)} – ${formatColomboDate(data.evaluation_until)}`
                    : 'Last 14 days (no future leakage)'}
                </strong>
                <small>Model published only if it beats baseline MAE</small>
              </div>
              <div className="ym29-meta-tile">
                <span>Published method</span>
                <strong>{data.published_method_label}</strong>
                <small>
                  Model MAE: {formatKg(data.model_mae_kg, 1)} · Baseline MAE: {formatKg(data.baseline_mae_kg, 1)}
                </small>
              </div>
            </div>

            <Alert type="info">
              <span>
                <strong>Model inputs &amp; limitations:</strong> {data.limitations}
              </span>
            </Alert>
          </section>
        </>
      )}
    </div>
  );
}
