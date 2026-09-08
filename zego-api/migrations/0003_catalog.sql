-- Vendors are `users` rows with role='vendor'; the admin's VendorInput
-- splits the display name, so add the columns it expects.
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;

CREATE TABLE shop_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE cuisines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  shop_type TEXT
);

ALTER TABLE zones ADD COLUMN tax REAL NOT NULL DEFAULT 0;

-- Recreate the catalog tables with the real shape the admin/web GraphQL
-- calls expect (options are restaurant-level and reused across addons,
-- rather than owned by a single addon group). Safe: nothing has been
-- created through these tables yet (no vendor onboarding existed before
-- this migration).
DROP TABLE IF EXISTS food_variation_addons;
DROP TABLE IF EXISTS addon_options;
DROP TABLE IF EXISTS addon_groups;
DROP TABLE IF EXISTS food_variations;
DROP TABLE IF EXISTS foods;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS restaurants;

CREATE TABLE restaurants (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone_id TEXT REFERENCES zones(id) ON DELETE SET NULL,
  order_prefix TEXT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  username TEXT UNIQUE,
  password_hash TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  post_code TEXT,
  lat REAL,
  lng REAL,
  image TEXT,
  logo TEXT,
  cuisines TEXT, -- JSON array of cuisine ids
  shop_type TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_available INTEGER NOT NULL DEFAULT 1,
  delivery_time INTEGER NOT NULL DEFAULT 30,
  minimum_order REAL NOT NULL DEFAULT 0,
  commission_rate REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  sales_tax REAL NOT NULL DEFAULT 0,
  rating REAL NOT NULL DEFAULT 0,
  review_average REAL NOT NULL DEFAULT 0,
  bound_type TEXT,
  delivery_bounds TEXT, -- JSON polygon: [[[lng,lat],...]]
  circle_radius REAL,
  min_delivery_fee REAL,
  delivery_distance REAL,
  delivery_fee REAL,
  bank_name TEXT,
  account_name TEXT,
  account_code TEXT,
  account_number TEXT,
  business_reg_no TEXT,
  company_reg_no TEXT,
  business_tax_rate REAL,
  current_wallet_amount REAL NOT NULL DEFAULT 0,
  total_wallet_amount REAL NOT NULL DEFAULT 0,
  withdrawn_wallet_amount REAL NOT NULL DEFAULT 0,
  stripe_details_submitted INTEGER NOT NULL DEFAULT 0,
  opening_times TEXT, -- JSON [{day,times:[{startTime,endTime}]}]
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_restaurants_owner ON restaurants(owner_id);
CREATE INDEX idx_restaurants_zone ON restaurants(zone_id);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_categories_restaurant ON categories(restaurant_id);

CREATE TABLE sub_categories (
  id TEXT PRIMARY KEY,
  parent_category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL
);
CREATE INDEX idx_sub_categories_parent ON sub_categories(parent_category_id);

CREATE TABLE foods (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  sub_category_id TEXT REFERENCES sub_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_out_of_stock INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_foods_restaurant ON foods(restaurant_id);
CREATE INDEX idx_foods_category ON foods(category_id);

CREATE TABLE food_variations (
  id TEXT PRIMARY KEY,
  food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price REAL NOT NULL,
  discounted REAL,
  is_out_of_stock INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_food_variations_food ON food_variations(food_id);

CREATE TABLE options (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0
);
CREATE INDEX idx_options_restaurant ON options(restaurant_id);

CREATE TABLE addons (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  quantity_minimum INTEGER NOT NULL DEFAULT 0,
  quantity_maximum INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_addons_restaurant ON addons(restaurant_id);

CREATE TABLE addon_options (
  addon_id TEXT NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  PRIMARY KEY (addon_id, option_id)
);

CREATE TABLE food_variation_addons (
  food_variation_id TEXT NOT NULL REFERENCES food_variations(id) ON DELETE CASCADE,
  addon_id TEXT NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  PRIMARY KEY (food_variation_id, addon_id)
);
