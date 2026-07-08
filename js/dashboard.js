/**
 * =======================================================
 * DASHBOARD (PUBLIC, READ-ONLY) — REDESIGN
 * Membaca langsung dari Firestore. Skema data TIDAK berubah,
 * hanya tampilannya yang dirombak mengikuti desain baru.
 * =======================================================
 * * Update 2026: Sinkronisasi Otomatis dengan SITE_LIST input.js
 * & Integrasi Map Modal Interaktif Leaflet Dinamis.
 * =======================================================
 */
const TARGET_OPERASIONAL = 85; // target garis acuan gauge Operasional (%)

// DISELARASKAN DENGAN SITE_LIST PADA FILE input.js
const SINKRON_SITE_LIST = [
  'Site Kalasan',
  'Site Girimulyo',
  'Site Girijati',
  'Site Wonogiri',
  'Site Surakarta',
  'Site Wonosari',
  'Site Purworejo',
  'Site Kebumen',
  'Mobil Mon DF 1',
  'Mobil Mon DF 2'
];

// Koordinat perkiraan area operasional stasiun monitoring (DIY - Jawa Tengah)
// untuk memetakan pin Leaflet secara presisi & beraturan
const SITE_COORDINATES = {
  'Site Kalasan': { lat: -7.7661, lng: 110.4722 },
  'Site Girimulyo': { lat: -7.7523, lng: 110.1225 },
  'Site Girijati': { lat: -8.0125, lng: 110.3292 },
  'Site Wonogiri': { lat: -7.8114, lng: 110.9250 },
  'Site Surakarta': { lat: -7.5666, lng: 110.8242 },
  'Site Wonosari': { lat: -7.9658, lng: 110.6015 },
  'Site Purworejo': { lat: -7.7128, lng: 110.0078 },
  'Site Kebumen': { lat: -7.6692, lng: 109.6525 },
  'Mobil Mon DF 1': { lat: -7.7956, lng: 110.3695 }, // Bergerak / Base Pusat
  'Mobil Mon DF 2': { lat: -7.7900, lng: 110.3750 }  // Bergerak / Lempuyangan
};

const Dashboard = {
  state: { tahun: '', bulan: '', dataTable: null, currentMonitoringData: [] },

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

      const [pkSnap, surveiSnap, primaaksiSnap, monitoringSnap, pelayananSnap, kegiatanSnap] = await Promise.all([
        db.collection('pk').doc(id).get(),
        db.collection('survei').doc(id).get(),
        db.collection('primaaksi').doc(id).get(),
        db.collection('monitoring').where('tahun', '==', tahun).where('bulan', '==', bulan).get(),
        db.collection('pelayanan').where('tahun', '==', tahun).where('bulan', '==', bulan).get(),
        db.collection('kegiatan').where('tahun', '==', tahun).where('bulan', '==', bulan).get()
      ]);

      const pk = pkSnap.exists ? pkSnap.data() : null;
      const survei = surveiSnap.exists ? surveiSnap.data() : null;
      const primaaksi = primaaksiSnap.exists ? primaaksiSnap.data() : null;
      const monitoring = []; monitoringSnap.forEach(d => monitoring.push(d.data()));
      const pelayanan = []; pelayananSnap.forEach(d => pelayanan.push({ id: d.id, ...d.data() }));
      const kegiatan = []; kegiatanSnap.forEach(d => kegiatan.push({ id: d.id, ...d.data() }));

      // Simpan global state agar bisa diakses dinamis oleh fungsi initMap()
      this.state.currentMonitoringData = monitoring;

      this.renderAll({ pk, survei, primaaksi, monitoring, pelayanan, kegiatan });
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
    this.renderPelayanan(data.pelayanan);
    this.renderKegiatanLog(data.kegiatan);
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
    if (pct >= 1) return { text: 'Sudah Dilaksanakan', cls: 'pk-pill-warning' };
    return { text: 'Belum Dilaksanakan', cls: 'pk-pill-danger' };
  },

  /* ---------------- KPI CARDS ---------------- */
  renderKpi(pk) {
    const grid = document.getElementById('section-kpi');
    if (!pk) {
      grid.innerHTML = `<div class="state-box">Belum ada data PK untuk periode ini.</div>`;
      return;
    }
    const fields = [
      { key: 'Piutang', label: 'Pelayanan Piutang BHP', icon: 'fa-file-circle-check', color: '#16A34A', type: 'percent' },
      { key: 'SOR', label: 'Penyelenggaraan Layanan SOR', icon: 'fa-id-card', color: '#0891B2', type: 'percent' },
      { key: 'LKE', label: 'LKE Pembangunan ZI', icon: 'fa-shield-halved', color: '#7C3AED', type: 'percent' },
      { key: 'IKM', label: 'IKM / IPKP SKALA 4', icon: 'fa-face-smile', color: '#F59E0B', type: 'star', max: 4 },
      { key: 'IPAK', label: 'IIPP / IPAK SKALA 10', icon: 'fa-shield-heart', color: '#0D9488', type: 'star', max: 10 },
      { key: 'PrimaAksi', label: 'PrimaAksi', icon: 'fa-bullseye', color: '#DC2626', type: 'percent' }
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
      // Sinkronisasi warna indikator sesuai opsi 'Baik' / 'Rusak' dari inputApp
      const color = (status.includes('baik') || status.includes('normal')) 
        ? 'var(--green)' 
        : 'var(--red)';
      
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
      return;
    }
    const ikm = Number(survei.IKM) || 0;
    const ipak = Number(survei.IPAK) || 0;
    const responden = Number(survei.Responden) || 0;

    box.innerHTML = `
      <div class="pk-survey-card">
        <div class="pk-survey-label">IKM / IPKP</div>
        <div class="pk-survey-value">${ikm}</div>
        <div class="pk-survey-stars">${this.starsHtml(ikm, 4)}</div>
      </div>
      <div class="pk-survey-card">
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
    box.innerHTML = rows.map(r => {
      const target = Number(r.target) || 0;
      const capaian = Number(r.capaian) || 0;
      const pct = target > 0 ? Math.round((capaian / target) * 100) : 0;
      return `
        <div class="pk-pelayanan-card">
          <div class="pk-pelayanan-icon"><i class="fa-solid ${this.pelayananIcon(r.jenis)}"></i></div>
          <div class="pk-pelayanan-value">${capaian}</div>
          <div class="pk-pelayanan-label">${Utils.escape(r.jenis)}</div>
          <div class="pk-pelayanan-target">Target: ${target} (${pct}%)</div>
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

  renderFootnote() {
    document.getElementById('footerNote').innerHTML = `
      <i class="fa-solid fa-circle-info"></i>
      <span>Data diambil dari Laporan Monitoring dan Evaluasi Perjanjian Kinerja Tim Kerja SPML — Periode Bulan ${this.state.bulan} ${this.state.tahun}</span>`;
  }
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());


