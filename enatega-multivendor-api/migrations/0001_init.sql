-- Enatega-compatible backend schema (Cloudflare D1 / SQLite)

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'CUSTOMER', -- CUSTOMER | VENDOR | RIDER | ADMIN
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE restaurants (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  image TEXT,
  address TEXT,
  location_lat REAL,
  location_lng REAL,
  delivery_time INTEGER DEFAULT 30,
  minimum_order REAL DEFAULT 0,
  free_delivery INTEGER NOT NULL DEFAULT 0,
  accept_vouchers INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  title TEXT NOT NULL
);

CREATE TABLE foods (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  category_id TEXT REFERENCES categories(id),
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE variations (
  id TEXT PRIMARY KEY,
  food_id TEXT NOT NULL REFERENCES foods(id),
  title TEXT NOT NULL,
  price REAL NOT NULL
);

CREATE TABLE riders_meta (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  vehicle_type TEXT,
  is_available INTEGER NOT NULL DEFAULT 1,
  current_lat REAL,
  current_lng REAL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id),
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  rider_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | ACCEPTED | PICKED | DELIVERED | CANCELLED
  order_amount REAL NOT NULL,
  delivery_address TEXT,
  payment_method TEXT DEFAULT 'COD',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  food_id TEXT NOT NULL REFERENCES foods(id),
  variation_id TEXT REFERENCES variations(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL
);

CREATE INDEX idx_restaurants_owner ON restaurants(owner_id);
CREATE INDEX idx_foods_restaurant ON foods(restaurant_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_rider ON orders(rider_id);
