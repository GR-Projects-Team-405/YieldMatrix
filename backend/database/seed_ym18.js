import pool from '../src/config/db.js';

async function seedOrders() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ensure crops exist
    await client.query(`
      INSERT INTO crops (name) VALUES 
        ('Rice'), 
        ('Tomatoes'), 
        ('Leafy Greens'), 
        ('Carrots')
      ON CONFLICT (name) DO NOTHING;
    `);

    const cropsRes = await client.query(`SELECT id, name FROM crops`);
    const cropsMap = Object.fromEntries(cropsRes.rows.map(r => [r.name, r.id]));
    // Map Tomato -> Tomatoes if needed
    if (!cropsMap['Tomatoes'] && cropsMap['Tomato']) cropsMap['Tomatoes'] = cropsMap['Tomato'];
    if (!cropsMap['Carrots'] && cropsMap['Carrot']) cropsMap['Carrots'] = cropsMap['Carrot'];

    const farmerId = '11111111-1111-1111-1111-111111111111';
    const buyerId = '22222222-2222-2222-2222-222222222222';
    const farmId = 'f1111111-1111-1111-1111-111111111111';

    const gradeRes = await client.query(`SELECT id FROM grades LIMIT 1`);
    const gradeId = gradeRes.rows[0].id;

    // 2. Ensure harvest batches exist
    const batchesData = [
      { key: 'YM-1001', crop: cropsMap['Rice'] || cropsMap['Tomato'], kg: 500 },
      { key: 'YM-1002', crop: cropsMap['Tomatoes'] || cropsMap['Tomato'], kg: 500 },
      { key: 'YM-1003', crop: cropsMap['Leafy Greens'] || cropsMap['Cabbage'], kg: 500 },
      { key: 'YM-1004', crop: cropsMap['Carrots'] || cropsMap['Carrot'], kg: 500 }
    ];

    const batchIds = {};
    for (const b of batchesData) {
      const res = await client.query(`
        INSERT INTO harvest_batches (
          farm_id, farmer_id, crop_id, grade_id, 
          planned_kg, actual_kg, sellable_kg, planned_harvest_date, status
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $5, $5, '2026-11-01', 'harvested'
        ) RETURNING id
      `, [farmId, farmerId, b.crop, gradeId, b.kg]);
      batchIds[b.key] = res.rows[0].id;
    }

    // 3. Helper to insert order and transition state
    async function createOrder(key, cropBatchKey, agreedKg, agreedCents, targetState, createdAt, cancelReason = null) {
      // Step 1: Insert as draft
      const insertRes = await client.query(`
        INSERT INTO orders (
          buyer_id, destination, destination_district, 
          destination_latitude, destination_longitude, delivery_date, 
          agreed_total_cents, status, operation_key, created_at, updated_at
        ) VALUES (
          $1, 'Colombo Wholesale Hub, 45 Main St', 'Colombo',
          6.9271, 79.8612, '2026-11-10',
          $2, 'draft', $3, $4, $4
        ) ON CONFLICT (operation_key) DO UPDATE SET 
          agreed_total_cents = EXCLUDED.agreed_total_cents
        RETURNING id, status;
      `, [buyerId, agreedCents, key, createdAt]);

      const orderId = insertRes.rows[0].id;
      let curStatus = insertRes.rows[0].status;

      // Transition paths
      const fullPath = ['awaiting_suppliers', 'ready_to_confirm', 'confirmed', 'in_fulfilment', 'delivered', 'closed'];
      
      if (targetState === 'cancelled') {
        if (curStatus !== 'cancelled') {
          await client.query(`
            UPDATE orders SET status = 'cancelled', cancellation_reason = $1, updated_at = $2 WHERE id = $3
          `, [cancelReason || 'Order cancelled by buyer', createdAt, orderId]);
        }
      } else {
        const targetIdx = fullPath.indexOf(targetState);
        if (targetIdx !== -1) {
          for (let i = 0; i <= targetIdx; i++) {
            const nextStatus = fullPath[i];
            const currentIdx = fullPath.indexOf(curStatus);
            if (currentIdx < i) {
              await client.query(`UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3`, [nextStatus, createdAt, orderId]);
              curStatus = nextStatus;
            }
          }
        }
      }

      return orderId;
    }

    // YM-1001: Rice, 250 Kg, LKR 72,500.00, 3 Nov 2026 - 12.45 PM, Delivered
    const o1Id = await createOrder('order:ym18:YM-1001', 'YM-1001', 250, 7250000, 'delivered', '2026-11-03 12:45:00+00');
    // YM-1002: Tomatoes, 100 Kg, LKR 50,000.00, 6 Nov 2026 - 9.00 AM, In Transit
    const o2Id = await createOrder('order:ym18:YM-1002', 'YM-1002', 100, 5000000, 'in_fulfilment', '2026-11-06 09:00:00+00');
    // YM-1003: Leafy Greens, 150 Kg, LKR 22,500.00, 5 Nov 2026 - 01.45 PM, Processing (confirmed)
    const o3Id = await createOrder('order:ym18:YM-1003', 'YM-1003', 150, 2250000, 'confirmed', '2026-11-05 13:45:00+00');
    // YM-1004: Carrots, 200 Kg, LKR 82,500.00, 4 Nov 2026 - 11.30 AM, Canceled
    const o4Id = await createOrder('order:ym18:YM-1004', 'YM-1004', 200, 8250000, 'cancelled', '2026-11-04 11:30:00+00', 'Supplier delivery delay requested cancellation');

    // 4. Insert Allocations (linking orders to batches and crops)
    // Note allocations must start at 'held'
    async function createAlloc(allocKey, orderId, batchId, agreedKg, unitPriceCents, targetState) {
      const res = await client.query(`
        INSERT INTO allocations (
          order_id, batch_id, farmer_id, agreed_kg, agreed_unit_price_cents,
          status, operation_key
        ) VALUES (
          $1, $2, $3, $4, $5,
          'held', $6
        ) ON CONFLICT (operation_key) DO UPDATE SET
          agreed_kg = EXCLUDED.agreed_kg,
          agreed_unit_price_cents = EXCLUDED.agreed_unit_price_cents
        RETURNING id, status;
      `, [orderId, batchId, farmerId, agreedKg, unitPriceCents, allocKey]);
      
      const allocId = res.rows[0].id;
      let curStatus = res.rows[0].status;

      const path = ['supplier_accepted', 'committed', 'picked_up', 'handed_over', 'accepted'];
      if (targetState === 'cancelled') {
        if (curStatus !== 'cancelled') {
          await client.query(`UPDATE allocations SET status = 'cancelled' WHERE id = $1`, [allocId]);
        }
      } else {
        const targetIdx = path.indexOf(targetState);
        if (targetIdx !== -1) {
          for (let i = 0; i <= targetIdx; i++) {
            const nextStatus = path[i];
            const currentIdx = path.indexOf(curStatus);
            if (currentIdx < i) {
              const kg = (nextStatus === 'committed' || nextStatus === 'picked_up' || nextStatus === 'handed_over' || nextStatus === 'accepted') ? agreedKg : 0;
              await client.query(`
                UPDATE allocations SET 
                  status = $1,
                  committed_kg = CASE WHEN $2 >= 'committed' THEN $3 ELSE committed_kg END,
                  picked_up_kg = CASE WHEN $2 >= 'picked_up' THEN $3 ELSE picked_up_kg END,
                  handed_over_kg = CASE WHEN $2 >= 'handed_over' THEN $3 ELSE handed_over_kg END,
                  accepted_kg = CASE WHEN $2 = 'accepted' THEN $3 ELSE accepted_kg END
                WHERE id = $4
              `, [nextStatus, nextStatus, agreedKg, allocId]);
              curStatus = nextStatus;
            }
          }
        }
      }
    }

    await createAlloc('alloc:ym18:YM-1001', o1Id, batchIds['YM-1001'], 250, 29000, 'accepted');
    await createAlloc('alloc:ym18:YM-1002', o2Id, batchIds['YM-1002'], 100, 50000, 'picked_up');
    await createAlloc('alloc:ym18:YM-1003', o3Id, batchIds['YM-1003'], 150, 15000, 'committed');
    await createAlloc('alloc:ym18:YM-1004', o4Id, batchIds['YM-1004'], 200, 41250, 'cancelled');

    await client.query('COMMIT');
    console.log('Successfully seeded 4 Figma buyer orders into Neon DB!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedOrders();
