import React, { useState, useEffect, useCallback } from 'react';
import { Search, Calendar, ChevronLeft, ChevronRight, X, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { OrdersTable } from './OrdersTable';
import { OrderDetailsModal } from './OrderDetailsModal';
import type { BuyerOrder, OrdersApiResponse } from './types';

const STATUS_FILTERS: { label: string; value: string; key: keyof OrdersApiResponse['counts'] }[] = [
  { label: 'All', value: 'all', key: 'all' },
  { label: 'Pending', value: 'pending', key: 'pending' },
  { label: 'Processing', value: 'processing', key: 'processing' },
  { label: 'In Transit', value: 'in_transit', key: 'in_transit' },
  { label: 'Delivered', value: 'delivered', key: 'delivered' },
  { label: 'Canceled', value: 'canceled', key: 'canceled' },
];

export const MyOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and pagination state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
    from: 0,
    to: 0,
  });
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    pending: 0,
    processing: 0,
    in_transit: 0,
    delivered: 0,
    canceled: 0,
  });

  // Modal state
  const [selectedOrder, setSelectedOrder] = useState<BuyerOrder | null>(null);

  // Fetch orders from YM18 backend API
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedDate) params.append('date', selectedDate);
      params.append('page', currentPage.toString());
      params.append('limit', '10');

      const response = await api.get<OrdersApiResponse>(`/ym18/orders?${params.toString()}`);
      setOrders(response.data.orders);
      setPagination({
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages,
        from: response.data.pagination.from,
        to: response.data.pagination.to,
      });
      if (response.data.counts) {
        setStatusCounts(response.data.counts);
      }
    } catch (err: any) {
      console.error('Failed to load buyer orders:', err);
      setError(
        err.response?.data?.error || 'Unable to load orders. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedStatus, selectedDate, currentPage]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusChange = (statusValue: string) => {
    setSelectedStatus(statusValue);
    setCurrentPage(1);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedDate('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-12 font-sans bg-[#F6F7F3]">
      {/* 1. Header Section: Title, Subtitle and Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#315A42] tracking-tight">
            My Orders
          </h1>
          <p className="text-[13px] text-[#78877D] mt-0.5 font-normal">
            Track and manage your agricultural orders
          </p>
        </div>

        {/* Top-Right Controls: 36px height, compact, 8px radius */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Field */}
          <div className="relative flex items-center">
            <Search
              size={15}
              className="absolute left-3 text-[#315A42] pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search Orders"
              className="h-[36px] pl-9 pr-8 rounded-[8px] bg-white border border-[#E0E7E1] text-[13px] text-[#263A31] placeholder-[#78877D]/70 focus:outline-none focus:ring-1 focus:ring-[#315A42] focus:border-[#315A42] transition-all w-[200px] sm:w-[230px] shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-[#78877D] hover:text-[#263A31]"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date Picker Button / Input */}
          <div className="relative flex items-center">
            <div className="h-[36px] px-3 rounded-[8px] bg-white border border-[#E0E7E1] flex items-center gap-2 text-[13px] text-[#263A31] shadow-xs hover:border-[#315A42] transition-all cursor-pointer">
              <Calendar size={15} className="text-[#315A42]" />
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="bg-transparent border-none text-[13px] text-[#263A31] focus:outline-none cursor-pointer"
                title="Filter by delivery or order date"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="text-[#78877D] hover:text-[#263A31] ml-0.5"
                  aria-label="Clear date filter"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Status Filter Buttons: 36px height, compact 12px padding, 8px radius */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
        {STATUS_FILTERS.map((tab) => {
          const isActive = selectedStatus === tab.value;
          const count = statusCounts[tab.key] || 0;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleStatusChange(tab.value)}
              className={`h-[36px] px-3 rounded-[8px] text-[13px] font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                isActive
                  ? 'bg-[#315A42] text-white shadow-xs'
                  : 'bg-white border border-[#E0E7E1] text-[#315A42] hover:border-[#315A42] hover:bg-[#EEF2ED]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-2 py-0.2 rounded-full font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[#EEF2ED] text-[#315A42]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Main Content: Responsive Orders Table / Loading / Error / Empty States */}
      {loading ? (
        // Loading State: Skeleton Table
        <div className="w-full border border-[#E0E7E1] rounded-[8px] bg-white overflow-hidden shadow-xs">
          <div className="h-[44px] bg-[#EEF2ED] border-b border-[#E0E7E1]" />
          <div className="divide-y divide-[#E0E7E1]">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[52px] px-4 flex items-center justify-between animate-pulse">
                <div className="h-4 w-20 bg-[#EEF2ED] rounded-md" />
                <div className="h-4 w-28 bg-[#EEF2ED] rounded-md" />
                <div className="h-4 w-24 bg-[#EEF2ED] rounded-md" />
                <div className="h-4 w-16 bg-[#EEF2ED] rounded-md" />
                <div className="h-4 w-24 bg-[#EEF2ED] rounded-md" />
                <div className="h-6 w-20 bg-[#EEF2ED] rounded-full" />
                <div className="h-8 w-24 bg-[#EEF2ED] rounded-[8px]" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        // Error State
        <div className="bg-white border border-[#FCEBEA] rounded-[8px] p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-[#FCEBEA] text-[#A51C19] mx-auto flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#263A31]">
              Failed to Load Orders
            </h3>
            <p className="text-xs text-[#78877D] mt-1 max-w-md mx-auto">
              {error}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchOrders}
            className="h-[36px] px-4 inline-flex items-center gap-2 bg-[#315A42] hover:bg-[#264834] text-white rounded-[8px] font-semibold text-[13px] transition-colors"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      ) : orders.length === 0 ? (
        // Empty State
        <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#EEF2ED] text-[#315A42] mx-auto flex items-center justify-center">
            <Search size={22} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#263A31]">
              No Orders Found
            </h3>
            <p className="text-xs text-[#78877D] mt-1 max-w-md mx-auto">
              {searchQuery || selectedStatus !== 'all' || selectedDate
                ? 'No orders matched your active search or filters. Try adjusting or clearing them.'
                : 'You have not placed any orders yet. Explore the marketplace to place your first order.'}
            </p>
          </div>
          {(searchQuery || selectedStatus !== 'all' || selectedDate) && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-[36px] px-4 bg-[#315A42] hover:bg-[#264834] text-white rounded-[8px] font-semibold text-[13px] transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        // Responsive Table matching requirements
        <OrdersTable
          orders={orders}
          onViewDetails={setSelectedOrder}
        />
      )}

      {/* 4. Footer Pagination: 36px buttons, 8px radius */}
      {!loading && !error && pagination.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs text-[#78877D]">
          <div>
            Showing {pagination.from} - {pagination.to} of {pagination.total} Orders
          </div>

          <div className="flex items-center gap-1.5">
            {/* Previous Page Button */}
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="w-[36px] h-[36px] rounded-[8px] border border-[#E0E7E1] bg-white flex items-center justify-center text-[#263A31] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#315A42] transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Page Number Buttons */}
            {Array.from({ length: pagination.totalPages }, (_, idx) => idx + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`w-[36px] h-[36px] rounded-[8px] font-semibold text-[13px] flex items-center justify-center transition-colors ${
                  currentPage === pageNum
                    ? 'bg-[#315A42] text-white shadow-xs'
                    : 'border border-[#E0E7E1] bg-white text-[#263A31] hover:border-[#315A42]'
                }`}
              >
                {pageNum}
              </button>
            ))}

            {/* Next Page Button */}
            <button
              type="button"
              disabled={currentPage >= pagination.totalPages}
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="w-[36px] h-[36px] rounded-[8px] border border-[#E0E7E1] bg-white flex items-center justify-center text-[#263A31] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#315A42] transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 5. View Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
};
