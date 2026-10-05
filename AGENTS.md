# AGENTS.md — Panduan Agent untuk Proyek Nautika

Dokumen ini adalah instruksi kerja untuk agent (Antigravity, Claude Code, atau agent lain) yang mengerjakan proyek ini. Baca dokumen ini **sebelum** menulis kode apa pun.

## 1. Urutan Baca Wajib

Sebelum mengerjakan task apa pun, agent harus sudah membaca urutan berikut:

1. `PRD.md` — apa yang dibangun dan kenapa. **Sumber kebenaran tertinggi.**
2. `ARCHITECTURE.md` — bagaimana strukturnya secara teknis.
3. `DATA_SCHEMA.md` — skema kolom persis, jangan mengarang nama kolom sendiri.
4. `DESIGN.md` — aturan visual, termasuk daftar larangan eksplisit (negative prompt).
5. `CHANGELOG.md` — riwayat apa yang sudah dikerjakan, supaya tidak mengulang atau menimpa pekerjaan fase sebelumnya secara tidak sengaja.

Jika ada instruksi dari user dalam percakapan yang bertentangan dengan dokumen ini, **klarifikasi dulu** — jangan asumsikan chat sesaat mengalahkan dokumen resmi, karena dokumen ini yang dijaga tetap sinkron.

## 2. Prinsip Kerja

- **Jangan menyimpang dari scope PRD tanpa konfirmasi eksplisit.** Riwayat proyek ini sebelumnya rusak karena agent menambah/mengubah scope tanpa PRD yang jelas — jangan ulangi pola itu.
- **Modular per PRD/ARCHITECTURE, bukan modular versi sendiri.** Jangan menggabungkan atau memecah sheet/modul di luar yang sudah didefinisikan di `DATA_SCHEMA.md` kecuali ada alasan teknis kuat — dan jika itu terjadi, **wajib dicatat di `CHANGELOG.md` beserta alasannya**, dan idealnya dikonfirmasi ke user dulu.
- **RBAC ditegakkan di server, bukan hanya UI.** Lihat `ARCHITECTURE.md` §8 — setiap service function wajib assert scope sebelum baca/tulis data.
- **Semua kalkulasi (persentase, sisa, akumulasi, stok akhir) dihitung server-side.** Tidak ada logika hitung penting yang hanya ada di frontend.
- **Versioning, bukan overwrite.** Setiap edit data transaksi mengikuti mekanisme di `ARCHITECTURE.md` §5 — insert baris baru + tandai lama `SUPERSEDED`, jangan pernah `UPDATE` langsung menimpa baris lama untuk data historis mingguan.
- **Desain: cek negative prompt di `DESIGN.md` §1 setiap kali membuat komponen baru.** Kalau ragu apakah sesuatu "kelihatan AI-slop", cek daftar itu dulu sebelum implementasi.

## 3. Konvensi Kode

- Penamaan service function: `modul_aksi` (mis. `tataUsaha_submitMingguan`, `perawatan_getKesiapan`) — lihat `ARCHITECTURE.md` §7.
- Struktur folder GAS mengikuti `ARCHITECTURE.md` §7 persis — jangan buat struktur folder baru tanpa update dokumen ini.
- Setiap sheet transaksi baru (jika suatu saat dibutuhkan) wajib punya kolom standar (`RowID`, `DivisiID`, `Periode`, `SubmittedBy`, `Timestamp`, `Status`, `SupersedesRowID`, `VoidReason`, `VoidedBy`, `VoidedAt`) — lihat `ARCHITECTURE.md` §4.
- Semua endpoint tulis wajib pakai `LockService` (lihat `ARCHITECTURE.md` §11).

## 4. Kapan Harus Bertanya, Bukan Berasumsi

