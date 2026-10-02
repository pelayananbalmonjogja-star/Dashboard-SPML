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



  /**
   * Sidebar bisa "buka/tutup" dengan dua perilaku berbeda tergantung ukuran layar:
   *  - Desktop (>880px): tombol hamburger di topbar menciutkan sidebar jadi
   *    rel ikon saja (class "collapsed"). Ada juga tombol khusus di kaki
   *    sidebar untuk hal yang sama. Status terakhir disimpan di localStorage.
   *  - Mobile (<=880px): sidebar disembunyikan di luar layar dan tombol
   *    hamburger menampilkannya sebagai overlay (class "open") lengkap
   *    dengan backdrop gelap yang bisa diklik untuk menutup.
   */
  setupSidebarToggle() {

    const btnHamburger = document.getElementById('btnSidebarToggle');
    const btnCollapse = document.getElementById('btnSidebarCollapse');
    const sidebar = document.getElementById('pkSidebar');
    const backdrop = document.getElementById('pkSidebarBackdrop');
    if (!sidebar) return;

    const isMobile = () => window.innerWidth <= 880;

    const openMobile = () => {
      sidebar.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
    };
    const closeMobile = () => {
      sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
    };

    const toggleCollapse = () => {
      const collapsed = sidebar.classList.toggle('collapsed');
      try { localStorage.setItem('pkSidebarCollapsed', collapsed ? '1' : '0'); } catch (e) {}
    };

    // Terapkan preferensi ciut/lebar dari kunjungan sebelumnya (khusus desktop).
    try {
      if (!isMobile() && localStorage.getItem('pkSidebarCollapsed') === '1') {
        sidebar.classList.add('collapsed');
      }
    } catch (e) {}

    if (btnHamburger) {
      btnHamburger.addEventListener('click', () => {
        if (isMobile()) {
          sidebar.classList.contains('open') ? closeMobile() : openMobile();
        } else {
          toggleCollapse();
        }
      });
    }

    if (btnCollapse) {
      btnCollapse.addEventListener('click', toggleCollapse);
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeMobile);
    }

    document.querySelectorAll('.pk-nav-item').forEach(a => {
      a.addEventListener('click', () => {
        document.querySelectorAll('.pk-nav-item').forEach(x => x.classList.remove('active'));
        a.classList.add('active');
        if (isMobile()) closeMobile();
      });
    });

    window.addEventListener('resize', () => {
      if (!isMobile()) closeMobile();
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



  /**
   * Data survei ditarik berdasarkan isi field "Keterangan" yang diinput di
   * halaman Data Bulanan, BUKAN sekadar dokumen yang ada di bulan itu:
   *  - Kalau Keterangan-nya menyebut "Triwulan" -> dianggap data triwulan,
   *    dan ikut aturan cascade di bawah.
   *  - Kalau Keterangan-nya menyebut "Bulan ..." (bulanan) -> data itu
   *    TIDAK ditampilkan di rangkaian triwulan (kecuali untuk kasus khusus
   *    Januari & Februari di bawah).
   *
   * Aturan tampil per bulan yang sedang dipilih di dashboard:
   *  - Januari, Februari       -> tampilkan data BULANAN bulan itu sendiri
   *                                (kalau memang ada inputnya)
   *  - Maret, April, Mei       -> Triwulan I
   *  - Juni, Juli, Agustus     -> Triwulan I & II
   *  - September, Oktober, November -> Triwulan I, II, & III
   *  - Desember                -> Triwulan I, II, III, & IV
   */
  async loadSurveiList(tahun, bulan) {

    // --- Kasus khusus: Januari & Februari -> tampilkan data bulanan itu sendiri ---
    if (typeof isBulanKhusus === 'function' && isBulanKhusus(bulan)) {

      const snap = await db.collection('survei').doc(periodeId(tahun, bulan)).get();

      if (!snap.exists) return [];

      return [{ bulanan: true, bulan: bulan, ...snap.data() }];

    }

    // --- Bulan Maret dst -> cascade data yang keterangannya "Triwulan" ---
    const currentTw = (typeof getMaxTriwulanToShow === 'function') ? (getMaxTriwulanToShow(bulan) || 1) : 1;

    const twNumbers = Array.from({ length: currentTw }, (_, i) => i + 1);

    const results = await Promise.all(twNumbers.map(async (tw) => {

      const months = BULAN_ORDER.slice((tw - 1) * 3, tw * 3);

      const snaps = await Promise.all(months.map(b => db.collection('survei').doc(periodeId(tahun, b)).get()));

      // Hanya ambil dokumen yang Keterangan-nya memang ditulis sebagai "Triwulan ..."
      const found = snaps.find(s => s.exists && /triwulan/i.test((s.data().Keterangan || '').trim()));

      return found ? { triwulan: tw, ...found.data() } : null;

    }));

    return results.filter(Boolean);

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

      const prevPeriode = (typeof getPrevPeriode === 'function') ? getPrevPeriode(tahun, bulan) : null;

      const prevId = prevPeriode ? periodeId(prevPeriode.tahun, prevPeriode.bulan) : null;



      const [pkSnap, survei, primaaksiSnap, monitoringSnap, pelayananSnap, kegiatanSnap, tamuSnap, tamuPrevSnap, sppSnap, isrTerbitSnap, catatanSnap] = await Promise.all([

        db.collection('pk').doc(id).get(),

        this.loadSurveiList(tahun, bulan),

        db.collection('primaaksi').doc(id).get(),

        db.collection('monitoring').where('tahun', '==', tahun).where('bulan', '==', bulan).get(),

        db.collection('pelayanan').where('tahun', '==', tahun).where('bulan', '==', bulan).get(),

        db.collection('kegiatan').where('tahun', '==', tahun).where('bulan', '==', bulan).get(),

        db.collection('tamuLayanan').doc(id).get(),

        prevId ? db.collection('tamuLayanan').doc(prevId).get() : Promise.resolve(null),

        db.collection('sppBhp').doc(id).get(),

        db.collection('isrTerbit').doc(id).get(),

        db.collection('catatan').where('tahun', '==', tahun).where('bulan', '==', bulan).get()

      ]);



      const pk = pkSnap.exists ? pkSnap.data() : null;

      const primaaksi = primaaksiSnap.exists ? primaaksiSnap.data() : null;

      const monitoring = []; monitoringSnap.forEach(d => monitoring.push(d.data()));

      const pelayanan = []; pelayananSnap.forEach(d => pelayanan.push({ id: d.id, ...d.data() }));

      const kegiatan = []; kegiatanSnap.forEach(d => kegiatan.push({ id: d.id, ...d.data() }));

      const tamu = tamuSnap.exists ? tamuSnap.data() : null;

      const tamuPrev = (tamuPrevSnap && tamuPrevSnap.exists) ? tamuPrevSnap.data() : null;

      const spp = sppSnap.exists ? sppSnap.data() : null;

      const isrTerbit = isrTerbitSnap.exists ? isrTerbitSnap.data() : null;

      const catatan = []; catatanSnap.forEach(d => catatan.push({ id: d.id, ...d.data() }));



      this.renderAll({ pk, survei, primaaksi, monitoring, pelayanan, kegiatan, tamu, tamuPrev, spp, isrTerbit, catatan });

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

    this.renderTamu(data.tamu, data.tamuPrev);

    this.renderIsrSpp(data.isrTerbit, data.spp);

    this.renderRingkasanLayanan(data.tamu);

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

    if (pct >= 90) return { text: 'Sudah Tercapai', cls: 'pk-pill-success' };

    if (pct >= 1) return { text: 'Sudah Tercapai', cls: 'pk-pill-success' };

    return { text: 'Belum Tercapai', cls: 'pk-pill-danger' };

  },



  /* Warna badge progress bertingkat: merah 0-50%, oranye >50-80%, hijau >80-100%, biru >100% */

  tierColor(pct) {

    if (pct > 100) return '#2F80ED';

    if (pct > 80) return '#27AE60';

    if (pct > 50) return '#F5A623';

    return '#C0392B';

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

      { key: 'Piutang', label: 'Pelayanan Piutang BHP', icon: 'fa-file-circle-check', color: '#000633' },

      { key: 'SOR', label: 'Penyelenggaraan Layanan SOR', icon: 'fa-id-card', color: '#F5A623' },

      { key: 'LKE', label: 'LKE Pembangunan ZI', icon: 'fa-shield-halved', color: '#2F80ED' },

      { key: 'IKM', label: 'IKM / IPKP', scale: 'SKALA 4', icon: 'fa-star', color: '#27AE60', noPercent: true },

      { key: 'IPAK', label: 'IIPP / IPAK', scale: 'SKALA 10', icon: 'fa-heart', color: '#8E5CF7', noPercent: true },

      { key: 'PrimaAksi', label: 'PrimaAksi', icon: 'fa-bullseye', color: '#17B8C4' }

    ];



    grid.innerHTML = fields.map(f => {

      const raw = pk[f.key];

      const value = Number(raw) || 0;

      const pill = this.pillFor(value);

      return `

        <div class="pk-kpi-card">

          <div class="pk-kpi-dots" style="color:${f.color};"></div>

          <div class="pk-kpi-body">

            <div class="pk-kpi-icon" style="background:${f.color}; color:#fff; box-shadow:0 8px 18px -6px ${f.color};"><i class="fa-solid ${f.icon}"></i></div>

            <div class="pk-kpi-value" style="color:${f.color};">${value}${f.noPercent ? '' : '%'}</div>

            <div class="pk-kpi-label">${f.label}</div>

            ${f.scale ? `<div class="pk-kpi-scale" style="color:${f.color}; border-color:${f.color};">${f.scale}</div>` : ''}

            <span class="pk-pill ${pill.cls}">${pill.text}</span>

          </div>

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

  renderSurvey(surveiList) {

    const list = document.getElementById('surveyList');

    if (!surveiList || surveiList.length === 0) {

      list.innerHTML = `<div class="state-box">Belum ada data survei.</div>`;

      return;

    }

    const romawi = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

    list.innerHTML = `<div class="pk-survey-tw-grid">` + surveiList.map(survei => {

      const ikm = Number(survei.IKM) || 0;

      const ipak = Number(survei.IPAK) || 0;

      const responden = Number(survei.Responden) || 0;

      const keterangan = survei.Keterangan || '';

      const periodeLabel = survei.bulanan
        ? `Bulan ${survei.bulan}`
        : `Triwulan ${romawi[survei.triwulan] || survei.triwulan}`;

      // Jangan ulangi keterangan kalau isinya cuma menegaskan ulang label periode
      // (mis. "Triwulan I" saat labelnya sudah "Triwulan I", atau "Bulan Januari"
      // saat labelnya sudah "Bulan Januari").
      const ketTrim = keterangan.trim();

      const extraNote = (ketTrim && !/^triwulan/i.test(ketTrim) && !/^bulan/i.test(ketTrim))
        ? ` &bull; ${Utils.escape(keterangan)}`
        : '';

      return `

        <div class="pk-survey-block pk-survey-block--card">

          <div class="pk-survey-block-title"><i class="fa-solid fa-circle"></i> ${periodeLabel}${extraNote}</div>

          <div class="pk-survey-grid">

            <div class="pk-survey-card" style="--card-color:#000633; background:linear-gradient(160deg,#00063322,#00063308);">

              <div class="pk-survey-icon" style="background:#000633; color:#fff;"><i class="fa-solid fa-clipboard-check"></i></div>

              <div class="pk-survey-label">IKM / IPKP</div>

              <div class="pk-survey-value" style="color:#000633;">${ikm}</div>

              <div class="pk-survey-stars">${this.starsHtml(ikm, 4)}</div>

            </div>

            <div class="pk-survey-card" style="--card-color:#2F80ED; background:linear-gradient(160deg,#2F80ED22,#2F80ED08);">

              <div class="pk-survey-icon" style="background:#2F80ED; color:#fff;"><i class="fa-solid fa-arrow-trend-up"></i></div>

              <div class="pk-survey-label">IIPP / IPAK</div>

              <div class="pk-survey-value" style="color:#000633;">${ipak}</div>

              <div class="pk-survey-stars">${this.starsHtml(ipak, 10)}</div>

            </div>

          </div>

          <div class="pk-survey-responden">

            <div class="pk-survey-responden-icon"><i class="fa-solid fa-users"></i></div>

            <div>

              <div class="pk-survey-responden-label">Jumlah Responden</div>

              <div class="pk-survey-responden-value">${responden} Responden</div>

            </div>

          </div>

        </div>`;

    }).join('') + `</div>`;

  },



  /* ---------------- STRIP RINGKASAN TAMU (Total Tamu, Broadcast, Non Broadcast, Online, Offline) ---------------- */
  renderTamu(tamu, tamuPrev) {
    const box = document.getElementById('tamuGrid');
    if (!tamu) {
      box.innerHTML = `<div class="state-box">Belum ada data tamu pelayanan.</div>`;
      return;
    }
    const broadcast = Number(tamu.TamuBroadcast) || 0;
    const nonBroadcast = Number(tamu.TamuNonBroadcast) || 0;
    const online = Number(tamu.PelayananOnline) || 0;
    const offline = Number(tamu.PelayananOffline) || 0;
    // Total Tamu = Online + Offline (Broadcast/Non Broadcast hanya pembagian lain dari tamu yang sama)
    const total = online + offline;
    const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;

    // Trend "dari bulan lalu" untuk Total Tamu, dihitung dari data periode sebelumnya (jika ada)
    let trendHtml = '';
    if (tamuPrev) {
      const pBroadcast = Number(tamuPrev.TamuBroadcast) || 0;
      const pNonBroadcast = Number(tamuPrev.TamuNonBroadcast) || 0;
      const pOnline = Number(tamuPrev.PelayananOnline) || 0;
      const pOffline = Number(tamuPrev.PelayananOffline) || 0;
      const prevTotal = pOnline + pOffline;
      if (prevTotal > 0) {
        const diffPct = Math.round(((total - prevTotal) / prevTotal) * 100);
        const up = diffPct >= 0;
        trendHtml = `<span class="pk-tamu-strip-trend ${up ? 'is-up' : 'is-down'}"><i class="fa-solid ${up ? 'fa-arrow-up' : 'fa-arrow-down'}"></i> ${Math.abs(diffPct)}% dari bulan lalu</span>`;
      }
    }
    if (!trendHtml) trendHtml = `<span class="pk-tamu-strip-trend is-muted">dari bulan lalu</span>`;

    const items = [
      { icon: 'fa-user-group', color: '#000633', value: total, label: 'Total Tamu', sub: trendHtml },
      { icon: 'fa-tower-broadcast', color: '#F5722F', value: broadcast, label: 'Tamu Broadcast', sub: `<span class="pk-tamu-strip-sub" style="color:#F5722F">${pct(broadcast)}% dari total</span>` },
      { icon: 'fa-user-group', color: '#F5A623', value: nonBroadcast, label: 'Tamu Non Broadcast', sub: `<span class="pk-tamu-strip-sub" style="color:#F5A623">${pct(nonBroadcast)}% dari total</span>` },
      { icon: 'fa-globe', color: '#27AE60', value: online, label: 'Pelayanan Online', sub: `<span class="pk-tamu-strip-sub" style="color:#27AE60">${pct(online)}% dari total</span>` },
      { icon: 'fa-box-archive', color: '#2F80ED', value: offline, label: 'Pelayanan Offline', sub: `<span class="pk-tamu-strip-sub" style="color:#2F80ED">${pct(offline)}% dari total</span>` }
    ];

    box.innerHTML = items.map((it, i) => `
      ${i > 0 ? '<div class="pk-tamu-strip-divider"></div>' : ''}
      <div class="pk-tamu-strip-item">
        <div class="pk-tamu-strip-icon" style="background:${it.color}"><i class="fa-solid ${it.icon}"></i></div>
        <div>
          <div class="pk-tamu-strip-label">${it.label}</div>
          <div class="pk-tamu-strip-value">${it.value}</div>
          ${it.sub}
        </div>
      </div>`).join('');
  },

  /* ---------------- LAYANAN & PENERBITAN (ISR + SPP BHP digabung satu grid) ---------------- */
  renderIsrSpp(isr, spp) {
    const box = document.getElementById('lpCards');
    const terbit = isr ? (Number(isr.Terbit) || 0) : 0;
    const cabut = isr ? (Number(isr.Cabut) || 0) : 0;
    const annual = spp ? (Number(spp.SPPAnnual) || 0) : 0;
    const reminder = spp ? (Number(spp.SPPReminder) || 0) : 0;
    const baru = spp ? (Number(spp.SPPNew) || 0) : 0;
    const renewal = spp ? (Number(spp.SPPRenewal) || 0) : 0;

    if (!isr && !spp) {
      box.innerHTML = `<div class="state-box">Belum ada data ISR &amp; SPP BHP untuk periode ini.</div>`;
      return;
    }

    const items = [
      { color: '#000633', icon: 'fa-file-circle-check', value: terbit, label: 'ISR Terbit' },
      { color: '#F5722F', icon: 'fa-file-circle-xmark', value: cabut, label: 'ISR Tercabut' },
      { color: '#2F80ED', icon: 'fa-calendar-check', value: annual, label: 'SPP Annual' },
      { color: '#F5A623', icon: 'fa-bell', value: reminder, label: 'SPP Reminder' },
      { color: '#000633', icon: 'fa-file-circle-plus', value: baru, label: 'SPP New' },
      { color: '#F5722F', icon: 'fa-rotate', value: renewal, label: 'SPP Renewal' }
    ];

    box.innerHTML = items.map(d => `
      <div class="pk-lp-item">
        <div class="pk-lp-label">${d.label}</div>
        <div class="pk-lp-row">
          <div class="pk-lp-icon" style="color:${d.color}"><i class="fa-solid ${d.icon}"></i></div>
          <div class="pk-lp-value" style="color:${d.color}">${d.value}</div>
        </div>
        <div class="pk-lp-underline" style="background:${d.color}"></div>
      </div>`).join('');
  },

  /* ---------------- RINGKASAN LAYANAN (Total Layanan Online+Offline, via WA / Loket) ---------------- */
  renderRingkasanLayanan(tamu) {
    const box = document.getElementById('ringkasanBody');
    if (!tamu) {
      box.innerHTML = `<div class="state-box">Belum ada data pelayanan untuk periode ini.</div>`;
      return;
    }
    const online = Number(tamu.PelayananOnline) || 0; // via WA Pelayanan
    const offline = Number(tamu.PelayananOffline) || 0; // via Loket Pelayanan
    const total = online + offline;
    const waPct = total > 0 ? ((online / total) * 100) : 0;
    const loketPct = total > 0 ? ((offline / total) * 100) : 0;

    box.innerHTML = `
      <div class="pk-ringkasan-total">
        <div class="pk-ringkasan-total-icon"><i class="fa-solid fa-clipboard-list"></i></div>
        <div>
          <div class="pk-ringkasan-total-label">Total Layanan<br>(Online &amp; Offline)</div>
          <div class="pk-ringkasan-total-value">${total}</div>
        </div>
      </div>
      <div class="pk-ringkasan-rows">
        <div class="pk-ringkasan-row">
          <div class="pk-ringkasan-row-icon" style="background:#27AE60"><i class="fa-brands fa-whatsapp"></i></div>
          <div class="pk-ringkasan-row-text">
            <div class="pk-ringkasan-row-label">Melalui WA Pelayanan</div>
            <div class="pk-ringkasan-row-value">${online}</div>
          </div>
          <div class="pk-ringkasan-row-pct" style="color:#27AE60">${waPct.toFixed(1)}%</div>
        </div>
        <div class="pk-ringkasan-row">
          <div class="pk-ringkasan-row-icon" style="background:#2F80ED"><i class="fa-solid fa-box-archive"></i></div>
          <div class="pk-ringkasan-row-text">
            <div class="pk-ringkasan-row-label">Melalui Loket Pelayanan</div>
            <div class="pk-ringkasan-row-value">${offline}</div>
          </div>
          <div class="pk-ringkasan-row-pct" style="color:#2F80ED">${loketPct.toFixed(1)}%</div>
        </div>
      </div>`;
  },

  /* ---------------- PELAYANAN PUBLIK (icon cards) ---------------- */

  pelayananIcon(jenis) {

    const j = String(jenis || '').toLowerCase();

    if (j.includes('unar')) return 'fa-graduation-cap';

    if (j.includes('bimtek') || j.includes('sertifikasi') || j.includes('sosialisasi') || j.includes('ikran')) return 'fa-people-group';

    if (j.includes('inspeksi')) return 'fa-magnifying-glass';

    if (j.includes('invoice') || j.includes('piutang')) return 'fa-file-invoice-dollar';

    if (j.includes('maritim')) return 'fa-ship';

    if (j.includes('koordinasi')) return 'fa-triangle-exclamation';

    if (j.includes('klarifikasi') || j.includes('waba')) return 'fa-people-group';

    if (j.includes('lke')) return 'fa-shield-halved';

    return 'fa-list-check';

  },



  renderPelayanan(rows) {

    const box = document.getElementById('pelayananCards');

    if (!rows || rows.length === 0) {

      box.innerHTML = `<tr><td colspan="6"><div class="state-box">Belum ada data pelayanan untuk periode ini.</div></td></tr>`;

      return;

    }

    box.innerHTML = rows.map((r, i) => {

      const target = Number(r.target) || 0;

      const capaian = Number(r.capaian) || 0;

      const pct = target > 0 ? Math.round((capaian / target) * 100) : 0;

      const tier = this.tierColor(pct);

      const linkHtml = r.link ? ` <a href="${Utils.escape(r.link)}" target="_blank" rel="noopener" class="pk-pelayanan-doclink" title="Buka dokumen ${Utils.escape(r.jenis)}"><i class="fa-solid fa-link"></i></a>` : '';

      let statusTag = '';

      if (pct > 100) {

        statusTag = `<span class="pk-spml-tag pk-spml-tag--over"><i class="fa-solid fa-circle-check"></i> Melampaui Target</span>`;

      } else if (pct === 0) {

        statusTag = `<span class="pk-spml-tag pk-spml-tag--none"><i class="fa-solid fa-circle-xmark"></i> Belum Terealisasi</span>`;

      }

      return `

        <tr>

          <td class="pk-spml-no">${i + 1}</td>

          <td class="pk-spml-kegiatan">

            <span class="pk-spml-icon" style="background:${tier}1f; color:${tier};"><i class="fa-solid ${this.pelayananIcon(r.jenis)}"></i></span>

            <span class="pk-spml-name">${Utils.escape(r.jenis)}${linkHtml}</span>

          </td>

          <td class="pk-spml-target">${target}</td>

          <td class="pk-spml-realisasi">${capaian}</td>

          <td><span class="pk-spml-pct" style="background:${tier};">${pct}%</span></td>

          <td class="pk-spml-progress-cell">

            <div class="pk-spml-progress-row">

              <div class="pk-spml-progress-track"><div class="pk-spml-progress-fill" style="width:${Math.min(100, pct)}%; background:${tier};"></div></div>

              ${statusTag}

            </div>

          </td>

        </tr>`;

    }).join('');

  },



  /* ---------------- LOG KEGIATAN (DataTable) ---------------- */

  // Palet warna & ikon per jenis kegiatan (dicocokkan dari kata kunci judul, dengan fallback bergilir).
  // Dipakai bareng oleh tabel kegiatan & kalender kegiatan supaya warnanya konsisten.
  KEGIATAN_PALETTE: ['#000633', '#F5A623', '#27AE60', '#8E5CF7', '#2F80ED'],
  KEGIATAN_THEME_RULES: [
    { test: /unar/i, icon: 'fa-bullhorn', color: '#000633', label: 'UNAR' },
    { test: /mots/i, icon: 'fa-tower-broadcast', color: '#F5A623', label: 'MOTS' },
    { test: /inspeksi\s*rutin/i, icon: 'fa-shield-halved', color: '#27AE60', label: 'Inspeksi Rutin' },
    { test: /inspeksi\s*insidentil/i, icon: 'fa-magnifying-glass', color: '#8E5CF7', label: 'Inspeksi Insidentil' },
    { test: /klarifikasi/i, icon: 'fa-file-circle-check', color: '#2F80ED', label: 'Klarifikasi' }
  ],
  kegiatanTheme(judul, idx) {
    const found = this.KEGIATAN_THEME_RULES.find(t => t.test.test(judul || ''));
    if (found) return found;
    return { icon: 'fa-calendar-check', color: this.KEGIATAN_PALETTE[idx % this.KEGIATAN_PALETTE.length], label: 'Lainnya' };
  },

  renderKegiatanLog(rows) {

    const wrap = document.getElementById('kegiatanWrap');

    if (this.state.dataTable) { this.state.dataTable.destroy(); this.state.dataTable = null; }

    if (!rows || rows.length === 0) {

      wrap.innerHTML = `<div class="state-box">Belum ada data kegiatan untuk periode ini.</div>`;

      this.renderKegiatanCalendar([]);

      return;

    }

    const columns = ['tanggalMulai', 'tanggalSelesai', 'judul', 'keterangan', 'link'];

    const headerLabels = { tanggalMulai: 'Tanggal Mulai', tanggalSelesai: 'Tanggal Selesai', judul: 'Judul', keterangan: 'Keterangan', link: 'Dokumen' };

    const headerIcons = { tanggalMulai: 'fa-calendar-days', tanggalSelesai: 'fa-calendar-check', judul: 'fa-bullhorn', keterangan: 'fa-comment-dots', link: 'fa-link' };

    const thead = columns.map(c => `<th><i class="fa-solid ${headerIcons[c]} pk-th-icon"></i>${headerLabels[c].toUpperCase()}</th>`).join('');



    const dateCell = (val, theme) => `<span class="pk-keg-date"><span class="pk-keg-date-icon" style="background:${theme.color};"><i class="fa-solid fa-calendar-days"></i></span>${Utils.escape(val)}</span>`;



    const tbody = rows.map((r, idx) => {

      const theme = this.kegiatanTheme(r.judul, idx);

      const judulCell = `<span class="pk-keg-judul"><i class="fa-solid ${theme.icon}" style="color:${theme.color};"></i>${Utils.escape(r.judul)}</span>`;

      const ketCell = `<span class="pk-keg-ket"><i class="fa-solid fa-file-lines" style="color:${theme.color};"></i>${Utils.escape(r.keterangan)}</span>`;

      const linkCell = r.link
        ? `<a class="pk-keg-link" href="${Utils.escape(r.link)}" target="_blank" rel="noopener" style="color:${theme.color};"><i class="fa-solid fa-arrow-up-right-from-square"></i> Lihat</a>`
        : `<span class="pk-keg-link-empty">—</span>`;

      return `<tr style="--row-tint:${theme.color}1a;">` +

        `<td>${dateCell(r.tanggalMulai, theme)}</td>` +

        `<td>${dateCell(r.tanggalSelesai, theme)}</td>` +

        `<td>${judulCell}</td>` +

        `<td>${ketCell}</td>` +

        `<td>${linkCell}</td>` +

      `</tr>`;

    }).join('');



    wrap.innerHTML = `<table id="kegiatanTable" class="display" style="width:100%"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;



    this.state.dataTable = $('#kegiatanTable').DataTable({

      pageLength: 5,

      lengthMenu: [5, 10, 25, 50],

      dom: '<"pk-kegiatan-toolbar"lf>t<"pk-kegiatan-footer"ip>',

      language: {

        search: 'Cari :', searchPlaceholder: 'Cari kegiatan...', lengthMenu: 'Tampilkan _MENU_ baris',

        info: 'Menampilkan _START_-_END_ dari _TOTAL_ data',

        paginate: { previous: '‹ Sebelumnya', next: 'Berikutnya ›' }, zeroRecords: 'Data tidak ditemukan'

      }

    });



    this.renderKegiatanCalendar(rows);

    // Bungkus input pencarian dengan ikon kaca pembesar

    const $filterInput = $(wrap).find('.dataTables_filter input');

    $filterInput.wrap('<span class="pk-search-wrap"></span>');

    $filterInput.before('<i class="fa-solid fa-magnifying-glass pk-search-icon"></i>');

  },

  /* ---------------- KALENDER KEGIATAN ---------------- */

  /** Parse "YYYY-MM-DD" jadi Date lokal jam 00:00 (hindari geser tanggal karena timezone). */
  parseTanggalLokal(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = str.split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d);
  },

  /** Render kalender bulanan yang menampilkan titik kegiatan sesuai tabel Rencana Kegiatan periode aktif. */
  renderKegiatanCalendar(rows) {
    this.state.kegiatanCalRows = rows || [];
    // Reset filter ke "Semua Kategori" tiap kali data periode berganti/dimuat ulang.
    this.state.kegiatanCalFilter = 'all';
    this.renderKegiatanCalendarBody();
  },

  /** Render ulang isi kalender (grid + legenda) berdasarkan cache baris & filter kategori aktif, tanpa fetch ulang. */
  renderKegiatanCalendarBody() {
    const wrap = document.getElementById('kegiatanCalendar');
    if (!wrap) return;

    const rows = this.state.kegiatanCalRows || [];
    const tahun = Number(this.state.tahun);
    const bulanNama = this.state.bulan;
    const monthIdx = (typeof BULAN_ORDER !== 'undefined' && Array.isArray(BULAN_ORDER)) ? BULAN_ORDER.indexOf(bulanNama) : -1;

    if (!tahun || monthIdx === -1) {
      wrap.innerHTML = `<div class="state-box">Pilih periode untuk menampilkan kalender.</div>`;
      return;
    }

    // Siapkan semua event dulu (belum difilter) untuk membangun daftar kategori pada dropdown.
    const allEvents = rows.map((r, idx) => {
      const start = this.parseTanggalLokal(r.tanggalMulai);
      const end = this.parseTanggalLokal(r.tanggalSelesai) || start;
      return { ...r, start, end, theme: this.kegiatanTheme(r.judul, idx) };
    }).filter(e => e.start);

    const categories = [...new Set(allEvents.map(e => e.theme.label))].sort((a, b) => a.localeCompare(b));
    const activeFilter = (this.state.kegiatanCalFilter && (this.state.kegiatanCalFilter === 'all' || categories.includes(this.state.kegiatanCalFilter)))
      ? this.state.kegiatanCalFilter : 'all';
    this.state.kegiatanCalFilter = activeFilter;

    const events = activeFilter === 'all' ? allEvents : allEvents.filter(e => e.theme.label === activeFilter);

    const firstOfMonth = new Date(tahun, monthIdx, 1);
    const daysInMonth = new Date(tahun, monthIdx + 1, 0).getDate();
    // Senin sebagai kolom pertama (kebiasaan kalender Indonesia).
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const today = new Date();
    const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    const cellsHtml = cells.map(d => {
      if (!d) return `<div class="pk-cal-cell pk-cal-cell-empty"></div>`;
      const dateObj = new Date(tahun, monthIdx, d);
      const dayEvents = events.filter(e => dateObj >= e.start && dateObj <= e.end);
      const isToday = isSameDay(dateObj, today);
      const dots = dayEvents.slice(0, 3).map(e => `<span class="pk-cal-dot" style="background:${e.theme.color}"></span>`).join('');
      const more = dayEvents.length > 3 ? `<span class="pk-cal-more">+${dayEvents.length - 3}</span>` : '';
      const titleAttr = dayEvents.length ? Utils.escape(dayEvents.map(e => e.judul).join(', ')) : '';
      return `<div class="pk-cal-cell ${isToday ? 'pk-cal-today' : ''} ${dayEvents.length ? 'pk-cal-has-event' : ''}" title="${titleAttr}">
        <span class="pk-cal-daynum">${d}</span>
        <div class="pk-cal-dots">${dots}${more}</div>
      </div>`;
    }).join('');

    const legendHtml = events.length
      ? events.map(e => {
          const rangeLabel = (e.tanggalSelesai && e.tanggalSelesai !== e.tanggalMulai)
            ? `${Utils.escape(e.tanggalMulai || '')} s.d ${Utils.escape(e.tanggalSelesai || '')}`
            : Utils.escape(e.tanggalMulai || '');
          return `
          <div class="pk-cal-legend-item">
            <span class="pk-cal-dot" style="background:${e.theme.color}"></span>
            <span class="pk-cal-legend-text"><strong>${Utils.escape(e.judul || '')}</strong><small>${rangeLabel}</small></span>
            ${e.link ? `<a href="${Utils.escape(e.link)}" target="_blank" rel="noopener" class="pk-cal-legend-link" title="Buka dokumen"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}
          </div>`;
        }).join('')
      : `<div class="pk-cal-legend-empty">${allEvents.length ? 'Tidak ada kegiatan untuk kategori ini.' : 'Belum ada kegiatan berjadwal pada periode ini.'}</div>`;

    const filterHtml = categories.length ? `
      <select id="kegiatanCalFilter" class="pk-cal-filter">
        <option value="all" ${activeFilter === 'all' ? 'selected' : ''}>Semua Kategori</option>
        ${categories.map(c => `<option value="${Utils.escape(c)}" ${activeFilter === c ? 'selected' : ''}>${Utils.escape(c)}</option>`).join('')}
      </select>` : '';

    wrap.innerHTML = `
      <div class="pk-cal-head">
        <div class="pk-cal-title"><i class="fa-solid fa-calendar-days"></i> Kalender Kegiatan — ${Utils.escape(bulanNama)} ${tahun}</div>
        ${filterHtml}
      </div>
      <div class="pk-cal-grid pk-cal-grid-head">${dayNames.map(n => `<div class="pk-cal-dayname">${n}</div>`).join('')}</div>
      <div class="pk-cal-grid">${cellsHtml}</div>
      <div class="pk-cal-legend">${legendHtml}</div>
    `;

    const filterEl = document.getElementById('kegiatanCalFilter');
    if (filterEl) {
      filterEl.addEventListener('change', () => {
        this.state.kegiatanCalFilter = filterEl.value;
        this.renderKegiatanCalendarBody();
      });
    }
  },

  /* ---------------- CATATAN (read-only, diisi dari halaman Input) ---------------- */

  renderCatatan(rows) {

    const wrap = document.getElementById('catatanWrap');

    if (!wrap) return;

    if (!rows || rows.length === 0) {

      wrap.innerHTML = `<div class="state-box">Belum ada catatan untuk periode ini.</div>`;

      return;

    }

    const sorted = [...rows].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));

    const colors = ['var(--navy)', 'var(--orange)', 'var(--green)'];

    const cards = sorted.map((r, idx) => {

      const color = colors[idx % colors.length];

      const nomor = String(idx + 1).padStart(2, '0');

      return `
        <div class="pk-notes-card" style="--card-color:${color};">
          <div class="pk-notes-badge">${nomor}</div>
          <div class="pk-notes-body">
            <div class="pk-notes-keterangan">${Utils.escape(r.keterangan || '').replace(/\n/g, '<br>')}</div>
          </div>
          <div class="pk-notes-date">
            <span class="pk-notes-date-icon"><i class="fa-regular fa-calendar"></i></span>
            ${Utils.escape(r.tanggal || '-')}
          </div>
        </div>`;

    }).join('');

    wrap.innerHTML = `
      <div class="pk-notes-header">
        <div class="pk-notes-header-keterangan">Keterangan</div>
        <div class="pk-notes-header-tanggal">Tanggal</div>
      </div>
      <div class="pk-notes-list">${cards}</div>`;

  },



  renderFootnote() {

    document.getElementById('footerNote').innerHTML = `

      <i class="fa-solid fa-circle-info"></i>

      <span>Data diambil dari Laporan Monitoring dan Evaluasi Perjanjian Kinerja Tim Kerja SPML — Periode Bulan ${this.state.bulan} ${this.state.tahun}</span>`;

  }

};



document.addEventListener('DOMContentLoaded', () => Dashboard.init());
