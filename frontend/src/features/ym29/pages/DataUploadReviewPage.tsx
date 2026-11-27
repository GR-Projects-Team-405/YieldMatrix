// YM29 · Yasindu Janapriya · Screen 5: Data Upload Review (/admin/market-data/uploads/new & /uploads/:id).
// Enforces whole-file validation: Approve & Publish stays disabled whenever any row error or duplicate exists.

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  ShieldAlert,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ContentCard } from '../../../components/ContentCard';
import { InputField } from '../../../components/InputField';
import { StatCard } from '../../../components/StatCard';
import { StatusBadge } from '../../../components/StatusBadge';
import { Table, TableRow } from '../../../components/Table';
import { Toast } from '../../../components/Toast';
import {
  commitUploadReview,
  fetchUploadReview,
  rejectUploadReview,
  uploadMarketCsvFile,
} from '../api';
import { UploadStepper, type UploadStepStage } from '../components/UploadStepper';
import {
  extractApiError,
  formatColomboDate,
  formatColomboDateTime,
} from '../formatters';
import type { UploadDetail, UploadDisplayRow } from '../types';

type RowTab = 'all' | 'flagged' | 'valid';
const PAGE_SIZE = 25;

function downloadSampleCsvTemplate() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const content = [
    'crop,grade,district,date,demand_kg,price_per_kg,source',
    `Tomato,Grade A,Colombo,${twoDaysAgo},1240.500,285.00,DEC Wholesale`,
    `Tomato,Grade B,Colombo,${twoDaysAgo},620.000,230.00,DEC Wholesale`,
    `Carrot,Grade A,Nuwara Eliya,${yesterday},910.250,225.50,Farmgate History`,
    `Cabbage,Grade B,Kandy,${yesterday},780.000,155.00,Kandy Wholesale`,
    `Beans,Grade A,Badulla,${yesterday},540.000,335.00,Badulla DEC`,
  ].join('\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'yieldmatrix-market-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function downloadErrorReport(upload: UploadDetail) {
  const header = 'row_number,date,crop,district,grade,demand_kg,price_per_kg,source,status,issues';
  const lines = upload.flagged_rows.map((r) =>
    [
      r.row_number,
      `"${r.date}"`,
      `"${r.crop.replaceAll('"', '""')}"`,
      `"${r.district.replaceAll('"', '""')}"`,
      `"${r.grade.replaceAll('"', '""')}"`,
      `"${r.demand_kg}"`,
      `"${r.price_per_kg}"`,
      `"${r.source.replaceAll('"', '""')}"`,
      r.status,
      `"${r.issues.join('; ').replaceAll('"', '""')}"`,
    ].join(','),
  );
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `error-report-${upload.file_name.replace(/\.csv$/i, '')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DataUploadReviewPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [upload, setUpload] = useState<UploadDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(id && id !== 'new'));
  const [uploading, setUploading] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [sampleDataFlag, setSampleDataFlag] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [pageError, setPageError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [rowTab, setRowTab] = useState<RowTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(0);

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectPanelOpen, setRejectPanelOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  useEffect(() => {
    if (!id || id === 'new') {
      setUpload(null);
      setLoading(false);
      setPageError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setPageError(null);
    fetchUploadReview(id)
      .then((res) => {
        if (!active) return;
        setUpload(res.upload);
        setRowTab(res.upload.error_rows > 0 ? 'flagged' : 'all');
        setPageIndex(0);
      })
      .catch((err) => {
        if (active) {
          setPageError(extractApiError(err, 'Could not load upload review.'));
          setUpload(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function processSelectedFile(file: File) {
    setPageError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setPageError('Please upload a .csv file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPageError('File exceeds the 2 MB upload limit (maximum 10,000 rows).');
      return;
    }

    setUploading(true);
    try {
      const csvText = await file.text();
      const res = await uploadMarketCsvFile({
        csvText,
        fileName: file.name,
        sampleData: sampleDataFlag,
      });
      setUpload(res.upload);
      setRowTab(res.upload.error_rows > 0 ? 'flagged' : 'all');
      setPageIndex(0);
      setRejectPanelOpen(false);
      setRejectReason('');
      navigate(`../uploads/${encodeURIComponent(res.upload.id)}`, { replace: true });
    } catch (err) {
      setPageError(extractApiError(err, 'CSV upload and validation failed.'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void processSelectedFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void processSelectedFile(file);
  }

  async function handleConfirmApprove() {
    if (!upload || !upload.can_approve) return;
    setBusyAction(true);
    setPageError(null);
    try {
      const res = await commitUploadReview(upload.id);
      setUpload((current) => (current ? { ...current, ...res.upload } : null));
      setApproveDialogOpen(false);
      setToastMessage(res.message);
    } catch (err) {
      setApproveDialogOpen(false);
      setPageError(extractApiError(err, 'Unable to publish dataset.'));
    } finally {
      setBusyAction(false);
    }
  }

  function handleOpenRejectConfirm() {
    const trimmed = rejectReason.trim();
    if (trimmed.length < 3) {
      setRejectReasonError('Enter a short rejection reason (at least 3 characters) for the audit log.');
      return;
    }
    setRejectReasonError(null);
    setRejectDialogOpen(true);
  }

  async function handleConfirmReject() {
    if (!upload) return;
    setBusyAction(true);
    setPageError(null);
    try {
      const res = await rejectUploadReview(upload.id, rejectReason.trim());
      setUpload((current) => (current ? { ...current, ...res.upload } : null));
      setRejectDialogOpen(false);
      setRejectPanelOpen(false);
      setToastMessage(res.message);
    } catch (err) {
      setRejectDialogOpen(false);
      setPageError(extractApiError(err, 'Unable to reject dataset.'));
    } finally {
      setBusyAction(false);
    }
  }

  const stage: UploadStepStage = !upload
    ? 'upload'
    : upload.status === 'committed'
      ? 'committed'
      : upload.status === 'rejected'
        ? 'rejected'
        : 'review';

  const sourceRows: UploadDisplayRow[] = !upload
    ? []
    : rowTab === 'flagged'
      ? upload.flagged_rows
      : rowTab === 'valid'
        ? upload.rows.filter((r) => r.status === 'valid')
        : upload.rows;

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filteredRows = trimmedQuery
    ? sourceRows.filter((r) =>
        [
          String(r.row_number),
          r.date,
          r.crop,
          r.district,
          r.grade,
          r.source,
          r.issues.join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(trimmedQuery),
      )
    : sourceRows;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pageRows = filteredRows.slice(safePageIndex * PAGE_SIZE, (safePageIndex + 1) * PAGE_SIZE);

  return (
    <div className="ym29-stack">
      <div className="ym29-header-row">
        <div className="ym29-header-copy">
          <Link to=".." className="ym29-link-inline" style={{ marginBottom: 8 }}>
            <ArrowLeft size={15} aria-hidden="true" />
            Back to Admin market data
          </Link>
          <p>
            Upload, preview, and strictly validate market CSV datasets before publishing to <code>market_observations</code>.
          </p>
        </div>

        <div className="ym29-header-actions">
          <Button variant="outline" onClick={downloadSampleCsvTemplate}>
            <Download size={16} aria-hidden="true" />
            Sample CSV
          </Button>
          {upload && upload.flagged_rows.length > 0 && (
            <Button variant="outline" onClick={() => downloadErrorReport(upload)}>
              <Download size={16} aria-hidden="true" />
              Error Report (.csv)
            </Button>
          )}
          {upload && upload.status === 'pending_review' && (
            <>
              <Button
                variant="danger"
                disabled={busyAction}
                onClick={() => setRejectPanelOpen((open) => !open)}
              >
                Reject Dataset
              </Button>
              <Button
                variant={upload.can_approve ? 'primary' : 'unavailable'}
                disabled={!upload.can_approve || busyAction}
                onClick={() => setApproveDialogOpen(true)}
                title={
                  upload.can_approve
                    ? 'Approve and publish validated rows'
                    : 'Disabled while any validation error or duplicate exists'
                }
              >
                Approve &amp; Publish
              </Button>
            </>
          )}
        </div>
      </div>

      <UploadStepper
        stage={stage}
        totalRows={upload?.total_rows || 0}
        errorRows={upload?.error_rows || 0}
      />

      {pageError && <Alert type="error">{pageError}</Alert>}

      {loading && <div className="ym29-skeleton">Loading upload preview…</div>}

      {!loading && !upload && (
        <ContentCard
          title="Upload Market Observation CSV"
          subtitle="Required columns: crop, grade (Grade A / Grade B / Grade C), district, date (YYYY-MM-DD), demand_kg, price_per_kg, source. Maximum 10,000 rows."
        >
          <div className="ym29-stack" style={{ gap: 16 }}>
            <div
              className={`ym29-dropzone ${dragActive ? 'ym29-dropzone--active' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <UploadCloud size={32} aria-hidden="true" />
              <strong>{uploading ? 'Parsing and validating CSV…' : 'Drop your market CSV file here'}</strong>
              <p>
                Whole-file validation checks active crops, exact grades (Grade A/B/C), non-negative kg/LKR values, and duplicate keys against both the file and PostgreSQL.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="ym29-file-input"
                aria-label="Choose market CSV file"
              />
              <Button
                variant="primary"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? 'Validating…' : 'Choose CSV file'}
              </Button>
            </div>

            <label className="ym29-checkbox-row">
              <input
                type="checkbox"
                checked={sampleDataFlag}
                onChange={(e) => setSampleDataFlag(e.target.checked)}
              />
              <span>
                Mark imported rows as <strong>Demo / Sample data</strong> (sets <code>sample_data = true</code> so farmer &amp; buyer views show the Demo data chip).
              </span>
            </label>
          </div>
        </ContentCard>
      )}

      {!loading && upload && (
        <>
          <ContentCard>
            <div className="ym29-header-row" style={{ alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <FileSpreadsheet size={24} aria-hidden="true" />
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 16 }}>{upload.file_name}</strong>
                    <span className="ym29-chip">{formatBytes(upload.file_size_bytes)}</span>
                    <StatusBadge
                      status={
                        upload.status === 'committed'
                          ? 'Approved'
                          : upload.status === 'rejected'
                            ? 'Rejected'
                            : 'Pending'
                      }
                    />
                    {upload.sample_data && <span className="ym29-chip ym29-chip--demo">Demo data</span>}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    Uploaded by {upload.uploaded_by_name} · {formatColomboDateTime(upload.uploaded_at)} · SHA-256:{' '}
                    <code>{upload.checksum.slice(0, 12)}…</code>
                    {upload.date_range.from && upload.date_range.until && (
                      <>
                        {' '}
                        · Window: {formatColomboDate(upload.date_range.from)} – {formatColomboDate(upload.date_range.until)}
                      </>
                    )}
                  </p>
                </div>
              </div>

              <Link to="../uploads/new">
                <Button variant="outline">Upload another CSV</Button>
              </Link>
            </div>
          </ContentCard>

          <div className="ym29-kpi-grid">
            <StatCard label="Total rows" value={upload.total_rows.toLocaleString('en-US')} subtext="100% parsed" />
            <StatCard label="Valid rows" value={upload.valid_rows.toLocaleString('en-US')} subtext="Passed all checks" />
            <StatCard
              label="Duplicate rows"
              value={upload.duplicate_rows.toLocaleString('en-US')}
              subtext="In-file or existing DB keys"
              highlight={upload.duplicate_rows > 0}
            />
            <StatCard
              label="Total error rows"
              value={upload.error_rows.toLocaleString('en-US')}
              subtext={upload.error_rows > 0 ? 'Blocks publish (strict)' : 'Ready to publish'}
            />
          </div>

          {upload.status === 'committed' && (
            <ContentCard>
              <div className="ym29-result-banner ym29-result-banner--success">
                <CheckCircle2 size={24} aria-hidden="true" />
                <div>
                  <strong>Dataset committed successfully</strong>
                  <p>
                    {upload.valid_rows.toLocaleString('en-US')} rows were atomically inserted into{' '}
                    <code>market_observations</code> and logged to <code>audit_logs</code> at{' '}
                    {formatColomboDateTime(upload.decided_at)}.
                  </p>
                </div>
                <Link to="..">
                  <Button variant="primary">View Admin Market Data</Button>
                </Link>
              </div>
            </ContentCard>
          )}

          {upload.status === 'rejected' && (
            <ContentCard>
              <div className="ym29-result-banner ym29-result-banner--error">
                <XCircle size={24} aria-hidden="true" />
                <div>
                  <strong>Dataset upload rejected</strong>
                  <p>
                    No rows were written to <code>market_observations</code>. Recorded audit reason:{' '}
                    <em>{upload.decision_reason || 'Rejected by admin'}</em>.
                  </p>
                </div>
                <Link to="../uploads/new">
                  <Button variant="outline">Upload corrected CSV</Button>
                </Link>
              </div>
            </ContentCard>
          )}

          {upload.status === 'pending_review' && upload.error_rows > 0 && (
            <Alert type="error">
              <span>
                <ShieldAlert size={15} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                <strong>Whole-file rejection policy active:</strong> {upload.error_rows} invalid or duplicate row(s) detected.{' '}
                <strong>Approve &amp; Publish is disabled.</strong> Download the error report, correct the CSV, or reject this upload.
              </span>
            </Alert>
          )}

          {upload.status === 'pending_review' && upload.error_rows === 0 && (
            <Alert type="success">
              All {upload.valid_rows.toLocaleString('en-US')} rows passed strict schema, precision, and duplicate checks. Click{' '}
              <strong>Approve &amp; Publish</strong> to commit them in one transaction.
            </Alert>
          )}

          {rejectPanelOpen && upload.status === 'pending_review' && (
            <ContentCard
              title="Reject Dataset Upload"
              subtitle="Provide a reason to record in the immutable audit_logs table."
            >
              <div className="ym29-stack" style={{ gap: 12 }}>
                <InputField
                  label="Rejection reason"
                  placeholder="e.g. Duplicate keys and negative price rows found — requesting corrected DEC file"
                  value={rejectReason}
                  error={rejectReasonError || undefined}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (rejectReasonError) setRejectReasonError(null);
                  }}
                />
                <div className="ym29-header-actions">
                  <Button variant="outline" onClick={() => setRejectPanelOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" disabled={busyAction} onClick={handleOpenRejectConfirm}>
                    Continue to reject
                  </Button>
                </div>
              </div>
            </ContentCard>
          )}

          <ContentCard
            title="Row-Level Validation Preview"
            subtitle="Inspect parsed records and exact validation errors before approving or rejecting."
          >
            <div className="ym29-header-row" style={{ marginBottom: 16, alignItems: 'center' }}>
              <div className="ym29-tabs" style={{ marginBottom: 0 }} role="group" aria-label="Filter preview rows">
                <button
                  type="button"
                  className="ym29-tab"
                  aria-pressed={rowTab === 'all'}
                  onClick={() => {
                    setRowTab('all');
                    setPageIndex(0);
                  }}
                >
                  All Rows ({upload.total_rows.toLocaleString('en-US')})
                </button>
                <button
                  type="button"
                  className="ym29-tab"
                  aria-pressed={rowTab === 'flagged'}
                  onClick={() => {
                    setRowTab('flagged');
                    setPageIndex(0);
                  }}
                >
                  Errors &amp; Duplicates ({upload.error_rows.toLocaleString('en-US')})
                </button>
                <button
                  type="button"
                  className="ym29-tab"
                  aria-pressed={rowTab === 'valid'}
                  onClick={() => {
                    setRowTab('valid');
                    setPageIndex(0);
                  }}
                >
                  Valid Rows ({upload.valid_rows.toLocaleString('en-US')})
                </button>
              </div>

              <div style={{ minWidth: 240, flex: '0 1 320px' }}>
                <InputField
                  label="Search rows"
                  placeholder="Filter by crop, district, row #, or error…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPageIndex(0);
                  }}
                />
              </div>
            </div>

            {pageRows.length === 0 ? (
              <div className="ym29-note-box">No rows match the active tab and filter.</div>
            ) : (
              <>
                <Table headers={['Row #', 'Date', 'Crop', 'District', 'Grade', 'Demand (kg)', 'Price (LKR)', 'Status', 'Issue description']}>
                  {pageRows.map((row) => (
                    <TableRow key={row.row_number}>
                      <td><strong>#{row.row_number}</strong></td>
                      <td>{row.date || '—'}</td>
                      <td>{row.crop || '—'}</td>
                      <td>{row.district || '—'}</td>
                      <td>{row.grade || '—'}</td>
                      <td>{row.demand_kg || '—'}</td>
                      <td>{row.price_per_kg || '—'}</td>
                      <td>
                        <StatusBadge
                          status={
                            row.status === 'valid'
                              ? 'Verified'
                              : row.status === 'duplicate'
                                ? 'Rejected'
                                : 'Failed'
                          }
                        />
                      </td>
                      <td style={{ maxWidth: 320, fontSize: 13 }}>
                        {row.issues.length > 0 ? (
                          <span className="ym-field-error">{row.issues.join(' · ')}</span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>Valid</span>
                        )}
                      </td>
                    </TableRow>
                  ))}
                </Table>

                <div className="ym29-pagination">
                  <span>
                    Showing {safePageIndex * PAGE_SIZE + 1}–
                    {Math.min((safePageIndex + 1) * PAGE_SIZE, filteredRows.length)} of{' '}
                    {filteredRows.length.toLocaleString('en-US')} rows
                  </span>
                  <div className="ym29-header-actions">
                    <Button
                      variant="outline"
                      disabled={safePageIndex === 0}
                      onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <span>
                      Page {safePageIndex + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      disabled={safePageIndex >= totalPages - 1}
                      onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </ContentCard>
        </>
      )}

      <ConfirmDialog
        open={approveDialogOpen}
        title="Approve & publish market dataset?"
        description={
          upload
            ? `This will atomically insert ${upload.valid_rows.toLocaleString('en-US')} validated rows from "${upload.file_name}" into market_observations and record an immutable audit log entry.`
            : ''
        }
        simulationNote={upload?.sample_data ? 'Rows will be flagged as Demo / Sample data.' : undefined}
        confirmLabel="Approve & Publish"
        busy={busyAction}
        onCancel={() => setApproveDialogOpen(false)}
        onConfirm={() => void handleConfirmApprove()}
      />

      <ConfirmDialog
        open={rejectDialogOpen}
        title="Reject this dataset upload?"
        description={`No rows will be saved to market_observations. The rejection reason "${rejectReason.trim()}" will be recorded in audit_logs.`}
        confirmLabel="Reject Dataset"
        busy={busyAction}
        onCancel={() => setRejectDialogOpen(false)}
        onConfirm={() => void handleConfirmReject()}
      />

      <Toast
        open={Boolean(toastMessage)}
        message={toastMessage || ''}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}
