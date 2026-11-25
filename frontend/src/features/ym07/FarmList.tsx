import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Table, TableRow } from '../../components/Table';
import { Toast } from '../../components/Toast';
import api from '../../services/api';
import styles from './farms.module.css';

interface FarmListResponse {
  farms: { id: string; name: string; district: string; status: 'active' | 'inactive' }[];
  summary: { total: number; active: number; archived: number; districts: number };
  pagination: { totalPages: number };
}

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Archived' },
];

export default function FarmList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<FarmListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (typeof location.state?.farmNotice === 'string') {
      setNotice(location.state.farmNotice);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setFailed(false);

    api.get<FarmListResponse>('/ym07/farms', {
      signal: controller.signal,
      params: { page, limit: 20, search: search.trim() || undefined, status: status || undefined },
    }).then(({ data }) => {
      if (active) setData(data);
    }).catch(() => {
      if (active) setFailed(true);
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [page, search, status, attempt]);

  const hasFilters = Boolean(search.trim() || status);
  const addFarm = <Link className="ym-button ym-button--primary" to="new">Add farm</Link>;

  return (
    <section className={styles.page} aria-label="My farms">
      <div className={styles.detailHeader}><h1 className={styles.heading}>My farms</h1>{addFarm}</div>
      {data && (
        <div className={styles.stats}>
          <StatCard label="My farms" value={data.summary.total} />
          <StatCard label="Active farms" value={data.summary.active} />
          <StatCard label="Archived" value={data.summary.archived} />
          <StatCard label="Districts" value={data.summary.districts} />
        </div>
      )}
      <div className={styles.banner}>
        <div>
          <h2>Your farms. Every harvest starts here.</h2>
          <p>Manage your locations and keep every batch linked to its origin.</p>
        </div>
        <span className={styles.landscape} aria-hidden="true" />
      </div>
      <div className={styles.filters}>
        <InputField label="Search farms" type="search" placeholder="Search name or district" maxLength={120} value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <SelectField label="Status filter" options={statusOptions} value={status}
          onChange={(event) => { setStatus(event.target.value); setPage(1); }} />
      </div>
      <div className={styles.results} aria-busy={loading}>
        {loading && <p role="status">Loading farms…</p>}
        {!loading && failed && (
          <>
            <Alert type="error">Unable to load farms. Check your connection and try again.</Alert>
            <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry</Button>
          </>
        )}
        {!loading && !failed && data && (
          <>
            {data.farms.length > 0 ? (
              <ContentCard className={styles.tableCard}>
                <Table headers={['Farm name', 'District', 'Status', 'Action']}>
                  {data.farms.map((farm) => (
                    <TableRow key={farm.id}>
                      <td><strong>{farm.name}</strong></td>
                      <td>{farm.district}</td>
                      <td><StatusBadge status={farm.status === 'active' ? 'Active' : 'Archived'} /></td>
                      <td><Link className="ym-button ym-button--outline" to={farm.id} aria-label={`View farm ${farm.name}`}>View farm <ArrowRight size={16} aria-hidden="true" /></Link></td>
                    </TableRow>
                  ))}
                </Table>
              </ContentCard>
            ) : (
              <EmptyState title={hasFilters ? 'No farms match your filters' : page > 1 ? 'No farms on this page' : 'No farms yet'}
                description={hasFilters ? 'Try another search or clear the filters.' : page > 1 ? 'Return to the previous page.' : 'Add a farm to get started.'}
                action={hasFilters
                  ? <Button variant="outline" onClick={() => { setSearch(''); setStatus(''); setPage(1); }}>Clear filters</Button>
                  : page === 1 ? addFarm : undefined} />
            )}
            {(data.pagination.totalPages > 1 || page > 1) && (
              <nav className={styles.pagination} aria-label="Farm list pages">
                <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <span>Page {page}{data.pagination.totalPages >= page ? ` of ${data.pagination.totalPages}` : ''}</span>
                <Button variant="outline" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </nav>
            )}
          </>
        )}
      </div>
      {notice && <Toast message={notice} onClose={() => setNotice('')} />}
    </section>
  );
}
