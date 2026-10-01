"use strict";
const EventEmitter = require('events');
const hexer = require('./hexer');
const atlas = require('./atlas.json');
const atlasMapping = {};
atlas.forEach(entry => {
  atlasMapping[entry.tag] = entry;
});

const DEFAULT_MAX_QUEUE = 20;
// After a write-only (set) command, hold the bus briefly so any reply the BMS
// sends is discarded rather than mistaken for the next command's response.
const DEFAULT_SETTLE_MS = 250;

// Serialises commands onto the RS-485 bus. Only one command is ever in flight;
// everything else waits in a FIFO queue. Priority commands (manual commands
// from the UI) jump to the front of the queue but never interrupt the command
// currently in flight.
class CommandEngine extends EventEmitter {
  constructor(port, options = {}) {
    super();
    this.port = port;
    this.maxQueue = options.maxQueue || DEFAULT_MAX_QUEUE;
    this.settleMs = options.settleMs != null ? options.settleMs : DEFAULT_SETTLE_MS;
    this.queue = [];
    this.activeCommand = null;
    this.closed = false;
  }

  sendCommand(tag, targetAddress, rawCommandStr = null, options = {}) {
    return new Promise((resolve, reject) => {
      if (this.closed) {
        return reject(new Error(`[ENGINE] Closed, dropping ${tag}`));
      }

      let commandStr;
      let expectedPackets = 1;
      let timeoutMs = 3000;
      const config = atlasMapping[tag];

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

      let packet;
      try {
        packet = hexer.buildPacket(targetAddress, Buffer.from(commandStr));
      } catch (err) {
        return reject(err);
      }

      if (!options.priority && this.queue.length >= this.maxQueue) {
        return reject(new Error(`[ENGINE] Queue full, dropping ${tag}`));
      }

      const job = {
        tag,
        packet,
        expectedPackets,
        timeoutMs,
        expectResponse: options.expectResponse !== false,
        receivedPackets: [],
        timeout: null,
        resolve,
        reject
      };

      if (options.priority) {
        this.queue.unshift(job);
      } else {
        this.queue.push(job);
      }
      this._next();
    });
  }

  _next() {
    if (this.closed || this.activeCommand || this.queue.length === 0) return;

    const job = this.queue.shift();
    this.activeCommand = job;

    this.port.write(job.packet, (err) => {
      // The command may have been cancelled by close() while the write was pending
      if (this.activeCommand !== job) return;

      if (err) {
        this._finish(job);
        return job.reject(err);
      }

      if (!job.expectResponse) {
        job.resolve({ raw: true });
        job.timeout = setTimeout(() => this._finish(job), this.settleMs);
        return;
      }

      job.timeout = setTimeout(() => {
        if (this.activeCommand !== job) return;
        this._finish(job);
        job.reject(new Error(`${job.tag} response timed out after ${job.timeoutMs} ms`));
      }, job.timeoutMs);
    });
  }

  // Clear the active slot and move on to the next queued command
  _finish(job) {
    clearTimeout(job.timeout);
    if (this.activeCommand === job) this.activeCommand = null;
    setImmediate(() => this._next());
  }

  processPacket(packet) {
    const job = this.activeCommand;
    if (!job || !job.expectResponse) {
      this.emit('unhandledPacket', packet);
      return;
    }
    job.receivedPackets.push(packet);
    if (job.receivedPackets.length === job.expectedPackets) {
      this._finish(job);
      job.resolve(job.receivedPackets);
    }
  }

  // Reject everything in flight and queued; the engine cannot be reused afterwards
  close() {
    this.closed = true;
    const err = new Error('[ENGINE] Closed');
    const pending = this.queue.splice(0);
    if (this.activeCommand) {
      clearTimeout(this.activeCommand.timeout);
      pending.unshift(this.activeCommand);
      this.activeCommand = null;
    }
    pending.forEach(job => job.reject(err));
  }
}

module.exports = CommandEngine;
