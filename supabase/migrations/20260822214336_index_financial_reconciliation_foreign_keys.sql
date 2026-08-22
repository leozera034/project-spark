create index if not exists store_settlement_entries_order_id_idx
  on private.store_settlement_entries(order_id);

create index if not exists store_settlement_entries_payout_request_id_idx
  on private.store_settlement_entries(payout_request_id);

create index if not exists store_payout_transfer_items_settlement_entry_id_idx
  on private.store_payout_transfer_items(settlement_entry_id);

create index if not exists store_payout_transfer_items_store_id_idx
  on private.store_payout_transfer_items(store_id);
