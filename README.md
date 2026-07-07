# Dashboard PK Tim SPML — Versi Firebase (Tanpa Google Sheets)

Versi ini **tidak pakai Google Sheets sama sekali**. Semua data disimpan di **Firebase Firestore** (database gratis dari Google), dan diinput langsung lewat form di website (`input.html`), bukan lewat spreadsheet.

- `index.html` → Dashboard publik (siapa saja bisa lihat, read-only)
- `input.html` → Halaman admin untuk input/edit/hapus data (wajib login)

## Struktur Project

```
PK-Dashboard-Firebase/
├── index.html            # Dashboard publik
├── input.html             # Halaman admin (login + form input)
├── css/style.css
├── js/
│   ├── firebase-config.js   # ⚠️ WAJIB DIISI: config project Firebase kamu
│   ├── firebase-init.js
│   ├── utils.js
│   ├── charts.js
│   ├── dashboard.js         # Logic dashboard publik
│   ├── auth.js              # Login/logout admin
│   └── input.js             # Semua form Create/Update/Delete
└── firestore.rules          # Aturan keamanan Firestore
```

## LANGKAH 1 — Buat Project Firebase (gratis)

1. Buka https://console.firebase.google.com
2. **Add project** → beri nama misalnya `pk-dashboard-spml` → ikuti langkah sampai selesai (Google Analytics boleh dimatikan, tidak perlu).
3. Setelah project jadi, di halaman utama klik ikon **`</>`  (Web)** untuk mendaftarkan web app.
   - Nickname bebas, misal "PK Dashboard Web".
   - Tidak perlu centang Firebase Hosting (kita pakai GitHub Pages).
4. Firebase akan menampilkan objek `firebaseConfig` seperti:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "pk-dashboard-spml.firebaseapp.com",
     projectId: "pk-dashboard-spml",
     storageBucket: "pk-dashboard-spml.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
   Copy semua nilai ini.

## LANGKAH 2 — Aktifkan Firestore Database

1. Di sidebar Firebase Console, klik **Build → Firestore Database**.
2. Klik **Create database**.
3. Pilih **Start in production mode** → pilih lokasi server (misal `asia-southeast2` / Jakarta) → **Enable**.
4. Buka tab **Rules**, hapus isinya, tempel isi file `firestore.rules` dari project ini, lalu **Publish**.
   - Aturan ini artinya: **semua orang boleh baca** (dashboard publik jalan), tapi **hanya yang login yang boleh menulis** (input/edit/hapus data).

## LANGKAH 3 — Aktifkan Login Admin (Authentication)

1. Sidebar → **Build → Authentication** → **Get started**.
2. Tab **Sign-in method** → aktifkan provider **Email/Password**.
3. Tab **Users** → **Add user** → isi email & password kamu sendiri (ini akun admin buat login ke `input.html`).
   - Bisa buat beberapa akun kalau lebih dari satu orang yang input data.

## LANGKAH 4 — Isi Konfigurasi di Project

1. Buka file `js/firebase-config.js`.
2. Ganti semua nilai `PASTE_...` dengan config dari Langkah 1.
3. Simpan.

> Catatan: config Firebase (apiKey dkk) memang **wajar terlihat publik** di kode frontend — ini bukan celah keamanan, karena yang benar-benar melindungi data adalah **Firestore Rules** (Langkah 2) dan **Authentication** (Langkah 3), bukan menyembunyikan config ini.

## LANGKAH 5 — Upload ke GitHub Pages

1. Buat repository baru, misalnya `pk-dashboard`.
2. Upload semua isi folder `PK-Dashboard-Firebase/` (index.html, input.html, css/, js/) — **tidak perlu upload `firestore.rules`**, itu hanya referensi untuk Langkah 2.
3. Repo → **Settings → Pages** → Source: branch `main`, folder `/root` → **Save**.
4. Tunggu 1–2 menit, buka `https://username.github.io/pk-dashboard/`.

## LANGKAH 6 — Mulai Input Data

1. Buka `https://username.github.io/pk-dashboard/input.html`
2. Login dengan email/password admin yang dibuat di Langkah 3.
3. Ada 6 tab:
   - **PK Utama** — Operasional, Piutang, LKE, IKM, IPAK, Prima Aksi (1 data per Tahun+Bulan; isi ulang di periode yang sama untuk update).
   - **Survei** — IKM, IPAK, Responden (1 data per Tahun+Bulan).
   - **Prima Aksi** — jumlah Sesuai & Tidak Sesuai untuk pie chart (1 data per Tahun+Bulan).
   - **Monitoring Site** — bisa tambah banyak site per periode, tiap site punya status (Normal/Rusak/Gangguan). Ada tombol edit (pensil) & hapus (tempat sampah) di tiap baris.
   - **Pelayanan Publik** — bisa tambah banyak jenis layanan per periode (Target vs Capaian).
   - **Kegiatan** — bisa tambah banyak log kegiatan per periode.
4. Setiap kali kamu simpan data untuk Tahun+Bulan tertentu, periode itu **otomatis muncul di dropdown filter dashboard publik** — tidak perlu setup manual.
5. Buka `index.html`, pilih Tahun/Bulan → semua kartu KPI, gauge, pie, bar chart, status site, dan tabel kegiatan otomatis berubah.

## Model Data (Firestore)

| Collection    | Bentuk dokumen                          | Contoh ID                |
|---------------|------------------------------------------|---------------------------|
| `periode`     | 1 dokumen per Tahun+Bulan (buat dropdown) | `2026_Juni`               |
| `pk`          | 1 dokumen per Tahun+Bulan                 | `2026_Juni`               |
| `survei`      | 1 dokumen per Tahun+Bulan                 | `2026_Juni`               |
| `primaaksi`   | 1 dokumen per Tahun+Bulan                 | `2026_Juni`               |
| `monitoring`  | banyak dokumen per Tahun+Bulan (auto-ID) | id acak, mis. `aB3xQ...`  |
| `pelayanan`   | banyak dokumen per Tahun+Bulan (auto-ID) | id acak                   |
| `kegiatan`    | banyak dokumen per Tahun+Bulan (auto-ID) | id acak                   |

## Kustomisasi Cepat

- **Warna**: ubah variabel `:root` di `css/style.css`.
- **Nama aplikasi**: ubah `APP_NAME`/`APP_SUBTITLE` di `js/firebase-config.js`.
- **Threshold warna KPI** (hijau/oranye/merah): fungsi `renderKpi` di `js/dashboard.js`.
- **Tambah akun admin baru**: Firebase Console → Authentication → Users → Add user.

## Troubleshooting

| Masalah | Penyebab | Solusi |
|---|---|---|
| Dashboard kosong terus | Belum ada data di Firestore | Login ke `input.html`, isi minimal 1 data di tab "PK Utama" |
| "Missing or insufficient permissions" | Firestore Rules belum di-publish, atau belum login | Cek Langkah 2 & pastikan sudah login di `input.html` |
| Tidak bisa login | Email/Password belum diaktifkan / user belum dibuat | Cek Langkah 3 |
| Filter dashboard kosong | Belum ada dokumen di collection `periode` | Simpan data apa pun sekali dari `input.html`, otomatis terisi |
| Data tersimpan tapi dashboard tidak update | Perlu klik tombol **Refresh** atau ganti filter | Klik Refresh di dashboard |

Selamat mencoba! 🎉
