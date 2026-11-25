import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Ribbon,
  Check,
  Pause,
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
import api from '../../services/api';
import { Grade, Pagination, getErrorMessage } from './types';

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

export default function GradeManagement() {
  // Master records & data state
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1
  });
  const [summary, setSummary] = useState<{ total: number; active: number; inactive: number }>({
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
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);

  // Form input fields
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formActive, setFormActive] = useState<boolean>(true);
  const [formReason, setFormReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Confirmation dialog state for deactivation
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [pendingGradeUpdate, setPendingGradeUpdate] = useState<{
    id: string;
    name: string;
    description: string;
    active: boolean;
    reason: string;
  } | null>(null);

  // Fetch grades from live backend
  const fetchGrades = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setPageError(null);
    try {
      const params: Record<string, any> = {
        page: currentPage,
        limit: pageSize,
        status: statusFilter.toLowerCase()
      };
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const response = await api.get('/ym04/grades', { params, signal });
      const { grades: list, pagination: pag, summary: sum } = response.data;
      setGrades(list || []);
      if (pag) setPagination(pag);
      if (sum) setSummary(sum);
    } catch (err) {
      if (axios.isCancel(err)) return;
      setPageError(getErrorMessage(err, 'Failed to load produce grades list.'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, statusFilter, searchQuery]);

  useEffect(() => {
    const controller = new AbortController();
    fetchGrades(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchGrades]);

  // Switch to Add mode
  const handleOpenAdd = () => {
    setPanelMode('add');
    setSelectedGrade(null);
    setFormName('');
    setFormDescription('');
    setFormActive(true);
    setFormReason('');
    setFormError(null);
  };

  // Switch to Edit mode
  const handleOpenEdit = (grade: Grade) => {
    setPanelMode('edit');
    setSelectedGrade(grade);
    setFormName(grade.name);
    setFormDescription(grade.description || '');
    setFormActive(grade.active);
    setFormReason('');
    setFormError(null);
  };

  // Switch to View mode
  const handleOpenView = (grade: Grade) => {
    setPanelMode('view');
    setSelectedGrade(grade);
    setFormName(grade.name);
    setFormDescription(grade.description || '');
    setFormActive(grade.active);
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
    setToastMessage('Grade ID copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Execute Grade Update via PATCH
  const executeUpdateGrade = async (
    id: string,
    name: string,
    description: string,
    active: boolean,
    reason?: string
  ) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      const payload: { name: string; description?: string | null; active: boolean; reason?: string } = {
        name: name.trim(),
        description: description.trim() || null,
        active
      };
      if (reason && reason.trim()) {
        payload.reason = reason.trim();
      }

      await api.patch(`/ym04/grades/${id}`, payload);
      setToastMessage(`Grade "${name.trim()}" updated successfully!`);
      handleOpenAdd();
      fetchGrades();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to update grade.'));
    } finally {
      setIsSubmitting(false);
      setShowDeactivateConfirm(false);
      setPendingGradeUpdate(null);
    }
  };

  // Form submit handler
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      setFormError('Grade name is required.');
      return;
    }

    if (formName.trim().length > 100) {
      setFormError('Grade name must not exceed 100 characters.');
      return;
    }

    setFormError(null);

    if (panelMode === 'edit' && selectedGrade) {
      // Check if deactivating an active grade
      if (selectedGrade.active && !formActive) {
        setPendingGradeUpdate({
          id: selectedGrade.id,
          name: formName.trim(),
          description: formDescription.trim(),
          active: false,
          reason: formReason.trim() || `Grade '${formName.trim()}' deactivated`
        });
        setShowDeactivateConfirm(true);
        return;
      }

      await executeUpdateGrade(selectedGrade.id, formName, formDescription, formActive, formReason);
    } else {
      // Add new grade via POST
      setIsSubmitting(true);
      try {
        const payload: { name: string; description?: string | null; active: boolean; reason?: string } = {
          name: formName.trim(),
          description: formDescription.trim() || null,
          active: formActive
        };
        if (formReason.trim()) {
          payload.reason = formReason.trim();
        }

        const res = await api.post('/ym04/grades', payload);
        const created = res.data.grade;
        setToastMessage(`Grade "${created.name}" registered successfully!`);
        handleOpenAdd();
        setCurrentPage(1);
        fetchGrades();
      } catch (err) {
        setFormError(getErrorMessage(err, 'Failed to create grade.'));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Confirm deactivation execution
  const handleConfirmDeactivate = async () => {
    if (!pendingGradeUpdate) return;
    await executeUpdateGrade(
      pendingGradeUpdate.id,
      pendingGradeUpdate.name,
      pendingGradeUpdate.description,
      pendingGradeUpdate.active,
      pendingGradeUpdate.reason
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
      <header className="ym04-grade-header">
        <div className="ym04-grade-header-title-wrap">
          <div className="ym04-grade-header-icon" aria-hidden="true">
            <Ribbon size={24} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="ym04-title">Grade Management</h1>
            <p className="ym04-subtitle">
              Add, update and manage produce quality grades.
            </p>
          </div>
        </div>
      </header>

      {/* Global Page Error Banner */}
      {pageError && (
        <div className="ym04-alert-wrap" role="alert">
          <Alert type="error">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', width: '100%' }}>
              <span>{pageError}</span>
              <Button variant="outline" onClick={() => fetchGrades()}>
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
      <section className="ym04-stats-grid" aria-label="Grade management metrics summary">
        {/* Card 1: Total Grades */}
        <div
          className="ym04-stat-card cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter('All');
            setCurrentPage(1);
            setToastMessage(`Viewing all ${summary.total} registered quality grades.`);
          }}
          onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('All')}
          title="Show all grades"
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--ribbon" aria-hidden="true">
              <Ribbon size={22} strokeWidth={2.2} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Total Grades</span>
              <strong className="ym04-stat-value">{summary.total}</strong>
              <span className="ym04-stat-subtext">All registered grades</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 2: Active Grades */}
        <div
          className="ym04-stat-card cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter('Active');
            setCurrentPage(1);
            setToastMessage(`Filtering ${summary.active} active quality grades.`);
          }}
          onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('Active')}
          title="Filter active grades"
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--active-crops" aria-hidden="true">
              <Check size={22} strokeWidth={3} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Active Grades</span>
              <strong className="ym04-stat-value">{summary.active}</strong>
              <span className="ym04-stat-subtext">Currently available</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 3: Inactive Grades */}
        <div
          className="ym04-stat-card cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter('Inactive');
            setCurrentPage(1);
            setToastMessage(`Filtering ${summary.inactive} inactive quality grades.`);
          }}
          onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('Inactive')}
          title="Filter inactive grades"
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--pause" aria-hidden="true">
              <Pause size={20} strokeWidth={2.5} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Inactive Grades</span>
              <strong className="ym04-stat-value">{summary.inactive}</strong>
              <span className="ym04-stat-subtext">Not available</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 4: Banner Card */}
        <div className="ym04-banner-card" aria-label="YieldMatrix quality value banner">
          <div className="ym04-banner-content">
            <p className="ym04-banner-heading">Better Quality,</p>
            <p className="ym04-banner-subheading">Greater Value</p>
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
      {/* Main 2-Column Split Section (Grade List + Side Panel)              */}
      {/* ------------------------------------------------------------------ */}
      <div className="ym04-split-layout">
        {/* Left Column: Grade List Card */}
        <section className="ym04-section-card ym04-crop-list-card" aria-labelledby="heading-grade-list">
          <div className="ym04-section-header">
            <div className="ym04-section-title-wrap">
              <Ribbon className="ym04-section-icon" size={22} strokeWidth={2.2} aria-hidden="true" />
              <h2 id="heading-grade-list" className="ym04-section-title">Grade List</h2>
            </div>
            <Button
              type="button"
              variant="primary"
              className="ym04-btn-add"
              onClick={handleOpenAdd}
              aria-label="Add new grade"
            >
              <Plus size={16} aria-hidden="true" />
              <span>Add Grade</span>
            </Button>
          </div>

          {/* Search Bar & Status Filter */}
          <div className="ym04-filter-row">
            <div className="ym04-search-box">
              <Search className="ym04-search-icon" size={17} aria-hidden="true" />
              <input
                type="text"
                className="ym04-search-input"
                placeholder="Search grades by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Search grades by name"
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
                aria-label="Filter grades by status"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="ym04-table-wrap">
            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <Loader2 size={32} className="ym04-spin" style={{ margin: '0 auto 12px', color: 'var(--primary)' }} />
                <p style={{ color: 'var(--muted)' }}>Loading produce grades...</p>
              </div>
            ) : (
              <Table
                headers={['Grade ID', 'Grade Name', 'Description', 'Status', 'Actions']}
                className="ym04-table"
                aria-label="Grade List Table"
              >
                {grades.length > 0 ? (
                  grades.map((grade) => (
                    <TableRow
                      key={grade.id}
                      className={selectedGrade?.id === grade.id ? 'ym04-row--selected' : ''}
                    >
                      <td className="ym04-cell-crop-id" title={grade.id}>
                        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                          {grade.id.length > 8 ? `${grade.id.slice(0, 8)}...` : grade.id}
                        </span>
                      </td>
                      <td className="ym04-cell-crop-name-bold">{grade.name}</td>
                      <td className="ym04-cell-grade-desc">{grade.description || '—'}</td>
                      <td>
                        <StatusBadge status={grade.active ? 'Active' : 'Inactive'} />
                      </td>
                      <td>
                        <div className="ym04-action-icons-wrap">
                          <button
                            type="button"
                            className="ym04-icon-action-btn"
                            onClick={() => handleOpenView(grade)}
                            title={`View details for ${grade.name}`}
                            aria-label={`View details for ${grade.name}`}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            className="ym04-icon-action-btn"
                            onClick={() => handleOpenEdit(grade)}
                            title={`Edit ${grade.name}`}
                            aria-label={`Edit ${grade.name}`}
                          >
                            <SquarePen size={16} />
                          </button>
                        </div>
                      </td>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <td colSpan={5}>
                      <EmptyState
                        title="No grades found"
                        description={
                          searchQuery || statusFilter !== 'All'
                            ? 'No produce grades match your active filter criteria. Try clearing search or status filters.'
                            : 'No produce grade records available.'
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
                              Add New Grade
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
                  )} of ${pagination.total} grades`
                : 'Showing 0 of 0 grades'}
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

        {/* Right Column: Add / Edit Grade Side Panel Card */}
        <section className="ym04-section-card ym04-side-panel-card" aria-labelledby="heading-side-panel">
          <div className="ym04-side-panel-header">
            <div className="ym04-section-title-wrap">
              <Ribbon className="ym04-section-icon" size={20} strokeWidth={2.2} aria-hidden="true" />
              <h2 id="heading-side-panel" className="ym04-side-panel-title">
                {panelMode === 'view' ? 'Grade Details' : panelMode === 'edit' ? 'Edit Grade' : 'Add New Grade'}
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

          {panelMode === 'view' && selectedGrade ? (
            /* View Mode Readout */
            <div className="ym04-view-panel-body">
              <div className="ym04-detail-grid">
                <div className="ym04-detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="ym04-detail-label">Grade ID</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="ym04-detail-value" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                      {selectedGrade.id}
                    </span>
                    <button
                      type="button"
                      className="ym04-copy-btn"
                      onClick={() => handleCopyId(selectedGrade.id)}
                      title="Copy Grade ID"
                      aria-label="Copy Grade ID"
                    >
                      {copiedId === selectedGrade.id ? <CheckCircle2 size={13} color="#1b8754" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                <div className="ym04-detail-item">
                  <span className="ym04-detail-label">Grade Name</span>
                  <span className="ym04-detail-value">{selectedGrade.name}</span>
                </div>
                <div className="ym04-detail-item">
                  <span className="ym04-detail-label">Status</span>
                  <span className="ym04-detail-value">
                    <StatusBadge status={selectedGrade.active ? 'Active' : 'Inactive'} />
                  </span>
                </div>
                <div className="ym04-detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="ym04-detail-label">Description</span>
                  <p className="ym04-detail-desc">{selectedGrade.description || 'No description provided.'}</p>
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
                  onClick={() => handleOpenEdit(selectedGrade)}
                >
                  Edit This Grade
                </Button>
              </div>
            </div>
          ) : (
            /* Add / Edit Form */
            <form className="ym04-crop-form" onSubmit={handleSaveGrade}>
              {/* Field 1: Grade Name */}
              <div className="ym04-form-group">
                <InputField
                  label="Grade Name"
                  placeholder="Enter grade name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              {/* Field 2: Description */}
              <div className="ym04-form-group">
                <label htmlFor="grade-desc-textarea" className="ym04-form-label">
                  Description
                </label>
                <textarea
                  id="grade-desc-textarea"
                  className="ym04-form-textarea"
                  placeholder="Enter description..."
                  rows={4}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              {/* Field 3: Status Radio Buttons */}
              <div className="ym04-form-group">
                <span className="ym04-form-label">Status</span>
                <div className="ym04-radio-group">
                  <label className="ym04-radio-item">
                    <input
                      type="radio"
                      name="grade-status"
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
                      name="grade-status"
                      checked={formActive === false}
                      onChange={() => setFormActive(false)}
                      className="ym04-radio-input"
                    />
                    <span className="ym04-radio-custom" />
                    <span className="ym04-radio-text">Inactive</span>
                  </label>
                </div>
              </div>

              {/* Field 4: Audit Reason (Optional) */}
              <div className="ym04-form-group">
                <InputField
                  label="Audit Reason (Optional)"
                  placeholder="Reason for change (e.g., Quality criteria revision)"
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
                    ? 'Update Grade'
                    : 'Save Grade'}
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>

      {/* Confirmation Dialog for Deactivation */}
      {showDeactivateConfirm && pendingGradeUpdate && (
        <ConfirmDialog
          open={showDeactivateConfirm}
          title="Deactivate Grade"
          description={`Are you sure you want to set grade "${pendingGradeUpdate.name}" to Inactive? This will pause produce grading for this tier.`}
          confirmLabel="Yes, Deactivate"
          onCancel={() => {
            setShowDeactivateConfirm(false);
            setPendingGradeUpdate(null);
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
