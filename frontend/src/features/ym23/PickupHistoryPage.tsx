import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, PackageCheck, Truck, CircleAlert, Weight } from 'lucide-react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Table, TableRow } from '../../components/Table';
import api from '../../services/api';

type PickupProgress = 'completed' | 'partially-collected';
type PickupStopStatus = 'pending' | 'picked_up' | 'exception';
type ResultFilter = 'all' | PickupProgress;

interface PickupHistoryRecord {
  eventId: string;
  occurredAt: string;
  quantityKg: number;
  cumulativePickedUpKg: number;
  farmName: string;
  pickupAddress: string;
  district: string;
  farmerName: string;
  cropType: string;
  orderId: string;
  tripId: string;
  stopId: string | null;
  stopSequence: number | null;
  committedKg: number;
  currentStopStatus: PickupStopStatus | null;
}

interface PickupHistoryResponse {
  records: PickupHistoryRecord[];
  requestId: string;
}

const resultOptions = [
  { value: 'all', label: 'All Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'partially-collected', label: 'Partially Collected' },
];

function getCollectionProgress(record: PickupHistoryRecord): PickupProgress {
  return Math.round(record.cumulativePickedUpKg * 1000) >= Math.round(record.committedKg * 1000)
    ? 'completed'
    : 'partially-collected';
}

function progressLabel(progress: PickupProgress) {
  return progress === 'partially-collected' ? 'Partially Collected' : 'Completed';
}

function currentStopStatusLabel(status: PickupStopStatus | null) {
  if (status === 'picked_up') return 'Picked Up';
  if (status === 'exception') return 'Exception';
  if (status === 'pending') return 'Pending';
  return 'Unavailable';
}

function formatQuantity(quantity: number) {
  return `${quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg`;
}

function getPickupDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: 'Unavailable', time: 'Unavailable', dateKey: '' };
  }

  const pad = (part: number) => String(part).padStart(2, '0');
  return {
    date: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date),
    dateKey: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
  };
}

function getApiErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = error.response;
    if (response && typeof response === 'object' && 'data' in response) {
      const data = response.data;
      if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
        return data.error;
      }
    }
  }
  return 'Unable to load pickup history. Check your connection and try again.';
}

