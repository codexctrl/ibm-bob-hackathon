-- ============================================================
-- CropFlow Demo Seed Data (Part 1: reference data only)
-- Run this AFTER schema.sql.
-- User accounts, farmers, crops, tokens, procurement and payments
-- are seeded separately via `npm run seed` in /backend, which
-- hashes passwords properly with bcrypt instead of hardcoding a hash here.
-- ============================================================

-- Centres
INSERT INTO centres (name, address, latitude, longitude, capacity_per_slot, active_counters, avg_minutes_per_farmer) VALUES
('ABC Procurement Centre', 'Main Bazaar Road, Thanjavur', 10.7870, 79.1378, 25, 3, 4.0),
('Green Valley Mandi', 'NH45 Bypass, Trichy', 10.7905, 78.7047, 20, 2, 5.0),
('Riverside Collection Point', 'Cauvery Bank Road, Erode', 11.3410, 77.7172, 15, 2, 4.5);

-- Slots for the next couple of days (adjust dates as needed for your demo)
INSERT INTO slots (centre_id, slot_date, start_time, end_time, capacity, booked_count, status) VALUES
(1, CURRENT_DATE + 1, '09:00', '10:00', 25, 12, 'OPEN'),
(1, CURRENT_DATE + 1, '10:00', '11:00', 25, 18, 'OPEN'),
(1, CURRENT_DATE + 1, '11:00', '12:00', 25, 25, 'FULL'),
(2, CURRENT_DATE + 1, '09:00', '10:00', 20, 5, 'OPEN'),
(2, CURRENT_DATE + 2, '09:00', '10:00', 20, 0, 'OPEN'),
(3, CURRENT_DATE + 1, '08:00', '09:00', 15, 3, 'OPEN');
