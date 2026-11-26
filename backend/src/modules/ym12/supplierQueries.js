import pool from '../../config/db.js';

export async function findApprovedSupplier(supplierId) {
  const { rows } = await pool.query(
    `SELECT u.id::text AS supplier_id,
            u.name AS supplier_name,
            u.created_at AS member_since,
            COALESCE(f.district, u.district) AS district
       FROM users u
       LEFT JOIN LATERAL (
         SELECT district
           FROM farms
          WHERE farmer_id = u.id
            AND status = 'active'
          ORDER BY created_at, id
          LIMIT 1
       ) f ON TRUE
      WHERE u.id = $1::uuid
        AND u.role = 'farmer'
         AND u.approval_status = 'approved'`,
    [supplierId],
  );
  return rows[0] || null;
}

export async function findSupplierListings(supplierId) {
  const { rows } = await pool.query(
    `SELECT l.id::text AS listing_id,
            l.unit_price_cents::text AS price_per_kg_cents,
            GREATEST(0::numeric, ba.available_kg)::text AS available_kg,
            COALESCE(b.actual_harvest_date, b.planned_harvest_date)::text AS harvest_start,
            COALESCE(b.actual_harvest_date, b.planned_harvest_date)::text AS harvest_end,
            c.name AS crop_name,
            g.name AS grade_name,
            f.district,
            l.created_at
       FROM listings l
       JOIN harvest_batches b ON b.id = l.batch_id
       JOIN batch_availability ba ON ba.batch_id = b.id
       JOIN farms f ON f.id = b.farm_id AND f.farmer_id = b.farmer_id
       JOIN crops c ON c.id = b.crop_id
       JOIN grades g ON g.id = b.grade_id
       JOIN users supplier ON supplier.id = b.farmer_id
      WHERE b.farmer_id = $1::uuid
        AND l.status = 'active'
        AND l.valid_from <= now()
        AND l.valid_until > now()
        AND b.status IN ('ready','harvested')
        AND f.status = 'active'
        AND supplier.role = 'farmer'
        AND supplier.approval_status = 'approved'
        AND c.active = true
        AND g.active = true
        AND ba.available_kg > 0
      ORDER BY l.created_at DESC, l.id`,
    [supplierId],
  );
  return rows;
}
