-- Vehicle/license/bank details and work schedule were declared on the
-- GraphQL Rider type from the start (to match the existing rider app) but
-- always hardcoded to null/[] — there was nowhere to store them. Mirrors
-- the restaurants table's approach: plain columns for scalars, JSON text
-- for the nested work schedule.
ALTER TABLE rider_profiles ADD COLUMN vehicle_number TEXT;
ALTER TABLE rider_profiles ADD COLUMN vehicle_image TEXT;
ALTER TABLE rider_profiles ADD COLUMN license_number TEXT;
ALTER TABLE rider_profiles ADD COLUMN license_expiry_date TEXT;
ALTER TABLE rider_profiles ADD COLUMN license_image TEXT;
ALTER TABLE rider_profiles ADD COLUMN bank_name TEXT;
ALTER TABLE rider_profiles ADD COLUMN bank_account_name TEXT;
ALTER TABLE rider_profiles ADD COLUMN bank_account_code TEXT;
ALTER TABLE rider_profiles ADD COLUMN bank_account_number TEXT;
ALTER TABLE rider_profiles ADD COLUMN time_zone TEXT;
ALTER TABLE rider_profiles ADD COLUMN work_schedule TEXT;
