// YM29 · Yasindu Janapriya · Screen 4: Admin Market Data (/admin/market-data).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ContentCard } from '../../../components/ContentCard';
import { EmptyState } from '../../../components/EmptyState';
import { StatCard } from '../../../components/StatCard';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import { fetchAdminDatasets, fetchAdminEvaluation, fetchReferenceData } from '../api';
import { InsightStatePanel } from '../components/InsightStatePanel';
import { ProvenanceBar } from '../components/ProvenanceBar';
import {
  extractApiError,
  formatColomboDate,
  formatColomboDateTime,
  formatKg,
} from '../formatters';
import type { AdminDatasetsResponse, AdminEvaluationResponse } from '../types';

type AuditFilter = 'all' | 'approved' | 'rejected';

export default function AdminMarketDataPage() {
  const [demoMode, setDemoMode] = useState(false);
  const [modeInitialized, setModeInitialized] = useState(false);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  const [datasetsRes, setDatasetsRes] = useState<AdminDatasetsResponse | null>(null);
  const [evalRes, setEvalRes] = useState<AdminEvaluationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    fetchReferenceData()
      .then((ref) => {
        if (!active) return;
        setDbConnected(ref.db_connected);
        if (!ref.db_connected) setDemoMode(true);
        setModeInitialized(true);
      })
      .catch(() => {
        if (!active) return;
        setDbConnected(false);
        setDemoMode(true);
        setModeInitialized(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!modeInitialized) return;
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchAdminDatasets(demoMode), fetchAdminEvaluation(demoMode)])
      .then(([ds, ev]) => {
        if (!active) return;
        setDatasetsRes(ds);
        setEvalRes(ev);
      })
      .catch((err) => {
        if (!active) return;
        setError(extractApiError(err, 'Unable to load admin market data overview.'));
        setDatasetsRes(null);
        setEvalRes(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [demoMode, modeInitialized, reloadTick]);

  const pendingUploads = datasetsRes?.pending_uploads || [];
  const filteredDatasets = (datasetsRes?.datasets || []).filter((item) => {
    if (filter === 'all') return true;
    return item.status.toLowerCase() === filter;
  });

  const maxMae = Math.max(
    evalRes?.overall_model_mae_kg || 0,
    evalRes?.overall_baseline_mae_kg || 0,
    1,
  );

  return (
    <div className="ym29-stack">
      <div className="ym29-header-row">
        <div className="ym29-header-copy">
          <p>Monitor market observation datasets, freshness thresholds, and forecast model vs. baseline MAE evaluations.</p>
          {datasetsRes && (
            <ProvenanceBar
              status={datasetsRes.status}
              dataDate={datasetsRes.data_date}
              method={evalRes?.published_method_label || 'Evaluation pending'}
              generatedAt={datasetsRes.generated_at}
              isDemo={datasetsRes.is_demo}
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
          {pendingUploads.length > 0 && (
            <Link to={`uploads/${encodeURIComponent(pendingUploads[0].id)}`}>
              <Button variant="secondary">
                Review pending upload ({pendingUploads.length})
              </Button>
            </Link>
          )}
          <Link to="uploads/new">
            <Button variant="primary">
              <Upload size={16} aria-hidden="true" />
              Upload CSV data
              <ArrowUpRight size={16} aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>

      {dbConnected === false && (
        <Alert type="warning">
          Database is not connected yet (add <code>DATABASE_URL</code> to <code>backend/.env</code>). Showing Demo preview for monitoring; CSV upload commits require an active PostgreSQL connection.
        </Alert>
      )}

      {datasetsRes?.summary.is_stale && (
        <Alert type="error">
          Market data is stale — latest observation date ({formatColomboDate(datasetsRes.summary.latest_date)}) is older than 7 days. Upload fresh CSV observations to resume active insights.
        </Alert>
      )}

      {error && (
        <InsightStatePanel
          status="error"
          description={error}
          actionLabel={!demoMode ? 'Switch to Demo preview' : 'Retry'}
          onAction={() => {
            if (!demoMode) setDemoMode(true);
            else setReloadTick((t) => t + 1);
          }}
        />
      )}

      {loading && <div className="ym29-skeleton">Loading admin market data &amp; evaluation metrics…</div>}

      {!loading && datasetsRes && evalRes && (
        <>
          <div className="ym29-kpi-grid">
            <StatCard
              label="Approved imports"
              value={datasetsRes.summary.approved_imports.toLocaleString('en-US')}
              subtext={`${datasetsRes.summary.rejected_imports} rejected · logged in audit_logs`}
            />
            <StatCard
              label="Stored observations"
              value={datasetsRes.summary.total_observations.toLocaleString('en-US')}
              subtext={`${datasetsRes.summary.active_series_count} crop × district series`}
            />
            <StatCard
              label="Data freshness"
              value={
                !datasetsRes.summary.latest_date
                  ? 'No data'
                  : datasetsRes.summary.is_stale
                    ? 'Stale (>7d)'
                    : 'Fresh'
              }
              subtext={
                datasetsRes.summary.latest_date
                  ? `Latest: ${formatColomboDate(datasetsRes.summary.latest_date)}`
                  : 'Upload a CSV to populate'
              }
              highlight={datasetsRes.summary.is_stale}
            />
            <StatCard
              label="Published MAE (kg)"
              value={formatKg(evalRes.overall_model_mae_kg ?? evalRes.overall_baseline_mae_kg, 1)}
              subtext={
                evalRes.overall_baseline_mae_kg !== null
                  ? `vs baseline ${formatKg(evalRes.overall_baseline_mae_kg, 1)}`
                  : 'Awaiting Phase 2 ML run'
              }
            />
          </div>

          <div className="ym29-two-col ym29-two-col--equal">
            <ContentCard
              title="Dataset Quality & Freshness Assessment"
              subtitle="Live coverage metrics computed directly from current market_observations rows."
            >
              <div className="ym29-stack" style={{ gap: 12 }}>
                <div className="ym29-quality-grid">
                  <div className="ym29-price-metric">
                    <span>Coverage window</span>
                    <strong>
                      {datasetsRes.summary.earliest_date && datasetsRes.summary.latest_date
                        ? `${formatColomboDate(datasetsRes.summary.earliest_date)} – ${formatColomboDate(datasetsRes.summary.latest_date)}`
                        : '—'}
                    </strong>
                  </div>
                  <div className="ym29-price-metric">
                    <span>Active crop × district pairs</span>
                    <strong>{datasetsRes.summary.active_series_count}</strong>
                  </div>
                  <div className="ym29-price-metric">
                    <span>Stale series (&gt;7 days)</span>
                    <strong>{datasetsRes.summary.stale_series_count}</strong>
                  </div>
                  <div className="ym29-price-metric">
                    <span>Short history (&lt;56 days)</span>
                    <strong>{datasetsRes.summary.insufficient_series_count}</strong>
                  </div>
                </div>

                <div className="ym29-note-box">
                  <strong>Freshness policy:</strong> Series with fewer than 56 gap-free daily records show <em>Insufficient data</em>; records older than 7 days suppress active forecasts until refreshed.
                </div>
              </div>
            </ContentCard>

            <ContentCard
              title="Model vs. Baseline Evaluation (MAE in kg)"
              subtitle={evalRes.evaluation_window || '14-day held-out evaluation split (no future leakage)'}
            >
              {evalRes.status === 'service_unavailable' ? (
                <InsightStatePanel
                  status="service_unavailable"
                  title="Awaiting Phase 2 ML pipeline"
                  description="No forecast_runs records exist yet. Once the offline demand forecasting model runs, model MAE vs. weekday baseline MAE (in kg) and the published method will appear here automatically."
                  actionLabel={!demoMode ? 'Preview Demo Evaluation' : undefined}
                  onAction={!demoMode ? () => setDemoMode(true) : undefined}
                />
              ) : (
                <div className="ym29-stack" style={{ gap: 16 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="ym29-chip ym29-chip--live">
                      Published: {evalRes.published_method_label}
                    </span>
                    {evalRes.improvement_kg !== null && evalRes.improvement_kg > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--accent-text)', fontWeight: 600 }}>
                        Beats baseline by {formatKg(evalRes.improvement_kg, 1)} MAE
                      </span>
                    )}
                  </div>

                  <div className="ym29-bar-list">
                    <div className="ym29-bar-item">
                      <div className="ym29-bar-label">
                        <span>Demand model MAE</span>
                        <strong>{formatKg(evalRes.overall_model_mae_kg, 1)}</strong>
                      </div>
                      <div className="ym29-bar-track">
                        <div
                          className="ym29-bar-fill ym29-bar-fill--model"
                          style={{
                            width: `${evalRes.overall_model_mae_kg !== null ? Math.max(8, (evalRes.overall_model_mae_kg / maxMae) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="ym29-bar-item">
                      <div className="ym29-bar-label">
                        <span>7-day weekday baseline MAE</span>
                        <strong>{formatKg(evalRes.overall_baseline_mae_kg, 1)}</strong>
                      </div>
                      <div className="ym29-bar-track">
                        <div
                          className="ym29-bar-fill ym29-bar-fill--baseline"
                          style={{
                            width: `${evalRes.overall_baseline_mae_kg !== null ? Math.max(8, (evalRes.overall_baseline_mae_kg / maxMae) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {evalRes.by_crop.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Per-crop holdout MAE (kg)</p>
                      <div className="ym29-crop-mae-grid">
                        {evalRes.by_crop.map((item) => (
                          <div key={item.crop} className="ym29-price-metric">
                            <span>{item.crop}</span>
                            <strong>{formatKg(item.model_mae_kg ?? item.baseline_mae_kg, 1)}</strong>
                            <small style={{ fontSize: 11, color: 'var(--muted)' }}>
                              Base: {formatKg(item.baseline_mae_kg, 1)}
                            </small>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ContentCard>
          </div>

          <ContentCard
            title="Imported Market Datasets & Audit History"
            subtitle="Every approved or rejected CSV import is permanently recorded in audit_logs (FR-ADM-04)."
          >
            <div className="ym29-tabs" role="group" aria-label="Filter dataset imports">
              {(['all', 'approved', 'rejected'] as AuditFilter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className="ym29-tab"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {key === 'all'
                    ? `All (${datasetsRes.datasets.length})`
                    : key === 'approved'
                      ? `Approved (${datasetsRes.summary.approved_imports})`
                      : `Rejected (${datasetsRes.summary.rejected_imports})`}
                </button>
              ))}
            </div>

            {filteredDatasets.length === 0 ? (
              <EmptyState
                title="No dataset imports recorded yet"
                description="Upload a validated market observation CSV to populate demand and price history."
                action={
                  <Link to="uploads/new">
                    <Button variant="primary">Upload first CSV</Button>
                  </Link>
                }
              />
            ) : (
              <Table headers={['Dataset / file', 'Source(s)', 'Period covered', 'Rows', 'Status', 'Imported by & time (IST)', 'Notes']}>
                {filteredDatasets.map((row) => (
                  <TableRow key={row.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileSpreadsheet size={16} aria-hidden="true" />
                        <div>
                          <strong>{row.file_name}</strong>
                          {row.sample_data && (
                            <span className="ym29-chip ym29-chip--demo" style={{ marginLeft: 8 }}>
                              Demo data
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{row.sources.length > 0 ? row.sources.join(', ') : '—'}</td>
                    <td>
                      {row.date_from && row.date_until
                        ? `${formatColomboDate(row.date_from)} – ${formatColomboDate(row.date_until)}`
                        : '—'}
                    </td>
                    <td>{row.row_count.toLocaleString('en-US')}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <div>{row.actor_name}</div>
                      <small style={{ color: 'var(--muted)' }}>{formatColomboDateTime(row.occurred_at)}</small>
                    </td>
                    <td style={{ maxWidth: 260, fontSize: 13, color: 'var(--muted)' }}>
                      {row.reason || '—'}
                    </td>
                  </TableRow>
                ))}
              </Table>
            )}
          </ContentCard>

          <section className="ym29-hero-card" style={{ minHeight: 'auto', padding: 22 }} aria-label="Data governance guardrails">
            <div className="ym29-header-row" style={{ alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <ShieldCheck size={22} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ fontSize: 16 }}>Strict CSV Import &amp; Audit Guardrails Active</strong>
                  <p style={{ marginTop: 4 }}>
                    All market uploads require preview validation with zero row errors and zero duplicate keys before publishing (max 10,000 rows per file). Every approval and rejection is logged to the immutable audit trail.
                  </p>
                </div>
              </div>
              <Link to="uploads/new">
                <Button variant="secondary">Start CSV review</Button>
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
