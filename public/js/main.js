'use strict';

class BMSMonitor {
  constructor() {
    this.prefix = 'electrical.batteries.bms.';
    this.ws = null;
    this.reconnectDelay = 5000;
    this.reconnectTimer = null;
    this.shouldConnect = true;

    this.live = {
      voltage: null,
      current: null,
      power: null,
      'capacity.stateOfCharge': null,
      'capacity.stateOfHealth': null,
      'capacity.remaining': null,
      'capacity.dischargeSinceFull': null,
      'capacity.nominal': null,
      'capacity.timeRemaining': null,
      cellVoltageDifference: null,
      bmsTemperature: null,
      cellTemperature1: null,
      maxCellVoltage: null,
      minCellVoltage: null,
      maxAllowedCellVoltage: null,
      minAllowedCellVoltage: null,
      endChargeVoltage: null,
      cellVoltages: {},
      cellResistances: {}
    };
  }

  init() {
    this._initNightMode();
    this._initTabs();
    CellVisualizer.init('cell-towers');
    BMSChartManager.init();
    const settings = new BMSSettings();
    settings.init();
    this._connect();
  }

  // ---- Night mode ----
  _initNightMode() {
    const toggle = document.getElementById('nightModeToggle');
    if (!toggle) return;
    const saved = localStorage.getItem('bms-night-mode') === 'true';
    if (saved) {
      document.body.classList.add('night-mode');
      toggle.checked = true;
    }
    toggle.addEventListener('change', () => {
      document.body.classList.toggle('night-mode', toggle.checked);
      localStorage.setItem('bms-night-mode', toggle.checked);
    });
  }

  // ---- Tabs ----
  _initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const content = document.getElementById(target);
        if (content) content.classList.add('active');
      });
    });
  }

  // ---- WebSocket ----
  _connect() {
    if (!this.shouldConnect) return;
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${scheme}://${window.location.host}/signalk/v1/stream?subscribe=self`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[BMS] WebSocket connected');
      this.reconnectDelay = 5000;
      this._setStatus(true);
      this.ws.send(JSON.stringify({
        context: 'vessels.self',
        subscribe: [{
          path: 'electrical.batteries.bms.*',
          period: 1000
        }]
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const delta = JSON.parse(event.data);
        this._handleDelta(delta);
      } catch (e) {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this._setStatus(false);
      if (this.shouldConnect) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60000);
          this._connect();
        }, this.reconnectDelay);
      }
    };

    this.ws.onerror = () => {
      this.ws.close();
    };
  }

  _setStatus(online) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (dot) dot.className = 'status-dot' + (online ? ' online' : '');
    if (text) text.textContent = online ? 'Connected' : 'Disconnected';
  }

  _handleDelta(delta) {
    if (!delta.updates) return;
    let changed = false;

    delta.updates.forEach(update => {
      if (!update.values) return;
      update.values.forEach(({ path, value }) => {
        if (!path.startsWith(this.prefix)) return;
        const key = path.slice(this.prefix.length);

        if (key in this.live) {
          this.live[key] = value;
          changed = true;
        } else if (/^cellVoltage\d+$/.test(key)) {
          this.live.cellVoltages[key] = value;
          changed = true;
        } else if (/^cellResistance\d+$/.test(key)) {
          this.live.cellResistances[key] = value;
          changed = true;
        }
      });
    });

    if (changed) {
      this._updateSidebar();
      CellVisualizer.updateAllCells({
        cellVoltages: this.live.cellVoltages,
        cellResistances: this.live.cellResistances,
        minAllowedCellVoltage: this.live.minAllowedCellVoltage,
        maxAllowedCellVoltage: this.live.maxAllowedCellVoltage,
        endChargeVoltage: this.live.endChargeVoltage
      });
    }
  }

  // ---- Sidebar updates ----
  _updateSidebar() {
    const set = (id, value, unit, decimals = 2) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = value !== null && value !== undefined
        ? value.toFixed(decimals) + unit
        : '--';
    };

    const soc = this.live['capacity.stateOfCharge'];
    const soh = this.live['capacity.stateOfHealth'];

    set('stateOfCharge', soc !== null ? soc * 100 : null, '%', 1);
    set('stateOfHealth', soh !== null ? soh * 100 : null, '%', 1);

    set('voltage', this.live.voltage, ' V');
    set('current', this.live.current, ' A');
    set('power',   this.live.power,   ' W', 1);

    set('capacity-nominal',   this.live['capacity.nominal'],   ' Ah', 0);
    set('capacity-remaining', this.live['capacity.remaining'], ' Ah', 0);

    // dischargeSinceFull is in Coulombs — display as Ah
    const dsf = this.live['capacity.dischargeSinceFull'];
    set('capacity-dischargeSinceFull', dsf !== null ? dsf / 3600 : null, ' Ah', 0);

    // timeRemaining is in seconds — display as hours
    const tr = this.live['capacity.timeRemaining'];
    set('capacity-timeRemaining', tr !== null ? tr / 3600 : null, ' h', 1);

    set('minCellVoltage',        this.live.minCellVoltage,        ' V', 3);
    set('maxCellVoltage',        this.live.maxCellVoltage,        ' V', 3);
    set('cellVoltageDifference', this.live.cellVoltageDifference, ' V', 4);

    // Temperatures arrive in Kelvin — display in °C
    const ct = this.live.cellTemperature1;
    const bt = this.live.bmsTemperature;
    set('cellTemperature1', ct !== null ? ct - 273.15 : null, ' °C', 1);
    set('bmsTemperature',   bt !== null ? bt - 273.15 : null, ' °C', 1);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const monitor = new BMSMonitor();
  monitor.init();
});
