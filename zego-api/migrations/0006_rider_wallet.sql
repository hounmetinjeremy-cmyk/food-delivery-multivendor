-- Riders had no wallet at all (only the restaurants table tracked wallet
-- amounts) — the existing rider app expects earnings/withdrawals, so this
-- adds the same shape of columns already used for restaurants, plus a
-- transaction ledger to back a history list.
ALTER TABLE rider_profiles ADD COLUMN current_wallet_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE rider_profiles ADD COLUMN total_wallet_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE rider_profiles ADD COLUMN withdrawn_wallet_amount REAL NOT NULL DEFAULT 0;

CREATE TABLE rider_wallet_transactions (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('delivery_earning', 'withdrawal', 'adjustment')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_rider_wallet_transactions_rider ON rider_wallet_transactions(rider_id);
