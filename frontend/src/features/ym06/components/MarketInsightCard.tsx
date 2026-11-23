import { ArrowRight, ArrowUpRight, Lightbulb, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../../components/StatusBadge';
import type { MarketInsight } from '../ym06Api';
import { formatLkr } from '../ym06Api';

export default function MarketInsightCard({ insights }: { insights: MarketInsight[] }) {
  const insight = insights[0];
  return <section className="ym06-panel ym06-insight-card">
    <div className="ym06-panel-heading"><div><span className="ym06-insight-icon"><Lightbulb size={17}/></span><div><h3>Farmer AI insight</h3><p>Demand and pricing signals near your farms</p></div></div><Link className="ym06-inline-link" to="/farmer/market-insights">Market insights <ArrowUpRight size={14}/></Link></div>
    {!insight ? <div className="ym06-insight-empty"><Lightbulb size={22}/><p>Recent local market data is not available yet.</p><small>Insights appear after observations have been added for your farm districts.</small><Link to="/farmer/market-insights">Open market insights <ArrowRight size={14}/></Link></div> : <div className="ym06-insight-content">
      <div className="ym06-insight-produce"><span><strong>{insight.crop}</strong> · {insight.grade}</span><span className="ym06-insight-location">{insight.district}</span></div>
      <div className="ym06-insight-metrics"><div><small>Demand trend</small><span className="ym06-trend-value">{insight.demandTrend === 'rising' ? <TrendingUp size={16}/> : insight.demandTrend === 'falling' ? <TrendingDown size={16}/> : <Minus size={16}/>} {insight.demandTrend.replace('_', ' ')}{insight.changePercent !== null && ` · ${insight.changePercent > 0 ? '+' : ''}${insight.changePercent}%`}</span></div><div><small>Suggested price range</small><strong>{insight.suggestedPriceLowCents && insight.suggestedPriceHighCents ? `${formatLkr(insight.suggestedPriceLowCents)} – ${formatLkr(insight.suggestedPriceHighCents)} / kg` : 'Not enough price data'}</strong></div></div>
      <p className="ym06-insight-reason">{insight.reason}</p>
      <div className="ym06-insight-footer"><StatusBadge status={insight.includesSampleData ? 'Sample data included' : `${insight.observationCount} observations`}/><span>Through {insight.observedThrough ? new Intl.DateTimeFormat('en-LK', { day: '2-digit', month: 'short' }).format(new Date(`${insight.observedThrough}T12:00:00`)) : '—'}</span><Link to={`/farmer/market-insights?crop=${encodeURIComponent(insight.cropId)}&grade=${encodeURIComponent(insight.gradeId)}`}>View analysis <ArrowRight size={14}/></Link></div>
      <small className="ym06-insight-disclaimer">A data-based guide from recent market observations, not a guaranteed price.</small>
    </div>}
  </section>;
}
