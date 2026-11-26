import pool from '../../config/db.js';

export async function findEligibleComparisonListings(ids) {
  const { rows } = await pool.query(
    `SELECT l.id::text AS listing_id,
            b.farmer_id::text AS supplier_id,
            supplier.name AS supplier_name,
            f.district,
            c.id::text AS crop_id,
            c.name AS crop_name,
            l.unit_price_cents::text AS price_per_kg_cents,
            GREATEST(0::numeric, LEAST(l.offered_kg, ba.available_kg))::text AS available_kg,
            g.name AS grade,
            COALESCE(b.actual_harvest_date, b.planned_harvest_date)::text AS harvest_start,
            COALESCE(b.actual_harvest_date, b.planned_harvest_date)::text AS harvest_end
       FROM listings l
       JOIN harvest_batches b ON b.id = l.batch_id
       JOIN batch_availability ba ON ba.batch_id = b.id
       JOIN farms f ON f.id = b.farm_id AND f.farmer_id = b.farmer_id
       JOIN users supplier ON supplier.id = b.farmer_id
       JOIN crops c ON c.id = b.crop_id
       JOIN grades g ON g.id = b.grade_id
      WHERE l.id = ANY($1::uuid[])
        AND l.status = 'active'
        AND l.valid_from <= now()
        AND l.valid_until > now()
        AND b.status IN ('ready','harvested')
        AND ba.available_kg > 0
        AND f.status = 'active'
        AND supplier.role = 'farmer'
        AND supplier.approval_status = 'approved'
        AND c.active = true
        AND g.active = true`,
    [ids],
  );
  return rows;
}
