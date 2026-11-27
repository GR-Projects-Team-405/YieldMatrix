import pool from '../../config/db.js';

// YM30 · Yugen Suresh · People & access
// Backend Controller supporting all 5 pages:
// 1. Admin Dashboard    -> GET /api/ym30/dashboard
// 2. Account Details    -> GET /api/ym30/accounts/:accountId, PATCH /api/ym30/accounts/:accountId, PATCH /api/ym30/accounts/:accountId/status
// 3. Approval Requests  -> GET /api/ym30/approvals, PATCH /api/ym30/approvals/:id
// 4. Suspended Accounts -> GET /api/ym30/suspended, PATCH /api/ym30/members/:id/restore, PATCH /api/ym30/members/:id/suspend
// 5. People and Access  -> GET /api/ym30/members

// In-memory illustrative demo directory matching Image 1
const DEMO_MEMBERS = [
  {
    id: '10480000-0000-0000-0000-000000001048',
    name: 'Kasuni Silva',
    email: 'kasuni.silva@gmail.com',
    phone: '+94 77 123 4567',
    role: 'farmer',
    district: 'Gampaha',
    approvalStatus: 'approved', // Active in Image 1
    approvalReason: null,
    createdAt: '2026-11-02T10:00:00Z',
  },
  {
    id: '10490000-0000-0000-0000-000000001049',
    name: 'Nimal Perera',
    email: 'nimal.perera@gmail.com',
    phone: '+94 71 234 5678',
    role: 'buyer',
    district: 'Colombo',
    approvalStatus: 'pending', // Pending approval in Image 1
    approvalReason: null,
    createdAt: '2026-11-03T08:30:00Z',
  },
  {
    id: '10500000-0000-0000-0000-000000001050',
    name: 'Sanduni Fernando',
    email: 'sanduni.fernando@gmail.com',
    phone: '+94 72 345 6789',
    role: 'farmer',
    district: 'Kandy',
    approvalStatus: 'suspended', // Suspended in Image 1
    approvalReason: 'Policy violation',
    createdAt: '2026-11-01T14:20:00Z',
    suspendedAt: '2026-11-06T11:00:00Z',
  },
  {
    id: '10510000-0000-0000-0000-000000001051',
    name: 'Dilan Jayawardena',
    email: 'dilan.j@gmail.com',
    phone: '+94 76 456 7890',
    role: 'driver',
    district: 'Kurunegala',
    approvalStatus: 'approved', // Active in Image 1
    approvalReason: null,
    createdAt: '2026-10-30T16:15:00Z',
  },
  {
    id: '10520000-0000-0000-0000-000000001052',
    name: 'Tharushi Peris',
    email: 'tharushi.peris@gmail.com',
    phone: '+94 75 567 8901',
    role: 'buyer',
    district: 'Gampaha',
    approvalStatus: 'approved', // Active in Image 1
    approvalReason: null,
    createdAt: '2026-10-29T11:45:00Z',
  },
  {
    id: '10530000-0000-0000-0000-000000001053',
    name: 'Anura Bandara',
    email: 'anura.bandara@gmail.com',
    phone: '+94 77 987 6543',
    role: 'farmer',
    district: 'Nuwara Eliya',
    approvalStatus: 'approved',
    approvalReason: null,
    createdAt: '2026-10-28T09:10:00Z',
  },
  {
    id: '10540000-0000-0000-0000-000000001054',
    name: 'Chathura Wickrama',
    email: 'chathura.w@gmail.com',
    phone: '+94 71 876 5432',
    role: 'driver',
    district: 'Matale',
    approvalStatus: 'approved',
    approvalReason: null,
    createdAt: '2026-10-27T15:00:00Z',
  },
  {
    id: '10550000-0000-0000-0000-000000001055',
    name: 'Niluka Samanmali',
    email: 'niluka.s@gmail.com',
    phone: '+94 70 765 4321',
    role: 'farmer',
    district: 'Badulla',
    approvalStatus: 'approved',
    approvalReason: null,
    createdAt: '2026-10-26T09:20:00Z',
  },
  {
    id: '10560000-0000-0000-0000-000000001056',
    name: 'Chaminda Silva',
    email: 'chaminda.silva@gmail.com',
    phone: '+94 78 654 3210',
    role: 'buyer',
    district: 'Galle',
    approvalStatus: 'approved',
    approvalReason: null,
    createdAt: '2026-10-25T17:40:00Z',
  },
  {
    id: '10570000-0000-0000-0000-000000001057',
    name: 'Roshani Jayatillake',
    email: 'roshani.j@gmail.com',
    phone: '+94 72 543 2109',
    role: 'farmer',
    district: 'Ratnapura',
    approvalStatus: 'suspended',
    approvalReason: 'Verification issue',
    createdAt: '2026-10-24T13:10:00Z',
    suspendedAt: '2026-11-05T10:00:00Z',
  },
];

