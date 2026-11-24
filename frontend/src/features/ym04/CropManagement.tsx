import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Zap,
  ArrowRight,
  BarChart2,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Toast } from '../../components/Toast';

export interface CropItem {
  id: string;
  name: string;
  category: 'Cereal' | 'Vegetable' | 'Fruit' | 'Legume' | 'Cash Crop';
  status: 'Active' | 'Inactive';
  createdDate: string;
  description: string;
  storageCondition?: string;
}

// 24 realistic agricultural crop records matching Figma mock metrics (20 Active, 4 Inactive)
const INITIAL_CROPS: CropItem[] = [
  {
    id: 'CR001',
    name: 'Rice',
    category: 'Cereal',
    status: 'Active',
    createdDate: '05 Nov 2026',
    description: 'Oryza sativa · Long-grain paddy cultivated across dry and intermediate agricultural zones.',
    storageCondition: 'Moisture < 14%, dry aerated silo storage'
  },
  {
    id: 'CR002',
    name: 'Maize',
    category: 'Cereal',
    status: 'Active',
    createdDate: '04 Nov 2026',
    description: 'Zea mays · High yield yellow corn cultivated for food processing and animal feed feedstocks.',
    storageCondition: 'Cool, pest-controlled ambient warehouse'
  },
  {
    id: 'CR003',
    name: 'Tomato',
    category: 'Vegetable',
    status: 'Active',
    createdDate: '03 Nov 2026',
    description: 'Solanum lycopersicum · High-perishable vegetable harvested for fresh markets and sauce processing.',
    storageCondition: 'Cold-chain storage 10-12°C, 85-90% RH'
  },
  {
    id: 'CR004',
    name: 'Carrot',
    category: 'Vegetable',
    status: 'Inactive',
    createdDate: '01 Nov 2026',
    description: 'Daucus carota · Root vegetable graded by taper, root diameter, and uniform orange hue.',
    storageCondition: 'Cold-chain storage 0-4°C, 95% RH'
  },
  {
    id: 'CR005',
    name: 'Cabbage',
    category: 'Vegetable',
    status: 'Active',
    createdDate: '30 Oct 2026',
    description: 'Brassica oleracea · Tight-headed green cabbage cultivated in highland cooler climates.',
    storageCondition: 'Cold-chain storage 0-2°C, high humidity'
  },
  {
    id: 'CR006',
    name: 'Potato',
    category: 'Vegetable',
    status: 'Active',
    createdDate: '28 Oct 2026',
    description: 'Solanum tuberosum · Starchy tuber crop grown across Nuwara Eliya and Badulla regions.',
    storageCondition: 'Well-ventilated dark store 8-10°C'
  },
  {
    id: 'CR007',
    name: 'Big Onion',
    category: 'Vegetable',
    status: 'Active',
    createdDate: '27 Oct 2026',
    description: 'Allium cepa · Dry bulb onion essential for local culinary supply and market reserves.',
    storageCondition: 'Dry ambient air with continuous airflow'
  },
  {
    id: 'CR008',
    name: 'Green Chilli',
    category: 'Vegetable',
    status: 'Active',
    createdDate: '25 Oct 2026',
    description: 'Capsicum annuum · Pungent green hot chilli harvested daily for fresh market trade.',
    storageCondition: 'Chilled 7-10°C, perforated packaging'
  },
  {
    id: 'CR009',
    name: 'Banana',
    category: 'Fruit',
    status: 'Active',
    createdDate: '24 Oct 2026',
    description: 'Musa acuminata · Premium sour banana (Ambul) and Cavendish export grade varieties.',
    storageCondition: 'Controlled atmosphere 13-14°C'
  },
  {
    id: 'CR010',
    name: 'Papaya',
    category: 'Fruit',
    status: 'Active',
    createdDate: '22 Oct 2026',
    description: 'Carica papaya · Red Lady variety cultivated in dry intermediate plains.',
    storageCondition: 'Ventilated crates 12°C'
  },
  {
    id: 'CR011',
    name: 'Mango',
    category: 'Fruit',
    status: 'Inactive',
    createdDate: '20 Oct 2026',
    description: 'Mangifera indica · Sweet tropical mango varieties, seasonal harvest cycle.',
    storageCondition: 'Dry ambient cooling 12-14°C'
  },
  {
    id: 'CR012',
    name: 'Pineapple',
    category: 'Fruit',
    status: 'Active',
    createdDate: '18 Oct 2026',
    description: 'Ananas comosus · Mauritius variety pineapples with high sweetness and distinct aroma.',
    storageCondition: 'Cold-chain storage 10-12°C'
  },
  {
    id: 'CR013',
    name: 'Finger Millet',
    category: 'Cereal',
    status: 'Active',
    createdDate: '16 Oct 2026',
    description: 'Eleusine coracana · Kurakkan grain with high calcium and dietary fiber content.',
    storageCondition: 'Moisture < 12%, sealed silo storage'
  },
  {
    id: 'CR014',
    name: 'Black Gram',
    category: 'Legume',
    status: 'Active',
    createdDate: '14 Oct 2026',
    description: 'Vigna mungo · Protein-rich black gram pulse used for flour and commercial papadum.',
    storageCondition: 'Airtight sacks in pest-free dry store'
  },
  {
    id: 'CR015',
    name: 'Green Gram',
    category: 'Legume',
    status: 'Active',
    createdDate: '12 Oct 2026',
    description: 'Vigna radiata · Mung bean pulse cultivated across Mahaweli river valleys.',
    storageCondition: 'Dry aerated warehouse'
  },
  {
    id: 'CR016',
    name: 'Cowpea',
    category: 'Legume',
    status: 'Active',
    createdDate: '10 Oct 2026',
    description: 'Vigna unguiculata · Drought-tolerant pulse crop for balanced rural nutrition.',
    storageCondition: 'Moisture < 11%, fumigated storage'
  },
  {
    id: 'CR017',
    name: 'Soya Bean',
    category: 'Legume',
    status: 'Inactive',
    createdDate: '08 Oct 2026',
    description: 'Glycine max · Industrial processing pulse for edible oil and poultry feedstocks.',
    storageCondition: 'Standard dry warehouse'
  },
  {
    id: 'CR018',
    name: 'Ceylon Cinnamon',
    category: 'Cash Crop',
    status: 'Active',
    createdDate: '06 Oct 2026',
    description: 'Cinnamomum verum · Pure Ceylon true cinnamon quills with ultra-low coumarin levels.',
    storageCondition: 'Dry ventilated spice storage'
  },
  {
    id: 'CR019',
    name: 'Black Pepper',
    category: 'Cash Crop',
    status: 'Active',
    createdDate: '04 Oct 2026',
    description: 'Piper nigrum · High-piperine whole black peppercorns for global spice export.',
    storageCondition: 'Moisture < 12%, multi-wall craft bags'
  },
  {
    id: 'CR020',
    name: 'Cardamom',
    category: 'Cash Crop',
    status: 'Active',
    createdDate: '02 Oct 2026',
    description: 'Elettaria cardamomum · Green aromatic cardamom pods grown under hill country shade canopy.',
    storageCondition: 'Cool, sealed dark containers'
  },
  {
    id: 'CR021',
    name: 'Ceylon Tea',
    category: 'Cash Crop',
    status: 'Active',
    createdDate: '30 Sep 2026',
    description: 'Camellia sinensis · Hand-picked two leaves and a bud orthodox black tea.',
    storageCondition: 'Moisture-free aluminum lined sacks'
  },
  {
    id: 'CR022',
    name: 'Coconut',
    category: 'Cash Crop',
    status: 'Active',
    createdDate: '28 Sep 2026',
    description: 'Cocos nucifera · Coconut triangle harvested fresh nuts and copra processing.',
    storageCondition: 'Well-aerated covered yard'
  },
  {
    id: 'CR023',
    name: 'Pumpkin',
    category: 'Vegetable',
    status: 'Active',
    createdDate: '26 Sep 2026',
    description: 'Cucurbita moschata · Hard rind yellow pumpkin with exceptionally long shelf stability.',
    storageCondition: 'Ambient dry floor storage'
  },
  {
    id: 'CR024',
    name: 'Beetroot',
    category: 'Vegetable',
    status: 'Inactive',
    createdDate: '24 Sep 2026',
    description: 'Beta vulgaris · Vibrant red root crop grown in upcountry horticultural farms.',
    storageCondition: 'Cold-chain storage 0-3°C, 95% RH'
  }
];

