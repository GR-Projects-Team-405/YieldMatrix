import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Sprout,
  Check,
  Tag,
  ChevronRight,
  Plus,
  MoreVertical,
  Zap,
  ArrowRight,
  ShieldCheck,
  Star,
  Award,
  X,
  Eye,
  RefreshCw,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/Button';
import { InputField } from '../../components/InputField';
import { StatusBadge } from '../../components/StatusBadge';
import { Table, TableRow } from '../../components/Table';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Toast } from '../../components/Toast';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import api from '../../services/api';
import { Crop, Grade, OverviewData, getErrorMessage } from './types';

export default function ReferenceDataOverview() {
  const navigate = useNavigate();

  // Live state
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [isAddCropOpen, setIsAddCropOpen] = useState(false);
  const [isAddGradeOpen, setIsAddGradeOpen] = useState(false);

  // New crop form state
  const [newCropName, setNewCropName] = useState('');
  const [newCropActive, setNewCropActive] = useState(true);
  const [newCropReason, setNewCropReason] = useState('');
  const [cropFormError, setCropFormError] = useState<string | null>(null);
  const [isSubmittingCrop, setIsSubmittingCrop] = useState(false);

  // New grade form state
  const [newGradeName, setNewGradeName] = useState('');
  const [newGradeDesc, setNewGradeDesc] = useState('');
  const [newGradeActive, setNewGradeActive] = useState(true);
  const [newGradeReason, setNewGradeReason] = useState('');
  const [gradeFormError, setGradeFormError] = useState<string | null>(null);
  const [isSubmittingGrade, setIsSubmittingGrade] = useState(false);

  // Deactivate confirmation dialog state
  const [deactivateConfirm, setDeactivateConfirm] = useState<{
    open: boolean;
    type: 'crop' | 'grade';
    id: string;
    name: string;
    busy?: boolean;
  } | null>(null);

  // Close open action menu on outside click
  const menuContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setActionMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch live overview from backend
  const fetchOverview = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/ym04/overview', { signal });
      setData(response.data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      setError(getErrorMessage(err, 'Failed to load reference data overview.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchOverview(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchOverview]);

  // Handle Add Crop submission
  const handleAddCropSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCropName.trim()) {
      setCropFormError('Crop name is required.');
      return;
    }
    setCropFormError(null);
    setIsSubmittingCrop(true);

    try {
      const payload: { name: string; active: boolean; reason?: string } = {
        name: newCropName.trim(),
        active: newCropActive
      };
      if (newCropReason.trim()) {
        payload.reason = newCropReason.trim();
      }

      await api.post('/ym04/crops', payload);
      setToastMessage(`Crop "${newCropName.trim()}" created successfully!`);
      setIsAddCropOpen(false);
      setNewCropName('');
      setNewCropActive(true);
      setNewCropReason('');
      fetchOverview();
    } catch (err) {
      setCropFormError(getErrorMessage(err, 'Failed to create crop.'));
    } finally {
      setIsSubmittingCrop(false);
    }
  };

  // Handle Add Grade submission
  const handleAddGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGradeName.trim()) {
      setGradeFormError('Grade name is required.');
      return;
    }
    setGradeFormError(null);
    setIsSubmittingGrade(true);

    try {
      const payload: { name: string; description?: string | null; active: boolean; reason?: string } = {
        name: newGradeName.trim(),
        description: newGradeDesc.trim() || null,
        active: newGradeActive
      };
      if (newGradeReason.trim()) {
        payload.reason = newGradeReason.trim();
      }

      await api.post('/ym04/grades', payload);
      setToastMessage(`Quality grade "${newGradeName.trim()}" created successfully!`);
      setIsAddGradeOpen(false);
      setNewGradeName('');
      setNewGradeDesc('');
      setNewGradeActive(true);
      setNewGradeReason('');
      fetchOverview();
    } catch (err) {
      setGradeFormError(getErrorMessage(err, 'Failed to create grade.'));
    } finally {
      setIsSubmittingGrade(false);
    }
  };

  // Execute Toggle Crop status via PATCH
  const executeToggleCropStatus = async (id: string, currentActive: boolean, name: string) => {
    try {
      const nextActive = !currentActive;
      await api.patch(`/ym04/crops/${id}`, {
        active: nextActive,
        reason: nextActive ? `Activated crop ${name}` : `Deactivated crop ${name}`
      });
      setToastMessage(`Crop "${name}" set to ${nextActive ? 'Active' : 'Inactive'}.`);
      fetchOverview();
    } catch (err) {
      setToastMessage(getErrorMessage(err, 'Failed to update crop status.'));
    } finally {
      setActionMenuId(null);
      setDeactivateConfirm(null);
    }
  };

  // Execute Toggle Grade status via PATCH
  const executeToggleGradeStatus = async (id: string, currentActive: boolean, name: string) => {
    try {
      const nextActive = !currentActive;
      await api.patch(`/ym04/grades/${id}`, {
        active: nextActive,
        reason: nextActive ? `Activated grade ${name}` : `Deactivated grade ${name}`
      });
      setToastMessage(`Grade "${name}" set to ${nextActive ? 'Active' : 'Inactive'}.`);
      fetchOverview();
    } catch (err) {
      setToastMessage(getErrorMessage(err, 'Failed to update grade status.'));
    } finally {
      setActionMenuId(null);
      setDeactivateConfirm(null);
    }
  };

  // Handle click on Toggle Crop status
  const handleToggleCropStatus = (crop: Crop) => {
    if (crop.active) {
      setDeactivateConfirm({
        open: true,
        type: 'crop',
        id: crop.id,
        name: crop.name
      });
      setActionMenuId(null);
      return;
    }
    executeToggleCropStatus(crop.id, crop.active, crop.name);
  };

  // Handle click on Toggle Grade status
  const handleToggleGradeStatus = (grade: Grade) => {
    if (grade.active) {
      setDeactivateConfirm({
        open: true,
        type: 'grade',
        id: grade.id,
        name: grade.name
      });
      setActionMenuId(null);
      return;
    }
    executeToggleGradeStatus(grade.id, grade.active, grade.name);
  };

  // Summary counts from live API
  const totalCropsCount = data?.totalCrops ?? data?.summary?.totalCrops ?? 0;
  const activeCropsCount = data?.activeCrops ?? data?.summary?.activeCrops ?? 0;
  const totalGradesCount = data?.totalGrades ?? data?.summary?.totalGrades ?? 0;
  const activeGradesCount = data?.activeGrades ?? data?.summary?.activeGrades ?? 0;

  const cropsList = data?.crops || [];
  const gradesList = data?.grades || [];

  return (
    <div className="ym04-container" ref={menuContainerRef}>
      {/* ------------------------------------------------------------------ */}
      {/* Page Header matching Figma layout                                 */}
      {/* ------------------------------------------------------------------ */}
      <header className="ym04-header">
        <h1 className="ym04-title">Reference Data Overview</h1>
        <p className="ym04-subtitle">
          Manage crop types and produce grades used across the YieldMatrix platform.
        </p>
      </header>

      {/* Global Error Banner with Retry */}
      {error && (
        <div className="ym04-alert-wrap" role="alert">
          <Alert type="error">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', width: '100%' }}>
              <span>{error}</span>
              <Button variant="outline" onClick={() => fetchOverview()}>
                <RefreshCw size={14} className={loading ? 'ym04-spin' : ''} style={{ marginRight: '6px' }} />
                Retry
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Top Stat Cards (4 Cards Grid)                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-stats-grid" aria-label="Reference data metrics summary">
        {/* Card 1: Total Crops */}
        <div
          className="ym04-stat-card cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/admin/reference-data/crops')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/reference-data/crops')}
          title="Manage registered crops in Crop Management"
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--sprout" aria-hidden="true">
              <Sprout size={22} strokeWidth={2} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Total Crops</span>
              <strong className="ym04-stat-value">{loading ? '...' : totalCropsCount}</strong>
              <span className="ym04-stat-subtext">All registered crop types</span>
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
          onClick={() => navigate('/admin/reference-data/crops')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/reference-data/crops')}
          title="View active crops in Crop Management"
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--active-crops" aria-hidden="true">
              <Check size={22} strokeWidth={3} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Active Crops</span>
              <strong className="ym04-stat-value">{loading ? '...' : activeCropsCount}</strong>
              <span className="ym04-stat-subtext">Currently available crops</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 3: Total Grades */}
        <div
          className="ym04-stat-card cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/admin/reference-data/grades')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/reference-data/grades')}
          title="Manage produce grades in Grade Management"
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--grades" aria-hidden="true">
              <Tag size={20} strokeWidth={2} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Total Grades</span>
              <strong className="ym04-stat-value">
                {loading ? '...' : String(totalGradesCount).padStart(2, '0')}
              </strong>
              <span className="ym04-stat-subtext">All registered produce grades</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 4: Active Grades */}
        <div
          className="ym04-stat-card cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/admin/reference-data/grades')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/reference-data/grades')}
          title="View active produce grades in Grade Management"
        >
          <div className="ym04-stat-left">
            <div className="ym04-stat-icon-wrap ym04-stat-icon--active-grades" aria-hidden="true">
              <Check size={22} strokeWidth={3} />
            </div>
            <div className="ym04-stat-info">
              <span className="ym04-stat-label">Active Grades</span>
              <strong className="ym04-stat-value">
                {loading ? '...' : String(activeGradesCount).padStart(2, '0')}
              </strong>
              <span className="ym04-stat-subtext">Currently available grades</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Crop Overview                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-section-card" aria-labelledby="heading-crop-overview">
        <header className="ym04-section-header">
          <div className="ym04-section-title-wrap">
            <Sprout className="ym04-section-icon" size={24} aria-hidden="true" />
            <div>
              <h2 id="heading-crop-overview" className="ym04-section-title">Crop Overview</h2>
              <p className="ym04-section-subtitle">View and manage registered crop types.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            className="ym04-btn-add"
            onClick={() => {
              setCropFormError(null);
              setIsAddCropOpen(true);
            }}
            aria-label="Add new crop type"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Add Crop</span>
          </Button>
        </header>

        <div className="ym04-table-wrap">
          {loading && !data ? (
            <div className="ym04-loading-state" style={{ padding: '40px', textAlign: 'center' }}>
              <Loader2 size={32} className="ym04-spin" style={{ margin: '0 auto 12px', color: 'var(--primary)' }} />
              <p style={{ color: 'var(--muted)' }}>Loading crop overview...</p>
            </div>
          ) : cropsList.length > 0 ? (
            <Table headers={['Crop Name', 'Status', 'Actions']} className="ym04-table" aria-label="Registered Crops">
              {cropsList.map((crop) => (
                <TableRow key={crop.id}>
                  <td>
                    <div className="ym04-cell-crop-name">
                      <Sprout size={18} className="ym04-target-green-icon" aria-hidden="true" />
                      <span className="ym04-cell-crop-name-bold">{crop.name}</span>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={crop.active ? 'Active' : 'Inactive'} />
                  </td>
                  <td>
                    <div className="ym04-actions-cell">
                      <Button
                        type="button"
                        variant="outline"
                        className="ym04-btn-view"
                        onClick={() => setSelectedCrop(crop)}
                        aria-label={`View details for ${crop.name}`}
                      >
                        View
                      </Button>
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          className="ym04-btn-menu"
                          onClick={() => setActionMenuId(actionMenuId === crop.id ? null : crop.id)}
                          aria-label={`More actions for ${crop.name}`}
                          aria-expanded={actionMenuId === crop.id}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {actionMenuId === crop.id && (
                          <div className="ym04-dropdown-menu" role="menu">
                            <button
                              type="button"
                              className="ym04-dropdown-item"
                              role="menuitem"
                              onClick={() => {
                                setSelectedCrop(crop);
                                setActionMenuId(null);
                              }}
                            >
                              <Eye size={14} />
                              <span>View Details</span>
                            </button>
                            <button
                              type="button"
                              className="ym04-dropdown-item"
                              role="menuitem"
                              onClick={() => {
                                setActionMenuId(null);
                                navigate('/admin/reference-data/crops');
                              }}
                            >
                              <Sprout size={14} />
                              <span>Manage Crops</span>
                            </button>
                            <button
                              type="button"
                              className="ym04-dropdown-item"
                              role="menuitem"
                              onClick={() => handleToggleCropStatus(crop)}
                            >
                              <RefreshCw size={14} />
                              <span>Make {crop.active ? 'Inactive' : 'Active'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </TableRow>
              ))}
            </Table>
          ) : (
            <div style={{ padding: '32px' }}>
              <EmptyState
                title="No crops registered"
                description="Get started by registering a new crop into the system."
                action={
                  <Button variant="primary" onClick={() => setIsAddCropOpen(true)}>
                    <Plus size={16} style={{ marginRight: '6px' }} />
                    Add Crop
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Grade Overview                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-section-card" aria-labelledby="heading-grade-overview">
        <header className="ym04-section-header">
          <div className="ym04-section-title-wrap">
            <Award className="ym04-section-icon" size={24} aria-hidden="true" />
            <div>
              <h2 id="heading-grade-overview" className="ym04-section-title">Grade Overview</h2>
              <p className="ym04-section-subtitle">View and manage produce quality grades.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            className="ym04-btn-add"
            onClick={() => {
              setGradeFormError(null);
              setIsAddGradeOpen(true);
            }}
            aria-label="Add new grade standard"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Add Grade</span>
          </Button>
        </header>

        <div className="ym04-table-wrap">
          {loading && !data ? (
            <div className="ym04-loading-state" style={{ padding: '40px', textAlign: 'center' }}>
              <Loader2 size={32} className="ym04-spin" style={{ margin: '0 auto 12px', color: 'var(--primary)' }} />
              <p style={{ color: 'var(--muted)' }}>Loading grade overview...</p>
            </div>
          ) : gradesList.length > 0 ? (
            <Table headers={['Grade Name', 'Description', 'Status', 'Actions']} className="ym04-table" aria-label="Registered Produce Grades">
              {gradesList.map((grade) => (
                <TableRow key={grade.id}>
                  <td>
                    <div className="ym04-cell-grade-name">
                      <Star className="ym04-star-icon" size={15} aria-hidden="true" />
                      <span className="ym04-cell-crop-name-bold">{grade.name}</span>
                    </div>
                  </td>
                  <td>{grade.description || '—'}</td>
                  <td>
                    <StatusBadge status={grade.active ? 'Active' : 'Inactive'} />
                  </td>
                  <td>
                    <div className="ym04-actions-cell">
                      <Button
                        type="button"
                        variant="outline"
                        className="ym04-btn-view"
                        onClick={() => setSelectedGrade(grade)}
                        aria-label={`View details for ${grade.name}`}
                      >
                        View
                      </Button>
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          className="ym04-btn-menu"
                          onClick={() => setActionMenuId(actionMenuId === grade.id ? null : grade.id)}
                          aria-label={`More actions for ${grade.name}`}
                          aria-expanded={actionMenuId === grade.id}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {actionMenuId === grade.id && (
                          <div className="ym04-dropdown-menu" role="menu">
                            <button
                              type="button"
                              className="ym04-dropdown-item"
                              role="menuitem"
                              onClick={() => {
                                setSelectedGrade(grade);
                                setActionMenuId(null);
                              }}
                            >
                              <Eye size={14} />
                              <span>View Details</span>
                            </button>
                            <button
                              type="button"
                              className="ym04-dropdown-item"
                              role="menuitem"
                              onClick={() => {
                                setActionMenuId(null);
                                navigate('/admin/reference-data/grades');
                              }}
                            >
                              <Award size={14} />
                              <span>Manage Grades</span>
                            </button>
                            <button
                              type="button"
                              className="ym04-dropdown-item"
                              role="menuitem"
                              onClick={() => handleToggleGradeStatus(grade)}
                            >
                              <RefreshCw size={14} />
                              <span>Make {grade.active ? 'Inactive' : 'Active'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </TableRow>
              ))}
            </Table>
          ) : (
            <div style={{ padding: '32px' }}>
              <EmptyState
                title="No grades registered"
                description="Get started by registering a new quality grade standard into the system."
                action={
                  <Button variant="primary" onClick={() => setIsAddGradeOpen(true)}>
                    <Plus size={16} style={{ marginRight: '6px' }} />
                    Add Grade
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Quick Actions (Bottom Bar)                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="ym04-quick-actions-bar" aria-label="Quick Actions">
        <div className="ym04-quick-actions-left">
          <Zap className="ym04-quick-actions-icon" size={22} aria-hidden="true" />
          <div>
            <h3 className="ym04-quick-actions-title">Quick Actions</h3>
            <p className="ym04-quick-actions-subtitle">Access key features quickly.</p>
          </div>
        </div>

        <div className="ym04-quick-actions-btns">
          {/* Action 1: Manage Crops */}
          <button
            type="button"
            className="ym04-qa-btn ym04-qa-btn--green"
            onClick={() => {
              navigate('/admin/reference-data/crops');
            }}
          >
            <Sprout size={16} aria-hidden="true" />
            <span>Manage Crops</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>

          {/* Action 2: Manage Grades */}
          <button
            type="button"
            className="ym04-qa-btn ym04-qa-btn--orange"
            onClick={() => {
              navigate('/admin/reference-data/grades');
            }}
          >
            <Award size={16} aria-hidden="true" />
            <span>Manage Grades</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>

          {/* Action 3: View Audit Trail */}
          <button
            type="button"
            className="ym04-qa-btn ym04-qa-btn--green"
            onClick={() => {
              setToastMessage('Navigating to Audit Trail...');
              navigate('/admin/audit-trail');
            }}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            <span>View Audit Trail</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Modal: View Crop Details                                           */}
      {/* ------------------------------------------------------------------ */}
      {selectedCrop && (
        <div className="ym04-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="crop-modal-title">
          <div className="ym04-modal-dialog">
            <div className="ym04-modal-header">
              <h3 id="crop-modal-title" className="ym04-modal-title">
                {selectedCrop.name} Details
              </h3>
              <button
                type="button"
                className="ym04-modal-close"
                onClick={() => setSelectedCrop(null)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="ym04-detail-grid">
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
              <div className="ym04-detail-item" style={{ gridColumn: 'span 2' }}>
                <span className="ym04-detail-label">System ID</span>
                <span className="ym04-detail-value" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                  {selectedCrop.id}
                </span>
              </div>
            </div>

            <div className="ym04-modal-footer">
              <Button
                variant="outline"
                onClick={() => {
                  handleToggleCropStatus(selectedCrop);
                  setSelectedCrop(null);
                }}
              >
                Toggle {selectedCrop.active ? 'Inactive' : 'Active'}
              </Button>
              <Button variant="primary" onClick={() => setSelectedCrop(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal: View Grade Details                                          */}
      {/* ------------------------------------------------------------------ */}
      {selectedGrade && (
        <div className="ym04-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="grade-modal-title">
          <div className="ym04-modal-dialog">
            <div className="ym04-modal-header">
              <h3 id="grade-modal-title" className="ym04-modal-title">
                ⭐ {selectedGrade.name} Specification
              </h3>
              <button
                type="button"
                className="ym04-modal-close"
                onClick={() => setSelectedGrade(null)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="ym04-detail-grid">
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
                <span className="ym04-detail-value">{selectedGrade.description || 'No description provided.'}</span>
              </div>
              <div className="ym04-detail-item" style={{ gridColumn: 'span 2' }}>
                <span className="ym04-detail-label">System ID</span>
                <span className="ym04-detail-value" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                  {selectedGrade.id}
                </span>
              </div>
            </div>

            <div className="ym04-modal-footer">
              <Button
                variant="outline"
                onClick={() => {
                  handleToggleGradeStatus(selectedGrade);
                  setSelectedGrade(null);
                }}
              >
                Toggle {selectedGrade.active ? 'Inactive' : 'Active'}
              </Button>
              <Button variant="primary" onClick={() => setSelectedGrade(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Add New Crop                                                */}
      {/* ------------------------------------------------------------------ */}
      {isAddCropOpen && (
        <div className="ym04-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-crop-modal-title">
          <div className="ym04-modal-dialog">
            <div className="ym04-modal-header">
              <h3 id="add-crop-modal-title" className="ym04-modal-title">
                Add New Crop Type
              </h3>
              <button
                type="button"
                className="ym04-modal-close"
                onClick={() => setIsAddCropOpen(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {cropFormError && (
              <div style={{ marginBottom: '16px' }}>
                <Alert type="error">{cropFormError}</Alert>
              </div>
            )}

            <form onSubmit={handleAddCropSubmit} className="ym04-crop-form">
              <div className="ym04-form-group">
                <InputField
                  label="Crop Name"
                  placeholder="e.g. Paddy Rice, Tomato"
                  value={newCropName}
                  onChange={(e) => setNewCropName(e.target.value)}
                  required
                />
              </div>

              <div className="ym04-form-group">
                <span className="ym04-form-label">Initial Status</span>
                <div className="ym04-radio-group">
                  <label className="ym04-radio-item">
                    <input
                      type="radio"
                      name="overview-crop-status"
                      checked={newCropActive === true}
                      onChange={() => setNewCropActive(true)}
                      className="ym04-radio-input"
                    />
                    <span className="ym04-radio-custom" />
                    <span className="ym04-radio-text">Active</span>
                  </label>
                  <label className="ym04-radio-item">
                    <input
                      type="radio"
                      name="overview-crop-status"
                      checked={newCropActive === false}
                      onChange={() => setNewCropActive(false)}
                      className="ym04-radio-input"
                    />
                    <span className="ym04-radio-custom" />
                    <span className="ym04-radio-text">Inactive</span>
                  </label>
                </div>
              </div>

              <div className="ym04-form-group">
                <InputField
                  label="Audit Reason (Optional)"
                  placeholder="Reason for adding crop"
                  value={newCropReason}
                  onChange={(e) => setNewCropReason(e.target.value)}
                />
              </div>

              <div className="ym04-modal-footer">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddCropOpen(false)}
                  disabled={isSubmittingCrop}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmittingCrop}
                >
                  {isSubmittingCrop ? 'Saving...' : 'Register Crop'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Add New Grade                                               */}
      {/* ------------------------------------------------------------------ */}
      {isAddGradeOpen && (
        <div className="ym04-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-grade-modal-title">
          <div className="ym04-modal-dialog">
            <div className="ym04-modal-header">
              <h3 id="add-grade-modal-title" className="ym04-modal-title">
                Add New Quality Grade
              </h3>
              <button
                type="button"
                className="ym04-modal-close"
                onClick={() => setIsAddGradeOpen(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {gradeFormError && (
              <div style={{ marginBottom: '16px' }}>
                <Alert type="error">{gradeFormError}</Alert>
              </div>
            )}

            <form onSubmit={handleAddGradeSubmit} className="ym04-crop-form">
              <div className="ym04-form-group">
                <InputField
                  label="Grade Name"
                  placeholder="e.g. Grade A, Grade Export"
                  value={newGradeName}
                  onChange={(e) => setNewGradeName(e.target.value)}
                  required
                />
              </div>

              <div className="ym04-form-group">
                <label htmlFor="overview-grade-desc" className="ym04-form-label">
                  Description
                </label>
                <textarea
                  id="overview-grade-desc"
                  className="ym04-form-textarea"
                  placeholder="Produce quality tier description..."
                  rows={3}
                  value={newGradeDesc}
                  onChange={(e) => setNewGradeDesc(e.target.value)}
                />
              </div>

              <div className="ym04-form-group">
                <span className="ym04-form-label">Initial Status</span>
                <div className="ym04-radio-group">
                  <label className="ym04-radio-item">
                    <input
                      type="radio"
                      name="overview-grade-status"
                      checked={newGradeActive === true}
                      onChange={() => setNewGradeActive(true)}
                      className="ym04-radio-input"
                    />
                    <span className="ym04-radio-custom" />
                    <span className="ym04-radio-text">Active</span>
                  </label>
                  <label className="ym04-radio-item">
                    <input
                      type="radio"
                      name="overview-grade-status"
                      checked={newGradeActive === false}
                      onChange={() => setNewGradeActive(false)}
                      className="ym04-radio-input"
                    />
                    <span className="ym04-radio-custom" />
                    <span className="ym04-radio-text">Inactive</span>
                  </label>
                </div>
              </div>

              <div className="ym04-form-group">
                <InputField
                  label="Audit Reason (Optional)"
                  placeholder="Reason for adding grade"
                  value={newGradeReason}
                  onChange={(e) => setNewGradeReason(e.target.value)}
                />
              </div>

              <div className="ym04-modal-footer">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddGradeOpen(false)}
                  disabled={isSubmittingGrade}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmittingGrade}
                >
                  {isSubmittingGrade ? 'Saving...' : 'Register Grade'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog on Deactivate */}
      {deactivateConfirm && (
        <ConfirmDialog
          open={deactivateConfirm.open}
          title={`Deactivate ${deactivateConfirm.type === 'crop' ? 'Crop' : 'Grade'}`}
          description={`Are you sure you want to deactivate "${deactivateConfirm.name}"? Inactive items will not be selectable in produce grading and allocations.`}
          confirmLabel="Yes, Deactivate"
          onCancel={() => setDeactivateConfirm(null)}
          onConfirm={() => {
            if (deactivateConfirm.type === 'crop') {
              executeToggleCropStatus(deactivateConfirm.id, true, deactivateConfirm.name);
            } else {
              executeToggleGradeStatus(deactivateConfirm.id, true, deactivateConfirm.name);
            }
          }}
        />
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
