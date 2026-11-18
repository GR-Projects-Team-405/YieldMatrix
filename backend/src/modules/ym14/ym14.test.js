import assert from 'node:assert/strict';
import {
  getStatus,
  getOfferDetails,
  getCommitmentsList,
  getCommitmentDetails,
} from './controller.js';

// Helper to create mock Express request and response objects
function createMockReqRes({ user, params = {}, query = {}, headers = {} }) {
  const req = {
    user,
    params,
    query,
    headers,
    requestId: 'test-req-uuid-1234',
  };

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };

  const next = (err) => {
    if (err) throw err;
  };

  return { req, res, next };
}

async function runUnitTests() {
  console.log('🚀 Running YM14 Phase 2 Backend Unit & Controller Tests...\n');

  // Test 1: getStatus for Buyer
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
    });
    await getStatus(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.module, 'YM14');
    assert.equal(res.body.status, 'active');
    assert.equal(res.body.user.role, 'buyer');
    console.log('✔ Test 1: getStatus returns 200 with module metadata and buyer identity');
  }

  // Test 2: getStatus for Farmer
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '11111111-1111-1111-1111-111111111111', name: 'Demo Farmer', role: 'farmer' },
    });
    await getStatus(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.role, 'farmer');
    console.log('✔ Test 2: getStatus returns 200 with farmer identity');
  }

  // Test 3: getOfferDetails for Buyer (FR-YM14-01)
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: 'OFF-2026-0842' },
    });
    await getOfferDetails(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.offer);
    assert.equal(res.body.offer.reference, 'OFF-2026-0842');
    assert.equal(res.body.offer.offeredKg, 1200);
    assert.equal(res.body.offer.unitPriceCents, 18000); // LKR 180 / kg
    assert.equal(res.body.offer.lineTotalCents, 21600000); // LKR 216,000
    assert.equal(res.body.offer.supplier.name, 'Nimal Perera');
    assert.equal(res.body.offer.supplier.rating, 4.9);
    assert.equal(res.body.offer.supplier.completedTrades, 48);
    assert.ok(res.body.offer.qualityChecklist.length >= 3);
    console.log('✔ Test 3: getOfferDetails returns full offer specs, farmer notes & rating');
  }

  // Test 4: getOfferDetails validates missing ID
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: '' },
    });
    await getOfferDetails(req, res, next);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error);
    console.log('✔ Test 4: getOfferDetails rejects empty ID with 400 Bad Request');
  }

  // Test 5: getCommitmentsList for Buyer (FR-YM14-03)
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      query: { page: '1', limit: '10' },
    });
    await getCommitmentsList(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.stats);
    assert.ok(res.body.stats.activeCount >= 6);
    assert.ok(Array.isArray(res.body.commitments));
    assert.equal(res.body.commitments.length, 8);
    assert.equal(res.body.pagination.total, 8);
    console.log(`✔ Test 5: getCommitmentsList returns all contracts and summary stats`);
  }

  // Test 6: getCommitmentsList filters by status
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      query: { status: 'ready_to_fulfil' },
    });
    await getCommitmentsList(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.commitments.length > 0);
    assert.ok(res.body.commitments.every((c) => c.status === 'ready_to_fulfil'));
    console.log('✔ Test 6: getCommitmentsList filters by status (ready_to_fulfil)');
  }

  // Test 7: getCommitmentsList filters by keyword search
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      query: { search: 'Carrot' },
    });
    await getCommitmentsList(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.commitments.length, 1);
    assert.equal(res.body.commitments[0].reference, 'COM-1041');
    assert.equal(res.body.commitments[0].cropName, 'Carrot');
    console.log('✔ Test 7: getCommitmentsList searches by keyword (Carrot -> COM-1041)');
  }

  // Test 8: getCommitmentDetails (FR-YM14-04)
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: 'COM-1042' },
    });
    await getCommitmentDetails(req, res, next);
    assert.equal(res.statusCode, 200);
    const c = res.body.commitment;
    assert.equal(c.reference, 'COM-1042');
    assert.equal(c.status, 'ready_to_fulfil');
    assert.equal(c.stepper.length, 4);
    assert.equal(c.stepper[2].status, 'active'); // Ready to fulfil step
    assert.equal(c.specs.agreedPricePerKgCents, 18425); // LKR 184.25
    assert.equal(c.escrowStatus.balanceHeldCents, 18425000); // LKR 184,250
    assert.ok(c.originalTermsAnchor.summaryText.includes('1,000 kg Fresh Salad Tomatoes'));
    console.log('✔ Test 8: getCommitmentDetails returns specs, stepper, escrow status & audit anchor');
  }

  // Test 9: getCommitmentDetails for Farmer
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '11111111-1111-1111-1111-111111111111', name: 'Demo Farmer', role: 'farmer' },
      params: { id: 'COM-1042' },
    });
    await getCommitmentDetails(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.commitment.reference, 'COM-1042');
    console.log('✔ Test 9: Farmer can view commitment details as the supplier');
  }

  // Test 10: getCommitmentDetails rejects empty ID
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: '' },
    });
    await getCommitmentDetails(req, res, next);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error);
    console.log('✔ Test 10: getCommitmentDetails rejects invalid ID with 400');
  }

  console.log('\n🎉 ALL 10 YM14 PHASE 2 UNIT & CONTROLLER TESTS PASSED SUCCESSFULLY!\n');
}

runUnitTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});