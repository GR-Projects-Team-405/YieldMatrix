import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/Alert';

type ApiBatch = {
  id: string;
  crop_name: string;
  farm_name: string;
  quantity_kg: string | number;
  harvest_date: string;
  status: string;
};

const STATUS_LABEL: Record<string, string> = {
  planned: 'Scheduled',
  ready: 'Pending',
  harvested: 'Completed',
  depleted: 'Completed',
  cancelled: 'Cancelled'
};

const STATUS_CLASS: Record<string, string> = {
  planned: 'scheduled',
  ready: 'pending',
  harvested: 'completed',
  depleted: 'completed',
  cancelled: 'pending'
};

const TZ = 'Asia/Colombo';
const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
  });

export default function HarvestBatchList() {
  const [batches, setBatches] = useState<ApiBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    api.get<{ batches: ApiBatch[] }>('/ym08/harvest-batches', { signal: controller.signal })
      .then(({ data }) => { if (active) setBatches(data.batches); })
      .catch(() => { if (active) setError('Could not load harvest batches.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  const stats = useMemo(() => {
    const monthKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()).slice(0, 7);
    const total = batches.reduce((sum, b) => sum + Number(b.quantity_kg), 0);
    return {
      count: batches.length,
      total,
      thisMonth: batches.filter((b) => b.harvest_date.startsWith(monthKey)).length,
      completed: batches.filter((b) => b.status === 'harvested' || b.status === 'depleted').length
    };
  }, [batches]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches.filter((b) =>
      (status === 'all' || b.status === status) &&
      (!q || b.id.toLowerCase().includes(q) || b.crop_name.toLowerCase().includes(q))
    );
  }, [batches, search, status]);

  if (loading) return <p role="status">Loading harvest batches...</p>;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="ym-harvest-page">
      <div className="ym-harvest-page-heading">
        <div>
          <h2>Harvest Batch List</h2>
          <p>View and manage your harvest batches</p>
        </div>
      </div>

      <div className="ym-harvest-stats">
        <div className="ym-harvest-list-card"><small>TOTAL BATCHES</small><h3>{stats.count}</h3></div>
        <div className="ym-harvest-list-card"><small>TOTAL QUANTITY</small><h3>{stats.total.toLocaleString('en-US', { maximumFractionDigits: 3 })} kg</h3></div>
        <div className="ym-harvest-list-card"><small>THIS MONTH</small><h3>{stats.thisMonth}</h3></div>
        <div className="ym-harvest-list-card"><small>COMPLETED</small><h3>{stats.completed}</h3></div>
      </div>

      <div className="ym-harvest-list-card">
        <div className="ym-harvest-list-toolbar">
          <div className="ym-harvest-list-title">
            <h3>All Harvest Batches</h3>
            <span>{filtered.length} batches</span>
          </div>
          <div className="ym-harvest-filters">
            <div className="ym-harvest-search">
              <input
                placeholder="Search batch or crop..."
                aria-label="Search batches"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="ym-harvest-status-filter"
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="planned">Scheduled</option>
              <option value="ready">Pending</option>
              <option value="harvested">Completed</option>
              <option value="depleted">Depleted</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {!filtered.length ? (
          <div className="ym-harvest-empty">
            <p>No harvest batches found</p>
            <span>Add a harvest batch to get started.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ym-harvest-table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Batch ID</th><th>Crop</th><th>Farm</th>
                  <th>Quantity</th><th>Harvest date</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                   <td className="ym-harvest-batch-id" title={b.id}>
  HB-{b.id.replace(/-/g, '').slice(-6).toUpperCase()}
</td>
                    <td className="ym-harvest-crop-name">{b.crop_name}</td>
                    <td>{b.farm_name}</td>
                    <td>{Number(b.quantity_kg).toLocaleString('en-US', { maximumFractionDigits: 3 })} kg</td>
                    <td>{fmtDate(b.harvest_date)}</td>
                    <td>
                      <span className={`ym-harvest-status ym-harvest-status--${STATUS_CLASS[b.status] ?? 'pending'}`}>
                        <i className="ym-harvest-status-dot" />
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="ym-harvest-actions">
                      <Link to={`/farmer/harvest-calendar/${b.id}`}>
  <button type="button">View</button>
</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}