export default function PickupHistoryPage() {
  const [records, setRecords] = useState<PickupHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<PickupHistoryRecord | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    api.get<PickupHistoryResponse>('/ym23/pickup-history', { signal: controller.signal })
      .then(({ data }) => {
        if (!Array.isArray(data.records)) throw new Error('Invalid pickup history response');
        setRecords(data.records);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selectedRecord && !dialog.open) dialog.showModal();
    if (!selectedRecord && dialog.open) dialog.close();
  }, [selectedRecord]);

  const totalPickups = records.length;
  const completedPickups = records.filter((record) => getCollectionProgress(record) === 'completed').length;
  const partialPickups = records.filter((record) => getCollectionProgress(record) === 'partially-collected').length;
  const exceptionStopCount = new Set(
    records
      .filter((record) => record.currentStopStatus === 'exception' && record.stopId)
      .map((record) => record.stopId),
  ).size;
  const totalCollected = records.reduce((total, record) => total + record.quantityKg, 0);

  const visibleRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((record) => {
      const searchValues = [
        record.eventId,
        record.farmName,
        record.pickupAddress,
        record.district,
        record.farmerName,
        record.cropType,
        record.orderId,
        record.tripId,
        record.stopId ?? '',
        String(record.stopSequence ?? ''),
        currentStopStatusLabel(record.currentStopStatus),
        progressLabel(getCollectionProgress(record)),
      ];
      const matchesSearch = !normalizedQuery
        || searchValues.some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesResult = resultFilter === 'all' || getCollectionProgress(record) === resultFilter;
      const matchesDate = !dateFilter || getPickupDateTime(record.occurredAt).dateKey === dateFilter;
      return matchesSearch && matchesResult && matchesDate;
    });
  }, [query, resultFilter, dateFilter, records]);

  function clearFilters() {
    setQuery('');
    setResultFilter('all');
    setDateFilter('');
  }

  return (
    <div className="ym23-history-page">
      <header className="ym23-history-header">
        <div>
          <h2>Pickup History</h2>
          <p>View successful pickup events recorded by your driver account.</p>
        </div>
        <Link className="ym-button ym-button--outline ym23-history-back" to="/driver/pickups">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Pickup Stops
        </Link>
      </header>

      {loading ? (
        <Alert type="info">Loading pickup history...</Alert>
      ) : error ? (
        <div>
          <Alert type="error">{error}</Alert>
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>Retry</Button>
        </div>
      ) : (
        <>
          <Alert type="info">
            Each row is a successful pickup event. Current stop status is shown separately; exception-only stops without a pickup event are not included.
          </Alert>

          <section className="ym23-history-metrics" aria-label="Pickup history summary">
            <div className="ym23-history-metric">
              <PackageCheck size={18} aria-hidden="true" />
              <StatCard label="Pickup Events" value={totalPickups} subtext="Successful recorded events" />
            </div>
            <div className="ym23-history-metric">
              <Truck size={18} aria-hidden="true" />
              <StatCard label="Completed" value={completedPickups} subtext="Commitment reached at event" />
            </div>
            <div className="ym23-history-metric">
              <CircleAlert size={18} aria-hidden="true" />
              <StatCard label="Partially Collected" value={partialPickups} subtext="Commitment not yet reached" />
            </div>
            <div className="ym23-history-metric">
              <CircleAlert size={18} aria-hidden="true" />
              <StatCard label="Current Exception Stops" value={exceptionStopCount} subtext="Stops with recorded pickup events" />
            </div>
            <div className="ym23-history-metric ym23-history-metric--wide">
              <Weight size={18} aria-hidden="true" />
              <StatCard label="Quantity Collected in Events" value={formatQuantity(totalCollected)} subtext="Across the listed pickup events" />
            </div>
          </section>

          <section className="ym23-history-table-card" aria-labelledby="ym23-history-table-heading">
            <div className="ym23-history-section-heading">
              <div>
                <h2 id="ym23-history-table-heading">Pickup records</h2>
                <p>{visibleRecords.length} of {records.length} events</p>
              </div>
            </div>

            <div className="ym23-history-filters">
              <InputField
                className="ym23-history-search"
                label="Search pickup history"
                type="search"
                placeholder="Search farm, event, order, or trip..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <SelectField
                className="ym23-history-result"
                label="Collection progress"
                options={resultOptions}
                value={resultFilter}
                onChange={(event) => setResultFilter(event.target.value as ResultFilter)}
              />
              <InputField
                className="ym23-history-date"
                label="Pickup date"
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
              />
              <Button className="ym23-history-clear" variant="outline" onClick={clearFilters}>Clear Filters</Button>
            </div>

            {visibleRecords.length > 0 ? (
              <Table
                className="ym23-history-table"
                headers={[
                  'Pickup Event', 'Farm / Pickup Location', 'Order / Trip', 'Crop Type',
                  'Event Quantity', 'Cumulative / Committed', 'Pickup Date / Time',
                  'Event Progress', 'Current Stop Status', 'Actions',
                ]}
              >
                {visibleRecords.map((record) => {
                  const progress = getCollectionProgress(record);
                  const pickupDateTime = getPickupDateTime(record.occurredAt);
                  return (
                    <TableRow key={record.eventId}>
                      <td><strong title={record.eventId}>{record.eventId.slice(0, 8)}</strong></td>
                      <td>
                        <strong>{record.farmName}</strong>
                        <small>{record.pickupAddress}, {record.district}</small>
                        <small>{record.farmerName}</small>
                      </td>
                      <td>
                        <small title={record.orderId}>Order {record.orderId.slice(0, 8)}</small>
                        <small title={record.tripId}>Trip {record.tripId.slice(0, 8)}</small>
                      </td>
                      <td>{record.cropType}</td>
                      <td>{formatQuantity(record.quantityKg)}</td>
                      <td>{formatQuantity(record.cumulativePickedUpKg)} / {formatQuantity(record.committedKg)}</td>
                      <td><span>{pickupDateTime.date}</span><small>{pickupDateTime.time}</small></td>
                      <td>
                        <span className={`ym23-history-status ym23-history-status--${progress}`}>
                          <StatusBadge status={progressLabel(progress)} />
                        </span>
                      </td>
                      <td><StatusBadge status={currentStopStatusLabel(record.currentStopStatus)} /></td>
                      <td>
                        <Button className="ym23-history-view" variant="outline" onClick={() => setSelectedRecord(record)}>
                          View Details
                        </Button>
                      </td>
                    </TableRow>
                  );
                })}
              </Table>
            ) : (
              <EmptyState
                title={records.length ? 'No pickup history found' : 'No pickup events recorded'}
                description={records.length
                  ? 'No pickup events match the active search and filters.'
                  : 'Successful pickup events recorded by your driver account will appear here.'}
                action={records.length ? <Button variant="outline" onClick={clearFilters}>Clear Filters</Button> : undefined}
              />
            )}
          </section>
        </>
      )}

      <dialog
        ref={dialogRef}
        className="ym23-history-dialog"
        aria-labelledby={titleId}
        onCancel={(event) => { event.preventDefault(); setSelectedRecord(null); }}
      >
        {selectedRecord && (
          <>
            <header className="ym23-history-dialog-header">
              <div>
                <p>Pickup event details</p>
                <h2 id={titleId}>{selectedRecord.eventId}</h2>
              </div>
              <button type="button" className="ym23-history-dialog-close" aria-label="Close pickup details" onClick={() => setSelectedRecord(null)}>×</button>
            </header>
            <div className="ym23-history-dialog-grid">
              <div><span>Pickup event ID</span><strong>{selectedRecord.eventId}</strong></div>
              <div><span>Farm name</span><strong>{selectedRecord.farmName}</strong></div>
              <div><span>Farmer name</span><strong>{selectedRecord.farmerName}</strong></div>
              <div><span>Pickup location</span><strong>{selectedRecord.pickupAddress}, {selectedRecord.district}</strong></div>
              <div><span>Crop type</span><strong>{selectedRecord.cropType}</strong></div>
              <div><span>Order ID</span><strong>{selectedRecord.orderId}</strong></div>
              <div><span>Trip ID</span><strong>{selectedRecord.tripId}</strong></div>
              <div><span>Pickup stop</span><strong>{selectedRecord.stopSequence === null ? 'Unavailable' : `Stop #${selectedRecord.stopSequence}`}</strong></div>
              <div><span>Pickup date and time</span><strong>{getPickupDateTime(selectedRecord.occurredAt).date} · {getPickupDateTime(selectedRecord.occurredAt).time}</strong></div>
              <div><span>Event quantity</span><strong>{formatQuantity(selectedRecord.quantityKg)}</strong></div>
              <div><span>Cumulative / committed</span><strong>{formatQuantity(selectedRecord.cumulativePickedUpKg)} / {formatQuantity(selectedRecord.committedKg)}</strong></div>
              <div><span>Event progress</span><strong>{progressLabel(getCollectionProgress(selectedRecord))}</strong></div>
              <div><span>Current stop status</span><strong>{currentStopStatusLabel(selectedRecord.currentStopStatus)}</strong></div>
            </div>
            <div className="ym23-history-dialog-actions">
              <Button variant="outline" onClick={() => setSelectedRecord(null)}>Close</Button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
