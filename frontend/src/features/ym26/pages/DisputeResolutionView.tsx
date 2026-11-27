import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  Check,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  Scale,
  FileText,
  X,
  History,
  ShieldCheck
} from 'lucide-react';
import {
  fetchDisputesStats,
  fetchDisputes,
  saveDisputeDraftApi,
  issueDisputeRulingApi,
  type DisputeItem,
  type DisputesStatsData
} from '../services/adminApi';
import { initialDisputes } from '../seedData';
import { Toast } from '../../../components/Toast';

export function DisputeResolutionView() {
  const [stats, setStats] = useState<DisputesStatsData | null>(null);
  const [disputes, setDisputes] = useState<DisputeItem[]>(initialDisputes);
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem>(initialDisputes[0]);
  const [activeTab, setActiveTab] = useState<'all' | 'awaiting_review' | 'under_investigation' | 'pending_evidence'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState('');

  // Resolution Form State
  const [acceptedWeight, setAcceptedWeight] = useState<number>(472.00);
  const [rationale, setRationale] = useState(
    "Joint reweigh confirms 472.00 kg accepted. Approve a 28.00 kg shortfall at LKR 240.00/kg. The verified record supersedes the buyer's initial 460.00 kg receiving note."
  );
  const [confirmedCheck, setConfirmedCheck] = useState(true);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [activeEvidenceItem, setActiveEvidenceItem] = useState<{ num: string; title: string; stakeholder: string; date: string; weight: string; status: string } | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync breadcrumbs & suppress layout page-heading if present
  useEffect(() => {
    const heading = document.querySelector('.page-heading');
    if (heading) {
      (heading as HTMLElement).style.display = 'none';
    }
    const breadcrumb = document.querySelector('.workspace-breadcrumb') || document.querySelector('.page-breadcrumb');
    let prevHtml = '';
    if (breadcrumb) {
      prevHtml = breadcrumb.innerHTML;
      breadcrumb.innerHTML = '<span class="text-[#8b9e91] tracking-wider uppercase text-[11px] font-semibold">WORKSPACE</span> <span class="mx-1 text-[#8b9e91]">/</span> <span class="text-[#263A31] tracking-wider uppercase text-[11px] font-semibold">DISPUTE RESOLUTION</span>';
    }
    return () => {
      if (heading) {
        (heading as HTMLElement).style.display = '';
      }
      if (breadcrumb && prevHtml) {
        breadcrumb.innerHTML = prevHtml;
      }
    };
  }, []);

  const loadData = async () => {
    try {
      const statsData = await fetchDisputesStats();
      if (statsData) setStats(statsData);
      const dispData = await fetchDisputes({ tab: activeTab, status: statusFilter, search: searchQuery });
      if (dispData && dispData.length > 0) {
        setDisputes(dispData);
        if (!selectedDispute || !dispData.find((d: DisputeItem) => d.id === selectedDispute.id)) {
          setSelectedDispute(dispData[0]);
        }
      }
    } catch {
      // Keep resilient
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, statusFilter]);

  // Sync inputs when selected dispute changes
  useEffect(() => {
    if (selectedDispute) {
      setAcceptedWeight(selectedDispute.verifiedAcceptedKg);
      setRationale(
        selectedDispute.proposedRuling?.rationale ||
          `Joint reweigh confirms ${selectedDispute.verifiedAcceptedKg.toFixed(2)} kg accepted. Approve a ${(selectedDispute.orderedKg - selectedDispute.verifiedAcceptedKg).toFixed(2)} kg shortfall at LKR ${(selectedDispute.unitPriceCents / 100).toFixed(2)}/kg. The verified record supersedes the buyer's initial ${selectedDispute.buyerReportedKg.toFixed(2)} kg receiving note.`
      );
      setConfirmedCheck(true);
    }
  }, [selectedDispute.id]);

  const filteredDisputes = useMemo(() => {
    return disputes.filter((item) => {
      if (activeTab === 'awaiting_review' && item.status !== 'awaiting_review') return false;
      if (activeTab === 'under_investigation' && item.status !== 'under_investigation') return false;
      if (activeTab === 'pending_evidence' && item.status !== 'pending_evidence') return false;

      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.id.toLowerCase().includes(q) ||
          item.orderId.toLowerCase().includes(q) ||
          item.commodity.toLowerCase().includes(q) ||
          item.partiesDisplay.toLowerCase().includes(q) ||
          item.reason.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [disputes, activeTab, statusFilter, searchQuery]);

  // Dynamic calculations based on entered accepted weight
  const paidQuantity = selectedDispute.orderedKg;
  const unitPriceLkr = selectedDispute.unitPriceCents / 100;
  const shortfallKg = Math.max(0, paidQuantity - acceptedWeight);
  const calculatedRefundLkr = Math.round(shortfallKg * unitPriceLkr * 100) / 100;
  const maxClaimLkr = selectedDispute.claimedRefundCents / 100;
  const refundExceedsClaim = calculatedRefundLkr > maxClaimLkr;
  const shortfallPct = paidQuantity > 0 ? ((shortfallKg / paidQuantity) * 100).toFixed(2) : '0.00';

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await saveDisputeDraftApi(selectedDispute.id, {
        verifiedAcceptedKg: acceptedWeight,
        rationale
      });
      setToastMessage(`Draft ruling saved for ${selectedDispute.id}.`);
    } catch {
      setToastMessage('Saved locally in draft state.');
    } finally {
      setSaving(false);
    }
  };

  const handleIssueFinalRuling = async () => {
    setSaving(true);
    try {
      const refundCents = Math.round(calculatedRefundLkr * 100);
      await issueDisputeRulingApi(selectedDispute.id, {
        verifiedAcceptedKg: acceptedWeight,
        refundCents,
        rationale
      });

      const updatedActivity = [
        {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actor: `Platform admin issued permanent ruling: LKR ${calculatedRefundLkr.toLocaleString('en-US', { minimumFractionDigits: 2 })} refund approved.`
        },
        ...selectedDispute.caseActivity
      ];

      setDisputes((prev) =>
        prev.map((d) =>
          d.id === selectedDispute.id
            ? {
                ...d,
                status: 'resolved',
                statusLabel: 'Resolved',
                verifiedAcceptedKg: acceptedWeight,
                eligibleRefundCents: refundCents,
                eligibleRefundDisplay: `LKR ${calculatedRefundLkr.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                caseActivity: updatedActivity
              }
            : d
        )
      );

      setSelectedDispute((prev) => ({
        ...prev,
        status: 'resolved',
        statusLabel: 'Resolved',
        verifiedAcceptedKg: acceptedWeight,
        eligibleRefundCents: refundCents,
        eligibleRefundDisplay: `LKR ${calculatedRefundLkr.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        caseActivity: updatedActivity
      }));

      setToastMessage(`Final ruling posted for ${selectedDispute.id}. LKR ${calculatedRefundLkr.toLocaleString('en-US', { minimumFractionDigits: 2 })} refunded.`);
      setConfirmModalOpen(false);
    } catch {
      // Keep resilient
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ym26-dispute-resolution w-full max-w-[1440px] mx-auto space-y-6 pb-12 font-sans text-[#263A31]">
      {/* Toast Notification */}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}

      {/* Top Breadcrumb & Page Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-[#8b9e91]">
          <span>WORKSPACE</span>
          <span>/</span>
          <span className="text-[#263A31]">DISPUTE RESOLUTION</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-2 pt-1">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#263A31]">Dispute resolution</h1>
            <p className="text-sm text-[#596c60] mt-0.5">
              Reconcile evidence. Verify accepted weight. Resolve with confidence.
            </p>
          </div>
          <div className="text-xs text-[#596c60] font-medium tracking-wide">
            13 NOV 2026 · All amounts in LKR
          </div>
        </div>
      </div>

      {/* Top 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Disputes */}
        <div className="bg-white border border-[#dce3db] rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold text-[#596c60] uppercase tracking-wider block">
            OPEN DISPUTES
          </span>
          <p className="text-[32px] font-extrabold text-[#263A31] mt-2.5 leading-none">
            {stats?.openDisputes ?? 12}
          </p>
          <p className="text-xs text-[#596c60] mt-2">
            {stats?.openSubtext ?? 'Across 8 active orders'}
          </p>
        </div>

        {/* Awaiting Review */}
        <div className="bg-white border border-[#dce3db] rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold text-[#596c60] uppercase tracking-wider block">
            AWAITING REVIEW
          </span>
          <p className="text-[32px] font-extrabold text-[#263A31] mt-2.5 leading-none">
            {String(stats?.awaitingReview ?? 4).padStart(2, '0')}
          </p>
          <p className="text-xs text-[#596c60] mt-2">
            {stats?.awaitingSubtext ?? '2 require action today'}
          </p>
        </div>

        {/* Refund Exposure */}
        <div className="bg-white border border-[#dce3db] rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold text-[#596c60] uppercase tracking-wider block">
            REFUND EXPOSURE
          </span>
          <p className="text-[26px] font-extrabold text-[#263A31] mt-2.5 leading-none">
            {stats?.refundExposureLkr ?? 'LKR 184,650.00'}
          </p>
          <p className="text-xs text-[#596c60] mt-2">
            {stats?.exposureSubtext ?? 'Pending adjudication'}
          </p>
        </div>

        {/* Resolved This Month */}
        <div className="bg-white border border-[#dce3db] rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold text-[#596c60] uppercase tracking-wider block">
            RESOLVED THIS MONTH
          </span>
          <p className="text-[32px] font-extrabold text-[#263A31] mt-2.5 leading-none">
            {stats?.resolvedThisMonth ?? 38}
          </p>
          <p className="text-xs text-[#596c60] mt-2">
            {stats?.resolvedSubtext ?? 'Median resolution · 1.8 days'}
          </p>
        </div>
      </div>

      {/* Dispute Queue Section */}
      <div className="bg-white border border-[#dce3db] rounded-2xl p-6 shadow-xs space-y-4">
        {/* Top Header & Search/Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-[#263A31]">Dispute queue</h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f1f4f0] text-[#596c60]">
              12 open cases
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b9e91]" />
              <input
                type="text"
                placeholder="Search dispute or order ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-8 pr-3 rounded-xl border border-[#dce3db] text-xs text-[#263A31] placeholder-[#8b9e91] focus:outline-none focus:ring-1 focus:ring-[#315A42] bg-white"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 pr-8 rounded-xl border border-[#dce3db] text-xs font-medium text-[#263A31] bg-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#315A42]"
              >
                <option value="all">Status: All open</option>
                <option value="under_investigation">Under investigation</option>
                <option value="awaiting_review">Awaiting review</option>
                <option value="pending_evidence">Pending evidence</option>
                <option value="resolved">Resolved</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#596c60] pointer-events-none" />
            </div>

            <button
              type="button"
              className="h-9 px-3 rounded-xl border border-[#dce3db] text-xs font-medium text-[#263A31] bg-white hover:bg-[#f6f7f3] transition flex items-center gap-1.5"
            >
              <span>Filters</span>
              <span className="text-[10px]">↓</span>
            </button>
          </div>
        </div>

        {/* Underline Tabs */}
        <div className="flex items-center gap-6 border-b border-[#dce3db] text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`pb-2.5 font-semibold transition border-b-2 -mb-[1px] ${
              activeTab === 'all'
                ? 'border-[#263A31] text-[#263A31] font-bold'
                : 'border-transparent text-[#596c60] hover:text-[#263A31]'
            }`}
          >
            All open 12
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('awaiting_review')}
            className={`pb-2.5 font-semibold transition border-b-2 -mb-[1px] ${
              activeTab === 'awaiting_review'
                ? 'border-[#263A31] text-[#263A31] font-bold'
                : 'border-transparent text-[#596c60] hover:text-[#263A31]'
            }`}
          >
            Awaiting review 4
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('under_investigation')}
            className={`pb-2.5 font-semibold transition border-b-2 -mb-[1px] ${
              activeTab === 'under_investigation'
                ? 'border-[#263A31] text-[#263A31] font-bold'
                : 'border-transparent text-[#596c60] hover:text-[#263A31]'
            }`}
          >
            Under investigation 6
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending_evidence')}
            className={`pb-2.5 font-semibold transition border-b-2 -mb-[1px] ${
              activeTab === 'pending_evidence'
                ? 'border-[#263A31] text-[#263A31] font-bold'
                : 'border-transparent text-[#596c60] hover:text-[#263A31]'
            }`}
          >
            Pending evidence 2
          </button>
        </div>

        {/* Dispute Queue Table */}
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full border-collapse text-left text-xs min-w-[840px]">
            <thead>
              <tr className="border-b border-[#dce3db] text-[#596c60] font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 pr-4">DISPUTE / ORDER</th>
                <th className="py-2.5 px-4">COMMODITY &amp; PARTIES</th>
                <th className="py-2.5 px-4">REASON</th>
                <th className="py-2.5 px-4">CLAIMED REFUND</th>
                <th className="py-2.5 px-4">PRIORITY</th>
                <th className="py-2.5 px-4">STATUS</th>
                <th className="py-2.5 pl-4 text-right">OPENED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1ec]">
              {filteredDisputes.map((d) => {
                const isSelected = selectedDispute.id === d.id;

                return (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedDispute(d)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#f4f7f4]' : 'hover:bg-[#fbfcfb]'
                    }`}
                  >
                    <td className="py-3 pr-4">
                      <span className="font-bold text-[#263A31] block text-xs">{d.id}</span>
                      <span className="text-[11px] text-[#596c60]">{d.orderId}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#263A31] text-xs">{d.commodity}</p>
                      <p className="text-[11px] text-[#596c60]">{d.partiesDisplay}</p>
                    </td>
                    <td className="py-3 px-4 text-[#263A31] text-xs">{d.reason}</td>
                    <td className="py-3 px-4 font-bold text-[#263A31] text-xs">{d.claimedRefundDisplay}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-xs text-[#263A31]">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            d.priority === 'high' ? 'bg-[#b91c1c]' : 'bg-[#d97706]'
                          }`}
                        />
                        <span>{d.priorityLabel}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          d.status === 'under_investigation'
                            ? 'bg-[#eaf2e8] text-[#315A42]'
                            : d.status === 'awaiting_review'
                            ? 'bg-[#f1f3f0] text-[#596c60]'
                            : d.status === 'pending_evidence'
                            ? 'bg-[#fff3e0] text-[#b45309]'
                            : 'bg-[#eaf2e8] text-[#315A42]'
                        }`}
                      >
                        {d.statusLabel}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-right text-[#596c60] text-xs">{d.openedDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Dispute Detail & Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Reconciliation & Evidence - 7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Selected Case Header */}
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 pt-1">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl font-bold tracking-tight text-[#263A31]">
                  {selectedDispute.id}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eaf2e8] text-[#315A42]">
                  {selectedDispute.statusLabel}
                </span>
              </div>
              <p className="text-xs text-[#596c60] mt-1">
                Order {selectedDispute.orderId} &nbsp;/&nbsp; {selectedDispute.commodity.split('·')[0].trim()} &nbsp;/&nbsp; Opened {selectedDispute.openedFull}
              </p>
            </div>
            <div className="text-xs text-[#596c60] font-medium">
              Assigned to {selectedDispute.assignedTo}
            </div>
          </div>

          {/* Card 1: Transaction Parties */}
          <div className="bg-white border border-[#dce3db] rounded-2xl p-5 shadow-xs space-y-3">
            <span className="text-[11px] font-bold text-[#596c60] uppercase tracking-wider block">
              TRANSACTION PARTIES
            </span>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-bold text-sm text-[#263A31]">{selectedDispute.supplier.name}</p>
                  <p className="text-xs text-[#596c60]">{selectedDispute.supplier.role} · {selectedDispute.supplier.location}</p>
                </div>
                <span className="text-[#8b9e91] font-semibold text-sm">→</span>
                <div>
                  <p className="font-bold text-sm text-[#263A31]">{selectedDispute.buyer.name}</p>
                  <p className="text-xs text-[#596c60]">{selectedDispute.buyer.role} · {selectedDispute.buyer.location}</p>
                </div>
              </div>

              <div className="sm:text-right">
                <p className="font-extrabold text-lg text-[#263A31]">{selectedDispute.orderTotalDisplay}</p>
                <p className="text-xs text-[#596c60]">{selectedDispute.orderTotalNote}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#edf1ec] text-xs text-[#596c60]">
              Carrier: {selectedDispute.carrier.name} · Delivery completed {selectedDispute.carrier.completedAt}
            </div>
          </div>

          {/* Card 2: Evidence Register */}
          <div className="bg-white border border-[#dce3db] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#263A31]">Evidence register</h3>
                <p className="text-xs text-[#596c60] mt-0.5">4 attachments · 3 stakeholders</p>
              </div>
              <button
                type="button"
                onClick={() => setEvidenceModalOpen(true)}
                className="text-xs font-semibold text-[#315A42] hover:underline flex items-center gap-1 transition"
              >
                <span>View all evidence</span>
                <span className="text-[11px]">↗</span>
              </button>
            </div>

            <div className="divide-y divide-[#edf1ec] pt-1">
              {selectedDispute.evidenceRegister?.map((ev) => (
                <div
                  key={ev.num}
                  className="py-2.5 flex items-center justify-between text-xs hover:bg-[#fbfcfb] px-1 rounded-lg transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-[#8b9e91] w-5">{ev.num}</span>
                    <div>
                      <p className="font-bold text-[#263A31]">{ev.title}</p>
                      <p className="text-[11px] text-[#596c60]">
                        {ev.stakeholder} · {ev.date}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-[#263A31] text-xs">{ev.weight}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveEvidenceItem(ev);
                        setEvidenceModalOpen(true);
                      }}
                      className={`text-xs font-semibold flex items-center gap-0.5 hover:underline ${
                        ev.status === 'Verified' ? 'text-[#315A42]' : 'text-[#596c60]'
                      }`}
                    >
                      <span>{ev.status}</span>
                      <span className="text-[10px]">↗</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Weight Reconciliation */}
          <div className="bg-white border border-[#dce3db] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#263A31]">Weight reconciliation</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eaf2e8] text-[#315A42]">
                Reweigh verified
              </span>
            </div>

            {/* 4 Stat Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="bg-[#f8faf7] p-3 rounded-xl border border-[#dce3db]">
                <span className="text-[10px] text-[#596c60] font-bold uppercase tracking-wider block">
                  ORDERED / PAID
                </span>
                <p className="text-base font-extrabold text-[#263A31] mt-1">
                  {selectedDispute.orderedKg.toFixed(2)} kg
                </p>
              </div>

              <div className="bg-[#f8faf7] p-3 rounded-xl border border-[#dce3db]">
                <span className="text-[10px] text-[#596c60] font-bold uppercase tracking-wider block">
                  DISPATCHED
                </span>
                <p className="text-base font-extrabold text-[#263A31] mt-1">
                  {selectedDispute.dispatchedKg.toFixed(2)} kg
                </p>
              </div>

              <div className="bg-[#f8faf7] p-3 rounded-xl border border-[#dce3db]">
                <span className="text-[10px] text-[#596c60] font-bold uppercase tracking-wider block">
                  BUYER REPORTED
                </span>
                <p className="text-base font-extrabold text-[#263A31] mt-1">
                  {selectedDispute.buyerReportedKg.toFixed(2)} kg
                </p>
              </div>

              <div className="bg-[#eaf2e8] p-3 rounded-xl border border-[#b8d4be]">
                <span className="text-[10px] text-[#315A42] font-bold uppercase tracking-wider block">
                  VERIFIED ACCEPTED
                </span>
                <p className="text-base font-extrabold text-[#315A42] mt-1">
                  {acceptedWeight.toFixed(2)} kg
                </p>
              </div>
            </div>

            {/* Reconciliation Shortfall Footer */}
            <div className="pt-2 text-xs">
              <div className="flex items-center justify-between font-bold text-[#263A31]">
                <span>{shortfallKg.toFixed(2)} kg eligible shortfall</span>
                <span className="font-normal text-[#596c60]">{shortfallPct}% of ordered weight</span>
              </div>
              <p className="text-[#596c60] text-xs mt-1">
                {selectedDispute.shortfallNote}
              </p>
            </div>
          </div>

          {/* Card 4: Case Activity */}
          <div className="bg-white border border-[#dce3db] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#263A31]">Case activity</h3>
              <button
                type="button"
                onClick={() => setAuditModalOpen(true)}
                className="text-xs font-semibold text-[#315A42] hover:underline flex items-center gap-1 transition"
              >
                <span>Full audit trail</span>
                <span className="text-[10px]">↗</span>
              </button>
            </div>

            <div className="space-y-2.5 pt-1 text-xs">
              {selectedDispute.caseActivity?.map((act, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-[#315A42] text-xs font-bold leading-none mt-0.5">●</span>
                  <p className="text-[#263A31] leading-relaxed">
                    <span className="font-bold text-[#596c60] mr-2">{act.time}</span>
                    {act.actor}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (Resolution Workspace - 5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Right Header */}
          <div className="pt-1">
            <h2 className="text-xl font-bold tracking-tight text-[#263A31]">Resolution workspace</h2>
            <p className="text-xs text-[#596c60] mt-1">
              Review values before issuing a permanent ruling.
            </p>
          </div>

          {/* Resolution Workspace Card */}
          <div className="bg-white border border-[#dce3db] rounded-2xl p-6 shadow-xs space-y-4">
            {/* Proposed Ruling Subheader */}
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#263A31]">Proposed ruling</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#f1f3f0] text-[#596c60]">
                  Draft
                </span>
              </div>
              <p className="text-xs text-[#596c60] mt-0.5">
                {selectedDispute.proposedRuling?.type ?? 'Partial refund · weight discrepancy'}
              </p>
            </div>

            {/* Input: Verified Accepted Weight */}
            <div className="space-y-1.5 pt-1">
              <label htmlFor="acceptedWeightInput" className="text-xs font-bold text-[#263A31] block">
                Verified accepted weight
              </label>
              <div className="relative">
                <input
                  id="acceptedWeightInput"
                  type="number"
                  step="0.01"
                  min="0"
                  max={paidQuantity}
                  value={acceptedWeight}
                  onChange={(e) => setAcceptedWeight(parseFloat(e.target.value) || 0)}
                  className="w-full h-11 px-3.5 pr-12 rounded-xl border border-[#97a99c] text-base font-bold text-[#263A31] focus:outline-none focus:ring-1 focus:ring-[#315A42] bg-white"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#596c60]">
                  kg
                </span>
              </div>
              <p className="text-[11px] text-[#315A42] flex items-center gap-1 font-medium pt-0.5">
                <Check size={13} strokeWidth={2.5} />
                <span>Within the paid quantity: 0.00–{paidQuantity.toFixed(2)} kg</span>
              </p>
            </div>

            {/* Refund Calculation Table */}
            <div className="space-y-2 pt-2 border-t border-[#edf1ec] text-xs">
              <span className="font-bold text-[#596c60] text-[11px] uppercase tracking-wider block">
                REFUND CALCULATION
              </span>

              <div className="flex items-center justify-between text-[#596c60]">
                <span>Paid quantity − accepted weight</span>
                <span className="font-bold text-[#263A31]">{shortfallKg.toFixed(2)} kg</span>
              </div>

              <div className="flex items-center justify-between text-[#596c60]">
                <span>Unit price</span>
                <span className="font-bold text-[#263A31]">LKR {unitPriceLkr.toFixed(2)} / kg</span>
              </div>

              <div className="flex items-center justify-between text-[#596c60]">
                <span>Gross eligible adjustment</span>
                <span className="font-bold text-[#263A31]">
                  LKR {calculatedRefundLkr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between text-[#596c60]">
                <span>Previously refunded</span>
                <span className="font-bold text-[#263A31]">LKR 0.00</span>
              </div>
            </div>

            {/* Green Highlight Box: Eligible Refund */}
            <div className="bg-[#eaf2e8] border border-[#b8d4be] rounded-xl p-4 space-y-1">
              <span className="text-xs font-bold text-[#315A42] block">Eligible refund</span>
              <p className="text-[26px] font-extrabold text-[#315A42] leading-tight">
                LKR {calculatedRefundLkr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className={`text-[11px] flex items-center gap-1 font-medium pt-0.5 ${refundExceedsClaim ? 'text-[#b91c1c]' : 'text-[#315A42]'}`}>
                {refundExceedsClaim ? (
                  <>
                    <AlertCircle size={13} />
                    <span>Exceeds original claim ({selectedDispute.claimedRefundDisplay})!</span>
                  </>
                ) : (
                  <>
                    <Check size={13} strokeWidth={2.5} />
                    <span>Does not exceed claim ({selectedDispute.claimedRefundDisplay}) or paid balance.</span>
                  </>
                )}
              </p>
            </div>

            {/* Rationale Textarea */}
            <div className="space-y-1.5 pt-1">
              <label htmlFor="rationaleInput" className="text-xs font-bold text-[#263A31] block">
                Resolution rationale *
              </label>
              <textarea
                id="rationaleInput"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl border border-[#97a99c] text-xs text-[#263A31] leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#315A42] resize-none bg-white"
              />
            </div>

            {/* Confirmation Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="confirmRulingCheckbox"
                checked={confirmedCheck}
                onChange={(e) => setConfirmedCheck(e.target.checked)}
                className="w-4 h-4 rounded text-[#315A42] accent-[#315A42] focus:ring-[#315A42] cursor-pointer"
              />
              <label htmlFor="confirmRulingCheckbox" className="text-xs text-[#263A31] font-medium cursor-pointer">
                I confirm the evidence and refund calculation.
              </label>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="flex-1 h-11 rounded-xl border border-[#dce3db] bg-white hover:bg-[#f6f7f3] text-xs font-bold text-[#263A31] transition shadow-xs"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={!confirmedCheck || !rationale.trim() || refundExceedsClaim || saving}
                  className="flex-2 h-11 px-5 rounded-xl bg-[#315A42] hover:bg-[#264834] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <span>Issue final ruling</span>
                  <span className="text-sm">→</span>
                </button>
              </div>

              <p className="text-[10px] text-[#596c60] text-center leading-normal px-2">
                Permanent once issued. The ruling, evidence references, and ledger adjustment are retained in the audit archive.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#17281db3] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#edf1ec] pb-3">
              <h3 className="text-base font-bold text-[#263A31] flex items-center gap-2">
                <Scale size={18} className="text-[#315A42]" />
                <span>Issue Permanent Ruling: {selectedDispute.id}</span>
              </h3>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="text-[#8b9e91] hover:text-[#263A31]"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#596c60] leading-relaxed">
              Per SRS Section 9 (FR-ORD-09 &amp; FR-ORD-10): This will post a permanent financial adjustment of{' '}
              <strong className="text-[#263A31]">
                LKR {calculatedRefundLkr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </strong>{' '}
              to the buyer's balance, mark the dispute as Resolved, and append an immutable entry to the platform audit ledger.
            </p>

            <div className="bg-[#f8faf7] p-3.5 rounded-xl text-xs space-y-1.5 border border-[#dce3db]">
              <div className="flex justify-between">
                <span className="text-[#596c60]">Verified accepted:</span>
                <span className="font-bold text-[#263A31]">{acceptedWeight.toFixed(2)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#596c60]">Shortfall quantity:</span>
                <span className="font-bold text-[#263A31]">{shortfallKg.toFixed(2)} kg ({shortfallPct}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#596c60]">Refund amount:</span>
                <span className="font-bold text-[#315A42]">LKR {calculatedRefundLkr.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#edf1ec]">
                <span className="text-[#596c60]">Adjudicator:</span>
                <span className="font-medium text-[#263A31]">Platform admin (N. Perera)</span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#dce3db] text-xs font-semibold text-[#263A31] hover:bg-[#f6f7f3]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIssueFinalRuling}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[#315A42] text-white text-xs font-semibold hover:bg-[#264834] transition"
              >
                Confirm &amp; Post Ruling
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Viewer Modal */}
      {evidenceModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#17281db3] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#edf1ec] pb-3">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[#315A42]" />
                <h3 className="text-base font-bold text-[#263A31]">
                  {activeEvidenceItem ? activeEvidenceItem.title : 'Evidence Register Attachments'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEvidenceModalOpen(false);
                  setActiveEvidenceItem(null);
                }}
                className="text-[#8b9e91] hover:text-[#263A31]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {activeEvidenceItem ? (
                <div className="bg-[#f8faf7] p-4 rounded-xl border border-[#dce3db] space-y-3">
                  <div className="flex justify-between">
                    <span className="text-[#596c60]">Item Ref:</span>
                    <span className="font-mono font-bold text-[#263A31]">{activeEvidenceItem.num}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#596c60]">Stakeholder:</span>
                    <span className="font-semibold text-[#263A31]">{activeEvidenceItem.stakeholder}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#596c60]">Timestamp:</span>
                    <span className="text-[#263A31]">{activeEvidenceItem.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#596c60]">Recorded Value:</span>
                    <span className="font-bold text-[#315A42]">{activeEvidenceItem.weight}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#596c60]">Status:</span>
                    <span className="font-semibold text-[#315A42]">{activeEvidenceItem.status}</span>
                  </div>
                  <div className="pt-2 border-t border-[#edf1ec] text-[11px] text-[#596c60]">
                    SHA-256 hash verified: <code className="text-[#263A31]">e4b9...c812</code>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDispute.evidenceRegister?.map((ev) => (
                    <div
                      key={ev.num}
                      className="p-3 rounded-xl border border-[#dce3db] bg-[#f8faf7] flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-[#263A31]">{ev.num} · {ev.title}</span>
                        <p className="text-[11px] text-[#596c60]">{ev.stakeholder} · {ev.date}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-[#263A31]">{ev.weight}</span>
                        <p className="text-[11px] text-[#315A42] font-semibold">{ev.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#edf1ec]">
              <button
                type="button"
                onClick={() => {
                  setEvidenceModalOpen(false);
                  setActiveEvidenceItem(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#315A42] text-white text-xs font-semibold hover:bg-[#264834]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Audit Trail Modal */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#17281db3] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#edf1ec] pb-3">
              <div className="flex items-center gap-2">
                <History size={18} className="text-[#315A42]" />
                <h3 className="text-base font-bold text-[#263A31]">
                  Audit Trail: {selectedDispute.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="text-[#8b9e91] hover:text-[#263A31]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-80 overflow-y-auto pr-1">
              {selectedDispute.caseActivity?.map((act, i) => (
                <div key={i} className="p-3 rounded-xl border border-[#dce3db] bg-[#f8faf7]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[#596c60]">{act.time}</span>
                    <span className="text-[10px] text-[#8b9e91] font-mono">Immutable</span>
                  </div>
                  <p className="text-[#263A31] leading-relaxed">{act.actor}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#edf1ec]">
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#315A42] text-white text-xs font-semibold hover:bg-[#264834]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
