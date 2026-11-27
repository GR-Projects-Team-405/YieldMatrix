# YM14 API Contract: Offers & Commitments

**Base Path:** `/api/ym14`  
**Authentication:** Bearer JWT in `Authorization` header (`verifyToken`)  
**Authorized Roles:** `buyer`, `farmer` (role-scoped endpoints)  
**Standard Error Format:**
```json
{
  "error": "Error message description",
  "requestId": "uuid"
}
```

---

## 1. Received Offers API

### `GET /api/ym14/offers/:id`
Retrieves full details for a received offer against a buyer demand.
* **Role:** `buyer`
* **Response (200 OK):**
```json
{
  "offer": {
    "id": "e1111111-1111-1111-1111-111111111111",
    "reference": "OFF-2026-0842",
    "status": "pending",
    "offeredKg": 1200.0,
    "unitPriceCents": 18000,
    "lineTotalCents": 21600000,
    "expiresAt": "2026-11-17T18:00:00Z",
    "availabilityWindow": "12 Nov 2026",
    "tags": ["Tomato - Grade A", "Welimada Origin", "GlobalGAP Certified"],
    "notes": "Crops harvested at peak maturity in terrace fields...",
    "qualityChecklist": [
      { "label": "Grade verification", "value": "100% inspected against YieldMatrix Grade A specs" },
      { "label": "Color & firmness", "value": "85-90% red turn, firm skin" },
      { "label": "Uniform sizing", "value": "Diameter 55-65 mm per sample crate verification" }
    ],
    "demand": {
      "id": "d1111111-1111-1111-1111-111111111111",
      "reference": "DM-1042",
      "cropName": "Fresh Salad Tomatoes",
      "gradeName": "Grade A",
      "quantityKg": 1500.0,
      "destinationHub": "Colombo Central Hub",
      "targetWindow": "12 Nov - 14 Nov 2026",
      "budgetPerKgCents": 18500
    },
    "supplier": {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Nimal Perera",
      "farmName": "Green Valley Estate",
      "location": "Welimada, Badulla",
      "rating": 4.9,
      "completedTrades": 48,
      "isVerified": true
    },
    "batch": {
      "id": "b1111111-1111-1111-1111-111111111111",
      "code": "BT-9024"
    }
  },
  "requestId": "uuid"
}
```

### `GET /api/ym14/offers/compare/:demandId`
Side-by-side comparison of all offers received for a specific demand.
* **Role:** `buyer`
* **Response (200 OK):**
```json
{
  "demand": {
    "id": "d1111111-1111-1111-1111-111111111111",
    "reference": "DM-1042",
    "cropName": "Salad Tomatoes",
    "quantityKg": 1500.0,
    "budgetPerKgCents": 18500
  },
  "metrics": {
    "totalOffers": 3,
    "pendingOffers": 2,
    "expiredOffers": 1,
    "lowestPricePerKgCents": 17500,
    "lowestPriceSupplier": "Sunrise Organics",
    "demandCoverageText": "1 Full Match (1,500 kg), 2 Partial",
    "earliestPickupDate": "08 Nov 2026"
  },
  "offers": [
    {
      "id": "o1",
      "badge": "RECOMMENDED • BEST VALUE",
      "supplierName": "Sunrise Organics",
      "district": "Matale District",
      "batchCode": "BT-8812",
      "grade": "Grade A Produce",
      "offeredKg": 1000.0,
      "shortageKg": 500.0,
      "pricePerKgCents": 17500,
      "priceDifferenceCents": -1000,
      "lineTotalCents": 17500000,
      "availabilityWindow": "08 Nov - 10 Nov 2026",
      "expiresAt": "2026-11-17T18:00:00Z",
      "status": "pending",
      "supplierRating": 4.9,
      "completedTrades": 42,
      "onTimePercentage": 99
    }
  ],
  "requestId": "uuid"
}
```

