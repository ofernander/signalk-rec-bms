'use strict';

class BMSSettings {
  constructor() {
    this.tempCommands = new Set(['TMAX', 'TMIN', 'TBAL', 'BMTH']);
    this.prefix = 'electrical/batteries/bms';

    this.commandGroups = [
      { title: "Voltage Settings",      commands: ["BVOL","BMIN","CMAX","MAXH","CMIN","MINH","CHAR","CHIS","UBDI","CFVC","RAZL"] },
      { title: "Temperature Settings",  commands: ["TMAX","TMIN","TBAL","BMTH"] },
      { title: "Current Settings",      commands: ["IOFF","IOJA"] },
      { title: "Battery Pack Settings", commands: ["CYCL","CAPA","CHEM"] },
      { title: "SOC Settings",          commands: ["SOCH","SOCS"] },
      { title: "Victron/Wakespeed",     commands: ["CHAC","DCHC","STRN","MAXC","MAXD","CLOW"] },
      { title: "Error Log Settings",    commands: ["ERLD","VMAX","VMIN"] },
      { title: "ABMS Settings",         commands: ["CAL1","CAL2","CAL3","CAL4","SERI","TIME","DATE"] }
    ];

    this.commandLimits = {
      BVOL: { min: 2.5,    max: 4.30,   type: 'float'   },
      BMIN: { min: 2.5,    max: 4.30,   type: 'float'   },
      CMAX: { min: 2.0,    max: 4.30,   type: 'float'   },
      MAXH: { min: 0.005,  max: 2.0,    type: 'float'   },
      CMIN: { min: 1.8,    max: 4.00,   type: 'float'   },
      MINH: { min: 0.005,  max: 2.0,    type: 'float'   },
      CHAR: { min: 2.0,    max: 4.30,   type: 'float'   },
      CHIS: { min: 0.005,  max: 2.0,    type: 'float'   },
      UBDI: { min: 0.005,  max: 1.0,    type: 'float'   },
      TMAX: { min: -20,    max: 65,     type: 'float'   },
      TMIN: { min: -30,    max: 65,     type: 'float'   },
      TBAL: { min: -20,    max: 65,     type: 'float'   },
      BMTH: { min: 1,      max: 30,     type: 'float'   },
      IOFF: { min: -2.0,   max: 2.0,    type: 'float'   },
      IOJA: { min: 0.0005, max: 0.5,    type: 'float'   },
      CYCL: { min: 0,      max: 8000,   type: 'integer' },
      CAPA: { min: 1.0,    max: 3000.0, type: 'float'   },
      CHEM: { min: 1,      max: 5,      type: 'integer' },
      SOCH: { min: 0.005,  max: 0.99,   type: 'float'   },
      SOCS: { min: 0.01,   max: 1.00,   type: 'float'   },
      CHAC: { min: 0.01,   max: 5.0,    type: 'float'   },
      DCHC: { min: 0.01,   max: 5.0,    type: 'float'   },
      STRN: { min: 1,      max: 6,      type: 'integer' },
      MAXC: { min: 5.0,    max: 280.0,  type: 'float'   },
      MAXD: { min: 5.0,    max: 400.0,  type: 'float'   },
      CLOW: { min: 1.8,    max: 4.20,   type: 'float'   },
      CAL1: { min: -0.030, max: 0.030,  type: 'float'   },
      CAL2: { min: -0.030, max: 0.030,  type: 'float'   },
      CAL3: { min: -0.030, max: 0.030,  type: 'float'   },
      CAL4: { min: -0.030, max: 0.030,  type: 'float'   },
      ERLD: { min: 0,      max: 1,      type: 'integer' },
      VMAX: { min: 0,      max: 8000,   type: 'integer' },
      VMIN: { min: 0,      max: 8000,   type: 'integer' },
    };

    this.commandInfo = {
      BVOL: {
        manual: "Balance end voltage. Returns float voltage [V] 2.5 to 4.30 V",
        human: "The cell voltage at which active balancing stops. Set just below your end-of-charge voltage. Cells won't be balanced above this point. Example: if CHAR is 3.46V, set BVOL to 3.45V."
      },
      BMIN: {
        manual: "Balancing start voltage. Returns float voltage [V] 2.5 to 4.30 V",
        human: "The minimum cell voltage before balancing begins. Balancing only occurs between BMIN and BVOL. Example: set to 3.40V to start balancing once cells are reasonably charged."
      },
      CMAX: {
        manual: "Cell over-voltage switch-off. Returns float voltage [V] 2.0 to 4.30 V",
        human: "Hard safety limit. If any cell reaches this voltage the BMS disconnects. Set above your charge voltage but below the cell's absolute maximum. Example: LiFePO4 absolute max is 3.65V — set CMAX to 3.65V."
      },
      MAXH: {
        manual: "Over-voltage switch-off hysteresis per cell. Returns float voltage [V] 0.005 to 2.0 V",
        human: "How far voltage must drop below CMAX before the BMS reconnects after an over-voltage trip. Prevents rapid switching. Example: CMAX 3.65V, MAXH 0.15V — reconnects when cells drop to 3.50V."
      },
      CMIN: {
        manual: "Cell under-voltage protection switch-off. Returns float voltage [V] 1.8 to 4.00 V",
        human: "Hard safety limit. If any cell drops to this voltage the BMS disconnects to prevent cell damage. Example: LiFePO4 safe minimum is around 2.50V — set CMIN to 2.50V."
      },
      MINH: {
        manual: "Under-voltage switch-off hysteresis per cell. Returns float voltage [V] 0.005 to 2.0 V",
        human: "How far voltage must rise above CMIN before the BMS reconnects after an under-voltage trip. Prevents rapid switching. Example: CMIN 2.50V, MINH 0.15V — reconnects when cells recover to 2.65V."
      },
      CHAR: {
        manual: "Cell end of charging voltage. Returns float voltage [V] 2.0 to 4.30 V",
        human: "The target voltage per cell at which charging is considered complete. Should match your charger's absorption voltage per cell. Example: for LiFePO4 set to 3.45–3.50V per cell."
      },
      CHIS: {
        manual: "End of charging voltage hysteresis per cell. Returns float voltage [V] 0.005 to 2.0 V",
        human: "Once a cell has reached CHAR, charging won't be considered active again until the cell drops at least this much below CHAR. Prevents the BMS from repeatedly signalling charge complete and charge start when voltage hovers near CHAR. Example: CHAR 3.46V, CHIS 0.10V — a new charge cycle registers when cells drop below 3.36V."
      },
      UBDI: {
        manual: "End of charging allowed cell voltage difference. Returns float voltage [V] 0.005 to 1.0 V",
        human: "Maximum permitted spread between cells at end of charge. If cells are further apart than this, charging won't be marked complete until balancing closes the gap. Example: set to 0.010V — all cells must be within 10mV of each other before charge is considered complete."
      },
      CFVC: {
        manual: "Maximum cell float voltage coefficient. Returns float value 0.005 to 2.0",
        human: "Multiplier applied to the charge voltage during float stage. 1.0 means no adjustment. Only relevant if your charger uses the BMS CAN output. Example: set to 1.0 for no modification to the float voltage."
      },
      RAZL: {
        manual: "Cells max difference. Returns float voltage [V] 0.005 to 1.0 V",
        human: "Maximum allowed voltage difference between any two cells during normal operation. Exceeding this may indicate a failing cell. Example: set to 0.50V — if any two cells differ by more than 500mV an alert is triggered."
      },
      TMAX: {
        manual: "Cell over temperature switch-off. Returns float temperature [°C] -20 to 65 °C",
        human: "If any cell temperature sensor reaches this value the BMS disconnects. Protects cells from thermal runaway. Example: set to 55°C for LiFePO4 — most cells are rated to 60°C maximum."
      },
      TMIN: {
        manual: "Under-temperature charging disable. Returns float temperature [°C] -30 to 65 °C",
        human: "Charging is disabled below this temperature. Lithium cells can be permanently damaged by charging when cold. Example: set to 5°C — never charge LiFePO4 below freezing."
      },
      TBAL: {
        manual: "BMS over-temperature switch-off. Returns float temperature [°C] -20 to 65 °C",
        human: "If the BMS circuit board itself reaches this temperature it disconnects. Protects the BMS electronics. Example: set to 55°C — the ABMS board is rated to around 60°C."
      },
      BMTH: {
        manual: "BMS over temperature switch-off hysteresis. Returns float temperature [°C] 1 to 30 °C",
        human: "How far the BMS board temperature must drop below TBAL before it reconnects after a thermal trip. Example: TBAL 55°C, BMTH 5°C — reconnects when board cools to 50°C."
      },
      IOFF: {
        manual: "Current measurement zero offset. Returns float current [A] -2.0 to 2.0 A",
        human: "Calibration offset applied to the current sensor when no current is flowing. Adjust if your BMS reads non-zero current at rest. Example: if BMS reads -0.5A with no load, set IOFF to 0.5A to correct it."
      },
      IOJA: {
        manual: "Voltage to current coefficient. Returns float value 0.0005 to 0.5",
        human: "Scaling factor that converts the current sensor's voltage output to Amperes. Set by the manufacturer — only change if you replace the shunt. Example: a 500A/50mV shunt gives a coefficient of 0.01."
      },
      CYCL: {
        manual: "Number of full battery pack cycles. Returns integer value 0 to 8000",
        human: "Lifetime cycle counter. Informational only — tracks how many full charge/discharge cycles the pack has completed. Example: a value of 500 means the pack has gone through 500 full cycles."
      },
      CAPA: {
        manual: "Battery pack capacity. Returns float capacity [Ah] 1.0 to 3000.0 Ah",
        human: "Total capacity of your battery bank in Ah. Used to calculate state of charge and time remaining estimates. Must match your actual installed capacity. Example: four 280Ah cells in parallel = 1120Ah total — set CAPA to 1120."
      },
      CHEM: {
        manual: "Li-ion chemistry. Returns unsigned char value 1 to 5",
        human: "Selects the cell chemistry profile (1–5). This affects voltage thresholds and behaviour. Check the REC manual for which number corresponds to your cell type. Example: LiFePO4 is typically chemistry 3."
      },
      SOCH: {
        manual: "SOC end of charge hysteresis. Returns float value 0–1",
        human: "After the battery has been declared fully charged (100% SOC), this is how far SOC must drop before the BMS will register a new charge cycle. Prevents counting multiple charge cycles when SOC fluctuates slightly around 100%. Example: set to 0.005 (0.5%) — SOC must drop to 99.5% before a new charge cycle begins."
      },
      SOCS: {
        manual: "SOC manual re-set. Returns float value 0–1",
        human: "Sets the SOC to a specific value immediately. Use when you know the actual state of charge and want to correct a drift error. Example: after a full measured charge, set to 1.0 to reset SOC to 100%."
      },
      CHAC: {
        manual: "Charge coefficient (0-5C). Returns float value 0.01 to 5.0",
        human: "Scales the maximum charge current communicated to connected chargers via CAN. 1.0 = full rated current. Reduce to limit charge rate. Example: set to 0.5 to limit chargers to 50% of maximum charge current."
      },
      DCHC: {
        manual: "Discharge coefficient (0-5C). Returns float value 0.01 to 5.0",
        human: "Scales the maximum discharge current communicated to connected inverters via CAN. 1.0 = full rated current. Example: set to 1.0 for unrestricted discharge up to MAXD."
      },
      STRN: {
        manual: "Number of inverter devices on the bus. Returns unsigned char value 1 to 6",
        human: "How many Victron or Wakespeed devices are connected on the CAN bus. Used to correctly distribute current limits across multiple devices. Example: one Multiplus and one MPPT = set to 2."
      },
      MAXC: {
        manual: "Maximum charge current per inverter device. Returns float current [A] 5.0 to 280.0 A",
        human: "The absolute maximum charge current allowed per connected charger device in Amperes. Example: set to 100A if your charger is rated at 100A."
      },
      MAXD: {
        manual: "Maximum discharge current per inverter device. Returns float current [A] 5.0 to 400.0 A",
        human: "The absolute maximum discharge current allowed per connected inverter device in Amperes. Example: set to 200A if your inverter is rated at 200A continuous."
      },
      CLOW: {
        manual: "Cell under-voltage discharge protection. Returns float voltage [V] 1.8 to 4.20 V",
        human: "A secondary low-voltage cutoff specifically for discharge. When any cell drops to this level the BMS signals connected inverters to reduce or stop load. Example: set to 2.95V — slightly above CMIN to give connected devices warning before a hard disconnect."
      },
      ERLD: {
        manual: "Error log delete. Returns unsigned char value 0 or 1",
        human: "Set to 1 and restart the BMS to wipe the error log. Use after investigating and resolving a fault. Example: set to 1 after clearing a cell over-voltage fault."
      },
      VMAX: {
        manual: "Number of exceeded values of CMAX. Returns integer value 0 to 8000",
        human: "How many times a cell has exceeded the over-voltage threshold. A non-zero value means your charger has pushed cells too high at some point. Example: a value of 3 means the over-voltage protection has tripped 3 times."
      },
      VMIN: {
        manual: "Number of exceeded values of CMIN. Returns integer value 0 to 8000",
        human: "How many times a cell has hit the under-voltage cutoff. A non-zero value means cells have been over-discharged. Example: a value of 1 means the system ran flat once."
      },
      CAL1: {
        manual: "Cell 1 calibration offset. Returns float voltage [V] -0.030 to 0.030 V",
        human: "Fine voltage correction for cell 1 to account for measurement tolerances. Only adjust if you've verified actual cell voltage with a calibrated meter. Example: if cell 1 reads 3.320V on BMS but 3.325V on your meter, set CAL1 to +0.005."
      },
      CAL2: {
        manual: "Cell 2 calibration offset. Returns float voltage [V] -0.030 to 0.030 V",
        human: "Fine voltage correction for cell 2 to account for measurement tolerances. Only adjust if you've verified actual cell voltage with a calibrated meter. Example: if cell 2 reads 3.318V on BMS but 3.323V on your meter, set CAL2 to +0.005."
      },
      CAL3: {
        manual: "Cell 3 calibration offset. Returns float voltage [V] -0.030 to 0.030 V",
        human: "Fine voltage correction for cell 3 to account for measurement tolerances. Only adjust if you've verified actual cell voltage with a calibrated meter. Example: if cell 3 reads 3.322V on BMS but 3.315V on your meter, set CAL3 to -0.007."
      },
      CAL4: {
        manual: "Cell 4 calibration offset. Returns float voltage [V] -0.030 to 0.030 V",
        human: "Fine voltage correction for cell 4 to account for measurement tolerances. Only adjust if you've verified actual cell voltage with a calibrated meter. Example: if cell 4 reads 3.319V on BMS but 3.320V on your meter, set CAL4 to +0.001."
      },
      SERI: {
        manual: "ABMS serial number. Returns unsigned integer 0–9999",
        human: "The serial number of this ABMS unit. Used to identify the unit and displayed as the device name in SignalK."
      },
      TIME: {
        manual: "ABMS RTC time. Returns/accepts hh:mm:ss format",
        human: "The real-time clock time on the BMS. Set this to keep error log timestamps accurate. Example: set to current UTC or local time after initial install."
      },
      DATE: {
        manual: "ABMS RTC date. Returns/accepts dd.mm.yyyy format",
        human: "The real-time clock date on the BMS. Set this alongside TIME. Example: set to today's date after initial install or battery replacement."
      }
    };

    this.commandToDeltaPath = {
      BVOL: "balEndVoltage",
      BMIN: "balStartVoltage",
      CMAX: "maxAllowedCellVoltage",
      MAXH: "maxAllowedVoltageHysteresis",
      CMIN: "minAllowedCellVoltage",
      MINH: "minAllowedVoltageHysteresis",
      CHAR: "endChargeVoltage",
      CHIS: "endChargeHysteresis",
      UBDI: "endOfChargeCellDifference",
      CFVC: "floatVoltageCoefficient",
      RAZL: "maxAllowedCellVoltDiff",
      TMAX: "cellOverTempSwitchOff",
      TMIN: "underTempChargeDisable",
      TBAL: "bmsOverTempSwitchOff",
      BMTH: "bmsOverTempSwitchOffHysteresis",
      IOFF: "currentSensorOffset",
      IOJA: "currentSensorCoefficient",
      CYCL: "batteryCycleCount",
      CAPA: "capacity.nominal",
      CHEM: "chemistry",
      SOCH: "socHysteresis",
      SOCS: "socReset",
      CHAC: "chargeCoefficient",
      DCHC: "dischargeCoefficient",
      STRN: "numberOfInverterDevices",
      MAXC: "maxChargeCurrent",
      MAXD: "maxDischargeCurrent",
      CLOW: "minDischargeCellVoltage",
      ERLD: "errorLogDelete",
      VMAX: "vmaxExceededCount",
      VMIN: "vminExceededCount",
      CAL1: "calibrationOffsetCell1",
      CAL2: "calibrationOffsetCell2",
      CAL3: "calibrationOffsetCell3",
      CAL4: "calibrationOffsetCell4",
      SERI: "deviceName",
      TIME: "time",
      DATE: "date"
    };

    this.commandToLabel = {
      BVOL: "Balance end voltage",
      BMIN: "Balancing start voltage",
      CMAX: "Cell over-voltage switch-off",
      MAXH: "Over-voltage switch-off hysteresis",
      CMIN: "Cell under-voltage protection switch-off",
      MINH: "Under-voltage switch-off hysteresis",
      CHAR: "Cell end of charging voltage",
      CHIS: "End of charging voltage hysteresis",
      UBDI: "End of charging allowed cell voltage difference",
      CFVC: "Float voltage coefficient",
      RAZL: "Cells max difference",
      TMAX: "Cell over-temperature switch-off",
      TMIN: "Under-temperature charging disable",
      TBAL: "BMS over-temperature switch-off",
      BMTH: "BMS over-temperature switch-off hysteresis",
      IOFF: "Current measurement zero offset",
      IOJA: "Voltage to current coefficient",
      CYCL: "Number of full battery pack cycles",
      CAPA: "Battery pack capacity",
      CHEM: "Li-ion chemistry",
      SOCH: "SOC end of charge hysteresis",
      SOCS: "SOC manual re-set",
      CHAC: "Charge coefficient (0-5C)",
      DCHC: "Discharge coefficient (0-5C)",
      STRN: "Number of inverter devices on the bus",
      MAXC: "Maximum charge current per inverter device",
      MAXD: "Maximum discharge current per inverter device",
      CLOW: "Cell under-voltage discharge protection",
      ERLD: "Error log delete",
      VMAX: "Number of exceeded values of CMAX",
      VMIN: "Number of exceeded values of CMIN",
      CAL1: "Cell 1 calibration offset",
      CAL2: "Cell 2 calibration offset",
      CAL3: "Cell 3 calibration offset",
      CAL4: "Cell 4 calibration offset",
      SERI: "ABMS serial number",
      TIME: "ABMS RTC time",
      DATE: "ABMS RTC date"
    };
  }

