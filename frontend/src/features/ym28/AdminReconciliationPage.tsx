import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import api from '../../services/api';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ContentCard } from '../../components/ContentCard';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { Table, TableRow } from '../../components/Table';
import { Toast } from '../../components/Toast';
import {
  extractApiError,
  formatColomboDateTime,
  formatLkrCents,
  generateOperationKey,
  humanizeLabel,
  isAbortError,
  isZeroCents,
  shortId,
  type AdminJournalItem,
  type AdminJournalsResponse,
  type AdminReconciliationResponse,
} from './utils';

const JOURNAL_TYPE_OPTIONS = [
  { value: '', label: 'All journal event types' },
  { value: 'funding', label: 'Funding' },
  { value: 'hold', label: 'Hold' },
  { value: 'settlement', label: 'Settlement' },
  { value: 'refund', label: 'Refund' },
  { value: 'payout_hold', label: 'Payout hold' },
  { value: 'payout', label: 'Payout' },
  { value: 'payout_release', label: 'Payout release' },
  { value: 'reversal', label: 'Reversal' },
];

export default function AdminReconciliationPage() {
  const [recon, setRecon] = useState<AdminReconciliationResponse | null>(null);
  const [journalsData, setJournalsData] = useState<AdminJournalsResponse | null>(null);
  const [loadingRecon, setLoadingRecon] = useState(true);
  const [loadingJournals, setLoadingJournals] = useState(true);
  const [reconError, setReconError] = useState('');
  const [journalsError, setJournalsError] = useState('');

  const [eventType, setEventType] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);

  // Immutable reversal + optional replacement state
  const reversalPanelRef = useRef<HTMLDivElement>(null);
  const [selectedJournal, setSelectedJournal] = useState<AdminJournalItem | null>(null);
  const [reason, setReason] = useState('');
  const [replacementAmountLkr, setReplacementAmountLkr] = useState('');
  const [operationKey, setOperationKey] = useState(() => generateOperationKey('ym28-rev'));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reverseError, setReverseError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const loadReconciliation = useCallback(async (signal?: AbortSignal) => {
    setLoadingRecon(true);
    setReconError('');
    try {
      const { data } = await api.get<AdminReconciliationResponse>('/ym28/admin/reconciliation', { signal });
      setRecon(data);
    } catch (err) {
      if (!isAbortError(err)) {
        setReconError(extractApiError(err, 'Could not load platform reconciliation report.').message);
      }
    } finally {
      if (!signal?.aborted) setLoadingRecon(false);
    }
  }, []);

  const loadJournals = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingJournals(true);
      setJournalsError('');
      try {
        const params: Record<string, string | number> = { page, limit: 15 };
        if (eventType) params.eventType = eventType;
        if (appliedSearch) params.search = appliedSearch;
        const { data } = await api.get<AdminJournalsResponse>('/ym28/admin/journals', { params, signal });
        setJournalsData(data);
      } catch (err) {
        if (!isAbortError(err)) {
          setJournalsError(extractApiError(err, 'Could not load journal entries.').message);
        }
      } finally {
        if (!signal?.aborted) setLoadingJournals(false);
      }
    },
    [page, eventType, appliedSearch]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadReconciliation(controller.signal);
    return () => controller.abort();
  }, [loadReconciliation]);

  useEffect(() => {
    const controller = new AbortController();
    void loadJournals(controller.signal);
    return () => controller.abort();
  }, [loadJournals]);

  function handleFilterSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  }

  function handleClearFilters() {
    setEventType('');
    setSearchInput('');
    setAppliedSearch('');
    setPage(1);
  }

  function startReversal(entry: AdminJournalItem) {
    setSelectedJournal(entry);
    setReason('');
    setReplacementAmountLkr('');
    setFieldErrors({});
    setReverseError('');
    setOperationKey(generateOperationKey('ym28-rev'));
    setTimeout(() => {
      reversalPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function validateReversal(): boolean {
    const errors: Record<string, string> = {};
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5 || trimmedReason.length > 300) {
      errors.reason = 'Provide a clear audit reason (5–300 characters).';
    }
    const trimmedReplacement = replacementAmountLkr.trim();
    if (trimmedReplacement) {
      if (selectedJournal?.eventType !== 'funding') {
        errors.replacementAmountLkr = 'Inline replacement is only supported for simulated funding entries.';
      } else if (!/^\d+(\.\d{1,2})?$/.test(trimmedReplacement) || Number(trimmedReplacement) <= 0) {
        errors.replacementAmountLkr = 'Enter a valid positive LKR replacement amount (up to 2 decimal places).';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleReversalSubmit(e: FormEvent) {
    e.preventDefault();
    setReverseError('');
    if (!selectedJournal || !validateReversal()) return;
    setConfirmOpen(true);
  }

  async function executeReversal() {
    if (!selectedJournal) return;
    setSubmitting(true);
    setReverseError('');
    try {
      const payload: Record<string, string> = {
        reason: reason.trim(),
        operationKey,
      };
      if (replacementAmountLkr.trim()) {
        payload.replacementAmountLkr = replacementAmountLkr.trim();
      }

      await api.post(`/ym28/admin/journals/${selectedJournal.id}/reverse`, payload);
      setConfirmOpen(false);
      setToastMessage(
        replacementAmountLkr.trim()
          ? `Reversed entry ${shortId(selectedJournal.id)} and posted replacement funding (audit logged).`
          : `Posted immutable reversal for entry ${shortId(selectedJournal.id)} (audit logged).`
      );
      setSelectedJournal(null);
      setReason('');
      setReplacementAmountLkr('');
      setOperationKey(generateOperationKey('ym28-rev'));
      await Promise.all([loadReconciliation(), loadJournals()]);
    } catch (err) {
      const extracted = extractApiError(err, 'Could not complete journal reversal. Your entries were preserved.');
      setReverseError(extracted.message);
      if (Object.keys(extracted.fieldErrors).length > 0) {
        setFieldErrors(extracted.fieldErrors);
      }
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ym28-stack">
      <Alert type="warning">
        <strong>Simulated Ledger Reconciliation (Admin):</strong> Compares wallet balances, double-entry journals,
        order allocation holds, settlements, refunds and pending payout requests. Posted journals are append-only;
        corrections must use linked reversals with an audit reason.
      </Alert>

      <div className="ym28-toolbar" style={{ marginBottom: 0 }}>
        <div className="ym28-muted">
          {recon
            ? `Last reconciled: ${formatColomboDateTime(recon.generatedAt)} (Asia/Colombo)`
            : 'Checking platform ledger integrity…'}
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void loadReconciliation();
            void loadJournals();
          }}
        >
          Re-run reconciliation
        </Button>
      </div>

      {reconError ? (
        <ContentCard title="Reconciliation check unavailable">
          <Alert type="error">{reconError}</Alert>
          <div className="ym28-actions" style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={() => void loadReconciliation()}>
              Retry reconciliation
            </Button>
          </div>
        </ContentCard>
      ) : loadingRecon || !recon ? (
        <ContentCard title="Platform reconciliation">
          <p role="status" className="ym28-muted">
            Recomputing journal balances, wallet totals and order holds…
          </p>
        </ContentCard>
      ) : (
        <>
          {recon.reconciliationStatus === 'balanced' ? (
            <Alert type="success">
              <strong>All Ledgers Reconciled (0 Mismatches):</strong> Every wallet matches its double-entry journal,
              buyer held funds match order allocations, pending payouts match requests, and total user balances equal
              net simulated equity issued.
            </Alert>
          ) : (
            <ContentCard
              title={`Reconciliation Mismatch Detected (${recon.mismatchCount})`}
              subtitle="Review the flagged variances below immediately."
            >
              <Alert type="error">
                One or more ledger invariants failed reconciliation. Do not edit posted rows; investigate the affected
                accounts and post authorised corrective entries.
              </Alert>
              <ul className="ym28-issue-list" style={{ marginTop: 16 }}>
                {recon.mismatches.map((m, idx) => (
                  <li key={`${m.scope}-${m.walletId || idx}`}>
                    <strong>
                      {humanizeLabel(m.scope)}
                      {m.ownerName ? ` (${m.ownerName} · ${humanizeLabel(m.accountType)})` : ''}:
                    </strong>{' '}
                    {m.issues.join(' | ')}
                  </li>
                ))}
              </ul>
            </ContentCard>
          )}

          <div className="ym28-stat-grid">
            <StatCard
              label="Reconciliation status"
              value={recon.reconciliationStatus === 'balanced' ? 'Balanced' : `${recon.mismatchCount} Mismatch(es)`}
              subtext={`Conservation variance: ${formatLkrCents(recon.summary.systemConservationVarianceCents)}`}
              highlight={recon.reconciliationStatus === 'balanced'}
            />
            <StatCard
              label="Net simulated funds issued"
              value={formatLkrCents(recon.summary.netSimulatedIssuedCents)}
              subtext={`User wallets sum: ${formatLkrCents(recon.summary.totalUserWalletCents)}`}
            />
            <StatCard
              label="Double-entry journals"
              value={recon.summary.totalJournalEntries}
              subtext={`DR = CR: ${formatLkrCents(recon.summary.totalDebitCents)} · Imbalanced: ${recon.summary.imbalancedEntryCount}`}
            />
            <StatCard
              label="Order allocations funded"
              value={formatLkrCents(recon.summary.totalOrderFundedCents)}
              subtext={`Settled: ${formatLkrCents(recon.summary.totalOrderSettledCents)} · Held: ${formatLkrCents(recon.summary.totalOrderHeldCents)}`}
            />
          </div>

          <ContentCard
            title="Wallet-to-journal & order-hold reconciliation"
            subtitle="Each user wallet is checked against its posted journal lines, active order holds and pending payout requests."
          >
            {recon.wallets.length === 0 ? (
              <EmptyState
                title="No user wallets found"
                description="Seeded and registered user wallets will appear here for reconciliation."
              />
            ) : (
              <Table
                headers={[
                  'Account & Role',
                  'Available (Wallet / Journal)',
                  'Held (Wallet / Journal / Orders)',
                  'Pending payout (Wallet / Req)',
                  'Journals',
                  'Check',
                ]}
              >
                {recon.wallets.map((w) => (
                  <TableRow key={w.walletId}>
                    <td>
                      <strong>{w.ownerName || 'Unnamed account'}</strong>
                      <div className="ym28-muted">
                        {humanizeLabel(w.accountType)}
                        {w.ownerEmail ? ` · ${w.ownerEmail}` : ''}
                      </div>
                    </td>
                    <td>
                      <div>{formatLkrCents(w.availableCents)}</div>
                      <div
                        className={
                          isZeroCents(w.availableVarianceCents) ? 'ym28-muted' : 'ym28-amount-neg'
                        }
                      >
                        Journal: {formatLkrCents(w.journalAvailableCents)}
                      </div>
                    </td>
                    <td>
                      <div>{formatLkrCents(w.heldCents)}</div>
                      <div
                        className={
                          isZeroCents(w.heldVarianceCents) && isZeroCents(w.orderHoldVarianceCents)
                            ? 'ym28-muted'
                            : 'ym28-amount-neg'
                        }
                      >
                        Journal: {formatLkrCents(w.journalHeldCents)}
                        {w.accountType === 'buyer' ? ` · Orders: ${formatLkrCents(w.allocationHeldCents)}` : ''}
                      </div>
                    </td>
                    <td>
                      <div>{formatLkrCents(w.pendingPayoutCents)}</div>
                      <div
                        className={
                          isZeroCents(w.pendingVarianceCents) && isZeroCents(w.payoutRequestVarianceCents)
                            ? 'ym28-muted'
                            : 'ym28-amount-neg'
                        }
                      >
                        Requests: {formatLkrCents(w.pendingRequestCents)}
                      </div>
                    </td>
                    <td>{w.journalEntryCount}</td>
                    <td>
                      <StatusBadge status={w.isBalanced ? 'Verified' : 'Failed'} />
                      {!w.isBalanced && (
                        <ul className="ym28-issue-list">
                          {w.issues.map((issue) => (
                            <li key={issue} className="ym28-amount-neg">
                              {issue}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </TableRow>
                ))}
              </Table>
            )}
          </ContentCard>
        </>
      )}

      {selectedJournal && (
        <div ref={reversalPanelRef}>
          <ContentCard
            title={`Reverse immutable journal entry · ${shortId(selectedJournal.id)}`}
            subtitle="Posted entries are never edited or deleted. Submitting this form posts a linked reversal entry (and optional funding replacement) plus an immutable audit log."
          >
            {reverseError && (
              <div style={{ marginBottom: 16 }}>
                <Alert type="error">{reverseError}</Alert>
              </div>
            )}

            <div className="ym28-meta-grid" style={{ marginBottom: 20 }}>
              <div className="ym28-meta-item">
                <span className="ym28-meta-label">Original type</span>
                <span className="ym28-meta-value">{humanizeLabel(selectedJournal.eventType)}</span>
              </div>
              <div className="ym28-meta-item">
                <span className="ym28-meta-label">Original amount</span>
                <span className="ym28-meta-value">{formatLkrCents(selectedJournal.amountCents)}</span>
              </div>
              <div className="ym28-meta-item">
                <span className="ym28-meta-label">Original reference</span>
                <span className="ym28-meta-value">{selectedJournal.eventReference}</span>
              </div>
              <div className="ym28-meta-item">
                <span className="ym28-meta-label">Idempotency key</span>
                <span className="ym28-meta-value ym28-mono">{operationKey}</span>
              </div>
            </div>

            <form className="ym28-stack" onSubmit={handleReversalSubmit} noValidate>
              <div className="ym-field">
                <label htmlFor="ym28-rev-reason">Audit reason for reversal (required)</label>
                <textarea
                  id="ym28-rev-reason"
                  className="ym28-textarea"
                  value={reason}
                  maxLength={300}
                  placeholder="Explain why this entry is being reversed (5–300 characters)…"
                  aria-invalid={fieldErrors.reason ? true : undefined}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, reason: '' }));
                  }}
                />
                {fieldErrors.reason && <p className="ym-field-error">{fieldErrors.reason}</p>}
              </div>

              {selectedJournal.eventType === 'funding' && (
                <InputField
                  label="Optional replacement funding amount (leave blank to reverse only)"
                  unit="LKR"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 75000.00"
                  value={replacementAmountLkr}
                  error={fieldErrors.replacementAmountLkr}
                  onChange={(e) => {
                    setReplacementAmountLkr(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, replacementAmountLkr: '' }));
                  }}
                />
              )}

              <div className="ym28-actions">
                <Button type="submit" variant="danger" disabled={submitting}>
                  Review reversal
                </Button>
                <Button
                  variant="outline"
                  disabled={submitting}
                  onClick={() => {
                    setSelectedJournal(null);
                    setReverseError('');
                    setFieldErrors({});
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </ContentCard>
        </div>
      )}

      <ContentCard
        title="Platform journal ledger"
        subtitle="Complete append-only double-entry journal across all simulated wallets."
      >
        <form className="ym28-toolbar" onSubmit={handleFilterSubmit}>
          <div className="ym28-filters">
            <SelectField
              label="Event type"
              value={eventType}
              options={JOURNAL_TYPE_OPTIONS}
              onChange={(e) => {
                setEventType(e.target.value);
                setPage(1);
              }}
            />
            <InputField
              label="Search reference, entry ID or operation key"
              placeholder="Search ledger…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="ym28-actions">
            <Button type="submit" variant="primary">
              Apply filters
            </Button>
            {(eventType || appliedSearch) && (
              <Button variant="outline" onClick={handleClearFilters}>
                Clear
              </Button>
            )}
          </div>
        </form>

        {journalsError ? (
          <div className="ym28-stack">
            <Alert type="error">{journalsError}</Alert>
            <div>
              <Button variant="outline" onClick={() => void loadJournals()}>
                Retry loading ledger
              </Button>
            </div>
          </div>
        ) : loadingJournals ? (
          <p role="status" className="ym28-muted">
            Loading platform journal entries…
          </p>
        ) : !journalsData || journalsData.journals.length === 0 ? (
          <EmptyState
            title="No journal entries found"
            description="Adjust your filters or wait for simulated wallet activity to post."
            action={
              (eventType || appliedSearch) && (
                <Button variant="outline" onClick={handleClearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <>
            <Table
              headers={[
                'Date (Asia/Colombo)',
                'Type & Status',
                'Reference & Actor',
                'Double-entry lines (DR / CR)',
                'Amount',
                'Correction',
              ]}
            >
              {journalsData.journals.map((entry) => (
                <TableRow key={entry.id}>
                  <td>{formatColomboDateTime(entry.occurredAt)}</td>
                  <td>
                    <StatusBadge
                      status={
                        entry.reversedById
                          ? 'Rejected'
                          : entry.eventType === 'reversal'
                            ? 'Pending'
                            : 'Confirmed'
                      }
                    />
                    <div className="ym28-muted" style={{ marginTop: 4 }}>
                      {humanizeLabel(entry.eventType)}
                      {entry.reversedById ? ' (Reversed)' : ''}
                    </div>
                  </td>
                  <td>
                    <div>{entry.eventReference}</div>
                    <div className="ym28-muted">
                      Actor: {entry.actorName} ({humanizeLabel(entry.actorRole)})
                    </div>
                    <div className="ym28-mono ym28-muted">ID: {shortId(entry.id)}</div>
                  </td>
                  <td>
                    <div className="ym28-journal-lines">
                      {entry.lines.map((line) => (
                        <div key={line.id}>
                          <strong>{line.side === 'debit' ? 'DR' : 'CR'}</strong> · {line.ownerName} (
                          {humanizeLabel(line.bucket)}) — {formatLkrCents(line.amountCents)}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <strong>{formatLkrCents(entry.amountCents)}</strong>
                  </td>
                  <td>
                    {entry.canReverse ? (
                      <Button variant="outline" onClick={() => startReversal(entry)}>
                        Reverse
                      </Button>
                    ) : entry.reversedById ? (
                      <span className="ym28-muted">Reversed by {shortId(entry.reversedById)}</span>
                    ) : (
                      <span className="ym28-muted">Reversal of {shortId(entry.reversalOf)}</span>
                    )}
                  </td>
                </TableRow>
              ))}
            </Table>

            <div className="ym28-pagination">
              <span className="ym28-muted">
                Page {journalsData.pagination.page} of {journalsData.pagination.totalPages} (
                {journalsData.pagination.total} entries)
              </span>
              <div className="ym28-actions">
                <Button
                  variant="outline"
                  disabled={journalsData.pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={journalsData.pagination.page >= journalsData.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </ContentCard>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm immutable journal reversal"
        description={
          selectedJournal
            ? replacementAmountLkr.trim()
              ? `Post a reversal for ${formatLkrCents(selectedJournal.amountCents)} and issue a linked replacement funding of LKR ${replacementAmountLkr.trim()}?`
              : `Post an immutable linked reversal for entry ${shortId(selectedJournal.id)} (${formatLkrCents(selectedJournal.amountCents)})?`
            : 'Post journal reversal?'
        }
        simulationNote="This updates the simulated ledger atomically and writes a read-only entry to audit_logs."
        confirmLabel="Post reversal"
        busy={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void executeReversal()}
      />

      <Toast message={toastMessage} open={Boolean(toastMessage)} onClose={() => setToastMessage('')} />
    </div>
  );
}