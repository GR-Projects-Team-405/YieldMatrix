import pool from '../../config/db.js';

// YM18 · Nipuni Thakshila · Buyer orders

/** Maps raw PostgreSQL order status to user-facing status */
export function mapOrderStatus(status) {
  switch (status) {
    case 'draft':
    case 'awaiting_suppliers':
      return 'Pending';
    case 'ready_to_confirm':
    case 'confirmed':
      return 'Processing';
    case 'in_fulfilment':
      return 'In Transit';
    case 'delivered':
    case 'closed':
      return 'Delivered';
    case 'cancelled':
      return 'Canceled';
    default:
      return 'Pending';
  }
}

/** Formats date into "3 Nov 2026 - 12.45 PM" format */
export function formatOrderDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getUTCDate();
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  
  let hours = d.getUTCHours();
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  
  return `${day} ${month} ${year} - ${hours}.${minutes} ${ampm}`;
}

/** Formats operation_key or UUID into "YM - 1001" style */
export function formatOrderCode(operationKey, id) {
  if (operationKey) {
    const parts = operationKey.split(':');
    const lastPart = parts[parts.length - 1];
    const match = lastPart.match(/^YM[-_]?(\d+)/i) || operationKey.match(/YM[-_]?(\d{4,})/i);
    if (match) return `YM - ${match[1]}`;
  }
  if (id) {
    return `YM - ${id.slice(0, 4).toUpperCase()}`;
  }
  return 'YM - 1000';
}

