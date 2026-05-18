"use strict";

module.exports = function(parsedData, prefix, state) {
  const values = [];

  // state is owned by ws.js and lives for one connection session.
  // Using it here instead of module-scope variables prevents stale data
  // from bleeding into a fresh session after plugin restart.
  if (!state.latestMaster)   state.latestMaster = null;
  if (!state.latestSettings) state.latestSettings = null;

  if (parsedData?.bms_array?.master) {
    state.latestMaster = parsedData.bms_array.master;
  }

  if (parsedData?.type === "settings") {
    state.latestSettings = parsedData;
  }

  if (!state.latestMaster || !state.latestSettings) return values;

  const master = state.latestMaster;
  const settings = state.latestSettings;

  // power = voltage * current
  if (typeof master.vbat === "number" && typeof master.ibat === "number") {
    values.push({
      path: `${prefix}.power`,
      value: master.vbat * master.ibat
    });
  }

  // cellVoltageDifference = max - min
  if (typeof master.maxcell === "number" && typeof master.mincell === "number") {
    values.push({
      path: `${prefix}.cellVoltageDifference`,
      value: master.maxcell - master.mincell
    });
  }

  // capacity.remaining and capacity.dischargeSinceFull
  // WiFi module sends Ah used (settings.Ah); serial path stores dischargeSinceFull in Coulombs
  if (typeof settings.capa === "number" && typeof settings.Ah === "number") {
    values.push({
      path: `${prefix}.capacity.remaining`,
      value: settings.capa - settings.Ah
    });
    values.push({
      path: `${prefix}.capacity.dischargeSinceFull`,
      value: settings.Ah * 3600
    });
  }

  // timeToFull / capacity.timeRemaining in seconds
  if (
    typeof settings.capa === "number" &&
    typeof settings.Ah === "number" &&
    typeof master.ibat === "number"
  ) {
    const capacity = settings.capa;
    const current = master.ibat;
    // WiFi module SOC is 0-100; convert to fraction for Ah calculation
    const soc = typeof master.soc === "number" ? master.soc / 100 : null;
    const remainingAh = soc !== null ? soc * capacity : (capacity - settings.Ah);

    if (current > 0 && remainingAh < capacity) {
      const missingAh = capacity - remainingAh;
      const timeToFull = (missingAh / current) * 3600;
      values.push({ path: `${prefix}.timeToFull`,             value: timeToFull });
      values.push({ path: `${prefix}.capacity.timeRemaining`, value: 0 });
    } else if (current < 0 && remainingAh > 0) {
      const timeToEmpty = (remainingAh / Math.abs(current)) * 3600;
      values.push({ path: `${prefix}.timeToFull`,             value: 0 });
      values.push({ path: `${prefix}.capacity.timeRemaining`, value: timeToEmpty });
    } else {
      values.push({ path: `${prefix}.timeToFull`,             value: 0 });
      values.push({ path: `${prefix}.capacity.timeRemaining`, value: 0 });
    }
  }

  return values;
};
