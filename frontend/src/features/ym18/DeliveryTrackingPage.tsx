import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  MapPin,
  Clock,
  Phone,
  ShieldCheck,
  Thermometer,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Headphones,
  RotateCcw,
  Building,
  ChevronRight,
  Info,
  X,
  Send,
  Navigation,
  Compass,
  FileText
} from 'lucide-react';
import api from '../../services/api';
import type {
  DeliveryTrackingApiResponse,
  DeliveryCheckpoint,
  OrderDisplayStatus
} from './types';

export const DeliveryTrackingPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<DeliveryTrackingApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);

  // Interactive UI states
  const [activeCheckpointId, setActiveCheckpointId] = useState<string | null>(null);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);
  const [supportCategory, setSupportCategory] = useState<string>('delay');
  const [supportMessage, setSupportMessage] = useState<string>('');
  const [supportSubmitted, setSupportSubmitted] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const fetchDeliveryData = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const response = await api.get<DeliveryTrackingApiResponse>(`/ym18/orders/${orderId}/delivery`);
      if (response.data?.order && response.data?.tracking) {
        setData(response.data);
        // Default active checkpoint to current or last completed
        const currentCp = response.data.routeCheckpoints.find(cp => cp.status === 'current') 
          || response.data.routeCheckpoints[response.data.routeCheckpoints.length - 1];
        if (currentCp) {
          setActiveCheckpointId(currentCp.id);
        }
      } else {
        setNotFound(true);
      }
    } catch (err: any) {
      console.error('Failed to load delivery tracking:', err);
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(err.response?.data?.error || 'Unable to retrieve delivery tracking telemetry.');
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchDeliveryData();
  }, [fetchDeliveryData]);

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSupportSubmitted(true);
    setTimeout(() => {
      setSupportSubmitted(false);
      setIsSupportModalOpen(false);
      setSupportMessage('');
    }, 2000);
  };

  const getStatusBadgeClass = (status: OrderDisplayStatus) => {
    switch (status) {
      case 'Pending':
        return 'bg-[#FFF0E3] text-[#854500] border border-[#E7A06C]/40';
      case 'Processing':
        return 'bg-[#EEF2ED] text-[#315A42] border border-[#315A42]/30';
      case 'In Transit':
        return 'bg-[#FFF0E3] text-[#854500] border border-[#E7A06C]/40';
      case 'Delivered':
        return 'bg-[#EAF2E8] text-[#315A42] border border-[#315A42]/20';
      case 'Canceled':
        return 'bg-[#FCEBEA] text-[#A51C19] border border-[#A51C19]/20';
      default:
        return 'bg-[#EAF2E8] text-[#315A42] border border-[#315A42]/20';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-[1100px] mx-auto pb-12 font-sans bg-[#F6F7F3]">
        <div className="h-6 w-40 bg-[#EEF2ED] rounded-md animate-pulse" />
        <div className="h-28 bg-white border border-[#E0E7E1] rounded-[8px] animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-[480px] bg-white border border-[#E0E7E1] rounded-[8px] animate-pulse" />
          <div className="h-[480px] bg-white border border-[#E0E7E1] rounded-[8px] animate-pulse" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-[700px] mx-auto py-12 px-4 text-center font-sans">
        <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-10 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#FFF0E3] text-[#854500] mx-auto flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-semibold text-[#263A31]">Order Delivery Not Found</h2>
          <p className="text-xs text-[#78877D] max-w-md mx-auto">
            The requested delivery tracking could not be located or does not belong to your account.
          </p>
          <div className="pt-2">
            <Link
              to="/buyer/orders"
              className="inline-flex items-center gap-2 h-[36px] px-4 bg-[#315A42] hover:bg-[#264834] text-white rounded-[8px] text-[13px] font-semibold transition-colors"
            >
              <ArrowLeft size={15} />
              Back to My Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-[700px] mx-auto py-12 px-4 text-center font-sans">
        <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-10 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#FCEBEA] text-[#A51C19] mx-auto flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-semibold text-[#263A31]">Unable to Load Delivery Tracking</h2>
          <p className="text-xs text-[#78877D] max-w-md mx-auto">
            {error || 'An unexpected error occurred while communicating with the logistics telemetry service.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={fetchDeliveryData}
              className="inline-flex items-center gap-2 h-[36px] px-4 bg-[#315A42] hover:bg-[#264834] text-white rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw size={15} />
              Try Again
            </button>
            <Link
              to="/buyer/orders"
              className="inline-flex items-center gap-2 h-[36px] px-4 bg-white border border-[#E0E7E1] text-[#263A31] hover:bg-[#EEF2ED] rounded-[8px] text-[13px] font-medium transition-colors"
            >
              Back to Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { order, tracking, pickup, destination, carrier, routeCheckpoints, hasLocationData, supportContact } = data;
  const isDelivered = tracking.deliveryStatus === 'delivered';
  const isInTransit = tracking.deliveryStatus === 'in_transit';

  // SVG Map Coordinate Projection: Nuwara Eliya -> Colombo Corridor
  // Nuwara Eliya: (x: 480, y: 110) [Highlands East]
  // Hatton: (x: 390, y: 170)
  // Avissawella: (x: 270, y: 235)
  // Kadawatha: (x: 180, y: 280)
  // Colombo Destination: (x: 120, y: 320) [Coast West]
  const svgCheckpoints = [
    { ...routeCheckpoints[0], cx: 480, cy: 110, label: 'Nuwara Eliya (Farm Origin)' },
    { ...routeCheckpoints[1], cx: 390, cy: 170, label: 'Hatton Junction' },
    { ...routeCheckpoints[2], cx: 270, cy: 235, label: 'Avissawella Checkpoint' },
    { ...routeCheckpoints[3], cx: 180, cy: 280, label: 'Kadawatha Interchange' },
    { ...routeCheckpoints[4], cx: 120, cy: 320, label: 'Colombo (Destination Hub)' },
  ];

  // Current live vehicle position on the route SVG
  let carrierPos = { x: 480, y: 110 };
  if (isDelivered) {
    carrierPos = { x: 120, y: 320 };
  } else if (isInTransit) {
    carrierPos = { x: 180, y: 280 }; // Near Kadawatha
  } else if (tracking.deliveryStatus === 'processing') {
    carrierPos = { x: 480, y: 110 }; // At farm
  }

  return (
    <div className="space-y-5 max-w-[1100px] mx-auto pb-12 font-sans bg-[#F6F7F3] text-[#263A31]">
      {/* 1. Breadcrumbs and Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 text-xs text-[#78877D]">
          <Link to="/buyer/orders" className="hover:text-[#315A42] hover:underline transition-colors">
            My Orders
          </Link>
          <ChevronRight size={13} className="text-[#78877D]" />
          <Link to={`/buyer/orders/${order.id}`} className="hover:text-[#315A42] hover:underline transition-colors font-medium text-[#315A42]">
            {order.orderCode}
          </Link>
          <ChevronRight size={13} className="text-[#78877D]" />
          <span className="text-[#263A31] font-semibold">Delivery Tracking</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/buyer/orders/${order.id}`}
            className="inline-flex items-center gap-1.5 h-[36px] px-3 bg-white border border-[#E0E7E1] hover:bg-[#EEF2ED] text-[#315A42] rounded-[8px] text-[13px] font-semibold transition-colors shadow-2xs"
          >
            <ArrowLeft size={14} />
            Order Details
          </Link>
          <Link
            to={`/buyer/orders/${order.id}/timeline`}
            className="inline-flex items-center gap-1.5 h-[36px] px-3 bg-white border border-[#E0E7E1] hover:bg-[#EEF2ED] text-[#315A42] rounded-[8px] text-[13px] font-semibold transition-colors shadow-2xs"
          >
            <Clock size={14} />
            View Timeline
          </Link>
          <button
            onClick={() => setIsSupportModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-[36px] px-3 bg-[#EEF2ED] hover:bg-[#E2EAE0] text-[#315A42] border border-[#315A42]/30 rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer shadow-2xs"
          >
            <Headphones size={14} />
            Contact Support
          </button>
        </div>
      </div>

      {/* 2. Top Summary Banner */}
      <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E0E7E1]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-[#EEF2ED] text-[#315A42] flex items-center justify-center shrink-0 mt-0.5">
              <Truck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-bold text-[#315A42] tracking-tight">{order.orderCode}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStatusBadgeClass(order.displayStatus)}`}>
                  {order.displayStatus}
                </span>
                {isInTransit && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E7A06C]/20 text-[#854500] border border-[#E7A06C]/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E7A06C] animate-ping" />
                    Live En Route
                  </span>
                )}
              </div>
              <p className="text-xs text-[#78877D] mt-0.5">
                Consignment: <span className="font-semibold text-[#263A31]">{order.productName}</span> • Quantity: <span className="font-semibold text-[#263A31]">{order.quantityKg} Kg</span> • Total: <span className="font-semibold text-[#315A42]">{order.formattedTotalPrice}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-[#F6F7F3] border border-[#E0E7E1] px-4 py-2.5 rounded-[8px] shrink-0">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[#78877D]">Estimated Arrival</div>
              <div className="text-xs font-bold text-[#315A42] flex items-center gap-1.5 mt-0.5">
                <Clock size={13} className="text-[#E7A06C]" />
                {tracking.estimatedArrival || 'Scheduled Delivery'}
              </div>
            </div>
            <div className="h-7 w-[1px] bg-[#E0E7E1]" />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[#78877D]">Distance Status</div>
              <div className="text-xs font-bold text-[#263A31] mt-0.5">
                {isDelivered ? '0.0 km (Delivered)' : (tracking.distanceRemainingKm ? `${tracking.distanceRemainingKm} km remaining` : 'Pending Dispatch')}
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar Strip */}
        <div className="pt-4">
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-[#78877D] flex items-center gap-1.5">
              <Navigation size={13} className="text-[#315A42]" />
              Route Delivery Progress
            </span>
            <span className="text-[#315A42] font-bold">{tracking.progressPercentage}%</span>
          </div>
          <div className="w-full bg-[#EEF2ED] rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${
                isDelivered ? 'bg-[#315A42]' : 'bg-gradient-to-r from-[#315A42] to-[#E7A06C]'
              }`}
              style={{ width: `${tracking.progressPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#78877D] mt-1.5">
            <span>Pickup: {pickup.district}</span>
            <span className="font-medium text-[#263A31]">
              {isInTransit ? 'A1 Highway Kadawatha' : (isDelivered ? 'Delivered' : 'Farm Dispatch')}
            </span>
            <span>Destination: {destination.district}</span>
          </div>
        </div>
      </div>

      {/* Simulation Transparency Alert */}
      {tracking.isSimulatedGPS && (
        <div className="bg-[#FFF0E3]/70 border border-[#E7A06C]/40 rounded-[8px] px-4 py-2.5 flex items-center gap-2.5 text-xs text-[#854500]">
          <Info size={15} className="text-[#E7A06C] shrink-0" />
          <p className="leading-relaxed">
            <strong className="font-semibold">Simulated Tracking Demonstration:</strong> Carrier GPS coordinates and waypoint telemetry are calculated along the Nuwara Eliya — Colombo freight corridor. Live IoT telematics connect via YieldMatrix Fleet Gateway.
          </p>
        </div>
      )}

      {/* 3. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Map & Checkpoints (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Map Card */}
          <div className="bg-white border border-[#E0E7E1] rounded-[8px] overflow-hidden shadow-xs">
            {/* Map Header */}
            <div className="bg-[#EEF2ED] px-4 py-3 border-b border-[#E0E7E1] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-[#315A42]" />
                <h2 className="text-xs font-bold text-[#315A42] uppercase tracking-wider">
                  Live Logistics Route Map
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <a
                  href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${pickup.latitude},${pickup.longitude};${destination.latitude},${destination.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#315A42] hover:underline"
                >
                  <ExternalLink size={12} />
                  OpenStreetMap
                </a>
              </div>
            </div>

            {/* Map Canvas or Unavailable State */}
            {hasLocationData ? (
              <div className="relative bg-[#F6F7F3] p-4 overflow-hidden border-b border-[#E0E7E1]">
                {/* SVG Visual Interactive Map */}
                <div className="relative w-full aspect-[16/10] max-h-[380px] rounded-[6px] bg-[#EEF2ED]/60 border border-[#E0E7E1] overflow-hidden flex items-center justify-center">
                  <svg
                    viewBox="0 0 600 400"
                    className="w-full h-full select-none"
                    style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.3s ease' }}
                  >
                    <defs>
                      {/* Grid Pattern */}
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E0E7E1" strokeWidth="0.8" opacity="0.6" />
                      </pattern>

                      {/* Route Gradients */}
                      <linearGradient id="routeGradient" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#315A42" />
                        <stop offset="70%" stopColor="#315A42" />
                        <stop offset="100%" stopColor="#E7A06C" />
                      </linearGradient>

                      {/* Drop Shadow Filter */}
                      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#263A31" floodOpacity="0.25" />
                      </filter>
                    </defs>

                    {/* Regional Map Background Grid */}
                    <rect width="600" height="400" fill="#F6F7F3" />
                    <rect width="600" height="400" fill="url(#grid)" />

                    {/* Sri Lanka Central/Western Contour Outline (Stylized) */}
                    <path
                      d="M 50,380 C 70,300 80,180 140,80 C 220,50 360,40 520,70 C 560,110 570,250 540,350 C 460,390 200,410 50,380 Z"
                      fill="#FFFFFF"
                      stroke="#E0E7E1"
                      strokeWidth="1.5"
                    />

                    {/* Regional Land Mass Contours */}
                    <path
                      d="M 320,60 C 430,70 510,130 500,220 C 460,260 360,240 320,180 Z"
                      fill="#EEF2ED"
                      opacity="0.8"
                    />

                    {/* Route Line (Arterial Freight Highway Nuwara Eliya -> Colombo) */}
                    {/* Nuwara Eliya (480, 110) -> Hatton (390, 170) -> Avissawella (270, 235) -> Kadawatha (180, 280) -> Colombo (120, 320) */}
                    <path
                      d="M 480 110 Q 430 140 390 170 T 270 235 T 180 280 T 120 320"
                      fill="none"
                      stroke="#315A42"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Completed route pulse overlay */}
                    <path
                      d="M 480 110 Q 430 140 390 170 T 270 235 T 180 280"
                      fill="none"
                      stroke="#E7A06C"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                      strokeLinecap="round"
                    />

                    {/* Waypoint Checkpoint Markers */}
                    {svgCheckpoints.map((cp) => {
                      const isActive = activeCheckpointId === cp.id;
                      const isComplete = cp.status === 'completed';
                      const isCurr = cp.status === 'current';

                      return (
                        <g
                          key={cp.id}
                          className="cursor-pointer transition-transform"
                          onClick={() => setActiveCheckpointId(cp.id)}
                        >
                          {/* Outer halo */}
                          <circle
                            cx={cp.cx}
                            cy={cp.cy}
                            r={isActive ? 14 : 10}
                            fill={isComplete ? '#315A42' : (isCurr ? '#E7A06C' : '#FFFFFF')}
                            fillOpacity={isActive ? 0.35 : 0.2}
                          />
                          {/* Inner pin */}
                          <circle
                            cx={cp.cx}
                            cy={cp.cy}
                            r={isActive ? 7 : 5}
                            fill={isComplete ? '#315A42' : (isCurr ? '#E7A06C' : '#78877D')}
                            stroke="#FFFFFF"
                            strokeWidth="2"
                            filter="url(#shadow)"
                          />
                          {/* Step Number / Label */}
                          <text
                            x={cp.cx}
                            y={cp.cy - 12}
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="bold"
                            fill="#263A31"
                          >
                            {cp.step}. {cp.name}
                          </text>
                        </g>
                      );
                    })}

                    {/* Moving Carrier Vehicle Icon & Radar Ping */}
                    <g transform={`translate(${carrierPos.x}, ${carrierPos.y})`} filter="url(#shadow)">
                      {/* Pulse Circle */}
                      <circle r="18" fill="#E7A06C" fillOpacity="0.25">
                        <animate attributeName="r" values="10;26;10" dur="2.2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0;0.8" dur="2.2s" repeatCount="indefinite" />
                      </circle>
                      {/* Vehicle Badge */}
                      <circle r="12" fill="#315A42" stroke="#FFFFFF" strokeWidth="2" />
                      <path
                        d="M -5 -3 L 1 -3 L 3 -1 L 5 -1 L 5 3 L -5 3 Z"
                        fill="#FFFFFF"
                      />
                      <circle cx="-2" cy="3" r="1.5" fill="#315A42" stroke="#FFFFFF" strokeWidth="0.8" />
                      <circle cx="3" cy="3" r="1.5" fill="#315A42" stroke="#FFFFFF" strokeWidth="0.8" />
                    </g>
                  </svg>

                  {/* On-Map Floating Controls */}
                  <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs border border-[#E0E7E1] rounded-[6px] p-2 text-[11px] shadow-xs flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#315A42]" />
                      <span className="text-[#263A31] font-medium">Pickup (Nuwara Eliya)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E7A06C]" />
                      <span className="text-[#263A31] font-medium">Current Fleet Position</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#315A42] border border-white" />
                      <span className="text-[#263A31] font-medium">Destination (Colombo)</span>
                    </div>
                  </div>

                  {/* Zoom controls */}
                  <div className="absolute top-3 right-3 flex flex-col gap-1 bg-white border border-[#E0E7E1] rounded-[6px] shadow-xs p-1">
                    <button
                      onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 1.8))}
                      className="w-6 h-6 flex items-center justify-center text-xs font-bold text-[#315A42] hover:bg-[#EEF2ED] rounded cursor-pointer"
                      title="Zoom In"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.8))}
                      className="w-6 h-6 flex items-center justify-center text-xs font-bold text-[#315A42] hover:bg-[#EEF2ED] rounded cursor-pointer"
                      title="Zoom Out"
                    >
                      -
                    </button>
                    <button
                      onClick={() => setZoomLevel(1)}
                      className="w-6 h-6 flex items-center justify-center text-[10px] text-[#78877D] hover:bg-[#EEF2ED] rounded cursor-pointer"
                      title="Reset Map"
                    >
                      <RotateCcw size={11} />
                    </button>
                  </div>
                </div>

                {/* Selected Checkpoint Card */}
                {activeCheckpointId && (
                  <div className="mt-3 bg-white border border-[#E0E7E1] rounded-[6px] p-3 shadow-2xs">
                    {(() => {
                      const cp = routeCheckpoints.find(c => c.id === activeCheckpointId);
                      if (!cp) return null;
                      return (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#EEF2ED] text-[#315A42] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                              {cp.step}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#263A31]">{cp.name}</span>
                                <span
                                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                                    cp.status === 'completed'
                                      ? 'bg-[#EAF2E8] text-[#315A42]'
                                      : cp.status === 'current'
                                      ? 'bg-[#FFF0E3] text-[#854500]'
                                      : 'bg-gray-100 text-[#78877D]'
                                  }`}
                                >
                                  {cp.status.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#78877D] mt-0.5">{cp.location}</p>
                              <p className="text-[11px] text-[#263A31] mt-1 font-medium">{cp.description}</p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right shrink-0">
                            <div className="text-[10px] text-[#78877D]">Logged Time</div>
                            <div className="text-xs font-bold text-[#315A42]">{cp.timestamp || 'Pending'}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              /* Unavailable Location State */
              <div className="p-8 text-center bg-[#F6F7F3] border-b border-[#E0E7E1] space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#FFF0E3] text-[#854500] mx-auto flex items-center justify-center">
                  <Compass size={24} />
                </div>
                <h3 className="text-sm font-bold text-[#263A31]">Live GPS Tracking Unavailable</h3>
                <p className="text-xs text-[#78877D] max-w-md mx-auto leading-relaxed">
                  Real-time carrier coordinates are not active for this order. Tracking becomes available once the consignment is dispatched from farm collection.
                </p>
                <div className="pt-2">
                  <Link
                    to={`/buyer/orders/${order.id}`}
                    className="inline-flex items-center gap-1.5 h-[36px] px-4 bg-white border border-[#E0E7E1] hover:bg-[#EEF2ED] text-[#315A42] rounded-[8px] text-[13px] font-semibold transition-colors"
                  >
                    <ArrowLeft size={14} />
                    View Order Details
                  </Link>
                </div>
              </div>
            )}

            {/* Checkpoints Timeline Table/List */}
            <div className="p-4 bg-white">
              <h3 className="text-xs font-bold text-[#315A42] uppercase tracking-wider mb-3">
                Highway Checkpoints & Logistics Waypoints
              </h3>
              <div className="space-y-3">
                {routeCheckpoints.map((cp, idx) => {
                  const isComplete = cp.status === 'completed';
                  const isCurrent = cp.status === 'current';
                  const isLast = idx === routeCheckpoints.length - 1;

                  return (
                    <div
                      key={cp.id}
                      onClick={() => setActiveCheckpointId(cp.id)}
                      className={`flex items-start gap-3 p-2.5 rounded-[6px] border transition-colors cursor-pointer ${
                        activeCheckpointId === cp.id
                          ? 'border-[#315A42] bg-[#EEF2ED]/40'
                          : 'border-[#E0E7E1] hover:bg-[#F6F7F3]'
                      }`}
                    >
                      {/* Step Indicator */}
                      <div className="flex flex-col items-center shrink-0">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                            isComplete
                              ? 'bg-[#315A42] text-white'
                              : isCurrent
                              ? 'bg-[#E7A06C] text-white ring-2 ring-[#E7A06C]/40'
                              : 'bg-white border border-[#E0E7E1] text-[#78877D]'
                          }`}
                        >
                          {isComplete ? <CheckCircle2 size={13} /> : cp.step}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-[#263A31]">{cp.name}</span>
                          <span className="text-[11px] font-bold text-[#315A42]">{cp.timestamp || 'Pending'}</span>
                        </div>
                        <div className="text-[11px] text-[#78877D] mt-0.5">{cp.location}</div>
                        <div className="text-[11px] text-[#263A31] mt-0.5">{cp.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Driver, Destination, Support (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* 1. Driver & Vehicle Card */}
          <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0E7E1]">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-[#315A42]" />
                <h3 className="text-xs font-bold text-[#315A42] uppercase tracking-wider">
                  Driver & Vehicle Fleet
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-[#315A42] bg-[#EEF2ED] px-2 py-0.5 rounded">
                Verified Carrier
              </span>
            </div>

            {carrier ? (
              <div className="pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#315A42] text-white flex items-center justify-center font-bold text-sm">
                      {carrier.driverName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#263A31]">{carrier.driverName}</div>
                      <div className="text-[11px] text-[#78877D]">{carrier.company}</div>
                    </div>
                  </div>
                  <a
                    href={`tel:${carrier.driverPhone}`}
                    className="inline-flex items-center gap-1.5 h-[36px] px-3 bg-[#315A42] hover:bg-[#264834] text-white rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer"
                  >
                    <Phone size={13} />
                    Call Driver
                  </a>
                </div>

                <div className="bg-[#F6F7F3] rounded-[6px] p-3 border border-[#E0E7E1] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#78877D]">Vehicle Registration:</span>
                    <span className="font-bold text-[#263A31] font-mono">{carrier.vehicleNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#78877D]">Vehicle Type:</span>
                    <span className="font-semibold text-[#263A31]">{carrier.vehicleType}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#78877D]">Compartment Condition:</span>
                    <span className="font-bold text-[#315A42] flex items-center gap-1">
                      <Thermometer size={13} className="text-[#E7A06C]" />
                      {carrier.cargoCondition || 'Chilled • 12°C Nominal'}
                    </span>
                  </div>
                </div>

                {carrier.isSimulated && (
                  <div className="text-[10px] text-[#78877D] italic flex items-center gap-1">
                    <Info size={11} className="text-[#E7A06C]" />
                    Carrier contact and vehicle telemetry simulated for testing.
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[#78877D]">
                <Truck size={24} className="mx-auto text-[#78877D]/60 mb-2" />
                <p>No carrier partner assigned yet.</p>
                <p className="text-[11px] mt-0.5">Carrier assignment completes upon farm packing confirmation.</p>
              </div>
            )}
          </div>

          {/* 2. Delivery Address Card */}
          <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-4 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E0E7E1]">
              <Building size={16} className="text-[#315A42]" />
              <h3 className="text-xs font-bold text-[#315A42] uppercase tracking-wider">
                Buyer Delivery Destination
              </h3>
            </div>
            <div className="pt-3 space-y-2 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#78877D] tracking-wider">Recipient Name</span>
                <p className="font-bold text-[#263A31] mt-0.5">{destination.recipientName || 'Verified Buyer Partner'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#78877D] tracking-wider">Delivery Address</span>
                <p className="font-semibold text-[#263A31] mt-0.5 leading-relaxed">{destination.address}</p>
                <p className="text-[11px] text-[#78877D]">{destination.district}, Sri Lanka</p>
              </div>
              <div className="bg-[#EEF2ED] rounded-[6px] p-2.5 border border-[#E0E7E1]">
                <span className="text-[10px] font-bold text-[#315A42] uppercase tracking-wider">Drop-off Instructions</span>
                <p className="text-[11px] text-[#263A31] mt-0.5 leading-relaxed">
                  {destination.specialInstructions || 'Unload at Warehouse Bay 3. Inspect produce temperature seal before signing digital acceptance note.'}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Farm Collection Origin Card */}
          <div className="bg-white border border-[#E0E7E1] rounded-[8px] p-4 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E0E7E1]">
              <MapPin size={16} className="text-[#315A42]" />
              <h3 className="text-xs font-bold text-[#315A42] uppercase tracking-wider">
                Farm Collection Point
              </h3>
            </div>
            <div className="pt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#263A31]">{pickup.farmName}</div>
                  <div className="text-[11px] text-[#78877D]">{pickup.address}</div>
                </div>
                <span className="text-[11px] font-semibold text-[#315A42] bg-[#EEF2ED] px-2 py-0.5 rounded">
                  {pickup.district}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#78877D] pt-1 border-t border-[#E0E7E1]">
                <span>Registered Farmer:</span>
                <span className="font-medium text-[#263A31]">{pickup.farmerName}</span>
              </div>
            </div>
          </div>

          {/* 4. Contact Support Action Box */}
          <div className="bg-[#EEF2ED] border border-[#315A42]/20 rounded-[8px] p-4 text-xs space-y-3">
            <div className="flex items-start gap-2.5">
              <Headphones size={18} className="text-[#315A42] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-[#315A42]">Agro-Logistics Help Desk</h4>
                <p className="text-[11px] text-[#78877D] mt-0.5 leading-relaxed">
                  Have inquiries regarding shipment delays, gate clearance or temperature logs?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setIsSupportModalOpen(true)}
                className="flex-1 h-[36px] bg-[#315A42] hover:bg-[#264834] text-white rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Headphones size={14} />
                Contact Support
              </button>
              <a
                href={`tel:${supportContact.phone}`}
                className="h-[36px] px-3 bg-white border border-[#E0E7E1] hover:bg-[#F6F7F3] text-[#315A42] rounded-[8px] text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5"
                title="Call 24/7 Hotline"
              >
                <Phone size={14} />
                Direct Hotline
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Contact Support Modal */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
          <div className="bg-white border border-[#E0E7E1] rounded-[8px] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0E7E1]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EEF2ED] text-[#315A42] flex items-center justify-center">
                  <Headphones size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#263A31]">Contact Logistics Support</h3>
                  <p className="text-[11px] text-[#78877D]">Order: {order.orderCode} • {order.productName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsSupportModalOpen(false)}
                className="text-[#78877D] hover:text-[#263A31] p-1 rounded cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {supportSubmitted ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#EAF2E8] text-[#315A42] mx-auto flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <h4 className="text-sm font-bold text-[#315A42]">Ticket Dispatched to Fleet Command</h4>
                <p className="text-xs text-[#78877D] max-w-xs mx-auto">
                  A logistics coordinator will review your request and contact you shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSupportSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-[#263A31] uppercase tracking-wider mb-1">
                    Issue Category
                  </label>
                  <select
                    value={supportCategory}
                    onChange={(e) => setSupportCategory(e.target.value)}
                    className="w-full h-[36px] px-3 bg-white border border-[#E0E7E1] rounded-[8px] text-xs text-[#263A31] focus:outline-none focus:border-[#315A42]"
                  >
                    <option value="delay">Shipment Delay / ETA Inquiry</option>
                    <option value="address">Update Delivery Drop-off Instructions</option>
                    <option value="driver">Direct Driver Contact Issue</option>
                    <option value="quality">Cargo Climate / Temperature Check</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#263A31] uppercase tracking-wider mb-1">
                    Message or Instructions
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Provide details regarding the delivery or access gate..."
                    className="w-full p-2.5 bg-white border border-[#E0E7E1] rounded-[8px] text-xs text-[#263A31] focus:outline-none focus:border-[#315A42]"
                  />
                </div>

                <div className="bg-[#F6F7F3] p-2.5 rounded-[6px] border border-[#E0E7E1] flex items-center justify-between text-[11px]">
                  <span className="text-[#78877D]">Logistics Hotline:</span>
                  <a href={`tel:${supportContact.phone}`} className="font-bold text-[#315A42] hover:underline">
                    {supportContact.phone}
                  </a>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSupportModalOpen(false)}
                    className="h-[36px] px-3 bg-white border border-[#E0E7E1] text-[#263A31] hover:bg-[#EEF2ED] rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 h-[36px] px-4 bg-[#315A42] hover:bg-[#264834] text-white rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer"
                  >
                    <Send size={13} />
                    Send Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
