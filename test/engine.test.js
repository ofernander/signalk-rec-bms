"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const CommandEngine = require("../plugin/lib/serial/engine");

// Minimal stand-in for a SerialPort: records writes and completes them
// asynchronously, like the real port does.
function fakePort({ writeError = null } = {}) {
  return {
    writes: [],
    write(packet, cb) {
      this.writes.push(packet.slice(4, packet.length - 3).toString());
      setImmediate(() => cb(writeError));
    }
  };
}

const tick = () => new Promise(resolve => setImmediate(resolve));
const pkt = (s) => Buffer.from(s);

describe("CommandEngine", () => {
  it("resolves with the response packets", async () => {
    const port = fakePort();
    const engine = new CommandEngine(port);
    const p = engine.sendCommand("CHEM", 1);
    await tick();
    assert.deepEqual(port.writes, ["CHEM?"]);
    engine.processPacket(pkt("a"));
    assert.deepEqual(await p, [pkt("a")]);
  });

  it("waits for expectedPackets before resolving", async () => {
    const port = fakePort();
    const engine = new CommandEngine(port);
    const p = engine.sendCommand("ERRO", 1); // expectedPackets: 2
    await tick();
    engine.processPacket(pkt("size"));
    assert.ok(engine.activeCommand, "still waiting for second packet");
    engine.processPacket(pkt("data"));
    assert.deepEqual(await p, [pkt("size"), pkt("data")]);
  });

  it("queues commands instead of dropping them while one is in flight", async () => {
    const port = fakePort();
    const engine = new CommandEngine(port);
    const p1 = engine.sendCommand("CHEM", 1);
    const p2 = engine.sendCommand("CYCL", 1);
    await tick();
    assert.deepEqual(port.writes, ["CHEM?"], "second command not written yet");

    engine.processPacket(pkt("1"));
    assert.deepEqual(await p1, [pkt("1")]);
    await tick(); await tick();
    assert.deepEqual(port.writes, ["CHEM?", "CYCL?"]);

    engine.processPacket(pkt("2"));
    assert.deepEqual(await p2, [pkt("2")]);
  });

  it("runs priority commands next without interrupting the active command", async () => {
    const port = fakePort();
    const engine = new CommandEngine(port);
    const p1 = engine.sendCommand("CHEM", 1);
    const p2 = engine.sendCommand("CYCL", 1);
    const pManual = engine.sendCommand("CAPA", 1, "CAPA?", { priority: true });
    await tick();

    engine.processPacket(pkt("chem"));
    assert.deepEqual(await p1, [pkt("chem")], "active command keeps its response");
    await tick(); await tick();
    assert.deepEqual(port.writes, ["CHEM?", "CAPA?"], "priority command jumps the queue");

    engine.processPacket(pkt("capa"));
    assert.deepEqual(await pManual, [pkt("capa")]);
    await tick(); await tick();
    engine.processPacket(pkt("cycl"));
    assert.deepEqual(await p2, [pkt("cycl")]);
  });

  it("a timed-out command does not clear the command after it", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const port = fakePort();
    const engine = new CommandEngine(port);
    const p1 = engine.sendCommand("CHEM", 1); // timeout 100ms
    const p2 = engine.sendCommand("CYCL", 1);
    await tick();

    t.mock.timers.tick(100);
    await assert.rejects(p1, /timed out/);
    await tick(); await tick();
    assert.equal(engine.activeCommand.tag, "CYCL");

    engine.processPacket(pkt("ok"));
    assert.deepEqual(await p2, [pkt("ok")]);
  });

  it("resolves write-only commands immediately but holds the bus to settle", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const port = fakePort();
    const engine = new CommandEngine(port);
    const p = engine.sendCommand("CHAR", 1, "CHAR 3.5", { expectResponse: false });
    const next = engine.sendCommand("CHEM", 1);
    assert.deepEqual(await p, { raw: true });

    let unhandled = null;
    engine.on("unhandledPacket", pk => { unhandled = pk; });
    engine.processPacket(pkt("echo"));
    assert.deepEqual(unhandled, pkt("echo"), "reply to set command is discarded");
    assert.deepEqual(port.writes, ["CHAR 3.5"], "next command waits for settle");

    t.mock.timers.tick(250);
    await tick(); await tick();
    assert.deepEqual(port.writes, ["CHAR 3.5", "CHEM?"]);
    engine.processPacket(pkt("chem"));
    assert.deepEqual(await next, [pkt("chem")]);
  });

  it("rejects on write error and continues with the queue", async () => {
    const port = fakePort({ writeError: new Error("EIO") });
    const engine = new CommandEngine(port);
    await assert.rejects(engine.sendCommand("CHEM", 1), /EIO/);
    assert.equal(engine.activeCommand, null);
  });

  it("rejects unknown tags and invalid addresses", async () => {
    const engine = new CommandEngine(fakePort());
    await assert.rejects(engine.sendCommand("NOPE", 1), /No configuration/);
    await assert.rejects(engine.sendCommand("CHEM", 0), /Invalid target address/);
  });

  it("rejects non-priority commands when the queue is full", async () => {
    const engine = new CommandEngine(fakePort(), { maxQueue: 1 });
    engine.sendCommand("CHEM", 1).catch(() => {});        // goes straight in flight
    engine.sendCommand("CYCL", 1).catch(() => {});        // queued (queue length 1)
    await assert.rejects(engine.sendCommand("CAPA", 1), /Queue full/);
    const manual = engine.sendCommand("CAPA", 1, null, { priority: true });
    engine.close();
    await assert.rejects(manual, /Closed/);
  });

  it("close() rejects active and queued commands and refuses new ones", async () => {
    const engine = new CommandEngine(fakePort());
    const p1 = engine.sendCommand("CHEM", 1);
    const p2 = engine.sendCommand("CYCL", 1);
    await tick();
    engine.close();
    await assert.rejects(p1, /Closed/);
    await assert.rejects(p2, /Closed/);
    await assert.rejects(engine.sendCommand("CHEM", 1), /Closed/);
  });

  it("emits unhandledPacket when nothing is waiting", () => {
    const engine = new CommandEngine(fakePort());
    let seen = null;
    engine.on("unhandledPacket", p => { seen = p; });
    engine.processPacket(pkt("x"));
    assert.deepEqual(seen, pkt("x"));
  });
});
