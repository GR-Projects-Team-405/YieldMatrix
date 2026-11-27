import pool from '../../config/db.js';
import * as dbService from './dbService.js';

// YM26 · Shermi Weerasinghe · Admin operations

export async function getStatus(req, res, next) {
  try {
    const userId = req.user?.id || '44444444-4444-4444-4444-444444444444';
    const userRole = req.user?.role || 'admin';
    const userName = req.user?.name || 'Demo Admin';

    if (process.env.DATABASE_URL) {
      try {
        const { rows } = await pool.query(
          'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
          [userId, userRole, 'approved']
        );
        if (rows[0]) {
          return res.json({
            module: 'YM26',
            owner: 'Shermi Weerasinghe',
            status: 'active',
            database: 'connected',
            user: rows[0],
            requestId: req.requestId
          });
        }
      } catch (dbErr) {
        console.warn('[YM26] getStatus database check skipped:', dbErr.message);
      }
    }

    return res.json({
      module: 'YM26',
      owner: 'Shermi Weerasinghe',
      status: 'active',
      database: 'standalone_mode',
      user: { id: userId, name: userName, role: userRole },
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// ORDER OPERATIONS
// ==========================================

export async function getOrdersStats(req, res, next) {
  try {
    const stats = await dbService.getOrdersStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
}

export async function getOrders(req, res, next) {
  try {
    const data = await dbService.getOrders(req.query);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function getOrderById(req, res, next) {
  try {
    const order = await dbService.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found', requestId: req.requestId });
    res.json(order);
  } catch (error) {
    next(error);
  }
}

export async function cancelOrder(req, res, next) {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Cancellation reason is required per SRS FR-ORD-04', requestId: req.requestId });
    }
    const adminId = req.user?.id || '44444444-4444-4444-4444-444444444444';
    const order = await dbService.cancelOrder(req.params.id, reason.trim(), adminId);
    res.json({ message: 'Order cancelled successfully', order, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}

export async function exportOrders(req, res, next) {
  try {
    const { orders } = await dbService.getOrders({ limit: 500 });
    const csvRows = [
      ['Order ID', 'Buyer', 'Location', 'Commodity', 'Grade', 'Quantity', 'Status', 'Delivery Date'].join(',')
    ];
    for (const o of orders) {
      csvRows.push([
        `"${o.id}"`,
        `"${o.buyer}"`,
        `"${o.buyerLocation}"`,
        `"${o.commodity}"`,
        `"${o.grade}"`,
        `"${o.quantityDisplay}"`,
        `"${o.statusLabel}"`,
        `"${o.deliveryDueDisplay}"`
      ].join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="yieldmatrix_orders_export.csv"');
    res.status(200).send(csvRows.join('\n'));
  } catch (error) {
    next(error);
  }
}

// ==========================================
// DISPATCH & DRIVER ASSIGNMENT
// ==========================================

export async function getDispatchStats(req, res, next) {
  try {
    const stats = await dbService.getDispatchStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
}

export async function getDispatchQueue(req, res, next) {
  try {
    const queue = await dbService.getDispatchQueue(req.query);
    res.json({ queue, total: queue.length });
  } catch (error) {
    next(error);
  }
}

export async function getActiveTrips(req, res, next) {
  try {
    const trips = await dbService.getActiveTrips();
    res.json({ trips, total: trips.length });
  } catch (error) {
    next(error);
  }
}

export async function getAvailableDriversAndVehicles(req, res, next) {
  try {
    const drivers = await dbService.getAvailableDriversAndVehicles();
    res.json({ drivers });
  } catch (error) {
    next(error);
  }
}

export async function getOrderRoute(req, res, next) {
  try {
    const route = await dbService.getOrderRoute(req.params.orderId);
    res.json(route);
  } catch (error) {
    next(error);
  }
}

export async function assignDispatch(req, res, next) {
  try {
    const { orderId, driverId, vehicleId, plannedLoadKg } = req.body;
    if (!orderId || !driverId || !vehicleId) {
      return res.status(400).json({ error: 'orderId, driverId, and vehicleId are required', requestId: req.requestId });
    }
    const adminId = req.user?.id || '44444444-4444-4444-4444-444444444444';
    const result = await dbService.assignDispatch(req.body, adminId);
    res.json({ message: 'Driver and vehicle assigned successfully', ...result, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// INCIDENT REVIEW
// ==========================================

export async function getIncidentsStats(req, res, next) {
  try {
    const stats = await dbService.getIncidentsStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
}

export async function getIncidents(req, res, next) {
  try {
    const incidents = await dbService.getIncidents(req.query);
    res.json({ incidents, total: incidents.length });
  } catch (error) {
    next(error);
  }
}

export async function getIncidentById(req, res, next) {
  try {
    const incident = await dbService.getIncidentById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident not found', requestId: req.requestId });
    res.json(incident);
  } catch (error) {
    next(error);
  }
}

export async function resolveIncident(req, res, next) {
  try {
    const { resolution } = req.body;
    if (!resolution || !resolution.trim()) {
      return res.status(400).json({ error: 'Resolution details are required', requestId: req.requestId });
    }
    const adminId = req.user?.id || '44444444-4444-4444-4444-444444444444';
    const incident = await dbService.resolveIncident(req.params.id, req.body, adminId);
    res.json({ message: 'Incident resolved successfully', incident, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}

export async function exportIncidents(req, res, next) {
  try {
    const incidents = await dbService.getIncidents({});
    const csvRows = [
      ['Incident ID', 'Title', 'Category', 'Linked Record', 'Priority', 'Assigned To', 'Status', 'SLA'].join(',')
    ];
    for (const inc of incidents) {
      csvRows.push([
        `"${inc.id}"`,
        `"${inc.title}"`,
        `"${inc.category}"`,
        `"${inc.linkedRecord}"`,
        `"${inc.priorityLabel}"`,
        `"${inc.assignedTo}"`,
        `"${inc.statusLabel}"`,
        `"${inc.slaText}"`
      ].join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="yieldmatrix_incidents_export.csv"');
    res.status(200).send(csvRows.join('\n'));
  } catch (error) {
    next(error);
  }
}

// ==========================================
// DISPUTE RESOLUTION
// ==========================================

export async function getDisputesStats(req, res, next) {
  try {
    const stats = await dbService.getDisputesStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
}

export async function getDisputes(req, res, next) {
  try {
    const disputes = await dbService.getDisputes(req.query);
    res.json({ disputes, total: disputes.length });
  } catch (error) {
    next(error);
  }
}

export async function getDisputeById(req, res, next) {
  try {
    const dispute = await dbService.getDisputeById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found', requestId: req.requestId });
    res.json(dispute);
  } catch (error) {
    next(error);
  }
}

export async function saveDisputeDraft(req, res, next) {
  try {
    const result = await dbService.saveDisputeDraft(req.params.id, req.body);
    res.json({ message: 'Dispute ruling draft saved', ...result, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}

export async function issueDisputeRuling(req, res, next) {
  try {
    const { verifiedAcceptedKg, refundCents, rationale } = req.body;
    if (verifiedAcceptedKg === undefined || !rationale || !rationale.trim()) {
      return res.status(400).json({ error: 'verifiedAcceptedKg and rationale are mandatory per SRS FR-ORD-09', requestId: req.requestId });
    }
    const adminId = req.user?.id || '44444444-4444-4444-4444-444444444444';
    const result = await dbService.issueDisputeRuling(req.params.id, req.body, adminId);
    res.json({ message: 'Final ruling issued and financial adjustment posted successfully', ...result, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}
