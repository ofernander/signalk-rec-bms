"use strict";

const schema = require('./lib/schema');
const connection = require('./lib/connection');
const HistoryBuffer = require('./lib/history');

const DEFAULT_PREFIX = "electrical.batteries.bms";

module.exports = function(app) {
  let conn;
  let pluginOptions;
  let historyBuffer;

  function publishMeta(options) {
    const p = options.deltaPrefix || DEFAULT_PREFIX;

    const meta = [
      // Live data
      { path: `${p}.minCellVoltage`,                 value: { units: "V",     description: "Minimum cell voltage across all cells" } },
      { path: `${p}.maxCellVoltage`,                 value: { units: "V",     description: "Maximum cell voltage across all cells" } },
      { path: `${p}.cellVoltageDifference`,          value: { units: "V",     description: "Difference between maximum and minimum cell voltage" } },
      { path: `${p}.numBMSUnits`,                    value: {                 description: "Number of ABMS units connected in series" } },
      { path: `${p}.bmsTemperature`,                 value: { units: "K",     description: "BMS board internal temperature" } },
      { path: `${p}.slaveAddress`,                   value: {                 description: "RS-485 address of the BMS unit with the lowest cell voltage" } },
      { path: `${p}.minCellNumber`,                  value: {                 description: "Cell number with the lowest voltage" } },
      { path: `${p}.maxCellNumber`,                  value: {                 description: "Cell number with the highest voltage" } },
      { path: `${p}.maxTempSensBmsAddress`,          value: {                 description: "RS-485 address of BMS unit with the highest temperature sensor reading" } },
      { path: `${p}.maxTempSensNumber`,              value: {                 description: "Sensor number with the highest temperature reading" } },
      { path: `${p}.id`,                             value: {                 description: "Device identification string" } },
      { path: `${p}.errorPresent`,                   value: {                 description: "1 if an error is active, 0 if none" } },
      { path: `${p}.errorAddress`,                   value: {                 description: "RS-485 address of BMS unit reporting the error" } },
      { path: `${p}.errorCode`,                      value: {                 description: "Error code (1-16)" } },
      { path: `${p}.errorSource`,                    value: {                 description: "Cell or sensor number associated with the error" } },
      // Derived
      { path: `${p}.power`,                          value: { units: "W",     description: "Instantaneous power (voltage × current)" } },
      { path: `${p}.capacity.remaining`,             value: { units: "Ah",    description: "Estimated capacity remaining" } },
      { path: `${p}.capacity.nominal`,               value: { units: "Ah",    description: "Nominal battery pack capacity as configured in BMS" } },
      { path: `${p}.capacity.timeRemaining`,         value: { units: "s",     description: "Estimated time to full discharge at current load" } },
      { path: `${p}.timeToFull`,                     value: { units: "s",     description: "Estimated time to full charge at current charge rate" } },
      // Battery
      { path: `${p}.batteryCycleCount`,              value: {                 description: "Number of full charge/discharge cycles" } },
      // Voltage thresholds
      { path: `${p}.balEndVoltage`,                  value: { units: "V",     description: "Cell voltage at which balancing ends" } },
      { path: `${p}.balStartVoltage`,                value: { units: "V",     description: "Cell voltage at which balancing starts" } },
      { path: `${p}.maxAllowedCellVoltage`,          value: { units: "V",     description: "Cell over-voltage switch-off threshold" } },
      { path: `${p}.maxAllowedVoltageHysteresis`,    value: { units: "V",     description: "Over-voltage switch-off hysteresis per cell" } },
      { path: `${p}.minAllowedCellVoltage`,          value: { units: "V",     description: "Cell under-voltage switch-off threshold" } },
      { path: `${p}.minAllowedVoltageHysteresis`,    value: { units: "V",     description: "Under-voltage switch-off hysteresis per cell" } },
      { path: `${p}.endChargeVoltage`,               value: { units: "V",     description: "Cell end-of-charge voltage" } },
      { path: `${p}.endChargeHysteresis`,            value: { units: "V",     description: "End-of-charge voltage hysteresis per cell" } },
      { path: `${p}.endOfChargeCellDifference`,      value: { units: "V",     description: "Maximum allowed cell voltage difference at end of charge" } },
      { path: `${p}.floatVoltageCoefficient`,        value: {                 description: "Float voltage coefficient (multiplier on charge voltage)" } },
      { path: `${p}.maxAllowedCellVoltDiff`,         value: { units: "V",     description: "Maximum allowed cell voltage difference during operation" } },
      // Temperature thresholds
      { path: `${p}.cellOverTempSwitchOff`,          value: { units: "K",     description: "Cell over-temperature switch-off threshold" } },
      { path: `${p}.underTempChargeDisable`,         value: { units: "K",     description: "Under-temperature charge disable threshold" } },
      { path: `${p}.bmsOverTempSwitchOff`,           value: { units: "K",     description: "BMS board over-temperature switch-off threshold" } },
      { path: `${p}.bmsOverTempSwitchOffHysteresis`, value: { units: "K",     description: "BMS board over-temperature switch-off hysteresis" } },
      // Current sensor
      { path: `${p}.currentSensorOffset`,            value: { units: "A",     description: "Current measurement zero offset" } },
      { path: `${p}.currentSensorCoefficient`,       value: { units: "A/V",   description: "Voltage-to-current conversion coefficient" } },
      // SOC
      { path: `${p}.socHysteresis`,                  value: { units: "ratio", description: "SOC end-of-charge hysteresis (0-1)" } },
      { path: `${p}.socReset`,                       value: { units: "ratio", description: "SOC value applied on manual reset (0-1)" } },
      // Outputs
      { path: `${p}.relay1Voltage`,                  value: { units: "V",     description: "Relay 1 activation voltage threshold" } },
      { path: `${p}.relay1Hysteresis`,               value: { units: "V",     description: "Relay 1 voltage hysteresis" } },
      { path: `${p}.opto2Voltage`,                   value: { units: "V",     description: "Optocoupler 2 activation voltage threshold" } },
      { path: `${p}.opto2Hysteresis`,                value: { units: "V",     description: "Optocoupler 2 voltage hysteresis" } },
      // Victron/Wakespeed
      { path: `${p}.chargeCoefficient`,              value: {                 description: "Charge current coefficient (0-5C)" } },
      { path: `${p}.dischargeCoefficient`,           value: {                 description: "Discharge current coefficient (0-5C)" } },
      { path: `${p}.numberOfInverterDevices`,        value: {                 description: "Number of inverter/charger devices on the CAN bus" } },
      { path: `${p}.maxChargeCurrent`,               value: { units: "A",     description: "Maximum charge current per inverter device" } },
      { path: `${p}.maxDischargeCurrent`,            value: { units: "A",     description: "Maximum discharge current per inverter device" } },
      { path: `${p}.minDischargeCellVoltage`,        value: { units: "V",     description: "Cell under-voltage discharge protection threshold" } },
      // ABMS
      { path: `${p}.deviceName`,                     value: {                 description: "BMS device identifier (serial number formatted as 1A-XXXX)" } },
      { path: `${p}.abmsSoftwareVersion`,            value: {                 description: "ABMS firmware software version" } },
      { path: `${p}.abmsHardwareVersion`,            value: {                 description: "ABMS hardware version" } },
      { path: `${p}.time`,                           value: {                 description: "BMS real-time clock time (hh:mm:ss)" } },
      { path: `${p}.date`,                           value: {                 description: "BMS real-time clock date (dd.mm.yyyy)" } },
      { path: `${p}.balancingCellNumber`,            value: {                 description: "Cell number currently being balanced" } },
      { path: `${p}.calibrationOffsetCell1`,         value: { units: "V",     description: "Voltage calibration offset for cell 1" } },
      { path: `${p}.calibrationOffsetCell2`,         value: { units: "V",     description: "Voltage calibration offset for cell 2" } },
      { path: `${p}.calibrationOffsetCell3`,         value: { units: "V",     description: "Voltage calibration offset for cell 3" } },
      { path: `${p}.calibrationOffsetCell4`,         value: { units: "V",     description: "Voltage calibration offset for cell 4" } },
      // Error log
      { path: `${p}.errorLogData`,                   value: {                 description: "Last error log entry (format: code,cell;hh:mm:ss;dd.mm.yyyy)" } },
      { path: `${p}.errorLogDelete`,                 value: {                 description: "Error log delete flag (set to 1 to clear, then restart BMS)" } },
      { path: `${p}.vmaxExceededCount`,              value: {                 description: "Number of times cell over-voltage threshold was exceeded" } },
      { path: `${p}.vminExceededCount`,              value: {                 description: "Number of times cell under-voltage threshold was exceeded" } },
    ];

    app.handleMessage("signalk-rec-bms", {
      updates: [{ meta }]
    });
  }

  function publishDelta(delta) {
    if (historyBuffer) historyBuffer.record(delta);

    const precision = 5;
    const factor = Math.pow(10, precision);

    delta.updates.forEach(update => {
      update.$source = "signalk-rec-bms";
      update.values.forEach(item => {
        if (typeof item.value === "number") {
          item.value = Math.round(item.value * factor) / factor;
        }
      });
    });

    if (delta && delta.updates && delta.updates.some(u => u.values.length > 0)) {
      app.debug(`[INDEX] Publishing delta: ${JSON.stringify(delta)}`);
      app.handleMessage("signalk-rec-bms", delta, "v1");
    } else {
      app.debug("[INDEX] Delta empty after processing, not publishing.");
    }
  }

  // When server security is enabled every request reaching a plugin route is
  // authenticated, but read-only users (including anonymous ones when
  // allow_readonly is set) get through too. Changing BMS settings requires admin.
  function isAdmin(req) {
    const principal = req.skPrincipal;
    return !principal || principal.permissions === 'admin';
  }

  // Mounted by the server at /plugins/signalk-rec-bms/
  function registerWithRouter(router) {
    // Servers >= 2.33 require admin for plugin routes unless declared via
    // router.access(); the read-only routes back the dashboard, so any logged
    // in user may read them. /command is left undeclared (admin only).
    const readonly = typeof router.access === 'function' ? router.access('readonly') : router;

    readonly.get('/info', (req, res) => {
      res.json({
        running: !!conn,
        deltaPrefix: (pluginOptions && pluginOptions.deltaPrefix) || DEFAULT_PREFIX,
        connectionType: pluginOptions && pluginOptions.connection && pluginOptions.connection.connectionType
      });
    });

    readonly.get('/history', (req, res) => {
      if (!historyBuffer) return res.status(503).json({ error: "Buffer not ready" });
      const hours = req.query.hours || 1;
      res.json(historyBuffer.getHistory(hours));
    });

    router.post('/command', (req, res) => {
      const command = req.body && req.body.command;
      if (!isAdmin(req)) {
        return res.status(403).json({ error: "Admin permission required to send BMS commands", command });
      }
      if (!conn) {
        return res.status(503).json({ error: "Plugin not running", command });
      }
      if (typeof conn.handleCommand !== 'function') {
        return res.status(400).json({ error: "Commands are only supported on a serial connection", command });
      }
      conn.handleCommand(command)
        .then(result => res.json(result))
        .catch(err => res.status(err.statusCode || 500).json({ error: err.message, command }));
    });
  }

  var plugin = {
    id: "signalk-rec-bms",
    name: "SignalK-REC-BMS",
    description: "SignalK plugin for REC-BMS",
    schema: schema,
    registerWithRouter,
    start: function(options) {
      pluginOptions = options;
      app.debug(`[INDEX] START invoked with options: ${JSON.stringify(options)}`);
      app.setPluginStatus("Connecting to BMS…");

      const prefix = options.deltaPrefix || DEFAULT_PREFIX;
      const dataDir = typeof app.getDataDirPath === 'function' ? app.getDataDirPath() : null;
      historyBuffer = new HistoryBuffer(prefix, dataDir);

      publishMeta(options);
      conn = connection(options, app, publishDelta);
      conn.start(options);
    },
    stop: function() {
      if (historyBuffer) historyBuffer.stop();
      if (conn) {
        conn.stop();
        conn = null;
      }
      historyBuffer = null;
      app.debug("[INDEX] Plugin stopped");
      app.setPluginStatus("Stopped");
    },
  };

  return plugin;
};
