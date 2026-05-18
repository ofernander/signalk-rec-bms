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

module.exports = function(app, publishDelta) {
  let port, parser, engine;
  let derivedModule;
  let pollingInterval;
  let routeRegistered = false;

  function start(options) {
    app.debug("[SERIAL] start() called with options: " + JSON.stringify(options));
    port = new SerialPort({
      path: options.serial.device,
      baudRate: options.serial.baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none'
    });

    engine = new CommandEngine(port);
    parser = new Layer2();

    port.on('data', (data) => parser.push(data));
    parser.on('data', (packet) => engine.processPacket(packet));

    port.on('open', () => {
      app.setPluginStatus("Connected to BMS - Connection Type: Serial");
      engine.sendCommand('SERI', options.serial.targetAddress)
        .then(packets => {
          const parsed = abmsModule.parseSERIResponse(packets);
          if (parsed && parsed.data && parsed.data.abmsSerialNumber != null) {
            const sn = parsed.data.abmsSerialNumber;
            app.setPluginStatus(
              `Connected to BMS ${sn} - Connection Type: Serial`
            );
          }
        })
        .catch(err => {
          app.debug("[SERIAL] Failed to read serial number: " + err.message);
        });

      derivedModule = derived(app, publishDelta, { deltaPrefix: options.deltaPrefix });

      const commandList = atlas.map(entry => entry.tag);
      let currentIndex = 0;

      pollingInterval = setInterval(() => {
        const tag = commandList[currentIndex];
        currentIndex = (currentIndex + 1) % commandList.length;

        const config = atlas.find(entry => entry.tag === tag);
        if (!config || !config.module || !moduleMapping[config.module]) return;

        const commandModule = moduleMapping[config.module];

        engine.sendCommand(tag, options.serial.targetAddress)
          .then(packets => {
            const parsed = commandModule[config.parser]?.(packets);
            if (parsed) {
              const moduleDelta = commandModule.getDelta(parsed, options, app);
              if (moduleDelta) publishDelta(moduleDelta);
            }
          })
          .catch(err => {
            if (err.message.startsWith('[ENGINE] Busy')) {
              app.debug("[SERIAL] Skipping " + tag + " — engine busy");
            } else {
              app.debug("[SERIAL] Error: " + err.message);
            }
          });
      }, 100);

      if (!routeRegistered) {
        routeRegistered = true;
        app.post('/signalk/v1/bms/command', (req, res) => {
          const { command } = req.body;
          if (!command) return res.status(400).json({ error: "Missing command" });

          const parts = command.trim().split(/\s+/);
          let tag = parts[0];
          const raw = command.trim();
          const isQuery = tag.endsWith("?");

          if (isQuery) {
            tag = tag.slice(0, -1);
          }

          const config = atlas.find(entry => entry.tag === tag);

          if (config && config.module && moduleMapping[config.module]) {
            const commandModule = moduleMapping[config.module];
            const expectResponse = isQuery;

            engine.sendCommand(tag, options.serial.targetAddress, raw, { expectResponse, force: true })
              .then(packets => {
                if (expectResponse) {
                  const parsed = commandModule[config.parser]?.(packets);
                  res.json({
                    command,
                    response: parsed,
                    rawPackets: packets.map(p => p.toString('hex'))
                  });
                } else {
                  res.json({
                    command,
                    response: { status: "sent (no response expected)" }
                  });
                }
              })
              .catch(err => {
                res.status(500).json({ error: err.message, command });
              });
          } else {
            res.status(400).json({ error: "Unknown or unsupported command" });
          }
        });
      }
    });

    port.on('error', (err) => app.debug("[SERIAL] Error: " + err.message));
  }

  function stop() {
    clearInterval(pollingInterval);
    if (port) port.close();
    if (derivedModule && typeof derivedModule.stop === 'function') derivedModule.stop();
  }

  return {
    start,
    stop,
    schema: require('../schema'),
    sendManualCommand: (tag, targetAddress) => {
      const config = atlas.find(entry => entry.tag === tag);
      if (!config || !config.module || !moduleMapping[config.module]) {
        throw new Error("Unknown or unsupported command");
      }
      const commandModule = moduleMapping[config.module];
      return engine.sendCommand(tag, targetAddress, null, { force: true })
        .then(packets => ({
          packets,
          parsed: commandModule[config.parser]?.(packets)
        }));
    }
  };
};
