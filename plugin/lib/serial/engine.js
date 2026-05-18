"use strict";
const EventEmitter = require('events');
const hexer = require('./hexer');
const atlas = require('./atlas.json');
const atlasMapping = {};
atlas.forEach(entry => {
  atlasMapping[entry.tag] = entry;
});

class CommandEngine extends EventEmitter {
  constructor(port) {
    super();
    this.port = port;
    this.activeCommand = null;
  }

  sendCommand(tag, targetAddress, rawCommandStr = null, options = {}) {
    return new Promise((resolve, reject) => {
      // If a command is already in flight, reject unless caller explicitly forces
      if (this.activeCommand && !options.force) {
        return reject(new Error(`[ENGINE] Busy — command ${this.activeCommand.tag} in flight, dropping ${tag}`));
      }

      let commandStr;
      let expectedPackets = 1;
      let timeoutMs = 3000;
      let config = atlasMapping[tag];

      if (rawCommandStr) {
        commandStr = rawCommandStr;
      } else {
        if (!config) {
          return reject(new Error(`[ENGINE] No configuration found for command tag "${tag}"`));
        }
        commandStr = config.command || (tag + "?");
        expectedPackets = config.expectedPackets;
        timeoutMs = config.timeout;
      }

      const packet = hexer.buildPacket(targetAddress, Buffer.from(commandStr));

      if (options.expectResponse === false) {
        this.port.write(packet, (err) => {
          if (err) return reject(err);
          resolve({ raw: true });
        });
        return;
      }

      this.activeCommand = {
        tag,
        expectedPackets,
        timeoutMs,
        receivedPackets: [],
        resolve,
        reject,
        config
      };

      const currentCommand = this.activeCommand;

      this.port.write(packet, (err) => {
        if (err) {
          this.activeCommand = null;
          return reject(err);
        }
        currentCommand.timeout = setTimeout(() => {
          const errMsg = `${tag} response timed out after ${timeoutMs} ms`;
          if (currentCommand && typeof currentCommand.reject === "function") {
            this.activeCommand = null;
            currentCommand.reject(new Error(errMsg));
          }
        }, timeoutMs);
      });
    });
  }

  processPacket(packet) {
    if (!this.activeCommand) {
      this.emit('unhandledPacket', packet);
      return;
    }
    this.activeCommand.receivedPackets.push(packet);
    if (this.activeCommand.receivedPackets.length === this.activeCommand.expectedPackets) {
      clearTimeout(this.activeCommand.timeout);
      const packets = this.activeCommand.receivedPackets;
      this.activeCommand.resolve(packets);
      this.activeCommand = null;
    }
  }
}

module.exports = CommandEngine;
