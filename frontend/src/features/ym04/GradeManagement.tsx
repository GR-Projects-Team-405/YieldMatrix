import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Zap,
  ArrowRight,
  BarChart2,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Toast } from '../../components/Toast';

export interface GradeItem {
  id: string;
  name: string;
  description: string;
  status: 'Active' | 'Inactive';
  createdDate: string;
  criteria?: string;
}

// 8 realistic produce quality grade records matching Figma mock metrics (6 Active, 2 Inactive)
const INITIAL_GRADES: GradeItem[] = [
  {
    id: 'GR001',
    name: 'Grade A',
    description: 'Premium Quality',
    status: 'Active',
    createdDate: '05 Nov 2026',
    criteria: 'Zero defect tolerance, uniform size distribution, export-certified purity and moisture standard.'
  },
  {
    id: 'GR002',
    name: 'Grade B',
    description: 'Standard Quality',
    status: 'Active',
    createdDate: '05 Nov 2026',
    criteria: 'Minor superficial skin defects allowed, 100% sound flesh, standard wholesale and supermarket spec.'
  },
  {
    id: 'GR003',
    name: 'Grade C',
    description: 'Basic Quality',
    status: 'Active',
    createdDate: '04 Nov 2026',
    criteria: 'Acceptable for processing, puree, pulping, milling, or localized community retail consumption.'
  },
  {
    id: 'GR004',
    name: 'Grade D',
    description: 'Special Category',
    status: 'Inactive',
    createdDate: '01 Nov 2026',
    criteria: 'Heavily bruised or distressed produce restricted to industrial biomass or animal feed.'
  },
  {
    id: 'GR005',
    name: 'Grade Premium',
    description: 'High Market Value',
    status: 'Active',
    createdDate: '30 Oct 2026',
    criteria: 'Ultra top-tier harvest with specialized agronomic lineage and guaranteed sugar/moisture grade.'
  },
  {
    id: 'GR006',
    name: 'Grade Export',
    description: 'Certified Organic Standard',
    status: 'Active',
    createdDate: '28 Oct 2026',
    criteria: 'GlobalGAP certified chemical residue-free export standard with strict phytosanitary compliance.'
  },
  {
    id: 'GR007',
    name: 'Grade Processing',
    description: 'Industrial Spec',
    status: 'Active',
    createdDate: '25 Oct 2026',
    criteria: 'Optimized for high-yield industrial extraction, juice bottling, and starch milling factories.'
  },
  {
    id: 'GR008',
    name: 'Grade Substandard',
    description: 'Non-conforming Cull Grade',
    status: 'Inactive',
    createdDate: '20 Oct 2026',
    criteria: 'Substandard grade segregated during primary depot sorting; scheduled for composting or salvage.'
  }
];

function getPaginationItems(current: number, total: number): (number | string)[] {
  if (total <= 4) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (total === 5) {
    if (current <= 2) {
      return [1, 2, 3, '...', 5];
    }
    if (current >= 4) {
      return [1, '...', 3, 4, 5];
    }
    return [1, 2, 3, 4, 5];
  }
  if (current <= 3) {
    return [1, 2, 3, '...', total];
  }
  if (current >= total - 2) {
    return [1, '...', total - 2, total - 1, total];
  }
  return [1, '...', current, '...', total];
}

