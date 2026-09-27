-- ============================================================
-- CropFlow Demo Seed Data (Part 1: reference data only)
-- Run this AFTER schema.sql.
-- User accounts, farmers, crops, tokens, procurement and payments
-- are seeded separately via `npm run seed` in /backend, which
-- hashes passwords properly with bcrypt instead of hardcoding a hash here.
--
-- Safe to re-run: centres use ON CONFLICT DO NOTHING on name,
-- slots use ON CONFLICT DO NOTHING on the (centre_id, slot_date, start_time) unique key.
-- ============================================================

-- Centres
INSERT INTO centres (
    name, address, latitude, longitude,
    capacity_per_slot, active_counters, avg_minutes_per_farmer
)
SELECT v.name, v.address, v.latitude, v.longitude,
       v.capacity_per_slot, v.active_counters,
       v.avg_minutes_per_farmer
FROM (VALUES
    ('ABC Procurement Centre', 'Main Bazaar Road, Thanjavur', 10.7870, 79.1378, 25, 3, 4.0),
    ('Green Valley Mandi', 'NH45 Bypass, Trichy', 10.7905, 78.7047, 20, 2, 5.0),
    ('Riverside Collection Point', 'Cauvery Bank Road, Erode', 11.3410, 77.7172, 15, 2, 4.5)
) AS v(name, address, latitude, longitude,
       capacity_per_slot, active_counters, avg_minutes_per_farmer)
WHERE NOT EXISTS (
    SELECT 1 FROM centres c WHERE c.name = v.name
);