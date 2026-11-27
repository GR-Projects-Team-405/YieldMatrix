# YM12 database proposals

**Review only — Not applied.** These proposals have not been run against the shared database.

## What the current schema and seed support

The seed creates four demo users, one farm (Green Valley Farm, Nuwara Eliya),
five crops, three grades, and five wallets. It creates no listings,
harvest batches, buyer requests, offers, future commitments, orders,
allocations, trips, trip stops, incidents, disputes, or reviews/ratings.

YM12 can query the existing listing, harvest, commitment, order, allocation,
trip-stop, and dispute columns. Until those tables have qualifying rows, the
real database returns no listings and no recorded performance history; it
must not silently replace a database 404 with sample data. The SQL proposal
adds illustrative listings/batches and a draft order/allocation only.

## Gaps to raise with the team lead

| Gap | Why YM12 needs it | Affected modules |
| --- | --- | --- |
| Listings and harvest batches | Produce details, active supplier listings, and comparison need public offer and stock rows. | YM09 Listings, YM12 |
| Supplier description, tagline, business type, operating-since year, and explicit verification | `users`/`farms` currently have no profile fields for these values. `users.created_at` can supply member-since, and approval status can gate eligibility, but is not a separate identity-verification record. | YM12, identity/onboarding owner |
| Reviews and rating aggregates | There is no review/rating table or seeded review data. Ratings should be based on an agreed review source, not fabricated columns or values. | YM12, marketplace/reviews owner |
| Recorded request/offer and fulfilment history | Performance needs buyer-request acceptance, confirmed/completed orders, pickup timestamps, and disputes tied to a supplier. `future_commitments` has status transitions, but the schema does not explicitly identify inbound buyer requests; `orders.updated_at` is not a dedicated completion timestamp. Seed rows do not exist, so confirm those semantics before treating history as authoritative. | YM18 Orders, YM19 Disputes, YM12 |
| Distance basis | Farms have latitude/longitude and orders have destination coordinates, but no canonical buyer-to-farm distance or routing service. YM12's district lookup is intentionally partial; missing pairs remain unknown. | YM15 Matching, YM12 |

`business_type`, `description`, `tagline`, `verified`, and
`operating_since_year` are proposed as optional user profile fields in the
separate ALTER proposal. `member_since` already comes from `users.created_at`.
Do not store ratings as profile columns until the lead defines an authoritative
review model.

## Proposal files

- `20261125_ym12_sample_data.sql` — idempotent demo listings/batches plus a
  draft order and held allocation using existing tables and columns only.
- `20261125_ym12_profile_fields.sql` — optional profile-column proposal;
  existing users receive `NULL` for optional text/year fields and `false` for
  the new verification flag, avoiding unearned verification claims.

No proposal file is wired into the application.
