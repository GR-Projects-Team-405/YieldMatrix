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
import { mockPickupHistory, type PickupHistoryRecord, type PickupHistoryResult } from './mockPickupHistory';

type ResultFilter = 'all' | PickupHistoryResult;

const resultOptions = [
  { value: 'all', label: 'All Results' },
  { value: 'completed', label: 'Completed' },
  { value: 'partially-collected', label: 'Partially Collected' },
  { value: 'unable-to-collect', label: 'Unable to Collect' },
];

function resultLabel(result: PickupHistoryResult) {
  if (result === 'partially-collected') return 'Partially Collected';
  if (result === 'unable-to-collect') return 'Unable to Collect';
  return 'Completed';
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(`${date}T12:00:00`));
}

export default function PickupHistoryPage() {
  const [query, setQuery] = useState('');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<PickupHistoryRecord | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selectedRecord && !dialog.open) dialog.showModal();
    if (!selectedRecord && dialog.open) dialog.close();
  }, [selectedRecord]);

  const totalPickups = mockPickupHistory.length;
  const completedPickups = mockPickupHistory.filter((record) => record.result === 'completed').length;
  const partialPickups = mockPickupHistory.filter((record) => record.result === 'partially-collected').length;
  const unablePickups = mockPickupHistory.filter((record) => record.result === 'unable-to-collect').length;
  const totalCollected = mockPickupHistory.reduce((total, record) => total + record.actualKg, 0);

  const visibleRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return mockPickupHistory.filter((record) => {
      const matchesSearch = !normalizedQuery || [record.id, record.farmName, record.farmerName]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesResult = resultFilter === 'all' || record.result === resultFilter;
      const matchesDate = !dateFilter || record.pickupDate === dateFilter;
      return matchesSearch && matchesResult && matchesDate;
    });
  }, [query, resultFilter, dateFilter]);

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
          <p>View and review previously recorded pickup activities.</p>
        </div>
        <Link className="ym-button ym-button--outline ym23-history-back" to="/driver/pickups">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Pickup Stops
        </Link>
      </header>

      <Alert type="info">Demo/mock pickup history only. These records are not saved pickups and are independent of the Record Pickup form.</Alert>

      <section className="ym23-history-metrics" aria-label="Pickup history summary">
        <div className="ym23-history-metric">
          <PackageCheck size={18} aria-hidden="true" />
          <StatCard label="Total Pickups" value={totalPickups} subtext="Demo pickup activities" />
        </div>
        <div className="ym23-history-metric">
          <Truck size={18} aria-hidden="true" />
          <StatCard label="Completed Pickups" value={completedPickups} subtext="Collection completed" />
        </div>
        <div className="ym23-history-metric">
          <CircleAlert size={18} aria-hidden="true" />
          <StatCard label="Partially Collected" value={partialPickups} subtext="Collected below commitment" />
        </div>
        <div className="ym23-history-metric">
          <Weight size={18} aria-hidden="true" />
          <StatCard label="Unable to Collect" value={unablePickups} subtext="No collection completed" />
        </div>
        <div className="ym23-history-metric ym23-history-metric--wide">
          <Weight size={18} aria-hidden="true" />
          <StatCard label="Total Quantity Collected (kg)" value={`${totalCollected} kg`} subtext="Across all demo records" />
        </div>
      </section>

      <section className="ym23-history-table-card" aria-labelledby="ym23-history-table-heading">
        <div className="ym23-history-section-heading">
          <div>
            <h2 id="ym23-history-table-heading">Pickup records</h2>
            <p>{visibleRecords.length} of {mockPickupHistory.length} demo records</p>
          </div>
        </div>

        <div className="ym23-history-filters">
          <InputField
            className="ym23-history-search"
            label="Search pickup history"
            type="search"
            placeholder="Search by pickup ID, farm, or farmer..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <SelectField
            className="ym23-history-result"
            label="Pickup result"
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
              'Pickup ID', 'Farm Name', 'Farmer Name', 'Crop Type',
              'Expected Quantity (kg)', 'Actual Collected Quantity (kg)',
              'Pickup Date', 'Pickup Result / Status', 'Actions',
            ]}
          >
            {visibleRecords.map((record) => (
              <TableRow key={record.id}>
                <td><strong>{record.id}</strong></td>
                <td>{record.farmName}</td>
                <td>{record.farmerName}</td>
                <td>{record.cropType}</td>
                <td>{record.expectedKg} kg</td>
                <td>{record.actualKg} kg</td>
                <td><span>{formatDate(record.pickupDate)}</span><small>{record.pickupTime}</small></td>
                <td><span className={`ym23-history-status ym23-history-status--${record.result}`}><StatusBadge status={resultLabel(record.result)} /></span></td>
                <td><Button className="ym23-history-view" variant="outline" onClick={() => setSelectedRecord(record)}>View Details</Button></td>
              </TableRow>
            ))}
          </Table>
        ) : (
          <EmptyState
            title="No pickup history found"
            description="No demo records match the active search and filters."
            action={<Button variant="outline" onClick={clearFilters}>Clear Filters</Button>}
          />
        )}
      </section>

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
                <p>Pickup details</p>
                <h2 id={titleId}>{selectedRecord.id}</h2>
              </div>
              <button type="button" className="ym23-history-dialog-close" aria-label="Close pickup details" onClick={() => setSelectedRecord(null)}>×</button>
            </header>
            <div className="ym23-history-dialog-grid">
              <div><span>Pickup ID</span><strong>{selectedRecord.id}</strong></div>
              <div><span>Farm name</span><strong>{selectedRecord.farmName}</strong></div>
              <div><span>Farmer name</span><strong>{selectedRecord.farmerName}</strong></div>
              <div><span>Crop type</span><strong>{selectedRecord.cropType}</strong></div>
              <div><span>Expected quantity</span><strong>{selectedRecord.expectedKg} kg</strong></div>
              <div><span>Actual collected quantity</span><strong>{selectedRecord.actualKg} kg</strong></div>
              <div><span>Pickup date and time</span><strong>{formatDate(selectedRecord.pickupDate)} · {selectedRecord.pickupTime}</strong></div>
              <div><span>Pickup result</span><strong>{resultLabel(selectedRecord.result)}</strong></div>
              {selectedRecord.driverNotes && <div className="ym23-history-dialog-notes"><span>Driver notes</span><strong>{selectedRecord.driverNotes}</strong></div>}
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
