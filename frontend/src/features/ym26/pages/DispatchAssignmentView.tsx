import { useState, useEffect, useMemo } from "react";
import {
  Truck,
  Users,
  Package,
  TriangleAlert,
  RotateCw,
  Plus,
  Eye,
  Search,
  ChevronRight,
  X,
  Navigation,
  AlertCircle,
  Crosshair,
} from "lucide-react";
import {
  fetchDispatchStats,
  fetchDispatchQueue,
  fetchActiveTrips,
  fetchDriversAndVehicles,
  assignDispatchApi,
  type DispatchItem,
  type DispatchStatsData,
  type ActiveTripItem,
  type DriverVehicleItem,
} from "../services/adminApi";
import {
  initialDispatchQueue,
  initialActiveTrips,
  availableDriversAndVehicles,
} from "../seedData";
import { Toast } from "../../../components/Toast";

export function DispatchAssignmentView() {
  const [stats, setStats] = useState<DispatchStatsData | null>(null);
  const [queue, setQueue] = useState<DispatchItem[]>(initialDispatchQueue);
  const [activeTrips, setActiveTrips] =
    useState<ActiveTripItem[]>(initialActiveTrips);
  const [drivers, setDrivers] = useState<DriverVehicleItem[]>(
    availableDriversAndVehicles,
  );
  const [selectedOrder, setSelectedOrder] = useState<DispatchItem>(
    initialDispatchQueue[0],
  );
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "all" | "awaiting_assignment" | "assigned" | "exceptions"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pickupAreaFilter, setPickupAreaFilter] = useState("all");
  const [deliveryDateFilter, setDeliveryDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [lastRefreshed, setLastRefreshed] = useState("14:32");
  const [toastMessage, setToastMessage] = useState("");

  // Modals
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [allTripsModalOpen, setAllTripsModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [routeNotes, setRouteNotes] = useState("");
  const [assignError, setAssignError] = useState("");

  // Sync breadcrumb & hide default layout page-heading
  useEffect(() => {
    const heading = document.querySelector(".page-heading");
    if (heading) {
      (heading as HTMLElement).style.display = "none";
    }
    const breadcrumb = document.querySelector(".workspace-breadcrumb");
    let prevHtml = "";
    if (breadcrumb) {
      prevHtml = breadcrumb.innerHTML;
      breadcrumb.innerHTML =
        '<span class="text-[#596c60]">Admin</span> <span class="mx-1 text-[#8b9e91]">/</span> <strong class="text-[#263A31] font-semibold">Dispatch</strong>';
    }
    return () => {
      if (heading) {
        (heading as HTMLElement).style.display = "";
      }
      if (breadcrumb && prevHtml) {
        breadcrumb.innerHTML = prevHtml;
      }
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const statsData = await fetchDispatchStats();
      if (statsData) setStats(statsData);
      const queueData = await fetchDispatchQueue({
        status: activeTab,
        search: searchQuery,
      });
      if (queueData && queueData.length > 0) {
        setQueue(queueData);
        if (
          !selectedOrder ||
          !queueData.find(
            (q: DispatchItem) => q.orderId === selectedOrder.orderId,
          )
        ) {
          setSelectedOrder(queueData[0]);
        }
      }
      const tripsData = await fetchActiveTrips();
      if (tripsData && tripsData.length > 0) {
        setActiveTrips(tripsData);
      }
      const driversData = await fetchDriversAndVehicles();
      if (driversData && driversData.length > 0) {
        setDrivers(driversData);
      }
      const now = new Date();
      setLastRefreshed(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      );
    } catch {
      // Keep state resilient with seedData
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeTab,
    searchQuery,
    productFilter,
    statusFilter,
    pickupAreaFilter,
    deliveryDateFilter,
  ]);

  // Master filtered queue
  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      if (
        activeTab === "awaiting_assignment" &&
        item.dispatchStatus !== "awaiting_assignment"
      )
        return false;
      if (activeTab === "assigned" && item.dispatchStatus !== "assigned")
        return false;
      if (
        activeTab === "exceptions" &&
        item.dispatchStatus !== "capacity_review" &&
        item.dispatchStatus !== "exception"
      )
        return false;

      if (statusFilter !== "all" && item.dispatchStatus !== statusFilter)
        return false;
      if (
        productFilter !== "all" &&
        !item.product.toLowerCase().includes(productFilter.toLowerCase())
      )
        return false;
      if (
        pickupAreaFilter !== "all" &&
        !item.pickupArea.toLowerCase().includes(pickupAreaFilter.toLowerCase())
      )
        return false;
      if (
        deliveryDateFilter !== "all" &&
        !item.requiredDeliveryDate
          .toLowerCase()
          .includes(deliveryDateFilter.toLowerCase())
      )
        return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.orderId.toLowerCase().includes(q) ||
          item.product.toLowerCase().includes(q) ||
          item.pickupArea.toLowerCase().includes(q) ||
          item.deliveryDestination.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [
    queue,
    activeTab,
    statusFilter,
    productFilter,
    pickupAreaFilter,
    deliveryDateFilter,
    searchQuery,
  ]);

  // Pagination (6 items per page, 4 pages total for 24 confirmed orders)
  const pageSize = 6;
  const totalCount = filteredQueue.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);

  const displayedQueue = useMemo(() => {
    return filteredQueue.slice(startIndex, startIndex + pageSize);
  }, [filteredQueue, startIndex, pageSize]);

  const handleOpenAssignModal = (order: DispatchItem) => {
    setSelectedOrder(order);
    setSelectedDriverId(drivers[0]?.id || "");
    setRouteNotes("");
    setAssignError("");
    setAssignmentModalOpen(true);
  };

  const handleConfirmAssignment = async () => {
    if (!selectedOrder) return;
    const selectedDriver = drivers.find((d) => d.id === selectedDriverId);
    if (!selectedDriver) {
      setAssignError("Please select an approved driver and vehicle.");
      return;
    }

    if (selectedDriver.capacityKg < selectedOrder.quantityKg) {
      setAssignError(
        `Selected vehicle capacity (${selectedDriver.capacityKg.toLocaleString()} kg) is smaller than order load (${selectedOrder.quantityKg.toLocaleString()} kg). Please choose a larger vehicle.`,
      );
      return;
    }

    await assignDispatchApi({
      orderId: selectedOrder.orderId,
      driverId: selectedDriver.id,
      vehicleId: selectedDriver.vehicleId,
      plannedLoadKg: selectedOrder.quantityKg,
      routeNotes,
    });

    setQueue((prev) =>
      prev.map((q) =>
        q.orderId === selectedOrder.orderId
          ? {
              ...q,
              dispatchStatus: "assigned",
              dispatchStatusLabel: "Assigned",
              assignedDriver: selectedDriver.name,
              assignedVehicle: selectedDriver.registration,
            }
          : q,
      ),
    );

    setSelectedOrder((prev) => ({
      ...prev,
      dispatchStatus: "assigned",
      dispatchStatusLabel: "Assigned",
      assignedDriver: selectedDriver.name,
      assignedVehicle: selectedDriver.registration,
    }));

    setToastMessage(
      `Order ${selectedOrder.orderId} assigned to ${selectedDriver.name} (${selectedDriver.registration}).`,
    );
    setAssignmentModalOpen(false);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setProductFilter("all");
    setStatusFilter("all");
    setPickupAreaFilter("all");
    setDeliveryDateFilter("all");
    setActiveTab("all");
  };

  return (
    <div className="ym26-dispatch-assignment w-full space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage("")} />
      )}

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold text-[#1e2f24] tracking-tight">
            Dispatch &amp; Driver Assignment
          </h1>
          <p className="text-xs md:text-sm text-[#596c60] mt-1">
            Assign approved drivers and vehicles, organise supplier pickups and
            monitor delivery operations.
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
              <RotateCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setAllTripsModalOpen(true)}
              className="h-9 px-3.5 rounded-lg border border-[#d2d9d0] bg-white text-[#263A31] hover:bg-[#f6f8f5] text-xs font-semibold flex items-center gap-2 transition shadow-2xs cursor-pointer"
            >
              <Eye size={14} className="text-[#596c60]" />
              <span>View Active Trips</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenAssignModal(selectedOrder)}
              className="h-9 px-3.5 rounded-lg bg-[#315A42] text-white hover:bg-[#274834] text-xs font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer"
            >
              <Plus size={15} />
              <span>Create Dispatch</span>
            </button>
          </div>
          <span className="text-[11px] text-[#718276] text-right font-normal">
            Last updated today at {lastRefreshed}
          </span>
        </div>
      </div>

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Orders Awaiting Assignment */}
        <div className="bg-white border border-[#e2e7e1] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#596c60] text-xs font-semibold">
            <span>Orders Awaiting Assignment</span>
            <Package size={18} className="text-[#315A42] stroke-[1.75]" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-[#1e2f24] tracking-tight">
              {stats?.ordersAwaitingAssignment ?? 23}
            </span>
          </div>
          <div className="mt-2 text-xs space-y-0.5">
            <p className="text-[#718276]">Confirmed and ready for pickup</p>
            <p className="text-[#1e2f24] font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#315A42] shrink-0" />
              <span>8 due for pickup today</span>
            </p>
          </div>
        </div>

        {/* Drivers Available */}
        <div className="bg-white border border-[#e2e7e1] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#596c60] text-xs font-semibold">
            <span>Drivers Available</span>
            <Users size={18} className="text-[#596c60] stroke-[1.75]" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-[#1e2f24] tracking-tight">
              {stats?.driversAvailable ?? 17}
            </span>
          </div>
          <div className="mt-2 text-xs space-y-0.5">
            <p className="text-[#718276]">Approved drivers ready to dispatch</p>
            <p className="text-[#596c60] font-normal flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#596c60] shrink-0" />
              <span>Across 4 operating regions</span>
            </p>
          </div>
        </div>

        {/* Active Trips */}
        <div className="bg-white border border-[#e2e7e1] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#596c60] text-xs font-semibold">
            <span>Active Trips</span>
            <Truck size={18} className="text-[#596c60] stroke-[1.75]" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-[#1e2f24] tracking-tight">
              {stats?.activeTrips ?? 12}
            </span>
          </div>
          <div className="mt-2 text-xs space-y-0.5">
            <p className="text-[#718276]">Deliveries currently on the road</p>
            <p className="text-[#596c60] font-normal flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#315A42] shrink-0" />
              <span>9 on time · 3 at risk</span>
            </p>
          </div>
        </div>

        {/* Dispatch Exceptions */}
        <div className="bg-white border border-[#e2e7e1] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#596c60] text-xs font-semibold">
            <span>Dispatch Exceptions</span>
            <TriangleAlert size={18} className="text-[#b43b37] stroke-[1.75]" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-[#1e2f24] tracking-tight">
              {String(stats?.dispatchExceptions ?? 3).padStart(2, "0")}
            </span>
          </div>
          <div className="mt-2 text-xs space-y-0.5">
            <p className="text-[#718276]">Require your attention</p>
            <p className="text-[#b43b37] font-normal flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#b43b37] shrink-0" />
              <span>2 delays · 1 vehicle issue</span>
            </p>
          </div>
        </div>
      </div>

      {/* Subheader Workspace Indicator */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-[#1e2f24]">
            Dispatch workspace
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eaf2e8] text-[#315A42]">
            Queue &amp; route planning
          </span>
        </div>
        <span className="text-xs text-[#718276]">
          Sample operations data · 10 Nov 2026
        </span>
      </div>

      {/* Split Main Section: Left = Dispatch Queue (7 cols), Right = Route Map (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left Column: Dispatch queue */}
        <div className="xl:col-span-7 bg-white border border-[#e2e7e1] rounded-2xl p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header: Title, Badge, Subtitle & Unit */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center">
                  <h3 className="text-base font-bold text-[#1e2f24]">
                    Dispatch queue
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#eef2ec] text-[#4f6155] ml-2">
                    24 orders
                  </span>
                </div>
                <p className="text-xs text-[#596c60] mt-0.5">
                  Confirmed orders waiting for driver and vehicle allocation.
                </p>
              </div>
              <span className="text-[11px] text-[#718276] whitespace-nowrap pt-1">
                All quantities in kg
              </span>
            </div>

            {/* Filter Bar Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718276]"
                />
                <input
                  type="text"
                  placeholder="Search order or product"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-2 rounded-lg border border-[#d2d9d0] bg-white text-xs text-[#1e2f24] placeholder-[#8a9b8e] focus:outline-none focus:ring-1 focus:ring-[#315A42]"
                />
              </div>

              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-[#d2d9d0] bg-white text-xs text-[#263A31] focus:outline-none focus:ring-1 focus:ring-[#315A42] cursor-pointer"
              >
                <option value="all">Product</option>
                <option value="rice">Rice (Red / Brown / Samba)</option>
                <option value="potatoes">Potatoes</option>
                <option value="gram">Green gram</option>
                <option value="lentils">Red lentils</option>
                <option value="maize">Maize</option>
                <option value="flour">Wheat flour</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-[#d2d9d0] bg-white text-xs text-[#263A31] focus:outline-none focus:ring-1 focus:ring-[#315A42] cursor-pointer"
              >
                <option value="all">Dispatch status</option>
                <option value="awaiting_assignment">Awaiting assignment</option>
                <option value="assigned">Assigned</option>
                <option value="capacity_review">Capacity review</option>
              </select>

              <select
                value={pickupAreaFilter}
                onChange={(e) => setPickupAreaFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-[#d2d9d0] bg-white text-xs text-[#263A31] focus:outline-none focus:ring-1 focus:ring-[#315A42] cursor-pointer"
              >
                <option value="all">Pickup area</option>
                <option value="negombo">Negombo</option>
                <option value="ja-ela">Ja-Ela</option>
                <option value="dambulla">Dambulla</option>
                <option value="kurunegala">Kurunegala</option>
                <option value="gampaha">Gampaha</option>
                <option value="matale">Matale</option>
                <option value="polonnaruwa">Polonnaruwa</option>
                <option value="anuradhapura">Anuradhapura</option>
                <option value="badulla">Badulla</option>
              </select>

              <select
                value={deliveryDateFilter}
                onChange={(e) => setDeliveryDateFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-[#d2d9d0] bg-white text-xs text-[#263A31] focus:outline-none focus:ring-1 focus:ring-[#315A42] cursor-pointer"
              >
                <option value="all">Delivery date</option>
                <option value="10 Nov">10 Nov 2026</option>
                <option value="11 Nov">11 Nov 2026</option>
                <option value="12 Nov">12 Nov 2026</option>
                <option value="13 Nov">13 Nov 2026</option>
                <option value="14 Nov">14 Nov 2026</option>
              </select>
            </div>

            {/* Sub-Tabs Row */}
            <div className="flex items-center justify-between border-b border-[#e2e7e1] text-xs pt-1">
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`pb-2.5 flex items-center gap-1.5 cursor-pointer transition ${
                    activeTab === "all"
                      ? "border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px"
                      : "text-[#596c60] hover:text-[#1e2f24] font-medium"
                  }`}
                >
                  <span>All confirmed</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("awaiting_assignment")}
                  className={`pb-2.5 flex items-center gap-1.5 cursor-pointer transition ${
                    activeTab === "awaiting_assignment"
                      ? "border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px"
                      : "text-[#596c60] hover:text-[#1e2f24] font-medium"
                  }`}
                >
                  <span>Awaiting assignment</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-[#eef2ec] text-[#4f6155]">
                    23
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("assigned")}
                  className={`pb-2.5 flex items-center gap-1.5 cursor-pointer transition ${
                    activeTab === "assigned"
                      ? "border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px"
                      : "text-[#596c60] hover:text-[#1e2f24] font-medium"
                  }`}
                >
                  <span>Assigned</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("exceptions")}
                  className={`pb-2.5 flex items-center gap-1.5 cursor-pointer transition ${
                    activeTab === "exceptions"
                      ? "border-b-2 border-[#315A42] text-[#1e2f24] font-bold -mb-px"
                      : "text-[#596c60] hover:text-[#1e2f24] font-medium"
                  }`}
                >
                  <span>Exceptions</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-[#fff0e3] text-[#854500]">
                    03
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetFilters}
                className="pb-2.5 text-[11px] text-[#718276] hover:text-[#1e2f24] cursor-pointer"
              >
                Reset filters
              </button>
            </div>

            {/* Table */}
            <div className="border border-[#e2e7e1] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-[#f4f6f3] text-[#596c60] text-[11px] font-semibold border-b border-[#e2e7e1]">
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Product</th>
                      <th className="p-3">Total quantity (kg)</th>
                      <th className="p-3">Supplier count</th>
                      <th className="p-3">Pickup area</th>
                      <th className="p-3">Delivery destination</th>
                      <th className="p-3">Required delivery date</th>
                      <th className="p-3">Dispatch status</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0ec]">
                    {displayedQueue.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="p-8 text-center text-[#718276]"
                        >
                          No orders match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      displayedQueue.map((item) => {
                        const isSelected =
                          selectedOrder.orderId === item.orderId;
                        const isAssigned = item.dispatchStatus === "assigned";
                        const isCapacityReview =
                          item.dispatchStatus === "capacity_review";

                        return (
                          <tr
                            key={item.orderId}
                            onClick={() => setSelectedOrder(item)}
                            className={`cursor-pointer transition ${
                              isSelected ? "bg-[#f4f7f4]" : "hover:bg-[#f9faf8]"
                            }`}
                          >
                            {/* Order ID */}
                            <td className="p-3">
                              <span className="font-bold text-xs text-[#1e2f24] block">
                                {item.orderId}
                              </span>
                              {isSelected ? (
                                <span className="text-[10px] text-[#315A42] font-semibold block mt-0.5">
                                  Selected
                                </span>
                              ) : (
                                <span className="text-[10px] text-[#718276] block mt-0.5">
                                  Confirmed
                                </span>
                              )}
                            </td>

                            {/* Product */}
                            <td className="p-3 font-semibold text-xs text-[#1e2f24]">
                              {item.product}
                            </td>

                            {/* Total quantity (kg) */}
                            <td className="p-3 font-bold text-xs text-[#1e2f24]">
                              {item.quantityKg.toLocaleString()}
                            </td>

                            {/* Supplier count */}
                            <td className="p-3 text-xs text-[#1e2f24]">
                              {item.supplierCount}
                            </td>

                            {/* Pickup area */}
                            <td className="p-3">
                              <span className="text-xs text-[#1e2f24] block font-medium">
                                {item.pickupArea}
                              </span>
                              {item.pickupAreaSubtext && (
                                <span className="text-[11px] text-[#718276] block mt-0.5">
                                  {item.pickupAreaSubtext}
                                </span>
                              )}
                            </td>

                            {/* Delivery destination */}
                            <td className="p-3">
                              <span className="text-xs text-[#1e2f24] block font-medium">
                                {item.deliveryDestination}
                              </span>
                              {item.deliveryDestinationSubtext && (
                                <span className="text-[11px] text-[#718276] block mt-0.5">
                                  {item.deliveryDestinationSubtext}
                                </span>
                              )}
                            </td>

                            {/* Required delivery date */}
                            <td className="p-3">
                              <span className="text-xs text-[#1e2f24] block font-medium">
                                {item.requiredDeliveryDate}
                              </span>
                              {item.requiredDeliveryDateSubtext && (
                                <span className="text-[11px] text-[#718276] block mt-0.5">
                                  {item.requiredDeliveryDateSubtext}
                                </span>
                              )}
                            </td>

                            {/* Dispatch status */}
                            <td className="p-3">
                              {isAssigned ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#eaf2e8] text-[#315A42]">
                                  Assigned
                                </span>
                              ) : isCapacityReview ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fff0e3] text-[#854500]">
                                  Capacity review
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f0f3ef] text-[#4f6155]">
                                  Awaiting assignment
                                </span>
                              )}
                            </td>

                            {/* Action */}
                            <td className="p-3 text-center">
                              {isAssigned ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrder(item);
                                  }}
                                  className="h-7 px-3 rounded-lg bg-[#315A42] text-white font-semibold text-xs hover:bg-[#274834] transition cursor-pointer"
                                >
                                  View →
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAssignModal(item);
                                  }}
                                  className="h-7 px-3 rounded-lg border border-[#d2d9d0] bg-white text-[#263A31] font-semibold text-xs hover:bg-[#f6f8f5] transition cursor-pointer"
                                >
                                  Assign →
                                </button>
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
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-3 text-xs text-[#718276]">
            <span>
              Showing {totalCount > 0 ? startIndex + 1 : 0}–{endIndex} of{" "}
              {totalCount} confirmed orders
            </span>

            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold cursor-pointer ${
                    currentPage === page
                      ? "bg-[#eef2ec] text-[#1e2f24] font-bold"
                      : "text-[#596c60] hover:bg-[#f6f8f5]"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="w-6 h-6 flex items-center justify-center text-[#596c60] hover:text-[#1e2f24] disabled:opacity-30 cursor-pointer"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Selected order route & Map */}
        <div className="xl:col-span-5 bg-white border border-[#e2e7e1] rounded-2xl p-6 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            {/* Header: Title, Subtitle, Static map badge */}
            <div className="flex items-start justify-between border-b border-[#e2e7e1] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1e2f24]">
                  Selected order route
                </h3>
                <p className="text-xs text-[#596c60] mt-0.5 font-normal">
                  {selectedOrder.orderId} · {selectedOrder.product} ·{" "}
                  {selectedOrder.quantityKg.toLocaleString()} kg
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#eef2ec] text-[#4f6155]">
                Static map preview
              </span>
            </div>

            {/* Stylized Western Corridor SVG Map Preview */}
            <div className="relative mt-4 w-full h-[320px] rounded-xl bg-[#eaf0eb] border border-[#d2d9d0] overflow-hidden p-3 flex flex-col justify-between shadow-inner">
              {/* Background Map & Coastline */}
              <svg
                className="absolute inset-0 w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Grid pattern representing cartographic street lines */}
                  <pattern
                    id="roadGrid"
                    width="36"
                    height="36"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 36 0 L 0 0 0 36"
                      fill="none"
                      stroke="#d5ded6"
                      strokeWidth="0.8"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="#edf3ee" />
                <rect width="100%" height="100%" fill="url(#roadGrid)" />

                {/* Ocean Area along left coastline */}
                <path
                  d="M 0,0 L 75,0 Q 115,80 90,160 Q 65,240 100,320 L 0,320 Z"
                  fill="#dce9e2"
                  opacity="0.9"
                />
                {/* Coastal buffer line */}
                <path
                  d="M 75,0 Q 115,80 90,160 Q 65,240 100,320"
                  fill="none"
                  stroke="#c2d8cc"
                  strokeWidth="3"
                />

                {/* Main Highway Route (Negombo -> Ja-Ela -> Wattala -> Colombo) */}
                <path
                  d="M 180,55 Q 215,100 200,145 Q 185,190 190,230 L 175,275"
                  fill="none"
                  stroke="#263A31"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Secondary connecting road lines */}
                <path
                  d="M 180,55 L 260,70"
                  fill="none"
                  stroke="#cad5cd"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
                <path
                  d="M 200,145 L 285,150"
                  fill="none"
                  stroke="#cad5cd"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
                <path
                  d="M 190,230 L 260,225"
                  fill="none"
                  stroke="#cad5cd"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
              </svg>

              {/* Water / Ocean Label */}
              <div className="relative z-10 pl-2 pt-16 pointer-events-none">
                <span className="text-[10px] font-semibold text-[#81988a] tracking-widest uppercase block rotate-[-90deg] origin-left">
                  INDIAN OCEAN
                </span>
              </div>

              {/* City Name Labels */}
              <span className="absolute top-[48px] left-[195px] z-10 text-[10px] font-bold text-[#596c60] tracking-wider uppercase pointer-events-none">
                NEGOMBO
              </span>
              <span className="absolute top-[138px] left-[215px] z-10 text-[10px] font-bold text-[#596c60] tracking-wider uppercase pointer-events-none">
                JA-ELA
              </span>
              <span className="absolute top-[168px] left-[255px] z-10 text-[10px] font-bold text-[#718276] tracking-wider uppercase pointer-events-none">
                KADAWATHA
              </span>
              <span className="absolute top-[222px] left-[205px] z-10 text-[10px] font-bold text-[#596c60] tracking-wider uppercase pointer-events-none">
                WATTALA
              </span>

              {/* Waypoint 1: Negombo + Callout box */}
              <div className="absolute top-[42px] left-[168px] z-20 flex items-start gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#315A42] text-white text-[11px] font-bold flex items-center justify-center shadow-md shrink-0">
                  1
                </span>
                <div className="bg-white px-2 py-1 rounded-md border border-[#d2d9d0] shadow-sm text-left">
                  <p className="font-bold text-[10px] text-[#1e2f24] leading-tight">
                    1: Green Valley Growers
                  </p>
                  <p className="text-[9px] text-[#596c60]">
                    Negombo · 3,200 kg
                  </p>
                  <p className="text-[9px] text-[#315A42] font-semibold">
                    Supplier pickup
                  </p>
                </div>
              </div>

              {/* Waypoint 2: Ja-Ela */}
              <div className="absolute top-[135px] left-[190px] z-20">
                <span className="w-5 h-5 rounded-full bg-[#315A42] text-white text-[11px] font-bold flex items-center justify-center shadow-md">
                  2
                </span>
              </div>

              {/* Waypoint 3: Wattala */}
              <div className="absolute top-[220px] left-[180px] z-20">
                <span className="w-5 h-5 rounded-full bg-[#315A42] text-white text-[11px] font-bold flex items-center justify-center shadow-md">
                  3
                </span>
              </div>

              {/* Moving Vehicle Marker on route */}
              <div className="absolute top-[180px] left-[140px] z-25 flex items-center gap-1 bg-white/95 px-2 py-0.5 rounded-full border border-[#d2d9d0] shadow-md text-[9px] text-[#263A31] font-semibold">
                <Truck size={11} className="text-[#315A42]" />
                <span>Last reported · 13:50</span>
              </div>

              {/* Destination Pin: Colombo */}
              <div className="absolute top-[260px] left-[162px] z-20 flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-[#e08a3c] text-white flex items-center justify-center shadow-md font-bold text-[10px]">
                  ■
                </div>
                <span className="text-[10px] font-bold text-[#1e2f24] tracking-wider uppercase bg-white/90 px-1 py-0.5 rounded">
                  COLOMBO
                </span>
              </div>

              {/* Bottom map note & Controls */}
              <div className="relative z-20 flex items-end justify-between w-full pt-1 pointer-events-none">
                <span className="text-[9px] text-[#718276] font-normal">
                  Illustrative locations · no live GPS tracking
                </span>

                <div className="flex flex-col gap-1 bg-white border border-[#d2d9d0] rounded-lg p-0.5 shadow-xs pointer-events-auto">
                  <button
                    type="button"
                    className="w-5 h-5 flex items-center justify-center text-xs font-bold text-[#263A31] hover:bg-[#f6f8f5] rounded cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="w-5 h-5 flex items-center justify-center text-xs font-bold text-[#263A31] hover:bg-[#f6f8f5] rounded cursor-pointer"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="w-5 h-5 flex items-center justify-center text-xs text-[#263A31] hover:bg-[#f6f8f5] rounded cursor-pointer"
                  >
                    <Crosshair size={11} />
                  </button>
                </div>
              </div>
            </div>

            {/* Map Legend */}
            <div className="flex items-center justify-between gap-2 pt-3 text-[11px] text-[#596c60]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#315A42]" />
                <span>1 Pickup</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#e08a3c]" />
                <span>Buyer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck size={13} className="text-[#315A42]" />
                <span>Last reported vehicle</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-[#263A31]" />
                <span>Suggested route</span>
              </div>
            </div>
          </div>

          {/* Route Summary & Review Action Button */}
          <div className="border-t border-[#e2e7e1] pt-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-[#1e2f24]">
                {selectedOrder.stops?.length ?? 3} pickups →{" "}
                {selectedOrder.deliveryDestination}
                {selectedOrder.deliveryDestinationSubtext
                  ? `, ${selectedOrder.deliveryDestinationSubtext}`
                  : ""}
              </p>
              <p className="text-xs text-[#718276] mt-0.5">
                Required by {selectedOrder.requiredDeliveryDate}
                {selectedOrder.requiredDeliveryDateSubtext
                  ? `, ${selectedOrder.requiredDeliveryDateSubtext.replace("By ", "")}`
                  : ""}{" "}
                · Total load: {selectedOrder.quantityKg.toLocaleString()} kg
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenAssignModal(selectedOrder)}
              className="w-full h-10 rounded-xl bg-[#315A42] text-white font-semibold text-xs hover:bg-[#274834] transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <span>Review driver &amp; vehicle assignment</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Dispatch Exceptions Warning Banner */}
      <div className="bg-[#fff4eb] border border-[#fbd9c4] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#ffe7d6] text-[#854500] flex items-center justify-center shrink-0">
            <TriangleAlert size={17} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-[#854500]">
              3 dispatch exceptions need attention
            </h4>
            <p className="text-xs text-[#718276] mt-0.5">
              2 delayed trips and 1 vehicle issue affecting today's schedule.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab("exceptions")}
          className="text-xs font-bold text-[#854500] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <span>Review exceptions</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Active Trips Section */}
      <div
        id="active-trips-section"
        className="bg-white border border-[#e2e7e1] rounded-2xl p-6 shadow-2xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center">
              <h3 className="text-base font-bold text-[#1e2f24]">
                Active trips
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#eef2ec] text-[#4f6155] ml-2">
                12
              </span>
            </div>
            <p className="text-xs text-[#596c60] mt-0.5">
              Fleet movements, at a glance
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAllTripsModalOpen(true)}
            className="text-xs font-semibold text-[#315A42] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View all</span>
            <ChevronRight size={13} />
          </button>
        </div>

        {/* 3 Featured Trip Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activeTrips.slice(0, 3).map((trip) => {
            const isDelayed = trip.status === "delayed";

            return (
              <div
                key={trip.tripId}
                className="p-4 rounded-xl border border-[#e2e7e1] bg-white hover:border-[#315A42] transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isDelayed
                          ? "bg-[#fff0e3] text-[#854500]"
                          : "bg-[#eaf2e8] text-[#315A42]"
                      }`}
                    >
                      <Truck size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1e2f24]">
                        {trip.tripId}{" "}
                        <span className="text-[#718276] font-normal text-[11px]">
                          #{trip.orderId}
                        </span>
                      </p>
                      <p className="text-xs font-bold text-[#1e2f24] mt-0.5">
                        {trip.route}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      isDelayed
                        ? "bg-[#fff0e3] text-[#854500]"
                        : "bg-[#eaf2e8] text-[#315A42]"
                    }`}
                  >
                    {trip.statusLabel}
                  </span>
                </div>

                <div className="text-[11px] text-[#718276]">
                  <p>
                    {trip.driverName} · {trip.vehiclePlate}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-[#e8ede7] overflow-hidden">
                  <div
                    className={`h-full transition-all ${isDelayed ? "bg-[#e08a3c]" : "bg-[#315A42]"}`}
                    style={{ width: `${trip.progressPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-bold text-[#1e2f24]">{trip.eta}</span>
                  <span
                    className={`text-[11px] ${isDelayed ? "text-[#854500] font-semibold" : "text-[#718276]"}`}
                  >
                    {trip.delayText || `${trip.stopsLeft} stops left`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Snapshot footnote */}
        <div className="flex items-center justify-between text-[11px] text-[#718276] pt-1">
          <span>Illustrative trip snapshot · not live GPS tracking</span>
          <span>Snapshot: 10 Nov 2026, 14:32</span>
        </div>
      </div>

      {/* Driver & Vehicle Assignment Modal */}
      {assignmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#17281db3] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#e2e7e1] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#1e2f24]">
                  Assign Driver &amp; Vehicle
                </h3>
                <p className="text-xs text-[#596c60]">
                  Order: {selectedOrder.orderId} · Load:{" "}
                  {selectedOrder.quantityKg.toLocaleString()} kg ·{" "}
                  {selectedOrder.product}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignmentModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#eaf2e8] text-[#596c60] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {assignError && (
              <div className="p-3 rounded-xl bg-[#fcebea] text-[#a51c19] text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{assignError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-[#1e2f24] mb-1.5">
                  Select Approved Driver &amp; Vehicle *
                </label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => {
                    setSelectedDriverId(e.target.value);
                    setAssignError("");
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-[#d2d9d0] text-xs text-[#1e2f24] focus:outline-none focus:ring-1 focus:ring-[#315A42]"
                >
                  {drivers.map((drv) => (
                    <option key={drv.id} value={drv.id}>
                      {drv.name} — {drv.vehicleType} ({drv.registration}) ·
                      Capacity: {drv.capacityKg.toLocaleString()} kg
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#718276] mt-1">
                  Requires positive capacity and available driver without
                  overlapping active trips.
                </p>
              </div>

              {/* Nearest Next Stop Planning Confirmation */}
              <div className="bg-[#f6f8f5] p-3.5 rounded-xl border border-[#e2e7e1] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1e2f24] flex items-center gap-1.5">
                    <Navigation size={14} className="text-[#315A42]" />
                    <span>Routing Method: Nearest-Next-Stop Sequence</span>
                  </span>
                  <span className="text-xs font-semibold text-[#315A42]">
                    Sequence Verified
                  </span>
                </div>
                <div className="space-y-1 text-xs text-[#596c60]">
                  {selectedOrder.stops?.map((st) => (
                    <div
                      key={st.stopNumber}
                      className="flex items-center justify-between"
                    >
                      <span>
                        Stop {st.stopNumber}: {st.farmName} ({st.area})
                      </span>
                      <span className="font-semibold text-[#1e2f24]">
                        {st.quantityKg.toLocaleString()} kg
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between font-bold text-[#1e2f24] pt-1.5 border-t border-[#e2e7e1]">
                    <span>
                      Final Destination: {selectedOrder.deliveryDestination}
                    </span>
                    <span>
                      Total: {selectedOrder.quantityKg.toLocaleString()} kg
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1e2f24] mb-1.5">
                  Route Instructions &amp; Notes
                </label>
                <input
                  type="text"
                  value={routeNotes}
                  onChange={(e) => setRouteNotes(e.target.value)}
                  placeholder="e.g. Call Green Valley manager 30 min before arrival..."
                  className="w-full h-9 px-3 rounded-xl border border-[#d2d9d0] text-xs text-[#1e2f24] placeholder-[#8a9b8e] focus:outline-none focus:ring-1 focus:ring-[#315A42]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#e2e7e1]">
              <button
                type="button"
                onClick={() => setAssignmentModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#d2d9d0] text-xs font-semibold text-[#263A31] hover:bg-[#f6f8f5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignment}
                className="px-4 py-2 rounded-xl bg-[#315A42] text-white text-xs font-semibold hover:bg-[#274834] transition cursor-pointer"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View All Active Trips Modal */}
      {allTripsModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#17281db3] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e2e7e1] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#1e2f24]">
                  All Active Trips (12)
                </h3>
                <p className="text-xs text-[#596c60]">
                  Fleet movements and delivery operations in transit
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAllTripsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#eaf2e8] text-[#596c60] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {activeTrips.map((trip) => {
                const isDelayed = trip.status === "delayed";
                return (
                  <div
                    key={trip.tripId}
                    className="p-3.5 rounded-xl border border-[#e2e7e1] bg-[#f9faf8] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1e2f24]">
                        {trip.tripId} · {trip.orderId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isDelayed
                            ? "bg-[#fff0e3] text-[#854500]"
                            : "bg-[#eaf2e8] text-[#315A42]"
                        }`}
                      >
                        {trip.statusLabel}
                      </span>
                    </div>
                    <p className="font-semibold text-xs text-[#1e2f24]">
                      {trip.route}
                    </p>
                    <p className="text-[11px] text-[#718276]">
                      {trip.driverName} · {trip.vehiclePlate}
                    </p>
                    <div className="flex items-center justify-between font-bold text-[#1e2f24] pt-1 border-t border-[#e2e7e1]">
                      <span>{trip.eta}</span>
                      <span
                        className={
                          isDelayed ? "text-[#854500]" : "text-[#718276]"
                        }
                      >
                        {trip.delayText || `${trip.stopsLeft} stops left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#e2e7e1]">
              <button
                type="button"
                onClick={() => setAllTripsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#d2d9d0] text-xs font-semibold text-[#263A31] hover:bg-[#f6f8f5] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
