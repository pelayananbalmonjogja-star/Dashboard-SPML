/**
 * =======================================================
 *  KONFIGURASI FIREBASE
 * =======================================================
 *  Ambil dari: Firebase Console > Project Settings >
 *  scroll ke "Your apps" > Web app > SDK setup and configuration
 * =======================================================
 */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAb2uUT6sn_V8gtFr-tjeb5v9Gmwwtgr1o",
  authDomain: "dashboard-spml.firebaseapp.com",
  projectId: "dashboard-spml",
  storageBucket: "dashboard-spml.firebasestorage.app",
  messagingSenderId: "104808864190",
  appId: "1:104808864190:web:7f5b229d6944fc3807c1ef"
};

// Nama & subjudul aplikasi (tampil di header)
const APP_NAME = "Dashboard Tim Kerja Sarana Prasarana Monitoring dan Layanan";
const APP_SUBTITLE = "Balai Monitor Spektrum Frekuensi Radio Kelas I Yogyakarta";

// Urutan bulan standar (dipakai untuk sorting & dropdown)
const BULAN_ORDER = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
