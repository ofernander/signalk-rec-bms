"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const hexer  = require("../plugin/lib/serial/hexer");
const volt   = require("../plugin/lib/serial/modules/volt");
const array  = require("../plugin/lib/serial/modules/array");
const temp   = require("../plugin/lib/serial/modules/temp");
const bat    = require("../plugin/lib/serial/modules/bat");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal response packet matching the wire format the parsers expect:
 *   [0x55, addr, sender, payloadLen, ...payload, 0x00, 0x00, 0xAA]
 *
 * CRC bytes are zeroed — parsers slice payload by position and never
 * re-validate CRC on the receive path.
 */
function makePacket(payloadStr, addr = 0x01, sender = 0x00) {
  const payload = Buffer.from(payloadStr, "utf8");
  const buf = Buffer.alloc(payload.length + 7);
  buf.writeUInt8(0x55, 0);
  buf.writeUInt8(addr, 1);
  buf.writeUInt8(sender, 2);
  buf.writeUInt8(payload.length, 3);
  payload.copy(buf, 4);
  buf.writeUInt8(0x00, 4 + payload.length);     // CRC hi
  buf.writeUInt8(0x00, 4 + payload.length + 1); // CRC lo
  buf.writeUInt8(0xAA, 4 + payload.length + 2); // ETX
  return buf;
}

/**
 * Build a packet whose payload is raw binary (LE floats / uint8s),
 * used for LCD1, CELL, PTEM, BTEM, ERRO responses.
 */
function makeBinaryPacket(payloadBuf, payloadLen = null, addr = 0x01, sender = 0x00) {
  const len = payloadLen !== null ? payloadLen : payloadBuf.length;
  const buf = Buffer.alloc(payloadBuf.length + 7);
  buf.writeUInt8(0x55, 0);
  buf.writeUInt8(addr, 1);
  buf.writeUInt8(sender, 2);
  buf.writeUInt8(len, 3);
  payloadBuf.copy(buf, 4);
  buf.writeUInt8(0x00, 4 + payloadBuf.length);
  buf.writeUInt8(0x00, 4 + payloadBuf.length + 1);
  buf.writeUInt8(0xAA, 4 + payloadBuf.length + 2);
  return buf;
}

// ---------------------------------------------------------------------------
// hexer
// ---------------------------------------------------------------------------

describe("hexer", () => {
  describe("validateAddress", () => {
    it("accepts valid target addresses (1–127)", () => {
      assert.equal(hexer.validateAddress(1,   "target"), true);
      assert.equal(hexer.validateAddress(64,  "target"), true);
      assert.equal(hexer.validateAddress(127, "target"), true);
    });
    it("rejects out-of-range target addresses", () => {
      assert.equal(hexer.validateAddress(0,   "target"), false);
      assert.equal(hexer.validateAddress(128, "target"), false);
      assert.equal(hexer.validateAddress(-1,  "target"), false);
    });
    it("accepts sender address 0 only", () => {
      assert.equal(hexer.validateAddress(0, "sender"), true);
      assert.equal(hexer.validateAddress(1, "sender"), false);
    });
  });

  describe("buildPacket", () => {
    it("produces correct framing bytes", () => {
      const cmd = Buffer.from("BVOL?");
      const pkt = hexer.buildPacket(2, cmd);
      assert.equal(pkt[0], 0x55, "STX");
      assert.equal(pkt[1], 2,    "address");
      assert.equal(pkt[2], 0,    "sender");
      assert.equal(pkt[3], cmd.length, "payload length byte");
      assert.equal(pkt[pkt.length - 1], 0xAA, "ETX");
    });
    it("total length = payload + 7", () => {
      const cmd = Buffer.from("LCD1?");
      assert.equal(hexer.buildPacket(2, cmd).length, cmd.length + 7);
    });
    it("throws on invalid target address", () => {
      assert.throws(() => hexer.buildPacket(0,   Buffer.from("X")), /Invalid target/);
      assert.throws(() => hexer.buildPacket(128, Buffer.from("X")), /Invalid target/);
    });
  });
});

// ---------------------------------------------------------------------------
// volt module — text-payload parsers
// ---------------------------------------------------------------------------