const CATEGORIES: Array<CropItem['category']> = [
  'Cereal',
  'Vegetable',
  'Fruit',
  'Legume',
  'Cash Crop'
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

export default function CropManagement() {
  const navigate = useNavigate();

  // Master records
  const [crops, setCrops] = useState<CropItem[]>(INITIAL_CROPS);

  // Search, filter, pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Side Panel state: 'add' | 'edit' | 'view'
  const [panelMode, setPanelMode] = useState<'add' | 'edit' | 'view'>('add');
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);

  // Form input fields
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<CropItem['category'] | ''>('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formError, setFormError] = useState<string | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Summary counts
  const totalCrops = crops.length;
  const activeCrops = useMemo(() => crops.filter(c => c.status === 'Active').length, [crops]);
  const inactiveCrops = useMemo(() => crops.filter(c => c.status === 'Inactive').length, [crops]);

  // Filtered and paginated records
  const filteredCrops = useMemo(() => {
    return crops.filter(crop => {
      const matchesSearch =
        crop.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        crop.id.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        crop.category.toLowerCase().includes(searchQuery.trim().toLowerCase());

      const matchesStatus =
        statusFilter === 'All' ? true : crop.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [crops, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCrops.length / pageSize));

  // Ensure current page stays in bounds
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedCrops = filteredCrops.slice(startIndex, startIndex + pageSize);

  // Switch to Add mode
  const handleOpenAdd = () => {
    setPanelMode('add');
    setSelectedCropId(null);
    setFormName('');
    setFormCategory('');
    setFormDescription('');
    setFormStatus('Active');
    setFormError(null);
  };

  // Switch to Edit mode
  const handleOpenEdit = (crop: CropItem) => {
    setPanelMode('edit');
    setSelectedCropId(crop.id);
    setFormName(crop.name);
    setFormCategory(crop.category);
    setFormDescription(crop.description);
    setFormStatus(crop.status);
    setFormError(null);
  };

  // Switch to View mode
  const handleOpenView = (crop: CropItem) => {
    setPanelMode('view');
    setSelectedCropId(crop.id);
    setFormName(crop.name);
    setFormCategory(crop.category);
    setFormDescription(crop.description);
    setFormStatus(crop.status);
    setFormError(null);
  };

  // Close or reset panel
  const handleClosePanel = () => {
    handleOpenAdd();
  };

  // Form submit handler
  const handleSaveCrop = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      setFormError('Crop name is required.');
      return;
    }

    if (!formCategory) {
      setFormError('Please select a valid category.');
      return;
    }

    setFormError(null);

    if (panelMode === 'edit' && selectedCropId) {
      // Update existing crop
      setCrops(prev =>
        prev.map(item => {
          if (item.id === selectedCropId) {
            return {
              ...item,
              name: formName.trim(),
              category: formCategory as CropItem['category'],
              description: formDescription.trim() || 'Agricultural commodity registered in YieldMatrix.',
              status: formStatus
            };
          }
          return item;
        })
      );
      setToastMessage(`Crop "${formName.trim()}" updated successfully!`);
      handleOpenAdd();
    } else {
      // Add new crop with incremented CR ID
      const nextIdNum = crops.length + 1;
      const newId = `CR${String(nextIdNum).padStart(3, '0')}`;
      const newCrop: CropItem = {
        id: newId,
        name: formName.trim(),
        category: formCategory as CropItem['category'],
        status: formStatus,
        createdDate: '20 Nov 2026',
        description: formDescription.trim() || 'Agricultural commodity registered in YieldMatrix.'
      };

      setCrops(prev => [newCrop, ...prev]);
      setToastMessage(`Crop "${newCrop.name}" (${newCrop.id}) added successfully!`);
      handleOpenAdd();
    }
  };

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
            setToastMessage(`Filtering all ${totalCrops} registered crops.`);
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
              <strong className="ym04-stat-value">{totalCrops}</strong>
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
            setToastMessage(`Filtering ${activeCrops} active crops.`);
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
              <strong className="ym04-stat-value">{activeCrops}</strong>
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
            setToastMessage(`Filtering ${inactiveCrops} inactive crops.`);
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
              <strong className="ym04-stat-value">{inactiveCrops}</strong>
              <span className="ym04-stat-subtext">Not available</span>
            </div>
          </div>
          <div className="ym04-stat-arrow" aria-hidden="true">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Card 4: Healthy Fields, Better Tomorrow Banner Card */}
        <div className="ym04-banner-card" aria-label="YieldMatrix vision banner">
          <div className="ym04-banner-content">
            <p className="ym04-banner-heading">Healthy Fields, Better</p>
            <p className="ym04-banner-subheading">Tomorrow</p>
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
      {/* Main 2-Column Split Section (Crop List + Side Panel)               */}
      {/* ------------------------------------------------------------------ */}
      <div className="ym04-split-layout">
        {/* Left Column: Crop List Card */}
        <section className="ym04-section-card ym04-crop-list-card" aria-labelledby="heading-crop-list">
          {/* Header */}
          <div className="ym04-section-header">
            <div className="ym04-section-title-wrap">
              <Sprout className="ym04-section-icon" size={22} aria-hidden="true" />
              <h2 id="heading-crop-list" className="ym04-section-title">Crop List</h2>
            </div>
            <button
              type="button"
              className="ym04-btn-add"
              onClick={handleOpenAdd}
              aria-label="Add new crop"
            >
              <Plus size={16} aria-hidden="true" />
              <span>Add Crop</span>
            </button>
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
            <table className="ym04-table" aria-label="Crop List Table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '15%' }}>Crop ID</th>
                  <th scope="col" style={{ width: '22%' }}>Crop Name</th>
                  <th scope="col" style={{ width: '18%' }}>Category</th>
                  <th scope="col" style={{ width: '18%' }}>Status</th>
                  <th scope="col" style={{ width: '17%' }}>Created Date</th>
                  <th scope="col" style={{ width: '10%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCrops.length > 0 ? (
                  paginatedCrops.map((crop) => (
                    <tr
                      key={crop.id}
                      className={selectedCropId === crop.id ? 'ym04-row--selected' : ''}
                    >
                      <td className="ym04-cell-crop-id">{crop.id}</td>
                      <td className="ym04-cell-crop-name-bold">{crop.name}</td>
                      <td>
                        <span className="ym04-badge-category">{crop.category}</span>
                      </td>
                      <td>
                        <span
                          className={`ym04-badge-status ${
                            crop.status === 'Active'
                              ? 'ym04-badge-status--active'
                              : 'ym04-badge-status--inactive'
                          }`}
                        >
                          <span className="ym04-status-dot" aria-hidden="true" />
                          <span>{crop.status}</span>
                        </span>
                      </td>
                      <td className="ym04-cell-date">{crop.createdDate}</td>
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
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="ym04-table-empty">
                        <p className="ym04-empty-title">No crops found</p>
                        <p className="ym04-empty-desc">
                          {searchQuery || statusFilter !== 'All'
                            ? 'No crops match your active filter criteria. Try clearing search or status filters.'
                            : 'No crop records available.'}
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
              {filteredCrops.length > 0
                ? `Showing ${startIndex + 1}–${Math.min(
                    startIndex + pageSize,
                    filteredCrops.length
                  )} of ${filteredCrops.length} crops`
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
          {/* Header */}
          <div className="ym04-side-panel-header">
            <div className="ym04-section-title-wrap">
              <Sprout className="ym04-section-icon" size={20} aria-hidden="true" />
              <h2 id="heading-side-panel" className="ym04-side-panel-title">
                {panelMode === 'view'
                  ? `Crop Details`
                  : panelMode === 'edit'
                  ? `Add / Edit Crop`
                  : `Add / Edit Crop`}
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
                  <span className="ym04-detail-label">Crop ID</span>
                  <span className="ym04-detail-value">{selectedCropId}</span>
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
                <div className="ym04-detail-item">
                  <span className="ym04-detail-label">Crop Name</span>
                  <span className="ym04-detail-value">{formName}</span>
                </div>
                <div className="ym04-detail-item">
                  <span className="ym04-detail-label">Category</span>
                  <span className="ym04-badge-category">{formCategory}</span>
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
                  Edit This Crop
                </button>
              </div>
            </div>
          ) : (
            /* Add / Edit Form */
            <form className="ym04-crop-form" onSubmit={handleSaveCrop}>
              {/* Field 1: Crop Name */}
              <div className="ym04-form-group">
                <label htmlFor="crop-name-input" className="ym04-form-label">
                  Crop Name <span className="ym04-required-star">*</span>
                </label>
                <input
                  id="crop-name-input"
                  type="text"
                  className="ym04-form-input"
                  placeholder="Enter crop name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              {/* Field 2: Category */}
              <div className="ym04-form-group">
                <label htmlFor="crop-category-select" className="ym04-form-label">
                  Category <span className="ym04-required-star">*</span>
                </label>
                <div className="ym04-form-select-wrap">
                  <select
                    id="crop-category-select"
                    className="ym04-form-select"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as CropItem['category'])}
                    required
                  >
                    <option value="" disabled>Select category</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Field 3: Description */}
              <div className="ym04-form-group">
                <label htmlFor="crop-desc-textarea" className="ym04-form-label">
                  Description
                </label>
                <textarea
                  id="crop-desc-textarea"
                  className="ym04-form-textarea"
                  placeholder="Enter description..."
                  rows={4}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              {/* Field 4: Status Radio Buttons */}
              <div className="ym04-form-group">
                <span className="ym04-form-label">Status</span>
                <div className="ym04-radio-group">
                  <label className="ym04-radio-item">
                    <input
                      type="radio"
                      name="crop-status"
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
                      name="crop-status"
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
                  Save Crop
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
            <p className="ym04-quick-actions-subtitle">Access crop management features quickly.</p>
          </div>
        </div>

        <div className="ym04-quick-actions-btns">
          {/* Action 1: Manage Crops (Active on this page) */}
          <button
            type="button"
            className="ym04-qa-btn ym04-qa-btn--green"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setToastMessage('Already viewing Crop Management. Filter or edit crops above.');
            }}
          >
            <Sprout size={16} aria-hidden="true" />
            <span>Manage Crops</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>

          {/* Action 2: View Market Insights */}
          <button
            type="button"
            className="ym04-qa-btn ym04-qa-btn--white"
            onClick={() => {
              setToastMessage('Navigating to Market Insights...');
              navigate('/admin/market-data');
            }}
          >
            <BarChart2 size={16} aria-hidden="true" />
            <span>View Market Insights</span>
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
            <ShieldCheck size={16} aria-hidden="true" />
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