  init() {
    this._buildPopup();
    this._buildGrid();
    this._setupManualCommand();
    this.prefillValues();
  }

  _buildPopup() {
    const popup = document.createElement('div');
    popup.id = 'settings-popup';
    popup.style.cssText = `
      display: none;
      position: fixed;
      z-index: 1000;
      background: var(--card-background);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: var(--shadow-lg);
      padding: 14px 16px;
      max-width: 320px;
      font-size: 13px;
      line-height: 1.5;
    `;
    popup.innerHTML = `
      <div style="font-weight:700;color:var(--primary-color);margin-bottom:8px;font-size:14px;" id="popup-title"></div>
      <div style="margin-bottom:10px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);margin-bottom:3px;">Manual</div>
        <div id="popup-manual" style="color:var(--text-primary);font-style:italic;"></div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);margin-bottom:3px;">What it does</div>
        <div id="popup-human" style="color:var(--text-primary);"></div>
      </div>
    `;
    document.body.appendChild(popup);
    this._popup = popup;

    document.addEventListener('click', (e) => {
      if (!popup.contains(e.target) && !e.target.classList.contains('settings-cmd-name')) {
        popup.style.display = 'none';
      }
    });
  }

  _validateInput(cmd, rawValue) {
    const limits = this.commandLimits[cmd];
    if (!limits) return null;

    const isTemp = this.tempCommands.has(cmd);
    const num = limits.type === 'integer' ? parseInt(rawValue, 10) : parseFloat(rawValue);

    if (isNaN(num)) return 'Enter a valid number';

    if (limits.type === 'integer' && !Number.isInteger(num)) {
      return 'Must be a whole number';
    }

    if (num < limits.min || num > limits.max) {
      const unit = isTemp ? '°C' : '';
      return `Value must be between ${limits.min}${unit} and ${limits.max}${unit}`;
    }

    return null;
  }

