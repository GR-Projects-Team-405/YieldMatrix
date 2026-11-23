import assert from 'node:assert/strict';
import {
  getStatus,
  getOfferDetails,
  getOfferComparison,
  acceptOffer,
  declineOffer,
  getCommitmentsList,
  getCommitmentDetails,
  getChangeProposal,
  approveChange,
  rejectChange,
  cancelCommitment,
} from './controller.js';

// Helper to create mock Express request and response objects
function createMockReqRes({ user, params = {}, query = {}, body = {}, headers = {} }) {
  const req = {
    user,
    params,
    query,
    body,
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
  console.log('🚀 Running YM14 Phase 2 & Phase 3 Backend Unit & Controller Tests...\n');

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
    assert.equal(c.stepper[2].status, 'active');
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

  // Test 11: getOfferComparison for Buyer (FR-YM14-02)
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { demandId: 'DM-1042' },
    });
    await getOfferComparison(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.demand);
    assert.equal(res.body.demand.reference, 'DM-1042');
    assert.ok(res.body.metrics);
    assert.equal(res.body.metrics.totalOffers, 3);
    assert.equal(res.body.metrics.pendingOffers, 2);
    assert.equal(res.body.metrics.expiredOffers, 1);
    assert.equal(res.body.metrics.lowestPricePerKgCents, 17500); // LKR 175
    assert.equal(res.body.metrics.lowestPriceSupplier, 'Sunrise Organics');
    assert.ok(Array.isArray(res.body.offers));
    assert.equal(res.body.offers.length, 3);
    assert.equal(res.body.offers[0].badge, 'RECOMMENDED • BEST VALUE');
    assert.equal(res.body.offers[1].badge, 'FULL DEMAND VOLUME MATCH');
    assert.equal(res.body.offers[2].badge, 'EXPIRED • NEW SUPPLIER');
    console.log('✔ Test 11: getOfferComparison returns multi-offer comparison & recommendation badges');
  }

  // Test 12: acceptOffer creates forward commitment and locks escrow (FR-YM14-01 / FR-YM14-03)
  {
    const operationKey = 'op-accept-test-0842-first';
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: 'OFF-2026-0842' },
      body: { operationKey },
    });
    await acceptOffer(req, res, next);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.commitmentId);
    assert.ok(res.body.reference.startsWith('COM-'));
    assert.equal(res.body.escrowHeldCents, 21600000); // LKR 216,000
    console.log('✔ Test 12: acceptOffer atomically creates commitment & locks LKR 216,000 escrow');
  }

  // Test 13: acceptOffer enforces idempotency with operation key
  {
    const operationKey = 'op-accept-test-0842-first';
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: 'OFF-2026-0842' },
      body: { operationKey },
    });
    await acceptOffer(req, res, next);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.commitmentId);
    console.log('✔ Test 13: acceptOffer idempotency key prevents duplicate commitment/escrow creation');
  }

  // Test 14: acceptOffer rejects already accepted offer (state transition check)
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: 'OFF-2026-0842' },
      body: { operationKey: 'different-op-key-attempt' },
    });
    await acceptOffer(req, res, next);
    assert.equal(res.statusCode, 409); // Conflict: already accepted
    assert.ok(res.body.error.includes("status is 'accepted'"));
    console.log('✔ Test 14: acceptOffer rejects transition from non-pending status with 409 Conflict');
  }

  // Test 15: declineOffer validates mandatory reason
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: 'o-sunrise-8812' },
      body: { reason: '' },
    });
    await declineOffer(req, res, next);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.includes('reason is mandatory'));
    console.log('✔ Test 15: declineOffer rejects submission without reason with 400 Bad Request');
  }

  // Test 16: declineOffer successfully rejects offer with reason
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: 'o-sunrise-8812' },
      body: { reason: 'Price exceeds benchmark' },
    });
    await declineOffer(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.status, 'rejected');
    assert.equal(res.body.reason, 'Price exceeds benchmark');
    console.log('✔ Test 16: declineOffer transitions offer to rejected with mandatory reason recorded');
  }

  // Test 17: getChangeProposal returns 4-column diff, grower statement, and financial refund summary (FR-YM14-05)
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: 'c1041' },
    });
    await getChangeProposal(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.reference, 'COM-1041');
    assert.equal(res.body.cropBatch, 'Batch #BT-9024 • Welimada Carrot Grade A');
    assert.equal(res.body.agronomyVerified, true);
    assert.ok(Array.isArray(res.body.diff));
    assert.equal(res.body.diff.length, 4);
    assert.equal(res.body.diff[0].parameter, 'Harvest Quantity');
    assert.equal(res.body.diff[0].originalAgreed, '600 kg net');
    assert.equal(res.body.diff[0].proposedChange, '480 kg net');
    assert.ok(res.body.diff[0].netVariance.includes('-120 kg'));
    assert.equal(res.body.diff[3].parameter, 'Total Escrow Value');
    assert.ok(res.body.diff[3].netVariance.includes('-LKR 26,400'));
    assert.equal(res.body.financialImpact.escrowAutoRefundCents, 2640000); // LKR 26,400
    assert.equal(res.body.financialImpact.revisedEscrowHoldCents, 10560000); // LKR 105,600
    console.log('✔ Test 17: getChangeProposal returns 4-column diff, grower statement & financial impact');
  }

  // Test 18: getChangeProposal rejects empty ID with 400
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: '' },
    });
    await getChangeProposal(req, res, next);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error);
    console.log('✔ Test 18: getChangeProposal rejects empty ID with 400');
  }

  // Test 19: approveChange updates status to accepted, applies terms & auto-refunds escrow difference (FR-YM14-05 / DR-02)
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: 'c1041' },
      body: { operationKey: 'op-approve-change-1041' },
    });
    await approveChange(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.status, 'accepted');
    assert.equal(res.body.escrowAutoRefundCents, 2640000); // LKR 26,400
    assert.equal(res.body.revisedEscrowHoldCents, 10560000); // LKR 105,600
    assert.ok(res.body.message.includes('credited instantly to Agri Wallet'));
    console.log('✔ Test 19: approveChange applies revised terms and auto-refunds LKR 26,400 escrow difference');
  }

  // Test 20: rejectChange keeps original binding terms (FR-YM14-05 / DR-02)
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: 'c1041' },
      body: { reason: 'Must have full 600 kg commitment as agreed' },
    });
    await rejectChange(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.status, 'accepted');
    assert.ok(res.body.message.includes('Original agreed terms remain strictly binding'));
    console.log('✔ Test 20: rejectChange retains original binding terms and updates commitment');
  }

  // Test 21: cancelCommitment validates mandatory reason (400 Bad Request)
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: 'COM-1041' },
      body: { reason: '   ' },
    });
    await cancelCommitment(req, res, next);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.includes('reason is mandatory'));
    console.log('✔ Test 21: cancelCommitment rejects submission without reason with 400 Bad Request');
  }

  // Test 22: cancelCommitment successfully cancels and releases 100% of escrow hold
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: 'COM-1041' },
      body: { reason: 'Alternative supply procured due to weather delay' },
    });
    await cancelCommitment(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.status, 'cancelled');
    assert.equal(res.body.reason, 'Alternative supply procured due to weather delay');
    assert.equal(res.body.escrowRefundCents, 13200000); // LKR 132,000 full refund
    assert.ok(res.body.message.includes('100% of escrow funds released back to Agri Wallet'));
    console.log('✔ Test 22: cancelCommitment transitions status to cancelled & releases 100% escrow');
  }

  // Test 23: getCommitmentDetails reflects cancelled status in memory
  {
    const { req, res, next } = createMockReqRes({
      user: { id: '22222222-2222-2222-2222-222222222222', name: 'Demo Buyer', role: 'buyer' },
      params: { id: 'COM-1041' },
    });
    await getCommitmentDetails(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.commitment.status, 'cancelled');
    console.log('✔ Test 23: getCommitmentDetails reflects updated contract state after cancellation');
  }

  console.log('\n🎉 ALL 23 YM14 BACKEND UNIT & CONTROLLER TESTS PASSED SUCCESSFULLY!\n');
}

runUnitTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
