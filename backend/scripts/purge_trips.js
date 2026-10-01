require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing in .env');
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

async function purgeAllTrips() {
  console.log('--- PURGE TRIPS INITIALIZING ---');

  // 1. Check existing rides
  const { data: rides, count: initialRideCount, error: fetchErr } = await sb
    .from('rides')
    .select('id, status, pickup_address, dropoff_address, requested_at', { count: 'exact' });

  if (fetchErr) {
    console.error('Failed to query rides:', fetchErr.message);
    process.exit(1);
  }

  console.log(`Found ${initialRideCount || 0} existing trips/rides in database.`);
  if (rides && rides.length > 0) {
    rides.forEach((r, idx) => {
      console.log(`  [${idx + 1}] ID: ${r.id} | Status: ${r.status} | From: ${r.pickup_address || '—'} -> To: ${r.dropoff_address || '—'} | Date: ${r.requested_at}`);
    });
  }

  // 2. Cascade cleanup on payments and reviews tied to rides (if any exist)
  console.log('\nCleaning up any related payments and reviews...');
  const { error: reviewErr } = await sb
    .from('reviews')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (reviewErr) {
    console.warn('Notice on reviews cleanup:', reviewErr.message);
  } else {
    console.log('Reviews table checked/cleaned.');
  }

  const { error: payErr } = await sb
    .from('payments')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (payErr) {
    console.warn('Notice on payments cleanup:', payErr.message);
  } else {
    console.log('Payments table checked/cleaned.');
  }

  // 3. Delete all rides
  console.log('\nDeleting all records from rides table...');
  const { error: deleteErr } = await sb
    .from('rides')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (deleteErr) {
    console.error('Failed to delete rides:', deleteErr.message);
    process.exit(1);
  }

  // 4. Verify post-purge count
  const { count: finalRideCount, error: verifyErr } = await sb
    .from('rides')
    .select('*', { count: 'exact', head: true });

  if (verifyErr) {
    console.error('Verification query failed:', verifyErr.message);
    process.exit(1);
  }

  console.log(`\n--- VERIFICATION RESULT ---`);
  console.log(`Rides count remaining in database: ${finalRideCount}`);

  if (finalRideCount === 0) {
    console.log('SUCCESS: All trips successfully cleared. Database is 100% clean and ready to record actual rides.');
  } else {
    console.error(`WARNING: ${finalRideCount} rides still remaining!`);
    process.exit(1);
  }
}

purgeAllTrips().catch(err => {
  console.error('Unexpected error in purgeAllTrips:', err);
  process.exit(1);
});
