// ============================================================
// Catatan (Notes) — diisi manual langsung di dashboard.
// Tidak memakai Firebase. Tersimpan lokal di browser (localStorage)
// supaya isian tidak hilang saat halaman di-refresh.
// Kalau buka dashboard dari browser/HP lain, catatan tidak ikut
// (karena memang tidak dikirim ke server) — untuk itu tetap boleh
// diketik manual langsung di file index.html kalau mau permanen
// dan sama di semua perangkat.
//
// Tabel ini juga otomatis ikut filter Periode (dropdown di atas):
// pas ganti bulan, tabel Catatan cuma nampilin baris Minggu 1-4
// untuk bulan yang lagi dipilih. Ada juga checkbox "Tampilkan semua
// bulan" kalau mau lihat catatan satu tahun penuh sekaligus.
// ============================================================
(function () {
  var STORAGE_KEY = "pk_catatan_notes_v1";
  var rows = document.querySelectorAll(".pk-notes-table tbody tr");
  var cells = document.querySelectorAll(".pk-notes-isi");
  var selPeriode = document.getElementById("selPeriode");
  var section = document.getElementById("section-catatan");
  if (!cells.length || !section) return;

  // ---------- simpan / muat isi catatan ----------
  function loadNotes() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveNotes(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Gagal menyimpan catatan ke localStorage:", e);
    }
  }

  // key unik tiap baris = Bulan + Minggu
  function keyFor(cell) {
    var row = cell.closest("tr");
    var month = row.getAttribute("data-month") || "";
    var weekCell = row.querySelector(".pk-notes-week");
    var week = weekCell ? weekCell.textContent.trim() : "";
    return month + "__" + week;
  }

  var notes = loadNotes();

  cells.forEach(function (cell) {
    var k = keyFor(cell);
    if (notes[k]) cell.textContent = notes[k];

    cell.addEventListener("input", function () {
      var current = loadNotes();
      var text = cell.textContent.trim();
      if (text) {
        current[keyFor(cell)] = text;
      } else {
        delete current[keyFor(cell)];
      }
      saveNotes(current);
    });
  });

  // ---------- toggle "Tampilkan semua bulan" ----------
  var toggleWrap = document.createElement("label");
  toggleWrap.className = "pk-notes-toggle-all";
  toggleWrap.innerHTML = '<input type="checkbox" id="chkNotesShowAll"> Tampilkan semua bulan';
  var hint = section.querySelector(".pk-notes-hint");
  hint.parentNode.insertBefore(toggleWrap, hint.nextSibling);
  var chkShowAll = document.getElementById("chkNotesShowAll");

  // ---------- filter berdasarkan periode yang dipilih di dashboard ----------
  function applyFilter() {
    if (chkShowAll.checked) {
      rows.forEach(function (r) { r.style.display = ""; });
      return;
    }
    if (!selPeriode || !selPeriode.value) {
      rows.forEach(function (r) { r.style.display = ""; });
      return;
    }
    var bulan = selPeriode.value.split("|")[1] || "";
    bulan = bulan.trim().toLowerCase();
    rows.forEach(function (r) {
      var m = (r.getAttribute("data-month") || "").toLowerCase();
      r.style.display = (m === bulan) ? "" : "none";
    });
  }

  chkShowAll.addEventListener("change", applyFilter);

  // dropdown Periode diisi async via Firestore (dashboard.js), dan nilainya
  // di-set lewat kode (bukan lewat interaksi user), jadi tidak memicu event
  // "change" bawaan. Makanya di sini dipantau langsung perubahan value-nya.
  if (selPeriode) {
    selPeriode.addEventListener("change", applyFilter);
    var lastValue = null;
    setInterval(function () {
      if (selPeriode.value !== lastValue) {
        lastValue = selPeriode.value;
        applyFilter();
      }
    }, 300);
  }

  applyFilter();
})();
