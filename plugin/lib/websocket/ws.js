"use strict";
const WebSocket = require('ws');
const status = require('./status');
const settings = require('./settings');
const derived = require('./derived');
const schema = require('../schema');

module.exports = function(app, publishDelta) {
  let ws;
  const initialReconnectInterval = 5000;
  let currentReconnectInterval = initialReconnectInterval;
  const heartbeatInterval = 60000;
  let pingInterval;
  let shouldReconnect = true;
  let isReconnecting = false;
  let heartbeatTimeout;

  function resetHeartbeat() {
    app.debug("[WEBSOCKET] resetHeartbeat() called.");
    clearTimeout(heartbeatTimeout);
    heartbeatTimeout = setTimeout(() => {
      app.debug("[WEBSOCKET] Heartbeat timeout reached, terminating ws.");
      if (ws) ws.terminate();
    }, heartbeatInterval);
  }

  function connect(options) {
    app.debug("[WEBSOCKET] Connecting to: " + options.websocket.websocketURL);
    ws = new WebSocket(options.websocket.websocketURL);

    // derivedState is scoped to this connection session — resets on each reconnect
    const derivedState = {};

    ws.on('open', () => {
      app.setPluginStatus("Connected to BMS - waiting for serial number");
      app.debug("[WEBSOCKET] WebSocket connection opened.");
      currentReconnectInterval = initialReconnectInterval;
      clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          app.debug("[WEBSOCKET] Sending ping.");
          ws.ping();
        }
      }, heartbeatInterval);
      resetHeartbeat();
    });

    ws.on('pong', () => {
      app.debug("[WEBSOCKET] Received pong.");
      resetHeartbeat();
    });

    ws.on('message', (data) => {
      app.debug("[WEBSOCKET] Received message.");
      resetHeartbeat();
      let message = data;
      if (typeof message !== 'string') {
        if (Buffer.isBuffer(message)) {
          message = message.toString();
        } else {
          app.debug("[WEBSOCKET] Message is not a string or Buffer, returning.");
          return;
        }
      }
      try {
        const parsedData = JSON.parse(message);
        app.debug("[WEBSOCKET] JSON parsed successfully.");
        let vesselId = (typeof app.getSelfId === "function") ? app.getSelfId() : (app.selfId || "self");
        const context = `vessels.${vesselId}`;
        const prefix = options.deltaPrefix || "electrical.batteries.bms";
        let delta = {
          context: context,
          updates: [{
            timestamp: new Date().toISOString(),
            values: []
          }]
        };

        if (parsedData.type === "status") {
          app.debug("[WEBSOCKET] Processing status data.");
          const statusValues = status(parsedData, prefix) || [];
          delta.updates[0].values.push(...statusValues);
        }

        if (parsedData.type === "settings") {
          app.debug("[WEBSOCKET] Processing settings data.");
          const settingsValues = settings(parsedData, prefix) || [];
          delta.updates[0].values.push(...settingsValues);
          if (parsedData.bms_name) {
            app.setPluginStatus(`Connected to BMS ${parsedData.bms_name} - Connection Type: WebSocket`);
          }
        }

        // Add derived values — pass session state to avoid module-scope leakage
        const derivedValues = derived(parsedData, prefix, derivedState) || [];
        delta.updates[0].values.push(...derivedValues);

        // Filter out null/undefined
        delta.updates[0].values = delta.updates[0].values.filter(item => item.value !== null && item.value !== undefined);

        if (delta.updates[0].values.length > 0) {
          app.debug("[WEBSOCKET] Publishing delta with " + delta.updates[0].values.length + " values.");
          if (typeof publishDelta === 'function') {
            publishDelta(delta);
          }
        } else {
          app.debug("[WEBSOCKET] Delta has no values, not publishing.");
        }
      } catch (err) {
        app.error(`[WEBSOCKET] Failed to parse JSON: ${err.message}`);
      }
    });

    ws.on('close', () => {
      app.setPluginStatus("BMS disconnected - ERROR");
      app.debug("[WEBSOCKET] WebSocket closed.");
      clearInterval(pingInterval);
      if (shouldReconnect && !isReconnecting) {
        isReconnecting = true;
        app.debug("[WEBSOCKET] Reconnecting in " + currentReconnectInterval + " ms.");
        setTimeout(() => { isReconnecting = false; connect(options); }, currentReconnectInterval);
        currentReconnectInterval = Math.min(currentReconnectInterval * 2, 60000);
      }
    });

    ws.on('error', (error) => {
      app.setPluginStatus(`Error: ${error.message} - ERROR`);
      app.debug(`[WEBSOCKET] WebSocket error: "${error.message}", terminating connection.`);
      clearInterval(pingInterval);
      isReconnecting = true;
      if (ws) ws.terminate();
    });
  }

  return {
    start: function(options) {
      app.debug("[WEBSOCKET] start() called.");
      shouldReconnect = true;
      isReconnecting = false;
      currentReconnectInterval = initialReconnectInterval;
      connect(options);
    },
    stop: function() {
      app.debug("[WEBSOCKET] stop() called.");
      shouldReconnect = false;
      clearInterval(pingInterval);
      clearTimeout(heartbeatTimeout);
      if (ws) {
        ws.close();
        ws = null;
      }
      app.setPluginStatus("Stopped");
      app.debug("[WEBSOCKET] Connection stopped.");
    },
    schema: schema
  };
};