describe("volt parsers", () => {
  const cases = [
    { fn: volt.parseBVOLResponse,  key: "balEndVoltage",               value: 3.45, type: "BVOL" },
    { fn: volt.parseBMINResponse,  key: "balStartVoltage",             value: 3.40, type: "BMIN" },
    { fn: volt.parseCMAXResponse,  key: "maxAllowedCellVoltage",       value: 3.65, type: "CMAX" },
    { fn: volt.parseMAXHResponse,  key: "maxAllowedVoltageHysteresis", value: 0.05, type: "MAXH" },
    { fn: volt.parseCMINResponse,  key: "minAllowedCellVoltage",       value: 2.80, type: "CMIN" },
    { fn: volt.parseMINHResponse,  key: "minAllowedVoltageHysteresis", value: 0.10, type: "MINH" },
    { fn: volt.parseCHARResponse,  key: "endChargeVoltage",            value: 3.60, type: "CHAR" },
    { fn: volt.parseCHISResponse,  key: "endChargeHysteresis",         value: 0.02, type: "CHIS" },
    { fn: volt.parseUBDIResponse,  key: "endOfChargeCellDifference",   value: 0.03, type: "UBDI" },
    { fn: volt.parseCFVCResponse,  key: "floatVoltageCoefficient",     value: 1.00, type: "CFVC" },
    { fn: volt.parseRAZLResponse,  key: "maxAllowedCellVoltDiff",      value: 0.15, type: "RAZL" },
  ];

  for (const { fn, key, value, type } of cases) {
    it(`${type}: parses ${key} = ${value}`, () => {
      const pkt = makePacket(String(value));
      const result = fn([pkt]);
      assert.equal(result.type, type);
      assert.ok(Math.abs(result.data[key] - value) < 0.0001,
        `expected ${value}, got ${result.data[key]}`);
    });
    it(`${type}: returns null on missing packet`, () => {
      assert.equal(fn([]), null);
    });
  }
});

// ---------------------------------------------------------------------------
// array module
// ---------------------------------------------------------------------------

