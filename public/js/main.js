import { CellVisualizer } from './cells.js';
import { BMSSettings } from './settings.js';

class BMSSystem {
  constructor() {
    this.config = window.appConfig || {};
    this.prefix = this.config.deltaPrefix || "electrical.batteries.bms.";
    this.liveData = this.createDataStructure();
    this.dom = { metricElements: {} };
  }

  createDataStructure() {
    return {
      voltage: null,
      current: null,
      power: null,
      stateOfCharge: null,
      stateOfHealth: null,
      cellVoltages: {},
      cellResistances: {},
      cellVoltageDifference: null,
      bmsTemperature: null,
      cellTemperature1: null,
      maxCellVoltage: null,
      minCellVoltage: null,
      ampHourRemaining: null,
      ampHourUsed: null,
      capacity: null
    };
  }

  init() {
    console.log("Initializing BMS Monitor...");
    this.cacheDomElements();
    this.setupTabSwitching();
    CellVisualizer.init('cell-towers');
    this.connectWebSocket();
  }

  cacheDomElements() {
    const metrics = [
      'voltage', 'current', 'power', 'stateOfCharge', 'cellVoltageDifference', 'bmsTemperature', 'cellTemperature1',
      'maxCellVoltage', 'minCellVoltage', 'ampHourRemaining',
      'ampHourUsed', 'capacity'
    ];

    metrics.forEach(metric => {
      this.dom.metricElements[metric] = document.getElementById(metric);
      if (!this.dom.metricElements[metric]) {
        console.warn(`Missing metric element: ${metric}`);
      }
    });
  }

  setupTabSwitching() {
    const statusTab = document.getElementById('nav-status');
    const settingsTab = document.getElementById('nav-settings');

    if (!statusTab || !settingsTab) {
      console.warn("Tab elements not found");
      return;
    }

    statusTab.addEventListener('click', () => this.switchView('status'));
    settingsTab.addEventListener('click', () => this.switchView('settings'));
    this.switchView('status');
  }

  switchView(view) {
    const statusView = document.getElementById('status-view');
    const settingsView = document.getElementById('settings-view');

    if (view === 'status') {
      statusView?.classList.add('active');
      settingsView?.classList.remove('active');
      document.getElementById('nav-status')?.classList.add('active');
      document.getElementById('nav-settings')?.classList.remove('active');
    } else {
      statusView?.classList.remove('active');
      settingsView?.classList.add('active');
      document.getElementById('nav-status')?.classList.remove('active');
      document.getElementById('nav-settings')?.classList.add('active');
    }
  }

  updateMetrics() {
    const setValue = (el, value, unit) => {
      if (el) el.textContent = value !== null ? `${value.toFixed(2)}${unit}` : "--";
    };

    setValue(this.dom.metricElements.voltage, this.liveData.voltage, "V");
    setValue(this.dom.metricElements.current, this.liveData.current, "A");
    setValue(this.dom.metricElements.power, this.liveData.power, "W");

    setValue(
      this.dom.metricElements.stateOfCharge,
      this.liveData.stateOfCharge !== null ? this.liveData.stateOfCharge * 100 : null,
      "%"
    );
    setValue(
      this.dom.metricElements.stateOfHealth,
      this.liveData.stateOfHealth !== null ? this.liveData.stateOfHealth * 100 : null,
      "%"
    );

    if (this.dom.metricElements.cellVoltageDifference) {
      const v = this.liveData.cellVoltageDifference;
      this.dom.metricElements.cellVoltageDifference.textContent = v !== null ? `${v.toFixed(4)}V` : "--";
    }

    setValue(this.dom.metricElements.bmsTemperature, this.liveData.bmsTemperature, "°C");
    setValue(this.dom.metricElements.cellTemperature1, this.liveData.cellTemperature1, "°C");
    setValue(this.dom.metricElements.maxCellVoltage, this.liveData.maxCellVoltage, "V");
    setValue(this.dom.metricElements.minCellVoltage, this.liveData.minCellVoltage, "V");
    setValue(this.dom.metricElements.ampHourRemaining, this.liveData.ampHourRemaining, "Ah");
    setValue(this.dom.metricElements.ampHourUsed, this.liveData.ampHourUsed, "Ah");
    setValue(this.dom.metricElements.capacity, this.liveData.capacity, "Ah");
  }

  connectWebSocket() {
    try {
      const wsScheme = (window.location.protocol === "https:") ? "wss" : "ws";
      const ws = new WebSocket(
        `${wsScheme}://${window.location.host}/signalk/v1/stream?subscribe=self&path=electrical.batteries.bms.*`
      );
  
      ws.onopen = () => console.log("WebSocket connected");
      ws.onerror = (error) => console.error("WebSocket error:", error);
      ws.onclose = () => console.log("WebSocket connection closed");
  
      ws.onmessage = (event) => {
        const delta = JSON.parse(event.data);
        if (!delta.updates) return;
  
        delta.updates.forEach(update => {
          update.values?.forEach(({ path, value }) => {
            if (!path.startsWith(this.prefix)) return;
  
            const key = path.slice(this.prefix.length);
            if (key in this.liveData) {
              this.liveData[key] = value;
            } else if (/^cellVoltage\d+$/.test(key)) {
              this.liveData.cellVoltages[key] = value;
            } else if (/^cellResistance\d+$/.test(key)) {
              this.liveData.cellResistances[key] = value;
            }
          });
        });
  
        this.updateMetrics();
        CellVisualizer.updateAllCells({
          cellVoltages: this.liveData.cellVoltages,
          cellResistances: this.liveData.cellResistances
        });
      };
    } catch (error) {
      console.error("WebSocket initialization failed:", error);
    }
  }  
}

document.addEventListener('DOMContentLoaded', () => {
  const bmsMonitor = new BMSSystem();
  bmsMonitor.init();

  const settings = new BMSSettings();
  settings.init();
});
