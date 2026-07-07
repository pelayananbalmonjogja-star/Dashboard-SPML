/**
 * =======================================================
 *  UTILITIES
 * =======================================================
 */
const Utils = {
  escape(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /** Animasi hitung angka naik dari 0 ke nilai akhir */
  animateCounters(container) {
    const els = container.querySelectorAll('[data-count-to]');
    els.forEach(el => {
      const target = parseFloat(el.getAttribute('data-count-to')) || 0;
      const unitHtml = el.querySelector('.unit') ? el.querySelector('.unit').outerHTML : '';
      const duration = 700;
      const start = performance.now();

      function step(now) {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = target * eased;
        const display = Number.isInteger(target) ? Math.round(current) : current.toFixed(2);
        el.innerHTML = display + unitHtml;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  },

  /** Animasi progress bar melebar sesuai data-target-width */
  animateBars(container) {
    const bars = container.querySelectorAll('[data-target-width]');
    requestAnimationFrame(() => {
      bars.forEach(bar => {
        bar.style.width = bar.getAttribute('data-target-width');
      });
    });
  },

  /** Urutkan array periode {tahun, bulan, bulanIndex} ascending */
  sortPeriods(list) {
    return list.sort((a, b) => {
      if (a.tahun !== b.tahun) return Number(a.tahun) - Number(b.tahun);
      return (a.bulanIndex ?? 0) - (b.bulanIndex ?? 0);
    });
  },

  todayString() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }
};
