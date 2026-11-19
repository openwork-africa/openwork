-- Who a record or file belongs to. Existing rows get '' (the guest pool, see ow_core::GUEST_OWNER).
ALTER TABLE records ADD COLUMN owner TEXT NOT NULL DEFAULT '';
ALTER TABLE file_types ADD COLUMN owner TEXT NOT NULL DEFAULT '';
