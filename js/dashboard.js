/**
 * =======================================================
 * DASHBOARD (PUBLIC, READ-ONLY)
 * Membaca langsung dari Firestore, tanpa Apps Script.
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

  // Helper untuk menentukan Predikat Kinerja (Gambar 2)
  hitungPredikat(nilai) {
    if (nilai >= 95) return 'Sangat Baik';
    if (nilai >= 85) return 'Baik';
    if (nilai >= 70) return 'Cukup';
    return 'Kurang';
  },

  // Helper untuk merender Bintang Kepuasan (Gambar 2)
  renderBintang(skor, maxSkor = 4) {
    const persentase = (skor / maxSkor) * 5; 
    let starHtml = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(persentase)) {
        starHtml += '<i class="fa-solid fa-star" style="color: #ffb100;"></i>';
      } else if (i - 0.5 <= persentase) {
        starHtml += '<i class="fa-solid fa-star-half-stroke" style="color: #ffb100;"></i>';
      } else {
        starHtml += '<i class="fa-regular fa-star" style="color: #ccc;"></i>';
      }
    }
    return starHtml;
  },

  renderAll(data) {
    // Jalankan render grid atas & tabel detail
    this.renderKpiGayaBaru(data.pk, data.monitoring);
    
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

  // MENGGANTIKAN FUNGSI RENDER KPI LAMA DENGAN STRUKTUR BERLOGO DAN TABEL DETAIL
  renderKpiGayaBaru(pk, monitoringRows) {
    const grid = document.getElementById('kpiGrid');
    const tableHeaderBulan = document.getElementById('th-bulan-ini');
    
    if (tableHeaderBulan) {
      tableHeaderBulan.textContent = `Capaian Bulan ${this.state.bulan} ${this.state.tahun}`;
    }

    if (!pk) {
      grid.innerHTML = `<div class="state-box">Belum ada data PK untuk periode ini.</div>`;
      const tbody = document.getElementById('tabelCapaianBody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:#999;">Belum ada data capaian pada periode ini.</td></tr>`;
      return;
    }

    // 1. Ekstrak data & hitung gangguan kota untuk kolom Keterangan Tabel
    let daftarSiteKendala = [];
    if (monitoringRows && monitoringRows.length > 0) {
      monitoringRows.forEach(r => {
        if (String(r.status).toLowerCase() !== 'normal') {
          daftarSiteKendala.push(`<span class="site-tag"><i class="fa-solid fa-location-dot"></i> ${Utils.escape(r.site)} (${Utils.escape(r.status)})</span>`);
        }
      });
    }

    let keteranganOperasional = daftarSiteKendala.length > 0 
      ? `Terdapat kendala teknis pada site: ${daftarSiteKendala.join(' ')}` 
      : '✅ Semua stasiun monitoring beroperasi normal tanpa gangguan.';

    const op = Number(pk.Operasional) || 0;
    const pi = Number(pk.Piutang) || 0;
    const lke = Number(pk.LKE) || 0;
    const ikm = Number(pk.IKM) || 0;
    const ipak = Number(pk.IPAK) || 0;
    const pa = Number(pk.PrimaAksi) || 0;

    // 2. Terapkan Layout Cards Berwarna & Ikon (Sesuai Struktur Gambar 2 di input.html sebelumnya)
    grid.innerHTML = `
      <div class="kpi-card card-blue">
        <div class="kpi-icon"><i class="fa-solid fa-tower-broadcast"></i></div>
        <div class="kpi-value">${op}%</div>
        <div class="kpi-label">Operasional SMFR</div>
        <span class="badge badge-blue">${this.hitungPredikat(op)}</span>
      </div>
      <div class="kpi-card card-green">
        <div class="kpi-icon"><i class="fa-solid fa-file-invoice-dollar"></i></div>
        <div class="kpi-value">${pi}%</div>
        <div class="kpi-label">Pelayanan Piutang BHP</div>
        <span class="badge badge-green">${this.hitungPredikat(pi)}</span>
      </div>
      <div class="kpi-card card-purple">
        <div class="kpi-icon"><i class="fa-solid fa-shield-halved"></i></div>
        <div class="kpi-value">${lke}%</div>
        <div class="kpi-label">LKE Pembangunan ZI</div>
        <span class="badge badge-purple">${this.hitungPredikat(lke)}</span>
      </div>
      <div class="kpi-card card-orange">
        <div class="kpi-icon"><i class="fa-solid fa-face-smile"></i></div>
        <div class="kpi-value">${ikm}</div>
        <div class="kpi-label">IKM / IPKP</div>
        <div class="stars">${this.renderBintang(ikm, 4)}</div>
      </div>
      <div class="kpi-card card-teal">
        <div class="kpi-icon"><i class="fa-solid fa-circle-check"></i></div>
        <div class="kpi-value">${ipak}</div>
        <div class="kpi-label">IIPP / IPAK</div>
        <div class="stars">${this.renderBintang(ipak, 10)}</div>
      </div>
      <div class="kpi-card card-red">
        <div class="kpi-icon"><i class="fa-solid fa-bullseye"></i></div>
        <div class="kpi-value">${pa}%</div>
        <div class="kpi-label">PrimaAksi</div>
        <span class="badge badge-red">${pa >= 80 ? 'Baik' : 'Cukup'}</span>
      </div>
    `;

    // 3. Terapkan Isian Baris ke Tabel Detail Secara Dinamis (Sesuai Layout Gambar 3)
    const tbody = document.getElementById('tabelCapaianBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td style="text-align:center;">1.</td>
          <td><strong>Persentase (%) Terjaganya Operasional dan Fungsi Monitoring dari Stasiun Monitor Frekuensi Radio di UPT</strong></td>
          <td style="text-align:center; color:#555; font-weight:600;">85%</td>
          <td style="text-align:center; font-weight:700; color:#0056b3;">${op}%</td>
          <td style="text-align:center; font-weight:700;">${op}%</td>
          <td><div class="keterangan-cell">${keteranganOperasional}</div></td>
        </tr>
        <tr>
          <td style="text-align:center;">2.</td>
          <td><strong>Persentase Tingkat Penyelesaian Pelayanan Piutang BHP Frekuensi Radio</strong></td>
          <td style="text-align:center; color:#555; font-weight:600;">100%</td>
          <td style="text-align:center; font-weight:700; color:#0056b3;">${pi}%</td>
          <td style="text-align:center; font-weight:700;">${pi}%</td>
          <td><div class="keterangan-cell">Realisasi penagihan piutang berjalan tertib.</div></td>
        </tr>
        <tr>
          <td style="text-align:center;">3.</td>
          <td><strong>Nilai Lembar Kerja Evaluasi (LKE) Pembangunan Zona Integritas</strong></td>
          <td style="text-align:center; color:#555; font-weight:600;">100%</td>
          <td style="text-align:center; font-weight:700; color:#0056b3;">${lke}%</td>
          <td style="text-align:center; font-weight:700;">${lke}%</td>
          <td><div class="keterangan-cell">Pemenuhan administrasi ZI tercapai sesuai target.</div></td>
        </tr>
      `;
    }
  },

  // Sisa fungsi bawaan dibiarkan utuh agar fitur filter & pencarian tabel log tidak rusak
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
