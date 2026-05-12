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
    throw new Error(`[signalk-rec-bms - serial - array] No configuration found for command tag "${tag}"`);
  }
  const commandStr = config.command || (tag + "?");
  const packet = hexer.buildPacket(targetAddress, Buffer.from(commandStr));
  return packet;
}

//parsers
function parseLCD1Response(input) {
  const packet = Array.isArray(input)
    ? input.find(p => p.length === 35)
    : input;
  if (!packet) {
    return null;
  }
  const result = {
    type: "LCD1",
    data: {
      minVoltage:  packet.readFloatLE(4),
      maxVoltage:  packet.readFloatLE(8),
      current:     packet.readFloatLE(12),
      temperature: packet.readFloatLE(16),
      packVoltage: packet.readFloatLE(20),
      soc:         packet.readFloatLE(24),
      soh:         packet.readFloatLE(28)
    }
  };
  return result;
}

function parseLCD3Response(input) {
  const packet = Array.isArray(input)
    ? input.find(p => p[3] >= 8)
    : input;
  if (!packet) {
    return null;
  }
  let values = [];
  for (let i = 0; i < 8; i++) {
    values.push(packet.readUInt8(4 + i));
  }
  const result = {
    type: "LCD3",
    data: {
      minCellBmsAddress: values[0],
      minCellNumber: values[1],
      maxCellBmsAddress: values[2],
      maxCellNumber: values[3],
      maxTempSensBmsAddress: values[4],
      maxTempSensNumber: values[5],
      ah: (values[6] << 8) | values[7]
    }
  };
  return result;
}

function parseIDNResponse(input) {
  const packet = Array.isArray(input) ? input[0] : input;
  const payload = packet.slice(4, packet.length - 3).toString('utf8');
  const result = {
    type: "IDN",
    data: payload
  };
  return result;
}

function parseCELLResponse(packets) {
  if (!Array.isArray(packets) || packets.length < 2) {
    return null;
  }

  const sizePacket = packets.find(p => p[3] === 1);
  if (!sizePacket) {
    return null;
  }

  const numBMSUnits = parseInt(sizePacket.slice(4, 5).toString('utf8'), 10);
  if (isNaN(numBMSUnits) || numBMSUnits <= 0) {
    return null;
  }

  const cellVoltages = [];
  const dataPackets = packets.filter(p => p[3] === 16);

  dataPackets.forEach(packet => {
    for (let i = 0; i < 4; i++) {
      const offset = 4 + i * 4;
      cellVoltages.push(packet.readFloatLE(offset));
    }
  });

  const expectedCellCount = numBMSUnits * 4;
  if (cellVoltages.length !== expectedCellCount) {
  }

  const result = {
    type: "CELL",
    data: {
      numBMSUnits,
      cellVoltages
    }
  };
  return result;
}

function parsePTEMResponse(packets) {
  if (!Array.isArray(packets) || packets.length < 2) {
    return null;
  }

  const sizePacket = packets.find(p => p[3] === 1);
  const dataPackets = packets.filter(p => p[3] !== 1);

  if (!sizePacket || dataPackets.length === 0) {
    return null;
  }

  const numBMSUnits = parseInt(sizePacket.slice(4, 5).toString('utf8'), 10);

  let temperature = [];
  dataPackets.forEach(packet => {
    const floatCount = (packet.length - 7) / 4;
    for (let i = 0; i < floatCount; i++) {
      const offset = 4 + i * 4;
      temperature.push(packet.readFloatLE(offset));
    }
  });

  const result = {
    type: "PTEM",
    data: {
      numBMSUnits,
      temperature
    }
  };
  return result;
}

function parseRINTResponse(packets) {
  if (!Array.isArray(packets) || packets.length < 2) {
    return null;
  }

  const sizePacket = packets.find(p => p[3] === 1);
  if (!sizePacket) {
    return null;
  }

  const numBMSUnits = parseInt(sizePacket.slice(4, 5).toString('utf8'), 10);
  if (isNaN(numBMSUnits) || numBMSUnits <= 0) {
    return null;
  }

  const resistances = [];
  const dataPackets = packets.filter(p => p[3] === 16);

  dataPackets.forEach(packet => {
    for (let i = 0; i < 4; i++) {
      const offset = 4 + i * 4;
      resistances.push(packet.readFloatLE(offset));
    }
  });

  const expectedCount = numBMSUnits * 4;
  if (resistances.length !== expectedCount) {
  }

  const result = {
    type: "RINT",
    data: {
      numBMSUnits,
      resistances
    }
  };
  return result;
}

