/**
 * =======================================================
 *  FIREBASE INIT
 *  Menyiapkan koneksi ke Firestore & Auth.
 *  File ini butuh firebase-config.js dimuat lebih dulu,
 *  dan SDK compat (firebase-app-compat.js dst) di HTML.
 * =======================================================
 */
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
// auth hanya dipakai di input.html (butuh firebase-auth-compat.js dimuat di HTML)
const auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;

/** ID dokumen periode, format konsisten: 2026_Juni */
function periodeId(tahun, bulan) {
  return `${tahun}_${bulan}`;
}

/** Daftar 3 nama bulan dalam satu triwulan yang sama dengan `bulan` (mis. "Mei" -> ["April","Mei","Juni"]) */
function getTriwulanMonths(bulan) {
  const idx = BULAN_ORDER.indexOf(bulan);
  if (idx === -1) return [bulan];
  const startIdx = Math.floor(idx / 3) * 3;
  return BULAN_ORDER.slice(startIdx, startIdx + 3);
}

/** Nomor triwulan (1-4) dari nama bulan */
function getTriwulanNumber(bulan) {
  const idx = BULAN_ORDER.indexOf(bulan);
  if (idx === -1) return null;
  return Math.floor(idx / 3) + 1;
}

/**
 * Apakah bulan ini termasuk bulan "khusus bulanan" (belum masuk siklus triwulan)?
 * Januari & Februari -> tampilkan data bulanan itu sendiri (kalau ada inputnya),
 * BUKAN data triwulan.
 */
function isBulanKhusus(bulan) {
  const idx = BULAN_ORDER.indexOf(bulan);
  return idx === 0 || idx === 1; // Januari, Februari
}

/**
 * Jumlah maksimal triwulan yang DITAMPILKAN di dashboard untuk bulan tertentu
 * (hanya dipakai untuk bulan Maret ke atas; Jan & Feb ditangani terpisah
 * lewat isBulanKhusus).
 * Aturan (custom, bukan triwulan kalender biasa):
 *  - Maret, April, Mei        -> tampil Triwulan I saja            (max = 1)
 *  - Juni, Juli, Agustus      -> tampil Triwulan I & II            (max = 2)
 *  - September, Oktober, November -> tampil Triwulan I, II, & III  (max = 3)
 *  - Desember                 -> tampil Triwulan I, II, III, & IV  (max = 4)
 */
function getMaxTriwulanToShow(bulan) {
  const idx = BULAN_ORDER.indexOf(bulan);
  if (idx === -1) return 1;
  // idx: 0=Jan ... 11=Des
  if (idx <= 4) return 1;        // Jan(0) s.d Mei(4) -> minimal Triwulan I
  if (idx <= 7) return 2;        // Jun(5) - Agu(7)
  if (idx <= 10) return 3;       // Sep(8) - Nov(10)
  return 4;                      // Des(11)
}

/** Pastikan dokumen periode tercatat di collection "periode" (untuk isi dropdown filter) */
async function upsertPeriode(tahun, bulan) {
  await db.collection('periode').doc(periodeId(tahun, bulan)).set({
    tahun: String(tahun),
    bulan: bulan,
    bulanIndex: BULAN_ORDER.indexOf(bulan),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}
