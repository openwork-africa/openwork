CREATE TABLE records (
    kind TEXT NOT NULL,
    id TEXT NOT NULL,
    seq INTEGER NOT NULL UNIQUE,
    updated_at INTEGER NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (kind, id)
) WITHOUT ROWID;

CREATE TABLE sequence (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    value INTEGER NOT NULL
);
INSERT INTO sequence (id, value) VALUES (1, 0);

CREATE TABLE file_types (
    id TEXT PRIMARY KEY,
    content_type TEXT NOT NULL
);