describe("array parsers", () => {
  describe("parseLCD1Response", () => {
    it("parses all float fields from a 35-byte data packet", () => {
      // Data packet: payload = 7 floats × 4 bytes = 28 bytes; packet[3] = 28
      const payload = Buffer.alloc(28);
      payload.writeFloatLE(2.80, 0);   // minVoltage
      payload.writeFloatLE(3.65, 4);   // maxVoltage
      payload.writeFloatLE(15.5, 8);   // current
      payload.writeFloatLE(25.0, 12);  // temperature
      payload.writeFloatLE(48.0, 16);  // packVoltage
      payload.writeFloatLE(0.80, 20);  // soc
      payload.writeFloatLE(0.99, 24);  // soh
      const pkt = makeBinaryPacket(payload, 28);
      // parseLCD1Response picks the packet where p.length === 35
      const result = array.parseLCD1Response([pkt]);
      assert.equal(result.type, "LCD1");
      assert.ok(Math.abs(result.data.minVoltage  - 2.80) < 0.001);
      assert.ok(Math.abs(result.data.maxVoltage  - 3.65) < 0.001);
      assert.ok(Math.abs(result.data.current     - 15.5) < 0.001);
      assert.ok(Math.abs(result.data.packVoltage - 48.0) < 0.001);
      assert.ok(Math.abs(result.data.soc         - 0.80) < 0.001);
      assert.ok(Math.abs(result.data.soh         - 0.99) < 0.001);
    });
    it("returns null when no 35-byte packet present", () => {
      assert.equal(array.parseLCD1Response([]), null);
    });
  });

  describe("parseCELLResponse", () => {
    it("parses numBMSUnits and 4 cell voltages for a 1-unit pack", () => {
      // Size packet: payload = "1" (1 byte ascii), packet[3] = 1
      const sizePkt = makeBinaryPacket(Buffer.from("1"), 1);
      // Data packet: 4 floats = 16 bytes, packet[3] = 16
      const cellData = Buffer.alloc(16);
      cellData.writeFloatLE(3.50, 0);
      cellData.writeFloatLE(3.51, 4);
      cellData.writeFloatLE(3.52, 8);
      cellData.writeFloatLE(3.53, 12);
      const dataPkt = makeBinaryPacket(cellData, 16);
      const result = array.parseCELLResponse([sizePkt, dataPkt]);
      assert.equal(result.type, "CELL");
      assert.equal(result.data.numBMSUnits, 1);
      assert.equal(result.data.cellVoltages.length, 4);
      assert.ok(Math.abs(result.data.cellVoltages[0] - 3.50) < 0.001);
      assert.ok(Math.abs(result.data.cellVoltages[3] - 3.53) < 0.001);
    });
    it("returns null on empty input", () => {
      assert.equal(array.parseCELLResponse([]), null);
    });
  });

  describe("parseBTEMResponse", () => {
    it("parses bmsTemperature from a 4-byte data packet", () => {
      const sizePkt = makeBinaryPacket(Buffer.from("1"), 1);
      const data = Buffer.alloc(4);
      data.writeFloatLE(38.5, 0);
      const dataPkt = makeBinaryPacket(data, 4);
      const result = array.parseBTEMResponse([sizePkt, dataPkt]);
      assert.equal(result.type, "BTEM");
      assert.ok(Math.abs(result.data.bmsTemperature - 38.5) < 0.001);
    });
    it("returns null on empty input", () => {
      assert.equal(array.parseBTEMResponse([]), null);
    });
  });

  describe("parseERROResponse", () => {
    it("parses error fields from a 4-byte data packet", () => {
      const sizePkt = makeBinaryPacket(Buffer.from("1"), 1);
      const data = Buffer.alloc(4);
      data.writeUInt8(1, 0); // hasError
      data.writeUInt8(2, 1); // bmsUnit
      data.writeUInt8(5, 2); // errorCode
      data.writeUInt8(3, 3); // cellOrSensor
      const dataPkt = makeBinaryPacket(data, 4);
      const result = array.parseERROResponse([sizePkt, dataPkt]);
      assert.equal(result.type, "ERRO");
      assert.equal(result.data.hasError,     1);
      assert.equal(result.data.bmsUnit,      2);
      assert.equal(result.data.errorCode,    5);
      assert.equal(result.data.cellOrSensor, 3);
    });
    it("returns null on empty input", () => {
      assert.equal(array.parseERROResponse([]), null);
    });
  });
});

// ---------------------------------------------------------------------------
// temp module
// ---------------------------------------------------------------------------

describe("temp parsers", () => {
  const cases = [
    { fn: temp.parseTMAXResponse, key: "cellOverTempSwitchOff",          value: 60.0, type: "TMAX" },
    { fn: temp.parseTMINResponse, key: "underTempChargeDisable",         value: 5.0,  type: "TMIN" },
    { fn: temp.parseTBALResponse, key: "bmsOverTempSwitchOff",           value: 65.0, type: "TBAL" },
    { fn: temp.parseBMTHResponse, key: "bmsOverTempSwitchOffHysteresis", value: 5.0,  type: "BMTH" },
  ];

  for (const { fn, key, value, type } of cases) {
    it(`${type}: parses ${key}`, () => {
      const pkt = makePacket(String(value));
      const result = fn([pkt]);
      assert.equal(result.type, type);
      assert.ok(Math.abs(result.data[key] - value) < 0.0001);
    });
    it(`${type}: returns null on missing packet`, () => {
      assert.equal(fn([]), null);
    });
  }
});

// ---------------------------------------------------------------------------
// bat module
// ---------------------------------------------------------------------------

describe("bat parsers", () => {
  it("CYCL: parses batteryCycleCount as integer", () => {
    const result = bat.parseCYCLResponse([makePacket("42")]);
    assert.equal(result.type, "CYCL");
    assert.equal(result.data.batteryCycleCount, 42);
  });
  it("CYCL: returns null on missing packet", () => {
    assert.equal(bat.parseCYCLResponse([]), null);
  });

  it("CAPA: parses capacity as float", () => {
    const result = bat.parseCAPAResponse([makePacket("200.0")]);
    assert.equal(result.type, "CAPA");
    assert.ok(Math.abs(result.data.capacity - 200.0) < 0.0001);
  });
  it("CAPA: returns null on missing packet", () => {
    assert.equal(bat.parseCAPAResponse([]), null);
  });
});
