# YM09 – Produce Listings Dependency & Media Integration Notes

## 1. Purpose

This document describes how **YM09 – Produce Listings** (`frontend/src/features/ym09/` and `backend/src/modules/ym09/`) works today, how **Cloudinary** produce image storage is integrated behind a temporary compatibility flag until `listings.image_key` is added to Neon PostgreSQL, and how YM09 integrates with **YM07** and **YM08** once those modules expose their endpoints.

---

## 2. Current YM09 Functionality Scope

### Works Independently Today (Against Live Neon PostgreSQL)
- **My Produce (`/farmer/produce`):** Live `GET /api/ym09/produce` listings, DR-01 stock math (`availableKg = Math.max(0, offeredKg - reservedKg)`), search, category/status/farm filtering, grid/table views, pagination, and listing status transitions (`PATCH /api/ym09/produce/:id/status`).
- **Produce Listing Details (`/farmer/produce/:id`):** Live `GET /api/ym09/produce/:id/details`, overview metrics, allocations table, orders table, price history chart/log, chronological activity log, Edit navigation, Pause/Reactivate, and Archive with confirmations.
- **Edit Produce (`/farmer/produce/:id/edit`):** Live `GET /api/ym09/produce/:id` and `PUT /api/ym09/produce/:id` in-place updates (quantity, price, availability dates, status) with read-only source lock on farm, batch, crop, and grade.
- **Add Produce Listing creation endpoint (`POST /api/ym09/produce`):** Operational backend creation, validation, batch `FOR UPDATE` serialization, and audit logging.

### Requires Upstream Modules or Pending Database Column
- **Add Produce Farm & Batch dropdowns:** Depends on **YM07** (`GET /api/ym07/farms`) and **YM08** (`GET /api/ym08/harvest-batches`) live endpoints (currently pending; graceful empty/unavailable UI state shown unless `ENABLE_DEV_SAMPLE_DATA` preview mode is explicitly turned on).
- **Live Produce Image Upload, Replacement & Deletion:** Implemented with **Cloudinary**, temporarily gated by `YM09_IMAGE_STORAGE_ENABLED=false` until `listings.image_key` is added to Neon PostgreSQL.

---

## 3. Cloudinary Produce Image Storage & Temporary Database Compatibility

### 3.1 Architecture Implemented
- **Backend adapter:** `backend/src/modules/ym09/ym09.cloudinary.js` (`cloudinary` v2 SDK).
- **Backend endpoints:**
  - `POST /api/ym09/produce/:id/image/signature` — validates MIME (`image/jpeg`, `image/png`, `image/webp`), max size (5 MB), farmer approval, ownership, and non-`closed` listing status, then signs `folder` (`yieldmatrix/produce/<listingId>`), `public_id` (`<uuid>`), and `timestamp`.
  - `POST /api/ym09/produce/:id/image/confirm` — verifies uploaded asset existence, `resource_type: 'image'`, allowed format, and `<= 5 MB` via Cloudinary Admin API (`cloudinary.api.resource`), updates `listings.image_key` atomically with `update_listing_image` audit log, and deletes any replaced Cloudinary asset after commit.
  - `DELETE /api/ym09/produce/:id/image` — clears `listings.image_key`, writes `delete_listing_image` audit log, and deletes the Cloudinary asset inside the transaction so failures roll back safely.
- **Public URL derivation:** `ym09.mapper.js` derives `imageUrl` from `listings.image_key` and never exposes raw `image_key` or `CLOUDINARY_API_SECRET`.
- **Frontend upload workflow:** `frontend/src/features/ym09/services/produceApi.ts` (`uploadProduceImageWorkflow`) requests the backend signature, `POST`s `FormData` (`file`, `api_key`, `timestamp`, `signature`, `folder`, `public_id`) directly to Cloudinary using a separate Axios call (no JWT `Authorization` header), then calls `/confirm`.

### 3.2 Pending Database Column (`listings.image_key`)
The shared Neon PostgreSQL `public.listings` table currently has 8 columns (`id`, `batch_id`, `unit_price_cents`, `offered_kg`, `valid_from`, `valid_until`, `status`, `created_at`) and **does not yet contain `image_key`**.

Required database owner / team-lead migration:
```sql
ALTER TABLE listings
ADD COLUMN image_key TEXT NULL;
```