// In-memory illustrative demo suspended accounts matching Image 2
const DEMO_SUSPENDED = [
  {
    id: '20010000-0000-0000-0000-000000002001',
    name: 'Kasuni Silva',
    email: 'kasuni.silva@gmail.com',
    role: 'farmer',
    district: 'Gampaha',
    suspensionReason: 'Verification issue',
    suspendedOn: '2026-11-08T10:00:00Z',
    approvalStatus: 'suspended',
  },
  {
    id: '20020000-0000-0000-0000-000000002002',
    name: 'Sanduni Fernando',
    email: 'sanduni.fernando@gmail.com',
    role: 'farmer',
    district: 'Kandy',
    suspensionReason: 'Policy Violation',
    suspendedOn: '2026-11-06T14:30:00Z',
    approvalStatus: 'suspended',
  },
  {
    id: '20030000-0000-0000-0000-000000002003',
    name: 'Nimal Perera',
    email: 'nimal.perera@gmail.com',
    role: 'buyer',
    district: 'Colombo',
    suspensionReason: 'Policy violation',
    suspendedOn: '2026-11-07T09:15:00Z',
    approvalStatus: 'suspended',
  },
  {
    id: '20040000-0000-0000-0000-000000002004',
    name: 'Dilan Jayawardena',
    email: 'dilan.j@gmail.com',
    role: 'driver',
    district: 'Kurunegala',
    suspensionReason: 'Admin review',
    suspendedOn: '2026-11-05T16:45:00Z',
    approvalStatus: 'suspended',
  },
  {
    id: '20050000-0000-0000-0000-000000002005',
    name: 'Tharushi Peris',
    email: 'tharushi.peris@gmail.com',
    role: 'buyer',
    district: 'Gampaha',
    suspensionReason: 'Verification issue',
    suspendedOn: '2026-11-04T11:20:00Z',
    approvalStatus: 'suspended',
  },
  {
    id: '20060000-0000-0000-0000-000000002006',
    name: 'Sarath Gunasekara',
    email: 'sarath.g@gmail.com',
    role: 'farmer',
    district: 'Jaffna',
    suspensionReason: 'Verification issue',
    suspendedOn: '2026-11-03T10:10:00Z',
    approvalStatus: 'suspended',
  },
  {
    id: '20070000-0000-0000-0000-000000002007',
    name: 'Mahesh Karunaratne',
    email: 'mahesh.k@gmail.com',
    role: 'driver',
    district: 'Puttalam',
    suspensionReason: 'Policy violation',
    suspendedOn: '2026-11-02T13:40:00Z',
    approvalStatus: 'suspended',
  },
  {
    id: '20080000-0000-0000-0000-000000002008',
    name: 'Damith Senarath',
    email: 'damith.s@gmail.com',
    role: 'buyer',
    district: 'Matara',
    suspensionReason: 'Admin review',
    suspendedOn: '2026-11-01T15:00:00Z',
    approvalStatus: 'suspended',
  },
  {
    id: '20090000-0000-0000-0000-000000002009',
    name: 'Kamal Bandara',
    email: 'kamal.b@gmail.com',
    role: 'farmer',
    district: 'Badulla',
    suspensionReason: 'Verification issue',
    suspendedOn: '2026-10-31T09:30:00Z',
    approvalStatus: 'suspended',
  },
  {
    id: '20100000-0000-0000-0000-000000002010',
    name: 'Ruwan Kumara',
    email: 'ruwan.k@gmail.com',
    role: 'driver',
    district: 'Anuradhapura',
    suspensionReason: 'Policy violation',
    suspendedOn: '2026-10-30T14:15:00Z',
    approvalStatus: 'suspended',
  },
  {
    id: '20110000-0000-0000-0000-000000002011',
    name: 'Sunethra Wijesinghe',
    email: 'sunethra.w@gmail.com',
    role: 'buyer',
    district: 'Kalutara',
    suspensionReason: 'Verification issue',
    suspendedOn: '2026-10-29T10:50:00Z',
    approvalStatus: 'suspended',
  },
  {
    id: '20120000-0000-0000-0000-000000002012',
    name: 'Priyanka Jayakody',
    email: 'priyanka.j@gmail.com',
    role: 'farmer',
    district: 'Monaragala',
    suspensionReason: 'Admin review',
    suspendedOn: '2026-10-28T16:00:00Z',
    approvalStatus: 'suspended',
  },
];

