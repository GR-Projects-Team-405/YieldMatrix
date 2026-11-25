# YM09 – Produce Listings Dependency & Media Integration Notes

## 1. Purpose

This document records how **YM09 – Produce Listings** (`frontend/src/features/ym09/` and `backend/src/modules/ym09/`) integrates with external YieldMatrix modules owned by other developers, plus how future produce media storage will plug in cleanly without database schema drift or duplicated module endpoints.

---

## 2. External Module Integration Status & Contracts

| Module | Owner | Current Backend Route Status | Integration Role for YM09 | YM09 Frontend Integration Point |
| --- | --- | --- | --- | --- |
| **YM07 – Farms & Land Management** | Hathiff Haleem | **Pending** (currently only `GET /api/ym07/status` exists in `backend/src/modules/ym07/routes.js`) | Provides authenticated farmer's active farms for Add Produce Listing (`Select Farm`) | `frontend/src/features/ym09/services/produceDependenciesApi.ts` (`fetchFarmerFarms`, `YM07_FARMS_ENDPOINT`, `IS_YM07_FARMS_API_AVAILABLE`) |
| **YM08 – Harvest Batches** | Imalka Deshan | **Pending** (currently only `GET /api/ym08/status` exists in `backend/src/modules/ym08/routes.js`) | Provides eligible harvested batches (`status = 'harvested'`, `sellable_kg > 0`, unencumbered stock, no active listing) for Add Produce Listing (`Harvest Batch`) | `frontend/src/features/ym09/services/produceDependenciesApi.ts` (`fetchEligibleHarvestBatches`, `YM08_HARVEST_BATCHES_ENDPOINT`, `IS_YM08_BATCHES_API_AVAILABLE`) |
| **YM04 – Reference Data (Crops & Grades)** | Reference Data owner | **Not required separately at runtime** (`GET /api/ym04/status` only) | Crop (`cropId`, `cropName`, `category`) and Grade (`gradeId`, `gradeName`) are derived directly from YM08 batch records and YM09 listing JOINs (`crops`, `grades`) | Derived cleanly inside `produceDependenciesApi.ts` and `ProduceInformationForm.tsx`; Edit mode receives read-only `cropName` and `gradeName` from `GET /api/ym09/produce/:id` |

### 2.1 Expected Contract for YM07 (`GET /api/ym07/farms`)
- **Caller:** `fetchFarmerFarms()` in `frontend/src/features/ym09/services/produceDependenciesApi.ts` (invoked by `useProduceListingForm` in `create` mode).
- **Expected Response Array (`data` / `farms` / top-level array):**
  - `id`: Farm UUID (`farms.id`)
  - `name`: Farm display name (`farms.name`)
  - `district`: District name (`farms.district`)
  - `status`: Farm lifecycle status (`'active' | 'inactive' | ...`; YM09 filters/uses `active` farms)
- **Enabling once YM07 merges its endpoint:**
  1. Confirm the live path in `YM07_FARMS_ENDPOINT` (default `/ym07/farms` on shared Axios base `/api`).
  2. Set `IS_YM07_FARMS_API_AVAILABLE = true` in `frontend/src/features/ym09/services/produceDependenciesApi.ts`.

### 2.2 Expected Contract for YM08 (`GET /api/ym08/harvest-batches`)
- **Caller:** `fetchEligibleHarvestBatches()` in `frontend/src/features/ym09/services/produceDependenciesApi.ts` (invoked by `useProduceListingForm` in `create` mode).
- **Expected Fields per Harvest Batch Record (`data` / `batches` / top-level array):**
  - `id`: Harvest batch UUID (`harvest_batches.id`)
  - `batchNumber`: Optional human-readable batch reference (`HB-...`, falls back deterministically to `HB-<ID prefix>`)
  - `farmId` (`farm_id`) & `farmName`
  - `cropId` (`crop_id`) & `cropName` (`crops.name`)
  - `gradeId` (`grade_id`) & `gradeName` (`grades.name`)
  - `harvestDate` (`harvest_date`, optional ISO date/timestamp)
  - `status` (`harvest_batches.status` — only `'harvested'` batches are eligible for listing)
  - `actualKg` (`actual_kg`)
  - `sellableKg` (`sellable_kg`)
  - `activeReservedKg` / `reservedKg` & `committedKg` (or precomputed `availableStockKg`)
  - `hasActiveListing`: boolean enforcing DB rule `one_active_listing_per_batch`
- **Enabling once YM08 merges its endpoint:**
  1. Confirm the live path in `YM08_HARVEST_BATCHES_ENDPOINT` (default `/ym08/harvest-batches`).
  2. Set `IS_YM08_BATCHES_API_AVAILABLE = true` in `frontend/src/features/ym09/services/produceDependenciesApi.ts`.

### 2.3 Edit Mode Independence (`GET /api/ym09/produce/:id`)
- When editing an existing listing (`/farmer/produce/:id/edit`), YM09 **does not depend on YM07 or YM08 list endpoints** because:
  1. `Farm`, `Harvest Batch`, `Crop`, and `Grade` are locked read-only on Edit to protect original batch linkage and historical allocations.
  2. `GET /api/ym09/produce/:id` directly returns `farmId`, `farmName`, `batchId`, `batchNumber`, `cropName`, `gradeName`, `actualKg`, `sellableKg`, `offeredKg`, `reservedKg`, `committedKg`, `availableKg`, `unitPriceCents`, `validFrom`, and `validUntil`.

---

## 3. Future Produce Image / Media Integration Notes

YM09 intentionally **does not implement image upload, object storage, database image columns, or placeholder product illustrations**:
- The PostgreSQL `listings` table (`backend/database/schema.sql`) currently contains no `image_url` or media attachment table.
- Frontend containers (`ProduceCard`, `ProduceSummaryCard`, `ListingPreviewCard`, `ProduceImageSelector`, and `ProduceTable`) preserve stable dimensions and render the explicit fallback state (`Image cannot be shown`) whenever `listing.imageUrl` is absent or fails to load.
- **When media storage is added later:**
  1. **Schema / Storage:** Either add `image_url TEXT` (nullable) to `listings` (or a dedicated `listing_media` table) backed by signed object storage (e.g., S3 / Cloudflare R2 / GCS).
  2. **Backend (`backend/src/modules/ym09/`):** Include `imageUrl` in `ym09.sql.js` SELECT lists for `SQL_FIND_LISTINGS_BY_FARMER`, `SQL_FIND_LISTING_BY_ID`, and `SQL_FIND_LISTING_DETAILS_HEADER`, validate HTTPS/relative URLs in `ym09.validation.js`, and accept `imageUrl` in create/update payloads.
  3. **Frontend (`frontend/src/features/ym09/`):**
     - `produceApi.ts`: `normalizeLiveListing` already preserves `listing.imageUrl` when returned by backend responses.
     - `ProduceImageSelector.tsx`: replace the informational media placeholder card with the verified upload/signed-URL control while keeping preview and detail fallbacks to `Image cannot be shown`.
