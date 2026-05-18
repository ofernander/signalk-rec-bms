'use strict';

class BMSChart {
  constructor() {
    this.chart = null;
    this.activeHours = 1;
    this.pollTimer = null;
    this.POLL_INTERVAL_MS = 15000; // refresh chart every 15s
  }

  init() {
    const canvas = document.getElementById('historyChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const isDark = () => document.body.classList.contains('night-mode');

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Voltage (V)',
            yAxisID: 'yVoltage',
            borderColor: '#2c5282',
            backgroundColor: 'rgba(44,82,130,0.08)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            data: []
          },
          {
            label: 'Current (A)',
            yAxisID: 'yCurrent',
            borderColor: '#38a169',
            backgroundColor: 'rgba(56,161,105,0.08)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            data: []
          },
          {
            label: 'Power (W)',
            yAxisID: 'yPower',
            borderColor: '#d69e2e',
            backgroundColor: 'rgba(214,158,46,0.08)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            data: []
          },
          {
            label: 'SOC (%)',
            yAxisID: 'ySOC',
            borderColor: '#805ad5',
            backgroundColor: 'rgba(128,90,213,0.08)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            data: []
          }
        ]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 11 },
              boxWidth: 12,
              color: () => isDark() ? '#ff4444' : '#2d3748'
            }
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                if (!items.length) return '';
                const d = new Date(items[0].parsed.x);
                return d.toLocaleTimeString();
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: { tooltipFormat: 'HH:mm:ss' },
            ticks: {
              maxTicksLimit: 8,
              color: () => isDark() ? '#cc2222' : '#718096',
              font: { size: 10 }
            },
            grid: { color: () => isDark() ? '#3d0000' : '#e2e8f0' }
          },
          yVoltage: {
            position: 'left',
            title: { display: true, text: 'V', font: { size: 10 } },
            ticks: { color: '#2c5282', font: { size: 10 }, maxTicksLimit: 6 },
            grid: { color: () => isDark() ? '#3d0000' : '#e2e8f0' }
          },
          yCurrent: {
            position: 'right',
            title: { display: true, text: 'A', font: { size: 10 } },
            ticks: { color: '#38a169', font: { size: 10 }, maxTicksLimit: 6 },
            grid: { drawOnChartArea: false }
          },
          yPower: {
            position: 'right',
            title: { display: true, text: 'W', font: { size: 10 } },
            ticks: { color: '#d69e2e', font: { size: 10 }, maxTicksLimit: 6 },
            grid: { drawOnChartArea: false }
          },
          ySOC: {
            position: 'right',
            min: 0,
            max: 100,
            title: { display: true, text: '%', font: { size: 10 } },
            ticks: { color: '#805ad5', font: { size: 10 }, maxTicksLimit: 6 },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });

    // Time range buttons
    document.querySelectorAll('.chart-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeHours = parseFloat(btn.dataset.hours);
        this.fetch();
      });
    });

    this.fetch();
    this.pollTimer = setInterval(() => this.fetch(), this.POLL_INTERVAL_MS);
  }

  async fetch() {
    try {
      const res = await fetch(`/signalk/v1/bms/history?hours=${this.activeHours}`);
      if (!res.ok) return;
      const json = await res.json();
      this._update(json);
    } catch (e) {
      // silently ignore — buffer may not be ready yet
    }
  }

  _update(json) {
    const { data } = json;
    if (!data) return;

    const toPoints = (arr) => arr.map(p => ({ x: p.t, y: p.v }));

    const vPoints = toPoints(data.voltage || []);
    const cPoints = toPoints(data.current || []);
    const pPoints = toPoints(data.power   || []);
    // SOC arrives as 0-1 ratio — convert to percentage for display
    const sPoints = (data.soc || []).map(p => ({ x: p.t, y: p.v * 100 }));

    const total = vPoints.length + cPoints.length + pPoints.length + sPoints.length;
    const emptyEl = document.getElementById('chartEmpty');

    if (total === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    this.chart.data.datasets[0].data = vPoints;
    this.chart.data.datasets[1].data = cPoints;
    this.chart.data.datasets[2].data = pPoints;
    this.chart.data.datasets[3].data = sPoints;
    this.chart.update('none');
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

const BMSChartManager = new BMSChart();
