CREATE TABLE IF NOT EXISTS guestbook_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ip_address TEXT -- Optional: helpful if you ever need to manually ban an IP
);

-- Optional: Create an index to make sorting by date faster
CREATE INDEX IF NOT EXISTS idx_created_at ON guestbook_entries(created_at DESC);