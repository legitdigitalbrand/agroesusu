// One-off CLI runner for the provider fee backfill.
// Usage (prod env vars required):
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     npx tsx scripts/backfill-provider-fees.ts
import { backfillProviderFees } from '../src/modules/wallet/provider-fees';

// Node 20 has no native WebSocket — supabase-js realtime needs one.
// (ws is a transitive dependency of supabase-js.)
// eslint-disable-next-line @typescript-eslint/no-var-requires
(globalThis as Record<string, unknown>).WebSocket = require('ws');

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
  }
  const report = await backfillProviderFees();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
