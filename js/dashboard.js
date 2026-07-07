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
    const tbody = document.getElementById('tabelCapaianBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="state-box error">⚠ ${Utils.escape(message)}</td></tr>`;
    }
  },

  // Helper untuk menentukan Predikat Kinerja
  hitungPredikat(nilai) {
    if (nilai >= 95) return 'Sangat Baik';
    if (nilai >= 85) return 'Baik';
    if (nilai >= 70) return 'Cukup';
    return 'Kurang';
  },

  // Helper untuk merender Bintang Kepuasan
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

  // MENYUNTIKKAN DATA LANGSUNG PADA STRUKTUR ID YANG SUDAH ADA DI HTML
  renderKpiGayaBaru(pk, monitoringRows) {
    const tableHeaderBulan = document.getElementById('th-bulan-ini');
    const tbody = document.getElementById('tabelCapaianBody');
    
    if (tableHeaderBulan) {
      tableHeaderBulan.textContent = `Capaian Bulan ${this.state.bulan} ${this.state.tahun}`;
    }

    // Jika data Firestore kosong, reset semua teks ke 0 / default
    if (!pk) {
      ['Operasional', 'Piutang', 'LKE', 'IKM', 'IPAK', 'PrimaAksi'].forEach(k => {
        const valEl = document.getElementById(`top_${k}`);
        const badgeEl = document.getElementById(`badge_${k}`);
        const starsEl = document.getElementById(`stars_${k}`);
        if (valEl) valEl.textContent = (k === 'IKM' || k === 'IPAK') ? '0' : '0%';
        if (badgeEl) badgeEl.textContent = '-';
        if (starsEl) starsEl.innerHTML = '';
      });
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:#999;">Belum ada data capaian pada periode ini.</td></tr>`;
      return;
    }

    const op = Number(pk.Operasional) || 0;
    const pi = Number(pk.Piutang) || 0;
    const lke = Number(pk.LKE) || 0;
    const ikm = Number(pk.IKM) || 0;
    const ipak = Number(pk.IPAK) || 0;
    const pa = Number(pk.PrimaAksi) || 0;

    // 1. Update Konten Teks Cards Berdasarkan ID Secara Presisi
    if (document.getElementById('top_Operasional')) document.getElementById('top_Operasional').textContent = `${op}%`;
    if (document.getElementById('badge_Operasional')) document.getElementById('badge_Operasional').textContent = this.hitungPredikat(op);

    if (document.getElementById('top_Piutang')) document.getElementById('top_Piutang').textContent = `${pi}%`;
    if (document.getElementById('badge_Piutang')) document.getElementById('badge_Piutang').textContent = this.hitungPredikat(pi);

    if (document.getElementById('top_LKE')) document.getElementById('top_LKE').textContent = `${lke}%`;
    if (document.getElementById('badge_LKE')) document.getElementById('badge_LKE').textContent = this.hitungPredikat(lke);

    if (document.getElementById('top_IKM')) document.getElementById('top_IKM').textContent = ikm;
    if (document.getElementById('stars_IKM')) document.getElementById('stars_IKM').innerHTML = this.renderBintang(ikm, 4);

    if (document.getElementById('top_IPAK')) document.getElementById('top_IPAK').textContent = ipak;
    if (document.getElementById('stars_IPAK')) document.getElementById('stars_IPAK').innerHTML = this.renderBintang(ipak, 10);

    if (document.getElementById('top_PrimaAksi')) document.getElementById('top_PrimaAksi').textContent = `${pa}%`;
    if (document.getElementById('badge_PrimaAksi')) document.getElementById('badge_PrimaAksi').textContent = pa >= 80 ? 'Baik' : 'Cukup';

    // 2. Ekstrak data gangguan log stasiun kota untuk Keterangan Tabel
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

    // 3. Terapkan Baris Data ke Tabel Detail
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