Berhenti dan tanyakan ke user (jangan lanjut mengasumsikan) jika:
- Ada field di sumber data infografis yang nilainya ambigu/tidak lengkap (lihat `PRD.md` §13 — beberapa sudah teridentifikasi, tapi mungkin ada yang baru ditemukan saat implementasi).
- Ada kebutuhan yang tampaknya butuh mengubah struktur `DATA_SCHEMA.md` (tambah/hapus/ubah tipe kolom) — ini perubahan skema, dampaknya besar.
- Ada permintaan fitur yang tidak tercakup di `PRD.md` — jangan diam-diam ditambahkan.
- Ragu apakah suatu keputusan desain melanggar `DESIGN.md` §1 (negative prompt).

## 5. Disiplin Update Dokumentasi

- **Setiap kali menyelesaikan satu unit kerja berarti (satu modul, satu fase, satu perbaikan besar)**, wajib menambah entri baru di `CHANGELOG.md` mengikuti format yang sudah ada di sana. Jangan menumpuk banyak pekerjaan lalu menulis satu entri besar samar-samar di akhir.
- Jika suatu keputusan teknis diambil saat implementasi yang tidak eksplisit disebut di `ARCHITECTURE.md`/`DATA_SCHEMA.md` (mis. pilihan library chart, keputusan simplifikasi geojson), **catat keputusan itu di `CHANGELOG.md`** dan, jika cukup penting, update juga dokumen teknis terkait supaya tetap jadi sumber kebenaran yang akurat.
- Jangan biarkan dokumen jadi tidak sinkron dengan kode — ini persis masalah yang membuat proyek sebelumnya harus dibangun ulang dari nol.

## 5b. Git/GitHub — HANYA USER (agent tidak menyentuh)

**Aturan keras**: agent **DILARANG** menjalankan operasi Git/GitHub apa pun — `git add`, `git commit`, `git push`, `git reset`, `gh`, dsb. Version control GitHub **sepenuhnya milik user**. (Konteks: agent pernah membuat commit lokal yang akhirnya harus di-reset — jangan ulangi.)

**Peran agent**: agent hanya **mengingatkan user untuk push**. Saat satu unit kerja selesai dan hasilnya siap, agent menyampaikan status lalu menutup dengan pengingat singkat bahwa perubahan siap di-commit/push oleh user — bukan mengerjakannya sendiri.

- Jangan menanyakan "apakah sudah aman?" sebagai pemicu push otomatis. Cukup laporkan status pekerjaan dan ingatkan user untuk commit/push.
- Agent tidak melakukan deploy/push ke mana pun (termasuk `clasp push`) kecuali user memintanya secara eksplisit di percakapan.
- Pengingat keamanan **untuk user** sebelum push tetap berlaku: pastikan tidak ada rahasia hardcoded (CARTO API key via `PropertiesService`/`utils_getCartoKey()`, password seed via `PROP_KEY.SEED_SUPERADMIN_PASSWORD`). Lihat `ARCHITECTURE.md` §9.
- `.gitignore` tetap disamakan dengan `.claspignore` (keputusan user eksplisit).

## 6. Definition of Done (per modul divisi)

Satu modul divisi (mis. Operasi Laut) dianggap selesai jika:
- [ ] Form input sesuai field di `DATA_SCHEMA.md` untuk sheet terkait, termasuk dropdown relasional (Kapal/WPP/Kawasan, bukan free-text)
- [ ] Validasi server-side sesuai aturan di `PRD.md` §5 untuk modul tersebut
- [ ] RBAC scope ditegakkan (Staf/Kadiv divisi tersebut CRUD hanya divisinya, Direktur/Superadmin lintas semua)
- [ ] Versioning (revisi) & anulir berfungsi, tercatat di Audit Log
- [ ] Akumulasi mingguan→bulanan→YTD dihitung otomatis di dashboard, bukan input manual
- [ ] Upload evidence per-item berfungsi (dual mode: file & drive-link-copy), tersimpan ke folder sesuai `ARCHITECTURE.md` §6
- [ ] Chart & visualisasi modul sesuai `DESIGN.md` §6 (tipe chart yang diizinkan untuk data tersebut)
- [ ] Filter periode global (bulanan/rentang tanggal) memengaruhi seluruh tampilan halaman
- [ ] Entri baru ditambahkan ke `CHANGELOG.md`
