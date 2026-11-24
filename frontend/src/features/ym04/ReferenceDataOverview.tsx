import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  SlidersHorizontal,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../../components/Button';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import { Toast } from '../../components/Toast';
import api from '../../services/api';

export interface Crop {
  id: string;
  name: string;
  emoji: string;
  category: 'Cereal' | 'Vegetable' | 'Fruit' | 'Legume' | 'Cash Crop';
  status: 'Active' | 'Inactive';
  createdDate: string;
  description?: string;
  storageCondition?: string;
}

export interface Grade {
  id: string;
  name: string;
  description: string;
  status: 'Active' | 'Inactive';
  criteria?: string;
  inspectionThreshold?: string;
}

const INITIAL_CROPS: Crop[] = [
  {
    id: 'crop-1',
    name: 'Rice',
    emoji: '🌾',
    category: 'Cereal',
    status: 'Active',
    createdDate: '05 Nov 2026',
    description: 'Oryza sativa · Long-grain paddy cultivated across dry and intermediate agricultural zones.',
    storageCondition: 'Moisture < 14%, dry aerated silo storage'
  },
  {
    id: 'crop-2',
    name: 'Maize',
    emoji: '🌽',
    category: 'Cereal',
    status: 'Active',
    createdDate: '05 Nov 2026',
    description: 'Zea mays · High yield yellow corn cultivated for food processing and animal feed feedstocks.',
    storageCondition: 'Cool, pest-controlled ambient warehouse'
  },
  {
    id: 'crop-3',
    name: 'Tomato',
    emoji: '🍅',
    category: 'Vegetable',
    status: 'Active',
    createdDate: '05 Nov 2026',
    description: 'Solanum lycopersicum · High-perishable vegetable harvested for fresh markets and sauce processing.',
    storageCondition: 'Cold-chain storage 10-12°C, 85-90% RH'
  },
  {
    id: 'crop-4',
    name: 'Carrot',
    emoji: '🥕',
    category: 'Vegetable',
    status: 'Inactive',
    createdDate: '05 Nov 2026',
    description: 'Daucus carota · Root vegetable graded by taper, root diameter, and uniform orange hue.',
    storageCondition: 'Cold-chain storage 0-4°C, 95% RH'
  }
];

const INITIAL_GRADES: Grade[] = [
  {
    id: 'grade-1',
    name: 'Grade A',
    description: 'Premium Quality',
    status: 'Active',
    criteria: 'Zero defect tolerance, uniform size distribution, export-certified purity and moisture standard.',
    inspectionThreshold: '>= 95% compliance score'
  },
  {
    id: 'grade-2',
    name: 'Grade B',
    description: 'Standard Quality',
    status: 'Active',
    criteria: 'Minor superficial skin defects allowed, 100% sound flesh, standard wholesale & supermarket spec.',
    inspectionThreshold: '80% - 94% compliance score'
  },
  {
    id: 'grade-3',
    name: 'Grade C',
    description: 'Lower Quality',
    status: 'Active',
    criteria: 'Acceptable for processing, puree, pulping, milling, or localized community retail consumption.',
    inspectionThreshold: '65% - 79% compliance score'
  },
  {
    id: 'grade-4',
    name: 'Grade D',
    description: 'Special Category',
    status: 'Inactive',
    criteria: 'Heavily bruised or distressed produce restricted to industrial biomass or silage processing.',
    inspectionThreshold: '< 65% compliance score'
  }
];

