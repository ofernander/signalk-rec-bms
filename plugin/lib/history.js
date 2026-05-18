"use strict";

const fs = require('fs');
const path = require('path');

const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

module.exports = function HistoryBuffer(prefix, dataDir) {
  const persistPath = dataDir
    ? path.join(dataDir, 'bms-history.json')
    : null;

  // Three-tier storage per metric
  // Each entry: { t: timestamp_ms, v: value }
  const store = {
    voltage: { fine: [], medium: [], coarse: [] },
    current: { fine: [], medium: [], coarse: [] },
    power:   { fine: [], medium: [], coarse: [] },
    soc:     { fine: [], medium: [], coarse: [] }
  };

  // Tier boundaries and max retention
  const FINE_RESOLUTION_MS   = 10 * 1000;       // 10s — keep for 1 hour
  const MEDIUM_RESOLUTION_MS = 60 * 1000;       // 1m  — keep for 6 hours
  const COARSE_RESOLUTION_MS = 5 * 60 * 1000;   // 5m  — keep for 24 hours

  const FINE_MAX_AGE_MS   = 1 * 60 * 60 * 1000;   // 1 hour
  const MEDIUM_MAX_AGE_MS = 6 * 60 * 60 * 1000;   // 6 hours
  const COARSE_MAX_AGE_MS = 24 * 60 * 60 * 1000;  // 24 hours

  // Last recorded timestamp per metric per tier, for resolution gating
  const lastRecorded = {
    voltage: { fine: 0, medium: 0, coarse: 0 },
    current: { fine: 0, medium: 0, coarse: 0 },
    power:   { fine: 0, medium: 0, coarse: 0 },
    soc:     { fine: 0, medium: 0, coarse: 0 }
  };

  // Load persisted data on startup
  if (persistPath) {
    try {
      const raw = fs.readFileSync(persistPath, 'utf8');
      const saved = JSON.parse(raw);
      const now = Date.now();

      for (const metric of ['voltage', 'current', 'power', 'soc']) {
        if (saved[metric]) {
          store[metric].fine   = (saved[metric].fine   || []).filter(p => p.t >= now - FINE_MAX_AGE_MS);
          store[metric].medium = (saved[metric].medium || []).filter(p => p.t >= now - MEDIUM_MAX_AGE_MS);
          store[metric].coarse = (saved[metric].coarse || []).filter(p => p.t >= now - COARSE_MAX_AGE_MS);
        }
      }

      // Restore lastRecorded from last entry in each tier so we don't duplicate points
      for (const metric of ['voltage', 'current', 'power', 'soc']) {
        for (const tier of ['fine', 'medium', 'coarse']) {
          const arr = store[metric][tier];
          if (arr.length > 0) lastRecorded[metric][tier] = arr[arr.length - 1].t;
        }
      }
    } catch (e) {
      // Missing or corrupt file — start fresh silently
    }
  }

  const pathMap = {
    [`${prefix}.voltage`]:                'voltage',
    [`${prefix}.current`]:                'current',
    [`${prefix}.power`]:                  'power',
    [`${prefix}.capacity.stateOfCharge`]: 'soc'
  };

  function record(delta) {
    if (!delta.updates) return;
    const now = Date.now();

    delta.updates.forEach(update => {
      if (!update.values) return;
      update.values.forEach(({ path, value }) => {
        const metric = pathMap[path];
        if (!metric || typeof value !== 'number') return;
        push(metric, now, value);
      });
    });
  }

  function push(metric, now, value) {
    const tiers = store[metric];
    const last = lastRecorded[metric];

    if (now - last.fine >= FINE_RESOLUTION_MS) {
      tiers.fine.push({ t: now, v: value });
      last.fine = now;
    }

    if (now - last.medium >= MEDIUM_RESOLUTION_MS) {
      tiers.medium.push({ t: now, v: value });
      last.medium = now;
    }

    if (now - last.coarse >= COARSE_RESOLUTION_MS) {
      tiers.coarse.push({ t: now, v: value });
      last.coarse = now;
    }

    prune(tiers.fine,   now - FINE_MAX_AGE_MS);
    prune(tiers.medium, now - MEDIUM_MAX_AGE_MS);
    prune(tiers.coarse, now - COARSE_MAX_AGE_MS);
  }

  function prune(arr, cutoff) {
    while (arr.length > 0 && arr[0].t < cutoff) arr.shift();
  }

  function flush() {
    if (!persistPath) return;
    try {
      const data = {};
      for (const metric of ['voltage', 'current', 'power', 'soc']) {
        data[metric] = {
          fine:   store[metric].fine,
          medium: store[metric].medium,
          coarse: store[metric].coarse
        };
      }
      fs.writeFileSync(persistPath, JSON.stringify(data), 'utf8');
    } catch (e) {
      // Write failure — non-fatal, will retry on next interval
    }
  }

  // Periodic flush to disk
  let flushTimer = null;
  if (persistPath) {
    flushTimer = setInterval(() => flush(), FLUSH_INTERVAL_MS);
  }

  function getHistory(hours) {
    const h = Math.min(Math.max(parseFloat(hours) || 1, 0.25), 24);
    const now = Date.now();
    const cutoff = now - h * 60 * 60 * 1000;

    let tier;
    if (h <= 1)       tier = 'fine';
    else if (h <= 6)  tier = 'medium';
    else              tier = 'coarse';

    const result = {};
    for (const metric of ['voltage', 'current', 'power', 'soc']) {
      result[metric] = store[metric][tier]
        .filter(p => p.t >= cutoff)
        .map(p => ({ t: p.t, v: p.v }));
    }
    return { hours: h, tier, generated: now, data: result };
  }

  function stop() {
    if (flushTimer) clearInterval(flushTimer);
    flush(); // flush on stop so shutdown data is preserved
  }

  return { record, getHistory, stop };
};