### `POST /api/ym14/offers/:id/accept`
Accepts an offer, locks wallet escrow, and generates a future commitment.
* **Role:** `buyer`
* **Request Body:**
```json
{
  "operationKey": "accept:offer:OFF-2026-0842:timestamp"
}
```
* **Response (201 Created):**
```json
{
  "success": true,
  "commitmentId": "c1111111-1111-1111-1111-111111111111",
  "reference": "COM-1042",
  "escrowHeldCents": 21600000,
  "message": "Offer accepted and commitment created.",
  "requestId": "uuid"
}
```

### `POST /api/ym14/offers/:id/decline`
Declines an offer with a mandatory reason.
* **Role:** `buyer`
* **Request Body:**
```json
{
  "reason": "Price exceeds current market benchmark",
  "operationKey": "decline:offer:OFF-2026-0842:timestamp"
}
```

---

## 2. Produce Commitments API

### `GET /api/ym14/commitments`
List commitments for the authenticated buyer or farmer.
* **Roles:** `buyer`, `farmer`
* **Query Parameters:** `status` (all, accepted, change_pending, ready_to_fulfil, fulfilled, cancelled), `search`, `page`, `limit`
* **Response (200 OK):**
```json
{
  "stats": {
    "activeCount": 8,
    "committedKg": 6450.0,
    "heldInEscrowCents": 118025000,
    "actionRequiredCount": 1
  },
  "commitments": [
    {
      "id": "c1042",
      "reference": "COM-1042",
      "supplierName": "Highland Harvest",
      "cropName": "Tomato",
      "grade": "Grade A",
      "expectedKg": 1000.0,
      "agreedPricePerKgCents": 18425,
      "harvestWindow": "12 - 14 Nov 2026",
      "status": "ready_to_fulfil",
      "changePending": false,
      "actionType": "view_details"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 8 },
  "requestId": "uuid"
}
```

### `GET /api/ym14/commitments/:id`
Fetch contract specifications, stepper state, escrow balance, and audit anchor.
* **Roles:** `buyer`, `farmer`

### `GET /api/ym14/commitments/:id/change-proposal`
Fetch diff comparison and financial escrow impact for a pending modification.
* **Role:** `buyer`
* **Response (200 OK):**
```json
{
  "commitmentId": "c1041",
  "reference": "COM-1041",
  "cropBatch": "Batch #BT-9024 • Welimada Carrot Grade A",
  "proposalExpiresAt": "2026-11-18T08:00:00Z",
  "diff": [
    { "parameter": "Harvest Quantity", "original": "600 kg net", "proposed": "480 kg net", "variance": "-120 kg (-20% Yield Shortage)" },
    { "parameter": "Delivery Window", "original": "10 - 11 Nov 2026", "proposed": "14 - 15 Nov 2026", "variance": "+4 Days Shift (Weather Hold)" },
    { "parameter": "Agreed Unit Price", "original": "LKR 220.00 / kg", "proposed": "LKR 220.00 / kg", "variance": "Unchanged (Agreed Cap Maintained)" },
    { "parameter": "Total Escrow Value", "original": "LKR 132,000", "proposed": "LKR 105,600", "variance": "-LKR 26,400 (Escrow Refund to Wallet)" }
  ],
  "growerStatement": "Due to unseasonal heavy rainfall...",
  "agronomyVerified": true,
  "verificationNotes": "3 field photos and rainfall gauge log verified by Badulla Regional Agricultural Extension Officer.",
  "financialImpact": {
    "escrowAutoRefundCents": 2640000,
    "revisedEscrowHoldCents": 10560000,
    "timelineShift": "+4 Days Delay",
    "newIntakeDate": "14 Nov 2026 (08:00 AM)"
  },
  "requestId": "uuid"
}
```

### `POST /api/ym14/commitments/:id/approve-change`
Approves harvest change, auto-refunds escrow variance, and updates commitment terms.

### `POST /api/ym14/commitments/:id/reject-change`
Rejects proposal; original terms remain binding.

### `POST /api/ym14/commitments/:id/cancel`
Cancels commitment with required reason, releasing 100% of escrow hold.
