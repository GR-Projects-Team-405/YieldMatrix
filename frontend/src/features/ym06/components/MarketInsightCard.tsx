import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Check, Clock3, History, Lightbulb, Minus, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { FarmerPriceAlert, MarketInsight } from '../ym06Api';
import { formatDate, formatLkr, getFarmerPriceAlerts, saveFarmerPriceAlert } from '../ym06Api';

const insightKey = (item: MarketInsight) => `${item.cropId}:${item.gradeId}:${item.district}`;
const priceAsLkr = (cents: string | null) => cents ? String(Math.round(Number(cents) / 100)) : '';
const alertKey = (item: FarmerPriceAlert) => `${item.crop_id}:${item.grade_id}:${item.district}`;

export default function MarketInsightCard({ insights }: { insights: MarketInsight[] }) {
  const [selected, setSelected] = useState('');
  const [alerts, setAlerts] = useState<FarmerPriceAlert[]>([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertError, setAlertError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lower, setLower] = useState('');
  const [upper, setUpper] = useState('');
  const insight = insights.find((item) => insightKey(item) === selected) || insights[0];
  const selectedKey = insight ? insightKey(insight) : '';
  const currentAlert = useMemo(() => alerts.find((item) => alertKey(item) === selectedKey && item.status === 'active') || null, [alerts, selectedKey]);
  const history = useMemo(() => alerts.filter((item) => alertKey(item) === selectedKey), [alerts, selectedKey]);
  const trendIcon = insight?.demandTrend === 'rising' ? <TrendingUp size={14}/> : insight?.demandTrend === 'falling' ? <TrendingDown size={14}/> : <Minus size={14}/>;

  useEffect(() => {
    if (!insights.some((item) => insightKey(item) === selected)) setSelected(insights[0] ? insightKey(insights[0]) : '');
  }, [insights, selected]);

  useEffect(() => {
    if (!insight) { setAlerts([]); return; }
    let cancelled = false;
    setAlertLoading(true);
    setAlertError('');
    getFarmerPriceAlerts({ cropId: insight.cropId, gradeId: insight.gradeId, district: insight.district })
      .then((result) => { if (!cancelled) setAlerts((existing) => [...existing.filter((item) => alertKey(item) !== selectedKey), ...result.history]); })
      .catch(() => { if (!cancelled) setAlertError('Price alerts could not be loaded.'); })
      .finally(() => { if (!cancelled) setAlertLoading(false); });
    return () => { cancelled = true; };
  }, [selectedKey]);

  useEffect(() => {
    setLower(currentAlert ? priceAsLkr(currentAlert.lower_price_cents) : '');
    setUpper(currentAlert ? priceAsLkr(currentAlert.upper_price_cents) : '');
  }, [selectedKey, currentAlert?.id]);

  const saveAlert = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!insight) return;
    const lowerLkr = Number(lower);
    const upperLkr = Number(upper);
    if (!Number.isFinite(lowerLkr) || !Number.isFinite(upperLkr) || lowerLkr < 0 || upperLkr <= lowerLkr) {
      setSaveError('Enter a lower threshold and a higher upper threshold.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const saved = await saveFarmerPriceAlert({ cropId: insight.cropId, gradeId: insight.gradeId, district: insight.district, lowerPriceCents: Math.round(lowerLkr * 100), upperPriceCents: Math.round(upperLkr * 100) });
      setAlerts((existing) => [saved, ...existing.filter((item) => item.id !== saved.id).map((item) => alertKey(item) === selectedKey && item.status === 'active' ? { ...item, status: 'replaced' as const } : item)]);
      setEditorOpen(false);
    } catch {
      setSaveError('Could not save this price alert. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <section className="ym06-panel ym06-insight-card">
      <div className="ym06-insight-top"><div className="ym06-insight-heading"><span className="ym06-insight-icon"><Sparkles size={17}/></span><div><h3>Farmer AI Insight</h3><p>Connected to Market Insights</p></div></div>
        {insight && <div className="ym06-insight-actions"><button type="button" onClick={() => setHistoryOpen(true)}><History size={13}/> Alert history</button><button className="primary" type="button" onClick={() => { setSaveError(''); setEditorOpen(true); }}><Bell size={13}/> {currentAlert ? 'Edit price alert' : 'Set price alert'}</button><span className="ym06-insight-source">{insight.includesSampleData ? 'DEMO DATA' : 'LOCAL DATA'}</span></div>}
      </div>
      {!insight ? <div className="ym06-insight-empty"><Lightbulb size={22}/><p>Recent local market data is not available yet.</p><small>Insights appear after observations have been added for your farm districts.</small><Link to="/farmer/market-insights">View market insights <ArrowRight size={14}/></Link></div> : <div className="ym06-insight-content">
        {insights.length > 1 && <div className="ym06-insight-tabs" role="tablist" aria-label="Crop market insights">{insights.map((item) => { const key = insightKey(item); return <button type="button" role="tab" aria-selected={selectedKey === key} className={selectedKey === key ? 'active' : ''} key={key} onClick={() => setSelected(key)}>{item.crop} ({item.grade})</button>; })}</div>}
        <div className="ym06-insight-data-card"><div className="ym06-insight-produce"><span><strong>{insight.crop}</strong> Â· {insight.grade}</span><span className="ym06-insight-location">{insight.district} benchmark</span></div>
          <div className={`ym06-trend-pill ym06-trend-${insight.demandTrend}`}>{trendIcon}<span>{insight.demandTrend === 'insufficient_data' ? 'Not enough data' : `${insight.demandTrend}${insight.changePercent !== null ? ` (${insight.changePercent > 0 ? '+' : ''}${insight.changePercent}%)` : ''}`}</span></div>
          <div className="ym06-insight-price"><small>Suggested price range</small><strong>{insight.suggestedPriceLowCents && insight.suggestedPriceHighCents ? `${formatLkr(insight.suggestedPriceLowCents)} – ${formatLkr(insight.suggestedPriceHighCents)}` : 'Not enough price data'}<span>/ kg</span></strong><div className="ym06-insight-current"><span>Current platform avg: <strong>{insight.averagePriceCents ? `${formatLkr(insight.averagePriceCents)} / kg` : 'Not available'}</strong></span>{alertLoading ? <span className="threshold-loading">Loading threshold…</span> : currentAlert ? <span className={`threshold-pill ${currentAlert.price_state}`}><i/>Alerts: &lt; {formatLkr(currentAlert.lower_price_cents)} or &gt; {formatLkr(currentAlert.upper_price_cents)} / kg · {currentAlert.price_state === 'within' ? 'within range' : currentAlert.price_state === 'unknown' ? 'price unavailable' : currentAlert.price_state === 'below' ? 'below lower limit' : 'above upper limit'}</span> : <button className="threshold-empty" type="button" onClick={() => setEditorOpen(true)}>{alertError || 'Set price thresholds'}</button>}</div></div>
        </div>
        <div className="ym06-insight-reason"><strong>Why this recommendation</strong><p>{insight.reason}</p></div>
        <small className="ym06-insight-disclaimer">Advisory only. This recommendation does not change your listing prices automatically.</small>
        <div className="ym06-insight-footer"><Link to={`/farmer/market-insights?crop=${encodeURIComponent(insight.cropId)}&grade=${encodeURIComponent(insight.gradeId)}`}>View market insights <ArrowRight size={14}/></Link><button type="button" onClick={() => { setSaveError(''); setEditorOpen(true); }}>Set alert thresholds <Bell size={13}/></button><span>{insight.observedThrough ? `Market data through ${formatDate(insight.observedThrough, { day: '2-digit', month: 'short' })}` : 'Market data update pending'}</span></div>
      </div>}
    </section>

    {editorOpen && insight && <div className="ym06-alert-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}><section className="ym06-alert-dialog" role="dialog" aria-modal="true" aria-labelledby="ym06-alert-title"><header><div><span className="ym06-alert-dialog-icon"><Bell size={17}/></span><div><h3 id="ym06-alert-title">Set price alert</h3><p>{insight.crop} Â· {insight.grade} Â· {insight.district}</p></div></div><button type="button" aria-label="Close dialog" onClick={() => setEditorOpen(false)}><X size={17}/></button></header><form onSubmit={saveAlert}><p className="ym06-alert-help">Save the price range you want to monitor for this crop and district.</p><label>Alert when price drops below <span className="ym06-money-input"><span>LKR</span><input type="number" min="0" step="1" value={lower} onChange={(event) => setLower(event.target.value)} required/></span></label><label>Alert when price rises above <span className="ym06-money-input"><span>LKR</span><input type="number" min="0" step="1" value={upper} onChange={(event) => setUpper(event.target.value)} required/></span></label>{saveError && <p className="ym06-alert-error" role="alert">{saveError}</p>}<div className="ym06-alert-dialog-actions"><button type="button" onClick={() => setEditorOpen(false)}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving ? 'Savingâ€¦' : currentAlert ? 'Update alert' : 'Save alert'}</button></div></form></section></div>}

    {historyOpen && insight && <div className="ym06-alert-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}><section className="ym06-alert-dialog ym06-alert-history" role="dialog" aria-modal="true" aria-labelledby="ym06-alert-history-title"><header><div><span className="ym06-alert-dialog-icon"><History size={17}/></span><div><h3 id="ym06-alert-history-title">Alert history</h3><p>{insight.crop} Â· {insight.grade} Â· {insight.district}</p></div></div><button type="button" aria-label="Close dialog" onClick={() => setHistoryOpen(false)}><X size={17}/></button></header>{alertError && <p className="ym06-alert-error" role="alert">{alertError}</p>}{alertLoading ? <p className="ym06-alert-empty">Loading price alertsâ€¦</p> : history.length ? <ul>{history.map((item) => <li key={item.id}><span className={`ym06-alert-history-state ${item.status}`}>{item.status === 'active' ? <Check size={12}/> : item.status === 'replaced' ? <ArrowDownRight size={12}/> : <Minus size={12}/>} {item.status}</span><div><strong>Below {formatLkr(item.lower_price_cents)} or above {formatLkr(item.upper_price_cents)} / kg</strong><small>{formatDate(item.created_at)}{item.status === 'replaced' ? ' Â· Replaced by a newer threshold' : ''}</small></div></li>)}</ul> : <p className="ym06-alert-empty"><Clock3 size={17}/> No alert history for this crop and district yet.</p>}<footer><button type="button" className="primary" onClick={() => { setHistoryOpen(false); setSaveError(''); setEditorOpen(true); }}>{currentAlert ? 'Edit thresholds' : 'Set first alert'} <ArrowUpRight size={14}/></button></footer></section></div>}
  </>;
}
