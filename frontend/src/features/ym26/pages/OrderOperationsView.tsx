import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Package,
  Clock,
  Truck,
  TriangleAlert,
  RotateCw,
  Download,
  Search,
  SlidersHorizontal,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  ArrowUpDown,
  X,
  Calendar,
  Info,
  CheckCircle2
} from 'lucide-react';
import {
  fetchOrdersStats,
  fetchOrders,
  cancelOrderApi,
  type OrderItem,
  type OrdersStatsData
} from '../services/adminApi';
import { initialOrders } from '../seedData';
import { Toast } from '../../../components/Toast';

export function OrderOperationsView() {
  const [stats, setStats] = useState<OrdersStatsData | null>(null);
  const [allOrdersData, setAllOrdersData] = useState<OrderItem[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'awaiting_confirmation' | 'in_fulfilment' | 'exceptions'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [commodityFilter, setCommodityFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<OrderItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [activeMenuOrderId, setActiveMenuOrderId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState('14:32');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Sync breadcrumbs & hide default workspace duplicate header
  useEffect(() => {
    const heading = document.querySelector('.page-heading');
    if (heading) {
      (heading as HTMLElement).style.display = 'none';
    }
    const breadcrumb = document.querySelector('.workspace-breadcrumb');
    let prevHtml = '';
    if (breadcrumb) {
      prevHtml = breadcrumb.innerHTML;
      breadcrumb.innerHTML = '<span class="text-[#596c60]">Admin</span> <span class="mx-1 text-[#8b9e91]">/</span> <strong class="text-[#263A31] font-semibold">Order Operations</strong>';
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

  // Close open action menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuOrderId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const statsData = await fetchOrdersStats();
      if (statsData) {
        setStats(statsData);
      }
      const ordersData = await fetchOrders({
        status: activeTab,
        search: searchQuery,
        commodity: commodityFilter !== 'all' ? commodityFilter : undefined,
        limit: 150
      });
      if (ordersData && ordersData.orders && ordersData.orders.length > 0) {
        setAllOrdersData(ordersData.orders);
      }
      const now = new Date();
      setLastRefreshed(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // Keep state resilient with seedData
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Reset to page 1 on filter/tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, statusFilter, commodityFilter, supplierFilter, searchQuery]);

  // Master filtered orders
  const filteredOrders = useMemo(() => {
    return allOrdersData.filter((order) => {
      // Tab filter
      if (activeTab === 'awaiting_confirmation' && order.status !== 'awaiting_confirmation') return false;
      if (activeTab === 'in_fulfilment' && order.status !== 'in_fulfilment') return false;
      if (activeTab === 'exceptions' && order.status !== 'exception' && order.status !== 'cancelled') return false;

      // Status dropdown
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

      // Commodity filter
      if (commodityFilter !== 'all') {
        const comm = order.commodity.toLowerCase();
        if (commodityFilter === 'rice' && !comm.includes('rice')) return false;
        if (commodityFilter === 'lentils' && !comm.includes('lentil')) return false;
        if (commodityFilter === 'maize' && !comm.includes('maize')) return false;
        if (commodityFilter === 'gram' && !comm.includes('gram')) return false;
        if (commodityFilter === 'flour' && !comm.includes('flour')) return false;
      }

      // Supplier filter
      if (supplierFilter !== 'all') {
        const s = supplierFilter.toLowerCase().replace(/_/g, ' ');
        const hasSupplier = order.suppliers?.some(
          (sup) => sup.name.toLowerCase().includes(s) || s.includes(sup.name.toLowerCase().split(' ')[0])
        );
        if (!hasSupplier) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          order.id.toLowerCase().includes(q) ||
          order.buyer.toLowerCase().includes(q) ||
          order.commodity.toLowerCase().includes(q) ||
          order.buyerLocation.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [allOrdersData, activeTab, statusFilter, commodityFilter, supplierFilter, searchQuery]);

  // Paginated orders (6 per page matching design)
  const pageSize = 6;
  const totalCount = filteredOrders.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);

  const displayedOrders = useMemo(() => {
    const list = [...filteredOrders];
    if (sortDirection === 'asc') {
      list.sort((a, b) => a.id.localeCompare(b.id));
    } else {
      list.sort((a, b) => b.id.localeCompare(a.id));
    }
    return list.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, currentPage, sortDirection, startIndex, pageSize]);

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === displayedOrders.length && displayedOrders.length > 0) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(displayedOrders.map((o) => o.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExport = () => {
    const headers = ['Order ID', 'Buyer', 'Location', 'Commodity', 'Grade', 'Quantity', 'Status', 'Delivery Due'];
    const rows = filteredOrders.map((o) => [
      `"${o.id}"`,
      `"${o.buyer}"`,
      `"${o.buyerLocation}"`,
      `"${o.commodity}"`,
      `"${o.grade}"`,
      `"${o.quantityDisplay}"`,
      `"${o.statusLabel}"`,
      `"${o.deliveryDueDisplay}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `yieldmatrix_orders_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMessage(`Exported ${filteredOrders.length} orders successfully (CSV)`);
  };

  const handleConfirmCancel = async () => {
    if (!orderToCancel || !cancelReason.trim()) return;
    await cancelOrderApi(orderToCancel.id, cancelReason);
    setAllOrdersData((prev) =>
      prev.map((o) =>
        o.id === orderToCancel.id
          ? { ...o, status: 'cancelled', statusLabel: 'Cancelled', cancellationReason: cancelReason }
          : o
      )
    );
    setToastMessage(`Order ${orderToCancel.id} cancelled. Allocations and holds released.`);
    setOrderToCancel(null);
    setCancelReason('');
    setActiveMenuOrderId(null);
  };

  return (
    <div className="ym26-order-operations w-full space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage('')} />
      )}

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold text-[#1e2f24] tracking-tight">
            Order Operations
          </h1>
          <p className="text-xs md:text-sm text-[#596c60] mt-1">
            Monitor, manage and oversee all platform orders and supplier allocations.
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
              <span>Export orders</span>
            </button>
          </div>
          <span className="text-[11px] text-[#718276] text-right font-normal">
            Last updated today at {lastRefreshed}
          </span>
        </div>
      </div>

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active Orders */}
        <div className="bg-white border border-[#e2e7e1] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#596c60] text-xs font-semibold">
            <span>Total Active Orders</span>
            <Package size={18} className="text-[#315A42] stroke-[1.75]" />
          </div>
          <div className="flex items-baseline gap-2.5 mt-3">
            <span className="text-3xl font-extrabold text-[#1e2f24] tracking-tight">
              {stats?.totalActiveOrders ?? 148}
            </span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold bg-[#eaf2e8] text-[#315A42]">
              ▲ {stats?.activeChangePercent?.replace('+', '').trim() ?? '12.4%'}
            </span>
          </div>
          <p className="text-xs text-[#718276] mt-2">Across all suppliers and buyers</p>
        </div>

        {/* Awaiting Supplier Confirmation */}
        <div className="bg-white border border-[#e2e7e1] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#596c60] text-xs font-semibold">
            <span>Awaiting Supplier Confirmation</span>
            <Clock size={18} className="text-[#596c60] stroke-[1.75]" />
          </div>
          <div className="flex items-baseline gap-2.5 mt-3">
            <span className="text-3xl font-extrabold text-[#1e2f24] tracking-tight">
              {stats?.awaitingConfirmation ?? 32}
            </span>
          </div>
          <p className="text-xs text-[#718276] mt-2">
            {stats?.awaitingOverdueCount ?? 8} awaiting for more than 24h
          </p>
        </div>

        {/* Orders in Fulfilment */}
        <div className="bg-white border border-[#e2e7e1] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#596c60] text-xs font-semibold">
            <span>Orders in Fulfilment</span>
            <Truck size={18} className="text-[#596c60] stroke-[1.75]" />
          </div>
          <div className="flex items-baseline gap-2.5 mt-3">
            <span className="text-3xl font-extrabold text-[#1e2f24] tracking-tight">
              {stats?.inFulfilment ?? 86}
            </span>
          </div>
          <p className="text-xs text-[#718276] mt-2">
            {stats?.scheduledTodayCount ?? 23} scheduled for delivery today
          </p>
        </div>

        {/* Open Order Exceptions */}
        <div className="bg-white border border-[#e2e7e1] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#596c60] text-xs font-semibold">
            <span>Open Order Exceptions</span>
            <TriangleAlert size={18} className="text-[#e08a3c] stroke-[1.75]" />
          </div>
          <div className="flex items-baseline gap-2.5 mt-3">
            <span className="text-3xl font-extrabold text-[#1e2f24] tracking-tight">
              {String(stats?.openExceptions ?? 7).padStart(2, '0')}
            </span>
          </div>
          <p className="text-xs text-[#c25e3a] mt-2 font-normal">
            {stats?.immediateAttentionCount ?? 3} require immediate attention
          </p>
        </div>
      </div>

      {/* Middle Overview Split: Order Pipeline + Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Order pipeline (spans 2 cols) */}
        <div className="lg:col-span-2 bg-white border border-[#e2e7e1] rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-[#1e2f24]">Order pipeline</h2>
              <span className="text-xs font-normal text-[#718276]">
                {stats?.totalActiveOrders ?? 148} active orders
              </span>
            </div>

            {/* Multi-Segment Stacked Progress Bar */}
            <div className="w-full h-6 rounded-md overflow-hidden flex bg-[#f0f3ee] mt-3">
              <div
                style={{ width: `${stats?.pipeline?.awaitingConfirmationPercent ?? 22}%` }}
                className="bg-[#b8cfbd] h-full flex items-center justify-center text-[11px] font-bold text-[#1e2f24] transition-all"
                title="Awaiting confirmation"
              >
                {stats?.pipeline?.awaitingConfirmationPercent ?? 22}%
              </div>
              <div
                style={{ width: `${stats?.pipeline?.allocatedPercent ?? 20}%` }}
                className="bg-[#72977f] h-full flex items-center justify-center text-[11px] font-bold text-white transition-all"
                title="Allocated"
              >
                {stats?.pipeline?.allocatedPercent ?? 20}%
              </div>
              <div
                style={{ width: `${stats?.pipeline?.inFulfilmentPercent ?? 58}%` }}
                className="bg-[#275238] h-full flex items-center justify-center text-[11px] font-bold text-white transition-all"
                title="In fulfilment"
              >
                {stats?.pipeline?.inFulfilmentPercent ?? 58}%
              </div>
            </div>
          </div>

          {/* Breakdown below bar (No line) */}
          <div className="grid grid-cols-3 gap-4 pt-6 mt-2">
            <div>
              <div className="flex items-center text-xs text-[#596c60] mb-1">
                <span className="w-2 h-2 rounded-full bg-[#b8cfbd] inline-block mr-1.5 shrink-0" />
                <span>Awaiting confirmation</span>
              </div>
              <p className="text-2xl font-bold text-[#1e2f24]">
                {stats?.pipeline?.awaitingConfirmationCount ?? 32}
              </p>
            </div>
            <div>
              <div className="flex items-center text-xs text-[#596c60] mb-1">
                <span className="w-2 h-2 rounded-full bg-[#72977f] inline-block mr-1.5 shrink-0" />
                <span>Allocated</span>
              </div>
              <p className="text-2xl font-bold text-[#1e2f24]">
                {stats?.pipeline?.allocatedCount ?? 30}
              </p>
            </div>
            <div>
              <div className="flex items-center text-xs text-[#596c60] mb-1">
                <span className="w-2 h-2 rounded-full bg-[#315A42] inline-block mr-1.5 shrink-0" />
                <span>In fulfilment</span>
              </div>
              <p className="text-2xl font-bold text-[#1e2f24]">
                {stats?.pipeline?.inFulfilmentCount ?? 86}{' '}
                <span className="text-xs font-normal text-[#718276] ml-1">orders in progress</span>
              </p>
            </div>
          </div>
        </div>

        {/* Needs your attention (1 col) */}
        <div className="bg-white border border-[#e2e7e1] rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-[#1e2f24] flex items-center gap-2">
              <Info size={16} className="text-[#596c60]" />
              <span>Needs your attention</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#fff0e3] text-[#854500]">
              7 open
            </span>
          </div>

          <div className="space-y-2 mt-2">
            <div
              onClick={() => setActiveTab('awaiting_confirmation')}
              className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-[#f6f8f5] transition cursor-pointer"
            >
              <div className="flex items-center text-sm text-[#1e2f24]">
                <span className="w-2 h-2 rounded-full bg-[#e08a3c] mr-2.5 shrink-0" />
                <span>Overdue confirmations</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-[#1e2f24]">
                <span>3</span>
                <ChevronRight size={14} className="text-[#718276]" />
              </div>
            </div>

            <div
              onClick={() => setActiveTab('exceptions')}
              className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-[#f6f8f5] transition cursor-pointer"
            >
              <div className="flex items-center text-sm text-[#1e2f24]">
                <span className="w-2 h-2 rounded-full bg-[#e08a3c] mr-2.5 shrink-0" />
                <span>Allocation shortfalls</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-[#1e2f24]">
                <span>2</span>
                <ChevronRight size={14} className="text-[#718276]" />
              </div>
            </div>

            <div
              onClick={() => setActiveTab('in_fulfilment')}
              className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-[#f6f8f5] transition cursor-pointer"
            >
              <div className="flex items-center text-sm text-[#1e2f24]">
                <span className="w-2 h-2 rounded-full bg-[#e08a3c] mr-2.5 shrink-0" />
                <span>Delivery at risk</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-[#1e2f24]">
                <span>2</span>
                <ChevronRight size={14} className="text-[#718276]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-white border border-[#e2e7e1] rounded-2xl p-6 shadow-2xs space-y-4">
        {/* Table Header: Heading + Supplier Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center">
            <h2 className="text-lg font-bold text-[#1e2f24]">Orders</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eef2ec] text-[#4f6155] ml-2">
              148
            </span>
          </div>

          <div>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="h-9 px-3.5 rounded-lg border border-[#d2d9d0] bg-white text-xs font-medium text-[#263A31] focus:outline-none focus:ring-1 focus:ring-[#315A42] cursor-pointer"
            >
              <option value="all">All suppliers</option>
              <option value="rajarata">Rajarata Rice Mills</option>
              <option value="lanka_agro">Lanka Agro Import Ltd</option>
              <option value="monaragala">Monaragala Corn Growers</option>
              <option value="polonnaruwa">Polonnaruwa Pure Rice</option>
            </select>
          </div>
        </div>

        {/* Sub-Tabs Row */}
        <div className="flex items-center gap-6 border-b border-[#e2e7e1] text-xs pt-1">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`pb-3 flex items-center gap-2 cursor-pointer transition ${
              activeTab === 'all'
                ? 'border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px'
                : 'text-[#596c60] hover:text-[#1e2f24] font-medium'
            }`}
          >
            <span>All active orders</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              activeTab === 'all' ? 'bg-[#eef2ec] text-[#4f6155]' : 'bg-[#f4f6f3] text-[#718276]'
            }`}>
              148
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('awaiting_confirmation')}
            className={`pb-3 flex items-center gap-2 cursor-pointer transition ${
              activeTab === 'awaiting_confirmation'
                ? 'border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px'
                : 'text-[#596c60] hover:text-[#1e2f24] font-medium'
            }`}
          >
            <span>Awaiting confirmation</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              activeTab === 'awaiting_confirmation' ? 'bg-[#eef2ec] text-[#4f6155]' : 'bg-[#f4f6f3] text-[#718276]'
            }`}>
              32
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('in_fulfilment')}
            className={`pb-3 flex items-center gap-2 cursor-pointer transition ${
              activeTab === 'in_fulfilment'
                ? 'border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px'
                : 'text-[#596c60] hover:text-[#1e2f24] font-medium'
            }`}
          >
            <span>In fulfilment</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              activeTab === 'in_fulfilment' ? 'bg-[#eef2ec] text-[#4f6155]' : 'bg-[#f4f6f3] text-[#718276]'
            }`}>
              86
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exceptions')}
            className={`pb-3 flex items-center gap-2 cursor-pointer transition ${
              activeTab === 'exceptions'
                ? 'border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px'
                : 'text-[#596c60] hover:text-[#1e2f24] font-medium'
            }`}
          >
            <span>Exceptions</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              activeTab === 'exceptions' ? 'bg-[#eef2ec] text-[#4f6155]' : 'bg-[#f4f6f3] text-[#718276]'
            }`}>
              7
            </span>
          </button>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {/* Search box */}
          <div className="relative flex-1 min-w-[280px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718276]" />
            <input
              type="text"
              placeholder="Search order ID, buyer or commodity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#d2d9d0] bg-white text-xs text-[#1e2f24] placeholder-[#8a9b8e] focus:outline-none focus:ring-1 focus:ring-[#315A42]"
            />
          </div>

          {/* Status select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[#d2d9d0] bg-white text-xs text-[#263A31] focus:outline-none focus:ring-1 focus:ring-[#315A42] cursor-pointer"
          >
            <option value="all">All statuses</option>
            <option value="awaiting_confirmation">Awaiting confirmation</option>
            <option value="in_fulfilment">In fulfilment</option>
            <option value="allocated">Allocated</option>
            <option value="exception">Exception</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Commodity select */}
          <select
            value={commodityFilter}
            onChange={(e) => setCommodityFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[#d2d9d0] bg-white text-xs text-[#263A31] focus:outline-none focus:ring-1 focus:ring-[#315A42] cursor-pointer"
          >
            <option value="all">Commodity</option>
            <option value="rice">Rice (Brown / Samba)</option>
            <option value="lentils">Red lentils</option>
            <option value="maize">Maize</option>
            <option value="gram">Green gram</option>
            <option value="flour">Wheat flour</option>
          </select>

          {/* Date range button */}
          <button
            type="button"
            className="h-9 px-3 rounded-lg border border-[#d2d9d0] bg-white text-xs text-[#263A31] flex items-center gap-1.5 hover:bg-[#f6f8f5] transition cursor-pointer"
          >
            <Calendar size={14} className="text-[#596c60]" />
            <span>Date range</span>
            <ChevronDown size={14} className="text-[#718276]" />
          </button>

          {/* Filters toggle button */}
          <button
            type="button"
            className="h-9 px-3.5 rounded-lg border border-[#d2d9d0] bg-white text-xs font-medium text-[#263A31] flex items-center gap-1.5 hover:bg-[#f6f8f5] transition cursor-pointer ml-auto"
          >
            <SlidersHorizontal size={14} className="text-[#596c60]" />
            <span>Filters</span>
          </button>
        </div>

        {/* Orders Table */}
        <div className="border border-[#e2e7e1] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#f4f6f3] text-[#596c60] text-[11px] font-semibold border-b border-[#e2e7e1]">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={displayedOrders.length > 0 && selectedOrderIds.length === displayedOrders.length}
                      onChange={toggleSelectAll}
                      aria-label="Select all displayed orders"
                      className="rounded border-[#d2d9d0] text-[#315A42] focus:ring-[#315A42] cursor-pointer"
                    />
                  </th>
                  <th
                    className="p-3.5 cursor-pointer select-none hover:text-[#1e2f24]"
                    onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  >
                    <div className="flex items-center gap-1">
                      <span>Order ID</span>
                      <ArrowUpDown size={12} className="text-[#718276]" />
                    </div>
                  </th>
                  <th className="p-3.5">Buyer</th>
                  <th className="p-3.5">Commodity</th>
                  <th className="p-3.5">Quantity</th>
                  <th className="p-3.5">Supplier allocation</th>
                  <th className="p-3.5">Progress</th>
                  <th className="p-3.5">Status</th>
                  <th
                    className="p-3.5 cursor-pointer select-none hover:text-[#1e2f24]"
                    onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  >
                    <div className="flex items-center gap-1">
                      <span>Delivery due</span>
                      <ArrowUpDown size={12} className="text-[#718276]" />
                    </div>
                  </th>
                  <th className="p-3.5 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ec]">
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-[#718276]">
                      No orders match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((order) => {
                    const isChecked = selectedOrderIds.includes(order.id);

                    // Badge colors with dot
                    let statusBadge = {
                      bg: 'bg-[#eef1ec]',
                      text: 'text-[#4f6155]',
                      dot: 'bg-[#4f6155]'
                    };
                    if (order.status === 'in_fulfilment') {
                      statusBadge = { bg: 'bg-[#eaf2e8]', text: 'text-[#315A42]', dot: 'bg-[#315A42]' };
                    } else if (order.status === 'awaiting_confirmation') {
                      statusBadge = { bg: 'bg-[#fff0e3]', text: 'text-[#854500]', dot: 'bg-[#854500]' };
                    } else if (order.status === 'allocated') {
                      statusBadge = { bg: 'bg-[#ede9fe]', text: 'text-[#4338ca]', dot: 'bg-[#4338ca]' };
                    } else if (order.status === 'exception' || order.status === 'cancelled') {
                      statusBadge = { bg: 'bg-[#fcebea]', text: 'text-[#a51c19]', dot: 'bg-[#a51c19]' };
                    }

                    // Supplier allocation bar color
                    const confirmed = order.supplierAllocation.confirmed;
                    const totalAlloc = order.supplierAllocation.total;
                    const allocPercent = Math.min(100, Math.round((confirmed / totalAlloc) * 100));
                    let allocBarColor = 'bg-[#e08a3c]'; // Orange when partial
                    if (confirmed === totalAlloc) {
                      allocBarColor = 'bg-[#315A42]'; // Green when fully confirmed
                    } else if (confirmed === 0) {
                      allocBarColor = 'bg-transparent';
                    }

                    return (
                      <tr
                        key={order.id}
                        className={`hover:bg-[#f9faf8] transition ${isChecked ? 'bg-[#eaf2e8]/30' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="p-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectRow(order.id)}
                            aria-label={`Select order ${order.id}`}
                            className="rounded border-[#d2d9d0] text-[#315A42] focus:ring-[#315A42] cursor-pointer"
                          />
                        </td>

                        {/* Order ID */}
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="font-bold text-xs text-[#1e2f24] hover:text-[#315A42] block text-left cursor-pointer"
                          >
                            {order.id}
                          </button>
                          <span className="text-[11px] text-[#718276] block mt-0.5">
                            {order.createdAtDisplay}
                          </span>
                        </td>

                        {/* Buyer */}
                        <td className="p-3.5">
                          <p className="font-semibold text-xs text-[#1e2f24]">{order.buyer}</p>
                          <p className="text-[11px] text-[#718276] mt-0.5">{order.buyerLocation}</p>
                        </td>

                        {/* Commodity */}
                        <td className="p-3.5">
                          <p className="font-medium text-xs text-[#1e2f24]">{order.commodity}</p>
                          <p className="text-[11px] text-[#718276] mt-0.5">{order.grade}</p>
                        </td>

                        {/* Quantity */}
                        <td className="p-3.5 font-bold text-xs text-[#1e2f24]">
                          {order.quantityDisplay}
                        </td>

                        {/* Supplier allocation */}
                        <td className="p-3.5">
                          <span className="text-[11px] font-medium text-[#263A31] block">
                            {confirmed} of {totalAlloc} confirmed
                          </span>
                          <div className="w-24 h-1.5 rounded-full bg-[#e8ede7] mt-1.5 overflow-hidden">
                            <div
                              className={`${allocBarColor} h-full transition-all`}
                              style={{ width: `${allocPercent}%` }}
                            />
                          </div>
                        </td>

                        {/* Progress */}
                        <td className="p-3.5">
                          <span className="text-xs font-semibold text-[#1e2f24] block">
                            {order.progress}%
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-[#e8ede7] mt-1 overflow-hidden">
                            <div
                              className="bg-[#315A42] h-full transition-all"
                              style={{ width: `${order.progress}%` }}
                            />
                          </div>
                        </td>

                        {/* Status badge with colored dot */}
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                            <span>{order.statusLabel}</span>
                          </span>
                        </td>

                        {/* Delivery due */}
                        <td className="p-3.5">
                          <p className="font-medium text-xs text-[#1e2f24]">
                            {order.deliveryDueDisplay}
                          </p>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              order.deliveryDueSubtext.toLowerCase().includes('today')
                                ? 'text-[#a51c19] font-medium'
                                : 'text-[#718276]'
                            }`}
                          >
                            {order.deliveryDueSubtext}
                          </p>
                        </td>

                        {/* Actions (···) */}
                        <td className="p-3.5 text-center relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuOrderId((prev) => (prev === order.id ? null : order.id))
                            }
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#718276] hover:text-[#1e2f24] hover:bg-[#eef2ec] transition cursor-pointer"
                            aria-label={`Actions for order ${order.id}`}
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          {/* Action Popup Menu */}
                          {activeMenuOrderId === order.id && (
                            <div
                              ref={menuRef}
                              className="absolute right-3 top-10 z-20 w-36 bg-white rounded-xl border border-[#d2d9d0] shadow-lg py-1 text-left text-xs text-[#263A31]"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setActiveMenuOrderId(null);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-[#f6f8f5] flex items-center gap-2 cursor-pointer"
                              >
                                <span>View details</span>
                              </button>
                              {order.status !== 'cancelled' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOrderToCancel(order);
                                    setCancelReason('');
                                    setActiveMenuOrderId(null);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-[#fcebea] text-[#a51c19] flex items-center gap-2 cursor-pointer"
                                >
                                  <span>Cancel order</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer with pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1 text-xs text-[#718276]">
          <span>
            Showing {totalCount > 0 ? startIndex + 1 : 0}-{endIndex} of {totalCount} orders
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="w-7 h-7 rounded-md border border-[#d2d9d0] flex items-center justify-center text-[#596c60] hover:bg-[#f6f8f5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Previous page"
            >
              &lt;
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold cursor-pointer ${
                currentPage === 1
                  ? 'bg-[#eef2ec] text-[#1e2f24] font-bold'
                  : 'text-[#596c60] hover:bg-[#f6f8f5]'
              }`}
            >
              1
            </button>

            {totalPages >= 2 && (
              <button
                type="button"
                onClick={() => setCurrentPage(2)}
                className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold cursor-pointer ${
                  currentPage === 2
                    ? 'bg-[#eef2ec] text-[#1e2f24] font-bold'
                    : 'text-[#596c60] hover:bg-[#f6f8f5]'
                }`}
              >
                2
              </button>
            )}

            {totalPages >= 3 && (
              <button
                type="button"
                onClick={() => setCurrentPage(3)}
                className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold cursor-pointer ${
                  currentPage === 3
                    ? 'bg-[#eef2ec] text-[#1e2f24] font-bold'
                    : 'text-[#596c60] hover:bg-[#f6f8f5]'
                }`}
              >
                3
              </button>
            )}

            {totalPages > 4 && <span className="px-1 text-xs text-[#718276]">…</span>}

            {totalPages >= 25 && (
              <button
                type="button"
                onClick={() => setCurrentPage(25)}
                className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold cursor-pointer ${
                  currentPage === 25
                    ? 'bg-[#eef2ec] text-[#1e2f24] font-bold'
                    : 'text-[#596c60] hover:bg-[#f6f8f5]'
                }`}
              >
                25
              </button>
            )}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="w-7 h-7 rounded-md border border-[#d2d9d0] flex items-center justify-center text-[#596c60] hover:bg-[#f6f8f5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Next page"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-[#17281db3] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e2e7e1] pb-3">
              <div>
                <h3 className="text-xl font-bold text-[#1e2f24]">{selectedOrder.id} Details</h3>
                <p className="text-xs text-[#596c60] mt-0.5">
                  Commodity: {selectedOrder.commodity} · {selectedOrder.grade}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#eaf2e8] text-[#596c60] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-[#f6f8f5] p-3.5 rounded-xl border border-[#e2e7e1]">
                <span className="text-[#596c60] font-semibold uppercase">Buyer</span>
                <p className="font-bold text-[#1e2f24] text-sm mt-1">{selectedOrder.buyer}</p>
                <p className="text-[#718276] mt-0.5">{selectedOrder.buyerLocation}</p>
              </div>
              <div className="bg-[#f6f8f5] p-3.5 rounded-xl border border-[#e2e7e1]">
                <span className="text-[#596c60] font-semibold uppercase">Contracted Value</span>
                <p className="font-bold text-[#1e2f24] text-sm mt-1">
                  LKR {(selectedOrder.totalAmountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[#718276] mt-0.5">
                  {selectedOrder.quantityDisplay} @ LKR {(selectedOrder.unitPriceCents / 100).toFixed(2)}/kg
                </p>
              </div>
            </div>

            {/* Supplier Allocations */}
            <div>
              <h4 className="text-sm font-bold text-[#1e2f24] mb-2.5">Supplier Allocations</h4>
              <div className="space-y-2">
                {selectedOrder.suppliers?.map((sup, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl border border-[#e2e7e1] bg-[#f9faf8]"
                  >
                    <div>
                      <p className="font-semibold text-xs text-[#1e2f24]">{sup.name}</p>
                      <p className="text-[11px] text-[#718276] mt-0.5">
                        {sup.district} · {sup.allocatedKg.toLocaleString()} kg
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        sup.status === 'confirmed' || sup.status === 'picked_up'
                          ? 'bg-[#eaf2e8] text-[#315A42]'
                          : sup.status === 'shortfall'
                          ? 'bg-[#fcebea] text-[#a51c19]'
                          : 'bg-[#fff0e3] text-[#854500]'
                      }`}
                    >
                      {sup.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="text-sm font-bold text-[#1e2f24] mb-2.5">Activity Timeline</h4>
              <div className="space-y-2.5 border-l-2 border-[#d2d9d0] ml-3 pl-3">
                {selectedOrder.timeline?.map((t, idx) => (
                  <div key={idx} className="relative text-xs">
                    <span className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-[#315A42]" />
                    <p className="font-bold text-[#1e2f24]">{t.title}</p>
                    <p className="text-[#718276] text-[11px] mt-0.5">
                      {t.actor} · {t.time}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e7e1]">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-xl border border-[#d2d9d0] text-xs font-semibold text-[#263A31] hover:bg-[#f6f8f5] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {orderToCancel && (
        <div className="fixed inset-0 z-50 bg-[#17281db3] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-[#a51c19]">
              <TriangleAlert size={22} />
              <h3 className="text-lg font-bold text-[#1e2f24]">Cancel Order {orderToCancel.id}</h3>
            </div>
            <p className="text-xs text-[#596c60]">
              Cancelling this order will release all supplier commitments, cancel related pickup routes, and record the cancellation rationale in the audit trail.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#1e2f24] mb-1.5">
                Mandatory Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter regulatory or operational reason for cancellation..."
                className="w-full h-24 p-3 rounded-xl border border-[#d2d9d0] text-xs text-[#1e2f24] placeholder-[#8a9b8e] focus:outline-none focus:ring-1 focus:ring-[#315A42]"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setOrderToCancel(null);
                  setCancelReason('');
                }}
                className="px-3.5 py-2 rounded-lg border border-[#d2d9d0] text-xs font-semibold text-[#263A31] hover:bg-[#f6f8f5] cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={!cancelReason.trim()}
                className="px-3.5 py-2 rounded-lg bg-[#a51c19] text-white text-xs font-semibold hover:bg-[#851614] disabled:opacity-50 transition cursor-pointer"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
