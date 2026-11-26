import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Sprout,
  Check,
  Search,
  Plus,
  X,
  Eye,
  SquarePen,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Copy,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../../components/Button';
import { InputField } from '../../components/InputField';
import { StatusBadge } from '../../components/StatusBadge';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { Table, TableRow } from '../../components/Table';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Toast } from '../../components/Toast';
import api from './services/api';
import { Crop, Pagination, getErrorMessage } from './types';

function getPaginationItems(current: number, total: number): (number | string)[] {
  if (total <= 4) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (total === 5) {
    if (current <= 2) return [1, 2, 3, '...', 5];
    if (current >= 4) return [1, '...', 3, 4, 5];
    return [1, 2, 3, 4, 5];
  }
  if (current <= 3) return [1, 2, 3, '...', total];
  if (current >= total - 2) return [1, '...', total - 2, total - 1, total];
  return [1, '...', current, '...', total];
}

export default function CropManagement() {
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const defaultParams = { page: 1, limit: 5, status: 'all' };
  const cachedCrops = api.getCached<{ crops: Crop[]; pagination: Pagination; summary: any }>('/ym04/crops', defaultParams);

  // Master records & data state
  const [crops, setCrops] = useState<Crop[]>(() => cachedCrops?.crops || []);
  const [loading, setLoading] = useState<boolean>(() => !cachedCrops);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>(() => cachedCrops?.pagination || {
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1
  });
  const [summary, setSummary] = useState<{ total: number; active: number; inactive: number }>(() => cachedCrops?.summary || {
    total: 0,
    active: 0,
    inactive: 0
  });

  // Search, filter, pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Side Panel state: 'add' | 'edit' | 'view'
  const [panelMode, setPanelMode] = useState<'add' | 'edit' | 'view'>('add');
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);

  // Form input fields
  const [formName, setFormName] = useState('');
  const [formActive, setFormActive] = useState<boolean>(true);
  const [formReason, setFormReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Confirmation dialog state for deactivation
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [pendingCropUpdate, setPendingCropUpdate] = useState<{
    id: string;
    name: string;
    active: boolean;
    reason: string;
  } | null>(null);


  // Fetch crops from live backend (with cache & stale-while-revalidate)
  const fetchCrops = useCallback(async (signal?: AbortSignal, isManual = false) => {
    const params: Record<string, any> = {
      page: currentPage,
      limit: pageSize,
      status: statusFilter.toLowerCase()
    };
    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }

    if (!api.getCached('/ym04/crops', params) || isManual) {
      setLoading(true);
    }
    setPageError(null);
    try {
      const response = await api.get('/ym04/crops', { params, signal, skipCache: isManual });
      if (!isMountedRef.current || signal?.aborted) return;

      const { crops: list, pagination: pag, summary: sum } = response.data;
      setCrops(list || []);
      if (pag) setPagination(pag);
      if (sum) setSummary(sum);
      setPageError(null);
    } catch (err) {
      const isCanceled =
        axios.isCancel(err) ||
        (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError')) ||
        (axios.isAxiosError(err) && (err.code === 'ERR_CANCELED' || err.name === 'CanceledError')) ||
        Boolean(signal?.aborted);

      if (isCanceled || !isMountedRef.current) return;
      setPageError(getErrorMessage(err, 'Failed to load crops list.'));
    } finally {
      if (isMountedRef.current && !signal?.aborted) {
        setLoading(false);
      }
    }
  }, [currentPage, pageSize, statusFilter, searchQuery]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCrops(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchCrops]);

  // Switch to Add mode
  const handleOpenAdd = () => {
    setPanelMode('add');
    setSelectedCrop(null);
    setFormName('');
    setFormActive(true);
    setFormReason('');
    setFormError(null);
  };

  // Switch to Edit mode
  const handleOpenEdit = (crop: Crop) => {
    setPanelMode('edit');
    setSelectedCrop(crop);
    setFormName(crop.name);
    setFormActive(crop.active);
    setFormReason('');
    setFormError(null);
  };

  // Switch to View mode
  const handleOpenView = (crop: Crop) => {
    setPanelMode('view');
    setSelectedCrop(crop);
    setFormName(crop.name);
    setFormActive(crop.active);
    setFormReason('');
    setFormError(null);
  };

  // Close or reset panel
  const handleClosePanel = () => {
    handleOpenAdd();
  };

  // Copy UUID
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setToastMessage('Crop ID copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Execute Crop Update via PATCH
  const executeUpdateCrop = async (id: string, name: string, active: boolean, reason?: string) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      const payload: { name: string; active: boolean; reason?: string } = {
        name: name.trim(),
        active
      };
      if (reason && reason.trim()) {
        payload.reason = reason.trim();
      }

      await api.patch(`/ym04/crops/${id}`, payload);
      setToastMessage(`Crop "${name.trim()}" updated successfully!`);
      handleOpenAdd();
      fetchCrops();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to update crop.'));
    } finally {
      setIsSubmitting(false);
      setShowDeactivateConfirm(false);
      setPendingCropUpdate(null);
    }
  };

  // Form submit handler
  const handleSaveCrop = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      setFormError('Crop name is required.');
      return;
    }

    if (formName.trim().length > 100) {
      setFormError('Crop name must not exceed 100 characters.');
      return;
    }

    setFormError(null);

    if (panelMode === 'edit' && selectedCrop) {
      // Check if deactivating an active crop
      if (selectedCrop.active && !formActive) {
        setPendingCropUpdate({
          id: selectedCrop.id,
          name: formName.trim(),
          active: false,
          reason: formReason.trim() || `Crop '${formName.trim()}' deactivated`
        });
        setShowDeactivateConfirm(true);
        return;
      }

      await executeUpdateCrop(selectedCrop.id, formName, formActive, formReason);
    } else {
      // Add new crop via POST
      setIsSubmitting(true);
      try {
        const payload: { name: string; active: boolean; reason?: string } = {
          name: formName.trim(),
          active: formActive
        };
        if (formReason.trim()) {
          payload.reason = formReason.trim();
        }

        const res = await api.post('/ym04/crops', payload);
        const created = res.data.crop;
        setToastMessage(`Crop "${created.name}" registered successfully!`);
        handleOpenAdd();
        setCurrentPage(1);
        fetchCrops();
      } catch (err) {
        setFormError(getErrorMessage(err, 'Failed to create crop.'));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Confirm deactivation execution
  const handleConfirmDeactivate = async () => {
    if (!pendingCropUpdate) return;
    await executeUpdateCrop(
      pendingCropUpdate.id,
      pendingCropUpdate.name,
      pendingCropUpdate.active,
      pendingCropUpdate.reason
    );
  };

  const totalPages = pagination.totalPages || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;

  return (
    <div className="ym04-container">
      {/* ------------------------------------------------------------------ */}
      {/* Page Header matching Figma layout                                 */}
      {/* ------------------------------------------------------------------ */}
      <header className="ym04-crop-header">
        <div className="ym04-crop-header-title-wrap">
          <div className="ym04-crop-header-icon" aria-hidden="true">
            <Sprout size={26} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="ym04-title">Crop Management</h1>
            <p className="ym04-subtitle">
              Add, update and manage crop types in the system.
            </p>
          </div>
        </div>
      </header>

      {/* Global Page Error Banner */}
      {!loading && pageError && (
        <div className="ym04-alert-wrap" role="alert">
          <Alert type="error">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', width: '100%' }}>
              <span>{pageError}</span>
              <Button variant="outline" onClick={() => fetchCrops(undefined, true)}>
                <RefreshCw size={14} className={loading ? 'ym04-spin' : ''} style={{ marginRight: '6px' }} />
                Retry
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Top 4-Column Summary Row (3 Metrics + 1 Banner Card)               */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-stats-grid" aria-label="Crop management metrics summary">
        {/* Card 1: Total Crops */}
        <div
          className="ym04-stat-card cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter('All');
            setCurrentPage(1);
            setToastMessage(`Viewing all ${summary.total} registered crops.`);
          }}
          onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('All')}
          title="Show all crops"
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--sprout" aria-hidden="true">
              <Sprout size={22} strokeWidth={2} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Total Crops</span>
              <strong className="ym04-stat-value">{loading && crops.length === 0 ? '...' : summary.total}</strong>
              <span className="ym04-stat-subtext">All registered crops</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 2: Active Crops */}
        <div
          className="ym04-stat-card cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter('Active');
            setCurrentPage(1);
            setToastMessage(`Filtering ${summary.active} active crops.`);
          }}
          onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('Active')}
          title="Filter active crops"
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--active-crops" aria-hidden="true">
              <Check size={22} strokeWidth={3} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Active Crops</span>
              <strong className="ym04-stat-value">{loading && crops.length === 0 ? '...' : summary.active}</strong>
              <span className="ym04-stat-subtext">Currently available</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 3: Inactive Crops */}
        <div
          className="ym04-stat-card cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter('Inactive');
            setCurrentPage(1);
            setToastMessage(`Filtering ${summary.inactive} inactive crops.`);
          }}
          onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('Inactive')}
          title="Filter inactive crops"
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--inactive" aria-hidden="true">
              <Sprout size={22} strokeWidth={2} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Inactive Crops</span>
              <strong className="ym04-stat-value">{loading && crops.length === 0 ? '...' : summary.inactive}</strong>
              <span className="ym04-stat-subtext">Not available</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 4: Banner Card */}
        <div className="ym04-banner-card" aria-label="YieldMatrix vision banner">
          <div className="ym04-banner-content">
            <p className="ym04-banner-heading">Healthy Fields, Better</p>
            <p className="ym04-banner-subheading">Tomorrow</p>
          </div>
          <div className="ym04-banner-graphic" aria-hidden="true">
            <svg
              className="ym04-banner-svg"
              viewBox="0 0 160 90"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="130" cy="24" r="14" fill="#ECA24F" />
              <path
                d="M40 90 C70 50, 110 50, 160 70 L160 90 Z"
                fill="#4D8E67"
                opacity="0.85"
              />
              <path
                d="M-10 90 C40 60, 90 60, 170 90 Z"
                fill="#27573A"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Main 2-Column Split Section (Crop List + Side Panel)               */}
      {/* ------------------------------------------------------------------ */}
      <div className="ym04-split-layout">
        {/* Left Column: Crop List Card */}
        <section className="ym04-section-card ym04-crop-list-card" aria-labelledby="heading-crop-list">
          <div className="ym04-section-header">
            <div className="ym04-section-title-wrap">
              <Sprout className="ym04-section-icon" size={22} aria-hidden="true" />
              <h2 id="heading-crop-list" className="ym04-section-title">Crop List</h2>
            </div>
            <Button
              type="button"
              variant="primary"
              className="ym04-btn-add"
              onClick={handleOpenAdd}
              aria-label="Add new crop"
            >
              <Plus size={16} aria-hidden="true" />
              <span>Add Crop</span>
            </Button>
          </div>

          {/* Search Bar & Status Filter */}
          <div className="ym04-filter-row">
            <div className="ym04-search-box">
              <Search className="ym04-search-icon" size={17} aria-hidden="true" />
              <input
                type="text"
                className="ym04-search-input"
                placeholder="Search crops by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Search crops by name"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="ym04-search-clear"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="ym04-select-wrap">
              <select
                className="ym04-select-dropdown"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive');
                  setCurrentPage(1);
                }}
                aria-label="Filter crops by status"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="ym04-table-wrap">
            {loading && crops.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <Loader2 size={32} className="ym04-spin" style={{ margin: '0 auto 12px', color: 'var(--primary)' }} />
                <p style={{ color: 'var(--muted)' }}>Loading crops...</p>
              </div>
            ) : (
              <Table
                headers={['Crop ID', 'Crop Name', 'Status', 'Actions']}
                className="ym04-table"
                aria-label="Crop List Table"
              >
                {crops.length > 0 ? (
                  crops.map((crop) => (
                    <TableRow
                      key={crop.id}
                      className={selectedCrop?.id === crop.id ? 'ym04-row--selected' : ''}
                    >
                      <td className="ym04-cell-crop-id" title={crop.id}>
                        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                          {crop.id.length > 8 ? `${crop.id.slice(0, 8)}...` : crop.id}
                        </span>
                      </td>
                      <td className="ym04-cell-crop-name-bold">{crop.name}</td>
                      <td>
                        <StatusBadge status={crop.active ? 'Active' : 'Inactive'} />
                      </td>
                      <td>
                        <div className="ym04-action-icons-wrap">
                          <button
                            type="button"
                            className="ym04-icon-action-btn"
                            onClick={() => handleOpenView(crop)}
                            title={`View details for ${crop.name}`}
                            aria-label={`View details for ${crop.name}`}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            className="ym04-icon-action-btn"
                            onClick={() => handleOpenEdit(crop)}
                            title={`Edit ${crop.name}`}
                            aria-label={`Edit ${crop.name}`}
                          >
                            <SquarePen size={16} />
                          </button>
                        </div>
                      </td>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <td colSpan={4}>
                      <EmptyState
                        title="No crops found"
                        description={
                          searchQuery || statusFilter !== 'All'
                            ? 'No crops match your active filter criteria. Try clearing search or status filters.'
                            : 'No crop records available.'
                        }
                        action={
                          (searchQuery || statusFilter !== 'All') ? (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSearchQuery('');
                                setStatusFilter('All');
                                setCurrentPage(1);
                              }}
                            >
                              Reset Filters
                            </Button>
                          ) : (
                            <Button variant="primary" onClick={handleOpenAdd}>
                              <Plus size={16} style={{ marginRight: '6px' }} />
                              Add New Crop
                            </Button>
                          )
                        }
                      />
                    </td>
                  </TableRow>
                )}
              </Table>
            )}
          </div>

          {/* Pagination Bar */}
          <div className="ym04-pagination-row">
            <span className="ym04-pagination-info">
              {pagination.total > 0
                ? `Showing ${startIndex + 1}–${Math.min(
                    startIndex + pageSize,
                    pagination.total
                  )} of ${pagination.total} crops`
                : 'Showing 0 of 0 crops'}
            </span>

            {totalPages > 1 && (
              <div className="ym04-pagination-controls" aria-label="Pagination Navigation">
                <button
                  type="button"
                  className="ym04-page-arrow"
                  disabled={validCurrentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                {getPaginationItems(validCurrentPage, totalPages).map((item, idx) => {
                  if (typeof item === 'string') {
                    return (
                      <span key={`ellipsis-${idx}`} className="ym04-page-ellipsis" aria-hidden="true">
                        ...
                      </span>
                    );
                  }
                  return (
                    <button
                      key={item}
                      type="button"
                      className={`ym04-page-num ${
                        validCurrentPage === item ? 'ym04-page-num--active' : ''
                      }`}
                      onClick={() => setCurrentPage(item)}
                      aria-label={`Page ${item}`}
                      aria-current={validCurrentPage === item ? 'page' : undefined}
                    >
                      {item}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="ym04-page-arrow"
                  disabled={validCurrentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Add / Edit Crop Side Panel Card */}
        <section className="ym04-section-card ym04-side-panel-card" aria-labelledby="heading-side-panel">
          <div className="ym04-side-panel-header">
            <div className="ym04-section-title-wrap">
              <Sprout className="ym04-section-icon" size={20} aria-hidden="true" />
              <h2 id="heading-side-panel" className="ym04-side-panel-title">
                {panelMode === 'view' ? 'Crop Details' : panelMode === 'edit' ? 'Edit Crop' : 'Add New Crop'}
              </h2>
            </div>
            <button
              type="button"
              className="ym04-modal-close"
              onClick={handleClosePanel}
              title="Close panel"
              aria-label="Close panel"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Error Banner */}
          {formError && (
            <div className="ym04-form-alert-wrap" style={{ margin: '16px 20px 0' }}>
              <Alert type="error">{formError}</Alert>
            </div>
          )}

          {panelMode === 'view' && selectedCrop ? (
            /* View Mode Readout */
            <div className="ym04-view-panel-body">
              <div className="ym04-detail-grid">
                <div className="ym04-detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="ym04-detail-label">Crop ID</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="ym04-detail-value" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                      {selectedCrop.id}
                    </span>
                    <button
                      type="button"
                      className="ym04-copy-btn"
                      onClick={() => handleCopyId(selectedCrop.id)}
                      title="Copy Crop ID"
                      aria-label="Copy Crop ID"
                    >
                      {copiedId === selectedCrop.id ? <CheckCircle2 size={13} color="#1b8754" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                <div className="ym04-detail-item">
                  <span className="ym04-detail-label">Crop Name</span>
                  <span className="ym04-detail-value">{selectedCrop.name}</span>
                </div>
                <div className="ym04-detail-item">
                  <span className="ym04-detail-label">Status</span>
                  <span className="ym04-detail-value">
                    <StatusBadge status={selectedCrop.active ? 'Active' : 'Inactive'} />
                  </span>
                </div>
              </div>

              <div className="ym04-panel-actions">
                <Button
                  type="button"
                  variant="outline"
                  className="ym04-panel-btn-cancel"
                  onClick={handleClosePanel}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="ym04-panel-btn-save"
                  onClick={() => handleOpenEdit(selectedCrop)}
                >
                  Edit This Crop
                </Button>
              </div>
            </div>
          ) : (
            /* Add / Edit Form */
            <form className="ym04-crop-form" onSubmit={handleSaveCrop}>
              {/* Field 1: Crop Name */}
              <div className="ym04-form-group">
                <InputField
                  label="Crop Name"
                  placeholder="Enter crop name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              {/* Field 2: Status Radio Buttons */}
              <div className="ym04-form-group">
                <span className="ym04-form-label">Status</span>
                <div className="ym04-radio-group">
                  <label className="ym04-radio-item">
                    <input
                      type="radio"
                      name="crop-status"
                      checked={formActive === true}
                      onChange={() => setFormActive(true)}
                      className="ym04-radio-input"
                    />
                    <span className="ym04-radio-custom" />
                    <span className="ym04-radio-text">Active</span>
                  </label>

                  <label className="ym04-radio-item">
                    <input
                      type="radio"
                      name="crop-status"
                      checked={formActive === false}
                      onChange={() => setFormActive(false)}
                      className="ym04-radio-input"
                    />
                    <span className="ym04-radio-custom" />
                    <span className="ym04-radio-text">Inactive</span>
                  </label>
                </div>
              </div>

              {/* Field 3: Audit Reason (Optional) */}
              <div className="ym04-form-group">
                <InputField
                  label="Audit Reason (Optional)"
                  placeholder="Reason for change (e.g., Seasonal update)"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="ym04-panel-actions">
                <Button
                  type="button"
                  variant="outline"
                  className="ym04-panel-btn-cancel"
                  onClick={handleClosePanel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="ym04-panel-btn-save"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Saving...'
                    : panelMode === 'edit'
                    ? 'Update Crop'
                    : 'Save Crop'}
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>

      {/* Confirmation Dialog for Deactivation */}
      {showDeactivateConfirm && pendingCropUpdate && (
        <ConfirmDialog
          open={showDeactivateConfirm}
          title="Deactivate Crop"
          description={`Are you sure you want to set crop "${pendingCropUpdate.name}" to Inactive? This will pause crop allocation in other modules.`}
          confirmLabel="Yes, Deactivate"
          onCancel={() => {
            setShowDeactivateConfirm(false);
            setPendingCropUpdate(null);
          }}
          onConfirm={handleConfirmDeactivate}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
