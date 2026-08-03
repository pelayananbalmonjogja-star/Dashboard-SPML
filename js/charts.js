/**
 * =======================================================
 *  CHARTS
 * =======================================================
 */
const Charts = {
  gauge: null,
  pie: null,
  bar: null,
  gauges: {}, // registry of mini/multi gauge instances, keyed by canvasId

  colors: {
    navy: '#FF0000',
    green: '#16A34A',
    orange: '#F59E0B',
    red: '#FF0000',
    gray: '#E5E7EB'
  },

  /** opts: { fontSize: number (default 26), track: hex color for unfilled track } */
  renderGauge(canvasId, value, label, opts) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    opts = opts || {};
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    const color = pct >= 90 ? this.colors.green : pct >= 75 ? this.colors.orange : this.colors.red;
    const centerLabel = label || 'Operasional';
    const fontSize = opts.fontSize || 26;
    const track = opts.track || '#FFF000';

    if (this.gauges[canvasId]) this.gauges[canvasId].destroy();
    // keep legacy alias for the original single "Operasional" gauge
    if (canvasId === 'gaugeCanvas') this.gauge = null;

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [pct, 100 - pct],
          backgroundColor: [color, track],
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
          const y = chartArea.bottom - (fontSize < 20 ? 2 : 6);
          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#FF0000';
          ctx.font = `700 ${fontSize}px Plus Jakarta Sans, sans-serif`;
          ctx.fillText(pct.toFixed(2) + '%', x, y);
          if (centerLabel) {
            ctx.font = `600 ${Math.max(9, Math.round(fontSize * 0.42))}px Inter, sans-serif`;
            ctx.fillStyle = '#7A5A20';
            ctx.fillText(centerLabel, x, y + Math.round(fontSize * 0.6));
          }
          ctx.restore();
        }
      }]
    });

    this.gauges[canvasId] = chart;
    if (canvasId === 'gaugeCanvas') this.gauge = chart;
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
          { label: 'Target', data: targetData, backgroundColor: '#FFF000', borderRadius: 6, maxBarThickness: 26 },
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
