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

/** Pastikan dokumen periode tercatat di collection "periode" (untuk isi dropdown filter) */
async function upsertPeriode(tahun, bulan) {
  await db.collection('periode').doc(periodeId(tahun, bulan)).set({
    tahun: String(tahun),
    bulan: bulan,
    bulanIndex: BULAN_ORDER.indexOf(bulan),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}
