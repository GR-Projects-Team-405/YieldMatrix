import pool from '../../config/db.js';
import crypto from 'crypto'; // To generate unique operation keys

// 1. GET all demands for the logged-in buyer
export async function getMyDemands(req, res, next) {
  try {
    if (req.user.role !== 'buyer') {
      return res.status(403).json({ error: 'Access denied. Buyers only.', requestId: req.requestId });
    }

    // We JOIN crops and grades tables so we get the names (e.g., "Tomato", "Grade A") instead of just UUIDs
    const query = `
      SELECT d.id, d.quantity_kg, d.destination, d.status, d.created_at, 
             c.name AS crop_name, g.name AS grade_name
      FROM demands d
      JOIN crops c ON d.crop_id = c.id
      JOIN grades g ON d.grade_id = g.id
      WHERE d.buyer_id = $1
      ORDER BY d.created_at DESC
    `;
    const { rows } = await pool.query(query, [req.user.id]);
    res.json({ demands: rows, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}

// 2. POST create a new demand
// 2. POST create a new demand
// 2. POST create a new demand
export async function createDemand(req, res, next) {
  try {
    console.log('🔍 YM13 RECEIVED BODY:', JSON.stringify(req.body));
    
    if (req.user.role !== 'buyer') {
      return res.status(403).json({ error: 'Access denied.', requestId: req.requestId });
    }

    const { crop_name, grade_name, quantity_kg, destination, destination_district, delivery_from, delivery_until, budget_lkr, allow_partial } = req.body;

    // 1. Look up the Crop ID by name (case-insensitive to be safe)
    const cropRes = await pool.query('SELECT id FROM crops WHERE lower(trim(name)) = lower(trim($1))', [crop_name]);
    if (!cropRes.rows[0]) {
      return res.status(400).json({ error: 'Invalid crop name.', requestId: req.requestId });
    }
    const crop_id = cropRes.rows[0].id;

    // 2. Look up the Grade ID by name (case-insensitive to be safe)
    const gradeRes = await pool.query('SELECT id FROM grades WHERE lower(trim(name)) = lower(trim($1))', [grade_name]);
    if (!gradeRes.rows[0]) {
      return res.status(400).json({ error: 'Invalid grade name.', requestId: req.requestId });
    }
    const grade_id = gradeRes.rows[0].id;

    // 3. Convert LKR to Cents safely (handles empty strings)
    let budget_cents = null;
    if (budget_lkr && budget_lkr.trim() !== '') {
      const parsedBudget = parseFloat(budget_lkr);
      if (!isNaN(parsedBudget)) {
        budget_cents = Math.round(parsedBudget * 100);
      }
    }
    
    // Set expires_at to 7 days from now
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 7);

    // 4. Insert the demand 
    // NOTE: 'operation_key' was removed because it does not exist in the 'demands' table schema
    const query = `
      INSERT INTO demands (
        buyer_id, crop_id, grade_id, quantity_kg, destination, destination_district, 
        delivery_from, delivery_until, budget_cents, allow_partial, status, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open', $11)
      RETURNING id, crop_id, grade_id, quantity_kg, destination, status, created_at
    `;
    
    const values = [
      req.user.id, crop_id, grade_id, quantity_kg, destination, destination_district,
      delivery_from, delivery_until, budget_cents, allow_partial, expires_at
    ];

    const { rows } = await pool.query(query, values);
    
    // Success! Return the created demand
    res.status(201).json({ demand: rows[0], requestId: req.requestId });
  } catch (error) {
    // This will print the exact database error to your VS Code terminal if it fails again
    console.error('❌ YM13 createDemand Database Error:', error);
    next(error);
  }
}
// 3. GET details of one specific demand
// 3. GET details of one specific demand
export async function getDemandDetails(req, res, next) {
  try {
    const { id } = req.params;
    
    // Join with crops and grades to get readable names
    const query = `
      SELECT d.*, c.name AS crop_name, g.name AS grade_name
      FROM demands d
      JOIN crops c ON d.crop_id = c.id
      JOIN grades g ON d.grade_id = g.id
      WHERE d.id = $1 AND d.buyer_id = $2
    `;
    const { rows } = await pool.query(query, [id, req.user.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Demand not found or access denied.', requestId: req.requestId });
    }
    res.json({ demand: rows[0], requestId: req.requestId });
  } catch (error) {
    console.error('❌ YM13 getDemandDetails Error:', error);
    next(error);
  }
}
// 4. PATCH edit an open demand
// 4. PATCH edit an open demand
export async function updateDemand(req, res, next) {
  try {
    const { id } = req.params;
    const { quantity_kg, destination, destination_district, delivery_from, delivery_until, budget_lkr, allow_partial } = req.body;

    // Safe budget conversion (handles empty string)
    let budget_cents = null;
    if (budget_lkr && String(budget_lkr).trim() !== '') {
      const parsed = parseFloat(budget_lkr);
      if (!isNaN(parsed)) budget_cents = Math.round(parsed * 100);
    }

    // Only editable while the demand is still 'open'
    const query = `
      UPDATE demands
      SET quantity_kg = $1, destination = $2, destination_district = $3,
          delivery_from = $4, delivery_until = $5, budget_cents = $6, allow_partial = $7
      WHERE id = $8 AND buyer_id = $9 AND status = 'open'
      RETURNING id, quantity_kg, destination, status
    `;

    const { rows } = await pool.query(query, [
      quantity_kg, destination, destination_district,
      delivery_from, delivery_until, budget_cents, allow_partial, id, req.user.id
    ]);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Cannot edit. Demand not found, not yours, or no longer open.', requestId: req.requestId });
    }
    res.json({ demand: rows[0], requestId: req.requestId });
  } catch (error) {
    console.error('❌ YM13 updateDemand Error:', error);
    next(error);
  }
}

// 5. GET responses (offers) for a specific demand
export async function getDemandResponses(req, res, next) {
  try {
    const { id } = req.params; // This is the demandId
    
    // 1. Verify the buyer owns this demand
    const demandCheck = await pool.query('SELECT id FROM demands WHERE id = $1 AND buyer_id = $2', [id, req.user.id]);
    if (demandCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Demand not found or access denied.', requestId: req.requestId });
    }

    // 2. Fetch all offers linked to this demand
    // We JOIN users, harvest_batches, and farms to get readable names
    const query = `
      SELECT o.id, o.quantity_kg, o.unit_price_cents, o.status, o.created_at,
             u.name AS farmer_name, f.name AS farm_name, hb.planned_harvest_date
      FROM offers o
      JOIN users u ON o.farmer_id = u.id
      JOIN harvest_batches hb ON o.batch_id = hb.id
      JOIN farms f ON hb.farm_id = f.id
      WHERE o.demand_id = $1
      ORDER BY o.unit_price_cents ASC -- Show cheapest offers first!
    `;
    const { rows } = await pool.query(query, [id]);
    
    res.json({ responses: rows, requestId: req.requestId });
  } catch (error) {
    console.error('❌ YM13 getDemandResponses Error:', error);
    next(error);
  }
}

// 6. PATCH accept or reject an offer
export async function updateOfferStatus(req, res, next) {
  try {
    const { demandId, offerId } = req.params;
    const { action } = req.body; // action will be 'accepted' or 'rejected'

    if (!['accepted', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action.', requestId: req.requestId });
    }

    // 1. Verify the buyer owns the demand that this offer belongs to
    const checkQuery = `
      SELECT o.id FROM offers o 
      JOIN demands d ON o.demand_id = d.id 
      WHERE o.id = $1 AND d.id = $2 AND d.buyer_id = $3
    `;
    const checkRes = await pool.query(checkQuery, [offerId, demandId, req.user.id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found or access denied.', requestId: req.requestId });
    }

    // 2. Update the offer status
    const updateQuery = `
      UPDATE offers SET status = $1 WHERE id = $2 RETURNING id, status
    `;
    const { rows } = await pool.query(updateQuery, [action, offerId]);

    res.json({ offer: rows[0], requestId: req.requestId });
  } catch (error) {
    console.error('❌ YM13 updateOfferStatus Error:', error);
    next(error);
  }
}