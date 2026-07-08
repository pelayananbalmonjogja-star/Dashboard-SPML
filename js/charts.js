/**
 * =======================================================
 *  CHARTS
 * =======================================================
 */
const Charts = {
  gauge: null,
  pie: null,
  bar: null,

  colors: {
    navy: '#0B2C56',
    green: '#16A34A',
    orange: '#F59E0B',
    red: '#DC2626',
    gray: '#E5E7EB'
  },

  renderGauge(canvasId, value, label) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    const color = pct >= 90 ? this.colors.green : pct >= 75 ? this.colors.orange : this.colors.red;
    const centerLabel = label || 'Operasional';

    if (this.gauge) this.gauge.destroy();
    this.gauge = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [pct, 100 - pct],
          backgroundColor: [color, '#EDF0F3'],
          borderWidth: 0,
          circumference: 180,
          rotation: 270,
          cutout: '75%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { animateRotate: true, duration: 900 }
      },
      plugins: [{
        id: 'gaugeText',
        afterDraw(chart) {
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          const x = (chartArea.left + chartArea.right) / 2;
          const y = chartArea.bottom - 6;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#0B2C56';
          ctx.font = '700 26px Plus Jakarta Sans, sans-serif';
          ctx.fillText(pct.toFixed(2) + '%', x, y);
          ctx.font = '600 11px Inter, sans-serif';
          ctx.fillStyle = '#6B7280';
          ctx.fillText(centerLabel, x, y + 16);
          ctx.restore();
        }
      }]
    });
  },

  /** opts: { showLegend: bool (default true), colors: [...] } */
  renderPie(canvasId, labels, values, opts) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (this.pie) this.pie.destroy();
    opts = opts || {};

    const palette = opts.colors || [this.colors.green, this.colors.red, this.colors.orange, this.colors.navy, '#8B5CF6'];

    this.pie = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map((_, i) => palette[i % palette.length]),
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: opts.showLegend !== false, position: 'bottom', labels: { boxWidth: 10, font: { size: 11.5 } } } },
        animation: { duration: 800 }
      }
    });
  },

  renderBar(canvasId, labels, targetData, capaianData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (this.bar) this.bar.destroy();

    this.bar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Target', data: targetData, backgroundColor: '#CBD5E1', borderRadius: 6, maxBarThickness: 26 },
          { label: 'Capaian', data: capaianData, backgroundColor: this.colors.navy, borderRadius: 6, maxBarThickness: 26 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11.5 } } } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: '#F1F3F5' } }
        },
        animation: { duration: 800 }
      }
    });
  }
};