  _buildGrid() {
    const container = document.getElementById('settings-command-grid');
    if (!container) return;
    container.innerHTML = '';

    this.commandGroups.forEach(group => {
      const section = document.createElement('div');
      section.className = 'settings-section';

      const h3 = document.createElement('h3');
      h3.textContent = group.title;
      section.appendChild(h3);

      const grid = document.createElement('div');
      grid.className = 'settings-grid';

      group.commands.forEach(cmd => {
        const wrap = document.createElement('div');
        wrap.className = 'settings-grid-group';
        wrap.innerHTML = `
          <label class="settings-grid-label">
            <span class="settings-cmd-name" data-cmd="${cmd}" style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px;">${cmd}</span><span class="settings-cmd-description">- ${this.commandToLabel[cmd] || ''}</span>
          </label>
          <div class="settings-grid-input-row">
            <input type="text" id="cmd-${cmd}" class="settings-input">
            <button class="btn btn-primary btn-sm" data-command="${cmd}">Set</button>
          </div>
        `;

        // Clear error state when user starts typing
        const inputEl = wrap.querySelector('input');
        inputEl.addEventListener('input', () => {
          inputEl.classList.remove('input-error');
          const msg = wrap.querySelector('.input-error-msg');
          if (msg) msg.remove();
        });

        grid.appendChild(wrap);
      });

      section.appendChild(grid);
      container.appendChild(section);
    });

    // Label click → show popup
    container.querySelectorAll('.settings-cmd-name').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const cmd = el.dataset.cmd;
        const info = this.commandInfo[cmd];
        if (!info) return;

        document.getElementById('popup-title').textContent = `${cmd} — ${this.commandToLabel[cmd] || ''}`;
        document.getElementById('popup-manual').textContent = info.manual;
        document.getElementById('popup-human').textContent = info.human;

        const rect = el.getBoundingClientRect();
        const popup = this._popup;
        popup.style.display = 'block';

        // Position below the label, adjust if near bottom of viewport
        let top = rect.bottom + 6;
        if (top + 220 > window.innerHeight) top = rect.top - 220;
        popup.style.top = top + 'px';
        popup.style.left = Math.min(rect.left, window.innerWidth - 340) + 'px';
      });
    });

    container.querySelectorAll('button[data-command]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cmd = btn.dataset.command;
        const input = document.getElementById(`cmd-${cmd}`);
        const value = input.value.trim();
        if (!value) return;

        // Clear previous error
        input.classList.remove('input-error');
        const existingError = input.parentElement.querySelector('.input-error-msg');
        if (existingError) existingError.remove();

        const error = this._validateInput(cmd, value);
        if (error) {
          input.classList.add('input-error');
          const msg = document.createElement('div');
          msg.className = 'input-error-msg';
          msg.textContent = error;
          input.parentElement.appendChild(msg);
          return;
        }

        btn.disabled = true;
        const response = await this._sendCommand(`${cmd} ${value}`);
        const ok = response && typeof response === 'object' && Object.keys(response).length > 0;
        input.value = ok ? 'OK' : 'FAIL';
        btn.disabled = false;

        setTimeout(() => this.prefillValues(), 5000);
      });
    });
  }

  async prefillValues() {
    try {
      const res = await fetch(`/signalk/v1/api/vessels/self/${this.prefix}`);
      const bmsData = await res.json();

      for (const group of this.commandGroups) {
        for (const cmd of group.commands) {
          const field = document.getElementById(`cmd-${cmd}`);
          if (!field) continue;
          const path = this.commandToDeltaPath[cmd];
          if (!path) continue;

          const val = path.split('.').reduce((obj, key) => obj?.[key], bmsData)?.value;
          if (val !== undefined) {
            field.value = this.tempCommands.has(cmd)
              ? (val - 273.15).toFixed(3)
              : val;
          }
        }
      }
    } catch (err) {
      console.error('[SETTINGS] prefill failed:', err);
    }
  }

  _setupManualCommand() {
    const input = document.getElementById('command-input');
    const btn = document.getElementById('command-submit');
    const output = document.getElementById('command-response');
    if (!input || !btn || !output) return;

    btn.addEventListener('click', async () => {
      const command = input.value.trim();
      if (!command) return;
      btn.disabled = true;
      try {
        const result = await this._sendCommand(command);
        output.textContent = typeof result === 'object'
          ? JSON.stringify(result, null, 2)
          : String(result);
        setTimeout(() => this.prefillValues(), 3000);
      } catch (err) {
        output.textContent = 'Error: ' + err.message;
      }
      btn.disabled = false;
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btn.click();
    });
  }

  async _sendCommand(command) {
    const res = await fetch('/signalk/v1/bms/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    const result = await res.json();
    return result.response;
  }
}
