# CropFlow – Farmer Frontend Improvements

## Completed changes

### Navigation
- [x] Farmer-specific tab bar added to Navbar (Dashboard · My Crops · Book Slot · Payments) with active-link highlighting. Non-farmer roles are unaffected.
- [x] Farmer login redirects to `/dashboard`; logout clears session and redirects to `/login`.

### Progress tracker
- [x] Added `CALLED` stage between `WAITING` and `GATE_ENTERED` — matches the token status enum from the backend. Previously a `CALLED` token showed a blank progress rail.
- [x] Fixed mobile overflow: the tracker now wraps into a 4-column grid on screens narrower than 640 px. All 7 stages are visible without horizontal scrolling. The desktop single-row layout is preserved.

### BookSlot page
- [x] Added loading state for the centres list (`Loading centres…`).
- [x] Added loading state for the slots list (`Loading slots…`); slot list resets when switching centre.
- [x] Guarded the "register a crop first" warning so it only appears after the crops request completes — eliminates the false flash on initial load.
- [x] "No upcoming slots." message already correctly relied on the backend filter (`slot_date >= CURRENT_DATE`). No frontend date logic added.
- [x] Added a direct link to My Crops inside the "no crops" warning.

### My Crops page
- [x] Added loading state for the crop list (`Loading crops…`).
- [x] Added success message after a crop is registered.
- [x] Fixed stale closure in `useEffect` by wrapping `loadCrops` in `useCallback`.

### Payments page
- [x] Added loading state (`Loading payments…`) — eliminates the false "No payments yet" flash on initial render.
- [x] Added explicit styles for crop statuses (`REGISTERED`, `ARRIVED`, `WEIGHED`, `QUALITY_CHECKED`, `PROCURED`) to `StatusBadge`.

### Token / Queue page
- [x] Live queue panel now displays for both `WAITING` and `CALLED` status (previously only `WAITING`).
- [x] Added a "Try again" button on the error state so users can retry without a full page reload.

### Build
- [x] `npm run build` passes with 0 errors and 0 warnings (50 modules).

---

## Backend-dependent issues (cannot be fixed in the frontend)

- **No future slots in the database**: if `seed.sql` was run when `CURRENT_DATE` was in the past, `listSlotsForCentre` returns an empty list for all centres. The backend already filters correctly; the frontend correctly displays "No upcoming slots." The fix is re-running `npm run migrate && npm run seed` in the backend.
- **Payments require a completed procurement record**: the backend `listPaymentsForFarmer` JOINs on `procurement`. A farmer with no processed procurement will always see an empty payments list — this is correct data, not a frontend bug.
- **Booking race condition**: `/slots/book` and `/tokens` are two separate calls. If the slot books but token creation fails, the slot's `booked_count` is already incremented. This is a backend transaction scope issue.
- **No farmer-facing notification history endpoint**: notifications exist in the database but no `/notifications/farmer/:id` route is exposed.
- **Queue data unavailable for in-progress tokens** (`GATE_ENTERED` and beyond): `/queue/token/:id` returns a result for any status, but the queue count is meaningful only while the farmer is still waiting. The frontend correctly hides the queue panel for statuses beyond `CALLED`.
