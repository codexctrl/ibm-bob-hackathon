-- ============================================================
-- CropFlow Database Schema
-- IBM Bob 2.0 Hackathon
-- Tracks a crop from arrival at a procurement centre to payment.
-- Target: PostgreSQL 13+
--
-- Safe to re-run: CREATE TYPE uses DO $$ blocks, tables use
-- IF NOT EXISTS, indexes use IF NOT EXISTS.
-- ============================================================

-- ------------------------------------------------------------
-- ENUM types  (DO $$ guards make these idempotent)
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('farmer', 'operator', 'officer', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE crop_status AS ENUM ('REGISTERED', 'ARRIVED', 'WEIGHED', 'QUALITY_CHECKED', 'PROCURED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE slot_status AS ENUM ('OPEN', 'FULL', 'CLOSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE token_status AS ENUM ('WAITING', 'CALLED', 'GATE_ENTERED', 'WEIGHING', 'QUALITY_CHECK', 'PROCUREMENT', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE quality_status AS ENUM ('PENDING', 'PASSED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE procurement_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('PENDING', 'INITIATED', 'PROCESSED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('APP', 'SMS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- Users & Farmers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    phone           VARCHAR(15) UNIQUE,
    username        VARCHAR(60) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'farmer',
    language        VARCHAR(10) DEFAULT 'en',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farmers (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    farmer_code     VARCHAR(20) UNIQUE NOT NULL,   -- e.g. CF100245
    address         TEXT,
    registered_by   INTEGER REFERENCES users(id),  -- operator who assisted, if any
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Crops
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crops (
    id              SERIAL PRIMARY KEY,
    farmer_id       INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    crop_type       VARCHAR(60) NOT NULL,
    quantity_bags   INTEGER NOT NULL CHECK (quantity_bags > 0),
    harvest_date    DATE,
    status          crop_status NOT NULL DEFAULT 'REGISTERED',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Centres & Slots
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS centres (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(120) NOT NULL,
    address           TEXT,
    latitude          NUMERIC(9,6),
    longitude         NUMERIC(9,6),
    capacity_per_slot INTEGER NOT NULL DEFAULT 20,
    active_counters   INTEGER NOT NULL DEFAULT 2,
    avg_minutes_per_farmer NUMERIC(5,2) NOT NULL DEFAULT 4.0
);

CREATE TABLE IF NOT EXISTS slots (
    id            SERIAL PRIMARY KEY,
    centre_id     INTEGER NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
    slot_date     DATE NOT NULL,
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    capacity      INTEGER NOT NULL DEFAULT 20,
    booked_count  INTEGER NOT NULL DEFAULT 0,
    status        slot_status NOT NULL DEFAULT 'OPEN',
    UNIQUE (centre_id, slot_date, start_time)
);

-- ------------------------------------------------------------
-- Tokens (one per procurement visit)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tokens (
    id              SERIAL PRIMARY KEY,
    token_number    VARCHAR(20) UNIQUE NOT NULL,   -- e.g. CF45281
    farmer_id       INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    crop_id         INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
    slot_id         INTEGER NOT NULL REFERENCES slots(id),
    queue_position  INTEGER,
    status          token_status NOT NULL DEFAULT 'WAITING',
    issued_by       INTEGER REFERENCES users(id),  -- operator, if assisted
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Procurement (gate -> weighing -> quality -> approval)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procurement (
    id                SERIAL PRIMARY KEY,
    token_id          INTEGER UNIQUE NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
    net_weight_kg     NUMERIC(8,2),
    quality_grade     VARCHAR(10),
    quality_status    quality_status NOT NULL DEFAULT 'PENDING',
    rate_per_bag      NUMERIC(10,2),
    approved_amount   NUMERIC(12,2),
    status            procurement_status NOT NULL DEFAULT 'PENDING',
    processed_by       INTEGER REFERENCES users(id),  -- officer
    processed_at      TIMESTAMP
);

-- ------------------------------------------------------------
-- Payments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id                    SERIAL PRIMARY KEY,
    farmer_id             INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    procurement_id        INTEGER UNIQUE NOT NULL REFERENCES procurement(id) ON DELETE CASCADE,
    amount                NUMERIC(12,2) NOT NULL,
    status                payment_status NOT NULL DEFAULT 'PENDING',
    transaction_reference VARCHAR(60),
    processed_at          TIMESTAMP
);

-- ------------------------------------------------------------
-- Notifications (app + SMS log)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    farmer_id   INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    channel     notification_channel NOT NULL DEFAULT 'APP',
    message     TEXT NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'SENT',
    sent_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Audit log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id),
    action      VARCHAR(120) NOT NULL,
    entity_type VARCHAR(60),
    entity_id   INTEGER,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Indexes (IF NOT EXISTS requires PG 9.5+, safe to re-run)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_farmers_farmer_code    ON farmers(farmer_code);
CREATE INDEX IF NOT EXISTS idx_crops_farmer_id        ON crops(farmer_id);
CREATE INDEX IF NOT EXISTS idx_slots_centre_date      ON slots(centre_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_tokens_slot_queue      ON tokens(slot_id, queue_position);
CREATE INDEX IF NOT EXISTS idx_tokens_token_number    ON tokens(token_number);
CREATE INDEX IF NOT EXISTS idx_tokens_status          ON tokens(status);
CREATE INDEX IF NOT EXISTS idx_payments_farmer_status ON payments(farmer_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_farmer   ON notifications(farmer_id, sent_at);
