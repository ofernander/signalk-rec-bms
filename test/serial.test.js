"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("events");
const serialFactory = require("../plugin/lib/serial/serial");

// Fake SerialPort: each test decides whether open() succeeds via FakePort.nextOpenError
class FakePort extends EventEmitter {
  constructor(opts) {
    super();
    this.opts = opts;
    this.isOpen = false;
    this.writes = [];
    FakePort.instances.push(this);
  }
  open(cb) {
    setImmediate(() => {
      const err = FakePort.nextOpenError;
      if (err) return cb(err);
      this.isOpen = true;
      this.emit("open");
      cb(null);
    });
  }
  write(packet, cb) {
    this.writes.push(packet.slice(4, packet.length - 3).toString());
    setImmediate(() => cb(null));
  }
  close(cb) {
    this.isOpen = false;
    if (cb) cb(null);
  }
  // Simulate a USB unplug
  unplug() {
    this.isOpen = false;
    this.emit("close", Object.assign(new Error("Device disconnected"), { disconnected: true }));
  }
}

function fakeApp() {
  return {
    statuses: [],
    errors: [],
    debug() {},
    setPluginStatus(msg) { this.statuses.push(msg); },
    setPluginError(msg) { this.errors.push(msg); },
    streambundle: { getSelfStream: () => ({ forEach: () => () => {} }) }
  };
}

const options = {
  serial: { device: "/dev/fake", baudRate: 115200, targetAddress: 2 },
  deltaPrefix: "electrical.batteries.bms"
};

const flush = async (n = 3) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

describe("serial connection", () => {
  beforeEach(() => {
    FakePort.instances = [];
    FakePort.nextOpenError = null;
  });

  it("opens the port and starts polling", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const app = fakeApp();
    const serial = serialFactory(app, () => {}, { SerialPort: FakePort });
    serial.start(options);
    await flush();

    assert.equal(FakePort.instances.length, 1);
    assert.equal(FakePort.instances[0].opts.path, "/dev/fake");
    assert.ok(FakePort.instances[0].writes.length > 0, "commands written after open");
    assert.ok(app.statuses.some(s => s.startsWith("Connected")));
    serial.stop();
  });

  it("reconnects with backoff after the port is unplugged", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const app = fakeApp();
    const serial = serialFactory(app, () => {}, { SerialPort: FakePort });
    serial.start(options);
    await flush();

    FakePort.instances[0].unplug();
    assert.match(app.errors.at(-1), /disconnected.*retrying in 5s/);

    // Reopen fails: next retry should back off to 10s
    FakePort.nextOpenError = new Error("No such file or directory");
    t.mock.timers.tick(5000);
    await flush();
    assert.equal(FakePort.instances.length, 2);
    assert.match(app.errors.at(-1), /retrying in 10s/);

    // Adapter is back
    FakePort.nextOpenError = null;
    t.mock.timers.tick(10000);
    await flush();
    assert.equal(FakePort.instances.length, 3);
    assert.ok(FakePort.instances[2].isOpen);
    assert.ok(app.statuses.at(-1).startsWith("Connected"));

    // Backoff resets after a successful open
    FakePort.instances[2].unplug();
    assert.match(app.errors.at(-1), /retrying in 5s/);
    serial.stop();
  });

  it("stop() cancels a pending reconnect", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const app = fakeApp();
    const serial = serialFactory(app, () => {}, { SerialPort: FakePort });
    serial.start(options);
    await flush();

    FakePort.instances[0].unplug();
    serial.stop();
    t.mock.timers.tick(60000);
    await flush();
    assert.equal(FakePort.instances.length, 1, "no new port opened after stop");
  });

  it("stop() closes the port without triggering a reconnect", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const app = fakeApp();
    const serial = serialFactory(app, () => {}, { SerialPort: FakePort });
    serial.start(options);
    await flush();

    const port = FakePort.instances[0];
    serial.stop();
    assert.equal(port.isOpen, false);
    assert.equal(app.errors.length, 0);
  });

  it("handleCommand rejects with 503 while disconnected", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const app = fakeApp();
    const serial = serialFactory(app, () => {}, { SerialPort: FakePort });
    serial.start(options);
    await flush();
    FakePort.instances[0].unplug();

    await assert.rejects(serial.handleCommand("CHAR?"), err => err.statusCode === 503);
    serial.stop();
  });

  it("handleCommand rejects unknown and empty commands with 400", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const serial = serialFactory(fakeApp(), () => {}, { SerialPort: FakePort });
    serial.start(options);
    await flush();

    await assert.rejects(serial.handleCommand("NOPE?"), err => err.statusCode === 400);
    await assert.rejects(serial.handleCommand("  "), err => err.statusCode === 400);
    serial.stop();
  });
});
