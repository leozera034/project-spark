-- Restore the public-domain trigger contract that was omitted by the external
-- schema clone. All referenced trigger functions already exist in the target.
-- This migration restores timestamps, archive stamping, inventory integrity,
-- tracking-token hashing and catalog/variant invariants.

set search_path = public, private, extensions, pg_temp;

CREATE TRIGGER categories_stamp_archived_at BEFORE INSERT OR UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION stamp_archived_at();
CREATE TRIGGER set_updated_at_categories BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_combo_items BEFORE UPDATE ON combo_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_combos BEFORE UPDATE ON combos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER courier_auth_identities_set_updated_at BEFORE UPDATE ON courier_auth_identities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_couriers BEFORE UPDATE ON couriers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_customer_addresses BEFORE UPDATE ON customer_addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_customers BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_deliveries BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_device_push_tokens BEFORE UPDATE ON device_push_tokens FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_neighborhoods BEFORE UPDATE ON neighborhoods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER option_groups_stamp_archived_at BEFORE INSERT OR UPDATE ON option_groups FOR EACH ROW EXECUTE FUNCTION stamp_archived_at();
CREATE TRIGGER set_updated_at_option_groups BEFORE UPDATE ON option_groups FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER option_items_stamp_archived_at BEFORE INSERT OR UPDATE ON option_items FOR EACH ROW EXECUTE FUNCTION stamp_archived_at();
CREATE TRIGGER set_updated_at_option_items BEFORE UPDATE ON option_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_shark_combo_item_integrity BEFORE INSERT OR UPDATE OF store_id, option_group_id, linked_product_id, linked_variant_id, is_archived ON option_items FOR EACH ROW EXECUTE FUNCTION private.validate_shark_combo_item_integrity();
CREATE TRIGGER trg_shark_flavor_item_capacity BEFORE INSERT OR UPDATE OF option_group_id, max_quantity ON option_items FOR EACH ROW EXECUTE FUNCTION private.apply_flavor_item_capacity();
CREATE TRIGGER set_updated_at_order_item_options BEFORE UPDATE ON order_item_options FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_shark_reserve_option_inventory AFTER INSERT ON order_item_options FOR EACH ROW EXECUTE FUNCTION private.reserve_option_inventory_from_order_item();
CREATE TRIGGER trg_snapshot_order_item_option_engine BEFORE INSERT ON order_item_options FOR EACH ROW EXECUTE FUNCTION private.snapshot_order_item_option_engine();
CREATE TRIGGER set_updated_at_order_items BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_shark_reserve_product_inventory AFTER INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION private.reserve_product_inventory_from_order_item();
CREATE TRIGGER orders_hash_tracking_token BEFORE INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION private.orders_hash_tracking_token();
CREATE TRIGGER set_updated_at_orders BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_shark_release_inventory AFTER UPDATE OF status ON orders FOR EACH ROW EXECUTE FUNCTION private.release_inventory_on_terminal_order();
CREATE TRIGGER set_updated_at_payment_methods BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_plans BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER product_option_groups_stamp_archived_at BEFORE INSERT OR UPDATE ON product_option_groups FOR EACH ROW EXECUTE FUNCTION stamp_archived_at();
CREATE TRIGGER set_updated_at_product_option_groups BEFORE UPDATE ON product_option_groups FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_shark_validate_variant_group_rule BEFORE INSERT OR UPDATE ON product_variant_option_group_rules FOR EACH ROW EXECUTE FUNCTION private.validate_shark_variant_group_rule();
CREATE TRIGGER set_updated_at_pvoip BEFORE UPDATE ON product_variant_option_item_prices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_shark_variant_option_price_integrity BEFORE INSERT OR UPDATE OF store_id, product_id, product_variant_id, option_item_id ON product_variant_option_item_prices FOR EACH ROW EXECUTE FUNCTION private.validate_shark_variant_option_price();
CREATE TRIGGER product_variants_stamp_archived_at BEFORE INSERT OR UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION stamp_archived_at();
CREATE TRIGGER set_updated_at_product_variants BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_shark_variant_flavor_capacity AFTER INSERT OR UPDATE OF max_flavors, flavor_parts, is_available, is_archived ON product_variants FOR EACH ROW EXECUTE FUNCTION private.sync_shark_variant_flavor_capacity();
CREATE TRIGGER products_stamp_archived_at BEFORE INSERT OR UPDATE ON products FOR EACH ROW EXECUTE FUNCTION stamp_archived_at();
CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_promotions BEFORE UPDATE ON promotions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_store_hours BEFORE UPDATE ON store_hours FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_store_settings BEFORE UPDATE ON store_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_store_subscriptions BEFORE UPDATE ON store_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_stores BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_subscription_payments BEFORE UPDATE ON subscription_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_user_profiles BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_user_roles BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