export default function GradeManagement() {
  const navigate = useNavigate();

  // Master records
  const [grades, setGrades] = useState<GradeItem[]>(INITIAL_GRADES);

  // Search, filter, pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Side Panel state: 'add' | 'edit' | 'view'
  const [panelMode, setPanelMode] = useState<'add' | 'edit' | 'view'>('add');
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);

  // Form input fields
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formError, setFormError] = useState<string | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Summary counts
  const totalGrades = grades.length;
  const activeGrades = useMemo(() => grades.filter(g => g.status === 'Active').length, [grades]);
  const inactiveGrades = useMemo(() => grades.filter(g => g.status === 'Inactive').length, [grades]);

  // Filtered and paginated records
  const filteredGrades = useMemo(() => {
    return grades.filter(grade => {
      const term = searchQuery.trim().toLowerCase();
      const matchesSearch =
        grade.name.toLowerCase().includes(term) ||
        grade.id.toLowerCase().includes(term) ||
        grade.description.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'All' ? true : grade.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [grades, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredGrades.length / pageSize));

  // Ensure current page stays in bounds
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedGrades = filteredGrades.slice(startIndex, startIndex + pageSize);

  // Switch to Add mode
  const handleOpenAdd = () => {
    setPanelMode('add');
    setSelectedGradeId(null);
    setFormName('');
    setFormDescription('');
    setFormStatus('Active');
    setFormError(null);
  };

  // Switch to Edit mode
  const handleOpenEdit = (grade: GradeItem) => {
    setPanelMode('edit');
    setSelectedGradeId(grade.id);
    setFormName(grade.name);
    setFormDescription(grade.description);
    setFormStatus(grade.status);
    setFormError(null);
  };

  // Switch to View mode
  const handleOpenView = (grade: GradeItem) => {
    setPanelMode('view');
    setSelectedGradeId(grade.id);
    setFormName(grade.name);
    setFormDescription(grade.description);
    setFormStatus(grade.status);
    setFormError(null);
  };

  // Close or reset panel
  const handleClosePanel = () => {
    handleOpenAdd();
  };

  // Form submit handler
  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      setFormError('Grade name is required.');
      return;
    }

    setFormError(null);

    if (panelMode === 'edit' && selectedGradeId) {
      // Update existing grade
      setGrades(prev =>
        prev.map(item => {
          if (item.id === selectedGradeId) {
            return {
              ...item,
              name: formName.trim(),
              description: formDescription.trim() || 'Produce quality grade registered in YieldMatrix.',
              status: formStatus
            };
          }
          return item;
        })
      );
      setToastMessage(`Grade "${formName.trim()}" updated successfully!`);
      handleOpenAdd();
    } else {
      // Add new grade with incremented GR ID
      const nextIdNum = grades.length + 1;
      const newId = `GR${String(nextIdNum).padStart(3, '0')}`;
      const newGrade: GradeItem = {
        id: newId,
        name: formName.trim(),
        description: formDescription.trim() || 'Produce quality grade registered in YieldMatrix.',
        status: formStatus,
        createdDate: '23 Nov 2026',
        criteria: 'Standard quality specification set by agricultural produce authority.'
      };

      setGrades(prev => [newGrade, ...prev]);
      setToastMessage(`Grade "${newGrade.name}" (${newGrade.id}) added successfully!`);
      handleOpenAdd();
    }
  };

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
            setToastMessage(`Filtering all ${totalGrades} registered quality grades.`);
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
              <strong className="ym04-stat-value">{totalGrades}</strong>
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
            setToastMessage(`Filtering ${activeGrades} active quality grades.`);
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
              <strong className="ym04-stat-value">{activeGrades}</strong>
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
            setToastMessage(`Filtering ${inactiveGrades} inactive quality grades.`);
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
              <strong className="ym04-stat-value">{inactiveGrades}</strong>
              <span className="ym04-stat-subtext">Not available</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 4: Better Quality, Greater Value Banner Card */}
        <div className="ym04-banner-card" aria-label="YieldMatrix quality value banner">
          <div className="ym04-banner-content">
            <p className="ym04-banner-heading">Better Quality,</p>
            <p className="ym04-banner-subheading">Greater Value</p>
          </div>
          <div className="ym04-banner-graphic" aria-hidden="true">
            {/* SVG Sun & Rolling Hills matching the Figma design */}
            <svg
              className="ym04-banner-svg"
              viewBox="0 0 160 90"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Sun */}
              <circle cx="130" cy="24" r="14" fill="#ECA24F" />
              {/* Back Hill */}
              <path
                d="M40 90 C70 50, 110 50, 160 70 L160 90 Z"
                fill="#4D8E67"
                opacity="0.85"
              />
              {/* Foreground Rolling Hill */}
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
          {/* Header */}
          <div className="ym04-section-header">
            <div className="ym04-section-title-wrap">
              <Ribbon className="ym04-section-icon" size={22} strokeWidth={2.2} aria-hidden="true" />
              <h2 id="heading-grade-list" className="ym04-section-title">Grade List</h2>
            </div>
            <button
              type="button"
              className="ym04-btn-add"
              onClick={handleOpenAdd}
              aria-label="Add new grade"
            >
              <Plus size={16} aria-hidden="true" />
              <span>Add Grade</span>
            </button>
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
                  onClick={() => setSearchQuery('')}
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
            <table className="ym04-table" aria-label="Grade List Table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '15%' }}>Grade ID</th>
                  <th scope="col" style={{ width: '22%' }}>Grade Name</th>
                  <th scope="col" style={{ width: '27%' }}>Description</th>
                  <th scope="col" style={{ width: '16%' }}>Status</th>
                  <th scope="col" style={{ width: '14%' }}>Created Date</th>
                  <th scope="col" style={{ width: '6%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedGrades.length > 0 ? (
                  paginatedGrades.map((grade) => (
                    <tr
                      key={grade.id}
                      className={selectedGradeId === grade.id ? 'ym04-row--selected' : ''}
                    >
                      <td className="ym04-cell-crop-id">{grade.id}</td>
                      <td className="ym04-cell-crop-name-bold">{grade.name}</td>
                      <td className="ym04-cell-grade-desc">{grade.description}</td>
                      <td>
                        <span
                          className={`ym04-badge-status ${
                            grade.status === 'Active'
                              ? 'ym04-badge-status--active'
                              : 'ym04-badge-status--inactive'
                          }`}
                        >
                          <span className="ym04-status-dot" aria-hidden="true" />
                          <span>{grade.status}</span>
                        </span>
                      </td>
                      <td className="ym04-cell-date">{grade.createdDate}</td>
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
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="ym04-table-empty">
                        <p className="ym04-empty-title">No grades found</p>
                        <p className="ym04-empty-desc">
                          {searchQuery || statusFilter !== 'All'
                            ? 'No produce grades match your active filter criteria. Try clearing search or status filters.'
                            : 'No produce grade records available.'}
                        </p>
                        {(searchQuery || statusFilter !== 'All') && (
                          <button
                            type="button"
                            className="ym04-btn-view"
                            onClick={() => {
                              setSearchQuery('');
                              setStatusFilter('All');
                            }}
                          >
                            Reset Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="ym04-pagination-row">
            <span className="ym04-pagination-info">
              {filteredGrades.length > 0
                ? `Showing ${startIndex + 1}–${Math.min(
                    startIndex + pageSize,
                    filteredGrades.length
                  )} of ${filteredGrades.length} grades`
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
          {/* Header */}
          <div className="ym04-side-panel-header">
            <div className="ym04-section-title-wrap">
              <Ribbon className="ym04-section-icon" size={20} strokeWidth={2.2} aria-hidden="true" />
              <h2 id="heading-side-panel" className="ym04-side-panel-title">
                {panelMode === 'view' ? 'Grade Details' : 'Add / Edit Grade'}
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

          {/* Error Banner */}
          {formError && (
            <div className="ym04-form-alert" role="alert">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          {panelMode === 'view' ? (
            /* View Mode Readout */
            <div className="ym04-view-panel-body">
              <div className="ym04-detail-grid">
                <div className="ym04-detail-item">
                  <span className="ym04-detail-label">Grade ID</span>
                  <span className="ym04-detail-value">{selectedGradeId}</span>
                </div>
                <div className="ym04-detail-item">
                  <span className="ym04-detail-label">Status</span>
                  <span
                    className={`ym04-badge-status ${
                      formStatus === 'Active'
                        ? 'ym04-badge-status--active'
                        : 'ym04-badge-status--inactive'
                    }`}
                  >
                    <span className="ym04-status-dot" aria-hidden="true" />
                    <span>{formStatus}</span>
                  </span>
                </div>
                <div className="ym04-detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="ym04-detail-label">Grade Name</span>
                  <span className="ym04-detail-value">{formName}</span>
                </div>
                <div className="ym04-detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="ym04-detail-label">Description</span>
                  <p className="ym04-detail-desc">{formDescription || 'No description provided.'}</p>
                </div>
              </div>

              <div className="ym04-panel-actions">
                <button
                  type="button"
                  className="ym04-panel-btn-cancel"
                  onClick={handleClosePanel}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="ym04-panel-btn-save"
                  onClick={() => setPanelMode('edit')}
                >
                  Edit This Grade
                </button>
              </div>
            </div>
          ) : (
            /* Add / Edit Form */
            <form className="ym04-crop-form" onSubmit={handleSaveGrade}>
              {/* Field 1: Grade Name */}
              <div className="ym04-form-group">
                <label htmlFor="grade-name-input" className="ym04-form-label">
                  Grade Name <span className="ym04-required-star">*</span>
                </label>
                <input
                  id="grade-name-input"
                  type="text"
                  className="ym04-form-input"
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
                      value="Active"
                      checked={formStatus === 'Active'}
                      onChange={() => setFormStatus('Active')}
                      className="ym04-radio-input"
                    />
                    <span className="ym04-radio-custom" />
                    <span className="ym04-radio-text">Active</span>
                  </label>

                  <label className="ym04-radio-item">
                    <input
                      type="radio"
                      name="grade-status"
                      value="Inactive"
                      checked={formStatus === 'Inactive'}
                      onChange={() => setFormStatus('Inactive')}
                      className="ym04-radio-input"
                    />
                    <span className="ym04-radio-custom" />
                    <span className="ym04-radio-text">Inactive</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="ym04-panel-actions">
                <button
                  type="button"
                  className="ym04-panel-btn-cancel"
                  onClick={handleClosePanel}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ym04-panel-btn-save"
                >
                  Save Grade
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom Quick Actions Bar                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-quick-actions-bar" aria-label="Quick Actions">
        <div className="ym04-quick-actions-left">
          <Zap className="ym04-quick-actions-icon" size={22} aria-hidden="true" />
          <div>
            <h3 className="ym04-quick-actions-title">Quick Actions</h3>
            <p className="ym04-quick-actions-subtitle">Access grade management features quickly.</p>
          </div>
        </div>

        <div className="ym04-quick-actions-btns">
          {/* Action 1: Manage Grades (Active on this page) */}
          <button
            type="button"
            className="ym04-qa-btn ym04-qa-btn--green"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setToastMessage('Already viewing Grade Management. Filter or edit grades above.');
            }}
          >
            <Ribbon size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>Manage Grades</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>

          {/* Action 2: View Grade Insights */}
          <button
            type="button"
            className="ym04-qa-btn ym04-qa-btn--white"
            onClick={() => {
              setToastMessage('Navigating to Market Insights...');
              navigate('/admin/market-data');
            }}
          >
            <BarChart2 size={16} aria-hidden="true" />
            <span>View Grade Insights</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>

          {/* Action 3: View Audit Trail */}
          <button
            type="button"
            className="ym04-qa-btn ym04-qa-btn--white"
            onClick={() => {
              setToastMessage('Navigating to Audit Trail...');
              navigate('/admin/audit-trail');
            }}
          >
            <FileText size={16} aria-hidden="true" />
            <span>View Audit Trail</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          open={Boolean(toastMessage)}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
