import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  List,
  RefreshCw,
  Search,
  ShieldCheck,
  Sprout,
} from 'lucide-react';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { SelectField } from '../../components/SelectField';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Table, TableRow } from '../../components/Table';
import { MarketplaceSubnav } from './ProduceCard';
import type { HarvestAvailabilityEntry, HarvestAvailabilityResponse } from './types';
import { formatColomboShortDate, formatKg, formatPaddedCount } from './utils';
import './ym11.css';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getCurrentColomboMonth(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatMonthTitle(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 15));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function buildCalendarCells(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  const firstDay = new Date(Date.UTC(y, m - 1, 1));
  const startDow = firstDay.getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prevMonthDays = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();

  const cells: { dateStr: string; dayNum: number; inMonth: boolean }[] = [];

  for (let i = startDow - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const prev = shiftMonth(monthStr, -1);
    cells.push({
      dateStr: `${prev}-${String(dayNum).padStart(2, '0')}`,
      dayNum,
      inMonth: false,
    });
  }

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    cells.push({
      dateStr: `${monthStr}-${String(dayNum).padStart(2, '0')}`,
      dayNum,
      inMonth: true,
    });
  }

  const remaining = (7 - (cells.length % 7)) % 7;
  const next = shiftMonth(monthStr, 1);
  for (let dayNum = 1; dayNum <= remaining; dayNum++) {
    cells.push({
      dateStr: `${next}-${String(dayNum).padStart(2, '0')}`,
      dayNum,
      inMonth: false,
    });
  }

  return cells;
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export default function HarvestAvailabilityPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState<HarvestAvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [month, setMonth] = useState(searchParams.get('month') || getCurrentColomboMonth());
  const [cropId, setCropId] = useState(searchParams.get('cropId') || '');
  const [district, setDistrict] = useState(searchParams.get('district') || '');
  const [gradeId, setGradeId] = useState(searchParams.get('gradeId') || '');
  const [status, setStatus] = useState<'all' | 'available_now' | 'planned'>(
    (searchParams.get('status') as 'all' | 'available_now' | 'planned') || 'all'
  );
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const paramsKey = searchParams.toString();

  const fetchAvailability = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const params: Record<string, string> = {};
        const currentMonth = searchParams.get('month') || getCurrentColomboMonth();
        params.month = currentMonth;
        if (searchParams.get('cropId')) params.cropId = searchParams.get('cropId') || '';
        if (searchParams.get('gradeId')) params.gradeId = searchParams.get('gradeId') || '';
        if (searchParams.get('district')) params.district = searchParams.get('district') || '';
        if (searchParams.get('status')) params.status = searchParams.get('status') || '';

        const response = await api.get<HarvestAvailabilityResponse>(
          '/ym11/marketplace/harvest-availability',
          { params, signal }
        );
        setData(response.data);

        const datesWithItems = Object.keys(response.data.calendarDays).sort();
        setSelectedDate((prev) => {
          if (prev && prev.startsWith(response.data.month)) return prev;
          return datesWithItems[0] || response.data.monthStart;
        });
      } catch (err) {
        if ((err as { name?: string })?.name === 'CanceledError') return;
        setError('Could not load harvest availability data. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paramsKey]
  );

  useEffect(() => {
    setMonth(searchParams.get('month') || getCurrentColomboMonth());
    setCropId(searchParams.get('cropId') || '');
    setDistrict(searchParams.get('district') || '');
    setGradeId(searchParams.get('gradeId') || '');
    setStatus((searchParams.get('status') as 'all' | 'available_now' | 'planned') || 'all');
  }, [paramsKey, searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAvailability(controller.signal);
    return () => controller.abort();
  }, [fetchAvailability]);

  function applyQuery(overrides?: { month?: string; status?: 'all' | 'available_now' | 'planned' }) {
    const next = new URLSearchParams();
    const targetMonth = overrides?.month ?? month;
    if (targetMonth) next.set('month', targetMonth);
    if (cropId) next.set('cropId', cropId);
    if (district) next.set('district', district);
    if (gradeId) next.set('gradeId', gradeId);
    const targetStatus = overrides?.status ?? status;
    if (targetStatus && targetStatus !== 'all') next.set('status', targetStatus);
    setSearchParams(next);
  }

  function handleFilterSubmit(e: FormEvent) {
    e.preventDefault();
    applyQuery();
  }

  function handleMonthShift(delta: number) {
    const nextMonth = shiftMonth(month, delta);
    setMonth(nextMonth);
    applyQuery({ month: nextMonth });
  }

  function handleExportCsv() {
    if (!data || data.entries.length === 0) return;
    const headers = [
      'Crop',
      'Grade',
      'Supplier',
      'District',
      'Quantity (kg)',
      'Availability Date',
      'Status',
    ];
    const rows = data.entries.map((entry) => [
      entry.cropName,
      entry.gradeName,
      entry.farmName,
      entry.district,
      String(entry.quantityKg),
      entry.availabilityDate || '',
      entry.availabilityStatus === 'available_now' ? 'Available now' : 'Expected harvest',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yieldmatrix-harvest-availability-${data.month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const calendarCells = useMemo(() => buildCalendarCells(data?.month || month), [data?.month, month]);

  const monthOptions = useMemo(() => {
    const base = getCurrentColomboMonth();
    const list: string[] = [];
    for (let i = -2; i <= 5; i++) {
      list.push(shiftMonth(base, i));
    }
    if (!list.includes(month)) list.push(month);
    list.sort();
    return list.map((m) => ({ value: m, label: formatMonthTitle(m) }));
  }, [month]);

  const selectedEntries: HarvestAvailabilityEntry[] = useMemo(() => {
    if (!data || !selectedDate) return [];
    return data.calendarDays[selectedDate] || [];
  }, [data, selectedDate]);

  const selectedDayNum = selectedDate ? Number(selectedDate.split('-')[2]) : 1;

  return (
    <div className="ym11-overview">
      <section className="ym11-header" aria-label="Harvest availability heading">
        <div>
          <p className="ym11-eyebrow">Supply timeline</p>
          <h2 className="ym11-greeting">Harvest Availability</h2>
          <p className="ym11-subtitle">
            Explore available stock and plan purchases around upcoming harvests.
          </p>
        </div>
      </section>

      <MarketplaceSubnav />

      {/* Filter Bar */}
      <ContentCard>
        <form className="ym11-avail-filters" onSubmit={handleFilterSubmit}>
          <SelectField
            label="Crop"
            value={cropId}
            options={[
              { value: '', label: 'All crops' },
              ...(data?.filters.crops || []).map((c) => ({ value: c.id, label: c.name })),
            ]}
            onChange={(e) => setCropId(e.target.value)}
          />
          <SelectField
            label="District"
            value={district}
            options={[
              { value: '', label: 'All districts' },
              ...(data?.filters.districts || []).map((d) => ({ value: d, label: d })),
            ]}
            onChange={(e) => setDistrict(e.target.value)}
          />
          <SelectField
            label="Grade"
            value={gradeId}
            options={[
              { value: '', label: 'All grades' },
              ...(data?.filters.grades || []).map((g) => ({ value: g.id, label: g.name })),
            ]}
            onChange={(e) => setGradeId(e.target.value)}
          />
          <SelectField
            label="Month"
            value={month}
            options={monthOptions}
            onChange={(e) => setMonth(e.target.value)}
          />
          <SelectField
            label="Availability status"
            value={status}
            options={[
              { value: 'all', label: 'All availability' },
              { value: 'available_now', label: 'Available now' },
              { value: 'planned', label: 'Expected harvest' },
            ]}
            onChange={(e) => setStatus(e.target.value as 'all' | 'available_now' | 'planned')}
          />
          <Button type="submit" variant="primary">
            <Search size={15} aria-hidden="true" />
            Search
          </Button>
        </form>
      </ContentCard>

      {loading ? (
        <ContentCard>
          <div className="ym11-loading-card" role="status">
            <RefreshCw size={18} aria-hidden="true" />
            <span>Loading harvest availability…</span>
          </div>
        </ContentCard>
      ) : error || !data ? (
        <ContentCard title="Harvest availability unavailable">
          <div className="ym11-error-box">
            <Alert type="error">{error || 'Unable to load harvest availability.'}</Alert>
            <Button variant="outline" onClick={() => void fetchAvailability()}>
              <RefreshCw size={15} aria-hidden="true" />
              Retry
            </Button>
          </div>
        </ContentCard>
      ) : (
        <>
          {/* 3 KPI Cards */}
          <section className="ym11-kpi-grid ym11-kpi-grid--three" aria-label="Availability metrics">
            <div className="ym11-kpi-wrap">
              <StatCard
                label="Available now"
                value={formatKg(data.summary.availableNowKg)}
                subtext="Harvested and available for immediate orders."
              />
              <span className="ym11-kpi-icon ym11-kpi-icon--green" aria-hidden="true">
                <CheckCircle2 size={18} />
              </span>
            </div>

            <div className="ym11-kpi-wrap">
              <StatCard
                label="Upcoming harvests"
                value={formatKg(data.summary.upcoming30DaysKg)}
                subtext="Expected quantity within the next 30 days."
              />
              <span className="ym11-kpi-icon ym11-kpi-icon--warm" aria-hidden="true">
                <Sprout size={18} />
              </span>
            </div>

            <div className="ym11-kpi-wrap">
              <StatCard
                label="Active suppliers"
                value={formatPaddedCount(data.summary.activeSuppliersCount)}
                subtext="Approved farms with matching stock or plans."
              />
              <span className="ym11-kpi-icon ym11-kpi-icon--green" aria-hidden="true">
                <ShieldCheck size={18} />
              </span>
            </div>
          </section>

          {/* Calendar + Selected Date Inspector */}
          <section className="ym11-calendar-layout" aria-label="Harvest calendar and date details">
            <ContentCard>
              <div className="ym11-cal-toolbar">
                <div>
                  <h3 className="ym11-card-title">Harvest Calendar</h3>
                  <p className="ym11-card-sub">
                    See when agricultural products are available for purchase.
                  </p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  <div className="ym11-cal-nav">
                    <Button
                      variant="outline"
                      className="ym11-row-action"
                      aria-label="Previous month"
                      onClick={() => handleMonthShift(-1)}
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                    </Button>
                    <span className="ym11-cal-month-label">{formatMonthTitle(data.month)}</span>
                    <Button
                      variant="outline"
                      className="ym11-row-action"
                      aria-label="Next month"
                      onClick={() => handleMonthShift(1)}
                    >
                      <ChevronRight size={16} aria-hidden="true" />
                    </Button>
                  </div>

                  <div className="ym11-view-toggle" role="group" aria-label="Calendar view toggle">
                    <button
                      type="button"
                      className={viewMode === 'calendar' ? 'is-active' : ''}
                      onClick={() => setViewMode('calendar')}
                    >
                      <CalendarDays size={13} aria-hidden="true" />
                      Calendar
                    </button>
                    <button
                      type="button"
                      className={viewMode === 'list' ? 'is-active' : ''}
                      onClick={() => setViewMode('list')}
                    >
                      <List size={13} aria-hidden="true" />
                      List
                    </button>
                  </div>
                </div>
              </div>

              {viewMode === 'calendar' ? (
                <>
                  <div className="ym11-cal-grid" role="grid" aria-label={`Harvest calendar for ${formatMonthTitle(data.month)}`}>
                    {DOW_LABELS.map((dow) => (
                      <div className="ym11-cal-dow" key={dow}>
                        {dow}
                      </div>
                    ))}
                    {calendarCells.map((cell) => {
                      const items = cell.inMonth ? data.calendarDays[cell.dateStr] || [] : [];
                      const isSelected = cell.inMonth && selectedDate === cell.dateStr;
                      return (
                        <button
                          type="button"
                          key={cell.dateStr}
                          disabled={!cell.inMonth}
                          className={`ym11-cal-cell ${!cell.inMonth ? 'is-outside' : ''} ${
                            isSelected ? 'is-selected' : ''
                          }`}
                          onClick={() => setSelectedDate(cell.dateStr)}
                        >
                          <span className="ym11-cal-day-num">{cell.dayNum}</span>
                          {items.slice(0, 2).map((item) => (
                            <span
                              key={item.id}
                              className={`ym11-cal-pill ${
                                item.availabilityStatus === 'available_now'
                                  ? 'ym11-cal-pill--now'
                                  : 'ym11-cal-pill--planned'
                              }`}
                              title={`${item.cropName} · ${formatKg(item.quantityKg)} (${item.farmName})`}
                            >
                              {item.cropName} {formatKg(item.quantityKg)}
                            </span>
                          ))}
                          {items.length > 2 && (
                            <span className="ym11-grower-price">+{items.length - 2} more</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="ym11-cal-legend">
                    <span className="ym11-seg-legend-item">
                      <span className="ym11-dot ym11-seg-0" aria-hidden="true" />
                      Harvested stock (Available now)
                    </span>
                    <span className="ym11-seg-legend-item">
                      <span className="ym11-dot ym11-seg-2" aria-hidden="true" />
                      Planned future harvest
                    </span>
                  </div>
                </>
              ) : (
                <div className="ym11-grower-list">
                  {Object.keys(data.calendarDays).length === 0 ? (
                    <EmptyState
                      title="No harvests scheduled in this month"
                      description="Use the month switcher above or adjust filters to inspect other dates."
                    />
                  ) : (
                    Object.entries(data.calendarDays)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([dateKey, entries]) => (
                        <div className="ym11-grower-row" key={dateKey}>
                          <div>
                            <p className="ym11-grower-name">{formatColomboShortDate(dateKey)}</p>
                            <p className="ym11-grower-detail">
                              {entries.map((e) => `${e.cropName} (${formatKg(e.quantityKg)})`).join(' · ')}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            style={{ height: 36, padding: '0 12px', fontSize: 12 }}
                            onClick={() => setSelectedDate(dateKey)}
                          >
                            Inspect
                          </Button>
                        </div>
                      ))
                  )}
                </div>
              )}
            </ContentCard>

            {/* Right Selected Date Panel */}
            <ContentCard>
              <div className="ym11-selected-date-head">
                <span className="ym11-date-box">{String(selectedDayNum).padStart(2, '0')}</span>
                <div>
                  <p className="ym11-eyebrow" style={{ marginBottom: 2 }}>
                    Selected date
                  </p>
                  <h3 className="ym11-card-title" style={{ fontSize: 16 }}>
                    {selectedDate ? formatColomboShortDate(selectedDate) : formatMonthTitle(data.month)}
                  </h3>
                </div>
              </div>

              {selectedEntries.length === 0 ? (
                <EmptyState
                  title="No availability recorded"
                  description="Select a highlighted date on the calendar to inspect its harvest details and supplier quantities."
                />
              ) : (
                <div className="ym11-detail-stack">
                  {selectedEntries.map((entry) => (
                    <div className="ym11-detail-card" key={entry.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 14, color: 'var(--text)' }}>{entry.cropName}</strong>
                        <StatusBadge
                          status={entry.availabilityStatus === 'available_now' ? 'Active' : 'Pending'}
                        />
                      </div>

                      <div className="ym11-kv-list">
                        <div className="ym11-kv-row">
                          <span>Grade</span>
                          <strong>{entry.gradeName}</strong>
                        </div>
                        <div className="ym11-kv-row">
                          <span>Supplier</span>
                          <strong>{entry.farmName}</strong>
                        </div>
                        <div className="ym11-kv-row">
                          <span>District</span>
                          <strong>{entry.district}</strong>
                        </div>
                        <div className="ym11-kv-row">
                          <span>{entry.availabilityStatus === 'available_now' ? 'Available quantity' : 'Expected quantity'}</span>
                          <strong>{formatKg(entry.quantityKg)}</strong>
                        </div>
                        <div className="ym11-kv-row">
                          <span>Availability date</span>
                          <strong>{formatColomboShortDate(entry.availabilityDate)}</strong>
                        </div>
                      </div>

                      <Button
                        variant="primary"
                        style={{ width: '100%', height: 40, fontSize: 13 }}
                        onClick={() =>
                          navigate(
                            `/buyer/produce?batchId=${encodeURIComponent(entry.batchId)}${
                              entry.listingId ? `&listingId=${encodeURIComponent(entry.listingId)}` : ''
                            }`
                          )
                        }
                      >
                        View details
                        <ArrowRight size={14} aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <p className="ym11-advisory-foot">
                Expected harvest quantities may change before the stock is ready to sell.
              </p>
            </ContentCard>
          </section>

          {/* Harvest Availability Overview Table */}
          <ContentCard>
            <div className="ym11-table-head">
              <div>
                <h3 className="ym11-card-title">Harvest Availability Overview</h3>
                <p className="ym11-card-sub">
                  Current and planned supply across matching growers ({data.entries.length} records).
                </p>
              </div>
              <Button
                variant="outline"
                disabled={data.entries.length === 0}
                onClick={handleExportCsv}
                style={{ height: 40, padding: '0 14px', fontSize: 13 }}
              >
                <Download size={14} aria-hidden="true" />
                Export overview
              </Button>
            </div>

            {data.entries.length === 0 ? (
              <EmptyState
                title="No harvest availability entries"
                description="Try clearing a filter or create a buyer demand so growers can offer matching supply."
                action={
                  <Button variant="primary" onClick={() => navigate('/buyer/demands')}>
                    Create demand
                  </Button>
                }
              />
            ) : (
              <Table
                headers={[
                  'Crop',
                  'Grade',
                  'Farmer / Supplier',
                  'District',
                  'Quantity',
                  'Availability Date',
                  'Status',
                  'Action',
                ]}
              >
                {data.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <td>
                      <strong>{entry.cropName}</strong>
                    </td>
                    <td>{entry.gradeName}</td>
                    <td>{entry.farmName}</td>
                    <td>{entry.district}</td>
                    <td>
                      <strong>{formatKg(entry.quantityKg)}</strong>
                    </td>
                    <td>{formatColomboShortDate(entry.availabilityDate)}</td>
                    <td>
                      <StatusBadge
                        status={entry.availabilityStatus === 'available_now' ? 'Active' : 'Pending'}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ym11-inline-link"
                        style={{ marginTop: 0, background: 'none', border: 0 }}
                        onClick={() =>
                          navigate(
                            `/buyer/produce?batchId=${encodeURIComponent(entry.batchId)}${
                              entry.listingId ? `&listingId=${encodeURIComponent(entry.listingId)}` : ''
                            }`
                          )
                        }
                      >
                        {entry.availabilityStatus === 'available_now' ? 'View details' : 'View availability'}
                        <ArrowRight size={13} aria-hidden="true" />
                      </button>
                    </td>
                  </TableRow>
                ))}
              </Table>
            )}
          </ContentCard>

          {/* Bottom Plan-Ahead CTA */}
          <section className="ym11-cta-banner ym11-cta-banner--warm" aria-label="Plan ahead with future harvests">
            <div className="ym11-cta-left">
              <span className="ym11-cta-badge" aria-hidden="true">
                <Sprout size={22} />
              </span>
              <div>
                <h3 className="ym11-card-title">Plan ahead with future harvests.</h3>
                <p className="ym11-card-sub">
                  Explore expected harvest dates and prepare future purchasing requests or commitments.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => {
                setStatus('planned');
                applyQuery({ status: 'planned' });
              }}
            >
              Explore upcoming harvests
              <ArrowRight size={15} aria-hidden="true" />
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
