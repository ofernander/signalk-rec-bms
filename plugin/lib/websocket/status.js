"use strict";

module.exports = function(parsedData, prefix) {
  const values = [];
  if (!parsedData.bms_array || !parsedData.bms_array.master) {
    return values;
  }

  const master = parsedData.bms_array.master;
  const slave = parsedData.bms_array.slave?.["0"];
  if (!slave) return values;

  // Data from WiFi module WebSocket under STATUS message
  values.push({ path: `${prefix}.date`,    value: master.date });
  values.push({ path: `${prefix}.time`,    value: master.time });
  values.push({ path: `${prefix}.current`, value: master.ibat });
  values.push({ path: `${prefix}.voltage`, value: master.vbat });

  // SOC/SOH: WiFi module sends 0-100 percentage — convert to 0-1 ratio
  values.push({ path: `${prefix}.capacity.stateOfCharge`, value: typeof master.soc === 'number' ? master.soc / 100 : master.soc });
  values.push({ path: `${prefix}.capacity.stateOfHealth`, value: typeof master.soh === 'number' ? master.soh / 100 : master.soh });

  values.push({ path: `${prefix}.maxCellVoltage`, value: master.maxcell });
  values.push({ path: `${prefix}.minCellVoltage`, value: master.mincell });

  values.push({ path: `${prefix}.errorAddress`,         value: master.erro.addr });
  values.push({ path: `${prefix}.errorConnectionState`, value: master.erro.con_st });
  values.push({ path: `${prefix}.errorMessage`,         value: master.error });
  values.push({ path: `${prefix}.errorPresent`,         value: master.erro.present });
  values.push({ path: `${prefix}.errorStatus`,          value: master.erro.st });

  // BMS board temperature: WiFi module sends °C — convert to Kelvin
  values.push({ path: `${prefix}.bmsTemperature`, value: typeof slave.temp_bms === 'number' ? slave.temp_bms + 273.15 : slave.temp_bms });

  values.push({ path: `${prefix}.slaveAddress`,        value: slave.address });
  values.push({ path: `${prefix}.slaveTempSensorStatus`, value: slave.st_temp });
  // slaveCellCount removed — replaced by minCellNumber/maxCellNumber on serial path

  // Cell temperatures: WiFi module sends °C — convert to Kelvin
  Object.entries(slave.temp || {}).forEach(([key, value], index) => {
    values.push({ path: `${prefix}.cellTemperature${index + 1}`, value: typeof value === 'number' ? value + 273.15 : value });
  });

  // Cell resistances
  Object.entries(slave.res || {}).forEach(([key, value], index) => {
    values.push({ path: `${prefix}.cellResistance${index + 1}`, value });
  });

  // Cell voltages
  Object.entries(slave.nap || {}).forEach(([key, value], index) => {
    values.push({ path: `${prefix}.cellVoltage${index + 1}`, value });
  });

  return values;
};
