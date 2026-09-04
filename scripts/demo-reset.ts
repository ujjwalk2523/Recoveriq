#!/usr/bin/env tsx
/**
 * RecoverIQ — Safe Demo Data Reset Utility
 * 
 * Safety Invariant:
 * Strictly DENIED in production environment.
 * Requires --confirm flag.
 */

import { executeSafeDemoReset } from '../src/lib/runtime/demo-reset';
import { getRuntimeEnvironment, isProduction } from '../src/lib/config/environment';

async function main() {
  const args = process.argv.slice(2);
  const isConfirmed = args.includes('--confirm');

  console.log('----------------------------------------------------');
  console.log('🔄 RecoverIQ Demo Reset Utility');
  console.log(`Environment: ${getRuntimeEnvironment()}`);
  console.log('----------------------------------------------------');

  if (isProduction()) {
    console.error('❌ FATAL: Demo reset is strictly prohibited in PRODUCTION environment.');
    process.exit(1);
  }

  if (!isConfirmed) {
    console.warn('⚠️  RESET REQUIRES EXPLICIT CONFIRMATION.');
    console.warn('Run with --confirm flag:');
    console.warn('  npx tsx scripts/demo-reset.ts --confirm');
    process.exit(1);
  }

  try {
    const result = await executeSafeDemoReset({
      confirmation: 'RESET_DEMO_DATA',
      actorEmail: 'operator@recoveriq.local',
    });

    console.log('✅ Demo reset completed successfully:');
    console.log(`   - Environment: ${result.environment}`);
    console.log(`   - Recovery Attempts Purged: ${result.recordsReset.recoveryAttempts}`);
    console.log(`   - Synthetic Demo Transactions Purged: ${result.recordsReset.transactions}`);
    console.log(`   - Synthetic Demo Customers Purged: ${result.recordsReset.customers}`);
    console.log(`   - Timestamp: ${result.timestamp}`);
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Demo reset failed:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
