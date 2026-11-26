import { useState, useEffect, useMemo } from 'react';
import {
  TriangleAlert,
  AlertCircle,
  Clock,
  ShieldCheck,
  RotateCw,
  Download,
  Search,
  SlidersHorizontal,
  MoreHorizontal,
  CheckCircle2,
  FileText,
  ChevronRight,
  ExternalLink,
  X,
  AlertTriangle
} from 'lucide-react';
import {
  fetchIncidentsStats,
  fetchIncidents,
  resolveIncidentApi,
  type IncidentItem,
  type IncidentsStatsData
} from '../services/adminApi';
import { initialIncidents } from '../seedData';
import { Toast } from '../../../components/Toast';

export function IncidentReviewView() {
  const [stats, setStats] = useState<IncidentsStatsData | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>(initialIncidents);
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem>(initialIncidents[0]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'assigned_to_me' | 'escalated' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [drawerTab, setDrawerTab] = useState<'overview' | 'evidence' | 'audit'>('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastRefreshed, setLastRefreshed] = useState('14:32');
  const [toastMessage, setToastMessage] = useState('');

  // Resolution Modal
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolutionText, setResolutionText] = useState('');
  const [resolutionAction, setResolutionAction] = useState('partial_weight_adjustment');

  // Sync breadcrumb & hide default layout page-heading
  useEffect(() => {
    const heading = document.querySelector('.page-heading');
    if (heading) {
      (heading as HTMLElement).style.display = 'none';
    }
    const breadcrumb = document.querySelector('.workspace-breadcrumb');
    let prevHtml = '';
    if (breadcrumb) {
      prevHtml = breadcrumb.innerHTML;
      breadcrumb.innerHTML = '<span class="text-[#596c60]">Admin</span> <span class="mx-1 text-[#8b9e91]">/</span> <strong class="text-[#263A31] font-semibold">Incident review</strong>';
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
    setLoading(true);
    try {
      const statsData = await fetchIncidentsStats();
      if (statsData) setStats(statsData);
      const incData = await fetchIncidents({ tab: activeTab, stage: stageFilter, status: statusFilter, search: searchQuery });
      if (incData && incData.length > 0) {
        setIncidents(incData);
        if (!selectedIncident || !incData.find((i: IncidentItem) => i.id === selectedIncident.id)) {
          setSelectedIncident(incData[0]);
        }
      }
      const now = new Date();
      setLastRefreshed(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // Keep resilient with seedData
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, stageFilter, statusFilter]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, stageFilter, statusFilter, searchQuery]);

  // Master filtered incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((item) => {
      if (activeTab === 'assigned_to_me' && item.assignedTo !== 'N. Perera') return false;
      if (activeTab === 'escalated' && item.status !== 'escalated') return false;
      if (activeTab === 'resolved' && item.status !== 'resolved') return false;

      if (stageFilter !== 'all' && !item.stage.toLowerCase().includes(stageFilter.toLowerCase())) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.id.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.linkedRecord.toLowerCase().includes(q) ||
          item.assignedTo.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [incidents, activeTab, stageFilter, statusFilter, searchQuery]);

  // Pagination (6 items per page matching design)
  const pageSize = 6;
  const totalCount = filteredIncidents.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);

  const displayedIncidents = useMemo(() => {
    return filteredIncidents.slice(startIndex, startIndex + pageSize);
  }, [filteredIncidents, startIndex, pageSize]);

  const handleExport = () => {
    const headers = ['Incident ID', 'Title', 'Category', 'Linked Record', 'Priority', 'Assigned To', 'Status', 'SLA'];
    const rows = filteredIncidents.map((i) => [
      i.id,
      `"${i.title}"`,
      `"${i.category}"`,
      `"${i.linkedRecord}"`,
      i.priorityLabel,
      `"${i.assignedTo}"`,
      i.statusLabel,
      `"${i.slaText}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `yieldmatrix_incidents_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMessage(`Exported ${filteredIncidents.length} incidents to CSV`);
  };

  const handleConfirmResolve = async () => {
    if (!selectedIncident || !resolutionText.trim()) return;
    await resolveIncidentApi(selectedIncident.id, {
      resolution: resolutionText,
      actionTaken: resolutionAction
    });

    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === selectedIncident.id
          ? {
              ...inc,
              status: 'resolved',
              statusLabel: 'Resolved',
              auditActivity: [
                {
                  time: 'Just now',
                  action: `Resolved via ${resolutionAction.replace(/_/g, ' ')}`,
                  details: resolutionText
                },
                ...inc.auditActivity
              ]
            }
          : inc
      )
    );

    setSelectedIncident((prev) => ({
      ...prev,
      status: 'resolved',
      statusLabel: 'Resolved',
      auditActivity: [
        {
          time: 'Just now',
          action: `Resolved via ${resolutionAction.replace(/_/g, ' ')}`,
          details: resolutionText
        },
        ...prev.auditActivity
      ]
    }));

    setToastMessage(`Incident ${selectedIncident.id} resolved successfully.`);
    setResolveModalOpen(false);
    setResolutionText('');
  };

  return (
    <div className="ym26-incident-review w-full space-y-6">
      {/* Toast Notification */}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-[28px] font-bold text-[#1e2f24] tracking-tight">
              Incident review
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#eaf2e8] text-[#315A42]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#315A42]" />
              <span>LIVE OPERATIONS</span>
            </span>
          </div>
          <p className="text-xs md:text-sm text-[#596c60] mt-1">
            Investigate exceptions. Preserve evidence. Keep the harvest moving.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="h-9 px-3.5 rounded-lg border border-[#d2d9d0] bg-white text-[#263A31] hover:bg-[#f6f8f5] text-xs font-semibold flex items-center gap-2 transition shadow-2xs cursor-pointer"
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="h-9 px-3.5 rounded-lg bg-[#315A42] text-white hover:bg-[#274834] text-xs font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer"
            >
              <Download size={14} />
              <span>Export incident report</span>
            </button>
          </div>
          <span className="text-[11px] text-[#718276] text-right font-normal">
            Last synced today at {lastRefreshed} · Sri Lanka time
          </span>
        </div>
      </div>

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open incidents */}
        <div className="bg-white border border-[#e2e7e1] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#596c60] text-xs font-semibold">
            <span>Open incidents</span>
            <TriangleAlert size={18} className="text-[#315A42] stroke-[1.75]" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-[#1e2f24] tracking-tight">
              {stats?.openIncidents ?? 24}
            </span>
          </div>
          <p className="text-xs text-[#718276] mt-2">
            {stats?.openSubtext ?? 'Across 5 operational stages'}
          </p>
        </div>

        {/* High priority */}
        <div className="bg-white border border-[#e2e7e1] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#596c60] text-xs font-semibold">
            <span>High priority</span>
            <AlertCircle size={18} className="text-[#854500] stroke-[1.75]" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-[#1e2f24] tracking-tight">
              {String(stats?.highPriority ?? 6).padStart(2, '0')}
            </span>
          </div>
          <p className="text-xs text-[#718276] mt-2">
            {stats?.highPrioritySubtext ?? '2 require immediate review'}
          </p>
        </div>

        {/* SLA overdue */}
        <div className="bg-white border border-[#e2e7e1] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#596c60] text-xs font-semibold">
            <span>SLA overdue</span>
            <Clock size={18} className="text-[#854500] stroke-[1.75]" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-[#1e2f24] tracking-tight">
              {String(stats?.slaOverdue ?? 4).padStart(2, '0')}
            </span>
          </div>
          <p className="text-xs text-[#718276] mt-2">
            {stats?.slaOverdueSubtext ?? 'Oldest incident: 5h 24m'}
          </p>
        </div>

        {/* Median resolution */}
        <div className="bg-white border border-[#e2e7e1] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#596c60] text-xs font-semibold">
            <span>Median resolution</span>
            <ShieldCheck size={18} className="text-[#315A42] stroke-[1.75]" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-[#1e2f24] tracking-tight">
              {stats?.medianResolution ?? '2h 18m'}
            </span>
          </div>
          <p className="text-xs text-[#718276] mt-2">
            {stats?.resolutionSubtext ?? '↓ 18% vs. previous 7 days'}
          </p>
        </div>
      </div>

      {/* SLA Alert Warning Banner */}
      <div className="bg-[#fff4eb] border border-[#fbd9c4] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#ffe7d6] text-[#854500] flex items-center justify-center shrink-0">
            <TriangleAlert size={17} />
          </div>
          <div>
            <span className="text-xs sm:text-sm font-bold text-[#854500]">
              4 incidents are past their review SLA.{' '}
            </span>
            <span className="text-xs text-[#718276]">
              Prioritize overdue cases to protect perishable shipments.
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setStatusFilter('all');
            setStageFilter('all');
            setActiveTab('all');
            setSearchQuery('overdue');
          }}
          className="text-xs font-bold text-[#854500] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <span>View overdue</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Split Main Section: Left = Queue (~65%), Right = Selected Details (~35%) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left Column: Incident queue (7 or 8 cols) */}
        <div className="xl:col-span-7 bg-white border border-[#e2e7e1] rounded-2xl p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header: Title, Badge & Sort note */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h3 className="text-base font-bold text-[#1e2f24]">Incident queue</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#eaf2e8] text-[#315A42] ml-2">
                  24 open
                </span>
              </div>
              <span className="text-[11px] text-[#718276]">
                Sorted by priority, then oldest first
              </span>
            </div>

            {/* Underline Tabs Row */}
            <div className="flex items-center gap-6 border-b border-[#e2e7e1] text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('all');
                  setSearchQuery('');
                }}
                className={`pb-2.5 flex items-center gap-1.5 cursor-pointer transition ${
                  activeTab === 'all'
                    ? 'border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px'
                    : 'text-[#596c60] hover:text-[#1e2f24] font-medium'
                }`}
              >
                <span>All incidents</span>
                <span className="text-[11px] text-[#718276]">24</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('assigned_to_me');
                  setSearchQuery('');
                }}
                className={`pb-2.5 flex items-center gap-1.5 cursor-pointer transition ${
                  activeTab === 'assigned_to_me'
                    ? 'border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px'
                    : 'text-[#596c60] hover:text-[#1e2f24] font-medium'
                }`}
              >
                <span>Assigned to me</span>
                <span className="text-[11px] text-[#718276]">08</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('escalated');
                  setSearchQuery('');
                }}
                className={`pb-2.5 flex items-center gap-1.5 cursor-pointer transition ${
                  activeTab === 'escalated'
                    ? 'border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px'
                    : 'text-[#596c60] hover:text-[#1e2f24] font-medium'
                }`}
              >
                <span>Escalated</span>
                <span className="text-[11px] text-[#718276]">03</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('resolved');
                  setSearchQuery('');
                }}
                className={`pb-2.5 flex items-center gap-1.5 cursor-pointer transition ${
                  activeTab === 'resolved'
                    ? 'border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px'
                    : 'text-[#596c60] hover:text-[#1e2f24] font-medium'
                }`}
              >
                <span>Resolved</span>
                <span className="text-[11px] text-[#718276]">128</span>
              </button>
            </div>

            {/* Filter Controls Row */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718276]" />
                <input
                  type="text"
                  placeholder="Search incident, order, or entity..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#d2d9d0] bg-white text-xs text-[#1e2f24] placeholder-[#8a9b8e] focus:outline-none focus:ring-1 focus:ring-[#315A42]"
                />
              </div>

              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-[#d2d9d0] bg-white text-xs text-[#263A31] focus:outline-none focus:ring-1 focus:ring-[#315A42] cursor-pointer"
              >
                <option value="all">All stages</option>
                <option value="supplier">Supplier allocation</option>
                <option value="warehouse">Warehouse pickup</option>
                <option value="fleet">Fleet dispatch</option>
                <option value="buyer">Buyer delivery</option>
                <option value="order">Customer order</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-[#d2d9d0] bg-white text-xs text-[#263A31] focus:outline-none focus:ring-1 focus:ring-[#315A42] cursor-pointer"
              >
                <option value="all">All statuses</option>
                <option value="in_review">In review</option>
                <option value="new">New</option>
                <option value="awaiting_evidence">Awaiting evidence</option>
                <option value="escalated">Escalated</option>
                <option value="resolved">Resolved</option>
              </select>

              <button
                type="button"
                className="h-8 px-3 rounded-lg border border-[#d2d9d0] bg-white text-xs font-medium text-[#263A31] flex items-center gap-1.5 hover:bg-[#f6f8f5] transition cursor-pointer"
              >
                <SlidersHorizontal size={13} className="text-[#596c60]" />
                <span>More filters</span>
              </button>
            </div>

            {/* Incidents Table */}
            <div className="border border-[#e2e7e1] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-[#f4f6f3] text-[#596c60] text-[11px] font-semibold border-b border-[#e2e7e1]">
                      <th className="p-3">INCIDENT / CATEGORY</th>
                      <th className="p-3">LINKED RECORD</th>
                      <th className="p-3">PRIORITY</th>
                      <th className="p-3">ASSIGNED TO</th>
                      <th className="p-3">STATUS / SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0ec]">
                    {displayedIncidents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-[#718276]">
                          No incidents match the active filters.
                        </td>
                      </tr>
                    ) : (
                      displayedIncidents.map((item) => {
                        const isSelected = selectedIncident.id === item.id;
                        const isHigh = item.priority === 'high';
                        const isMedium = item.priority === 'medium';
                        const isOverdue = item.slaText.toLowerCase().includes('overdue');

                        // Status badge colors
                        let statusBadgeClass = 'bg-[#f0f3ef] text-[#4f6155]';
                        if (item.status === 'in_review') {
                          statusBadgeClass = 'bg-[#eaf2e8] text-[#315A42]';
                        } else if (item.status === 'new') {
                          statusBadgeClass = 'bg-[#fff0e3] text-[#854500]';
                        } else if (item.status === 'awaiting_evidence') {
                          statusBadgeClass = 'bg-[#e8f2f8] text-[#245b80]';
                        } else if (item.status === 'escalated') {
                          statusBadgeClass = 'bg-[#fcebea] text-[#a51c19]';
                        }

                        return (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedIncident(item)}
                            className={`cursor-pointer transition ${
                              isSelected ? 'bg-[#f4f7f4]' : 'hover:bg-[#f9faf8]'
                            }`}
                          >
                            {/* Incident / Category */}
                            <td className="p-3">
                              <p className="font-bold text-xs text-[#1e2f24]">
                                {item.title}
                              </p>
                              <p className="text-[11px] text-[#718276] mt-0.5">
                                {item.id} · {item.category}
                              </p>
                            </td>

                            {/* Linked Record */}
                            <td className="p-3">
                              <p className="font-bold text-xs text-[#1e2f24]">
                                {item.linkedRecord}
                              </p>
                              <p className="text-[11px] text-[#718276] mt-0.5">
                                {item.linkedRecordType}
                              </p>
                            </td>

                            {/* Priority */}
                            <td className="p-3">
                              <div className="flex items-center gap-1.5 font-medium text-xs text-[#1e2f24]">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isHigh ? 'bg-[#b43b37]' : isMedium ? 'bg-[#e08a3c]' : 'bg-[#718276]'
                                  }`}
                                />
                                <span>{item.priorityLabel}</span>
                              </div>
                            </td>

                            {/* Assigned To */}
                            <td className="p-3">
                              <p className={`font-semibold text-xs ${item.assignedTo === 'Unassigned' ? 'text-[#854500]' : 'text-[#1e2f24]'}`}>
                                {item.assignedTo}
                              </p>
                              <p className="text-[11px] text-[#718276] mt-0.5">
                                {item.department}
                              </p>
                            </td>

                            {/* Status / SLA */}
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadgeClass}`}>
                                {item.statusLabel}
                              </span>
                              <p
                                className={`text-[11px] mt-0.5 ${
                                  isOverdue ? 'text-[#a51c19] font-medium' : 'text-[#718276]'
                                }`}
                              >
                                {item.slaText}
                              </p>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-3 text-xs text-[#718276]">
            <span>
              Showing {totalCount > 0 ? startIndex + 1 : 0}-{endIndex} of {totalCount} open incidents
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-6 h-6 rounded-md border border-[#d2d9d0] flex items-center justify-center text-[#596c60] hover:bg-[#f6f8f5] disabled:opacity-30 cursor-pointer"
              >
                &lt;
              </button>

              {[1, 2, 3, 4].map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold cursor-pointer ${
                    currentPage === page
                      ? 'bg-[#eef2ec] text-[#1e2f24] font-bold'
                      : 'text-[#596c60] hover:bg-[#f6f8f5]'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="w-6 h-6 rounded-md border border-[#d2d9d0] flex items-center justify-center text-[#596c60] hover:bg-[#f6f8f5] disabled:opacity-30 cursor-pointer"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Incident Detail Panel (~5 cols) */}
        <div className="xl:col-span-5 bg-white border border-[#e2e7e1] rounded-2xl p-6 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Top Bar: ID, Priority badge, More options */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#596c60]">
                {selectedIncident.id}
              </span>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#fff0e3] text-[#854500]">
                  {selectedIncident.priorityLabel} priority
                </span>
                <button
                  type="button"
                  className="w-6 h-6 rounded flex items-center justify-center text-[#718276] hover:text-[#1e2f24] hover:bg-[#f6f8f5] cursor-pointer"
                >
                  <MoreHorizontal size={15} />
                </button>
              </div>
            </div>

            {/* Title & Description */}
            <div>
              <h2 className="text-lg font-bold text-[#1e2f24]">
                {selectedIncident.title}
              </h2>
              <p className="text-xs text-[#596c60] mt-1 leading-relaxed">
                {selectedIncident.description}
              </p>
            </div>

            {/* Status & Assigned To Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#eaf2e8] text-[#315A42]">
                {selectedIncident.statusLabel}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f0f3ef] text-[#4f6155]">
                Assigned to {selectedIncident.assignedTo}
              </span>
            </div>

            {/* Sub-Tabs: Case overview, Evidence 4, Audit trail */}
            <div className="flex items-center gap-6 border-b border-[#e2e7e1] text-xs pt-2">
              <button
                type="button"
                onClick={() => setDrawerTab('overview')}
                className={`pb-2.5 cursor-pointer transition ${
                  drawerTab === 'overview'
                    ? 'border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px'
                    : 'text-[#596c60] hover:text-[#1e2f24] font-medium'
                }`}
              >
                Case overview
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('evidence')}
                className={`pb-2.5 flex items-center gap-1 cursor-pointer transition ${
                  drawerTab === 'evidence'
                    ? 'border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px'
                    : 'text-[#596c60] hover:text-[#1e2f24] font-medium'
                }`}
              >
                <span>Evidence</span>
                <span className="text-[11px] text-[#718276]">
                  {selectedIncident.evidence?.length > 0 ? selectedIncident.evidence.length : 4}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('audit')}
                className={`pb-2.5 cursor-pointer transition ${
                  drawerTab === 'audit'
                    ? 'border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px'
                    : 'text-[#596c60] hover:text-[#1e2f24] font-medium'
                }`}
              >
                Audit trail
              </button>
            </div>

            {/* Tab: Case Overview */}
            {drawerTab === 'overview' && (
              <div className="space-y-4 pt-1 text-xs">
                {/* Linked Supply Chain Box */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-[#718276] mb-1.5 uppercase font-semibold tracking-wider">
                    <span>LINKED SUPPLY CHAIN</span>
                    <button
                      type="button"
                      onClick={() => setToastMessage(`Navigating to supply chain relations for ${selectedIncident.linkedRecord}`)}
                      className="text-[#315A42] hover:underline flex items-center gap-0.5 normal-case font-normal text-[11px] cursor-pointer"
                    >
                      <span>View relationships</span>
                      <ExternalLink size={10} />
                    </button>
                  </div>

                  <div className="p-3 rounded-xl border border-[#e2e7e1] bg-[#f9faf8] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#1e2f24]">
                        {selectedIncident.linkedRecord}
                      </span>
                      <span className="text-[11px] text-[#718276]">
                        Ceylon Grain Co. · Brown rice
                      </span>
                    </div>
                    <div className="text-[11px] text-[#596c60] flex items-center gap-1 font-mono">
                      <span>AL-0924</span>
                      <span>→</span>
                      <span>DP-0819</span>
                      <span>→</span>
                      <span>PK-0486</span>
                      <span>→</span>
                      <span>DL-0318</span>
                    </div>
                  </div>
                </div>

                {/* Weight Variance 3-column Box */}
                <div className="grid grid-cols-3 gap-2 p-3.5 rounded-xl bg-[#edf3ee] text-center">
                  <div>
                    <span className="text-[10px] text-[#596c60] uppercase font-semibold tracking-wider block">
                      DISPATCHED
                    </span>
                    <span className="text-sm font-bold text-[#1e2f24] mt-1 block">
                      {selectedIncident.weights?.dispatchedDisplay || '12.0 t'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#596c60] uppercase font-semibold tracking-wider block">
                      RECEIVED
                    </span>
                    <span className="text-sm font-bold text-[#1e2f24] mt-1 block">
                      {selectedIncident.weights?.receivedDisplay || '11.4 t'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#596c60] uppercase font-semibold tracking-wider block">
                      VARIANCE
                    </span>
                    <span className="text-sm font-bold text-[#a51c19] mt-1 block">
                      {selectedIncident.weights?.varianceDisplay || '-0.6 t / 5%'}
                    </span>
                  </div>
                </div>

                {/* Evidence & Chain of Custody */}
                <div>
                  <div className="flex items-center justify-between text-xs text-[#1e2f24] font-bold mb-2">
                    <span>Evidence &amp; chain of custody</span>
                    <button
                      type="button"
                      onClick={() => setDrawerTab('evidence')}
                      className="text-[#315A42] hover:underline font-normal text-xs flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>4 items</span>
                      <ExternalLink size={10} />
                    </button>
                  </div>

                  <div className="p-3 rounded-xl border border-[#e2e7e1] bg-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#fcebea] text-[#a51c19] font-bold text-[10px] flex items-center justify-center shrink-0">
                        PDF
                      </div>
                      <div>
                        <p className="font-bold text-xs text-[#1e2f24]">
                          Signed delivery receipt
                        </p>
                        <p className="text-[11px] text-[#718276] mt-0.5">
                          Driver upload · 13:08 · SHA-256 verified
                        </p>
                      </div>
                    </div>
                    <CheckCircle2 size={16} className="text-[#315A42] shrink-0" />
                  </div>

                  <p className="text-[11px] text-[#718276] mt-1.5">
                    Originals retained · 3 more items in evidence
                  </p>
                </div>

                {/* Latest Audit Activity */}
                <div>
                  <div className="flex items-center justify-between text-xs text-[#1e2f24] font-bold mb-2">
                    <span>Latest audit activity</span>
                    <span className="text-[11px] text-[#718276] font-normal">
                      Append-only
                    </span>
                  </div>

                  <div className="space-y-2.5 border-l-2 border-[#d2d9d0] ml-2 pl-3">
                    <div className="relative text-xs">
                      <span className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-[#1e2f24]" />
                      <p className="font-bold text-[#1e2f24]">Review started by N. Perera</p>
                      <p className="text-[#718276] text-[11px] mt-0.5">
                        13:50 · Status changed: New → In review
                      </p>
                    </div>

                    <div className="relative text-xs">
                      <span className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-[#854500]" />
                      <p className="font-bold text-[#1e2f24]">Incident raised by delivery exception</p>
                      <p className="text-[#718276] text-[11px] mt-0.5">
                        13:12 · Reported by D. Kumara · Driver
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Evidence */}
            {drawerTab === 'evidence' && (
              <div className="space-y-3 pt-1 text-xs">
                {selectedIncident.evidence?.length > 0 ? (
                  selectedIncident.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-xl border border-[#e2e7e1] bg-white flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#eaf2e8] text-[#315A42] font-bold text-[10px] flex items-center justify-center shrink-0">
                          {ev.type}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-[#1e2f24]">{ev.title}</p>
                          <p className="text-[11px] text-[#718276] mt-0.5">{ev.note}</p>
                        </div>
                      </div>
                      <CheckCircle2 size={16} className="text-[#315A42] shrink-0" />
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#718276] p-4 text-center">
                    No evidence files attached to this incident.
                  </p>
                )}
              </div>
            )}

            {/* Tab: Audit Trail */}
            {drawerTab === 'audit' && (
              <div className="space-y-3 pt-1 text-xs">
                {selectedIncident.auditActivity?.map((act, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-[#e2e7e1] bg-[#f9faf8] space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#1e2f24]">{act.action}</span>
                      <span className="text-[#718276]">{act.time}</span>
                    </div>
                    <p className="text-[11px] text-[#596c60]">{act.details}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Action Button */}
          <div className="border-t border-[#e2e7e1] pt-4">
            <button
              type="button"
              onClick={() => setResolveModalOpen(true)}
              className="w-full h-10 rounded-xl bg-[#315A42] text-white font-semibold text-xs hover:bg-[#274834] transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <span>Open investigation &amp; resolve</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Resolve Incident Modal */}
      {resolveModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#17281db3] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e2e7e1] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#1e2f24]">
                  Resolve Incident {selectedIncident.id}
                </h3>
                <p className="text-xs text-[#596c60] mt-0.5">
                  Linked Record: {selectedIncident.linkedRecord} · {selectedIncident.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResolveModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#eaf2e8] text-[#596c60] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#1e2f24] mb-1">
                  Resolution Protocol Action *
                </label>
                <select
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#d2d9d0] text-xs text-[#1e2f24] focus:outline-none focus:ring-1 focus:ring-[#315A42]"
                >
                  <option value="partial_weight_adjustment">Partial Weight Adjustment (Reweigh Verified)</option>
                  <option value="full_supplier_hold">Supplier Hold &amp; Buffer Stock Replacement</option>
                  <option value="escalate_dispute">Escalate to Official Formal Dispute (FR-DIS-01)</option>
                  <option value="dismiss_verified_tolerance">Dismiss within Commercial Tolerance (&lt;1%)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#1e2f24] mb-1">
                  Resolution Rationale &amp; Evidence Summary *
                </label>
                <textarea
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Record verified weighbridge scale certificate, buyer concurrence, and credit adjustment notes..."
                  className="w-full h-24 p-3 rounded-lg border border-[#d2d9d0] text-xs text-[#1e2f24] placeholder-[#8a9b8e] focus:outline-none focus:ring-1 focus:ring-[#315A42]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#e2e7e1]">
              <button
                type="button"
                onClick={() => setResolveModalOpen(false)}
                className="px-3.5 py-2 rounded-lg border border-[#d2d9d0] text-xs font-semibold text-[#263A31] hover:bg-[#f6f8f5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                disabled={!resolutionText.trim()}
                className="px-4 py-2 rounded-lg bg-[#315A42] text-white text-xs font-semibold hover:bg-[#274834] disabled:opacity-50 transition cursor-pointer"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
