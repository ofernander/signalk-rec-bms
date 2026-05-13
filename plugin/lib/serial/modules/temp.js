"use strict";
const hexer = require('../hexer');
const atlas = require('../atlas.json'); // Load static configuration from atlas.json

// Build a mapping from command tag to configuration for quick lookup.
const atlasMapping = {};
atlas.forEach(entry => {
  atlasMapping[entry.tag] = entry;
});

//commands
function buildCommand(tag, targetAddress) {
  const config = atlasMapping[tag];
  if (!config) {
    throw new Error(`[signalk-rec-bms - serial - temp] No configuration found for command tag "${tag}"`);
  }
  const commandStr = config.command || (tag + "?");
  const packet = hexer.buildPacket(targetAddress, Buffer.from(commandStr));
  return packet;
}

//parsers
function parseTMAXResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "TMAX",
    data: { cellOverTempSwitchOff: value }
  };
  return result;
}

function parseTMINResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "TMIN",
    data: { underTempChargeDisable: value }
  };
  return result;
}

function parseTBALResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "TBAL",
    data: { bmsOverTempSwitchOff: value }
  };
  return result;
}

function parseBMTHResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "BMTH",
    data: { bmsOverTempSwitchOffHysteresis: value }
  };
  return result;
}

//deltas
function getDelta(parsed, options, app) {
  let vesselId = (typeof app.getSelfId === 'function') ? app.getSelfId() : (app.selfId || "self");
  const context = `vessels.${vesselId}`;
  const prefix = options.deltaPrefix || "electrical.batteries.bms";

  let delta = null;
  switch (parsed.type) {
    case "TMAX": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.cellOverTempSwitchOff`, value: d.cellOverTempSwitchOff + 273.15 }
          ]
        }]
      };
      break;
    }
    case "TMIN": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.underTempChargeDisable`, value: d.underTempChargeDisable + 273.15 }
          ]
        }]
      };
      break;
    }
    case "TBAL": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.bmsOverTempSwitchOff`, value: d.bmsOverTempSwitchOff + 273.15 }
          ]
        }]
      };
      break;
    }
    case "BMTH": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.bmsOverTempSwitchOffHysteresis`, value: d.bmsOverTempSwitchOffHysteresis + 273.15 }
          ]
        }]
      };
      break;
    }
    default:
      break;
  }
  return delta;
}

module.exports = {
  buildCommand,
  getDelta,
  parseTMAXResponse,
  parseTMINResponse,
  parseTBALResponse,
  parseBMTHResponse
};
