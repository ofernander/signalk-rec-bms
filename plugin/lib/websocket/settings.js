"use strict";

module.exports = function(parsedData, prefix) {
  if (parsedData.type !== "settings") {
    return [];
  }

  const values = [];

  // Data from WiFi module WebSocket under SETTINGS message
  values.push({ path: `${prefix}.address`,              value: parsedData.addr });
  values.push({ path: `${prefix}.balEndVoltage`,         value: parsedData.bvol });
  values.push({ path: `${prefix}.balStartVoltage`,       value: parsedData.bmin });
  values.push({ path: `${prefix}.batteryCycleCount`,     value: parsedData.cycl });
  values.push({ path: `${prefix}.canBusSetting`,         value: parsedData.cans });
  values.push({ path: `${prefix}.capacity.nominal`,      value: parsedData.capa });
  values.push({ path: `${prefix}.chargeCoefficient`,     value: parsedData.chac });
  values.push({ path: `${prefix}.chemistry`,             value: parsedData.chem });
  values.push({ path: `${prefix}.currentSensorCoefficient`, value: parsedData.ioja });
  values.push({ path: `${prefix}.currentSensorOffset`,   value: parsedData.ioff });
  values.push({ path: `${prefix}.dischargeCoefficient`,  value: parsedData.dchc });
  values.push({ path: `${prefix}.endChargeHysteresis`,   value: parsedData.chis });
  values.push({ path: `${prefix}.endChargeVoltage`,      value: parsedData.char });
  values.push({ path: `${prefix}.floatVoltageCoefficient`, value: parsedData.cfvc });
  values.push({ path: `${prefix}.maxAllowedCellVoltDiff`, value: parsedData.razl });
  values.push({ path: `${prefix}.maxAllowedCellVoltage`, value: parsedData.cmax });
  values.push({ path: `${prefix}.maxAllowedVoltageHysteresis`, value: parsedData.maxh });
  values.push({ path: `${prefix}.maxChargeCurrent`,      value: parsedData.maxc });
  values.push({ path: `${prefix}.maxDischargeCurrent`,   value: parsedData.maxd });
  values.push({ path: `${prefix}.minAllowedCellVoltage`, value: parsedData.cmin });
  values.push({ path: `${prefix}.minAllowedVoltageHysteresis`, value: parsedData.minh });
  values.push({ path: `${prefix}.minDischargeCellVoltage`, value: parsedData.clow });
  values.push({ path: `${prefix}.deviceName`,            value: parsedData.bms_name });
  values.push({ path: `${prefix}.newLogEveryMidnight`,   value: parsedData.new_log_every_midnight });
  values.push({ path: `${prefix}.numberOfInverterDevices`, value: parsedData.strn });
  values.push({ path: `${prefix}.opto2High`,             value: parsedData.op2h });
  values.push({ path: `${prefix}.opto2Low`,              value: parsedData.op2l });
  values.push({ path: `${prefix}.opto2Time`,             value: parsedData.op2t });
  values.push({ path: `${prefix}.opto2Voltage`,          value: parsedData.op2v });
  values.push({ path: `${prefix}.outputStatus`,          value: parsedData.out });
  values.push({ path: `${prefix}.relay1High`,            value: parsedData.re1h });
  values.push({ path: `${prefix}.relay1Low`,             value: parsedData.re1l });
  values.push({ path: `${prefix}.relay1Time`,            value: parsedData.re1t });
  values.push({ path: `${prefix}.relay1Voltage`,         value: parsedData.re1v });
  values.push({ path: `${prefix}.rsbrSetting`,           value: parsedData.rsbr });
  values.push({ path: `${prefix}.socHysteresis`,         value: parsedData.soch });
  values.push({ path: `${prefix}.socReset`,              value: parsedData.socs });
  values.push({ path: `${prefix}.temperatureUnit`,       value: parsedData.tunit });

  // Temperature thresholds: WiFi module sends °C — convert to Kelvin
  values.push({ path: `${prefix}.bmsOverTempSwitchOff`,          value: typeof parsedData.tbal === 'number' ? parsedData.tbal + 273.15 : parsedData.tbal });
  values.push({ path: `${prefix}.bmsOverTempSwitchOffHysteresis`, value: parsedData.bmth }); // delta value in °C, not absolute — no conversion
  values.push({ path: `${prefix}.cellOverTempSwitchOff`,          value: typeof parsedData.tmax === 'number' ? parsedData.tmax + 273.15 : parsedData.tmax });
  values.push({ path: `${prefix}.underTempChargeDisable`,         value: typeof parsedData.tmin === 'number' ? parsedData.tmin + 273.15 : parsedData.tmin });

  // Process error entries
  Object.entries(parsedData.err || {}).forEach(([childKey, childValue]) => {
    let newKey;
    if (childKey === "p")   newKey = "errorPresenceFlag";
    else if (childKey === "num") newKey = "errorNumber";
    if (newKey) values.push({ path: `${prefix}.${newKey}`, value: childValue });
  });

  // Process baud entries
  Object.entries(parsedData.baud || {}).forEach(([childKey, childValue]) => {
    let newKey;
    if (childKey === "com") newKey = "comSpeed";
    else if (childKey === "lcd") newKey = "lcdSpeed";
    if (newKey) values.push({ path: `${prefix}.${newKey}`, value: childValue });
  });

  // Process nnc entries
  Object.entries(parsedData.nnc || {}).forEach(([childKey, childValue]) => {
    let newKey;
    if (childKey === "bms")  newKey = "nncBms";
    else if (childKey === "cell") newKey = "nncCell";
    if (newKey) values.push({ path: `${prefix}.${newKey}`, value: childValue });
  });

  // Process vnc entries
  Object.entries(parsedData.vnc || {}).forEach(([childKey, childValue]) => {
    let newKey;
    if (childKey === "bms")  newKey = "vncBms";
    else if (childKey === "cell") newKey = "vncCell";
    if (newKey) values.push({ path: `${prefix}.${newKey}`, value: childValue });
  });

  // Process toor entries
  Object.entries(parsedData.toor || {}).forEach(([childKey, childValue]) => {
    let newKey;
    if (childKey === "bms")  newKey = "toorBms";
    else if (childKey === "cell") newKey = "toorCell";
    if (newKey) values.push({ path: `${prefix}.${newKey}`, value: childValue });
  });

  return values;
};