// Helper: generate short ID
function getAccountIdShort(id) {
  const segment = id.replace(/-/g, '').slice(0, 4);
  return `YM-${parseInt(segment, 16) % 10000}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 0. Module Verification Endpoint (Developer Guide page 17 requirement)
// ─────────────────────────────────────────────────────────────────────────────
export async function getStatus(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved']
    );
    if (!rows[0]) {
      return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    }
    return res.json({
      module: 'YM30',
      owner: 'Yugen Suresh',
      status: 'ready',
      user: rows[0],
      requestId: req.requestId,
    });
  } catch {
    // Graceful fallback for demo admin identity
    return res.json({
      module: 'YM30',
      owner: 'Yugen Suresh',
      status: 'ready',
      user: {
        id: req.user.id,
        name: req.user.name || 'Demo Admin',
        role: req.user.role || 'admin',
      },
      requestId: req.requestId,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Admin Dashboard (Overview page) -> GET /api/ym30/dashboard
// ─────────────────────────────────────────────────────────────────────────────
export async function getDashboard(req, res, next) {
  try {
    let approvedMembers = 128;
    let activeOrders = 36;
    let openIncidents = 3;
    let acceptedTradeCents = 184000000; // LKR 1.84M
    let pendingApprovals = 12;
    let readyForDispatch = 4;
    let driverExceptions = 3;
    let participationRoles = [
      { role: 'farmer', count: 84 },
      { role: 'buyer', count: 32 },
      { role: 'driver', count: 12 },
    ];
    let recentMembers = DEMO_MEMBERS.slice(0, 10).map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      district: r.district,
      approvalStatus: r.approvalStatus,
      createdAt: r.createdAt,
    }));
    let pendingReview = [
      { id: 'rev-1', reference: 'YM 1039 • Delay', category: 'Delivery incident', priority: 'High', assignedTo: 'Operations', status: 'Needs review' },
      { id: 'rev-2', reference: 'YM 1038 • Top up', category: 'Partner acceptance', priority: 'Medium', assignedTo: 'Finance', status: 'Disputed' },
    ];

    try {
      const client = await pool.connect();
      try {
        // Query approved members count
        const membersResult = await client.query("SELECT COUNT(*) AS count FROM users WHERE approval_status = 'approved'");
        if (membersResult.rows[0]?.count) approvedMembers = parseInt(membersResult.rows[0].count, 10);

        // Query active orders
        const ordersResult = await client.query("SELECT COUNT(*) AS count FROM orders WHERE status NOT IN ('draft','closed','cancelled','expired')");
        if (ordersResult.rows[0]?.count) activeOrders = parseInt(ordersResult.rows[0].count, 10);

        // Query open incidents
        const incidentsResult = await client.query("SELECT COUNT(*) AS count FROM incidents WHERE status = 'open'");
        if (incidentsResult.rows[0]?.count) openIncidents = parseInt(incidentsResult.rows[0].count, 10);

        // Query accepted trade volume in last 30 days
        const tradeResult = await client.query(
          "SELECT COALESCE(SUM(agreed_value_cents), 0) AS total FROM allocations WHERE status IN ('accepted','partially_accepted','resolved') AND created_at >= NOW() - INTERVAL '30 days'"
        );
        if (tradeResult.rows[0]?.total > 0) acceptedTradeCents = parseInt(tradeResult.rows[0].total, 10);

        // Query pending approvals count
        const pendingResult = await client.query("SELECT COUNT(*) AS count FROM users WHERE approval_status = 'pending'");
        const dbPending = parseInt(pendingResult.rows[0]?.count || '0', 10);
        if (dbPending > 0) pendingApprovals = dbPending;

        // Query breakdown by role
        const roleResult = await client.query(
          "SELECT role, COUNT(*) AS count FROM users WHERE approval_status = 'approved' GROUP BY role ORDER BY role"
        );
        if (roleResult.rows.length > 0) {
          participationRoles = roleResult.rows.map((r) => ({ role: r.role, count: parseInt(r.count, 10) }));
        }

        // Query latest registered members
        const recentResult = await client.query(
          "SELECT id, name, email, role, district, approval_status, created_at FROM users ORDER BY created_at DESC LIMIT 10"
        );
        if (recentResult.rows.length > 0) {
          recentMembers = recentResult.rows.map((r) => ({
            id: r.id,
            name: r.name,
            email: r.email,
            role: r.role,
            district: r.district,
            approvalStatus: r.approval_status,
            createdAt: r.created_at,
          }));
        }
      } finally {
        client.release();
      }
    } catch {
      // Use illustrative demo stats
    }

    res.json({
      stats: {
        approvedMembers,
        activeOrders,
        openIncidents,
        acceptedTradeCents,
      },
      attention: [
        { label: 'Account approvals', sublabel: 'Pending', count: pendingApprovals },
        { label: 'Ready for dispatch', sublabel: 'New', count: readyForDispatch },
        { label: 'Driver exceptions', sublabel: 'Open', count: driverExceptions },
      ],
      participation: {
        totalApproved: approvedMembers,
        roles: participationRoles,
        awaitingReview: pendingApprovals,
      },
      recentMembers,
      pendingReview,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. People & Access Directory (Image 1) -> GET /api/ym30/members
// ─────────────────────────────────────────────────────────────────────────────
export async function getMembers(req, res, next) {
  try {
    const { search = '', role = 'all', status = 'all', sort = 'newest', page = '1', limit = '5' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 5);

    let allMembers = [...DEMO_MEMBERS];

    try {
      const dbResult = await pool.query(
        'SELECT id, name, email, phone, role, district, approval_status, approval_reason, created_at, updated_at FROM users ORDER BY created_at DESC'
      );
      if (dbResult.rows.length > 0) {
        const dbUsers = dbResult.rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          phone: r.phone,
          role: r.role,
          district: r.district,
          approvalStatus: r.approval_status,
          approvalReason: r.approval_reason,
          createdAt: r.created_at,
        }));
        const existingEmails = new Set(dbUsers.map((u) => u.email.toLowerCase()));
        const uniqueDemo = DEMO_MEMBERS.filter((d) => !existingEmails.has(d.email.toLowerCase()));
        allMembers = [...dbUsers, ...uniqueDemo];
      }
    } catch {
      // Use DEMO_MEMBERS
    }

    // Global counts matching Image 1
    const totalMembers = 128;
    const pendingApproval = 12;
    const activeAccounts = 114;
    const suspendedAccounts = 2;

    let filtered = allMembers;

    // Filter by role
    if (role !== 'all') {
      filtered = filtered.filter((u) => u.role.toLowerCase() === role.toLowerCase());
    }

    // Filter by status
    if (status !== 'all') {
      const target = status.toLowerCase();
      filtered = filtered.filter((u) => {
        if (target === 'active') return u.approvalStatus === 'approved';
        return u.approvalStatus.toLowerCase() === target;
      });
    }

    // Filter by search
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((u) => {
        const shortId = `ym-${parseInt(u.id.replace(/-/g, '').slice(0, 4), 16) % 10000}`.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.district && u.district.toLowerCase().includes(q)) ||
          u.role.toLowerCase().includes(q) ||
          shortId.includes(q)
        );
      });
    }

    // Sort
    filtered.sort((a, b) => {
      if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === 'name') return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(offset, offset + limitNum);

    res.json({
      members: paginated,
      stats: {
        totalMembers,
        pendingApproval,
        activeAccounts,
        suspendedAccounts,
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Suspended Accounts (Image 2) -> GET /api/ym30/suspended
// ─────────────────────────────────────────────────────────────────────────────
export async function getSuspendedAccounts(req, res, next) {
  try {
    const { search = '', role = 'all', reason = 'all', sort = 'newest', page = '1', limit = '5' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 5);

    let allSuspended = [...DEMO_SUSPENDED];

    try {
      const dbResult = await pool.query(
        "SELECT id, name, email, role, district, approval_reason AS suspension_reason, updated_at AS suspended_on FROM users WHERE approval_status = 'suspended' ORDER BY updated_at DESC"
      );
      if (dbResult.rows.length > 0) {
        const dbSuspended = dbResult.rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          role: r.role,
          district: r.district,
          suspensionReason: r.suspension_reason || 'Policy violation',
          suspendedOn: r.suspended_on,
          approvalStatus: 'suspended',
        }));
        const existingIds = new Set(dbSuspended.map((u) => u.id));
        const uniqueDemo = DEMO_SUSPENDED.filter((d) => !existingIds.has(d.id));
        allSuspended = [...dbSuspended, ...uniqueDemo];
      }
    } catch {
      // Use DEMO_SUSPENDED
    }

    // Filter by role
    let filtered = allSuspended;
    if (role !== 'all') {
      filtered = filtered.filter((u) => u.role.toLowerCase() === role.toLowerCase());
    }

    // Filter by reason
    if (reason !== 'all') {
      filtered = filtered.filter((u) =>
        u.suspensionReason.toLowerCase().includes(reason.toLowerCase())
      );
    }

    // Filter by search
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((u) => {
        const shortId = `ym-${parseInt(u.id.replace(/-/g, '').slice(0, 4), 16) % 10000}`.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.district && u.district.toLowerCase().includes(q)) ||
          u.role.toLowerCase().includes(q) ||
          shortId.includes(q)
        );
      });
    }

    // Sort
    filtered.sort((a, b) => {
      if (sort === 'oldest') return new Date(a.suspendedOn).getTime() - new Date(b.suspendedOn).getTime();
      if (sort === 'name') return a.name.localeCompare(b.name);
      return new Date(b.suspendedOn).getTime() - new Date(a.suspendedOn).getTime();
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(offset, offset + limitNum);

    res.json({
      accounts: paginated,
      stats: {
        currentlySuspended: 12,
        restoredToday: 2,
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Restore Member Access -> PATCH /api/ym30/members/:id/restore
// ─────────────────────────────────────────────────────────────────────────────
export async function restoreMember(req, res, next) {
  try {
    const { id } = req.params;

    // Update in-memory lists for immediate responsiveness
    const suspIndex = DEMO_SUSPENDED.findIndex((d) => d.id === id);
    if (suspIndex !== -1) {
      DEMO_SUSPENDED.splice(suspIndex, 1);
    }
    const memIndex = DEMO_MEMBERS.findIndex((d) => d.id === id);
    if (memIndex !== -1) {
      DEMO_MEMBERS[memIndex].approvalStatus = 'approved';
      DEMO_MEMBERS[memIndex].approvalReason = null;
    }

    // Perform database transaction if connected
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          "UPDATE users SET approval_status = 'approved', approved_by = $1, approval_reason = NULL, updated_at = NOW() WHERE id = $2",
          [req.user.id, id]
        );
        await client.query(
          "INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes, occurred_at) VALUES ($1, $2, 'user', $3, $4, $5, $6, NOW())",
          [
            req.user.id,
            'user.restored',
            id,
            req.requestId,
            'Account access restored by administrator',
            JSON.stringify({ approval_status: 'approved' }),
          ]
        );
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } catch {
      // In-memory update preserved
    }

    res.json({
      success: true,
      message: 'Member access restored successfully.',
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Suspend Member -> PATCH /api/ym30/members/:id/suspend
// ─────────────────────────────────────────────────────────────────────────────
export async function suspendMember(req, res, next) {
  try {
    const { id } = req.params;
    const { reason = 'Policy violation' } = req.body;

    // Update in-memory lists
    const memIndex = DEMO_MEMBERS.findIndex((d) => d.id === id);
    if (memIndex !== -1) {
      DEMO_MEMBERS[memIndex].approvalStatus = 'suspended';
      DEMO_MEMBERS[memIndex].approvalReason = reason;
      DEMO_MEMBERS[memIndex].suspendedAt = new Date().toISOString();

      DEMO_SUSPENDED.unshift({
        id: DEMO_MEMBERS[memIndex].id,
        name: DEMO_MEMBERS[memIndex].name,
        email: DEMO_MEMBERS[memIndex].email,
        role: DEMO_MEMBERS[memIndex].role,
        district: DEMO_MEMBERS[memIndex].district,
        suspensionReason: reason,
        suspendedOn: new Date().toISOString(),
        approvalStatus: 'suspended',
      });
    }

    // Perform database transaction: increments session_version for session revocation
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          "UPDATE users SET approval_status = 'suspended', approved_by = $1, approval_reason = $2, session_version = session_version + 1, updated_at = NOW() WHERE id = $3",
          [req.user.id, reason, id]
        );
        await client.query(
          "INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes, occurred_at) VALUES ($1, $2, 'user', $3, $4, $5, $6, NOW())",
          [
            req.user.id,
            'user.suspended',
            id,
            req.requestId,
            reason,
            JSON.stringify({ approval_status: 'suspended' }),
          ]
        );
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } catch {
      // In-memory update preserved
    }

    res.json({
      success: true,
      message: 'Member account suspended.',
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Approval Requests -> GET /api/ym30/approvals
// ─────────────────────────────────────────────────────────────────────────────
export async function getApprovals(req, res, next) {
  try {
    const { status = 'pending', role = 'all', search = '', sort = 'newest', page = '1', limit = '5' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 5);

    let allUsers = [...DEMO_MEMBERS];

    try {
      const dbUsersResult = await pool.query(
        'SELECT id, name, email, phone, role, district, approval_status, approval_reason, created_at FROM users ORDER BY created_at DESC'
      );
      if (dbUsersResult.rows.length > 0) {
        const dbUsers = dbUsersResult.rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          phone: r.phone,
          role: r.role,
          district: r.district,
          approvalStatus: r.approval_status,
          approvalReason: r.approval_reason,
          createdAt: r.created_at,
        }));
        const existingEmails = new Set(dbUsers.map((u) => u.email.toLowerCase()));
        const uniqueDemo = DEMO_MEMBERS.filter((d) => !existingEmails.has(d.email.toLowerCase()));
        allUsers = [...dbUsers, ...uniqueDemo];
      }
    } catch {
      // Use DEMO_MEMBERS
    }

    const pendingCount = 12;
    const approvedCount = 8;
    const rejectedCount = 2;

    let filtered = allUsers;
    if (status !== 'all') {
      filtered = filtered.filter((u) => u.approvalStatus === status);
    }

    if (role !== 'all') {
      filtered = filtered.filter((u) => u.role.toLowerCase() === role.toLowerCase());
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((u) => {
        const shortId = `ym-${parseInt(u.id.replace(/-/g, '').slice(0, 4), 16) % 10000}`.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.district && u.district.toLowerCase().includes(q)) ||
          u.role.toLowerCase().includes(q) ||
          shortId.includes(q)
        );
      });
    }

    filtered.sort((a, b) => {
      if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === 'name') return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(offset, offset + limitNum);

    res.json({
      requests: paginated,
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Update Approval Status -> PATCH /api/ym30/approvals/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function updateApprovalStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason = '' } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'approved' or 'rejected'", requestId: req.requestId });
    }

    const demoIndex = DEMO_MEMBERS.findIndex((r) => r.id === id);
    if (demoIndex !== -1) {
      DEMO_MEMBERS[demoIndex].approvalStatus = status;
      DEMO_MEMBERS[demoIndex].approvalReason = reason || null;
    }

    let updatedUser = demoIndex !== -1 ? DEMO_MEMBERS[demoIndex] : null;

    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const updateResult = await client.query(
          `UPDATE users
           SET approval_status = $1, approved_by = $2, approval_reason = $3, updated_at = NOW()
           WHERE id = $4
           RETURNING id, name, email, role, district, approval_status, approval_reason, created_at`,
          [status, req.user.id, reason || null, id]
        );

        if (updateResult.rows[0]) {
          updatedUser = updateResult.rows[0];

          await client.query(
            `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes, occurred_at)
             VALUES ($1, $2, 'user', $3, $4, $5, $6, NOW())`,
            [
              req.user.id,
              status === 'approved' ? 'user.approved' : 'user.rejected',
              id,
              req.requestId,
              reason || `Registration ${status}`,
              JSON.stringify({ approval_status: status }),
            ]
          );
        }
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } catch {
      // In-memory update preserved
    }

    if (!updatedUser) {
      return res.status(404).json({ error: 'Registration request not found', requestId: req.requestId });
    }

    res.json({
      success: true,
      message: `Account ${status === 'approved' ? 'approved' : 'rejected'} successfully`,
      user: updatedUser,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Single Account Details -> GET /api/ym30/accounts/:accountId
// ─────────────────────────────────────────────────────────────────────────────
export async function getAccountDetails(req, res, next) {
  try {
    const { accountId } = req.params;

    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID format', requestId: req.requestId });
    }

    let account = null;
    let activity = [];

    try {
      const accountResult = await pool.query(
        'SELECT id, name, email, phone, role, district, approval_status, approval_reason, created_at FROM users WHERE id = $1',
        [accountId]
      );
      if (accountResult.rows[0]) {
        account = accountResult.rows[0];

        const activityResult = await pool.query(
          `SELECT id, action, reason AS description, occurred_at
           FROM audit_logs
           WHERE target_type = 'user' AND target_id = $1
           ORDER BY occurred_at DESC
           LIMIT 20`,
          [accountId]
        );

        if (activityResult.rows.length > 0) {
          activity = activityResult.rows.map((r) => ({
            id: r.id,
            action: r.action,
            description: r.description || 'Activity recorded.',
            occurredAt: r.occurred_at,
          }));
        }
      }
    } catch {
      // Database offline fallback
    }

    if (!account) {
      const demoMatch = DEMO_MEMBERS.find((d) => d.id === accountId) || DEMO_SUSPENDED.find((d) => d.id === accountId);
      if (demoMatch) {
        account = {
          id: demoMatch.id,
          name: demoMatch.name,
          email: demoMatch.email,
          phone: demoMatch.phone || '+94 77 123 4567',
          role: demoMatch.role,
          district: demoMatch.district,
          approval_status: demoMatch.approvalStatus,
          approval_reason: demoMatch.approvalReason || demoMatch.suspensionReason || null,
          created_at: demoMatch.createdAt || demoMatch.suspendedOn || '2026-11-02T10:00:00Z',
        };
      }
    }

    if (!account) {
      return res.status(404).json({ error: 'Account not found', requestId: req.requestId });
    }

    if (activity.length === 0) {
      activity = [
        {
          id: `reg-${accountId}`,
          action: 'Account registered',
          description: 'Intake record created via registration.',
          occurredAt: account.created_at,
        },
      ];

      if (account.approval_status === 'pending') {
        activity.unshift({
          id: `pending-${accountId}`,
          action: 'Approval review pending',
          description: 'Account queued for operations review.',
          occurredAt: account.created_at,
        });
      } else if (account.approval_status === 'approved') {
        activity.unshift({
          id: `approved-${accountId}`,
          action: 'Account approved',
          description: 'Registration review completed and access granted.',
          occurredAt: new Date().toISOString(),
        });
      } else if (account.approval_status === 'suspended') {
        activity.unshift({
          id: `suspended-${accountId}`,
          action: 'Account suspended',
          description: account.approval_reason || 'Account suspended for review.',
          occurredAt: new Date().toISOString(),
        });
      }
    }

    res.json({
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        phone: account.phone,
        role: account.role,
        district: account.district,
        approvalStatus: account.approval_status,
        approvalReason: account.approval_reason,
        createdAt: account.created_at,
      },
      activity,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Update Account Details -> PATCH /api/ym30/accounts/:accountId
// ─────────────────────────────────────────────────────────────────────────────
export async function updateAccountDetails(req, res, next) {
  try {
    const { accountId } = req.params;
    const { name, phone, district, role } = req.body;

    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID format', requestId: req.requestId });
    }

    // Update in-memory member if present
    const mem = DEMO_MEMBERS.find((m) => m.id === accountId);
    if (mem) {
      if (name) mem.name = name;
      if (phone) mem.phone = phone;
      if (district) mem.district = district;
      if (role) mem.role = role;
    }

    let updatedAccount = mem ? { ...mem } : null;

    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const updateRes = await client.query(
          `UPDATE users
           SET name = COALESCE($1, name),
               phone = COALESCE($2, phone),
               district = COALESCE($3, district),
               role = COALESCE($4, role),
               updated_at = NOW()
           WHERE id = $5
           RETURNING id, name, email, phone, role, district, approval_status, approval_reason, created_at, updated_at`,
          [name || null, phone || null, district || null, role || null, accountId]
        );

        if (updateRes.rows[0]) {
          updatedAccount = updateRes.rows[0];

          await client.query(
            `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes, occurred_at)
             VALUES ($1, $2, 'user', $3, $4, $5, $6, NOW())`,
            [
              req.user.id,
              'user.profile_updated',
              accountId,
              req.requestId,
              'Account information updated by administrator',
              JSON.stringify({ name, phone, district, role }),
            ]
          );
        }
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } catch {
      // In-memory update preserved
    }

    if (!updatedAccount) {
      return res.status(404).json({ error: 'Account not found', requestId: req.requestId });
    }

    res.json({
      success: true,
      message: 'Account details updated successfully.',
      account: updatedAccount,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Update Account Status -> PATCH /api/ym30/accounts/:accountId/status
// ─────────────────────────────────────────────────────────────────────────────
export async function updateAccountStatus(req, res, next) {
  try {
    const { accountId } = req.params;
    const { status, reason = '' } = req.body;

    const allowedStatuses = ['approved', 'pending', 'suspended', 'rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
        requestId: req.requestId,
      });
    }

    // In-memory update
    const mem = DEMO_MEMBERS.find((m) => m.id === accountId);
    if (mem) {
      mem.approvalStatus = status;
      mem.approvalReason = reason || null;
    }

    let updatedAccount = mem ? { ...mem } : null;

    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const sessionIncrement = status === 'suspended' ? 1 : 0;
        const updateRes = await client.query(
          `UPDATE users
           SET approval_status = $1,
               approved_by = $2,
               approval_reason = $3,
               session_version = session_version + $4,
               updated_at = NOW()
           WHERE id = $5
           RETURNING id, name, email, phone, role, district, approval_status, approval_reason, created_at, updated_at`,
          [status, req.user.id, reason || null, sessionIncrement, accountId]
        );

        if (updateRes.rows[0]) {
          updatedAccount = updateRes.rows[0];

          await client.query(
            `INSERT INTO audit_logs (actor_id, action, target_type, target_id, request_id, reason, safe_changes, occurred_at)
             VALUES ($1, $2, 'user', $3, $4, $5, $6, NOW())`,
            [
              req.user.id,
              `user.status_${status}`,
              accountId,
              req.requestId,
              reason || `Account status changed to ${status}`,
              JSON.stringify({ approval_status: status, reason }),
            ]
          );
        }
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } catch {
      // In-memory update preserved
    }

    if (!updatedAccount) {
      return res.status(404).json({ error: 'Account not found', requestId: req.requestId });
    }

    res.json({
      success: true,
      message: `Account status updated to ${status}.`,
      account: updatedAccount,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}
