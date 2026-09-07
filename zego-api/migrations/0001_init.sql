-- Core identity
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  apple_id TEXT UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'vendor', 'rider', 'admin')),
  is_active INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT,
  delivery_address TEXT NOT NULL,
  details TEXT,
  lat REAL,
  lng REAL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_addresses_user ON addresses(user_id);

CREATE TABLE zones (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  coordinates TEXT NOT NULL, -- JSON array of [lat,lng] polygon points
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vendors / restaurants
CREATE TABLE restaurants (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone_id TEXT REFERENCES zones(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  logo_url TEXT,
  cover_image_url TEXT,
  cuisines TEXT, -- JSON string array
  is_active INTEGER NOT NULL DEFAULT 1,
  is_open INTEGER NOT NULL DEFAULT 1,
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
  minimum_order_cents INTEGER NOT NULL DEFAULT 0,
  average_prep_time_minutes INTEGER NOT NULL DEFAULT 20,
  rating_avg REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  opening_hours TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_restaurants_owner ON restaurants(owner_id);
CREATE INDEX idx_restaurants_zone ON restaurants(zone_id);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_categories_restaurant ON categories(restaurant_id);

CREATE TABLE foods (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_out_of_stock INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_foods_restaurant ON foods(restaurant_id);
CREATE INDEX idx_foods_category ON foods(category_id);

CREATE TABLE food_variations (
  id TEXT PRIMARY KEY,
  food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  discounted_price_cents INTEGER,
  is_out_of_stock INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_food_variations_food ON food_variations(food_id);

CREATE TABLE addon_groups (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  min_selectable INTEGER NOT NULL DEFAULT 0,
  max_selectable INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_addon_groups_restaurant ON addon_groups(restaurant_id);

CREATE TABLE addon_options (
  id TEXT PRIMARY KEY,
  addon_group_id TEXT NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_addon_options_group ON addon_options(addon_group_id);

CREATE TABLE food_variation_addons (
  food_variation_id TEXT NOT NULL REFERENCES food_variations(id) ON DELETE CASCADE,
  addon_group_id TEXT NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (food_variation_id, addon_group_id)
);

-- Riders
CREATE TABLE rider_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type TEXT,
  zone_id TEXT REFERENCES zones(id) ON DELETE SET NULL,
  is_available INTEGER NOT NULL DEFAULT 0,
  rating_avg REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE rider_locations (
  rider_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Coupons
CREATE TABLE coupons (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE, -- NULL = platform-wide
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
  discount_value_cents INTEGER,
  discount_percentage REAL,
  min_order_cents INTEGER NOT NULL DEFAULT 0,
  max_discount_cents INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Orders
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES users(id),
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  rider_id TEXT REFERENCES users(id),
  address_id TEXT REFERENCES addresses(id),
  delivery_address TEXT NOT NULL,
  delivery_lat REAL,
  delivery_lng REAL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP',
    'PICKED_UP', 'DELIVERED', 'CANCELLED'
  )),
  payment_method TEXT NOT NULL DEFAULT 'COD' CHECK (payment_method IN ('COD', 'CARD', 'WALLET')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  subtotal_cents INTEGER NOT NULL,
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  tip_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  coupon_id TEXT REFERENCES coupons(id),
  instructions TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_rider ON orders(rider_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  food_id TEXT NOT NULL REFERENCES foods(id),
  food_variation_id TEXT REFERENCES food_variations(id),
  title TEXT NOT NULL, -- snapshot at order time
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  special_instructions TEXT
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TABLE order_item_addons (
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  addon_option_id TEXT NOT NULL REFERENCES addon_options(id),
  title TEXT NOT NULL, -- snapshot
  price_cents INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);

-- Reviews
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES users(id),
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  rider_id TEXT REFERENCES users(id),
  restaurant_rating INTEGER CHECK (restaurant_rating BETWEEN 1 AND 5),
  rider_rating INTEGER CHECK (rider_rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reviews_restaurant ON reviews(restaurant_id);
CREATE INDEX idx_reviews_rider ON reviews(rider_id);

-- Notifications (in-app / push log)
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  data TEXT, -- JSON
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id);

CREATE TABLE push_tokens (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT,
  PRIMARY KEY (user_id, token)
);

-- App-wide configuration (single row consumed at boot by every frontend)
CREATE TABLE app_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  currency_code TEXT NOT NULL DEFAULT 'USD',
  currency_symbol TEXT NOT NULL DEFAULT '$',
  default_zone_id TEXT REFERENCES zones(id),
  google_maps_api_key TEXT,
  vendor_mode TEXT NOT NULL DEFAULT 'multivendor' CHECK (vendor_mode IN ('multivendor', 'singlevendor'))
);
INSERT INTO app_config (id) VALUES (1);
