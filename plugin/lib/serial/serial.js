"use strict";
const { SerialPort } = require('serialport');
const Layer2 = require('./Layer2');
const CommandEngine = require('./engine');
const atlas = require('./atlas.json');
const arrayModule = require('./modules/array');
const voltModule = require('./modules/volt');
const tempModule = require('./modules/temp');
const curModule = require('./modules/cur');
const batModule = require('./modules/bat');
const sonModule = require('./modules/soc');
const victronModule = require('./modules/victron');
const erroModule = require('./modules/erro');
const outputsModule = require('./modules/outputs');
const abmsModule = require('./modules/abms');
const derived = require('./modules/derived');

const moduleMapping = {
  array: arrayModule,
  volt: voltModule,
  temp: tempModule,
  cur: curModule,
  bat: batModule,
  soc: sonModule,
  victron: victronModule,
  erro: erroModule,
  outputs: outputsModule,
  abms: abmsModule
};

// Minimum spacing between poll commands (start to start). Polls run one at a
// time, so a slow or timed-out command delays the next one instead of
// causing it to be skipped.
const POLL_SPACING_MS = 100;
const INITIAL_RECONNECT_MS = 5000;
const MAX_RECONNECT_MS = 60000;
// Consecutive failed polls before the port is considered open but the BMS silent
const NO_RESPONSE_THRESHOLD = 20;

const pollList = atlas.filter(entry => entry.module && moduleMapping[entry.module]);

