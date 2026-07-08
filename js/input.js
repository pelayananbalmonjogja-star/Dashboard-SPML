/**
 * =======================================================
 * INPUT APP (khusus halaman input.html, setelah login)
 * Semua form Create/Update/Delete data ke Firestore ada di sini.
 * =======================================================
 */
// Daftar site tetap untuk checklist "Kondisi Stasiun Monitoring SMFR".
const SITE_LIST = [
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

// Nilai persentase per kondisi site.
const SITE_KONDISI_VALUE = { Baik: 100, Rusak: 75 };

const InputApp = {
  initialized: false,

  init() {
    if (this.initialized) return; // hindari pasang listener dobel saat re-login
    this.initialized = true;

    console.log("InputApp diinisialisasi secara aman...");
    this.setupTabs();
    this.setupBulanSelects();

    this.setupSingleForm({
      formId: 'formPK',
      collection: 'pk',
      tahunId: 'pkTahun', bulanId: 'pkBulan',
      fields: ['Operasional', 'Piutang', 'SOR', 'LKE', 'IKM', 'IPAK', 'PrimaAksi'],
      statusId: 'pkStatus'
    });

    this.setupSingleForm({
      formId: 'formSurvei',
      collection: 'survei',
      tahunId: 'surveiTahun', bulanId: 'surveiBulan',
      fields: ['IKM', 'IPAK', 'Responden'],
      statusId: 'surveiStatus'
    });

    this.setupSingleForm({
      formId: 'formPrimaaksi',
      collection: 'primaaksi',
      tahunId: 'primaaksiTahun', bulanId: 'primaaksiBulan',
      fields: ['Sesuai', 'Tidak'],
      statusId: 'primaaksiStatus'
    });

    this.setupSiteChecklist();

    this.setupMultiForm({
      formId: 'formPelayanan',
      collection: 'pelayanan',
      tahunId: 'pelayananTahun', bulanId: 'pelayananBulan',
      fields: ['jenis', 'target', 'capaian'],
      listId: 'pelayananList',
      rowLabel: (d) => `${d.jenis} — ${d.capaian}/${d.target}`
    });

    this.setupMultiForm({
      formId: 'formKegiatan',
      collection: 'kegiatan',
      tahunId: 'kegiatanTahun', bulanId: 'kegiatanBulan',
      fields: ['tanggalMulai', 'tanggalSelesai', 'judul', 'keterangan'],
      listId: 'kegiatanList',
      rowLabel: (d) => `${d.tanggalMulai || ''} s.d ${d.tanggalSelesai || ''} — ${d.judul}`
    });
  },

  setupTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
      });
    });
  },

  setupBulanSelects() {
    const selects = document.querySelectorAll('select.bulan-select');
    const currentYear = new Date().getFullYear();
    
    // --- SISTEM PENGAMAN BULAN ---
    // Gunakan BULAN_ORDER jika tersedia, jika belum termuat gunakan array cadangan ini agar tidak crash
    let daftarBulan = (typeof BULAN_ORDER !== 'undefined' && Array.isArray(BULAN_ORDER)) ? BULAN_ORDER : [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    selects.forEach(sel => {
      sel.innerHTML = daftarBulan.map(b => `<option value="${b}">${b}</option>`).join('');
    });
    
    document.querySelectorAll('input.tahun-input').forEach(inp => {
      inp.value = currentYear;
    });
    console.log("Dropdown bulan dan default tahun berhasil dipasang.");
  },

  /** Form untuk data 1-baris-per-periode: PK, Survei, Prima Aksi */
  setupSingleForm({ formId, collection, tahunId, bulanId, fields, statusId }) {
    const form = document.getElementById(formId);
    const tahunEl = document.getElementById(tahunId);
    const bulanEl = document.getElementById(bulanId);
    const statusEl = document.getElementById(statusId);

    if (!form || !tahunEl || !bulanEl || !statusEl) return;

    const loadExisting = async () => {
      const tahun = tahunEl.value.trim();
      const bulan = bulanEl.value;
      if (!tahun || !bulan) return;
      try {
        const doc = await db.collection(collection).doc(periodeId(tahun, bulan)).get();
        fields.forEach(f => {
          const el = document.getElementById(`${formId}_${f}`);
          if (!el) return;
          el.value = doc.exists && doc.data()[f] !== undefined ? doc.data()[f] : '';
        });
        statusEl.textContent = doc.exists ? 'Data sudah ada — menyimpan akan menimpa (update).' : 'Belum ada data untuk periode ini — menyimpan akan membuat baru.';
        statusEl.className = 'form-status ' + (doc.exists ? 'exists' : 'new');
      } catch (err) {
        console.error("Gagal memuat data lama:", err);
      }
    };

    tahunEl.addEventListener('change', loadExisting);
    bulanEl.addEventListener('change', loadExisting);
    loadExisting();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tahun = tahunEl.value.trim();
      const bulan = bulanEl.value;
      if (!tahun || !bulan) return alert('Isi Tahun dan Bulan dulu.');

      const payload = { tahun: String(tahun), bulan };
      fields.forEach(f => {
        const el = document.getElementById(`${formId}_${f}`);
        if (el) {
          payload[f] = el.type === 'number' || el.inputMode === 'numeric' ? Number(el.value) || 0 : el.value;
        }
      });

      try {
        await db.collection(collection).doc(periodeId(tahun, bulan)).set(payload, { merge: true });
        await upsertPeriode(tahun, bulan);
        statusEl.textContent = '✅ Tersimpan.';
        statusEl.className = 'form-status success';
        setTimeout(loadExisting, 1200);
      } catch (err) {
        console.error(err);
        statusEl.textContent = '⚠ Gagal menyimpan: ' + err.message;
        statusEl.className = 'form-status error';
      }
    });
  },

  /** Form untuk data banyak-baris-per-periode: Monitoring, Pelayanan, Kegiatan */
  setupMultiForm({ formId, collection, tahunId, bulanId, fields, listId, rowLabel }) {
    const form = document.getElementById(formId);
    const tahunEl = document.getElementById(tahunId);
    const bulanEl = document.getElementById(bulanId);
    const listEl = document.getElementById(listId);
    if (!form || !tahunEl || !bulanEl || !listEl) return;
    
    let editingId = null;

    const renderList = async () => {
      const tahun = tahunEl.value.trim();
      const bulan = bulanEl.value;
      if (!tahun || !bulan) { listEl.innerHTML = ''; return; }

      try {
        const snap = await db.collection(collection)
          .where('tahun', '==', String(tahun))
          .where('bulan', '==', bulan)
          .get();

        const rows = [];
        snap.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));

        if (rows.length === 0) {
          listEl.innerHTML = `<div class="state-box" style="padding:16px 0;">Belum ada data untuk periode ini.</div>`;
          return;
        }

        listEl.innerHTML = rows.map(r => `
          <div class="mini-row" data-id="${r.id}">
            <span>${Utils.escape(rowLabel(r))}</span>
            <span class="mini-row-actions">
              <button type="button" class="btn-icon btn-edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
              <button type="button" class="btn-icon btn-delete" title="Hapus"><i class="fa-solid fa-trash"></i></button>
            </span>
          </div>`).join('');

        listEl.querySelectorAll('.btn-delete').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const rowEl = e.target.closest('.mini-row');
            if (!rowEl) return;
            const id = rowEl.dataset.id;
            if (!confirm('Hapus data ini?')) return;
            await db.collection(collection).doc(id).delete();
            renderList();
          });
        });

        listEl.querySelectorAll('.btn-edit').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const rowEl = e.target.closest('.mini-row');
            if (!rowEl) return;
            const id = rowEl.dataset.id;
            const row = rows.find(r => r.id === id);
            editingId = id;
            fields.forEach(f => {
              const el = document.getElementById(`${formId}_${f}`);
              if (el) el.value = row[f] !== undefined ? row[f] : '';
            });
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Update Data';
          });
        });
      } catch (err) {
        console.error("Gagal merender list multi-form:", err);
      }
    };

    tahunEl.addEventListener('change', renderList);
    bulanEl.addEventListener('change', renderList);
    renderList();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tahun = tahunEl.value.trim();
      const bulan = bulanEl.value;
      if (!tahun || !bulan) return alert('Isi Tahun dan Bulan dulu.');

      const payload = { tahun: String(tahun), bulan };
      fields.forEach(f => {
        const el = document.getElementById(`${formId}_${f}`);
        if (el) {
          payload[f] = el.type === 'number' ? Number(el.value) || 0 : el.value;
        }
      });

      try {
        if (editingId) {
          await db.collection(collection).doc(editingId).set(payload, { merge: true });
          editingId = null;
          const submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.textContent = 'Tambah Data';
        } else {
          await db.collection(collection).add(payload);
        }
        await upsertPeriode(tahun, bulan);
        fields.forEach(f => {
          const el = document.getElementById(`${formId}_${f}`);
          if (el) el.value = '';
        });
        renderList();
      } catch (err) {
        console.error(err);
        alert('Gagal menyimpan: ' + err.message);
      }
    });
  },

  /** Checklist site khusus untuk tab "Kondisi Stasiun Monitoring SMFR" */
  setupSiteChecklist() {
    const tahunEl = document.getElementById('monitoringTahun');
    const bulanEl = document.getElementById('monitoringBulan');
    const checklistEl = document.getElementById('siteChecklist');
    const totalEl = document.getElementById('monitoringTotalOperasional');
    const statusEl = document.getElementById('monitoringStatus');
    const listEl = document.getElementById('monitoringList');
    const btnSimpan = document.getElementById('btnSimpanSite');
    if (!tahunEl || !bulanEl || !checklistEl || !totalEl || !btnSimpan) return;

    // Render baris checklist untuk tiap site
    checklistEl.innerHTML = SITE_LIST.map((site, i) => `
      <div class="site-check-row" data-site="${Utils.escape(site)}">
        <label class="site-check-label">
          <input type="checkbox" class="site-check-box" id="siteChk_${i}">
          <span>${Utils.escape(site)}</span>
        </label>
        <select class="site-check-kondisi" id="siteKondisi_${i}">
          <option value="Baik">Baik (100%)</option>
          <option value="Rusak">Rusak (75%)</option>
        </select>
      </div>`).join('');

    const recalcTotal = () => {
      const values = [];
      SITE_LIST.forEach((site, i) => {
        const chk = document.getElementById(`siteChk_${i}`);
        const kondisi = document.getElementById(`siteKondisi_${i}`);
        if (chk && chk.checked) {
          values.push(SITE_KONDISI_VALUE[kondisi.value] ?? 0);
        }
      });
      if (values.length === 0) return;
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      totalEl.value = Math.round(avg * 100) / 100;
    };

    checklistEl.addEventListener('change', (e) => {
      if (e.target.classList.contains('site-check-box') || e.target.classList.contains('site-check-kondisi')) {
        recalcTotal();
      }
    });

    const loadExisting = async () => {
      const tahun = tahunEl.value.trim();
      const bulan = bulanEl.value;
      // reset checklist dulu
      SITE_LIST.forEach((site, i) => {
        const chk = document.getElementById(`siteChk_${i}`);
        const kondisi = document.getElementById(`siteKondisi_${i}`);
        if (chk) chk.checked = false;
        if (kondisi) kondisi.value = 'Baik';
      });
      totalEl.value = '';
      if (!tahun || !bulan) { listEl.innerHTML = ''; return; }

      try {
        const [monitoringSnap, pkDoc] = await Promise.all([
          db.collection('monitoring').where('tahun', '==', String(tahun)).where('bulan', '==', bulan).get(),
          db.collection('pk').doc(periodeId(tahun, bulan)).get()
        ]);

        const rows = [];
        monitoringSnap.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));

        rows.forEach(r => {
          const idx = SITE_LIST.indexOf(r.site);
          if (idx === -1) return;
          const chk = document.getElementById(`siteChk_${idx}`);
          const kondisi = document.getElementById(`siteKondisi_${idx}`);
          const kondisiValue = String(r.status || '').toLowerCase().includes('rusak') ? 'Rusak' : 'Baik';
          if (chk) chk.checked = true;
          if (kondisi) kondisi.value = kondisiValue;
        });

        if (rows.length > 0) {
          recalcTotal();
        } else if (pkDoc.exists && pkDoc.data().Operasional !== undefined) {
          totalEl.value = pkDoc.data().Operasional;
        }

        if (rows.length === 0) {
          listEl.innerHTML = `<div class="state-box" style="padding:16px 0;">Belum ada data site untuk periode ini.</div>`;
        } else {
          listEl.innerHTML = rows.map(r => `
            <div class="mini-row" data-id="${r.id}">
              <span>${Utils.escape(r.site)} — ${Utils.escape(r.status)}</span>
            </div>`).join('');
        }

        statusEl.textContent = rows.length > 0
          ? 'Data site sudah ada — menyimpan akan menimpa (update).'
          : 'Belum ada data site untuk periode ini.';
        statusEl.className = 'form-status ' + (rows.length > 0 ? 'exists' : 'new');
      } catch (err) {
        console.error('Gagal memuat data site:', err);
      }
    };

    tahunEl.addEventListener('change', loadExisting);
    bulanEl.addEventListener('change', loadExisting);
    loadExisting();

    btnSimpan.addEventListener('click', async () => {
      const tahun = tahunEl.value.trim();
      const bulan = bulanEl.value;
      if (!tahun || !bulan) return alert('Isi Tahun dan Bulan dulu.');

      try {
        // Ambil data site yang sudah tersimpan untuk periode ini agar site yang
        // di-uncheck bisa dihapus, dan site yang sudah ada di-update (bukan duplikat).
        const existingSnap = await db.collection('monitoring')
          .where('tahun', '==', String(tahun))
          .where('bulan', '==', bulan)
          .get();
        const existingBySite = {};
        existingSnap.forEach(doc => { existingBySite[doc.data().site] = doc.id; });

        const batchOps = [];
        SITE_LIST.forEach((site, i) => {
          const chk = document.getElementById(`siteChk_${i}`);
          const kondisi = document.getElementById(`siteKondisi_${i}`);
          const isChecked = chk && chk.checked;
          const existingId = existingBySite[site];

          if (isChecked) {
            const payload = {
              tahun: String(tahun),
              bulan,
              site,
              status: kondisi.value,
              value: SITE_KONDISI_VALUE[kondisi.value] ?? 0
            };
            if (existingId) {
              batchOps.push(db.collection('monitoring').doc(existingId).set(payload, { merge: true }));
            } else {
              batchOps.push(db.collection('monitoring').add(payload));
            }
          } else if (existingId) {
            batchOps.push(db.collection('monitoring').doc(existingId).delete());
          }
        });

        await Promise.all(batchOps);

        // Simpan total operasional ke koleksi 'pk' (dipakai gauge di dashboard)
        const totalValue = Number(totalEl.value) || 0;
        await db.collection('pk').doc(periodeId(tahun, bulan)).set({
          tahun: String(tahun), bulan, Operasional: totalValue
        }, { merge: true });

        await upsertPeriode(tahun, bulan);

        statusEl.textContent = '✅ Data site & total operasional tersimpan.';
        statusEl.className = 'form-status success';
        loadExisting();
      } catch (err) {
        console.error(err);
        statusEl.textContent = '⚠ Gagal menyimpan: ' + err.message;
        statusEl.className = 'form-status error';
      }
    });
  }
};

// --- PENGAMAN LOCK DOM LOADING ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { InputApp.init(); });
} else {
    InputApp.init();
}