// =========================================================================
// CONTROLLER OVERLAY POP-UP MODAL & DINAMIS PETA INTERAKTIF LEAFLET MAP
// =========================================================================

let monitoringMap = null;

function openKpiModal() {
  document.getElementById('kpiModal').classList.add('active');
}

function closeKpiModal() {
  document.getElementById('kpiModal').classList.remove('active');
}

function openMapModal() {
  document.getElementById('mapModal').classList.add('active');
  initMap(); 
}

function closeMapModal() {
  document.getElementById('mapModal').classList.remove('active');
}

function initMap() {
  setTimeout(() => {
    
    if (monitoringMap !== null) {
      monitoringMap.remove();
    }

    // Koordinat pusat peta disesuaikan di tengah-tengah DIY & Jawa Tengah
    monitoringMap = L.map('mapContainer').setView([-7.7800, 110.5000], 9);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(monitoringMap);

    // Marker Custom Hijau (Baik) & Merah (Rusak)
    const greenIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });

    const redIcon = new L.Icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });

    // MEMBUAT DATA STASIUN SECARA DINAMIS BERDASARKAN HASIL QUERY FIRESTORE
    const monitoringDb = Dashboard.state.currentMonitoringData;

    SINKRON_SITE_LIST.forEach((siteName, idx) => {
      // Temukan data kondisi site dari firestore untuk periode terpilih
      const dbMatch = monitoringDb.find(item => item.site === siteName);
      
      // Default jika data belum dimasukkan di admin/inputApp dianggap "Baik"
      let statusKondisi = "Baik"; 
      if (dbMatch && dbMatch.status) {
        statusKondisi = dbMatch.status; // Mengambil text "Baik" atau "Rusak"
      }

      // Ambil objek koordinat map, jika tidak ada fallback ke koordinat default Yogyakarta pusat
      const coords = SITE_COORDINATES[siteName] || { lat: -7.7956, lng: 110.3695 };
      const isNormal = (statusKondisi.toLowerCase().includes('baik') || statusKondisi.toLowerCase().includes('normal'));
      const iconPilihan = isNormal ? greenIcon : redIcon;

      L.marker([coords.lat, coords.lng], { icon: iconPilihan })
        .addTo(monitoringMap)
        .bindPopup(`
          <div style="font-family: 'Inter', sans-serif; font-size: 12px; line-height: 1.4;">
            <strong style="font-size: 13px; color: #0f172a;">${siteName}</strong><br/>
            <span style="color: #64748b;">Station Index: #0${idx + 1}</span><br/>
            Status Lapangan: <span style="color: ${isNormal ? '#16a34a' : '#dc2626'}; font-weight: bold;">
              ${isNormal ? '● Online (Baik)' : '■ Offline (Rusak)'}
            </span>
          </div>
        `);
    });

  }, 350);
}