// deps.SerialPort lets tests substitute a fake port
module.exports = function(app, publishDelta, deps = {}) {
  const SerialPortClass = deps.SerialPort || SerialPort;

  let options;
  let port = null;
  let engine = null;
  let derivedModule = null;
  let stopped = true;
  let reconnectTimer = null;
  let reconnectDelay = INITIAL_RECONNECT_MS;
  let pollTimer = null;
  let polling = false;
  let consecutiveFailures = 0;
  let connectedStatus = "Connected to BMS - Connection Type: Serial";

  function setError(msg) {
    if (typeof app.setPluginError === 'function') app.setPluginError(msg);
    else app.setPluginStatus(msg + " - ERROR");
  }

  function startPolling() {
    polling = true;
    consecutiveFailures = 0;
    let currentIndex = 0;

    const pollNext = () => {
      if (!polling) return;
      const config = pollList[currentIndex];
      currentIndex = (currentIndex + 1) % pollList.length;
      const commandModule = moduleMapping[config.module];
      const startedAt = Date.now();

      engine.sendCommand(config.tag, options.serial.targetAddress)
        .then(packets => {
          if (consecutiveFailures >= NO_RESPONSE_THRESHOLD) app.setPluginStatus(connectedStatus);
          consecutiveFailures = 0;
          const parsed = commandModule[config.parser]?.(packets);
          if (parsed) {
            const moduleDelta = commandModule.getDelta(parsed, options, app);
            if (moduleDelta) publishDelta(moduleDelta);
          }
        })
        .catch(err => {
          if (!polling) return;
          app.debug("[SERIAL] " + config.tag + " error: " + err.message);
          consecutiveFailures++;
          if (consecutiveFailures === NO_RESPONSE_THRESHOLD) {
            setError("Serial port open but no response from BMS - check wiring and 3V supply");
          }
        })
        .finally(() => {
          if (!polling) return;
          const wait = Math.max(0, POLL_SPACING_MS - (Date.now() - startedAt));
          pollTimer = setTimeout(pollNext, wait);
        });
    };

    pollNext();
  }

  function stopPolling() {
    polling = false;
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  function readSerialNumber() {
    engine.sendCommand('SERI', options.serial.targetAddress)
      .then(packets => {
        const parsed = abmsModule.parseSERIResponse(packets);
        if (parsed && parsed.data && parsed.data.abmsSerialNumber != null) {
          connectedStatus = `Connected to BMS ${parsed.data.abmsSerialNumber} - Connection Type: Serial`;
          app.setPluginStatus(connectedStatus);
        }
      })
      .catch(err => app.debug("[SERIAL] Failed to read serial number: " + err.message));
  }

  function openPort() {
    app.debug(`[SERIAL] Opening ${options.serial.device}`);
    const p = new SerialPortClass({
      path: options.serial.device,
      baudRate: options.serial.baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      autoOpen: false
    });
    const eng = new CommandEngine(p);
    const parser = new Layer2();
    port = p;
    engine = eng;

    p.on('data', (data) => parser.push(data));
    parser.on('data', (packet) => eng.processPacket(packet));

    p.on('open', () => {
      if (port !== p) return;
      app.debug("[SERIAL] Port open");
      reconnectDelay = INITIAL_RECONNECT_MS;
      app.setPluginStatus(connectedStatus);
      readSerialNumber();
      startPolling();
    });

    // Fires on USB unplug (err.disconnected) as well as on a normal close
    p.on('close', (err) => {
      if (port !== p) return;
      handleDisconnect(err ? err.message : "port closed");
    });

    p.on('error', (err) => app.debug("[SERIAL] Error: " + err.message));

    p.open((err) => {
      if (err && port === p) handleDisconnect(err.message);
    });
  }

  function teardownPort() {
    stopPolling();
    if (engine) engine.close();
    const p = port;
    port = null;
    engine = null;
    if (p) {
      p.removeAllListeners();
      p.on('error', () => {}); // a late error with no listener would throw
      if (p.isOpen) p.close(() => {});
    }
  }

  function handleDisconnect(reason) {
    teardownPort();
    if (stopped || reconnectTimer) return;
    const delay = reconnectDelay;
    setError(`BMS serial disconnected (${reason}) - retrying in ${Math.round(delay / 1000)}s`);
    app.debug(`[SERIAL] Disconnected: ${reason}. Reconnecting in ${delay} ms`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!stopped) openPort();
    }, delay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_MS);
  }

  function start(opts) {
    app.debug("[SERIAL] start() called with options: " + JSON.stringify(opts));
    options = opts;
    stopped = false;
    reconnectDelay = INITIAL_RECONNECT_MS;
    derivedModule = derived(app, publishDelta, { deltaPrefix: options.deltaPrefix });
    openPort();
  }

  function stop() {
    stopped = true;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    teardownPort();
    if (derivedModule && typeof derivedModule.stop === 'function') derivedModule.stop();
    derivedModule = null;
  }

  // Run a manual command from the UI, e.g. "CHAR?" (query) or "CHAR 3.55" (set).
  // Resolves to a JSON-serialisable result; rejects with err.statusCode set for
  // client errors.
  function handleCommand(command) {
    const clientError = (msg, statusCode = 400) => Object.assign(new Error(msg), { statusCode });

    if (typeof command !== 'string' || !command.trim()) {
      return Promise.reject(clientError("Missing command"));
    }
    if (!engine) {
      return Promise.reject(clientError("BMS serial port not connected", 503));
    }

    const raw = command.trim();
    let tag = raw.split(/\s+/)[0];
    const isQuery = tag.endsWith("?");
    if (isQuery) tag = tag.slice(0, -1);

    const config = atlas.find(entry => entry.tag === tag);
    if (!config || !config.module || !moduleMapping[config.module]) {
      return Promise.reject(clientError("Unknown or unsupported command"));
    }
    const commandModule = moduleMapping[config.module];

    return engine.sendCommand(tag, options.serial.targetAddress, raw, { expectResponse: isQuery, priority: true })
      .then(packets => {
        if (!isQuery) {
          return { command, response: { status: "sent (no response expected)" } };
        }
        return {
          command,
          response: commandModule[config.parser]?.(packets),
          rawPackets: packets.map(p => p.toString('hex'))
        };
      });
  }

  return {
    start,
    stop,
    handleCommand
  };
};
