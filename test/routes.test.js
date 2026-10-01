"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const pluginFactory = require("../plugin/index");

// Captures handlers registered by registerWithRouter
function fakeRouter({ withAccess = false } = {}) {
  const routes = {};
  const accessLevels = {};
  const router = {
    routes,
    accessLevels,
    get(path, fn) { routes["GET " + path] = fn; },
    post(path, fn) { routes["POST " + path] = fn; }
  };
  if (withAccess) {
    // Mirrors signalk-server >= 2.33 router.access(level)
    router.access = (level) => ({
      get(path, fn) { accessLevels["GET " + path] = level; routes["GET " + path] = fn; },
      post(path, fn) { accessLevels["POST " + path] = level; routes["POST " + path] = fn; }
    });
  }
  return router;
}

function call(handler, req = {}) {
  return new Promise(resolve => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); }
    };
    handler({ query: {}, body: {}, ...req }, res);
  });
}

function setup() {
  const app = { debug() {}, setPluginStatus() {} };
  const plugin = pluginFactory(app);
  const router = fakeRouter();
  plugin.registerWithRouter(router);
  return router.routes;
}

describe("plugin routes", () => {
  it("declares dashboard routes read-only and leaves /command admin-only on servers with router.access", () => {
    const plugin = pluginFactory({ debug() {}, setPluginStatus() {} });
    const router = fakeRouter({ withAccess: true });
    plugin.registerWithRouter(router);
    assert.equal(router.accessLevels["GET /info"], "readonly");
    assert.equal(router.accessLevels["GET /history"], "readonly");
    assert.equal(router.accessLevels["POST /command"], undefined);
    assert.ok(router.routes["POST /command"]);
  });

  it("registers info, history and command routes", () => {
    const routes = setup();
    assert.deepEqual(Object.keys(routes).sort(), ["GET /history", "GET /info", "POST /command"]);
  });

  it("/info reports the default prefix when not started", async () => {
    const { status, body } = await call(setup()["GET /info"]);
    assert.equal(status, 200);
    assert.equal(body.deltaPrefix, "electrical.batteries.bms");
    assert.equal(body.running, false);
  });

  it("/command rejects read-only users", async () => {
    const { status } = await call(setup()["POST /command"], {
      body: { command: "CHAR 3.5" },
      skPrincipal: { identifier: "AUTO", permissions: "readonly" }
    });
    assert.equal(status, 403);
  });

  it("/command rejects readwrite users", async () => {
    const { status } = await call(setup()["POST /command"], {
      body: { command: "CHAR 3.5" },
      skPrincipal: { identifier: "crew", permissions: "readwrite" }
    });
    assert.equal(status, 403);
  });

  it("/command returns 503 for admins when the plugin is not running", async () => {
    const { status } = await call(setup()["POST /command"], {
      body: { command: "CHAR?" },
      skPrincipal: { identifier: "admin", permissions: "admin" }
    });
    assert.equal(status, 503);
  });

  it("/command is allowed when server security is disabled (no principal)", async () => {
    const { status } = await call(setup()["POST /command"], { body: { command: "CHAR?" } });
    assert.equal(status, 503, "passes auth, fails only because plugin is not running");
  });

  it("/history returns 503 before start", async () => {
    const { status } = await call(setup()["GET /history"]);
    assert.equal(status, 503);
  });
});
