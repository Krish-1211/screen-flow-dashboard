-- Step 1: Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create folder_items table
CREATE TABLE IF NOT EXISTS folder_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 🟢 Step 3: Migration Logic (Move existing data)
-- Use string ID 'client_1' as default since it's the current hardcoded value in server.js

INSERT INTO folders (id, client_id, name, parent_id, created_at)
SELECT id, COALESCE(client_id, 'client_1'), name, parent_id, created_at
FROM media
WHERE node_type = 'folder'
ON CONFLICT (id) DO NOTHING;

INSERT INTO folder_items (client_id, media_id, folder_id)
SELECT COALESCE(client_id, 'client_1'), id, parent_id
FROM media
WHERE (node_type = 'file' OR node_type IS NULL) AND parent_id IS NOT NULL AND parent_id IN (SELECT id FROM folders)
ON CONFLICT DO NOTHING;

-- Step 4: Seed from UI Example (if missing)
INSERT INTO folders (id, client_id, name)
VALUES ('1774969861182', 'client_1', 'krish')
ON CONFLICT (id) DO NOTHING;
