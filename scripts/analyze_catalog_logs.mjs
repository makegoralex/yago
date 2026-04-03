#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const [filePath, slowThresholdInput = '1500'] = process.argv.slice(2);

if (!filePath) {
  console.error('Usage: node scripts/analyze_catalog_logs.mjs <log-file> [slow-threshold-ms]');
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), filePath);
const slowThresholdMs = Number(slowThresholdInput);

if (!Number.isFinite(slowThresholdMs) || slowThresholdMs <= 0) {
  console.error('slow-threshold-ms must be a positive number');
  process.exit(1);
}

const content = fs.readFileSync(resolvedPath, 'utf8');
const rows = content
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.includes('[catalog-pos]'))
  .map((line) => {
    const jsonStart = line.indexOf('{');
    if (jsonStart === -1) {
      return null;
    }

    try {
      return JSON.parse(line.slice(jsonStart));
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const non200 = rows.filter((row) => row.status !== 200);
const slow = rows.filter((row) => Number(row.durationMs) > slowThresholdMs);

const byOrg = rows.reduce((acc, row) => {
  const key = row.organizationId ?? 'unknown';
  const current = acc.get(key) ?? { total: 0, non200: 0, slow: 0, avgBytes: 0 };
  current.total += 1;
  if (row.status !== 200) {
    current.non200 += 1;
  }
  if (Number(row.durationMs) > slowThresholdMs) {
    current.slow += 1;
  }
  current.avgBytes += Number(row.responseSizeBytes) || 0;
  acc.set(key, current);
  return acc;
}, new Map());

console.log(`Total /api/catalog/pos logs: ${rows.length}`);
console.log(`Non-200 responses: ${non200.length}`);
console.log(`Slow responses (>${slowThresholdMs}ms): ${slow.length}`);
console.log('');

if (non200.length) {
  console.log('Non-200 entries:');
  for (const row of non200) {
    console.log(
      `- org=${row.organizationId ?? 'unknown'} status=${row.status} duration=${row.durationMs}ms size=${row.responseSizeBytes ?? 'n/a'}`
    );
  }
  console.log('');
}

if (slow.length) {
  console.log(`Slow entries (>${slowThresholdMs}ms):`);
  for (const row of slow) {
    console.log(
      `- org=${row.organizationId ?? 'unknown'} status=${row.status} duration=${row.durationMs}ms size=${row.responseSizeBytes ?? 'n/a'}`
    );
  }
  console.log('');
}

console.log('By organization:');
for (const [organizationId, stats] of byOrg.entries()) {
  const avgBytes = stats.total > 0 ? Math.round(stats.avgBytes / stats.total) : 0;
  console.log(
    `- ${organizationId}: total=${stats.total}, non200=${stats.non200}, slow=${stats.slow}, avgResponseBytes=${avgBytes}`
  );
}
