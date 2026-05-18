"use strict";
const { crc16 } = require('crc');

class Layer2 {
	constructor() {
		this.buffer = [];
		this.stats = {
			rx: 0,
			rxBytes: 0,
			badCRC: 0
		};
		this.hooks = {
			"data": () => {}
		};
	}

	on(hook, callback) {
		this.hooks[hook] = callback;
	}

	push(block) {
		for (let i = 0; i < block.length; i++) {
			this.stats.rxBytes++;
			this.buffer.push(block.readUInt8(i));
		}
		while (this.packetForward());
	}

	packetForward() {
		while (this.buffer.length > 0 && this.buffer[0] !== 0x55) {
			this.buffer.shift();
		}
		if (this.buffer.length >= 7) {
			let length = this.buffer[3];
			let packet = [];
			if (this.buffer.length < length + 7) {
				return false;
			}
			for (let i = 0; i < length + 7; i++)
				packet.push(this.buffer[i]);
			packet = Buffer.from(packet);
			if (packet.readUInt8(packet.length - 1) !== 0xAA) {
				this.buffer.shift();
				return true;
			}
			let packetCRC = packet.readUInt16BE(packet.length - 3);
			let crc = crc16(packet.slice(1, packet.length - 3));
			this.stats.rx++;
			if (crc !== packetCRC) {
				this.stats.badCRC++;
				for (let i = 0; i < packet.length; i++)
					this.buffer.shift();
				return true;
			}
			try {
				this.hooks["data"](packet);
			} catch (err) {
			}
			for (let i = 0; i < length + 7; i++)
				this.buffer.shift();
			return true;
		}
		return false;
	}
}

module.exports = Layer2;
