export class BMSSettings {
  constructor() {
    this.tempCommands = new Set(['TMAX', 'TMIN', 'TBAL', 'BMTH']);

    this.commandGroups = [
      {
        title: "Voltage Settings",
        commands: ["BVOL", "BMIN", "CMAX", "MAXH", "CMIN", "MINH", "CHAR", "CHIS", "UBDI", "CFVC", "RAZL"]
      },
      {
        title: "Temperature Settings",
        commands: ["TMAX", "TMIN", "TBAL", "BMTH"]
      },
      {
        title: "Current Settings",
        commands: ["IOFF", "IOJA"]
      },
      {
        title: "Battery Pack Settings",
        commands: ["CYCL", "CAPA", "CHEM"]
      },
      {
        title: "SOC Settings",
        commands: ["SOCH", "SOCS"]
      },
      {
        title: "Victron/Wakespeed Settings",
        commands: ["CHAC", "DCHC", "STRN", "MAXC", "MAXD", "CLOW"]
      },
      {
        title: "Error Log Settings",
        commands: ["ERLD", "VMAX", "VMIN"]
      },
      {
        title: "ABMS Settings",
        commands: ["CAL1", "CAL2", "CAL3", "CAL4", "SERI", "TIME", "DATE"]
      }
    ];

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
      MODE: "relayMode",
      CAL1: "calibrationOffsetCell1",
      CAL2: "calibrationOffsetCell2",
      CAL3: "calibrationOffsetCell3",
      CAL4: "calibrationOffsetCell4",
      SERI: "deviceName",
      TIME: "time",
      DATE: "date",
      RSBR: "balancingCellNumber"
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
    this.createCommandGrid();
    this.setupManualCommandForm();
    this.prefillValues();
  }

  createCommandGrid() {
    const container = document.getElementById("settings-command-grid");
    if (!container) return;

    container.innerHTML = "";

    this.commandGroups.forEach(group => {
      const groupHeader = document.createElement("h4");
      groupHeader.textContent = group.title;
      container.appendChild(groupHeader);

      const grid = document.createElement("div");
      grid.className = "settings-grid";
      container.appendChild(grid);

      group.commands.forEach(cmd => {
        const wrapper = document.createElement("div");
        wrapper.className = "settings-grid-group";
        wrapper.innerHTML = `
          <label for="${cmd}" class="settings-label settings-grid-label">${cmd}<span class="settings-cmd-description">- ${this.commandToLabel[cmd] || ''}</span></label>
          <div class="settings-grid-input-row">
            <input type="text" id="${cmd}" class="settings-input settings-grid-input">
            <button class="settings-button primary settings-grid-button" data-command="${cmd}">Set</button>
          </div>
        `;
        grid.appendChild(wrapper);
      });
    });

    container.querySelectorAll("button[data-command]").forEach(button => {
      button.addEventListener("click", async () => {
        const cmd = button.getAttribute("data-command");
        const inputField = document.getElementById(cmd);
        const value = inputField.value.trim();
        if (!value) return;

        const response = await this.sendCommand(`${cmd} ${value}`);
        const success = response && typeof response === 'object' &&
          Object.keys(response).length > 0;

        inputField.value = success ? "OK" : "FAIL";

        setTimeout(() => this.prefillValues(), 5000);
      });
    });
  }

  async prefillValues() {
    try {
      const res = await fetch('/signalk/v1/api/vessels/self/electrical/batteries/bms');
      const bmsData = await res.json();

      for (const group of this.commandGroups) {
        for (const cmd of group.commands) {
          const field = document.getElementById(cmd);
          if (!field) continue;

          const path = this.commandToDeltaPath[cmd];
          if (!path) continue;

          // Support dot-notation paths (e.g. "capacity.nominal")
          const val = path.split('.').reduce((obj, key) => obj?.[key], bmsData)?.value;

          if (val !== undefined) {
            // Temperature values are stored in Kelvin; display in °C for user
            field.value = this.tempCommands.has(cmd)
              ? (val - 273.15).toFixed(3)
              : val;
          }
        }
      }
    } catch (err) {
      console.error("Failed to prefill settings from API:", err);
    }
  }

  async sendCommand(command) {
    const res = await fetch("/signalk/v1/bms/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command })
    });
    const result = await res.json();
    return result.response;
  }

  setupManualCommandForm() {
    const form = document.getElementById("command-form");
    const input = document.getElementById("command-input");
    const output = document.getElementById("command-response");

    if (!form || !input || !output) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const command = input.value.trim();
      if (!command) return;

      try {
        const result = await this.sendCommand(command);
        output.textContent = `Response:\n${typeof result === 'object' ? JSON.stringify(result, null, 2) : result}`;
        setTimeout(() => this.prefillValues(), 3000);
      } catch (err) {
        output.textContent = `Error: ${err.message}`;
      }
    });
  }
}
