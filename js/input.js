/**
 * =======================================================
 * INPUT APP (khusus halaman input.html, setelah login)
 * Semua form Create/Update/Delete data ke Firestore ada di sini.
 * =======================================================
 */
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
      fields: ['Operasional', 'Piutang', 'LKE', 'IKM', 'IPAK', 'PrimaAksi'],
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

    this.setupMultiForm({
      formId: 'formMonitoring',
      collection: 'monitoring',
      tahunId: 'monitoringTahun', bulanId: 'monitoringBulan',
      fields: ['site', 'status'],
      listId: 'monitoringList',
      rowLabel: (d) => `${d.site} — ${d.status}`
    });

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
  }
};

// --- PENGAMAN LOCK DOM LOADING ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { InputApp.init(); });
} else {
    InputApp.init();
}