export async function getStatus(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1 AND role = $2 AND approval_status = $3',
      [req.user.id, req.user.role, 'approved']
    );
    if (!rows[0]) return res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
    return res.json({ module: 'YM18', owner: 'Nipuni Thakshila', status: 'ready', user: rows[0], requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ym18/orders
 * Retrieves logged-in buyer's orders with search, status filters, date filters and pagination
 */
export async function getOrders(req, res, next) {
  try {
    const buyerId = req.user.id;
    const { search = '', status = 'all', date = '', page = 1, limit = 10 } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
    const offset = (parsedPage - 1) * parsedLimit;

    // Base conditions
    const conditions = ['o.buyer_id = $1'];
    const params = [buyerId];
    let paramIndex = 2;

    // Search filter (Order ID/code, Crop name, Destination)
    if (search.trim()) {
      const searchPattern = `%${search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(o.operation_key) LIKE $${paramIndex} OR
        LOWER(o.destination) LIKE $${paramIndex} OR
        LOWER(o.destination_district) LIKE $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM allocations a2
          JOIN harvest_batches hb2 ON hb2.id = a2.batch_id
          JOIN crops c2 ON c2.id = hb2.crop_id
          WHERE a2.order_id = o.id AND LOWER(c2.name) LIKE $${paramIndex}
        )
      )`);
      params.push(searchPattern);
      paramIndex++;
    }

    // Status filter
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus && normalizedStatus !== 'all') {
      if (normalizedStatus === 'pending') {
        conditions.push(`o.status IN ('draft', 'awaiting_suppliers')`);
      } else if (normalizedStatus === 'processing') {
        conditions.push(`o.status IN ('ready_to_confirm', 'confirmed')`);
      } else if (normalizedStatus === 'in transit' || normalizedStatus === 'in_transit') {
        conditions.push(`o.status = 'in_fulfilment'`);
      } else if (normalizedStatus === 'delivered') {
        conditions.push(`o.status IN ('delivered', 'closed')`);
      } else if (normalizedStatus === 'canceled' || normalizedStatus === 'cancelled') {
        conditions.push(`o.status = 'cancelled'`);
      }
    }

    // Date filter (matches creation date or delivery date)
    if (date.trim()) {
      conditions.push(`(
        DATE(o.created_at) = $${paramIndex} OR
        DATE(o.delivery_date) = $${paramIndex}
      )`);
      params.push(date.trim());
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // 1. Total count query for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      WHERE ${whereClause}
    `;
    const countRes = await pool.query(countQuery, params);
    const totalOrders = parseInt(countRes.rows[0]?.total || '0', 10);

    // 2. Main data query
    const dataQuery = `
      SELECT 
        o.id,
        o.operation_key,
        o.destination,
        o.destination_district,
        o.delivery_date,
        o.agreed_total_cents,
        o.status,
        o.cancellation_reason,
        o.created_at,
        o.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'crop_name', c.name,
              'agreed_kg', a.agreed_kg,
              'agreed_unit_price_cents', a.agreed_unit_price_cents,
              'allocation_status', a.status
            )
          ) FILTER (WHERE a.id IS NOT NULL), '[]'
        ) as items,
        COALESCE(SUM(a.agreed_kg), 0) as total_quantity_kg
      FROM orders o
      LEFT JOIN allocations a ON a.order_id = o.id
      LEFT JOIN harvest_batches hb ON hb.id = a.batch_id
      LEFT JOIN crops c ON c.id = hb.crop_id
      WHERE ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...params, parsedLimit, offset];
    const dataRes = await pool.query(dataQuery, dataParams);

    // 3. Status summary counts for filter tabs
    const statusCountsRes = await pool.query(`
      SELECT 
        COUNT(*) as all_count,
        COUNT(*) FILTER (WHERE status IN ('draft', 'awaiting_suppliers')) as pending_count,
        COUNT(*) FILTER (WHERE status IN ('ready_to_confirm', 'confirmed')) as processing_count,
        COUNT(*) FILTER (WHERE status = 'in_fulfilment') as in_transit_count,
        COUNT(*) FILTER (WHERE status IN ('delivered', 'closed')) as delivered_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as canceled_count
      FROM orders
      WHERE buyer_id = $1
    `, [buyerId]);

    const counts = {
      all: parseInt(statusCountsRes.rows[0]?.all_count || '0', 10),
      pending: parseInt(statusCountsRes.rows[0]?.pending_count || '0', 10),
      processing: parseInt(statusCountsRes.rows[0]?.processing_count || '0', 10),
      in_transit: parseInt(statusCountsRes.rows[0]?.in_transit_count || '0', 10),
      delivered: parseInt(statusCountsRes.rows[0]?.delivered_count || '0', 10),
      canceled: parseInt(statusCountsRes.rows[0]?.canceled_count || '0', 10)
    };

    // Format orders for the Figma design
    const formattedOrders = dataRes.rows.map((row) => {
      const items = Array.isArray(row.items) ? row.items : [];
      const primaryCrop = items[0]?.crop_name || 'Agricultural Produce';
      const cropSummary = items.length > 1 ? `${primaryCrop} +${items.length - 1} more` : primaryCrop;
      const totalKg = Number(row.total_quantity_kg) || items.reduce((acc, it) => acc + (Number(it.agreed_kg) || 0), 0);
      const totalAmountLkr = Number(row.agreed_total_cents) / 100;

      return {
        id: row.id,
        orderCode: formatOrderCode(row.operation_key, row.id),
        operationKey: row.operation_key,
        productName: cropSummary,
        products: items,
        quantityKg: totalKg,
        totalPriceLkr: totalAmountLkr,
        formattedTotalPrice: `LKR ${totalAmountLkr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        rawStatus: row.status,
        displayStatus: mapOrderStatus(row.status),
        orderDate: formatOrderDate(row.created_at),
        createdAt: row.created_at,
        deliveryDate: row.delivery_date,
        destination: row.destination,
        destinationDistrict: row.destination_district,
        cancellationReason: row.cancellation_reason
      };
    });

    return res.json({
      orders: formattedOrders,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: totalOrders,
        totalPages: Math.ceil(totalOrders / parsedLimit) || 1,
        from: totalOrders === 0 ? 0 : offset + 1,
        to: Math.min(offset + parsedLimit, totalOrders)
      },
      counts,
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ym18/orders/:id
 * Retrieves full details for a single order owned by the buyer
 */
export async function getOrderDetails(req, res, next) {
  try {
    const buyerId = req.user.id;
    const orderId = req.params.id;

    const orderQuery = `
      SELECT 
        o.id,
        o.operation_key,
        o.destination,
        o.destination_district,
        o.destination_latitude,
        o.destination_longitude,
        o.delivery_date,
        o.agreed_total_cents,
        o.status,
        o.cancellation_reason,
        o.created_at,
        o.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', a.id,
              'crop_name', c.name,
              'grade_name', g.name,
              'farm_name', f.name,
              'farm_district', f.district,
              'agreed_kg', a.agreed_kg,
              'agreed_unit_price_cents', a.agreed_unit_price_cents,
              'agreed_value_cents', a.agreed_value_cents,
              'committed_kg', a.committed_kg,
              'picked_up_kg', a.picked_up_kg,
              'handed_over_kg', a.handed_over_kg,
              'accepted_kg', a.accepted_kg,
              'status', a.status
            )
          ) FILTER (WHERE a.id IS NOT NULL), '[]'
        ) as items
      FROM orders o
      LEFT JOIN allocations a ON a.order_id = o.id
      LEFT JOIN harvest_batches hb ON hb.id = a.batch_id
      LEFT JOIN crops c ON c.id = hb.crop_id
      LEFT JOIN grades g ON g.id = hb.grade_id
      LEFT JOIN farms f ON f.id = hb.farm_id
      WHERE o.id = $1 AND o.buyer_id = $2
      GROUP BY o.id
    `;

    const { rows } = await pool.query(orderQuery, [orderId, buyerId]);
    if (!rows[0]) {
      return res.status(404).json({ error: 'Order not found', requestId: req.requestId });
    }

    const row = rows[0];
    const items = Array.isArray(row.items) ? row.items : [];
    const totalAmountLkr = Number(row.agreed_total_cents) / 100;
    const totalKg = items.reduce((acc, it) => acc + (Number(it.agreed_kg) || 0), 0);

    return res.json({
      order: {
        id: row.id,
        orderCode: formatOrderCode(row.operation_key, row.id),
        operationKey: row.operation_key,
        productName: items[0]?.crop_name || 'Agricultural Produce',
        products: items,
        quantityKg: totalKg,
        totalPriceLkr: totalAmountLkr,
        formattedTotalPrice: `LKR ${totalAmountLkr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        rawStatus: row.status,
        displayStatus: mapOrderStatus(row.status),
        orderDate: formatOrderDate(row.created_at),
        createdAt: row.created_at,
        deliveryDate: row.delivery_date,
        destination: row.destination,
        destinationDistrict: row.destination_district,
        cancellationReason: row.cancellation_reason
      },
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
}
