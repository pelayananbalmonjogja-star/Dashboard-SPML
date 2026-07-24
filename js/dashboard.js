/**

 * =======================================================

 *  DASHBOARD (PUBLIC, READ-ONLY) — REDESIGN

 *  Membaca langsung dari Firestore. Skema data TIDAK berubah,

 *  hanya tampilannya yang dirombak mengikuti desain baru.

 * =======================================================

 */

const TARGET_OPERASIONAL = 85; // target garis acuan gauge Operasional (%)



const Dashboard = {

  state: { tahun: '', bulan: '', dataTable: null },



  async init() {

    this.setupSidebarToggle();



    document.getElementById('btnRefresh').addEventListener('click', () => this.loadData());

    document.getElementById('selPeriode').addEventListener('change', (e) => {

      const [tahun, bulan] = e.target.value.split('|');

      this.state.tahun = tahun;

      this.state.bulan = bulan;

      this.loadData();

    });



    await this.loadPeriods();

    await this.loadData();

  },



  setupSidebarToggle() {

    const btn = document.getElementById('btnSidebarToggle');

    const sidebar = document.getElementById('pkSidebar');

    if (!btn || !sidebar) return;

    btn.addEventListener('click', () => sidebar.classList.toggle('open'));

    document.querySelectorAll('.pk-nav-item').forEach(a => {

      a.addEventListener('click', () => sidebar.classList.remove('open'));

    });

  },



  showLoading(show) {

    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';

  },



  async loadPeriods() {

    const snap = await db.collection('periode').get();

    let periods = [];

    snap.forEach(doc => periods.push(doc.data()));

    periods = Utils.sortPeriods(periods);



    const sel = document.getElementById('selPeriode');

    if (periods.length === 0) {

      sel.innerHTML = '<option value="">-</option>';

      return;

    }



    // urutan terbaru dulu di dropdown

    const reversed = [...periods].reverse();

    sel.innerHTML = reversed.map(p => `<option value="${p.tahun}|${p.bulan}">${p.bulan} ${p.tahun}</option>`).join('');



    const lastPeriod = periods[periods.length - 1];

    this.state.tahun = lastPeriod.tahun;

    this.state.bulan = lastPeriod.bulan;

    sel.value = `${lastPeriod.tahun}|${lastPeriod.bulan}`;

  },



  async loadData() {

    if (!this.state.tahun || !this.state.bulan) {

      this.renderError('Belum ada data. Silakan input data dulu di halaman Data Bulanan.');

      return;

    }

    this.showLoading(true);

    try {

      const { tahun, bulan } = this.state;

      const id = periodeId(tahun, bulan);



      const [pkSnap, surveiSnap, primaaksiSnap, monitoringSnap, pelayananSnap, kegiatanSnap, tamuSnap, sppSnap, isrTerbitSnap, catatanSnap] = await Promise.all([

        db.collection('pk').doc(id).get(),

        db.collection('survei').doc(id).get(),

        db.collection('primaaksi').doc(id).get(),

        db.collection('monitoring').where('tahun', '==', tahun).where('bulan', '==', bulan).get(),

        db.collection('pelayanan').where('tahun', '==', tahun).where('bulan', '==', bulan).get(),

        db.collection('kegiatan').where('tahun', '==', tahun).where('bulan', '==', bulan).get(),

        db.collection('tamuLayanan').doc(id).get(),

        db.collection('sppBhp').doc(id).get(),

        db.collection('isrTerbit').doc(id).get(),

        db.collection('catatan').where('tahun', '==', tahun).where('bulan', '==', bulan).get()

      ]);



      const pk = pkSnap.exists ? pkSnap.data() : null;

      const survei = surveiSnap.exists ? surveiSnap.data() : null;

      const primaaksi = primaaksiSnap.exists ? primaaksiSnap.data() : null;

      const monitoring = []; monitoringSnap.forEach(d => monitoring.push(d.data()));

      const pelayanan = []; pelayananSnap.forEach(d => pelayanan.push({ id: d.id, ...d.data() }));

      const kegiatan = []; kegiatanSnap.forEach(d => kegiatan.push({ id: d.id, ...d.data() }));

      const tamu = tamuSnap.exists ? tamuSnap.data() : null;

      const spp = sppSnap.exists ? sppSnap.data() : null;

      const isrTerbit = isrTerbitSnap.exists ? isrTerbitSnap.data() : null;

      const catatan = []; catatanSnap.forEach(d => catatan.push({ id: d.id, ...d.data() }));



      this.renderAll({ pk, survei, primaaksi, monitoring, pelayanan, kegiatan, tamu, spp, isrTerbit, catatan });

    } catch (err) {

      console.error(err);

      this.renderError(err.message);

    } finally {

      this.showLoading(false);

    }

  },



  renderError(message) {

    document.getElementById('section-kpi').innerHTML = `<div class="state-box error">⚠ ${Utils.escape(message)}</div>`;

  },



  renderAll(data) {

    this.renderKpi(data.pk);

    this.renderOperasional(data.pk, data.monitoring);

    this.renderPrimaaksi(data.primaaksi, data.pk);

    this.renderSurvey(data.survei);

    this.renderTamu(data.tamu);

    this.renderIsrSpp(data.isrTerbit, data.spp);

    this.renderPelayanan(data.pelayanan);

    this.renderKegiatanLog(data.kegiatan);

    this.renderCatatan(data.catatan);

    this.renderFootnote();

  },



  /* ---------------- helpers ---------------- */

  starsHtml(value, max) {

    const ratio = Math.max(0, Math.min(1, (Number(value) || 0) / max));

    const total = ratio * 5;

    const full = Math.floor(total);

    const half = (total - full) >= 0.5;

    let html = '';

    for (let i = 0; i < 5; i++) {

      if (i < full) html += '<i class="fa-solid fa-star"></i>';

      else if (i === full && half) html += '<i class="fa-solid fa-star-half-stroke"></i>';

      else html += '<i class="fa-regular fa-star"></i>';

    }

    return html;

  },



  pillFor(pct) {

    if (pct >= 90) return { text: 'Sudah Dilaksanakan', cls: 'pk-pill-success' };

    if (pct >= 1) return { text: 'Sudah Dilaksanakan', cls: 'pk-pill-success' };

    return { text: 'Belum Dilaksanakan', cls: 'pk-pill-danger' };

  },



  /* ---------------- KPI CARDS ---------------- */

  renderKpi(pk) {

    const grid = document.getElementById('section-kpi');

    if (!pk) {

      grid.innerHTML = `<div class="state-box">Belum ada data PK untuk periode ini.</div>`;

      return;

    }

    // "Operasional SMFR" tidak ditampilkan sebagai kartu di sini karena sudah

    // diwakili oleh gauge pada panel "1. Operasional SMFR di UPT".

    const fields = [

      { key: 'Piutang', label: 'Pelayanan Piutang BHP', icon: 'fa-file-circle-check', color: '#122C6F', type: 'percent' },

      { key: 'SOR', label: 'Penyelenggaraan Layanan SOR', icon: 'fa-id-card', color: '#6695ED', type: 'percent' },

      { key: 'LKE', label: 'LKE Pembangunan ZI', icon: 'fa-shield-halved', color: '#B82638', type: 'percent' },

      { key: 'IKM', label: 'IKM / IPKP', scale: 'SKALA 4', icon: 'fa-face-smile', color: '#F13B1C' },

      { key: 'IPAK', label: 'IIPP / IPAK', scale: 'SKALA 10', icon: 'fa-shield-heart', color: '#40D872' },

      { key: 'PrimaAksi', label: 'PrimaAksi', icon: 'fa-bullseye', color: '#0B1D4A', type: 'percent' }

    ];



    grid.innerHTML = fields.map(f => {

      const raw = pk[f.key];

      const value = Number(raw) || 0;



      if (f.type === 'star') {

        return `

          <div class="pk-kpi-card">

            <div class="pk-kpi-icon" style="background:${f.color}22; color:${f.color};"><i class="fa-solid ${f.icon}"></i></div>

            <div class="pk-kpi-value">${value}</div>

            <div class="pk-kpi-label">${f.label}</div>

            ${f.scale ? `<div class="pk-kpi-scale">${f.scale}</div>` : ''}

            <div class="pk-kpi-stars">${this.starsHtml(value, f.max)}</div>

          </div>`;

      }



      const pill = this.pillFor(value);

      return `

        <div class="pk-kpi-card">

          <div class="pk-kpi-icon" style="background:${f.color}22; color:${f.color};"><i class="fa-solid ${f.icon}"></i></div>

          <div class="pk-kpi-value">${value}%</div>

          <div class="pk-kpi-label">${f.label}</div>

          <span class="pk-pill ${pill.cls}">${pill.text}</span>

        </div>`;

    }).join('');

  },



  /* ---------------- OPERASIONAL (gauge + site list) ---------------- */

  renderOperasional(pk, monitoring) {

    const value = pk ? Number(pk.Operasional) || 0 : 0;

    Charts.renderGauge('gaugeCanvas', value, 'Operasional');

    document.getElementById('gaugeTarget').textContent = `dari Target ${TARGET_OPERASIONAL}%`;



    const list = document.getElementById('siteList2');

    if (!monitoring || monitoring.length === 0) {

      list.innerHTML = `<div class="state-box" style="padding:10px 0;">Belum ada data monitoring untuk periode ini.</div>`;

      return;

    }

    list.innerHTML = monitoring.map(r => {

      const status = String(r.status || '').toLowerCase();

      // Baik (100%) = hijau, Rusak (75%) = merah. Status lama (Normal/Gangguan) tetap didukung untuk data lawas.

      const color = (status.includes('baik') || status.includes('normal'))

        ? 'var(--green)'

        : status.includes('gangguan') ? 'var(--orange)' : 'var(--red)';

      return `

        <div class="pk-site-row">

          <span class="pk-site-dot" style="background:${color};"></span>

          <span>${Utils.escape(r.site)}</span>

          <span class="pk-site-status" style="color:${color};">${Utils.escape(r.status)}</span>

        </div>`;

    }).join('');

  },



  /* ---------------- PRIMAAKSI (pie + legend + progress) ---------------- */

  renderPrimaaksi(primaaksi, pk) {

    const sesuai = primaaksi ? Number(primaaksi.Sesuai) || 0 : 0;

    const tidak = primaaksi ? Number(primaaksi.Tidak) || 0 : 0;

    const total = sesuai + tidak;

    const pctSesuai = total > 0 ? Math.round((sesuai / total) * 100) : 0;

    const pctTidak = total > 0 ? 100 - pctSesuai : 0;



    Charts.renderPie('pieCanvas', ['Sesuai ISR', 'Tidak Sesuai ISR'], [sesuai, tidak], {

      showLegend: false,

      colors: [Charts.colors.green, Charts.colors.red]

    });



    document.getElementById('pieLegend').innerHTML = `

      <div class="pk-legend-item">

        <span class="pk-legend-dot" style="background:${Charts.colors.green};"></span>

        <div class="pk-legend-text"><strong>Sesuai ISR</strong><span>${sesuai} (${pctSesuai}%)</span></div>

      </div>

      <div class="pk-legend-item">

        <span class="pk-legend-dot" style="background:${Charts.colors.red};"></span>

        <div class="pk-legend-text"><strong>Tidak Sesuai ISR</strong><span>${tidak} (${pctTidak}%)</span></div>

      </div>`;



    const progress = pk ? Number(pk.PrimaAksi) || 0 : 0;

    document.getElementById('primaaksiProgress').textContent = progress + '%';

    document.getElementById('primaaksiBar').style.width = Math.min(100, progress) + '%';

    document.getElementById('primaaksiTotal').textContent = `Total Data Verifikasi: ${total}`;

  },



  /* ---------------- SURVEY ---------------- */

  renderSurvey(survei) {

    const box = document.getElementById('surveyGrid');

    const respondenBox = document.getElementById('surveyResponden');

    if (!survei) {

      box.innerHTML = `<div class="state-box">Belum ada data survei.</div>`;

      respondenBox.innerHTML = '';

      return;

    }

    const ikm = Number(survei.IKM) || 0;

    const ipak = Number(survei.IPAK) || 0;

    const responden = Number(survei.Responden) || 0;



    box.innerHTML = `

      <div class="pk-survey-card">

        <div class="pk-survey-icon" style="--icon-bg:#6695ED1F; --icon-color:#6695ED;"><i class="fa-solid fa-clipboard-check"></i></div>

        <div class="pk-survey-label">IKM / IPKP</div>

        <div class="pk-survey-value">${ikm}</div>

        <div class="pk-survey-stars">${this.starsHtml(ikm, 4)}</div>

      </div>

      <div class="pk-survey-card">

        <div class="pk-survey-icon" style="--icon-bg:#6695ED1F; --icon-color:#6695ED;"><i class="fa-solid fa-arrow-trend-up"></i></div>

        <div class="pk-survey-label">IIPP / IPAK</div>

        <div class="pk-survey-value">${ipak}</div>

        <div class="pk-survey-stars">${this.starsHtml(ipak, 10)}</div>

      </div>`;



    respondenBox.innerHTML = `

      <div class="pk-survey-responden-icon"><i class="fa-solid fa-users"></i></div>

      <div>

        <div class="pk-survey-responden-label">Jumlah Responden</div>

        <div class="pk-survey-responden-value">${responden} Responden</div>

      </div>`;

  },



  /* ---------------- JUMLAH TAMU PELAYANAN (format sama seperti survey) ---------------- */
  renderTamu(tamu) {
    const box = document.getElementById('tamuGrid');
    const ooBox = document.getElementById('pelayananOOGrid');
    if (!tamu) {
      box.innerHTML = `<div class="state-box">Belum ada data tamu pelayanan.</div>`;
      ooBox.innerHTML = '';
      return;
    }
    const broadcast = Number(tamu.TamuBroadcast) || 0;
    const nonBroadcast = Number(tamu.TamuNonBroadcast) || 0;
    const online = Number(tamu.PelayananOnline) || 0;
    const offline = Number(tamu.PelayananOffline) || 0;

    box.innerHTML = `
      <div class="pk-survey-card pk-survey-card--row">
        <div class="pk-survey-icon" style="--icon-bg:#6695ED1F; --icon-color:#6695ED;"><i class="fa-solid fa-tower-broadcast"></i></div>
        <div>
          <div class="pk-survey-value">${broadcast}</div>
          <div class="pk-survey-label">Tamu Broadcast</div>
        </div>
      </div>
      <div class="pk-survey-card pk-survey-card--row">
        <div class="pk-survey-icon" style="--icon-bg:#6695ED1F; --icon-color:#6695ED;"><i class="fa-solid fa-user-group"></i></div>
        <div>
          <div class="pk-survey-value">${nonBroadcast}</div>
          <div class="pk-survey-label">Tamu Non Broadcast</div>
        </div>
      </div>`;

    ooBox.innerHTML = `
      <div class="pk-survey-card pk-survey-card--row">
        <div class="pk-survey-icon" style="--icon-bg:#40D8721F; --icon-color:#1B9E56;"><i class="fa-solid fa-globe"></i></div>
        <div>
          <div class="pk-survey-value">${online}</div>
          <div class="pk-survey-label">Pelayanan Online</div>
        </div>
      </div>
      <div class="pk-survey-card pk-survey-card--row">
        <div class="pk-survey-icon" style="--icon-bg:#40D8721F; --icon-color:#1B9E56;"><i class="fa-solid fa-shop"></i></div>
        <div>
          <div class="pk-survey-value">${offline}</div>
          <div class="pk-survey-label">Pelayanan Offline</div>
        </div>
      </div>`;
  },

  /* ---------------- PENERBITAN/PENCABUTAN ISR & SPP BHP (icon cards) ---------------- */
  renderIsrSpp(isr, spp) {
    const isrBox = document.getElementById('isrCards');
    if (!isr) {
      isrBox.innerHTML = `<div class="state-box">Belum ada data ISR untuk periode ini.</div>`;
    } else {
      const terbit = Number(isr.Terbit) || 0;
      const cabut = Number(isr.Cabut) || 0;
      isrBox.innerHTML = `
        <div class="pk-pelayanan-card" style="--card-color:#3B82F6">
          <div class="pk-pelayanan-icon"><i class="fa-solid fa-file-circle-check"></i></div>
          <div class="pk-pelayanan-value">${terbit}</div>
          <div class="pk-pelayanan-label">Jumlah Terbit ISR</div>
        </div>
        <div class="pk-pelayanan-card" style="--card-color:#22C55E">
          <div class="pk-pelayanan-icon"><i class="fa-solid fa-file-circle-xmark"></i></div>
          <div class="pk-pelayanan-value">${cabut}</div>
          <div class="pk-pelayanan-label">Jumlah ISR Tercabut</div>
        </div>`;
    }

    const sppBox = document.getElementById('sppCards');
    if (!spp) {
      sppBox.innerHTML = `<div class="state-box">Belum ada data SPP BHP untuk periode ini.</div>`;
    } else {
      const annual = Number(spp.SPPAnnual) || 0;
      const reminder = Number(spp.SPPReminder) || 0;
      const baru = Number(spp.SPPNew) || 0;
      const renewal = Number(spp.SPPRenewal) || 0;
      sppBox.innerHTML = `
        <div class="pk-pelayanan-card" style="--card-color:#7C3AED">
          <div class="pk-pelayanan-icon"><i class="fa-solid fa-calendar-check"></i></div>
          <div class="pk-pelayanan-value">${annual}</div>
          <div class="pk-pelayanan-label">SPP Annual</div>
        </div>
        <div class="pk-pelayanan-card" style="--card-color:#F97316">
          <div class="pk-pelayanan-icon"><i class="fa-solid fa-bell"></i></div>
          <div class="pk-pelayanan-value">${reminder}</div>
          <div class="pk-pelayanan-label">SPP Reminder</div>
        </div>
        <div class="pk-pelayanan-card" style="--card-color:#3B82F6">
          <div class="pk-pelayanan-icon"><i class="fa-solid fa-file-circle-plus"></i></div>
          <div class="pk-pelayanan-value">${baru}</div>
          <div class="pk-pelayanan-label">SPP New</div>
        </div>
        <div class="pk-pelayanan-card" style="--card-color:#14B8A6">
          <div class="pk-pelayanan-icon"><i class="fa-solid fa-rotate"></i></div>
          <div class="pk-pelayanan-value">${renewal}</div>
          <div class="pk-pelayanan-label">SPP Renewal</div>
        </div>`;
    }
  },

  /* ---------------- PELAYANAN PUBLIK (icon cards) ---------------- */

  pelayananIcon(jenis) {

    const j = String(jenis || '').toLowerCase();

    if (j.includes('unar')) return 'fa-graduation-cap';

    if (j.includes('invoice') || j.includes('piutang')) return 'fa-file-invoice-dollar';

    if (j.includes('klarifikasi') || j.includes('waba')) return 'fa-people-group';

    if (j.includes('lke')) return 'fa-shield-halved';

    return 'fa-list-check';

  },



  renderPelayanan(rows) {

    const box = document.getElementById('pelayananCards');

    if (!rows || rows.length === 0) {

      box.innerHTML = `<div class="state-box">Belum ada data pelayanan untuk periode ini.</div>`;

      return;

    }

    const palette = ['#3B82F6', '#22C55E', '#F97316', '#7C3AED', '#14B8A6', '#EC4899', '#3B82F6', '#F97316'];

    box.innerHTML = rows.map((r, i) => {

      const target = Number(r.target) || 0;

      const capaian = Number(r.capaian) || 0;

      const pct = target > 0 ? Math.round((capaian / target) * 100) : 0;

      const color = palette[i % palette.length];

      return `

        <div class="pk-pelayanan-card" style="--card-color:${color}">

          <div class="pk-pelayanan-icon"><i class="fa-solid ${this.pelayananIcon(r.jenis)}"></i></div>

          <div class="pk-pelayanan-value">${capaian}</div>

          <div class="pk-pelayanan-label">${Utils.escape(r.jenis)}</div>

          <div class="pk-pelayanan-target">Target: ${target}</div>

          <div class="pk-pelayanan-progress">

            <div class="pk-pelayanan-progress-track"><div class="pk-pelayanan-progress-fill" style="width:${Math.min(100, pct)}%"></div></div>

            <span class="pk-pelayanan-progress-pct" style="background:${color}22; color:${color};">${pct}%</span>

          </div>

        </div>`;

    }).join('');

  },



  /* ---------------- LOG KEGIATAN (DataTable) ---------------- */

  renderKegiatanLog(rows) {

    const wrap = document.getElementById('kegiatanWrap');

    if (this.state.dataTable) { this.state.dataTable.destroy(); this.state.dataTable = null; }

    if (!rows || rows.length === 0) {

      wrap.innerHTML = `<div class="state-box">Belum ada data kegiatan untuk periode ini.</div>`;

      return;

    }

    const columns = ['tanggalMulai', 'tanggalSelesai', 'judul', 'keterangan'];

    const headerLabels = { tanggalMulai: 'Tanggal Mulai', tanggalSelesai: 'Tanggal Selesai', judul: 'Judul', keterangan: 'Keterangan' };

    const thead = columns.map(c => `<th>${headerLabels[c]}</th>`).join('');

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

  },



  /* ---------------- CATATAN (read-only, diisi dari halaman Input) ---------------- */

  renderCatatan(rows) {

    const wrap = document.getElementById('catatanWrap');

    if (!wrap) return;

    if (!rows || rows.length === 0) {

      wrap.innerHTML = `<div class="state-box">Belum ada catatan untuk periode ini.</div>`;

      return;

    }

    const mingguOrder = ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4'];

    const sorted = [...rows].sort((a, b) => mingguOrder.indexOf(a.minggu) - mingguOrder.indexOf(b.minggu));

    const body = sorted.map(r => `

      <tr>

        <td class="pk-notes-week">${Utils.escape(r.minggu || '-')}</td>

        <td class="pk-notes-isi">${Utils.escape(r.isi || '').replace(/\n/g, '<br>')}</td>

      </tr>`).join('');

    wrap.innerHTML = `

      <table class="pk-notes-table">

        <thead><tr><th style="width:16%;">Minggu</th><th>Catatan</th></tr></thead>

        <tbody>${body}</tbody>

      </table>`;

  },



  renderFootnote() {

    document.getElementById('footerNote').innerHTML = `

      <i class="fa-solid fa-circle-info"></i>

      <span>Data diambil dari Laporan Monitoring dan Evaluasi Perjanjian Kinerja Tim Kerja SPML — Periode Bulan ${this.state.bulan} ${this.state.tahun}</span>`;

  }

};



document.addEventListener('DOMContentLoaded', () => Dashboard.init());
