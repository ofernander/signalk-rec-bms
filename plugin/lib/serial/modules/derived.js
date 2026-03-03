"use strict";

module.exports = function Derived(app, sendDeltaCallback, config) {
  app.debug("[DERIVED] Module instantiated with config: " + JSON.stringify(config));
  let voltage, current, ampHourUsed, capacity;

  const base = (config && config.deltaPrefix) ? config.deltaPrefix : "";
  const prefix = base
    ? (base.endsWith('.') ? base : base + '.')
    : "";

  function computeAndSendDeltas() {
    if ([voltage, current, ampHourUsed, capacity].every(v => typeof v === 'number')) {
      const power = voltage * current;
      const ahRemaining = capacity - ampHourUsed;

      const values = [
        { path: prefix + 'power',             value: power },
        { path: prefix + 'ampHourRemaining', value: ahRemaining }
      ];

      if (current > 0 && ahRemaining < capacity) {
        const missingAh = capacity - ahRemaining;
        const timeToFull = (missingAh / current) * 3600;
        values.push({ path: prefix + 'timeToFull', value: timeToFull });
        values.push({ path: prefix + 'timeToEmpty', value: 0 });
      } else if (current < 0 && ahRemaining > 0) {
        const timeToEmpty = (ahRemaining / Math.abs(current)) * 3600;
        values.push({ path: prefix + 'timeToFull', value: 0 });
        values.push({ path: prefix + 'timeToEmpty', value: timeToEmpty });
      } else {
        // fallback when current is 0 or data is abnormal
        values.push({ path: prefix + 'timeToFull', value: 0 });
        values.push({ path: prefix + 'timeToEmpty', value: 0 });
      }

      sendDeltaCallback({
        updates: [{ values }]
      });
    }
  }

  app.streambundle.getSelfStream(prefix + 'voltage').forEach(v => {
    if (typeof v === 'number') { voltage = v; computeAndSendDeltas(); }
  });
  app.streambundle.getSelfStream(prefix + 'current').forEach(v => {
    if (typeof v === 'number') { current = v; computeAndSendDeltas(); }
  });
  app.streambundle.getSelfStream(prefix + 'ampHourUsed').forEach(v => {
    if (typeof v === 'number') { ampHourUsed = v; computeAndSendDeltas(); }
  });
  app.streambundle.getSelfStream(prefix + 'capacity').forEach(v => {
    if (typeof v === 'number') { capacity = v; computeAndSendDeltas(); }
  });

  // ---- Cell diff logic ----
  let totalCells = 0;
  let unitsExpected = 0;
  let cellVoltages = {};
  let subscribedCellStreams = false;

  // prevent duplicate subscriptions if units changes / reconnects
  const subscribedCells = new Set();

  // retry controls (avoid timer storms + max wait)
  let pendingCellDiffTimer = null;
  let firstCellSeenAtMs = null;
  const CELL_DIFF_RETRY_MS = 200;
  const CELL_DIFF_MAX_WAIT_MS = 8000;

  app.streambundle.getSelfStream(prefix + 'numBMSUnits').forEach(units => {
    if (typeof units === 'number' && units > 0) {
      // If units changes (or first time), reset expectations and cached values
      if (units !== unitsExpected) {
        unitsExpected = units;
        totalCells = units * 4;
        cellVoltages = {};
        firstCellSeenAtMs = null;

        // clear any pending retry from old expectations
        if (pendingCellDiffTimer) {
          clearTimeout(pendingCellDiffTimer);
          pendingCellDiffTimer = null;
        }
      }

      // Ensure we have subscriptions for 1..totalCells (do not duplicate)
      for (let i = 1; i <= totalCells; i++) {
        if (subscribedCells.has(i)) continue;

        subscribedCells.add(i);
        const cellPath = prefix + 'cellVoltage' + i;
        app.streambundle.getSelfStream(cellPath).forEach(val => {
          if (typeof val === 'number' && Number.isFinite(val)) {
            if (!firstCellSeenAtMs) firstCellSeenAtMs = Date.now();
            cellVoltages[i] = val;
            trySendCellDiff();
          }
        });
      }

      subscribedCellStreams = true;

      // Attempt immediately in case we already have cached values after restart
      trySendCellDiff();
    }
  });

  function scheduleCellDiffRetry() {
    if (pendingCellDiffTimer) return;
    if (!subscribedCellStreams || totalCells <= 0) return;

    pendingCellDiffTimer = setTimeout(() => {
      pendingCellDiffTimer = null;
      trySendCellDiff();
    }, CELL_DIFF_RETRY_MS);
  }

  function trySendCellDiff() {
    if (!subscribedCellStreams || totalCells <= 0) return;

    // Only consider cells within expected range
    const keys = Object.keys(cellVoltages)
      .map(k => parseInt(k, 10))
      .filter(i => Number.isInteger(i) && i >= 1 && i <= totalCells);

    // A: publish as soon as we have enough to compute (>= 2 cells)
    if (keys.length >= 2) {
      const vals = keys.map(i => cellVoltages[i]).filter(v => typeof v === 'number' && Number.isFinite(v));
      if (vals.length >= 2) {
        const minV = Math.min(...vals);
        const maxV = Math.max(...vals);

        sendDeltaCallback({
          updates: [{
            values: [
              { path: prefix + 'cellVoltageDifference', value: maxV - minV }
            ]
          }]
        });
      }
    }

    // B: if we haven't seen all cells yet, retry safely with max-wait
    if (keys.length < totalCells) {
      const now = Date.now();
      if (!firstCellSeenAtMs) firstCellSeenAtMs = now;

      const elapsed = now - firstCellSeenAtMs;
      if (elapsed < CELL_DIFF_MAX_WAIT_MS) {
        scheduleCellDiffRetry();
      } else {
        // stop retrying after max wait; cell updates will still trigger publishes
        if (pendingCellDiffTimer) {
          clearTimeout(pendingCellDiffTimer);
          pendingCellDiffTimer = null;
        }
      }
    } else {
      // all cells present: no need to keep retry timer
      if (pendingCellDiffTimer) {
        clearTimeout(pendingCellDiffTimer);
        pendingCellDiffTimer = null;
      }
    }
  }

  return {
    stop: () => {
      app.debug("[DERIVED] Stopping derived module");
    }
  };
};