### 3.3 Temporary Compatibility Mode (`YM09_IMAGE_STORAGE_ENABLED=false`)
While waiting for the database migration:
- `backend/.env` and `backend/.env.example` keep `YM09_IMAGE_STORAGE_ENABLED=false`.
- `ym09.sql.js` and `ym09.repository.js` switch cleanly to `*_NO_IMAGE` query variants that do **not** reference `listings.image_key`.
- All `GET`, `POST`, `PUT`, and `PATCH` listing operations execute normally against Neon and return `imageUrl: null`.
- Image endpoints (`/image/signature`, `/image/confirm`, `DELETE /image`) return HTTP `503` after auth/approval checks.
- Frontend checks `GET /api/ym09/status` (`capabilities.imageStorageEnabled`), renders `"Image cannot be shown"` across cards/tables/details, disables upload actions in `ProduceImageSelector.tsx`, and displays a clear `"Image upload is temporarily unavailable until database support (listings.image_key) is enabled."` banner without fabricating image URLs.

### 3.4 Required Backend Environment Variables & Activation Steps
Set in `backend/.env` (backend-only; never expose secrets via `VITE_*`):
- `CLOUDINARY_CLOUD_NAME=`
- `CLOUDINARY_API_KEY=`
- `CLOUDINARY_API_SECRET=`
- `YM09_IMAGE_MAX_BYTES=5242880`
- `YM09_IMAGE_STORAGE_ENABLED=false` (set to `true` **after** Neon migration succeeds)

**Activation procedure after DB migration approval:**
1. Confirm `ALTER TABLE listings ADD COLUMN image_key TEXT NULL;` has been applied to Neon `public.listings`.
2. Verify `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are set in `backend/.env`.
3. Update `YM09_IMAGE_STORAGE_ENABLED=true` in `backend/.env` and restart the backend server.
4. Test end-to-end: Create listing + upload image -> Verify My Produce/Details render Cloudinary URL -> Replace image -> Delete image.

---

## 4. External Module Integration Status & Contracts

| Module | Owner | Current Backend Route Status | Integration Role for YM09 | YM09 Frontend Integration Point |
| --- | --- | --- | --- | --- |
| **YM07 – Farms & Land Management** | Hathiff Haleem | **Pending** (`GET /api/ym07/status` only in `backend/src/modules/ym07/routes.js`) | Supplies authenticated farmer's active farms for Add Produce (`Select Farm`) | `frontend/src/features/ym09/services/produceDependenciesApi.ts` (`fetchFarmerFarms`, `YM07_FARMS_ENDPOINT`, `IS_YM07_FARMS_API_AVAILABLE`) |
| **YM08 – Harvest Batches** | Imalka Deshan | **Pending** (`GET /api/ym08/status` only in `backend/src/modules/ym08/routes.js`) | Supplies eligible harvested batches (`status = 'harvested'`, `sellable_kg > 0`, unencumbered stock, no active listing) | `frontend/src/features/ym09/services/produceDependenciesApi.ts` (`fetchEligibleHarvestBatches`, `YM08_HARVEST_BATCHES_ENDPOINT`, `IS_YM08_BATCHES_API_AVAILABLE`) |
| **YM04 – Reference Data (Crops & Grades)** | Reference Data owner | **Not required separately at runtime** (`GET /api/ym04/status` only) | Crop (`cropId`, `cropName`, `category`) and Grade (`gradeId`, `gradeName`) are joined in YM08/YM09 payloads | Normalized inside `produceDependenciesApi.ts` and YM09 listing responses |

### 4.1 Expected Contract for YM07 (`GET /api/ym07/farms`)
- Returns `id`, `name`, `district`, `status` (`active` farms used).
- To enable: verify endpoint in `YM07_FARMS_ENDPOINT` and set `IS_YM07_FARMS_API_AVAILABLE = true` in `produceDependenciesApi.ts`.

### 4.2 Expected Contract for YM08 (`GET /api/ym08/harvest-batches`)
- Returns `id`, `batchNumber` (optional), `farmId`, `farmName`, `cropId`, `cropName`, `gradeId`, `gradeName`, `harvestDate`, `status`, `actualKg`, `sellableKg`, `activeReservedKg`/`reservedKg`, `committedKg`, `hasActiveListing`.
- To enable: verify endpoint in `YM08_HARVEST_BATCHES_ENDPOINT` and set `IS_YM08_BATCHES_API_AVAILABLE = true` in `produceDependenciesApi.ts`.

### 4.3 Missing API Behaviour & Edit Mode Independence
- When `IS_YM07_FARMS_API_AVAILABLE` / `IS_YM08_BATCHES_API_AVAILABLE` are `false` and `ENABLE_DEV_SAMPLE_DATA` is `false`, Add Produce shows a graceful unavailability notice without crashing or mixing fake data into real listings.
- Edit Produce (`/farmer/produce/:id/edit`), My Produce, and Listing Details do **not** require YM07 or YM08 APIs at runtime.
