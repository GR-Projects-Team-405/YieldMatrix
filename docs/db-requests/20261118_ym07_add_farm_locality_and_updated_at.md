# YM07 Farm Locality and Last Updated Request

**Status** · Not applied  
**Module** · YM07 Farm Management  
**Feature** · Farm registration, editing, list and details

The design captures locality separately from district and the private pickup address. It also displays the last update to a farm. The current schema stores district, pickup address and creation time. The proposal adds nullable `farms.locality` and `farms.updated_at`. A check rejects blank locality when a value is supplied. New rows receive a default update time, and YM07 will set `updated_at` explicitly on successful profile updates and archive operations after deployment. Confirm whether other modules write to farms and need the same timestamp rule or a shared trigger.

**Affected modules** · YM07 directly. Confirm with YM09 (harvest batches), YM10 (listings), and any other module using positional inserts or serializing the full farm row. Existing keys and links are preserved. Locality should not inherit the privacy rules of a public field without a separate decision. Keep it within the Farmer workspace in YM07.

**Existing data and backfill** · Keep both fields NULL on legacy rows, including the seeded Green Valley Farm. Do not infer locality from pickup addresses or substitute the creation date for the last update. After approval, collect locality from the owner or an approved source. Leave an unknown last-update timestamp blank until a recorded update. Enforce required locality through the approved YM07 form and API while legacy records may still lack it.

**How checked** · Reviewed `backend/database/schema.sql`, `backend/database/seed.sql`, and the four YM07 exports. SQL is reviewed against the checked-in schema. It has not been executed or verified on PostgreSQL. Before shared deployment, test on a safe copy that legacy rows and batch links survive, a new row receives a timestamp, blank locality is rejected, and an update advances the timestamp.

**Data-loss risk** · The forward migration adds columns and preserves existing rows. Dropping the columns after deployment would remove data written to them. Plan deployment for a short schema lock and review rollback with the lead before applying.
