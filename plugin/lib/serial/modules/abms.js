"use strict";
const hexer = require('../hexer');
const atlas = require('../atlas.json');
const atlasMapping = {};
atlas.forEach(entry => {
  atlasMapping[entry.tag] = entry;
});
function buildCommand(tag, targetAddress) {
  const config = atlasMapping[tag];
  if (!config) {
    throw new Error(`[signalk-rec-bms - serial - abms] No configuration found for command tag "${tag}"`);
  }
  const commandStr = config.command || (tag + "?");
  const packet = hexer.buildPacket(targetAddress, Buffer.from(commandStr));
  return packet;
}
function parseCAL1Response(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "CAL1",
    data: { calibrationOffsetCell1: value }
  };
  return result;
}
function parseCAL2Response(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "CAL2",
    data: { calibrationOffsetCell2: value }
  };
  return result;
}
function parseCAL3Response(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "CAL3",
    data: { calibrationOffsetCell3: value }
  };
  return result;
}
function parseCAL4Response(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseFloat(payload);
  const result = {
    type: "CAL4",
    data: { calibrationOffsetCell4: value }
  };
  return result;
}
function parseSERIResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const value = parseInt(payload, 10);
  const result = {
    type: "SERI",
    data: { abmsSerialNumber: value }
  };
  return result;
}
function parseSWVRResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const result = {
    type: "SWVR",
    data: { abmsSoftwareVersion: payload }
  };
  return result;
}
function parseHWVRResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const result = {
    type: "HWVR",
    data: { abmsHardwareVersion: payload }
  };
  return result;
}
function parseTIMEResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const result = {
    type: "TIME",
    data: { abmsTime: payload }
  };
  return result;
}
function parseDATEResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const result = {
    type: "DATE",
    data: { abmsDate: payload }
  };
  return result;
}
function parseWCBIResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  if (!packet) {
    return null;
  }
  const payload = packet.slice(4, packet.length - 3).toString('utf8').trim();
  const value = parseInt(payload, 10);
  if (isNaN(value)) {
    return null;
  }
  const result = {
    type: "WCBI",
    data: { balancingCellNumber: value }
  };
  return result;
}
function getDelta(parsed, options, app) {
  let vesselId = (typeof app.getSelfId === 'function') ? app.getSelfId() : (app.selfId || "self");
  const context = `vessels.${vesselId}`;
  const prefix = options.deltaPrefix || "electrical.batteries.bms";
  let delta = null;
  switch (parsed.type) {
    case "CAL1": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.calibrationOffsetCell1`, value: d.calibrationOffsetCell1 }
          ]
        }]
      };
      break;
    }
    case "CAL2": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.calibrationOffsetCell2`, value: d.calibrationOffsetCell2 }
          ]
        }]
      };
      break;
    }
    case "CAL3": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.calibrationOffsetCell3`, value: d.calibrationOffsetCell3 }
          ]
        }]
      };
      break;
    }
    case "CAL4": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.calibrationOffsetCell4`, value: d.calibrationOffsetCell4 }
          ]
        }]
      };
      break;
    }
    case "SERI": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.name`, value: "1A-" + d.abmsSerialNumber }
          ]
        }]
      };
      break;
    }
    case "SWVR": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.abmsSoftwareVersion`, value: d.abmsSoftwareVersion }
          ]
        }]
      };
      break;
    }
    case "HWVR": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.abmsHardwareVersion`, value: d.abmsHardwareVersion }
          ]
        }]
      };
      break;
    }
    case "TIME": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.time`, value: d.abmsTime }
          ]
        }]
      };
      break;
    }
    case "DATE": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.date`, value: d.abmsDate }
          ]
        }]
      };
      break;
    }
    case "WCBI": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.balancingCellNumber`, value: d.balancingCellNumber }
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
  parseCAL1Response,
  parseCAL2Response,
  parseCAL3Response,
  parseCAL4Response,
  parseSERIResponse,
  parseSWVRResponse,
  parseHWVRResponse,
  parseTIMEResponse,
  parseDATEResponse,
  parseWCBIResponse
};