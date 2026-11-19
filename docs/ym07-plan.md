# YM07 Farm Management Plan

The four PNGs in `docs/design/ym07/` match the assigned pages in `frontend/src/features/ym07/index.tsx` as it appeared in the base. All routes are Farmer-only and render within the existing workspace. The Figma farm names and quantities are design examples. The repository seed defines Green Valley Farm in Nuwara Eliya for Demo Farmer.

## Screens and routes

| Screen and route | Fields and content | Actions | States and shared components |
|---|---|---|---|
| My farms · `/farmer/farms` | All, active, archived and distinct district counts for the signed-in farmer. Table shows farm name, district, locality and status. Search covers name, district and locality. Filter offers All statuses, Active and Archived. | Add farm opens the form. View farm opens that row's details. | Loading, farms found, no farms yet, no filter matches, error with retry. Use StatCard, ContentCard, InputField, SelectField, Table, TableRow, StatusBadge, EmptyState and Alert. |
| Farm details · `/farmer/farms/:farmId` | Farm name, status, district, locality, private pickup location, linked harvest batches with crop and stock, last update in Asia/Colombo when known. | My farms returns to list. Edit farm opens the edit form. Archive asks for confirmation and changes status only after the server approves. | Loading, loaded, no linked batches, missing or inaccessible farm, request failure with retry, archive confirmation, archive blocked, success. Use ContentCard, StatusBadge, EmptyState, Alert, Button, ConfirmDialog and Toast. |
| Add farm · `/farmer/farms/new` | Farm name, district dropdown, locality and private pickup location are marked required in Figma. Include pickup privacy guidance and district help. | Add farm submits and opens the new record on success. Cancel and My farms return to the list. | Ready, invalid fields, submitting, failure with inputs preserved, success. Use ContentCard, InputField, SelectField, Button, Alert and Toast. |
| Edit farm · `/farmer/farms/:farmId/edit` | The same form fields and guidance as Add farm, prefilled from the owned farm. | Save changes submits and returns to details on success. Cancel returns to details. My farms returns to the list. | Loading, ready, invalid fields, saving, missing or inaccessible farm, failure with inputs preserved, success. Reuse the Add farm form components and EmptyState. |
| Unknown child path · `/farmer/farms/*` | Recovery message. | Back to My farms. | EmptyState and a navigation link. |

Use React Router links for navigation and the shared Button for actions. Allow filters and cards to stack on narrow screens. Use local styles and shared color variables to support light and dark modes. The shared workspace owns the topbar, sidebar and outer heading.

## Field mapping

| UI field or value | Schema and behavior |
|---|---|
| Farm name | `farms.name`, required trimmed text. |
| District | `farms.district`, required trimmed text. Confirm the allowed district list. The Figma examples Kandy and Matale are insufficient for the seeded Nuwara Eliya farm. Preserve the existing district when editing. |
| Locality | Proposed `farms.locality`. Before approval, omit the field from forms and hide the column or show an unavailable value. Before backfill, show a neutral value for legacy rows. |
| Private pickup location | `farms.pickup_address`, required trimmed text. Serve it through owner-scoped detail and write responses as needed. Exclude from list payloads, public surfaces and QR trace. Admin and assigned-driver access belongs to those modules' authorization rules. |
| Active / Archived | `farms.status` maps `active` to Active and `inactive` to Archived. New records default to active. Archive preserves the farm UUID and its relations. |
| Address in route | `farms.id` is the farm UUID. Validate it before querying. Ownership uses `farms.farmer_id`, derived from the signed-in account. |
| Last updated | Proposed `farms.updated_at`. It is distinct from `farms.created_at`. Omit last-updated information when it is unknown. |
| List counts, search and status filter | Derive counts from the owned collection and distinct `farms.district` values before filtering. Search `name`, `district` and, after approval, `locality`. |
| Linked batch ID and crop | `harvest_batches.id` and `crops.name` via `harvest_batches.crop_id`. Join by both `farm_id` and `farmer_id`. Use the actual batch ID unless the team specifies a display code. Do not expose the public trace token here. |
| Reserved / committed kg | `batch_availability.held_kg` is active reservation weight. `uncollected_kg` is committed weight minus picked-up weight. Confirm whether the design label means outstanding or gross committed weight, and which future commitments block archive. |
| Coordinates | `farms.latitude` and `farms.longitude` are optional paired coordinates with up to six decimals and geographic bounds. Figma has no coordinate inputs. Preserve existing values when updating the form fields. |

## Schema gaps and dependencies

- **Locality and last updated.** Both are missing from `farms`. See [SQL proposal](db-requests/20261118_ym07_add_farm_locality_and_updated_at.sql) and [request note](db-requests/20261118_ym07_add_farm_locality_and_updated_at.md). List, details, and basic add and edit can ship on the current schema. Saving and searching locality and displaying a true update timestamp depend on approval and deployment.
- **Human-readable batch code.** The design example shows DEMO HB-001. The schema provides a UUID and no separate batch display code. Use the UUID for now. Confirm with YM09 before proposing a new shared identifier.
- **Archive and new listing rules.** Farm status and stock sources exist. Confirm which reservation, allocation, and future commitment states block archive and how archiving coordinates with concurrent stock changes. Agree on exclusion of inactive farms from new listing choices with YM10. Keep the action disabled or deferred until those rules are agreed. Existing linked batches must remain accessible in history.
- **District choices.** The schema stores text and defines no district lookup table. Confirm the team's supported district list before enforcing a fixed dropdown. This is a product decision and does not require a new table for YM07.

## API plan

| Method and endpoint | Purpose |
|---|---|
| `GET /api/ym07/status` | Keep the current approved-farmer scaffold probe. |
| `GET /api/ym07/farms` | Return the owner's active and archived records with list-safe fields. The first version can filter and compute metrics in the frontend. |
| `GET /api/ym07/farms/:farmId` | Return one owned farm, its private pickup location and linked batch summary. Return 404 for missing or unowned farms. |
| `POST /api/ym07/farms` | Create an active farm for the signed-in farmer. Accept name, district and pickup address on the current schema. Add locality after approval. Return 201. |
| `PATCH /api/ym07/farms/:farmId` | Update only whitelisted profile fields on an owned farm. Preserve untouched values. |
| `PATCH /api/ym07/farms/:farmId/archive` | After confirmation and stock policy agreement, set the owned farm to inactive. Return a conflict for blocking stock. Use a transaction and agreed locking so stock changes cannot bypass the check. |

Use the shared client with paths such as `/ym07/farms`. Apply `verifyToken`, `authorizeRoles('farmer')` and approval checks on every handler. Parameterize SQL and scope reads and mutations by the authenticated farmer ID. Reject unsupported fields and invalid input with 400 and field messages. Include `requestId` in responses. Avoid hard deletes and keep pickup data out of logs and public endpoints.
