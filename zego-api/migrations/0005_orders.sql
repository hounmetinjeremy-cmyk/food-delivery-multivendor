-- Full order lifecycle, rebuilt to match the real status vocabulary used
-- across the web, admin and rider apps (PENDING/ACCEPTED/ASSIGNED/PICKED/
-- DELIVERED/COMPLETED/CANCELLED) instead of the placeholder one from 0001.
-- No order has ever been placed against the old table (placeOrder never
-- existed as a resolver), so this is a safe drop + recreate.
DROP TABLE IF EXISTS order_item_addons;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS orders;

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES users(id),
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  rider_id TEXT REFERENCES users(id),
  zone_id TEXT REFERENCES zones(id),
  delivery_address TEXT NOT NULL,
  delivery_details TEXT,
  delivery_label TEXT,
  delivery_lat REAL,
  delivery_lng REAL,
  order_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (order_status IN (
    'PENDING', 'ACCEPTED', 'ASSIGNED', 'PICKED', 'DELIVERED', 'COMPLETED', 'CANCELLED'
  )),
  payment_method TEXT NOT NULL DEFAULT 'COD',
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  is_active INTEGER NOT NULL DEFAULT 1,
  is_picked_up INTEGER NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  delivery_charges REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  taxation_amount REAL NOT NULL DEFAULT 0,
  tipping REAL NOT NULL DEFAULT 0,
  order_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  coupon_id TEXT REFERENCES coupons(id),
  instructions TEXT,
  reason TEXT,
  is_rider_ringed INTEGER NOT NULL DEFAULT 0,
  preparation_time INTEGER,
  selected_prep_time INTEGER,
  order_date TEXT,
  expected_time TEXT,
  completion_time TEXT,
  accepted_at TEXT,
  assigned_at TEXT,
  picked_at TEXT,
  delivered_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_rider ON orders(rider_id);
CREATE INDEX idx_orders_status ON orders(order_status);

-- Items and their addons are snapshotted as JSON at order time (same pattern
-- as the catalog's other snapshot columns) instead of a fully normalized
-- join, since the order document is read far more often than written and
-- never needs per-addon queries of its own.
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  food_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  special_instructions TEXT,
  variation_json TEXT,
  addons_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TABLE order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);
