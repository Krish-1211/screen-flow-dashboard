const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Load from current working directory

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log("🚀 Starting Media Migration...");
  
  // 1. Fetch all media that are files and have a parent_id
  const { data: mediaItems, error } = await supabase
    .from('media')
    .select('*')
    .eq('node_type', 'file')
    .not('parent_id', 'is', null);

  if (error) {
    console.error("Error fetching media items:", error);
    return;
  }

  console.log(`📂 Found ${mediaItems.length} items to migrate.`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const item of mediaItems) {
    // Check if a reference already exists
    const { data: existing } = await supabase
      .from('folder_items')
      .select('id')
      .eq('media_id', item.id)
      .eq('folder_id', item.parent_id)
      .maybeSingle();

    if (existing) {
      skippedCount++;
      continue;
    }

    // Create the reference
    const { error: insertError } = await supabase
      .from('folder_items')
      .insert({
        id: crypto.randomUUID(),
        client_id: item.client_id,
        media_id: item.id,
        folder_id: item.parent_id
      });

    if (insertError) {
      console.error(`❌ Failed to migrate item ${item.id}:`, insertError);
    } else {
      migratedCount++;
    }
  }

  console.log(`✅ Migration complete!`);
  console.log(`📊 Migrated: ${migratedCount}`);
  console.log(`⏭️ Skipped (already exist): ${skippedCount}`);
}

migrate();