function parseBTEMResponse(packets) {
  if (!Array.isArray(packets) || packets.length < 2) {
    return null;
  }
  const sizePacket = packets.find(p => p[3] === 1);
  const dataPacket = packets.find(p => p[3] === 4);
  if (!sizePacket || !dataPacket) {
    return null;
  }

  const temp = dataPacket.readFloatLE(4);
  const result = {
    type: "BTEM",
    data: {
      bmsTemperature: temp
    }
  };
  return result;
}

function parseERROResponse(packets) {
  if (!Array.isArray(packets) || packets.length < 2) {
    return null;
  }

  const sizePacket = packets.find(p => p[3] === 1);
  const dataPacket = packets.find(p => p[3] === 4);
  if (!sizePacket || !dataPacket) {
    return null;
  }

  const result = {
    type: "ERRO",
    data: {
      hasError: dataPacket.readUInt8(4),
      bmsUnit: dataPacket.readUInt8(5),
      errorCode: dataPacket.readUInt8(6),
      cellOrSensor: dataPacket.readUInt8(7)
    }
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
    case "LCD1": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.minCellVoltage`,          value: d.minVoltage },
            { path: `${prefix}.maxCellVoltage`,          value: d.maxVoltage },
            { path: `${prefix}.current`,                 value: d.current },
            //{ path: `${prefix}.temperature`,           value: d.temperature },
            { path: `${prefix}.voltage`,                 value: d.packVoltage },
            { path: `${prefix}.capacity.stateOfCharge`,  value: d.soc },
            { path: `${prefix}.capacity.stateOfHealth`,  value: d.soh }
          ]
        }]
      };
      break;
    }
    case "LCD3": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.slaveAddress`,                value: d.minCellBmsAddress },
            { path: `${prefix}.minCellNumber`,               value: d.minCellNumber },
            { path: `${prefix}.maxCellNumber`,               value: d.maxCellNumber },
            { path: `${prefix}.maxTempSensBmsAddress`,       value: d.maxTempSensBmsAddress },
            { path: `${prefix}.maxTempSensNumber`,           value: d.maxTempSensNumber },
            { path: `${prefix}.capacity.dischargeSinceFull`, value: d.ah * 3600 }
          ]
        }]
      };
      break;
    }
    case "IDN": {
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.id`, value: parsed.data }
          ]
        }]
      };
      break;
    }
    case "CELL": {
      const d = parsed.data;
      let values = [
        { path: `${prefix}.numBMSUnits`, value: d.numBMSUnits }
      ];
      d.cellVoltages.forEach((voltage, index) => {
        values.push({ path: `${prefix}.cellVoltage${index + 1}`, value: voltage });
      });
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: values
        }]
      };
      break;
    }
    case "PTEM": {
      const d = parsed.data;
      const sensorCount = (options && options.numTempSensors) ? options.numTempSensors : 1;
      const temperatures = d.temperature.slice(0, sensorCount);
      let values = [
        { path: `${prefix}.numBMSUnits`, value: d.numBMSUnits }
      ];
      temperatures.forEach((temp, index) => {
        values.push({ path: `${prefix}.cellTemperature${index + 1}`, value: temp });
      });
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: values
        }]
      };
      break;
    }
    case "RINT": {
      const d = parsed.data;
      let values = [
        { path: `${prefix}.numBMSUnits`, value: d.numBMSUnits }
      ];
      d.resistances.forEach((res, index) => {
        values.push({ path: `${prefix}.cellResistance${index + 1}`, value: res });
      });
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: values
        }]
      };
      break;
    }
    case "BTEM": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.bmsTemperature`, value: d.bmsTemperature }
          ]
        }]
      };
      break;
    }
    case "ERRO": {
      const d = parsed.data;
      delta = {
        context,
        updates: [{
          timestamp: new Date().toISOString(),
          values: [
            { path: `${prefix}.errorPresent`, value: d.hasError },
            { path: `${prefix}.errorAddress`, value: d.bmsUnit },
            { path: `${prefix}.errorCode`,    value: d.errorCode },
            { path: `${prefix}.errorSource`,  value: d.cellOrSensor }
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

/* ============================================================================
   4. EXPORTS
   Export functions for building commands, parsing responses, and building deltas.
   ============================================================================ */
module.exports = {
  buildCommand,
  getDelta,
  parseLCD1Response,
  parseLCD3Response,
  parseIDNResponse,
  parseCELLResponse,
  parsePTEMResponse,
  parseRINTResponse,
  parseBTEMResponse,
  parseERROResponse
};
