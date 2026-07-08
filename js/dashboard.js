/**
 * =======================================================
 *  DASHBOARD (PUBLIC, READ-ONLY)
 *  Membaca langsung dari Firestore, tanpa Apps Script.
 * =======================================================
 */
const Dashboard = {
  state: { tahun: '', bulan: '', dataTable: null },

  async init() {
    document.getElementById('appName').textContent = APP_NAME;
    document.getElementById('appSubtitle').textContent = APP_SUBTITLE;

    document.getElementById('btnRefresh').addEventListener('click', () => this.loadData());
    document.getElementById('selTahun').addEventListener('change', (e) => {
      this.state.tahun = e.target.value;
      this.loadData();
    });
    document.getElementById('selBulan').addEventListener('change', (e) => {
      this.state.bulan = e.target.value;
      this.loadData();
    });

    await this.loadPeriods();
    await this.loadData();
  },

  showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
  },

  async loadPeriods() {
    const snap = await db.collection('periode').get();
    let periods = [];
    snap.forEach(doc => periods.push(doc.data()));
    periods = Utils.sortPeriods(periods);

    const tahunSet = [...new Set(periods.map(p => p.tahun))];
    const selTahun = document.getElementById('selTahun');
    const selBulan = document.getElementById('selBulan');

    if (tahunSet.length === 0) {
      selTahun.innerHTML = '<option value="">-</option>';
      selBulan.innerHTML = '<option value="">-</option>';
      return;
    }

    selTahun.innerHTML = tahunSet.map(t => `<option value="${t}">${t}</option>`).join('');
    const lastPeriod = periods[periods.length - 1];
    this.state.tahun = lastPeriod.tahun;
    this.state.bulan = lastPeriod.bulan;

    const bulanForTahun = periods.filter(p => p.tahun === this.state.tahun).map(p => p.bulan);
    selBulan.innerHTML = bulanForTahun.map(b => `<option value="${b}">${b}</option>`).join('');

    selTahun.value = this.state.tahun;
    selBulan.value = this.state.bulan;

    // saat ganti tahun, refresh daftar bulan yang tersedia untuk tahun itu
    selTahun.addEventListener('change', () => {
      const bulanList = periods.filter(p => p.tahun === selTahun.value).map(p => p.bulan);
      selBulan.innerHTML = bulanList.map(b => `<option value="${b}">${b}</option>`).join('');
      this.state.bulan = selBulan.value;
    });
  },

  async loadData() {
    if (!this.state.tahun || !this.state.bulan) {
      this.renderError('Belum ada data. Silakan input data dulu di halaman Input Data.');
      return;
    }
    this.showLoading(true);
    try {
      const id = periodeId(this.state.tahun, this.state.bulan);
      const [pkSnap, surveiSnap, primaaksiSnap, monitoringSnap, pelayananSnap, kegiatanSnap] = await Promise.all([
        db.collection('pk').doc(id).get(),
        db.collection('survei').doc(id).get(),
        db.collection('primaaksi').doc(id).get(),
        db.collection('monitoring').where('tahun', '==', this.state.tahun).where('bulan', '==', this.state.bulan).get(),
        db.collection('pelayanan').where('tahun', '==', this.state.tahun).where('bulan', '==', this.state.bulan).get(),
        db.collection('kegiatan').where('tahun', '==', this.state.tahun).where('bulan', '==', this.state.bulan).get()
      ]);

      const pk = pkSnap.exists ? pkSnap.data() : null;
      const survei = surveiSnap.exists ? surveiSnap.data() : null;
      const primaaksi = primaaksiSnap.exists ? primaaksiSnap.data() : null;
      const monitoring = []; monitoringSnap.forEach(d => monitoring.push(d.data()));
      const pelayanan = []; pelayananSnap.forEach(d => pelayanan.push({ id: d.id, ...d.data() }));
      const kegiatan = []; kegiatanSnap.forEach(d => kegiatan.push({ id: d.id, ...d.data() }));

      this.renderAll({ pk, survei, primaaksi, monitoring, pelayanan, kegiatan });
    } catch (err) {
      console.error(err);
      this.renderError(err.message);
    } finally {
      this.showLoading(false);
    }
  },

  renderError(message) {
    document.getElementById('kpiGrid').innerHTML = `<div class="state-box error">⚠ ${Utils.escape(message)}</div>`;
  },

  renderAll(data) {
    this.renderKpi(data.pk);
    Charts.renderGauge('gaugeCanvas', data.pk ? data.pk.Operasional : 0);
    if (data.primaaksi) {
      Charts.renderPie('pieCanvas',
        ['Sesuai', 'Tidak Sesuai'],
        [Number(data.primaaksi.Sesuai) || 0, Number(data.primaaksi.Tidak) || 0]);
    }
    this.renderSurvei(data.survei);
    this.renderPelayanan(data.pelayanan);
    this.renderMonitoring(data.monitoring);
    this.renderKegiatan(data.kegiatan);
  },

  renderKpi(pk) {
    const grid = document.getElementById('kpiGrid');
    if (!pk) {
      grid.innerHTML = `<div class="state-box">Belum ada data PK untuk periode ini.</div>`;
      return;
    }
   const fields = [
  { key: 'Operasional', unit: '%', label: 'Stasiun dan Perangkat Monitoring SMFR' },
  { key: 'Piutang', unit: '%', label: 'Penyelenggaraan Layanan SOR (UNAR, BIMTEK dan Layanan MOTS)' },
  { key: 'LKE', unit: '%', label: 'LKE Pembangunan ZI' },
  { key: 'IKM', unit: '', label: 'IKM / IPKP' },
  { key: 'IPAK', unit: '', label: 'IIPP / IPAK' },
  { key: 'PrimaAksi', unit: '%', label: 'PrimaAksi' }
];

    grid.innerHTML = fields.map(f => {
      const raw = pk[f.key];
      const value = Number(raw) || 0;
      const isPercentLike = f.unit === '%';
      const pct = isPercentLike ? value : Math.min(100, value * 10); // skala kasar utk ring non-persen (mis. IKM 0-10)
      const status = pct >= 90 ? 'success' : pct >= 75 ? 'warning' : 'danger';
      const color = status === 'success' ? 'var(--green)' : status === 'warning' ? 'var(--orange)' : 'var(--red)';

      return `
  <div class="kpi-card" data-status="${status}">
    <div class="kpi-top">
      <span class="kpi-label">${f.label}</span> 
      <div class="kpi-ring" style="--pct:${pct}; --ring-color:${color};">
        <div class="kpi-ring-inner">${Math.round(pct)}</div>
      </div>
    </div>
          <div class="kpi-value" data-count-to="${value}">0${isPercentLike ? '<span class="unit">%</span>' : ''}</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="background:${color};" data-target-width="${pct}%"></div></div>
        </div>`;
    }).join('');

    Utils.animateCounters(grid);
    Utils.animateBars(grid);
  },

  renderSurvei(survei) {
    const box = document.getElementById('surveiBox');
    if (!survei) { box.innerHTML = `<div class="state-box">Belum ada data survei.</div>`; return; }
    const items = [
      { label: 'IKM', value: survei.IKM },
      { label: 'IPAK', value: survei.IPAK },
      { label: 'Responden', value: survei.Responden }
    ];
    box.innerHTML = `
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr));">
        ${items.map(it => `
          <div style="text-align:center; padding:10px 6px;">
            <div style="font-size:22px; font-weight:800; color:var(--navy);">${Utils.escape(it.value)}</div>
            <div style="font-size:11.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.3px;">${it.label}</div>
          </div>`).join('')}
      </div>`;
  },

  renderPelayanan(rows) {
    const box = document.getElementById('pelayananBox');
    if (!rows || rows.length === 0) {
      box.innerHTML = `<div class="state-box">Belum ada data pelayanan untuk periode ini.</div>`;
      Charts.renderBar('barCanvas', [], [], []);
      return;
    }
    Charts.renderBar('barCanvas',
      rows.map(r => r.jenis),
      rows.map(r => Number(r.target) || 0),
      rows.map(r => Number(r.capaian) || 0));

    box.innerHTML = rows.map(r => {
      const target = Number(r.target) || 0;
      const capaian = Number(r.capaian) || 0;
      const pct = target > 0 ? Math.min(100, (capaian / target) * 100) : 0;
      return `
        <div class="service-row">
          <div class="service-top">
            <span class="name">${Utils.escape(r.jenis)}</span>
            <span class="ratio">${capaian}/${target}</span>
          </div>
          <div class="service-track"><div class="service-fill" style="width:${pct}%;"></div></div>
        </div>`;
    }).join('');
  },

  renderMonitoring(rows) {
    const list = document.getElementById('siteList');
    if (!rows || rows.length === 0) {
      list.innerHTML = `<div class="state-box">Belum ada data monitoring untuk periode ini.</div>`;
      return;
    }
    list.innerHTML = rows.map(r => {
      const status = String(r.status || '').toLowerCase();
      const badgeClass = status.includes('normal') || status.includes('baik') ? 'badge-normal'
        : status.includes('rusak') || status.includes('gangguan') ? 'badge-rusak'
        : 'badge-default';
      return `
        <div class="site-row">
          <span>${Utils.escape(r.site)}</span>
          <span class="badge ${badgeClass}">${Utils.escape(r.status)}</span>
        </div>`;
    }).join('');
  },

  renderKegiatan(rows) {
    const wrap = document.getElementById('kegiatanWrap');
    if (this.state.dataTable) { this.state.dataTable.destroy(); this.state.dataTable = null; }
    if (!rows || rows.length === 0) {
      wrap.innerHTML = `<div class="state-box">Belum ada data kegiatan untuk periode ini.</div>`;
      return;
    }
    const columns = ['tanggal', 'judul', 'keterangan'];
    const thead = columns.map(c => `<th>${c}</th>`).join('');
    const tbody = rows.map(r => `<tr>${columns.map(c => `<td>${Utils.escape(r[c])}</td>`).join('')}</tr>`).join('');

    wrap.innerHTML = `<table id="kegiatanTable" class="display" style="width:100%"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;

    this.state.dataTable = $('#kegiatanTable').DataTable({
      pageLength: 8,
      language: {
        search: 'Cari:', lengthMenu: 'Tampilkan _MENU_ baris',
        info: 'Menampilkan _START_-_END_ dari _TOTAL_ data',
        paginate: { previous: 'Sebelumnya', next: 'Berikutnya' }, zeroRecords: 'Data tidak ditemukan'
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());
