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
    throw new Error(`[signalk-rec-bms - serial - volt] No configuration found for command tag "${tag}"`);
  }
  const commandStr = config.command || (tag + "?");
  const packet = hexer.buildPacket(targetAddress, Buffer.from(commandStr));
  return packet;
}

//parsers
function parseBVOLResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "BVOL",
    data: { balEndVoltage: value }
  };
  return result;
}

function parseBMINResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "BMIN",
    data: { balStartVoltage: value }
  };
  return result;
}

function parseCMAXResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "CMAX",
    data: { maxAllowedCellVoltage: value }
  };
  return result;
}

function parseMAXHResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "MAXH",
    data: { maxAllowedVoltageHysteresis: value }
  };
  return result;
}

function parseCMINResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "CMIN",
    data: { minAllowedCellVoltage: value }
  };
  return result;
}

function parseMINHResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "MINH",
    data: { minAllowedVoltageHysteresis: value }
  };
  return result;
}

function parseCHARResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "CHAR",
    data: { endChargeVoltage: value }
  };
  return result;
}

function parseCHISResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "CHIS",
    data: { endChargeHysteresis: value }
  };
  return result;
}

function parseUBDIResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "UBDI",
    data: { endOfChargeCellDifference: value }
  };
  return result;
}

function parseCFVCResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "CFVC",
    data: { floatVoltageCoefficient: value }
  };
  return result;
}

function parseRAZLResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "RAZL",
    data: { maxAllowedCellVoltDiff: value }
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
    case "BVOL": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.balEndVoltage`, value: d.balEndVoltage }
          ]
        }]
      };
      break;
    }
    case "BMIN": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.balStartVoltage`, value: d.balStartVoltage }
          ]
        }]
      };
      break;
    }
    case "CMAX": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.maxAllowedCellVoltage`, value: d.maxAllowedCellVoltage }
          ]
        }]
      };
      break;
    }
    case "MAXH": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.maxAllowedVoltageHysteresis`, value: d.maxAllowedVoltageHysteresis }
          ]
        }]
      };
      break;
    }
    case "CMIN": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.minAllowedCellVoltage`, value: d.minAllowedCellVoltage }
          ]
        }]
      };
      break;
    }
    case "MINH": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.minAllowedVoltageHysteresis`, value: d.minAllowedVoltageHysteresis }
          ]
        }]
      };
      break;
    }
    case "CHAR": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.endChargeVoltage`, value: d.endChargeVoltage }
          ]
        }]
      };
      break;
    }
    case "CHIS": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.endChargeHysteresis`, value: d.endChargeHysteresis }
          ]
        }]
      };
      break;
    }
    case "UBDI": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.endOfChargeCellDifference`, value: d.endOfChargeCellDifference }
          ]
        }]
      };
      break;
    }
    case "CFVC": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.floatVoltageCoefficient`, value: d.floatVoltageCoefficient }
          ]
        }]
      };
      break;
    }
    case "RAZL": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.maxAllowedCellVoltDiff`, value: d.maxAllowedCellVoltDiff }
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
  parseBVOLResponse,
  parseBMINResponse,
  parseCMAXResponse,
  parseMAXHResponse,
  parseCMINResponse,
  parseMINHResponse,
  parseCHARResponse,
  parseCHISResponse,
  parseUBDIResponse,
  parseCFVCResponse,
  parseRAZLResponse
};
