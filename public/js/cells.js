'use strict';

class CellManager {
  constructor() {
    this.container = null;
    this.scaleEl = null;
    this.limitScaleEl = null;
    this.towers = {};
    this.scaleMax = 4.0;
    this.scaleMin = 0;
  }

  init(containerId) {
    this.container = document.getElementById(containerId);
    this.scaleEl = document.getElementById('voltageScale');
    this.limitScaleEl = document.getElementById('limitScale');
    if (!this.container) {
      console.error('[CELLS] Container not found:', containerId);
      return;
    }
    this._drawScale();
  }

  _drawScale() {
    if (!this.scaleEl) return;
    this.scaleEl.innerHTML = '';

    const min = this.scaleMin;
    const max = this.scaleMax;
    const range = max - min;
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      if (i === 0) continue;
      const v = min + (range / steps) * i;
      const mark = document.createElement('div');
      mark.className = 'voltage-mark';
      mark.textContent = v.toFixed(2) + 'V';
      mark.style.position = 'absolute';
      mark.style.bottom = (((v - min) / range) * 100) + '%';
      mark.style.right = '0';
      mark.style.fontSize = '10px';
      mark.style.color = 'var(--text-secondary)';
      mark.style.transform = 'translateY(50%)';
      this.scaleEl.appendChild(mark);
    }
  }

  _updateScaleBounds(minCellVoltage, maxCellVoltage, minAllowedCellVoltage) {
    const newMax = Math.max(maxCellVoltage + 0.3, 4.0);
    const lowestV = Math.min(minCellVoltage, minAllowedCellVoltage || minCellVoltage);
    const newMin = Math.max(lowestV - 0.3, 0);

    const changed =
      Math.abs(newMax - this.scaleMax) > 0.05 ||
      Math.abs(newMin - this.scaleMin) > 0.05;

    if (changed) {
      this.scaleMax = newMax;
      this.scaleMin = newMin;
      this._drawScale();
    }
  }

  _drawLimitMarkers({ minAllowedCellVoltage, maxAllowedCellVoltage, endChargeVoltage }) {
    if (!this.limitScaleEl) return;
    this.limitScaleEl.innerHTML = '';

    const range = this.scaleMax - this.scaleMin;

    const markers = [
      { value: maxAllowedCellVoltage, label: 'CMAX' },
      { value: endChargeVoltage,      label: 'CHAR' },
      { value: minAllowedCellVoltage, label: 'CMIN' }
    ]
      .filter(m => m.value !== null && m.value !== undefined)
      .map(m => ({ ...m, pct: ((m.value - this.scaleMin) / range) * 100 }))
      .filter(m => m.pct >= 0 && m.pct <= 100)
      .sort((a, b) => a.pct - b.pct);

    const MIN_GAP = 7;
    for (let i = 1; i < markers.length; i++) {
      const prev = markers[i - 1];
      const curr = markers[i];
      const gap = curr.pct - (prev.pct + (prev.labelOffset || 0));
      if (gap < MIN_GAP) {
        curr.labelOffset = (prev.pct + (prev.labelOffset || 0) + MIN_GAP) - curr.pct;
      }
    }

    markers.forEach(({ pct, label, labelOffset = 0 }) => {
      const marker = document.createElement('div');
      marker.className = 'limit-marker';
      marker.style.cssText = `
        position: absolute;
        bottom: ${pct}%;
        left: 0;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 3px;
        transform: translateY(50%);
        z-index: 2;
        pointer-events: none;
      `;

      const tick = document.createElement('div');
      tick.style.cssText = `
        width: 8px;
        height: 2px;
        background: var(--text-secondary);
        flex-shrink: 0;
      `;

      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      labelEl.style.cssText = `
        font-size: 9px;
        font-weight: 600;
        color: var(--text-secondary);
        line-height: 1;
        transform: translateY(${-labelOffset * 3}px);
      `;

      marker.appendChild(tick);
      marker.appendChild(labelEl);
      this.limitScaleEl.appendChild(marker);
    });
  }

  _getBarColor(voltage, minAllowed, maxAllowed) {
    const cmin = minAllowed || 2.5;
    const cmax = maxAllowed || 3.65;

    if (voltage >= cmax || voltage <= cmin) return 'danger';

    const range = cmax - cmin;
    const third = range / 3;
    const lowBound = cmin + third;
    const highBound = cmin + third * 2;

    if (voltage >= highBound) return '';
    if (voltage >= lowBound)  return 'warning';
    return 'low';
  }

  updateAllCells({ cellVoltages, cellResistances, minAllowedCellVoltage, maxAllowedCellVoltage, endChargeVoltage }) {
    if (!this.container) return;

    const entries = Object.entries(cellVoltages)
      .filter(([key]) => /^cellVoltage\d+$/.test(key))
      .sort((a, b) => parseInt(a[0].match(/\d+/)[0]) - parseInt(b[0].match(/\d+/)[0]));

    if (entries.length === 0) return;

    const maxV = Math.max(...entries.map(([, v]) => v));
    const minV = Math.min(...entries.map(([, v]) => v));
    this._updateScaleBounds(minV, maxV, minAllowedCellVoltage);

    this._drawLimitMarkers({ minAllowedCellVoltage, maxAllowedCellVoltage, endChargeVoltage });

    entries.forEach(([path, voltage]) => {
      const cellId = path.match(/\d+/)[0];
      const resistance = cellResistances[`cellResistance${cellId}`];
      this._updateCell(cellId, voltage, resistance, minAllowedCellVoltage, maxAllowedCellVoltage);
    });
  }

  _updateCell(cellId, voltage, resistance, minAllowed, maxAllowed) {
    let tower = this.towers[cellId];

    if (!tower) {
      tower = document.createElement('div');
      tower.className = 'cell-tower';

      const barWrap = document.createElement('div');
      barWrap.className = 'tower-bar-wrap';

      const bar = document.createElement('div');
      bar.className = 'tower-bar';
      barWrap.appendChild(bar);

      const info = document.createElement('div');
      info.className = 'tower-info';

      const voltageEl = document.createElement('div');
      voltageEl.className = 'tower-voltage';

      const resistanceEl = document.createElement('div');
      resistanceEl.className = 'tower-resistance';

      const label = document.createElement('div');
      label.className = 'tower-label';
      label.textContent = `Cell ${cellId}`;

      info.appendChild(voltageEl);
      info.appendChild(resistanceEl);

      tower.appendChild(barWrap);
      tower.appendChild(info);
      tower.appendChild(label);

      this.container.appendChild(tower);
      this.towers[cellId] = tower;
    }

    const range = this.scaleMax - this.scaleMin;
    const heightPct = Math.min(Math.max(((voltage - this.scaleMin) / range) * 100, 0), 100);
    const bar = tower.querySelector('.tower-bar');
    bar.style.height = heightPct + '%';
    bar.className = 'tower-bar ' + this._getBarColor(voltage, minAllowed, maxAllowed);

    tower.querySelector('.tower-voltage').textContent = voltage.toFixed(3) + 'V';
    tower.querySelector('.tower-resistance').textContent =
      resistance !== undefined ? (resistance * 1000).toFixed(2) + ' mΩ' : '-- mΩ';
  }
}

const CellVisualizer = new CellManager();