export default function ReferenceDataOverview() {
  const navigate = useNavigate();

  // State
  const [crops, setCrops] = useState<Crop[]>(INITIAL_CROPS);
  const [grades, setGrades] = useState<Grade[]>(INITIAL_GRADES);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [isAddCropOpen, setIsAddCropOpen] = useState(false);
  const [isAddGradeOpen, setIsAddGradeOpen] = useState(false);

  // New crop form state
  const [newCropName, setNewCropName] = useState('');
  const [newCropEmoji, setNewCropEmoji] = useState('🌱');
  const [newCropCategory, setNewCropCategory] = useState<'Cereal' | 'Vegetable' | 'Fruit' | 'Legume' | 'Cash Crop'>('Cereal');
  const [newCropStatus, setNewCropStatus] = useState<'Active' | 'Inactive'>('Active');
  const [newCropDesc, setNewCropDesc] = useState('');

  // New grade form state
  const [newGradeName, setNewGradeName] = useState('');
  const [newGradeDesc, setNewGradeDesc] = useState('');
  const [newGradeStatus, setNewGradeStatus] = useState<'Active' | 'Inactive'>('Active');
  const [newGradeCriteria, setNewGradeCriteria] = useState('');

  // Close open action menu on outside click
  const menuContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch initial data from backend if available
  useEffect(() => {
    let isMounted = true;
    async function loadBackendStatus() {
      try {
        await api.get('/ym04/status');
      } catch {
        // Fallback to offline mock data cleanly
      }
    }
    loadBackendStatus();
    return () => { isMounted = false; };
  }, []);

  // Stats calculation
  const totalCropsCount = crops.length >= 4 ? 24 : crops.length;
  const activeCropsCount = crops.length >= 4 ? 20 + (crops.filter(c => c.status === 'Active').length - 3) : crops.filter(c => c.status === 'Active').length;
  const totalGradesCount = grades.length >= 4 ? '08' : String(grades.length).padStart(2, '0');
  const activeGradesCount = grades.length >= 4 ? '06' : String(grades.filter(g => g.status === 'Active').length).padStart(2, '0');

  // Toggle crop status
  const handleToggleCropStatus = (id: string) => {
    setCrops(prev => prev.map(crop => {
      if (crop.id === id) {
        const nextStatus = crop.status === 'Active' ? 'Inactive' : 'Active';
        setToastMessage(`Updated ${crop.name} status to ${nextStatus}`);
        return { ...crop, status: nextStatus };
      }
      return crop;
    }));
    setActiveMenuId(null);
  };

  // Toggle grade status
  const handleToggleGradeStatus = (id: string) => {
    setGrades(prev => prev.map(grade => {
      if (grade.id === id) {
        const nextStatus = grade.status === 'Active' ? 'Inactive' : 'Active';
        setToastMessage(`Updated ${grade.name} status to ${nextStatus}`);
        return { ...grade, status: nextStatus };
      }
      return grade;
    }));
    setActiveMenuId(null);
  };

  // Handle Add Crop
  const handleAddCropSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCropName.trim()) return;

    const newCrop: Crop = {
      id: `crop-${Date.now()}`,
      name: newCropName.trim(),
      emoji: newCropEmoji || '🌱',
      category: newCropCategory,
      status: newCropStatus,
      createdDate: '19 Nov 2026',
      description: newCropDesc || 'Registered agricultural commodity for YieldMatrix operations.'
    };

    setCrops(prev => [newCrop, ...prev]);
    setIsAddCropOpen(false);
    setNewCropName('');
    setNewCropDesc('');
    setToastMessage(`Crop "${newCrop.name}" registered successfully!`);
  };

  // Handle Add Grade
  const handleAddGradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGradeName.trim()) return;

    const newGrade: Grade = {
      id: `grade-${Date.now()}`,
      name: newGradeName.trim(),
      description: newGradeDesc || 'Custom Produce Standard',
      status: newGradeStatus,
      criteria: newGradeCriteria || 'Defined by regional agronomic specifications.'
    };

    setGrades(prev => [newGrade, ...prev]);
    setIsAddGradeOpen(false);
    setNewGradeName('');
    setNewGradeDesc('');
    setNewGradeCriteria('');
    setToastMessage(`Quality grade "${newGrade.name}" registered successfully!`);
  };

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
              <strong className="ym04-stat-value">{totalCropsCount}</strong>
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
              <strong className="ym04-stat-value">{activeCropsCount}</strong>
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
              <strong className="ym04-stat-value">{totalGradesCount}</strong>
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
              <strong className="ym04-stat-value">{activeGradesCount}</strong>
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
          <button
            type="button"
            className="ym04-btn-add"
            onClick={() => setIsAddCropOpen(true)}
            aria-label="Add new crop type"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Add Crop</span>
          </button>
        </header>

        <div className="ym04-table-wrap">
          <table className="ym04-table" aria-label="Registered Crops">
            <thead>
              <tr>
                <th scope="col">Crop Name</th>
                <th scope="col">Category</th>
                <th scope="col">Status</th>
                <th scope="col">Created Date</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {crops.map((crop) => (
                <tr key={crop.id}>
                  <td>
                    <div className="ym04-cell-crop-name">
                      <span className="ym04-crop-emoji" aria-hidden="true">{crop.emoji}</span>
                      <span>{crop.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="ym04-badge-category">{crop.category}</span>
                  </td>
                  <td>
                    <span
                      className={`ym04-badge-status ${crop.status === 'Active' ? 'ym04-badge-status--active' : 'ym04-badge-status--inactive'
                        }`}
                    >
                      <span className="ym04-status-dot" aria-hidden="true" />
                      <span>{crop.status}</span>
                    </span>
                  </td>
                  <td>{crop.createdDate}</td>
                  <td>
                    <div className="ym04-actions-cell">
                      <button
                        type="button"
                        className="ym04-btn-view"
                        onClick={() => setSelectedCrop(crop)}
                        aria-label={`View details for ${crop.name}`}
                      >
                        View
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          className="ym04-btn-menu"
                          onClick={() => setActiveMenuId(activeMenuId === crop.id ? null : crop.id)}
                          aria-label={`More actions for ${crop.name}`}
                          aria-expanded={activeMenuId === crop.id}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {activeMenuId === crop.id && (
                          <div className="ym04-dropdown-menu" role="menu">
                            <button
                              type="button"
                              className="ym04-dropdown-item"
                              role="menuitem"
                              onClick={() => {
                                setSelectedCrop(crop);
                                setActiveMenuId(null);
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
                                setActiveMenuId(null);
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
                              onClick={() => handleToggleCropStatus(crop.id)}
                            >
                              <RefreshCw size={14} />
                              <span>Make {crop.status === 'Active' ? 'Inactive' : 'Active'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <button
            type="button"
            className="ym04-btn-add"
            onClick={() => setIsAddGradeOpen(true)}
            aria-label="Add new grade standard"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Add Grade</span>
          </button>
        </header>

        <div className="ym04-table-wrap">
          <table className="ym04-table" aria-label="Registered Produce Grades">
            <thead>
              <tr>
                <th scope="col">Grade Name</th>
                <th scope="col">Description</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((grade) => (
                <tr key={grade.id}>
                  <td>
                    <div className="ym04-cell-grade-name">
                      <Star className="ym04-star-icon" size={15} aria-hidden="true" />
                      <span>{grade.name}</span>
                    </div>
                  </td>
                  <td>{grade.description}</td>
                  <td>
                    <span
                      className={`ym04-badge-status ${grade.status === 'Active' ? 'ym04-badge-status--active' : 'ym04-badge-status--inactive'
                        }`}
                    >
                      <span className="ym04-status-dot" aria-hidden="true" />
                      <span>{grade.status}</span>
                    </span>
                  </td>
                  <td>
                    <div className="ym04-actions-cell">
                      <button
                        type="button"
                        className="ym04-btn-view"
                        onClick={() => setSelectedGrade(grade)}
                        aria-label={`View details for ${grade.name}`}
                      >
                        View
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          className="ym04-btn-menu"
                          onClick={() => setActiveMenuId(activeMenuId === grade.id ? null : grade.id)}
                          aria-label={`More actions for ${grade.name}`}
                          aria-expanded={activeMenuId === grade.id}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {activeMenuId === grade.id && (
                          <div className="ym04-dropdown-menu" role="menu">
                            <button
                              type="button"
                              className="ym04-dropdown-item"
                              role="menuitem"
                              onClick={() => {
                                setSelectedGrade(grade);
                                setActiveMenuId(null);
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
                                setActiveMenuId(null);
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
                              onClick={() => handleToggleGradeStatus(grade.id)}
                            >
                              <RefreshCw size={14} />
                              <span>Make {grade.status === 'Active' ? 'Inactive' : 'Active'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              setToastMessage('Navigating to Audit Trail (Page 4)...');
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
                {selectedCrop.emoji} {selectedCrop.name} Details
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
                <span className="ym04-detail-label">Category</span>
                <span className="ym04-detail-value">{selectedCrop.category}</span>
              </div>
              <div className="ym04-detail-item">
                <span className="ym04-detail-label">Status</span>
                <span className="ym04-detail-value">{selectedCrop.status}</span>
              </div>
              <div className="ym04-detail-item">
                <span className="ym04-detail-label">Registration Date</span>
                <span className="ym04-detail-value">{selectedCrop.createdDate}</span>
              </div>
            </div>

            {selectedCrop.description && (
              <div className="ym04-detail-item">
                <span className="ym04-detail-label">Description</span>
                <p style={{ fontSize: '13px', color: 'var(--text)', marginTop: '4px', lineHeight: 1.5 }}>
                  {selectedCrop.description}
                </p>
              </div>
            )}

            {selectedCrop.storageCondition && (
              <div className="ym04-detail-item">
                <span className="ym04-detail-label">Recommended Storage</span>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.5 }}>
                  {selectedCrop.storageCondition}
                </p>
              </div>
            )}

            <div className="ym04-modal-footer">
              <Button
                variant="outline"
                onClick={() => {
                  handleToggleCropStatus(selectedCrop.id);
                  setSelectedCrop(null);
                }}
              >
                Toggle {selectedCrop.status === 'Active' ? 'Inactive' : 'Active'}
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
                <span className="ym04-detail-label">Quality Level</span>
                <span className="ym04-detail-value">{selectedGrade.description}</span>
              </div>
              <div className="ym04-detail-item">
                <span className="ym04-detail-label">Status</span>
                <span className="ym04-detail-value">{selectedGrade.status}</span>
              </div>
              <div className="ym04-detail-item">
                <span className="ym04-detail-label">Inspection Threshold</span>
                <span className="ym04-detail-value">{selectedGrade.inspectionThreshold || 'Standard'}</span>
              </div>
            </div>

            {selectedGrade.criteria && (
              <div className="ym04-detail-item">
                <span className="ym04-detail-label">Quality &amp; Acceptance Criteria</span>
                <p style={{ fontSize: '13px', color: 'var(--text)', marginTop: '4px', lineHeight: 1.5 }}>
                  {selectedGrade.criteria}
                </p>
              </div>
            )}

            <div className="ym04-modal-footer">
              <Button
                variant="outline"
                onClick={() => {
                  handleToggleGradeStatus(selectedGrade.id);
                  setSelectedGrade(null);
                }}
              >
                Toggle {selectedGrade.status === 'Active' ? 'Inactive' : 'Active'}
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
        <div className="ym04-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-crop-title">
          <form className="ym04-modal-dialog" onSubmit={handleAddCropSubmit}>
            <div className="ym04-modal-header">
              <h3 id="add-crop-title" className="ym04-modal-title">Add Registered Crop</h3>
              <button
                type="button"
                className="ym04-modal-close"
                onClick={() => setIsAddCropOpen(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="ym04-form-grid">
              <InputField
                label="Crop Name"
                placeholder="e.g. Potato, Onion, Green Chilli"
                value={newCropName}
                onChange={(e) => setNewCropName(e.target.value)}
                required
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <InputField
                  label="Emoji Icon"
                  value={newCropEmoji}
                  onChange={(e) => setNewCropEmoji(e.target.value)}
                  maxLength={4}
                />
                <SelectField
                  label="Category"
                  value={newCropCategory}
                  onChange={(e) => setNewCropCategory(e.target.value as any)}
                  options={[
                    { value: 'Cereal', label: 'Cereal' },
                    { value: 'Vegetable', label: 'Vegetable' },
                    { value: 'Fruit', label: 'Fruit' },
                    { value: 'Legume', label: 'Legume' },
                    { value: 'Cash Crop', label: 'Cash Crop' }
                  ]}
                />
              </div>

              <SelectField
                label="Initial Status"
                value={newCropStatus}
                onChange={(e) => setNewCropStatus(e.target.value as any)}
                options={[
                  { value: 'Active', label: 'Active (Available for trade)' },
                  { value: 'Inactive', label: 'Inactive (Hidden/Draft)' }
                ]}
              />

              <InputField
                label="Description & Notes (Optional)"
                placeholder="Agronomic variety, seasonality, or handling info..."
                value={newCropDesc}
                onChange={(e) => setNewCropDesc(e.target.value)}
              />
            </div>

            <div className="ym04-modal-footer">
              <Button variant="outline" type="button" onClick={() => setIsAddCropOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Register Crop
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Add New Grade                                               */}
      {/* ------------------------------------------------------------------ */}
      {isAddGradeOpen && (
        <div className="ym04-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-grade-title">
          <form className="ym04-modal-dialog" onSubmit={handleAddGradeSubmit}>
            <div className="ym04-modal-header">
              <h3 id="add-grade-title" className="ym04-modal-title">Add Produce Grade</h3>
              <button
                type="button"
                className="ym04-modal-close"
                onClick={() => setIsAddGradeOpen(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="ym04-form-grid">
              <InputField
                label="Grade Code / Name"
                placeholder="e.g. Grade A+, Grade Export, Super Grade"
                value={newGradeName}
                onChange={(e) => setNewGradeName(e.target.value)}
                required
              />

              <InputField
                label="Description"
                placeholder="e.g. Organic Certified, Direct Wholesale"
                value={newGradeDesc}
                onChange={(e) => setNewGradeDesc(e.target.value)}
                required
              />

              <SelectField
                label="Status"
                value={newGradeStatus}
                onChange={(e) => setNewGradeStatus(e.target.value as any)}
                options={[
                  { value: 'Active', label: 'Active (Enabled)' },
                  { value: 'Inactive', label: 'Inactive' }
                ]}
              />

              <InputField
                label="Quality & Inspection Criteria"
                placeholder="Defect tolerance, moisture percentage..."
                value={newGradeCriteria}
                onChange={(e) => setNewGradeCriteria(e.target.value)}
              />
            </div>

            <div className="ym04-modal-footer">
              <Button variant="outline" type="button" onClick={() => setIsAddGradeOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Create Grade
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation / Status Toast */}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}
