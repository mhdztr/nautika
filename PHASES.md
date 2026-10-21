# PROMPT AWAL — Proyek Nautika

Salin seluruh isi file ini sebagai prompt pertama ke agent (Antigravity/Claude Code/dll) di awal sesi kerja proyek.

---

Kamu akan membangun **Nautika**, sistem monitoring & pelaporan untuk Direktorat Pengendalian Operasi Armada (POA), Kementerian Kelautan dan Perikanan RI. Stack: Google Apps Script + Google Spreadsheet sebagai database + Google Drive sebagai storage file, frontend SPA HTML Service.

Proyek ini adalah **rebuild total** dari percobaan sebelumnya yang gagal karena dikerjakan tanpa PRD yang jelas dan scope-nya melebar tanpa kendali. Kali ini kamu bekerja dari dokumentasi lengkap yang sudah difinalisasi. **Jangan ulangi kesalahan itu.**

## Dokumen yang harus kamu baca, dalam urutan ini, sebelum menulis kode apa pun

1. `AGENTS.md` — instruksi kerja kamu sebagai agent. Baca ini paling dulu.
2. `PRD.md` — sumber kebenaran tertinggi soal apa yang dibangun dan kenapa. Jika ada bagian yang tidak jelas, tanyakan ke saya sebelum lanjut, jangan menebak.
3. `ARCHITECTURE.md` — struktur teknis: 3 spreadsheet (`Nautika_Master`, `Nautika_Transaksi`, `Nautika_Log`), struktur folder kode GAS, mekanisme versioning/anulir, struktur folder Google Drive.
4. `DATA_SCHEMA.md` — skema kolom persis setiap sheet. Jangan mengarang nama kolom sendiri, jangan menambah/menghapus kolom tanpa konfirmasi ke saya.
5. `DESIGN.md` — sistem desain, termasuk daftar larangan eksplisit (negative prompt anti-AI-slop) di §1. Baca bagian ini dengan sangat teliti — saya sangat peduli soal ini, jangan sampai hasilnya kembali terlihat generik/AI-slop seperti sebelumnya.
6. `CHANGELOG.md` — riwayat progres. Kamu akan menambah entri baru di sini setiap selesai satu fase.

Setelah membaca semuanya, **rangkum pemahamanmu ke saya dalam beberapa kalimat** sebelum mulai Fase 0 — supaya saya bisa koreksi kalau ada yang salah tangkap, sebelum waktu terbuang untuk membangun hal yang salah.

## Aturan Kerja — Wajib Dipatuhi Sepanjang Proyek

- **Kerjakan satu fase pada satu waktu.** Jangan lompat ke fase berikutnya, jangan mengerjakan beberapa fase sekaligus "sambil jalan", walaupun menurutmu itu lebih efisien. Ini eksplisit saya minta karena versi sebelumnya "meledak" (over-scope, kacau) gara-gara jalan tanpa batas begini.
- **Setelah menyelesaikan satu fase**, berhenti. Ringkas apa yang sudah dikerjakan, tunjukkan bagaimana cara saya mengetesnya (langkah manual atau screenshot/deskripsi hasil), update `CHANGELOG.md` dengan entri baru sesuai template di dalamnya, lalu **tunggu konfirmasi saya** sebelum lanjut ke fase berikutnya.
- **Jangan menambah fitur yang tidak ada di `PRD.md`.** Kalau kamu merasa ada fitur yang "pasti akan dibutuhkan nanti", tulis sebagai catatan/pertanyaan ke saya — jangan langsung dibangun.
- **Jangan mengubah struktur `DATA_SCHEMA.md`** (tambah/hapus/ubah tipe kolom) tanpa bertanya dulu ke saya. Kalau kamu menemukan kebutuhan yang sepertinya butuh perubahan skema saat implementasi, stop, jelaskan alasannya ke saya, tunggu keputusan.
- **RBAC ditegakkan di server, bukan cuma disembunyikan di UI.** Setiap fase yang menyentuh data wajib menerapkan scope-check sesuai `ARCHITECTURE.md` §8.
- **Ikuti negative prompt desain (`DESIGN.md` §1) secara ketat di setiap komponen UI yang kamu buat** — tidak ada ikon warna-warni per kartu, tidak ada gradient blob, tidak ada gauge melingkar, tidak ada badge dekoratif tanpa makna status, tidak ada subtitle di bawah judul.
- Kalau ragu tentang sesuatu — field ambigu dari data sumber, keputusan teknis yang tidak eksplisit disebut di dokumen, atau apa pun — **tanyakan ke saya, jangan berasumsi sendiri lalu jalan terus.**

---

## Rencana Fase

### Revisi UI — Backlog Disetujui User (diputuskan 22 Sep 2026)

Keputusan desain dari user yang **belum dikerjakan**; dicatat supaya keputusan tidak hilang dan tidak menyimpang. Mengikat pola yang akan diterapkan nanti — implementasi mengikuti keputusan ini.

#### A. Form input divisi → Popup (modal), menggantikan inline-expand
- **Masalah saat ini**: tombol isi form melebarkan form **inline di halaman** memperlihatkan semua input sekaligus → clutter & kurang fokus.
- **Keputusan user**: form isi laporan di **semua modul divisi** ditampilkan sebagai **popup modal**, bukan inline.
- **Data konteks**: untuk divisi yang perlu melihat data saat mengisi, tampilkan **data penting seperlunya di atas form di dalam modal — bukan seluruh dashboard**. Contoh yang akan ditentukan saat implementasi: TU → Pagu periode berjalan; Logistik → stok akhir terkini. Prinsip: *hanya data yang penting*.
- **Alasan**: fokus saat input; tata letak halaman (KPI + chart + riwayat) stabil; konsisten dengan modal revisi/anulir/"Lihat"/lampiran; form panjang muat via scroll.
- **Teknis yang wajib di-handle**: (1) pola modal bisa menyalin induk `modal-hd` (overlay + `.n-modal` + area scroll); (2) **Leaflet** — peta WPP pada form Operasi Laut/Udara perlu `map.invalidateSize()` setelah modal terbuka (Leaflet tidak auto-resize elemen yang baru tampil); (3) blok lampiran inline (`_attachInit` dst.) ikut dipindah ke dalam modal; (4) 13 form terdampak (TU, Operasi Laut, Operasi Udara, Intelijen, Pemantauan, Perawatan ×3, Logistik ×3, Pengawakan ×2).
- **Status**: backlog — **dijadwalkan sebagai Fase 11.5** (21–22 Sep 2026, dijadwalkan oleh user untuk dikerjakan "setelah ini" = setelah Fase 11 selesai). Kandidat awal (sebelum Fase 12) diambil — Fase 14 QA/Polish tidak dipakai, agar menunggu konfirmasi user lagi.

#### B. Input referensi (Jenis/Kategori) → Combobox typeahead — DIBATALKAN
- **Masalah saat ini (awal)**: `<select>` dropdown Jenis/Kategori terasa clutter bila daftar opsi panjang.
- **Keputusan user (22 Sep 2026)**: ganti menjadi **input teks + autocomplete** (typeahead) yang sumber sarannya dari sheet `Opsi`, tetapi nilai akhir **tetap divalidasi server** terhadap master (nilai tak dikenal ditolak; admin diminta menambah opsi di Master Data dulu). Bukan free-text submission — itu sudah ditolak di revisi Fase 9/10 karena merusak keutuhan data & validasi stok.
- **Status saat ini — DIBATALKAN (28 Sep 2026, atas permintaan user)**: setelah dicoba, user menilai tampilan typeahead "aneh" (terlihat seperti kotak ketik, bukan dropdown). Keputusan dicabut, **pendekatan ini dicatat sebagai rejected-approach agar tidak diulang**: 4 field enum (jenis amunisi/BBM/komponen personil/kategori AKN) dikembalikan ke `<select>` biasa berisi opsi `Opsi`; 4 field relasi Kapal memakai **dropdown + kotak cari** (tetap jelas terlihat sebagai dropdown, tombol hapus me-reset filter penuh). Nilai akhir tetap divalidasi server. Detail: CHANGELOG `[Fase 12 — QA Lintas Modul]` (entri "Input Jenis Kembali ke Dropdown").

---

### Fase 0 — Pemahaman & Rangkuman (tanpa kode)
Baca semua dokumen di atas. Berikan rangkuman pemahamanmu ke saya: struktur RBAC, alur data mingguan→bulanan→YTD, daftar modul, dan poin desain yang paling kritis (negative prompt). Tunggu konfirmasi saya sebelum menyentuh kode apa pun.

### Fase 1 — Fondasi Database
Bangun `Setup.js` yang menginisialisasi 3 Google Spreadsheet (`Nautika_Master`, `Nautika_Transaksi`, `Nautika_Log`) beserta seluruh sheet dan header kolom persis sesuai `DATA_SCHEMA.md`. Isi data seed awal untuk `Divisi` (8 divisi/scope sesuai `PRD.md` §4) dan minimal 1 akun `SUPERADMIN` untuk login pertama kali. Jangan bangun UI apa pun di fase ini — fokus database saja. Tunjukkan cara saya verifikasi struktur sheet sudah benar.

### Fase 2 — Auth, RBAC, Alur Registrasi/Approval
Bangun `AuthService.js`: register (pilih divisi + role dilamar), login, session management, routing approval (ke Superadmin untuk pendaftar Kadiv, ke Kadiv divisi terkait untuk pendaftar Staf, fallback ke Superadmin jika divisi belum ada Kadiv aktif), halaman "Menunggu Persetujuan" untuk akun `PENDING`. Bangun juga `assertScope()` helper yang akan dipakai semua service berikutnya. Tunjukkan alur test: register sebagai Staf → login sebagai Kadiv → approve → login sebagai Staf yang baru di-approve.

### Fase 3 — Shell SPA & Desain Dasar
Bangun `Index.html`, `Style.html` (ikuti `DESIGN.md` §2-5 persis: tipografi, palet warna terbatas, shape/shadow, negative space), `Script_Main.html` (state management, routing hash, sidebar navigasi 9 modul + Overview + Master Data + Riwayat Laporan, sesuai role yang login). Belum ada data real — cukup shell kosong yang bisa dinavigasi, dengan filter periode global (kanan atas) sebagai komponen UI (belum perlu logic penuh). Ini fase paling penting untuk saya cek soal "AI-slop" — saya akan review ketat sebelum lanjut.

### Fase 4 — Master Data
Bangun `MasterDataService.js` + halaman CRUD untuk Data Kapal dan Data Kawasan Konservasi (Superadmin + Direktur). Bangun juga import/parsing referensi `WPP` dari `wpp_final.geojson` ke sheet `WPP` di `Nautika_Master`. Belum perlu halaman Profil Kapal (itu butuh data transaksi dari fase-fase lain) — cukup CRUD dasarnya dulu.
**Status**: Selesai (implementasi + hotfix bug tombol Simpan Master Data: pemanggilan `google.script.run` di `_mdSaveKapal`/`_mdSaveKawasan` memakai urutan salah sehingga callback tak pernah jalan — lihat CHANGELOG `[Hotfix] — Tombol Simpan Master Data`).

### Fase 5 — Modul Pilot: Tata Usaha
Bangun modul Tata Usaha end-to-end: form input mingguan, mekanisme versioning (revisi) & anulir sesuai `ARCHITECTURE.md` §5, validasi `Pagu = Realisasi + Sisa` (warning, bukan blocking), kalkulasi otomatis (Sisa, %, akumulasi bulanan/YTD) di server, tampilan dashboard modul dengan chart sesuai `DESIGN.md` §6. Modul ini jadi **pola acuan** untuk semua modul divisi berikutnya — pastikan pola ini benar-benar solid sebelum saya izinkan lanjut, karena fase berikutnya akan mengulang pola yang sama.
**Status**: Selesai (implementasi + polish riwayat: tabel Riwayat Laporan Tata Usaha disamakan ke pola Operasi & `.status-badge` didefinisikan; lihat CHANGELOG `[Polish UI] — Riwayat Laporan Tata Usaha...`).

### Fase 6 — Modul Operasi Laut & Operasi Udara
**Status**: Selesai (implementasi Operasi Laut & Udara termasuk peta WPP/Leaflet; verifikasi runtime oleh user, lihat CHANGELOG).
Termasuk integrasi peta WPP dasar: render `wpp_final.geojson` dengan Leaflet, load-once-cache sesuai `ARCHITECTURE.md` §9, dropdown+klik-peta sinkron dua arah di form input, choropleth gradasi intensitas + legenda sesuai `PRD.md` §8.1. Ini fase paling kompleks secara teknis — boleh diminta dipecah jadi sub-langkah sendiri olehmu kalau perlu (mis. 6a: form & data dulu, 6b: peta & choropleth), tapi tetap laporkan progres bertahap ke saya, jangan silent-run lama.

### Fase 7 — Modul Intelijen & Pemantauan
**Status**: Selesai (implementasi Intelijen & Pemantauan; verifikasi runtime oleh user, lihat CHANGELOG).
Termasuk halaman list/table Kawasan Konservasi (bukan peta, sesuai `PRD.md` §8.2). **Revisi (29 Sep 2026)**: modul kapal marabahaya dikoreksi — kapal marabahaya adalah **kapal eksternal** (mis. kapal perikanan kehabisan BBM di tengah laut), **bukan dropdown dari Master Kapal KKP**; entri kini memakai nama kapal teks bebas + jenis kapal + kondisi darurat + status (lihat CHANGELOG `[Revisi Pemantauan] — Kapal Marabahaya untuk Kapal Eksternal`).

### Fase 8 — Perbaikan Visualisasi (Charting & Komposisi Dashboard)
**Status**: Selesai (implementasi — Chart.js v4.4.1, `Script_Charts.html`, 5 endpoint `*_getTren`, zona chart di Tata Usaha/Operasi Laut/Udara/Intelijen/Pemantauan; verifikasi runtime oleh user, lihat CHANGELOG).
Integrasi charting & penerapan kriteria visualisasi — semua sesuai requirement `PRD.md` §10 dan `DESIGN.md` §6 Chart Style Guide (dokumen requirement ini sudah ditambahkan). Tujuan: membangun pola chart yang solid **sebelum** fase-fase modul berikutnya, supaya modul baru mulai dari Perawatan langsung chart-ready (sama seperti peran Fase 5 sebagai pola acuan modul divisi).
- Pilih **1 library charting ringan saja** yang mendukung seluruh tipe PRD §10/DESIGN §6 (bar/grouped, stacked, line/area, horizontal progress, donut ≤4) — konsisten dipakai di seluruh sistem, jangan campur beberapa library. Bungkus dalam wrapper `Script_Charts.html` (konsep sesuai `ARCHITECTURE.md`). Choropleth tetap memakai Leaflet (bukan library chart).
- Terapkan **ikhtisar-dulu (inverted pyramid)**: zona atas 3–6 kartu KPI + konteks, zona tengah 1–3 chart utama (tren/perbandingan/pencapaian), zona bawah tabel detail drill-down. Halaman wajib lulus **five-second rule** dan checklist `DESIGN.md` §6.6.
- **Varietas**: boleh memakai jenis chart sama berulang (konsistensi 1 library & 1 bahasa visual), tapi setiap halaman wajib ≥2 jenis representasi berbeda; hindari "dinding bar/line".
- **Warna**: hanya palet `DESIGN.md` §3, setiap warna bermakna & konsisten lintas halaman, bukan satu-satunya penanda data; anti-chartjunk (data-ink), bar mulai dari 0, direct-label didahulukan dari legenda.
- **Retrofitting dashboard modul yang sudah ada** (Tata Usaha, Operasi Laut/Udara, Intelijen, Pemantauan) dengan chart sesuai kriteria; Overview & Profil Kapal tetap placeholder menunggu dashboard lintas-divisi.
- Catatan: tidak mengubah skema data; gambar ulang juga valid — asal data yang disajikan identik dan kriteria §6.6 terpenuhi.

### Fase 9 — Modul Perawatan
**Status**: Selesai (implementasi — 3 sub-modul independen Kesiapan/Docking/Item Pekerjaan + `EvidenceService.js` generik dual-mode; verifikasi runtime oleh user, lihat CHANGELOG). Tambahan revisi Fase 9/10 (lampiran inline + opsi dinamis) — lihat CHANGELOG `[Revisi Fase 9/10 — Lampiran Inline Semua Modul + Opsi Daftar Dinamis]`.
Termasuk 3 sub-struktur (Kesiapan, Docking, Item Pekerjaan) dan sistem upload evidence per-item (`EvidenceService.js`, dual mode file/drive-link-copy, validasi ukuran, struktur folder sesuai `ARCHITECTURE.md` §6). Modul ini jadi acuan untuk fitur upload yang nanti dipakai modul lain.

### Fase 10 — Modul Logistik & Pengawakan
**Status**: Selesai (implementasi — 3 sub-modul Logistik Amunisi/BBM/Personil + 2 sub-modul Pengawakan Komposisi AKN/Kegiatan Personel; verifikasi runtime oleh user, lihat CHANGELOG). Juga basis revisi Fase 9/10 — lihat notasi Fase 9.
Termasuk validasi stok amunisi (`Stok Akhir = Stok Awal − Penggunaan`) dan validasi BBM.

### Fase 10.5 — Revisi UI Perantara: Sidebar Navy Tua
**Status**: Selesai (implementasi 22 Sep 2026 — sidebar navy tua; lihat CHANGELOG `[Fase 10.5 — Sidebar Navy Tua]`). **Follow-up yang sama-sama lunas** (juga 22 Sep 2026, CHANGELOG `[Revisi Palet — Aksen Dijadikan Navy Sidebar]`): aksen `--n-primary` = navy `#2B3674`, indikator nav aktif putih (bukan navy lagi). Spek final ada di `DESIGN.md` §5b & §3.

**Tujuan**: mengubah sidebar dari putih (`--n-surface-1`) menjadi **navy tua** agar beda dari kartu konten terang, menambah hierarki, serta memperkuat identitas maritim Nautika. TIDAK menambah hue baru — hanya memakai token yang sudah ada.

**Spek warna & state** (token yang dipakai semua sudah ada di `DESIGN.md` §3):
- **Background sidebar**: `--n-text-primary` navy `#2B3674` (bukan warna aksen baru — ini token netral lama yang dialih-fungsikan sebagai latar rel).
- **Brand "Nautika"**: teks putih `#FFFFFF` (berat 800 tetap).
- **Label section nav**: `rgba(255,255,255,0.45)`.
- **Item nav idle**: teks `rgba(255,255,255,0.78)`; **hover**: teks putih + `rgba(255,255,255,0.08)`.
- **Item nav aktif**: flat full-width — background `rgba(255,255,255,0.12)` + teks putih + indikator kiri solid **putih** (3px); berat 600 (BUKAN pill — user menolak pill di revisi 22 Sep 2026; indikator bukan navy karena `--n-primary` kini = warna rel, tak terlihat).
- **Footer**: nama user putih, role `rgba(255,255,255,0.6)`, tombol Keluar `rgba(255,255,255,0.10)` border + teks putih, hover `rgba(255,255,255,0.08)`.
- **Garis pemisah**: `rgba(255,255,255,0.10)`; scrollbar mengikuti.
- **Dilarang** (cekal `DESIGN.md` §1): tanpa gradient, tanpa shadow tambahan (tetap 1 level elevasi kartu), tanpa ikon berwarna/emoji di nav, tanpa badge warna-warni — aksen aktif di rel = putih.

**Kontras**: navy `#2B3674` vs teks putih ≈ rasio tinggi (≥ 9:1) → lolos aksesibilitas.

**Cakupan file**: `html/Style.html` (`.sidebar`, `.sb-brand`, `.sb-nav`, `.nav-item` idle/hover/active, `.sb-section-label`, `.sb-footer`, `.sb-user-name`, `.sb-user-role`, `.btn-logout`); cek ulang komponen lain yang meniru `.n-surface-1` untuk memastikan hanya rel yang berubah. Spek ini sudah disalin ke `DESIGN.md` §5b saat implementasi.

**Verifikasi after implement**: buka tiap modul → nav idle/hover/active benar, brand & footer terbaca, tidak ada warna di luar palet `DESIGN.md` §3, tidak ada gradient/shadow baru. Tambah entri CHANGELOG.

### Fase 11 — Kegiatan Direktorat & Riwayat Laporan
**Status**: **Selesai** — 11a (Modul Kegiatan Direktorat) selesai 22 Sep 2026 (CHANGELOG `[Fase 11a — Modul Kegiatan Direktorat]`); **11b (Halaman Riwayat Laporan) selesai 22 Sep 2026** (CHANGELOG `[Fase 11b — Halaman Riwayat Laporan]`); **backlog B (combobox typeahead input referensi) dikerjakan 22 Sep 2026 lalu DIBATALKAN 28 Sep 2026** — diganti: enum Jenis → `<select>` `Opsi`, relasi Kapal → dropdown+cari (`_kdl*`); detail di CHANGELOG `[Fase 12 — QA Lintas Modul]` entri "Input Jenis Kembali ke Dropdown". **Koreksi 30 Sep 2026**: status lama masih berbunyi "Sedang Berjalan" dan menyebut konfirmasi sebelum lanjut ke Fase 11.5 — tidak lagi berlaku, karena 11.5 sudah Selesai 22 Sep dan Fase 12/13 juga sudah lewat.

**Fase 11a — Modul Kegiatan Direktorat (22 Sep 2026, PRD §5.10)**: feed kronologis kegiatan lintas-direktorat (pre-award meeting, monitoring ABT, serah terima, dst). CRUD Direktur + semua Kadiv, **Staf tidak punya akses** (RBAC server `[SUPERADMIN, DIREKTUR, KADIV]`, lintas divisi). Form input memakai **pola popup** (mulai menerapkan backlog A untuk modul baru). Field per `DATA_SCHEMA.md`: JudulKegiatan, Tanggal, Deskripsi, PihakHadir (opsional), multi-lampiran. Periode diturunkan dari Tanggal kegiatan (`dateToPeriode`) — filter global (bulanan/rentang) menyaring kolom Tanggal. Feed menampilkan seluruh status (ACTIVE/SUPERSEDED/VOID) dengan komentar anulir inline (PRD §7.4—7.5).

**Fase 11b — Halaman Riwayat Laporan (22 Sep 2026, PRD §7.5)**: `services/RiwayatService.js` menagregasi seluruh sheet TX_* menjadi satu feed kronologis (urut Timestamp menurun) yang mencakup ACTIVE, SUPERSEDED, dan VOID, dengan status jelas + "siapa melakukan apa" + komentar anulir inline, serta ringkasan 1 baris dan detail siap-tampil per baris (klien tidak perlu tahu skema tiap sheet). **RBAC**: semua akun APPROVED bisa membuka halaman; SUPERADMIN/DIREKTUR melihat seluruh entri lintas divisi; KADIV → divisi sendiri + seluruh TX_KegiatanDirektorat (modul lintas-divisi yang memang bisa ia CRUD); STAF → divisi sendiri (tanpa modul Kegiatan). **Filter global (bulanan/rentang) kini aktif di halaman** (sebelumnya `noFilter` mengecualikan riwayat) — memfilter kolom Timestamp. UI: KPI strip (Total entri / Modul / Aktif / Ditimpa / Dianulir) + **tab status** (Semua/Aktif/Ditimpa/Dianulir dengan hitung) + tabel lintas-modul (Periode · Modul · Ringkasan · Divisi · Dikirim oleh+waktu · Status · Aksi"Lihat") + baris komentar anulir inline untuk VOID; tombol "Lihat" membuka modal detail + lampiran (`_hdOpen` + `evidence_list`). Perbaikan bug terkait: `_kgdDivisiMap` (Kegiatan) baca kolom `Nama` yang tidak ada → diganti `NamaDashboard`/`NamaResmi`.

Modul lintas-divisi (CRUD Direktur+semua Kadiv, multi-lampiran) dan halaman Riwayat Laporan (semua submission lintas modul, status ACTIVE/SUPERSEDED/VOID, lampiran, filter).

> Catatan revisi lintas-modul (22 Sep 2026): tombol **"Lihat"** detail per baris di semua tabel riwayat modul Fase 5–10 (field + status + lampiran) sudah diterapkan sebagai revisi, bukan bagian dari fase ini. Rincian: CHANGELOG `[Revisi Lintas Modul — Tombol "Lihat" Detail di Semua Riwayat]`. Status fase tidak berubah.
>
> Catatan backlog yang **dijadwalkan di fase ini**: poin **B** — combobox typeahead pada input referensi Jenis/Kategori (lihat blok "Revisi UI — Backlog Disetujui User" di atas). **Kemudian DIBATALKAN 28 Sep 2026** (dikembalikan ke dropdown; lihat catatan revisi di blok **Fase 12**).

### Fase 11.5 — Konversi Form Divisi ke Popup (Backlog A)
**Status**: **Selesai 22 Sep 2026** (implementasi; deploy/push oleh user) — CHANGELOG `[Fase 11.5 — Konversi Form Divisi ke Popup (Backlog A)]`. **Catatan koreksi**: jumlah form adalah **13** (TU, Ops Laut, Ops Udara, Intelijen, Pemantauan, Perawatan ×3, Logistik ×3, Pengawakan ×2), bukan 12 sebagaimana tercantum di dokumen ini (lihat line 45 & 140) — sudah dikoreksi di sini.

Konversi **semua 13 form input modul Fase 5–10** dari inline-expand menjadi **popup modal** — terapkan persis spek backlog A di atas:
- Form terdampak (13): Tata Usaha, Operasi Laut, Operasi Udara, Intelijen, Pemantauan, Perawatan ×3 (Kesiapan/Docking/Item), Logistik ×3 (Amunisi/BBM/Personil), Pengawakan ×2 (AKN/Kegiatan).
- **Data konteks di dalam modal**: tampilkan hanya data penting yang dibutuhkan saat mengisi, bukan seluruh dashboard — mis. TU → Pagu periode berjalan; Logistik → stok akhir terkini. Prinsip: *hanya data yang penting*.
- **Teknis wajib di-handle** (bagian A): (1) pola modal menyalin induk `modal-hd` (overlay + `.n-modal` + area scroll); (2) **Leaflet** — peta WPP form Operasi Laut/Udara perlu `map.invalidateSize()` setelah modal terbuka; (3) blok lampiran inline (`_attachInit` dst.) ikut dipindah ke dalam modal; (4) tombol isi form + state expand terkait dihapus/diganti buka modal.
- **Verifikasi**: tiap modul buka form → modal tampil, isi + lampiran + simpan normal, halaman utama (KPI/chart/riwayat) tidak berubah tata letaknya saat modal terbuka.

### Fase 12 — Executive Overview & Profil Kapal
Dashboard ringkas lintas-divisi (agregasi cross-sheet), dan halaman Profil Kapal (gabungan histori 1 kapal dari Perawatan/Operasi/Logistik).

> **Progres (28 Sep 2026, implementasi + polish selesai; hotfix #2 terpasang, menunggu verifikasi runtime)**: kolom `KapalID` **opsional/nullable** ditambahkan ke `TX_OperasiLaut`/`TX_OperasiUdara`/`TX_Logistik_Amunisi`/`TX_Logistik_BBM` (+self-heal `ensureKapalColumns`, `DATA_SCHEMA.md`); `services/DashboardService.js` baru — `dashboard_getOverview` + `dashboard_profilKapal` (read-only APPROVED, cache 300s, agregasi langsung dari sheets); Overview terhubung (KPI + 9 kartu divisi + chart realisasi & hari operasi); auto-reload global saat filter berubah; halaman Profil Kapal (rute `profil-kapal`, tombol "Profil" di Master Data). **Polish empty-state Ikhtisar**: KPI row & grid divisi menampilkan pesan informatif via `.chart-empty` (token existing, tanpa warna/class baru). **Hotfix "Ikhtisar diam-diam terkunci" (22 Sep)**: `APP_OV.key` tidak lagi di-set sebelum respons server, error tidak lagi ditelan (`_ovLoadError` + tombol "Coba lagi"). **Hotfix #2 (28 Sep) — akar masalah sebenarnya dari "Ikhtisar placeholder"**: `ReferenceError: canApprove is not defined` di `_renderOverview()` (`Script_Main.html:621` memanggil variabel yang tidak pernah dideklarasikan; yang benar `isApprover`) — exception terjadi setelah `el.innerHTML` sehingga placeholder tampil, tetapi menghentikan baris `APP_OV.key = null; _ovLoadData();` → `dashboard_getOverview` tidak pernah dipanggil. Diperbaiki 1 baris; diagnosis `APP_OV.key` pada hotfix sebelumnya dinyatakan **tidak tepat** (dipertahankan sebagai hardening defensif). Status: kode siap deploy, **menunggu verifikasi runtime GAS oleh user**. Lanjut Fase 13 **setelah** konfirmasi user.

> **Revisi (28 Sep 2026, atas permintaan user — perbaikan atas pekerjaan Fase 10/12 yang sudah berjalan, bukan fase baru)**: bug "revisi gagal: `Jenis Amunisi tidak valid`" pada Logistik (Amunisi/BBM/Personil) & Pengawakan AKN — akar masalah: field dropdown revisi `disabled` sehingga nilai lama tidak terkirim, tanpa fallback server. Bug lebih serius: `pemantauan_revisi`/`intelijen_revisi` menandai baris lama `SUPERSEDED` **sebelum** validasi selesai → data hilang saat revisi gagal. Keduanya diperbaiki. Sheet `Opsi` ditetapkan sebagai **sumber tunggal seluruh enum domain**: kolom baru `LabelTampil` (perubahan skema, disetujui user), 10 grup / 36 token (2 grup baru ditemukan saat audit: `HasilRiksa_Kategori` & `HariOperasi_Kategori` yang tadinya tanpa validasi server), seluruh fallback hardcoded dihapus (termasuk kontrak KPI AKN yang sebelumnya mengasumsikan scope `KESELURUHAN`/`POA`). Tidak ada hard delete baru — "hapus" tetap anulir sesuai `ARCHITECTURE.md` §5. Detail & hasil verifikasi: `CHANGELOG.md` `[Fase 12 — QA Lintas Modul]`. **Catatan**: `setupSeedOpsi()` wajib dijalankan user satu kali setelah push.

> **Revisi (28 Sep 2026, atas permintaan user — penyempurnaan UX selektor, bukan fase baru)**: combobox typeahead **Backlog B dibatalkan** — user menilai tampilannya "aneh" (terlihat seperti kotak ketik, bukan dropdown). Seluruh 8 field selektor "jenis" kembali ke model dropdown: 4 field enum (`Logistik` `lga-jenis`/`lgb-jenis`/`lgp-komponen`, `Pengawakan` `akn-kategori`) → `<select>` biasa diisi runtime dari `Opsi` (`_fillOpsiSelect`, pola sama dgn Perawatan/OperasiLaut); 4 field Kapal (`ops-kapal`, `oud-kapal`, `lga-kapal`, `lgb-kapal`) → komponen **search dropdown `_kdl*`** yang tampil sebagai dropdown (readonly + chevron), panel berisi kotak cari + daftar, dan tombol hapus (×) yang me-reset filter penuh. Token tetap tersimpan di hidden id lama sehingga pembacaan submit (`_v(id)`) dan validasi server **tidak berubah**. Seluruh komponen typeahead `_ta*` dihapus (dokumen ini mencatat Backlog B sebagai rejected-approach). Detail & verifikasi: CHANGELOG `[Fase 12 — QA Lintas Modul]` entri "Input Jenis Kembali ke Dropdown".

> **Revisi (29 Sep 2026, atas permintaan user — penyempurnaan input 3 modul, bukan fase baru)**: field **jumlah** pada laporan mingguan **Operasi Laut, Operasi Udara, Intelijen** diubah dari angka agregat menjadi **daftar rincian per-item**, jumlah dihitung sistem: kapal ditangkap (KII/KIA + nama item + asal negara), rumpon ditertibkan (nama + WPP + lokasi), objek teridentifikasi udara (KII/KIA/Objek SDK), dan kejadian intelijen (5 jenis non-kawasan + deskripsi). Data disimpan di **3 sheet detail baru** `TX_OperasiLaut_Detail`/`TX_OperasiUdara_Detail`/`TX_Intelijen_Detail` (versioning per-item, anuliran valid, di-*attach* ulang ke baris transaksi untuk modal detail & revisi): `utils/DetailService.js` + `_detailWriteChildren/_detailCleanItems/_detailValidateItemized/_detailAttach`; client memakai komponen **`_nList`** (baris dinamis select/teks/hidden) + caption rekap `_nDeriveSet`; kawasan konservasi Intelijen tetap input manual per-kawasan. Detail & verifikasi: CHANGELOG `[Fase 12/13 — Itemisasi] — Jumlah diubah menjadi Daftar Per-Item`. **Catatan doc-drift**: `DATA_SCHEMA.md`/`ARCHITECTURE.md` belum memuat sheet detail & `DetailService` (menunggu konfirmasi user sebelum update dokumen skema). **→ Resolved 29 Sep 2026**: atas izin user, `ARCHITECTURE.md` §3.2/§4/§5/§7 sudah memuat 3 sheet `TX_*_Detail`, relasi `ParentRowID`, versioning child ikut header, dan `utils/DetailService.js`; `DATA_SCHEMA.md` sudah memuat ketiga sheet sejak implementasi. Lihat CHANGELOG `[Dokumentasi] — Sheet Detail & DetailService ditautkan di ARCHITECTURE.md`.
>
> **Revisi (29 Sep 2026, atas permintaan user — penyamaan alignment form lintas modul, bukan fase baru)**: pada baris form berkolom ganda, kotak input disejajarkan horizontal secara global (13 form divisi + modal revisi + Master Data). Akar masalah: posisi vertikal kotak input mengikuti tinggi label; label yang membungkus 1 vs 2 baris (atau satu kolom memakai catatan `*-periode-hint` di bawah kontrol) membuat kotak input antar kolom tidak rata. Solusi CSS global (tanpa ubah JS): `.form-grp` (sel grid tiap kolom) menjadi kolom flex ber-anchor-bawah (`justify-content:flex-end`) + band `padding-bottom`; catatan pendek di bawah kontrol diposisikan absolut lewat kelas baru **`.n-form-hint`**. Detail & verifikasi: CHANGELOG `[Revisi Lintas Modul] — Selaraskan Kotak Input Form`. Status fase 12/13/14 tidak berubah; verifikasi runtime oleh user.
>
> **Revisi (29 Sep 2026, atas permintaan user — rekap hitung-otomatis tidak lagi tampil sebagai field, bukan fase baru)**: 10 baris rekap jumlah yang dihitung sistem dari daftar per-item (Operasi Laut: KII/KIA/rumpon; Operasi Udara: KII/KIA/Objek SDK; Intelijen: 5 jenis kejadian) diubah dari kotak ber-border (terlihat seperti input) menjadi **readout angka tanpa kotak** (`--n-primary` tebal), dan teks "(dari daftar)" pada label dihapus (kelas `.derived-note` dihapus). Sel tetap memakai `.form-grp` agar sejajar-bawah dengan input di baris yang sama. Detail: CHANGELOG `[Revisi Lintas Modul] — Rekap "Dihitung Otomatis" Tidak Lagi Berbentuk Field`. Status fase 12/13/14 tidak berubah; verifikasi runtime oleh user.
>
> **Revisi (29 Sep 2026, atas permintaan user — visualisasi Ringkasan Ikhtisar, bukan fase baru)**: angka pada Overview diberi visual pendukung yang **lebih kaya** (arah awal minimalis diganti karena ditolak user: "terlalu boring dan tidak membantu"). Baris KPI kini memakai mini-chart: SP2D gauge cincin %; Hari Operasi panah tren vs bulan sebelumnya (mode bulanan, netral) + strip mini-bar 6 bulan; Armada Siap donut (lewat irisan Siap/Tidak Siap, angka di tengah); Divisi Melapor 7 titik status per divisi (`_dashMelaporDetail`, tooltip melapor/belum). Seksi baru **"Status & Penindakan"**: donut 4 irisan Ditangkap/Dipantau × KII/KIA + legenda, dan bar **Kapal Pengawas Teraktif** (top 5). Kartu divisi: Perawatan stacked Siap/Tidak Siap; Logistik bar stok per jenis (top 5, `StokAwal - usage` YTD); Operasi `/180` + stacked KII/KIA; Pengawakan stacked komposisi AKN. Palet hanya token tema (donut ≤4 irisan, angka & legenda jalan bersama). Payload `ring`/`spark`/`minibars`/`donut`/`dots`/`bars`/`stack`/`trend`; helper `_ovRing/_ovSpark/_ovMiniBars/_ovDonut/_ovDots/_ovBars/_ovPlotDonut/_ovSegTotal`; `.kpi-card` → flex dua kolom (`kpi-main`+`kpi-vis`). Intelijen/Pemantauan/Kegiatan/TU tetap teks bersih. Detail & verifikasi: CHANGELOG `[Revisi Dashboard] — Visualisasi Ringkasan Ikhtisar, Richer (Fase 12)`. Status fase tidak berubah; verifikasi runtime oleh user (setelah `clasp push`).
>
> **Revisi-lanjutan (29 Sep 2026 — "isi ruang kosong di kartu")**: user menolak area kosong di dalam kartu. Grid divisi kini penuh 3×3 (kartu ke-9 **"Cakupan Laporan"**: `/7` prog + `dots` status 7 divisi + periode aktif); tiap kartu divisi jadi flex column dengan **footer visual** yang mengisi sisa tinggi (`_ovCardFoot`: dots → stack AKN → bars stok Logistik → gabungan stack KII/KIA → komparasi relatif metrik numerik → catatan bila data belum lengkap); metrik pertama diperbesar (hero 1.4rem), teks nilai naik 1.02rem, `grid-auto-rows:1fr` + `margin-top:auto` menghapus ruang kosong. Profil Kapal memakai `_divCard(..., { hero:false, foot:false })` → tampilannya tidak berubah. Detail & verifikasi: CHANGELOG `[Revisi Dashboard] — Isi Ruang Kosong di Kartu Ringkasan (Fase 12)`.
>
> **Revisi-lanjutan (29 Sep 2026 — "pagu kosong = nilai lama + tidak bisa diedit langsung")**: form laporan mingguan Tata Usaha kini **mengunci & menprefill field Pagu** dari laporan ACTIVE terakhir (sumber `_TU.kpi`), sehingga mengirim tanpa menyentuh pagu tidak lagi terhempas notif "Pagu berbeda — wajib Catatan Revisi Pagu" (sebelumnya client mengirim field kosong jadi `0`). Perubahan hanya lewat tombol **"Ubah Pagu"** (memunculkan & mewajibkan Catatan Revisi Pagu) + **"Batalkan"** (mengembalikan snapshot, menutup catatan). Bar status `.tu-pagu-bar` (varian amber saat dibuka), field readonly diberi `cursor:not-allowed`. Server-side check hard tidak diubah — tetap otoritas final. Detail & verifikasi: CHANGELOG `[Revisi Form Tata Usaha] — Prefill & Kunci Pagu + Tombol "Ubah Pagu" (Fase 12 lanjutan)`.
>
> **Revisi-lanjutan (29 Sep 2026 — "Ikhtisar tidak berubah setelah anulir")**: kartu Ringkasan per Divisi di Ikhtisar tetap menampilkan nilai lama (mis. 240%) hingga ±5 menit setelah anulir/submit/revisi. Akar masalah: `dashboard_getOverview` (dan `dashboard_profilKapal`) memakai **CacheService TTL 300s per user**, sehingga agregat stale. Perbaikan: penanda versi data transaksi `DASH_TX_VERSION` di CacheService yang dinaikkan otomatis oleh **setiap** `appendRowData()`/`updateRowCells()` di `data/SheetAccess.js` (`bumpTxVersion()`), dan dimasukkan ke cache key agregat (`_dashVersion()` di DashboardService). Setelah ada tulis → versi naik → key berubah → agregat dihitung ulang dari sheet. Berlaku untuk semua modul, bukan hanya TU. Detail & verifikasi: CHANGELOG `[Perbaikan] — Ikhtisar Tidak Stale Setelah Submit/Revisi/Anulir (Fase 12 lanjutan)`.

### Fase 13 — Notifikasi, Audit Log, Admin Panel
`Notifications` (approval request, data voided, reminder mingguan), halaman Audit Log (Superadmin), Admin Panel (kelola user, kelola master data lanjutan).

> **Status (30 Sep 2026): Selesai (implementasi selesai, bug serialisasi JSON telah diperbaiki dan diverifikasi oleh user).**
> - `services/NotifikasiService.js` (baru): daftar notifikasi + tandai dibaca, ringkasan shell (badge unread + status "divisi belum melapor"), reminder mingguan untuk `KADIV`/`STAF` `APPROVED` di divisi yang belum melapor (baris `REMINDER_MINGGUAN` + email `MailApp`), installable time trigger **Jumat 16:00** (nyala/mati + tombol "Kirim Sekarang"), semuanya hanya `SUPERADMIN` untuk trigger/kirim manual.
> - `services/AdminService.js` (baru): `admin_getUsers` / `admin_updateUser` (role, unit kerja, status termasuk `NONAKTIF`) / `admin_resetPassword` / `admin_getAuditLog` — `SUPERADMIN` only, `withLock` + `_auditLog`, anti-self-edit, anti-lockout Superadmin terakhir, hash password, dan **pencabutan sesi** user yang diubah.
> - `services/AuthService.js`: `NONAKTIF` memblokir login & registrasi ulang; marker `revoked_<UserID>` (TTL 12 jam)Dicabut oleh `_requireSession` sehingga setiap perubahan akun/reset password memaksa login ulang.
> - UI: halaman **Notifikasi** (rute `notifikasi`), **Admin Panel** (tab Persetujuan / Pengguna / Audit Log / Pengingat Mingguan), badge unread di sidebar, strip shell "Divisi Anda belum melapor untuk minggu ini", modal kelola akun. Menu "Admin Panel" tetap terlihat untuk `DIREKTUR` (menggunakan tab Persetujuan) agar alur approval yang sudah ada tidak terputus; tab & endpoint lain `SUPERADMIN` only.
> - Perbaikan model data yang menyertainya: KPI "Divisi Melapor" kini **7 divisi** (Operasi = 1 entri Laut+Udara, Pengawakan masuk) sesuai `PRD.md` §4; baris dihitung per `DivisiID`.
> - Verifikasi statis: `node --check` seluruh file + script client, 94 endpoint client terpetakan, `selftest.js` 33 uji → `ALL RENDER LOGIC OK`. Detail & keputusan desain: `CHANGELOG.md` `[Fase 13] — Notifikasi, Reminder Mingguan, Audit Log, & Admin Panel`.
> - Catatan: "kelola master data lanjutan" **tidak** menambah sheet/kolom baru —sheet `Opsi` (enum domain) + Kapal/WPP/Kawasan yang sudah ada di `MasterDataService` sudah memenuhi kebutuhan; tidak ada perubahan skema selain enum `Users.Status` += `NONAKTIF`.

### Perubahan Lintas Fase — Verifikasi OTP Email + NIP (disetujui user, 30 Sep 2026)

Ini **bukan** dimulainya Fase 14 dan bukan pengganti Fase 14. Ini perubahan yang diminta user di tengah pengerjaan Fase 13; karena menyentuh `PRD.md` §3.1, `DATA_SCHEMA.md` §`Users`, dan `ARCHITECTURE.md` §11, ketiganya sudah disinkronkan di entri yang sama.

- **Pemicu**: (1) bug email reminder — `appsscript.json` tidak punya scope `script.send_mail`, dan kegagalan `MailApp` hanya masuk `Logger` sehingga UI menampilkan "terkirim" padahal 0; (2) permintaan user: registrasi wajib verifikasi email via OTP.
- **Keputusan user**: `NIP` adalah **additional requirement** — Email tetap identitas login utama, NIP field wajib terpisah yang juga unik.
- **Keputusan teknis**: akun tidak dibuat sebelum OTP terbukti (tiga endpoint: `auth_requestOtp` → `auth_verifyOtp` → `auth_register`); kode OTP & `pendingToken` di `CacheService` dengan TTL, bukan sheet; `pendingToken` terikat ke email dan sekali pakai.
- **Perubahan skema**: kolom baru `Users.NIP` (wajib & unik, disimpan digit saja). Spreadsheet lama tidak diurutkan ulang — `ensureUsersNipColumn()` menambahkan di ujung bila belum ada; akun lama = NIP kosong, nilainya tidak ditebak.
- **Status**: implementasi selesai & terverifikasi lokal (`verify.sh` OK, `selftest.js` 59 pass). Menunggu `clasp push` + re-otorisasi oleh user.
- Detail & cara verifikasi: `CHANGELOG.md` `[Fitur] — Registrasi Wajib Verifikasi OTP Email + NIP, dan Email Reminder yang Tidak lagi Diam-diam Gagal`.

### Perubahan Lintas Fase — Bentuk Tabel Riwayat Seragam di Semua Modul (disetujui user, 30 Sep 2026)

Ini **bukan** dimulainya Fase 14. Ini permintaan user di tengah masa jeda antar-fase; karena menyentuh tabel riwayat 9 modul divisi (Fase 5–10) + Kegiatan (11a) + halaman Riwayat Laporan (11b), dicatat sebagai revisi lintas fase seperti blok OTP + NIP di atas.

- **Permintaan user**: seragamkan semua tabel riwayat divisi — bentuk kolom, badge status, dan baris aksi `Lihat`/`Revisi`/`Anulir`; tidak ada lagi tombol **Lampiran** terpisah di baris riwayat, lampiran lewat `Lihat`.
- **Keputusan teknis**: satu renderer tabel riwayat bersama (`_histRender`) di `html/Script_Main.html`, dipakai 14 tabel riwayat divisi + halaman Riwayat Laporan — menggantikan 15 fungsi render bespoke. Bentuk kanonik `Periode | …kolom modul… | Dikirim | Status | Aksi`; void note inline di semua modul (sebelumnya hanya di Riwayat Laporan); badge status pindah dari hex inline ke kelas token. Normalisasi key Gen-1 (`RowID`/`Status`/`Periode`/`Timestamp`) terjadi di sisi client — **tidak ada perubahan skema sheet maupun kontrak endpoint**.
- **Catatan lampiran**: tombol `Kelola` hanya untuk Perawatan, di dalam modal `Lihat`, agar kemampuan menambah lampiran setelah laporan terkirim tidak hilang. Modul lain tetap read-only sesuai `PRD.md` §11. Endpoint `evidence_listBatch` kehilangan pemanggil dan ikut dihapus.
- **Di luar cakupan, sengaja**: halaman Riwayat Laporan tetap aksi **Lihat** saja (revisi/anulir harus diarahkan ke modal modul asal), dan mini-table **Profil Kapal** tetap read-only — keduanya bukan tabel riwayat modul.
- **Status**: implementasi selesai & terverifikasi lokal (`verify.sh` OK, `selftest.js` 59 pass, `nulltest.js` 10/10). Menunggu `clasp push` + verifikasi runtime oleh user.
- Detail & daftar file: `CHANGELOG.md` `[Revisi Lintas Modul] — Bentuk Tabel Riwayat Seragam (Lihat/Revisi/Anulir) & Tombol Lampiran Dihapus dari Baris`.

### Fase 14 — QA & Polish
Penyempurnaan visual, audit UI terhadap negative prompt desain, perbaikan inkonsistensi geometris/layout, dan stabilisasi alur auth/approval.

> **Status (12 Okt 2026): Selesai.** Seluruh item perbaikan telah tuntas & diverifikasi: Item 1 (konsistensi dropdown periode semua form), Item 2 (ikon aksi tombol mikro), Item 3 (audit geometri list + RBAC Revisi), Item 4 (tombol ikon-saja + audit ikon site-wide), Item 5 (popup berhasil submit + loading terlihat), Item 6 (kapal pengawas wajib di Operasi Laut/Udara + enum JenisKapal di Master), Perbaikan Peta WPPNRI (loader terkoordinasi), Perbaikan Pagu TU (penghitung jumlah revisi pagu), Peta Sebaran WPP di Ikhtisar (choropleth + panel ranking), Penyelarasan Visualisasi Ikhtisar (multi-span 6 kolom dinamis tanpa gauge), serta Perbaikan Auto-Detection Persetujuan Akun Pendaftar (serialisasi Date GAS & hak veto Superadmin).
> 
> **Catatan Pemindahan Audit (Instruksi User, 12 Okt 2026)**: Audit Definition of Done (DoD) per modul ([`AGENTS.md` §6](file:///home/pinefeast/Projects/nautika/AGENTS.md#L60-L75)) **dipindahkan ke tahap akhir proyek di luar penomoran fase**. Audit tidak lagi berada di dalam Fase 14 dan tidak memblokir perjalanan fase berikutnya; audit hanya akan dieksekusi ketika seluruh fase selesai dan user meminta *"lanjut"* saat tidak ada fase tersisa.

#### Fase 14 — Peta Sebaran WPP di Ikhtisar + Kartu Divisi Tanpa Whitespace

- **Permintaan user (1 Oktober 2026)**: "tambahin peta di paling atas ikhtisarnya dong, yang lebih informatif" + "yang cards nya kok ruang kosongnya banyak, rapikan dong. intinya jangan ada ruang kosong yang ga ada isinya".
- **Keputusan user** (dipilih dari opsi yang vorgelegt): **choropleth dengan pengalih metrik** (bukan satu metrik hardcode), **hero full-width dengan panel ranking di bawahnya**. Peta diposisikan di bawah `KPI Utama` — angka utama direktorat tetap di paling atas agar "_condition" terbaca satu sapuan, peta menyusul sebagai dimensi "di mana".
- **Metrik** (server, `DashboardService._dashWppMap()`): Aktivitas (`KII_Ditangkap + KIA_Ditangkap + RumponDitertibkan` dari Laut, plus `KII + KIA` dari Udara) sebagai default; lalu toggle KII / KIA / Rumpon / Cakupan (`CakupanWilayah_NM2` dari Udara). Semua YTD sampai bulan terpilih, jadi konsisten dengan KPI di halaman yang sama.
- **Koreksi data yang ditemukan saat implementasi**: `CakupanWilayah_NM2` berada di `TX_OperasiUdara`, **bukan** `TX_Pemantauan` seperti Perkiraan awal. `TX_Pemantauan` memang tidak punya `WPPCode` sama sekali — jadi Pemantauan sengaja tidak dipetakan (bukan kelalaian), dicatat di `DATA_SCHEMA.md` + `PRD.md` §8.3. Kalau nanti Pemantauan perlu dipetakan, itu perubahan skema (`AGENTS.md` §4), bukan penyesuaian tampilan.
- **Panel ranking**: Top 5 WPP untuk metrik aktif, disinkronkan dengan peta — hover menyorot WPP, klik memfokuskan kamera. Tetap read-only, tidak menautkan ke form/navigasi.
- **Perbaikan whitespace kartu**: `.div-grid` tidak lagi memakai `grid-auto-rows: 1fr` (yang memaksa 9 kartu satu baris setinggi kartu terpanjang). Diganti `align-items: start` + **`#ov-div-grid` dapat breakpoint** (3→2→1 kolom). Diverifikasi bahwa `grid-auto-rows` tidak dipakai selector lain di `Style.html`, jadi menghapusnya tidak berefek ke halaman mana pun. Breakpoint-nya sengaja hanya untuk `#ov-div-grid` — `#pk-kpi` (Profil Kapal) memakai `.div-grid` yang sama dan dibiarkan apa adanya agar tata letak yang sudah diverifikasi tidak ikut berubah.
  - Terukur lewat probe geometri Chrome: sebelum 8/9 kartu punya lubang total 684px (terparah 150px), grid 953px; sesudah **0 lubang**, grid 795px.
- **Dua bug nyata yang ketahuan saat verifikasi** (keduanya sudah diperbaiki + ada regression test-nya):
  1. **Skala peta**: 4 ambang untuk 4 warna ramp membuat nilai tertinggi jatuh ke `_OV_MAP_RAMP[4]` yang tidak ada → satu WPP terwarnai `undefined` dan hilang dari legenda.
  2. **Urutan CSS**: breakpoint `#ov-map`/`.ov-map-rank-list` ditulis **sebelum** aturan dasarnya, dan specificity-nya sama → aturan dasar yang belakangan menang, jadi **breakpoint mati diam-diam** (peta tetap 420px di 768px, ranking tetap 5 kolom). Media query dipindah ke akhir file.
- **Verifikasi**: `verify.sh` OK (95 endpoint), `selftest.js` **130 pass / 0 fail** (bertambah **16** regression test: agregasi & trim `WPPCode`, baris tanpa WPP, input null, skala & batas ramp, legenda semua metrik, satuan metrik, urutan markup, pemakaian cache geometri bersama, status + retry, teardown, kontrak kunci metrik client↔server, guard `_ovMapPaint`, urutan media query, anti-`grid-auto-rows`, breakpoint `#ov-div-grid`), `nulltest.js` 12/12, `node --check` client & server bersih, `git diff --check` bersih. Probe geometri: 0 lubang di 1440/768/600px, peta 420/340/280px, ranking 5/3/2 kolom, tanpa overflow horizontal.
#### Fase 14 — Perbaikan: Peta Ikhtisar Grey Box / Hilang Sebelum Masuk Modul Lain

- **Permintaan user (7 Oktober 2026)**: "Peta di ikhtisar sering hilang, seringkali perlu ke menu lain baru kembali ke ikhtisar agar muncul, leafletnya ya yangga muncul entirely, grey box".
- **Akar masalah**:
  1. `_ovMapInit()` mengasumsikan Leaflet (`L`) sudah ada di `window.L`. Pada pembukaan awal atau refresh aplikasi, view mendarat di Ikhtisar sebelum modul Operasi pernah dibuka. Karena loader on-demand Leaflet (`_loadLeaflet`) sebelumnya hanya ada di modul Operasi, `_ovMapInit()` menemukan `typeof L === 'undefined'` lalu langsung `return` diam-diam. Akibatnya container `#ov-map` tetap menjadi kotak abu-abu (grey box) kosong. Begitu user mengunjungi modul Operasi lalu kembali ke Ikhtisar, barulah Leaflet terunduh dan peta bisa muncul.
  2. Template markup `#ov-map` di `_renderOverview` tidak membawa spinner loading awal, sehingga saat GAS RPC `dashboard_getOverview()` berlangsung (1–2s), peta tampak mati/kosong.
- **Solusi & Perubahan**:
  1. Loader on-demand `_loadLeaflet` dijadikan utilitas geospasial bersama (shared) di atas `_OV_MAP` dengan antrean callback hoist-safe dan idempoten.
  2. `_ovMapInit()` membungkus pembuatan map di dalam callback `_loadLeaflet(function() { ... })` sehingga jika Leaflet belum siap, inisialisasi menunggu hingga CDN terunduh.
  3. `_renderOverview(el)` langsung memicu `_loadLeaflet()` secara paralel dengan request data server agar script Leaflet sudah selesai diunduh saat respons tiba.
  4. Template HTML `#ov-map` diberi initial status spinner overlay ("Memuat peta WPP…").
  5. `#ov-map` di `Style.html` diberi `position: relative;` dan ditambahkan listener `window.addEventListener('resize')` untuk `invalidateSize()`.
- **Verifikasi**: `verify.sh` OK (95 endpoint), `nulltest.js` 12/12 pass, `selftest.js` **140 pass / 0 fail** (+1 regression test Leaflet loader di Ikhtisar), `node --check` client & server bersih.
- **Status**: selesai & terverifikasi lokal. Menunggu `clasp push` + verifikasi visual runtime oleh user.
- Detail: `CHANGELOG.md` `[Fase 14 — Perbaikan] — Peta Ikhtisar Grey Box / Tidak Muncul Sebelum Buka Modul Lain`.

#### Fase 14 — Visualisasi Dinamis & Grid Sejajar Ikhtisar (Multi-Span 6 Kolom, Non-Monoton Tanpa Gauge)

- **Permintaan user (7 Oktober 2026)**:
  1. "Buat visualisasi pada ikhtisar lebih menarik, lebih sejajar, lebih sesuai, dan lebih ter highlight..." + penengahan widget Status & Penindakan (Komposisi Penindakan).
  2. "Tidak sejajar ini, dan saya mau ditambahkan visualisasinya, tidak hanya progress bar semua, dibuat variatif tapi tetap relevan dengan apa yang ditampilkan, jangan pakai gauge tapi tetap explore untuk visualisasi, banyak yang bisa dikembangkan. dan ingat, semua kalau emang bentuk card harus sejajar, saya juga tidak mau masing-masing satu, mungkin ada yang memakan 2 grid card gitu jadi menyesuaikan dan tidak kaku. Chart juga harus bervariasi dimana-mana dan tetap bagus. Ingat, DINAMIS, tidak kaku."
- **Solusi & Keputusan Desain (Patuh `DESIGN.md` §1 & §6)**:
  - **Grid Dinamis 6 Kolom (`#ov-div-grid`)**: Tidak lagi rigid 3 kolom seragam. Grid memakai 6 kolom responsif dengan dense row-flow dan `align-items: stretch` sehingga kartu dalam satu baris ditarik setinggi kartu tertinggi (sejajar sempurna, tanpa anak tangga).
  - **Multi-Span Menyesuaikan Konten**:
    - Baris 1: Tata Usaha (span 4 — layout wide 2 kolom: metrik di kiri, grouped column bar bulanan di kanan) + Cakupan Laporan (span 2 — chip status melapor 7 divisi). Total 6 kolom.
    - Baris 2: Operasi Laut & Udara (span 2 — grouped columns KII vs KIA) + Perawatan (span 2 — donut kesiapan armada 3 segmen) + Intelijen (span 2 — ranked horizontal bars aktivitas). Total 6 kolom.
    - Baris 3: Pemantauan (span 2 — dual-line sparkline penerbitan bulanan SKAT vs User) + Logistik (span 4 — layout wide: metrik di kiri, vertical column bars stok amunisi top-5 di kanan). Total 6 kolom.
    - Baris 4: Pengawakan (span 3 — waffle chart 40 sel proporsi penempatan AKN) + Kegiatan Pendukung (span 3 — calendar heatmap strip bulanan). Total 6 kolom.
  - **Variasi Visual (Tanpa Gauge & Anti-Monoton)**:
    - Menghilangkan kesan "semua progress bar". Tiap kartu memiliki representasi grafis spesifik: grouped columns (`_vzCols`), donut proportion (`_vzDonut`), ranked horizontal bars (`_vzHbars`), dual-line trends (`_vzLine`), waffle grid (`_vzWaffle`), calendar heatmap cells (`_vzHeat`), status chips (`_vzChips`).
    - KPI Realisasi SP2D diganti dari gauge cincin menjadi sparkline tren bulanan (mematuhi `DESIGN.md` §6.1 yang melarang gauge).
  - **Chart Konteks Asimetris (`.chart-grid-asym`)**:
    - Zona tren & kapasitas: Realisasi Anggaran (span 7) vs Hari Operasi Armada (span 5).
    - Zona penindakan: Komposisi Penindakan (span 5) vs Kapal Pengawas Teraktif (span 7).
    - Pola asimetris 7:5 dan 5:7 memecah kesan kaku "kotak simetris kembar" sekaligus memberi ruang lebih lega bagi chart tren & peringkat.
- **Verifikasi**: `verify.sh` OK (95 endpoint), `nulltest.js` 12/12 pass, `selftest.js` **139 pass / 0 fail** (bertambah 5 test: waffle alokasi 40 sel, kolom adaptif anti-tabrakan, dispatch `_vzRender`, kepatuhan baris penuh 6 kolom, anti-gauge & breakpoint media query), probe render Chromium headless di 1280px dan 820px terbukti rata, sejajar, dan bebas celah.
- **Status**: selesai & terverifikasi lokal. Menunggu `clasp push` + verifikasi visual runtime oleh user (agen tidak deploy — `AGENTS.md` §5b).
- Detail: `CHANGELOG.md` `[Fase 14 — Ikhtisar] — Visualisasi Dinamis & Grid Sejajar Ikhtisar`.

#### Fase 14 — Auto-Detection Status Persetujuan Registrasi & Auto-Refresh Tanpa Reload

- **Permintaan user (7 Oktober 2026)**:
  1. "Ubah logika agar semuanya tidak terbatas atau hanya berbasis pada refresh, jadi data akan tetap diperbarui meskipun tidak refresh, hal seperti membaca notif saja perlu refresh dan lain lain, silakan evaluasi."
  2. "Ini juga akan mengarah ke sistem sign up, saya mau, dia tuh setelah sign up jika memang masih membuka sign up page dan sudah di acc oleh atasan, akan ada notifikasi di atasnya muncul, bahwa akun anda sudah diterima berhasil dibuat dkk, lalu ada perintah untuk sign in dan bisa di klik tombol sign in nya untuk mengarah ke sign in"
- **Solusi & Keputusan Teknis**:
  - **Endpoint Baru Server**: `auth_checkRegistrationStatus(params)` di `services/AuthService.js` yang menerima `{ email, userId }`, membaca `Users` (dan `Approval_Queue` bila tolak), mengembalikan `{ status, nama, email, approvedAt, alasanReject }` tanpa autentikasi sesi dan tanpa membocorkan hash password.
  - **Sesi Revocation**: `auth_decideApproval` memanggil `_revokeUserSessions(userId)` untuk membersihkan sesi lama pendaftar secara otomatis.
  - **Client Registration Flow**:
    - Saat registrasi berhasil (`_regSubmitRegister`), form di-reset, data disimpan di `sessionStorage` (`NAUTIKA_PENDING_REG`), tampilan diarahkan ke `#v-pending` dengan ringkasan lengkap dan status indikator live pulse.
    - Polling berkala `_startPendingStatusPolling` (interval 8s) mengecek status persetujuan secara real-time.
    - Ketika status berubah menjadi `APPROVED`: polling berhenti, data pending di session dibersihkan, banner hijau solid (`#ECFDF5`, border `#10B981`, teks `#065F46`, tombol `.btn-primary`) muncul di atas kartu dengan teks persetujuan dan tombol "Masuk ke Akun (Sign In)".
    - Klik tombol memanggil `_pendingGoToLogin(email)` yang langsung membawa ke `#v-login`, mengisi email pendaftar, dan memfokuskan field password.
    - Ketika status `REJECTED`: banner penolakan merah (`#FEF2F2`, border `#EF4444`) muncul dengan alasan dan tombol "Daftar Ulang".
  - **Immediate Update Notifikasi & Heartbeat Tanpa Reload**:
    - `_ntfMarkRead(notifId)` kini memanggil `_applyShellStatus()` seketika setelah server sukses menandai dibaca sehingga badge sidebar langsung berkurang tanpa perlu refresh.
    - Diterapkan `_SILENT_RPC` dan wrapper `_silentRun(fn)` agar call background tidak memicu spinner `#filter-busy`.
    - Diterapkan `_startAppHeartbeat()` (interval 25s) dan listener `visibilitychange`/`focus`: secara periodik memperbarui badge unread, strip reminder mingguan, dan antrean approval approver jika sedang membuka overview atau panel kelola akun.
    - `_routeTo(viewId)` memanggil `_applyShellStatus()` setiap kali user berpindah halaman.
- **Verifikasi**: `node --check` seluruh file backend dan client lolos 100%, pengujian unit testing dan integrasi DOM virtual berhasil (status detection pending, approved, rejected, email pre-fill, badge update, banner display).
- **Status**: Selesai & terverifikasi lokal. Menunggu `clasp push` + verifikasi runtime oleh user (agen tidak deploy — `AGENTS.md` §5b).
- Detail: `CHANGELOG.md` `[Fase 14 — Auth & Real-Time] — Auto-Detection Status Persetujuan Registrasi & Auto-Refresh Tanpa Reload`.

#### Fase 14 — Item 1: Input Periode Seragam (Dropdown) di Semua Form


- **Permintaan user (30 Sep 2026)**: "Input periode di semua form pastikan pakai dropdown, saya lihat di TU masih ketik manual, semua harus sama."
- **Temuan audit**: 12 dari 13 form pelaporan sudah memakai tiga dropdown `Tahun`/`Bulan`/`Minggu Ke-` (Operasi Laut & Udara, Intelijen, Pemantauan, Perawatan ×3, Logistik ×3, Pengawasan ×2). **Tata Usaha** (`html/views/TataUsaha.html`) adalah satu-satunya yang masih memakai `<input type="text" id="tu-periode" placeholder="YYYY-MM-WW …">` — sumber error format yang berulang.
- **Perubahan**: `tu-periode` diganti tiga `<select>` (`tu-periode-tahun` / `tu-periode-bulan` / `tu-periode-minggu`) dalam grid `1fr 1fr 1fr`, memakai helper yang **sudah ada** (`_opsInitPeriodeUi('tu-')` + `_composePeriode('tu-')`) — tidak ada helper duplikat. Helper hint baru `_tuSyncPeriodeHint()` (`.n-form-hint`, sinkron tiap `onchange`) menggantikan hitungan periode manual di `_renderTataUsaha()` dan `tuOpenForm()`. `tuSubmit()` memakai `_composePeriode('tu-')` dan menolak submit dengan `Periode wajib dipilih.` bila dropdown belum lengkap.
- **Tidak diubah**: `services/TataUsahaService.js` tetap memvalidasi `parsePeriode(periode)` + pesan `Format Periode tidak valid. Gunakan YYYY-MM-WW.` sebagai lapisan kedua; tidak ada kolom sheet baru (`DATA_SCHEMA.md` tidak tersentuh).
- **Verifikasi**: `verify.sh` OK (95 endpoint), `selftest.js` 61 pass / 0 fail (bertambah 2 regression test baru: "input periode seragam" + "_composePeriode merakit format YYYY-MM-WW"), `nulltest.js` 10/10, `node --check` client & server bersih.
- **Status**: selesai & terverifikasi lokal. Menunggu `clasp push` + verifikasi runtime oleh user.
- Detail: `CHANGELOG.md` `[Fase 14 — Item 1] — Input Periode Seragam: Dropdown di Semua Form`.

#### Fase 14 — Item 2: Ikon Aksi untuk Tombol Mikro (Hapus Baris, Hapus Lampiran, Opsi)

- **Permintaan user (30 Sep 2026)**: tombol `Hapus` di setiap entri form (daftar KII/KIA, rumpon, objek SDK, jenis kejadian, kawasan, penyedia, marabahaya, master data, chip lampiran) memakai **ikon tempat sampah**, lalu diperluas: "apply untuk semua button di website dan semua yang butuh icon" + keluhan form terlihat melebar.
- **Temuan audit**: inventaris tombol di `html/*.html` + `html/views/*.html`. Ikon **hanya** masuk ke 4 pola aksi mikro yang berulang; tombol primary (`Simpan`, `Batal`, `Tutup`, `Muat Ulang`, `Tambah`), approval/status, dan `Lihat`/`Revisi`/`Anulir` **tetap teks** (ikon jadi kabur). `kdl-clear` sudah memakai SVG background sendiri sehingga tidak diubah.
- **Perluasan (30 Sep 2026, permintaan kedua "jangan semuanya teks juga")**: tombol aksi yang berulang dan sering diklik diberi ikon **+ teks** (bukan icon-only) lewat deklarator label `_ICO_LABEL` + `_icoDecorate()` yang berjalan saat load dan saat DOM berubah (`_icoWatch()` MutationObserver). Peta ikon diperluas jadi 21 simbol (`trash`, `x`, `pencil`, `square`, `play`, `plus`, `check`, `save`, `ban`, `power`, `refresh`, `send`, `logout`, `login`, `user`, `eye`, `history`, `clock`, `sliders`, `mail`, `mailCheck`, `key`, `chevronDown`, `arrowLeft`, `book`, `info`). **Tetap teks-only**: tab, status badge, segmented filter, dan badge angka.
- **Perubahan**: satu sumber ikon `_ICO()` + helper `_ico(name, size)` di `html/Script_Main.html` (inline SVG 24×24, `currentColor`, `aria-hidden`, 5 ikon: `trash`, `x`, `pencil`, `square`, `play`). Diterapkan ke `_nList()` (daftar dinamis + daftar revisi di 4 halaman), baris inline `intelAddKawasanRow`/`pemAddPenyediaRow`/`pemAddMarabahayaRow`, `_mdDeleteKawasan()`, chip lampiran (`_attachRenderList()`), dan chip Opsi Master Data (edit label + aktif/nonaktif). Semua tombol ikon wajib `title` + `aria-label` bahasa Indonesia. CSS baru di `html/Style.html`: `.n-list-del`, `.n-iconbtn`, `.n-iconbtn-sm`, `.n-chip-x` + hover krit + `focus-visible`.
- **Bug lama yang ikut ketahuan & diperbaiki**: `.n-list-row` punya `grid-template-columns` 3 track tapi 4 anak (3 kontrol + sel hapus) sehingga **tombol hapus selalu wrap ke baris baru di bawah input** — ini penyebab form terlihat melebar/crowded. `makeRow()` kini menambah track `auto`, dan tinggi tombol ikut tinggi kotak input lewat `align-self:stretch` (tanpa angka px yang bisa menyimpang).
- **Verifikasi geometris** (headless Chrome, harness `/tmp/opencode/mkprobe.py` → `probe2.html`, mengukur `getBoundingClientRect` dari `Style.html` + markup baris asli): `.n-list-row` delta-atas **0.0px** & delta-tinggi **0.0px** (tidak wrap, tombol 45px lebar, tinggi = tinggi input); baris inline dasar tombol rata dengan dasar kotak input (delta-bawah 0.0px, tombol 7px lebih tinggi →	target sentuh lebih besar); `.n-iconbtn-sm` sejajar dengan `.btn-sm`; chip 20×20.
- **Verifikasi statis**: `verify.sh` OK (95 endpoint), `selftest.js` **66 pass / 0 fail** (bertambah 5 regression test ikon), `nulltest.js` 10/10, `node --check` client bersih.
- **Tidak diubah**: tidak ada perubahan schema, endpoint, service, atau `DATA_SCHEMA.md`. Tidak ada `clasp push` (agen tidak melakukan deploy — `AGENTS.md` §5b).
- **Status**: selesai & terverifikasi lokal. Menunggu `clasp push` + verifikasi runtime oleh user.
- Detail: `CHANGELOG.md` `[Fase 14 — Item 2] — Ikon Aksi untuk Tombol Mikro`.

#### Fase 14 — Item 3: Audit Geometri List/Form + RBAC Revisi Riwayat

- **Permintaan user (30 Sep 2026)**: audit seluruh website (bukan hanya Rumpon) untuk form/list yang tidak rapi dan tidak sejajar; lebar boleh bertambah, **alignment lebih penting daripada kompresi**; tombol `Revisi` di riwayat harus muncul sesuai hak akses.
- **Bug yang ditemukan & diperbaiki**:
  1. `_nList()` kolom `type: 'hidden'` tetap jadi anak grid — pada `ops-rumpon-list` & `rv-ops-rumpon-list` (kolom `itemtype`) menyebabkan baris wrap ke **3 baris** (`dTop=48px`, `dBot=63px`, tinggi baris 82px vs 38px). `makeRow()` kini `display:none` untuk sel hidden, jadi tidak lagi menempati track.
  2. `Revisi` tidak pernah muncul di riwayat Operasi Laut & Operasi Udara: `canWrite` di `_opsLautRenderHistory()` / `_opsUdaraRenderHistory()` hanya menerima `divisiId === 'DIV-OPS'` sehingga **SUPERADMIN kehilangan tombol** walau server (`_opsLautAssertWrite` / `_opsUdaraAssertWrite`) mengizinkannya. Client kini mencerminkan server: `SUPERADMIN` **atau** `DIV-OPS` + `KADIV`/`STAF`. `DIREKTUR` tetap tidak dapat write (hanya anulir).
- **Tidak diubah**: `services/OperasiLautService.js` & `services/OperasiUdaraService.js` **tidak disentuh** — RBAC server sudah benar, yang salah cerminannya di client. Tidak ada perubahan schema/endpoint.
- **Verifikasi geometris** (headless Chrome):
  - `node /tmp/opencode/audit-nlist.js` → 8 call site, semua track cukup.
  - `/tmp/opencode/mkprobe-nlist.py` → 5 spec representatif: `dTop=0.0`, `dBot=0.0`, tinggi baris = tinggi kontrol 38px, **dengan ikon di dalam list**. Versi negatif (tanpa `display:none`) tetap gagal pada Rumpon sebagai bukti.
  - `/tmp/opencode/probe-grid.html` → **40 baris** grid multi-kontrol di 9 view (termasuk baris dropdown periode yang sebelumnya luput karena `querySelectorAll` tidak mencocokkan sel berupa `<select>`): `SEMUA BARIS GRID SEJAJAR`.
- **Verifikasi ikon tidak merusak alignment** (`/tmp/opencode/mkprobe-ico.py`, 133 tombol live dari seluruh markup view): tinggi tombol **tidak bertambah** (0), overflow baru 0, teks tombol tidak berubah 0, injeksi ganda 0, semua SVG `aria-hidden`.
- **Verifikasi statis**: `verify.sh` OK (95 endpoint), `selftest.js` **70 pass / 0 fail** (bertambah 4 regression test: layout model tombol, deklarator idempoten, tidak ada label rusak, RBAC Revisi), `nulltest.js` 10/10, `node --check` client bersih.
- **Status**: selesai & terverifikasi lokal. Menunggu `clasp push` + verifikasi runtime oleh user.
- Detail: `CHANGELOG.md` `[Fase 14 — Item 3] — Audit Geometri + RBAC Revisi`.

#### Fase 14 — Item 4: Tombol Ikon-Saja (`.n-iconbtn-x`) + Audit Ikon Site-wide

- **Permintaan user (1 Okt 2026)**: "coba lagi kok nggak pakai icon" — tombol yang teksnya sudah diulang oleh kalimatnya sendiri cukup ikon saja; diperluas: "apply untuk semua button di website dan semua yang butuh icon".
- **Audit site-wide**: 194 kemunculan tombol/link, **95 label unik**. Dipilah menjadi (a) *action gap* yang perlu ikon, (b) kontrol navigasi/filter yang **memang tidak boleh** berikon. Yang tetap **teks-only** (sengaja, sesuai §1 negative prompt): `.n-tab` (17), segmented filter `Bulanan`/`Rentang`, sidebar/nav, badge status, badge angka, KPI, header dekoratif, dan `kdl-clear` (sudah punya SVG background sendiri). Tombol berlabel lain **tetap ikon + teks** karena ikon jadi kabur dan teksnya menunjuk konteks: `Lihat`/`Revisi`/`Anulir` di baris tabel, `Muat Ulang`, `Ulangi upload lampiran`, `Tutup` di footer modal bukti, `Tandai Dibaca` di sel tabel.
- **Perubahan — ikon baru**: `upload` (Unggah File) & `link` (Salin dari Link) ditambahkan ke `_ICO`; `Master Data`/`Buka Master Data` dipindah dari glyph `←` ke ikon `book` supaya navigasi (=buka master data) tidak memakai ikon "kembali"; `arrowLeft` kini khusus tombol kembali. Peta `_ICO` kini **28 simbol** (`trash`, `x`, `pencil`, `square`, `play`, `plus`, `check`, `save`, `ban`, `power`, `refresh`, `send`, `logout`, `login`, `user`, `eye`, `history`, `clock`, `sliders`, `mail`, `mailCheck`, `key`, `chevronDown`, `arrowLeft`, `book`, `info`, `upload`, `link`). Catatan: angka "21 simbol" di entri Item 2 di atas memang sudah tidak akurat sejak awal (daftarnya berisi 26 nama) — angka di sini memakai hitungan aktual 28.
- **Perubahan — tombol ikon-saja**: 4 konversi, semuanya di `.n-iconbtn-x` (persegi 28×28, ghost, `title` + `aria-label`): `Coba lagi` ×2 di `Script_Main.html` (`_asyncResFail` untuk timeout/respons kosong & `_ovLoadError` untuk Ikhtisar), tombol tutup modal detail (`#modal-hd`) dan tombol tutup drawer persetujuan (`#dr-drawer`) di `Index.html`.
- **Mekanisme `data-ico`**: `Script_Main.html` dimuat **setelah** markup statis, jadi tombol ikon-saja di `Index.html`/`html/views/*.html` tidak bisa memanggil `_ico()` saat parse. `_ICO_SEL` + `_icoDecorate()` kini membaca `data-ico="<nama>"` dan `data-ico-size`; ini yang membuat konversi di markup statis mungkin tanpa menduplikasi SVG. Tombol dari JS tetap pakai `_ico()` langsung.
- **Bug lama yang ikut ketahuan & diperbaiki**: di header modal detail, tombol tutup lama `<button class="btn-ghost btn-mini">Tutup</button>` mewarisi `.btn-ghost { display:block; width:100% }`, sehingga dalam flex `.n-modal-hd-head` tombol itu melebar **407px** dari modal 620px dan menyisakan 143px untuk judul — judul sempat membungkus jadi **3 baris (tinggi 48.81px)**. Setelah jadi ikon 28×28, judul kembali **1 baris (205.7×24.41px)** dan tinggi header turun 20.81px. Header drawer **tidak bergeser sama sekali** (delta 0.00px).
- **Verifikasi geometris** (headless Chrome `chrome-headless-shell` + `--dump-dom`):
  - `/tmp/opencode/mkprobe-ico.py` → **115 tombol live** dari markup asli semua view: `tinggi_naik=0`, `max_delta_tinggi=0.094px` (sub-pixel), `teks_berubah=0`, `injeksi_ganda=0`; 24 tombol tanpa ikon = 17 `n-tab` + 2 segmented + 5 tab riwayat, semuanya memang teks-only.
  - `/tmp/opencode/mkprobe-x.py` → 4 tombol ikon-saja: 28×28 **persegi**, SVG `viewBox="0 0 24 24"`, `stroke="currentColor"` (warna benar-benar diwarisi `rgb(163,174,208)` = `--n-text-muted`), `aria-hidden="true"`, `focusable="false"`, tanpa teks, `title` + `aria-label` ada.
  - `/tmp/opencode/mkprobe-nlist.py` → **8 spec `_nList` nyata**: semua baris punya track `auto` untuk kolom hapus, 0 tumpang tindih, 0 tombol hapus tanpa ikon/aria.
  - `/tmp/opencode/mkprobe-view.py` → **15 view** di viewport 1440px **dan** 390px: 147 tombol, 0 view melimpah, 0 elemen keluar viewport, 0 tombol gepeng.
- **Perbaikan regression test**: test lama "setiap pemakaian `_ico()` bertitle+aria" ikut diperbaiki — aturannya hanya berlaku untuk tombol **ikon-saja**; tombol ikon+teks justru **dilarang** pakai `aria-label` (menimpa label terlihat). Ditambah test untuk `data-ico`, retry ikon-saja, nama ikon, dan `focus-visible` `.n-iconbtn-x`. `html/Style.html` **murni aditif** (1 selector ditambah ke blok `focus-visible` + blok baru `.n-iconbtn-x`) → nol risiko regresi grid/list.
- **Verifikasi statis**: `verify.sh` OK, `selftest.js` **74 pass / 0 fail**, `nulltest.js` **12/12** (2 assertion baru memastikan retry benar-benar punya ikon + aria-label, bukan sekadar kata "Coba lagi" dari teks pesan), `node --check` client bersih.
- **Tidak diubah**: tidak ada perubahan schema, endpoint, service, `DATA_SCHEMA.md`, atau `ARCHITECTURE.md`. Tidak ada `clasp push` (agen tidak melakukan deploy — `AGENTS.md` §5b).
- **Catatan lanjutan (di luar scope item ini)**: `n-drawer-sub` di drawer persetujuan masih berupa subtitle di bawah judul, sedangkan `DESIGN.md` §1 menyatakan subtitle tidak boleh menabrak judul header — belum diubah karena bukan bagian task ikon. Discrepanzi RBAC `KADIV` lintas divisi untuk `Anulir` (client vs `_opsLautAssertWrite`) juga masih terbuka dan tidak disentuh.
- **Status**: selesai & terverifikasi lokal. Menunggu `clasp push` + verifikasi runtime oleh user.
- Detail: `CHANGELOG.md` `[Fase 14 — Item 4] — Tombol Ikon-Saja & Audit Ikon Site-wide`.

#### Fase 14 — Item 5: Popup Berhasil Setelah Submit + Loading yang Lebih Terlihat

- **Permintaan user (1 Okt 2026)**: "Setelah laporan berhasil di submit, jangan sampe form nya masih muncul jadi pop up, pop up nya diganti pake pop up berhasil, biar tidak ada perubahan, loadingnya dibuat lebih terlihat, berlaku buat semua form."
- **Masalah yang ditemukan**: 14 form pelaporan + 2 form Master Data menutup popup begitu saja setelah submit (`closeModal()` langsung), sehingga tidak ada konfirmasi bahwa data benar-benar masuk. Spinner satu-satunya ada di dalam tombol (`Memproses…` font 13px) — nyaris tak terlihat di modal 400px.
- **Perubahan — state sukses**: helper client-side `_FORM_SUCCESS` + `_formShowSuccess()` / `_formRestore()` / `_formSubmitDone()` di `html/Script_Main.html`. Isi modal diganti panel "Berhasil" (ikon centang + kalimat konfirmasi per-form + "Menutup otomatis…", dibungkus `role="status" aria-live="polite"`), ditutup otomatis 650ms, baru `onClose` berjalan (reload KPI + riwayat). Markup modal asli disimpan di snapshot dan dipulihkan saat popup dibuka lagi; `closeModal()` kini memanggil `_formRestore()` lebih dulu, dan timer auto-close dibatalkan saat restore supaya popup yang ditutup manual lalu dibuka lagi tidak tertutup oleh timer lama. `ok === false` (upload gagal) **tidak** menampilkan panel sukses — perilaku lama dipertahankan, jadi tidak ada sukses palsu.
- **Perubahan — loading**: `_setLoading()` mendeteksi tombol di dalam `.n-overlay` lalu menampilkan `.form-loading-overlay` (spinner 22px + teks status) di atas area form, dengan dua tahap yang keduanya terlihat: "Menyimpan…" saat simpan ke server, "Mengunggah lampiran…" selama `_attachUploadAll()` (dipetakan lewat `_ATTACH_MODAL`, 14 key). Popup tanpa `.n-modal-form-scroll` (Kegiatan, Master Data) jatuh ke fallback `.n-modal`, makanya `.n-modal` diberi `position: relative`.
- **Desain**: ikon centang memakai latar **solid** `#ECFDF5` — tanpa gradient dekoratif, sesuai `DESIGN.md` §1. Keyframe spinner disatukan jadi satu `_spin` (sebelumnya `n-spin` diduplikasi). CSS `.btn-primary.is-loading` yang sempat drafted **dihapus** karena tidak terpakai (`_setLoading` sudah menukar `innerHTML` tombol).
- **Cakupan**: 14 form laporan (Tata Usaha, Operasi Laut, Operasi Udara, Intelijen, Kegiatan, Pemantauan, Perawatan ×3, Logistik ×3, Pengawasan ×2) + 2 form Master Data. Popup **revisi** & **anulir** **tidak** diubah — keduanya bukan form pelaporan (textarea/konfirmasi 1 field, sudah ada pesan inline), dan mengganti alur pengesahan revisi/anulir berada di luar scope permintaan ini.
- **Verifikasi**: harness headless Chrome baru `/tmp/opencode/mkprobe-success.py` → **531 check, 0 fail** di viewport 1280px **dan** 390px (loading on/off, panel sukses tampil + modal tetap terbuka + markup pulih identik + form bisa dibuka lagi, gagal = tanpa panel sukses, overlay bertahan selama unggah lalu tertutup sebelum panel sukses, peta 14 key, geometri panel & overlay tidak melimpah). Probe lama tetap hijau: `mkprobe-ico.py` 115 tombol `max_delta_tinggi=0.094px`, `mkprobe-nlist.py` 0 masalah, `mkprobe-view.py` 147 tombol 0 melimpah 0 gepeng. Statis: `verify.sh` OK, `selftest.js` **74 pass / 0 fail**, `nulltest.js` **12/12**, `node --check` client bersih, `git diff --check` bersih.
- **Tidak diubah**: tidak ada perubahan schema, endpoint, `services/`, `DATA_SCHEMA.md`, atau `ARCHITECTURE.md`. Tidak ada `clasp push` (agen tidak melakukan deploy — `AGENTS.md` §5b).
- **Catatan**: verifikasi runtime GAS tetap terblokir OAuth (`MailApp.sendEmail` scope); harness ini murni client-side dengan stub, jadi round-trip ke Spreadsheet belum terverifikasi.
- **Status**: selesai & terverifikasi lokal. Menunggu `clasp push` + verifikasi runtime oleh user.
- Detail: `CHANGELOG.md` `[Fase 14 — Item 5] — Popup Berhasil Setelah Submit + Loading yang Lebih Terlihat`.

#### Fase 14 — Item 6: Kapal Pengawas Wajib (Operasi Laut & Udara) + `Kapal.JenisKapal`

- **Permintaan user (1 Okt 2026)**: bar **"Kapal Pengawas Teraktif"** di Ikhtisar selalu kosong meski KPI hari operasi terisi. Diminta evaluación sumber & penyebab, lalu diputuskan: `KapalID` **wajib** pada submit/revisi Operasi Laut & Udara, revisi diberi pemilih kapal, dan Master Kapal mendapat kolom `JenisKapal`.
- **Temuan**: `KapalID` ditambahkan pada Fase 12 (28 Sep 2026) sebagai kolom opsional **tanpa backfill**. `dashboard_getOverview()` menjumlahkan `HariOperasi_Jumlah` dari `TX_OperasiLaut` + `TX_OperasiUdara` dikelompokkan per `KapalID`, jadi KPI tetap benar sementara grafik kosong — semua baris lama tidak punya kapal dan baris baru pun boleh submit tanpa memilih kapal. Tidak ada backfill/migrasi yang disengaja.
- **Perubahan — skema**: `Kapal.JenisKapal` (enum Opsi grup baru `KAPAL_JENIS`: `KAPAL_PUSAT`, `SPEEDBOAT`) ditambahkan. Kolom `KapalID` pada `TX_OperasiLaut`/`TX_OperasiUdara` tetap **nullable di skema** (baris lama tidak boleh jadi invalid) tetapi wajib diisi untuk submit/revisi baru. `TX_Logistik_*` tidak berubah — `KapalID` tetap opsional di sana.
- **Perubahan — server**: `operasiLaut_submit` & `operasiUdara_submit` menolak `KapalID` kosong/tidak terdaftar. `master_kapalCocokKategori()` mencocokkan kapal dengan `HariOperasi_Kategori` (`SEMUA_KAPAL`/kosong = semua kapal; kapal tanpa `JenisKapal` = tidak dibatasi). Pada revisi, `KapalID` diwarisi dari baris lama bila tidak dikirim; bila warisannya juga kosong, revisi ditolak dengan pesan yang menyuruh memilih kapal — **modal revisi punya pemilih kapal (prefill nilai lama)**, jadi itu jalur pengisian data lama, bukan migrasi.
- **Perbaikan bug (ketemu sekalian, di luar scope yang diminta)**: revisi kedua modul menandai baris lama `SUPERSEDED` **sebelum** validasi `rincian` per-item dijalankan. Revisi yang gagal karena rincian tidak sah membuat data aktif hilang tanpa bar pengganti. Kedua `revisi` sekarang menjalankan validasi kapal + rincian sebelum menandai baris lama, lalu memakai hasil validasi yang sama untuk persistence (tanpa validasi ganda). Ini pola yang sudah diperbaiki di Pemantauan/Intelijen pada Fase 12 tapi belum ikut diterapkan di dua modul ini.
- **Perubahan — client**: `_kapalInit(id, jenisKategori)` + `_kapalItemsFor()` menyaring dropdown kapal per kategori hari operasi; `_kapalSyncKategori()` menyaring ulang + mereset pilihan yang jadi tidak sah saat kategori berubah. Validasi wajib di `opsLautSubmit`/`opsUdaraSubmit` dan di kedua confirm revisi. Master Data: kolom Jenis di tabel + dropdown `Jenis Kapal` di modal (enum dimuat lazy dari `master_getOpsiJenis`).
- **Self-heal DB lama**: `ensureKapalJenisColumn()` menambahkan kolom; `_mdEnsureKapalJenisOpsi()` menjalankan `_seedOpsi()` yang idempoten bila grup `KAPAL_JENIS` masih kosong — dipanggil dari `master_getKapalList`/`create`/`update`. Tanpa ini semua kapal baru akan ditolak di DB lama sampai user menjalankan `setupSeedOpsi()` manual, dan dropdown Master Kapal kosong tanpa penjelasan.
- **Chart kosong yang jujur**: `dashboard_getOverview()` kini mengirim `charts.hariTanpaKapal` (jumlah hari operasi yang tidak bisa diatribusikan ke kapal). Chart menampilkan catatan itu alih-alih tampak seperti tidak ada aktivitas.
- **Dokumen**: `DATA_SCHEMA.md` (kolom `Kapal.JenisKapal`, `KAPAL_JENIS` di grup Opsi, aturan pencocokan, status `KapalID` baru-vs-legacy), `ARCHITECTURE.md` §4b (kenapa `KapalID` wajib di dua modul ini tapi tetap nullable di skema + konsekuensi revisi), `PRD.md` §6.
- **Catatan**: tidak ada `clasp push` (agen tidak melakukan deploy — `AGENTS.md` §5b). Verifikasi runtime GAS masih terblokir OAuth `MailApp.sendEmail`.
- **Status**: implementasi selesai; verifikasi lokal + runtime menunggu user.
- Detail: `CHANGELOG.md` `[Fase 14 — Item 6] — Kapal Pengawas Wajib di Operasi Laut/Udara + Jenis Kapal di Master`.

#### Fase 14 — Perbaikan: Peta WPPNRI Tidak Muncul di Operasi

- **Keluhan user**: basemap CARTO muncul, tetapi batas/poligon WPPNRI tidak terlihat di peta Operasi.
- **Akar masalah** (3 cacat menumpuk, semua di `html/Script_Main.html`): pemuatan GeoJSON 10 MB gagal tanpa pesan di layar (`.catch` hanya `console.error`) sehingga `L.geoJSON` tak pernah dipanggil — tidak ada poligon yang tergambar; tidak ada guard in-flight sehingga tiap re-render mengunduh ulang 10 MB dan saling berebut jaringan; serta warna layer yang bergantung `var()` pada atribut SVG (bukan penyebab gejala, tapi tidak diandalkan). Saldo: **legenda §8.1 juga belum pernah ada**.
- **Perbaikan**: satu promise in-flight bersama + `cache: 'force-cache'` + batas waktu 30 detik + 1 retry + pengecekan `response.ok`/payload; callback jadi `(data, error)`; status "memuat" dan "gagal + tombol coba lagi" di atas peta; legenda skala intensitas sesuai `PRD.md` §8.1; palet satu hue navy sebagai hex (token CSS di-mirror ke `_OPS_WPP_SCALE`); `_opsWppIntensitas()` toleran spasi kode WPP. Sumber geometri tetap GitHub raw (user putuskan, 2 Okt 2026).
- **Verifikasi**: `verify.sh` OK · `selftest.js` 87 pass / 0 fail (+13 uji, blok loader dijalankan di `vm`) · `nulltest.js` 12 ok · uji manual dengan `wpp_final.geojson` asli: 11/11 feature ter-render, 0 warna non-hex.
- **Belum dikerjakan** (dicatat, bukan diabaikan): field hover "status konfirmasi" + "tanggal update terakhir" (`wppIntensitas` hanya berisi angka — perlu keputusan user) dan peta mini form dengan sinkron dua arah (`PRD.md` §8.1) yang memang belum pernah ada.
- Detail: `CHANGELOG.md` `[Fase 14 — Perbaikan] — Peta WPPNRI tidak muncul di Operasi (basemap ada, batas WPP hilang)`.

#### Fase 14 — Pagu: Jumlah Revisi Pagu di Bawah Baris Pagu (TU)

- **Permintaan user (2 Okt 2026)**: "Tambahkan sudah berapa kali revisi di TU bagian pagu, jadi di bawah pagu itu ada tulisan Revisi pagu Ke-x." Setelah klarifikasi, angka = **jumlah revisi yang sudah terjadi**, dan saat `Ubah Pagu` ditekan tampil prediksi `Jika disimpan, menjadi revisi ke-(N+1)`.
- **Definisi angka**: jumlah **transisi** nilai `(PaguReguler, PaguABT)` pada baris `ACTIVE` yang berbeda dari baris `ACTIVE` sebelumnya, dibaca kronologis; baris pertama = pagu awal, bukan revisi.
- **Dua keputusan yang menentukan**: (1) menghitung **seluruh riwayat**, bukan rantai `SupersedesRowID` — Pagu diwarisi lintas minggu, jadi nilai yang "sama" di periode berbeda bisa tetap hasil revisi di periode sebelumnya dan rantai supersede akan melewatkannya; (2) menghitung dari perubahan **nilai**, bukan `CatatanRevisiPagu` yang terisi — `tataUsaha_revisi` mewajibkan `AlasanRevisi` tapi tidak memaksa Catatan Revisi Pagu saat pagu berubah, jadi menghitung dari kolom catatan akan *understated*.
- **Perubahan**: `_tuHitungRevisiPagu()` di `services/TataUsahaService.js` (menyortir sendiri, memakai `_num()` agar string dari sheet tetap dibandingkan sebagai angka) → `tataUsaha_getKPI()` mengembalikan `revisiPagu` (**on-read, tanpa kolom baru**; KPI tidak di-cache jadi tak ada invalidasi cache). Client `_tuRenderRevisiPagu()` menampilkan `Belum pernah direvisi` / `Revisi pagu: sudah N kali` + prediksi `revisi ke-(N+1)`, dipanggil dari `tuOpenForm()`, `tuUnlockPagu()`, dan `tuOpenRevisiModal()`. Markup `#tu-pagu-rev` + `#rv-pagu-rev` di `html/views/TataUsaha.html`, CSS `.tu-pagu-rev` + `.is-next` di `html/Style.html`.
- **Dua guard yang mencegah angka berbohong**: prediksi hanya muncul bila nilai input benar-benar berbeda dari nilai laporan sebelumnya (`_tuPaguBerubah()` — membuka `Ubah Pagu` lalu langsung menyimpan bukan revisi); dan saat KPI belum termuat client menampilkan `—`, bukan `Belum pernah direvisi`. Listener `input` dipasang/dilepas di satu tempat (`_tuWatchPagu()` via `_tuSetPaguBar`) supaya tidak nyangkut saat modal ditutup dalam keadaan pagu terbuka.
- **Verifikasi**: `verify.sh` OK · `selftest.js` **112 pass / 0 fail** (+25 uji, helper server & renderer client dijalankan di `vm`, bukan hanya regex) · `nulltest.js` 12 ok · `node --check` client & `services/TataUsahaService.js` bersih.
- **Tidak diubah**: tidak ada kolom spreadsheet baru (menghitung dari data yang sudah ada lebih murah daripada migrasi sheet dan tidak memberi informasi baru); validasi `tataUsaha_revisi` yang tidak mewajibkan Catatan Revisi Pagu **sengaja tidak** disentuh — memperbaikinya akan menolak revisi lama yang sah dan perlu keputusan terpisah; tidak ada verifikasi visual/browser (tidak tersedia di environment ini).
- Detail: `CHANGELOG.md` `[Fase 14 — Pagu] — JUMLAH REVISI PAGU di bawah baris Pagu (form TU + modal revisi)`.

#### Fase 14 — Selesai: Fix Auto-Detection Akun Disetujui (Serialisasi Date GAS, Hak Veto Superadmin, Flush Sheet, dan Countdown Redirect)

- **Status**: **Selesai (Implementasi selesai & terverifikasi lokal)**.
- **Laporan User (7 & 12 Oktober 2026)**: Pendaftar yang telah disetujui (ACC) oleh Superadmin masih tertahan di layar pending (`#v-pending`), sistem tidak auto-refresh atau mendeteksi persetujuan.
- **Akar Masalah yang Ditemukan**:
  1. **Serialisasi Date Object GAS pada `auth_checkRegistrationStatus`**: Nilai kolom `ApprovedAt` adalah objek native `Date`. Google Apps Script IPC (`google.script.run`) tidak mendukung transfer objek `Date`, sehingga mengembalikan `null` ke client dan guard polling langsung keluar diam-diam tanpa memproses status `APPROVED`.
  2. **Konflik Hak Approval Superadmin pada Antrean Staf**: Pendaftar staf di-route ke `ROLE.KADIV`, dan validasi lama menolak Superadmin sehingga status tidak tersimpan di sheet `Users`.
  3. **Penulisan Spreadsheet Tertunda**: `updateRowCells` tidak memanggil `SpreadsheetApp.flush()`, sehingga pembacaan sheet antar sesi berbeda membaca data stale.
- **Perbaikan yang Diterapkan**:
  - `auth_checkRegistrationStatus`: `ApprovedAt` dikonversi ke ISO string (`.toISOString()`), pencarian email dilengkapi fallback case-insensitive + trim.
  - `auth_decideApproval` & `auth_getPendingApprovals`: Superadmin diberikan hak veto mutlak untuk melihat dan menyetujui seluruh pendaftaran (baik Kadiv maupun Staf).
  - `admin_updateUser`: Menyinkronkan baris `Approval_Queue` jika Superadmin menyetujui user langsung dari Admin Panel.
  - `SheetAccess.js`: Ditambahkan `SpreadsheetApp.flush()` pada `appendRowData` dan `updateRowCells`.
  - `Script_Main.html`: Auto-detection memperbarui judul layar menjadi *"Pendaftaran Disetujui"*, menyembunyikan teks verifikasi, mengubah badge menjadi hijau (*Disetujui & Aktif*), memunculkan banner sukses, serta mengaktifkan countdown 4 detik menuju halaman login (`_pendingGoToLogin`).
- **Verifikasi**: `node --check` 100% lolos di seluruh backend dan frontend. Syntax script client lolos validasi.
- Detail: `CHANGELOG.md` `[Fix — Sebelum Fase 15] — Perbaikan Auto-Detection Akun Disetujui`.

---

### Fase 15 — Arsitektur Systemwide Live-Sync & Real-Time Data (No-Refresh)

Arsitektur sinkronisasi data real-time menyeluruh (*systemwide*) agar seluruh modul divisi, tabel riwayat, KPI card, dan Executive Overview otomatis terbarui tanpa mewajibkan pengguna me-refresh halaman browser (F5), dengan proteksi nol interupsi input (*Form Modal Guard*) dan nol pemborosan kuota GAS (*Cache-Driven Version Sync*).

Fase ini dipecah menjadi **dua sub-fase berurutan** agar implementasi bertahap, modular, dan dapat diverifikasi secara aman:

#### Fase 15a — Fondasi Backend Version-State & Client Heartbeat Engine
- **Status**: **Selesai (12 Okt 2026)**.
- **Dependensi**: Fase 14 Selesai.
- **Tujuan**: Membangun kanal komunikasi sinkronisasi ringan antara server dan client yang efisien tanpa membaca spreadsheet secara berulang (*zero-sheet-read*).
- **Hasil Implementasi**:
  1. **Endpoint Backend `app_getSyncState(token)`**: Dibuat di `services/DashboardService.js` (RAM zero-sheet-read, <50ms) membaca `DASH_TX_VERSION`, unread notifikasi, dan antrean approval dari `CacheService`. Caching dioptimalkan pada `NotifikasiService.js` dan `AuthService.js`.
  2. **Client Heartbeat Engine Terpadu**: Diimplementasikan di `html/Script_Main.html` dengan interval 35 detik (`APP_SYNC.syncInterval`), wrapper `_silentRun(fn)`, dan listener sinkronisasi instan pada `visibilitychange` serta window `focus`.
  3. **Form Modal Guard & Deferred Update**: Fungsi `_isFormActive()` mendeteksi overlay form aktif (`.n-overlay:not(.n-hidden)`), drawer terbuka, atau input teks sedang fokus. Jika form aktif saat versi transaksi server berubah, reload ditunda (`deferredReload = true`) dan dieksekusi otomatis oleh `_syncCheckDeferred()` sesaat setelah formulir ditutup via `closeModal(id)`.
  4. **Status Indikator UI**: Indikator status `#sync-indicator` ditambahkan di header samping `#filter-busy` (gaya pill minimalis sesuai `DESIGN.md` §1) dengan status `Tersinkron`, `Menyinkronkan…`, dan `Ada Pembaruan (Tertunda)`. Mendukung klik manual untuk sinkronisasi seketika (`_triggerManualSync()`).
- **Verifikasi**: `node --check` 100% lulus di seluruh file backend dan skrip `Script_Main.html`.

#### Fase 15b — Modular Silent Reloaders & Auto-Sync Transaksi Site-Wide
- **Status**: **Selesai (12 Okt 2026)**.
- **Dependensi**: Fase 15a Selesai.
- **Tujuan**: Menerapkan fungsi *silent reload* ke seluruh modul data (Overview, 9 Divisi, Kegiatan, Riwayat Laporan, Master Data) saat ada transaksi baru terdeteksi.
- **Hasil Implementasi**:
  1. **Registry Silent Reloader Modular (`_SYNC_RELOADERS`)**: Memetakan seluruh 14 modul dan view data (`overview`, `tata-usaha`, `operasi`, `intelijen`, `pemantauan`, `perawatan`, `logistik`, `pengawakan`, `kegiatan`, `riwayat`, `master-data`, `kelola-akun`, `notifikasi`, `profil-kapal`) ke silent reloader masing-masing.
  2. **Anti-Flicker & Zero Harsh DOM Teardown**: Seluruh loader KPI (`_tuLoadKPI`, `_opsLautLoadKPI`, `_opsUdaraLoadKPI`, `_intelLoadKPI`, `_pemLoadKPI`, `_rawatLoadKPI`, `_logLoadKPI`, `_awkLoadKPI`, `_kgdLoadKPI`) dan riwayat (`_tuLoadHistory`, `_opsLautLoadHistory`, `_opsUdaraLoadHistory`, `_intelLoadHistory`, `_pemLoadHistory`, `_rawatFetchHistory`, `_logFetchHistory`, `_awkFetchHistory`, `_kgdLoadHistory`, `_riwLoad`) mendukung parameter `silent = true` sehingga tidak me-reset elemen menjadi skeleton/spinner saat pembaruan berlangsung.
  3. **Peta WPP Tetap Utuh**: Pada modul Operasi Laut & Udara, peta Leaflet tidak di-destroy dari nol; layer polygon WPP diperbarui warnanya secara in-place melalui data intensitas baru.
  4. **Preservasi Scroll & State Sub-Tab**: `_dispatchModuleSilentReloader()` mencatat dan memulihkan posisi scroll window (`window.pageYOffset`) dan kontainer tabel riwayat (`.n-table-wrap`, `.table-responsive`) setelah data dimuat. State sub-tab (`_OPS.tab`, `_RAWAT.tab`, `_LOG.tab`, `_AWK.tab`, `_ADN.tab`, `_MD.tab`, `_RIW.statusTab`) dan filter periode global (`APP.filter`) dipertahankan sepenuhnya.
- **Verifikasi**: `node --check` 100% lulus, pengujian unit test VM Node membuktikan seluruh 14 modul terdaftar dan berjalan mulus tanpa error.

---

### Fase 16 — Total UI Revision: Sintesis Seluruh Design Engineering Skills & Mission-Critical Maritime Cockpit

- **Status**: **Selesai (Completed)**.
- **Dependensi**: Fase 15 Selesai.
- **Tujuan**: Melakukan perombakan total dari nol (*zero-to-one revision*) terhadap seluruh tampilan, geometri visual, fisika pegas, dan interaksi aplikasi Nautika. Mengubah sistem dari formulir web birokrasi biasa menjadi **Mission-Critical Maritime Cockpit** berstandar dunia (setara Linear/Vercel/Apple HIG) yang menyintesiskan secara penuh seluruh dokumen skill di `.agents/skills/`: `emil-design-eng`, `apple-design`, `animate`, `animation-performance`, `mobile-native`, `ask-sonner`, dan `break-ui`.
- **Karakter & Filosofi Desain ("Mission-Critical Maritime Cockpit")**:
  - **Five-Second Rule**: Operator dan Pimpinan dapat membaca metrik kunci, kesiapan armada, dan arah tren dalam $\le 5$ detik tanpa gangguan elemen dekoratif.
  - **Permukaan Kaca Dingin & Geometri Konsentris**: Kanvas abu-kebiruan sejuk (`#F4F7FE`) dipadukan dengan kartu material translusen tebal (`backdrop-filter: blur(20px) saturate(180%)`), garis batas 1px crisp, dan inner highlight yang menangkap cahaya lembut. Sudut lengkung wajib mengikuti hukum konsentris matematis Apple: $\text{Radius Inner} = \max(0, \text{Radius Outer} - \text{Padding})$.
  - **Angka Telemetri Digital (Tabular Instruments)**: Seluruh angka numerik (hari layar, BBM, nominal rupiah, jam terbang, koordinat) menggunakan `font-variant-numeric: tabular-nums` untuk mengeliminasi pergeseran tata letak (*zero layout jitter*).
  - **Disiplin Sinyal Warna Anjungan**: 90% antarmuka bernuansa tenang Deep Navy (`#2B3674`) dan abu-abu netral. Warna cerah hanya menyala saat ada status fungsional (Hijau Emerald = Siap/Aman, Kuning Amber = Perhatian/Siap Pangkalan, Merah Ruby = Kritis/Harwat Galangan/Anulir).
  - **Fisika Pegas Taktil & Anchored Modal**: Kompresi sentuh instan pada tombol (`scale(0.97)` via `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` dalam 90ms) dan modal dialog yang berakar dari posisi tombol pemicu (*origin-aware*).
  - **HUD Sonner Toast Architecture**: Mengganti banner alert inline dan popup kaku dengan tumpukan notifikasi mengambang non-blocking di pojok kanan bawah yang mendukung alur *loading $\rightarrow$ success/error*, swipe-to-dismiss, dan stacking physics.
  - **Mobile-Native Standard**: Mematikan tap highlight flash (`-webkit-tap-highlight-color: transparent`), mengunci hover hanya pada pointer halus mouse (`@media (hover: hover) and (pointer: fine)`), meniadakan tap delay 300ms (`touch-action: manipulation`), viewport dinamis `100dvh`, dan font form $\ge 16\text{px}$ pada layar sentuh.
- **Hasil Eksekusi 8 Sub-Fase**:
  1. **Sub-Fase 1 (Selesai)**: Overhaul [DESIGN.md](file:///home/pinefeast/Projects/nautika/DESIGN.md) (16 larangan Negative Prompt & token spesifikasi) dan perumusan [master_plan_total_ui_revision.md](file:///home/pinefeast/.gemini/antigravity-ide/brain/0c94f837-7f00-4c84-b347-7bfd2f196360/master_plan_total_ui_revision.md).
  2. **Sub-Fase 2 (Selesai)**: Redesign Global Engine CSS ([Style.html](file:///home/pinefeast/Projects/nautika/html/Style.html)) — token material translusen, inner light edges, layered ambient navy shadows, spring curves, dan mobile-native rules.
  3. **Sub-Fase 3 (Selesai)**: Rekayasa Shell & Navigasi Utama ([Index.html](file:///home/pinefeast/Projects/nautika/html/Index.html)) — Sidebar navy rel aktif solid 3px putih, floating telemetry header, wadah `#n-toaster`, dan auth cards.
  4. **Sub-Fase 4 (Selesai)**: Engine Toast Sonner & Morphing Dialog ([Script_Main.html](file:///home/pinefeast/Projects/nautika/html/Script_Main.html)) — implementasi native Sonner Toast client-side, gestur swipe, wiring universal `_msg`, dan anchored modal origin observer.
  5. **Sub-Fase 5 (Selesai)**: Overhaul Kartu KPI & Staggered View Transition — regenerator `_kpiHeadline` dengan tabular hero numbers, unit span, badge status tren semantik, dan transisi masuk cascade bertingkat (35ms delay).
  6. **Sub-Fase 6 (Selesai)**: Overhaul Formulir & Dropdown Relasional ([html/views/*.html](file:///home/pinefeast/Projects/nautika/html/views)) — audit layout modul, token radius konsentris, dan token latar peta Leaflet `var(--n-surface-2)`.
  7. **Sub-Fase 7 (Selesai)**: Standardisasi Tabel Riwayat & Data Grids — universal sticky glass header, soft-tint semantik badges, dan pembungkus `.n-table-wrap` berisolasi horizontal scroll.
  8. **Sub-Fase 8 (Selesai)**: Audit Ketahanan Data Ekstrem (`break-ui`), verifikasi sintaksis 100% lulus pada seluruh berkas repo, dan kesiapan transisi ke Fase 17.

---

### Fase 17 — Fondasi Anggaran APBN (Reguler vs ABT), Header Live Telemetry, Simplifikasi Ikhtisar SiMata & Kompresi Kanvas Bukti Dukung

- **Status**: **Selesai (14 Oktober 2026)**.
- **Dependensi**: Fase 16 Total UI Revision Selesai (Lunas).
- **Tujuan**: Memperbaiki model akuntansi anggaran negara, menambahkan telemetri pembaruan transaksi di header utama, merapikan halaman Ikhtisar sesuai standar SiMata (eliminasi visual bloat), serta menerapkan kompresi kanvas sisi klien untuk melindungi kuota Google Drive.
- **Ruang Lingkup Deliverables**:
  1. **Rekonstruksi Model Keuangan Tata Usaha**:
     - Memperbaiki kalkulasi di `services/TataUsahaService.js` dan `services/DashboardService.js` agar memisahkan Pagu Reguler vs Pagu ABT serta Realisasi SP2D vs Akrual (matriks 2x2).
     - Menghitung persentase serapan nasional yang sah: `(Total SP2D Reguler + ABT) / (Total Pagu Reguler + ABT) * 100`.
  2. **Live Header Timestamp Telemetry**:
     - Memperbarui `bumpTxVersion()` di `data/SheetAccess.js` untuk mencatat metadata pembaruan terakhir (`METADATA_LAST_TX`) di `CacheService` dan `PropertiesService`.
     - Mengirimkan metadata ke klien lewat polling zero-sheet-read `app_getSyncState`.
     - Menampilkan indikator *"Data per: <Tanggal Jam WIB>"* pada navbar atas, dengan alert kuning jika data belum diperbarui >7 hari.
  3. **Simplifikasi Ikhtisar Selaras SiMata**:
     - Mengeliminasi *unnecessary visual bloat / clutter*: menghapus mini-waffle chart, heatmap seluler mikro, dan grafik donat ad-hoc yang tumpang tindih.
     - Menyusun halaman dalam 3 blok piramida: 4 KPI Card SiMata (`X — Y% dari total`), Peta Taktis WPP, dan Executive Monitoring Data Grid 8 unit kerja dengan status chip yang rapi.
  4. **Kompresi Kanvas Sisi Klien (Storage Protection Tier 1)**:
     - Mengimplementasikan fungsi kompresi gambar berbasis HTML5 Canvas di browser pada `html/Script_Main.html`.
     - Setiap foto bukti dukung otomatis di-resize menjadi maksimal lebar 1600px dengan kualitas JPEG 0.8 sebelum diunggah (mereduksi ukuran ~80% dari ~6MB menjadi <500KB).
     - Kebijakan video: mewajibkan penempelan tautan Google Drive / YouTube untuk berkas video >20MB.

---

### Fase 18 — Peta Taktis 34 Kapal Pengawas Ukuran Besar, Interlock Validasi Laik Laut, & Scoring Engine Kapal Terbaik Triwulanan

- **Status**: **Selesai (15 Oktober 2026)** (Termasuk Refinement UI: declutter radikal teks kartu podium Ship of the Period menjadi Apple-grade minimalis, integrasi akses modal langsung dari kartu Ikhtisar, serta paritas koordinat dan layer 34 kapal taktis di peta Operasi Laut).
- **Dependensi**: Fase 17 Selesai (Lunas).
- **Tujuan**: Membangun visualisasi peta taktis pemantauan khusus 34 Kapal Pengawas Ukuran Besar, menegakkan aturan interlock validasi kelaikan laut antar-modul, dan mengimplementasikan sistem gamifikasi penilaian Kapal Terbaik Triwulan.
- **Ruang Lingkup Deliverables**:
  1. **Peta Taktis 34 Kapal Pengawas Ukuran Besar (Screenshot 2 & 3)**:
     - Mengunci referensi armada taktis pada 34 kapal besar: 26 kapal operasional di WPP penugasan, 6 kapal siap operasi di pangkalan (Jakarta, Batam), dan 2 kapal pemeliharaan galangan (Jakarta, Lamongan).
     - Menambahkan layer marker kapal taktis Leaflet dengan siluet presisi, presence pulse, dan tooltip interaktif lengkap dengan koordinat posisi real-time (Lat, Lng), Komandan, WPP, dan Hari Layar YTD vs rata-rata nasional (44 hari) / pusat (49 hari).
     - Filter cepat status di atas peta: `[Semua (34)]` `[Operasional (26)]` `[Siap Pangkalan (6)]` `[Galangan (2)]` yang aktif di peta Ikhtisar dan peta Operasi Laut.
  2. **Interlock Validasi Laik Laut (Perawatan -> Operasi Laut)**:
     - Memvalidasi status kapal di `services/OperasiLautService.js`: jika kapal berstatus `TIDAK_SIAP` di modul Perawatan, form input hari layar mengunci kapal tersebut dan menampilkan banner peringatan kelaikan laut.
  3. **Scoring Engine & Podium Kapal Terbaik (Ship of the Period TW I–IV)**:
     - Algoritma penilaian murni keaktifan dan produktivitas operasi: `Skor = (0.40 * HariLayar) + (0.35 * PoinPenindakan) + (0.15 * VolumeRiksa) + (0.10 * Valuasi)`.
     - Normalisasi poin penindakan: KIA (bobot 15), KII Ilegal (bobot 5), Rumpon (bobot 3).
     - Tampilan antarmuka podium juara 1, 2, 3 (Emas, Perak, Perunggu) dengan desain visual 3D yang bersih dari teks berlebih ("decluttered", Apple-grade), terintegrasi langsung via kartu Ikhtisar (halaman sub-route `#kapal-terbaik`), dan tabel peringkat 34 kapal besar berkolom ringkas (8 kolom).

---

### Fase 18B — Revamp Suku Bagian Tata Usaha: Kepegawaian & Sistem Informasi Manajemen BMN Terpadu (Dedicated Spreadsheet Nautika_TU)

- **Status**: **Sedang Berjalan (Sub-Fase 18B.0 s/d 18B.4 Selesai; Sub-Fase 18B.5 Siap Dikerjakan)**.
- **Dependensi**: Fase 18 Selesai (Lunas).
- **Tujuan**: Membangun tata kelola mandiri Suku Bagian Tata Usaha melalui spreadsheet dedicated `Nautika_TU`, sistem manajemen kepegawaian 5 kategori (PNS, P3K, P3K Paruh Waktu, PJLP, Magang), sistem register fisik BMN per-item anti-jebret (Reguler vs Buku), dual-option geotagging UPT terdekat, notification summary kondisi kelaikan aset, dan siklus penghapusan legal Kemenkeu.
- **Ruang Lingkup Deliverables**:
  1. **Sub-Fase 18B.0 — Sinkronisasi Governance & Dokumen Teknis**: **Selesai**.
     - Sinkronisasi `PRD.md`, `ARCHITECTURE.md` (arsitektur spreadsheet `Nautika_TU`), `DATA_SCHEMA.md` (skema tabel `TX_TU_Pegawai`, `TX_BMN_Aset`, `TX_BMN_Penghapusan`, dll), dan `PHASES.md`.
  2. **Sub-Fase 18B.1 — Spreadsheet `Nautika_TU` & Sub-Modul Kepegawaian**: **Selesai**.
     - Inisialisasi spreadsheet `Nautika_TU` dan penambahan konstanta `SS_NAME.TU` & helper `openTuSheet()` di `data/SheetAccess.js`.
     - Backend & Frontend Kepegawaian: 5 counter KPI (PNS, P3K, P3K Paruh Waktu, PJLP, Magang), horizontal bar chart komposisi personil, form update cepat, snapshot carry-forward, dan riwayat mutasi pegawai.
  3. **Sub-Fase 18B.2 — Fondasi Register BMN di `Nautika_TU`**: **Selesai**.
     - Inisialisasi sheet `TX_BMN_Aset`, `Master_Lokasi_UPT`, `Master_BMN_Kategori`.
     - Backend [`BMNService.js`](file:///home/pinefeast/Projects/nautika/services/BMNService.js): CRUD aset berversi (append-only dengan `AsetID` UUID), query berhalaman server-side (server pagination), filter BMN Buku (Intrakomptabel) vs BMN Reguler (Ekstrakomptabel), perhitungan umur aset & masa manfaat on-read, matching UPT terdekat via Haversine.
     - Frontend UI di [`TataUsaha.html`](file:///home/pinefeast/Projects/nautika/html/views/TataUsaha.html): 4 KPI cards (Gross, Net, % Kelaikan, Antrean Hapus), Notification Summary Banner kondisi (Baik/Rusak Ringan/Rusak Berat), toggle segmented Buku vs Reguler, filter kondisi & UPT, live search, tabel register berpaginasi, in-page form create/edit (full view no popup), dan modal anulir berjejak audit.
  4. **Sub-Fase 18B.3 — Smart Bulk Import Engine SAKTI (Ditarik Maju dari Fase 19)**: **Selesai**.
     - Parser SheetJS on-demand di browser, kamus sinonim header BMN, dry-run validator di client, unduh template starter Excel, batch commit chunked via `bmn_importBatchAset()` dengan proteksi `LockService`. *(Engine ini siap di-reuse pada Fase 19 untuk kapal tangkapan Operasi Laut)*.
  5. **Sub-Fase 18B.4 — Engine Geotagging 2-Opsi (EXIF + Visual Watermark OCR), Zero-Emoji, & Standarisasi Tombol**: **Selesai**.
     - Opsi 1: Ekstraksi koordinat GPS otomatis dari metadata EXIF foto mentah via `exifr` sebelum kompresi kanvas.
     - Opsi 1B (Visual Watermark OCR Fallback): Pemindaian OCR sisi klien via `Tesseract.js` pada 35% area bawah foto (canvas crop) untuk mengekstrak koordinat stempel kamera ("GPS Map Camera" dsb) saat EXIF tidak tersedia atau terhapus, dengan status `SumberLokasi = 'OCR_STEMPEL'`.
     - Opsi 2: Fallback geolokasi perangkat pengunggah / lookup profil homebase satker.
     - Haversine matching real-time dua arah (client & server) ke 15 UPT dengan auto-select & verifikasi radius toleransi 25 km.
     - Kompresi kanvas foto fisik (max-width 1600px, JPEG 0.8) dan penyimpanan otomatis ke Drive + `TX_Evidence`.
     - Zero-Emoji Policy: Larangan keras emoji unicode di `DESIGN.md` §1 (Rule 18) dan pembersihan total (0 emoji) di seluruh antarmuka dan skrip sistem.
     - Standarisasi Geometri Tombol & Kontrol UI Lintas Modul: Penerapan sistem kontrol terpadu 3-tier container-driven (`LG: 40px`, `MD: 32px`, `SM: 26px`) via kontainer `.ctl-row`, `.ctl-lg`, `.ctl-sm`, `.ctl-stack` pada seluruh modul aplikasi, eliminasi benturan tinggi sebaris, dan penghapusan inline style geometry override (`DESIGN.md` §1 Rule 19 & §5.5, `ARCHITECTURE.md` §17.1).
  6. **Sub-Fase 18B.5 — Dashboard BMN, Notification Summary & Peta Sebaran UPT**:
     - Peta Leaflet sebaran konsentrasi aset di kantor pusat dan UPT daerah.
     - Penegakan kondisi fisik per-item (*anti-jebret*).
     - Notification Summary Banner di akhir: rekapitulasi aset Baik, Rusak Ringan, Rusak Berat, serta Actionable Alert untuk aset Rusak Berat kandidat penghapusan.
  7. **Sub-Fase 18B.6 — Siklus Penghapusan Legal Kemenkeu**:
     - State machine berkas usulan (`DRAFT_USULAN` → `SURAT_USULAN` → `PERSETUJUAN_KEMENKEU` → `SK_PENGHAPUSAN` → `BAST_SELESAI`).
     - Upload wajib dokumen nomor surat dan bukti dukung per tahap, karantina aset (`DALAM_PENGHAPUSAN`), dan eksekusi status akhir `DIHAPUS` tanpa menghapus jejak audit.
  8. **Sub-Fase 18B.7 — Validasi, Mobile Camera Test & Zero-Git Handover**:
     - Verifikasi integritas relasional, pengujian kamera mobile & EXIF di Android/iOS, AST check, dan laporan kesiapan commit/push untuk user.

---

### Fase 19 — Smart Bulk Import Engine Excel (High-Volume Ingestion) & Modular Sub-Context Divisi Teknis

- **Status**: **Siap Dikerjakan**.
- **Dependensi**: Fase 18B Selesai (Engine Bulk Import telah dibangun di Fase 18B.3 dan di-reuse di sini).
- **Tujuan**: Mengembangkan engine impor massal file Excel untuk memproses ratusan kapal tangkapan/riksa dalam hitungan detik, serta mendekonstruksi form raksasa "gabrug" pada 4 divisi operasional teknis menjadi form sub-konteks ringkas dan split history.
- **Ruang Lingkup Deliverables**:
  1. **Smart Bulk Import Engine (SheetJS & Batch Lock)**:
     - Pemuatan library SheetJS secara on-demand di browser, mendukung unggah berkas `.xlsx` dan copy-paste langsung dari spreadsheet (*paste grid*).
     - Algoritma *fuzzy synonym matching* untuk mengenali variasi penamaan header secara otomatis.
     - Validasi dua tahap: *Dry-Run Report* di browser (menyorot baris valid hijau dan baris galat merah) dan *Atomic Batch Insert* ke Google Sheets via `Range.setValues()` dalam 1 kali lock `< 4 detik`.
  2. **Dekonstruksi Sub-Konteks & Split History 4 Divisi Teknis**:
     - **Operasi Laut**: Sub-tab Hari Layar, Tangkapan KIA/KII (bulk import), Penertiban Rumpon, dan Volume Riksa.
     - **Operasi Udara**: Sub-tab Jam Terbang Patroli dan Kontak Pengawasan Maritim.
     - **Intelijen**: Sub-tab Dinamika Kawasan WPP dan Target Operasi Khusus.
     - **Pelayanan (SPKP/VMS)**: Sub-tab Kepatuhan Transmiter, Direktori Aktif Marabahaya (Distress), dan Evaluasi Vendor SPKP.
     - Setiap sub-konteks memiliki tabel riwayat tersendiri (*Split History Grid*) dengan fitur pencarian, filter, dan pagination ala SiMata.

---

### Fase 20 — Sistem Monitoring Paket Pekerjaan Lintas Divisi & Modular Sub-Context Divisi Pendukung

- **Status**: **Siap Dikerjakan**.
- **Dependensi**: Fase 19 Selesai.
- **Tujuan**: Menerapkan manajemen klasterisasi paket pekerjaan pengadaan/belanja lintas divisi serta menyelesaikan dekonstruksi sub-konteks form pada 4 unit kerja pendukung.
- **Ruang Lingkup Deliverables**:
  1. **Modul & Transaksi Paket Pekerjaan**:
     - Pembuatan sheet `Master_Paket` dan `TX_Paket_Progres` di database.
     - Pencatatan siklus 6 tahap: Persiapan, Pemilihan/Tender, Kontrak, Pelaksanaan Fisik, BAST, dan Selesai Bayar.
     - Tampilan matriks monitoring paket eksekutif di Ikhtisar dan tab monitoring paket di Tata Usaha.
  2. **Dekonstruksi Sub-Konteks & Split History 4 Divisi Pendukung**:
     - **Tata Usaha**: Sub-tab Realisasi SP2D/Akrual, Monitoring Paket Pekerjaan, dan PNBP/BMN.
     - **Perawatan**: Sub-tab Kesiapan 34 Kapal Besar, Pemeliharaan Docking, dan Item Suku Cadang (Harwat).
     - **Logistik**: Sub-tab BBM Kapal Pengawas (Reguler vs ABT), Riwayat Harga MOPS, dan Logistik Non-BBM.
     - **Pengawakan**: Sub-tab DSPP Formasi ABK dan Sertifikasi/Diklat Pelaut.
  3. **Harmonisasi Total Komponen DataTables SiMata**:
     - Standardisasi seluruh grid tabel pada 8 modul divisi: dropdown entries per page, search bar instan, sortable header, status chips warna lembut, dan ekspor data.

---

### Fase 21 — Pipeline Data Mart Looker Studio, Ekspor/Backfill Laporan Historis, & Finalisasi PRD Timja

- **Status**: **Siap Dikerjakan**.
- **Dependensi**: Fase 20 Selesai.
- **Tujuan**: Membangun pipeline pelaporan otomatis ke Looker Studio, menyediakan template ekspor dan ingesti laporan historis (*lenient backfill*), serta memfinalisasi dokumen PRD bersama Timja.
- **Ruang Lingkup Deliverables**:
  1. **Pipeline Data Mart Looker Studio**:
     - Pembuatan spreadsheet terpisah `Nautika_Reporting_Looker` berisi tabel flat bersih: `Mart_Ikhtisar_Nasional`, `Mart_Kinerja_Armada_34Kapal`, `Mart_Anggaran_Paket`, dan `Mart_Peta_Operasi`.
     - Script cron ETL (atau webhook pasca-transaksi) yang mengekstrak hanya data berstatus `ACTIVE` dan mengagregasi nilai YTD/TW tanpa risiko penghitungan ganda.
     - Template dashboard resmi Looker Studio dengan fitur ekspor PDF terjadwal untuk pimpinan KKP.
  2. **Ekspor & Ingesti Laporan Historis (Lenient Backfill Mode)**:
     - Fitur unduh template Excel resmi per sub-konteks untuk pelaporan manual.
     - Mesin ingesti data lama (2023–2025) dengan validasi toleran (*lenient mode*) yang mengubah galat format non-kritis menjadi peringatan dan menandai status audit `LEGACY_VERIFIED`.
  3. **Finalisasi Governance PRD Bersama Timja**:
     - Pengesahan instrumen wawancara PIC 8 Timja untuk memastikan seluruh field form lapangan terkunci dan bebas inkonstansi.

---

### Tahap Akhir (Di Luar Fase) — Final Systemwide Audit & Definition of Done

Tahap audit komprehensif seluruh sistem untuk memverifikasi kesiapan rilis penuh (*production readiness*).

- **Status**: **Standby (Hanya Berjalan Saat Diminta)**.
- **Aturan Pemicu (Trigger Rule — Instruksi User 12 Okt 2026)**:
  - Tahap ini **TIDAK memiliki nomor fase** dan **TIDAK memblokir fase fitur apa pun**.
  - Agent **DILARANG** menjalankan audit ini di sela-sela fase atau sebelum fase roadmap selesai.
  - Tahap ini **HANYA** akan dieksekusi jika kedua syarat ini terpenuhi:
    1. Seluruh fase pengembangan dalam roadmap (termasuk Fase 15 dan fase sesudahnya jika ada) telah berstatus **Selesai**.
    2. User memberikan instruksi eksplisit untuk *"lanjut"* saat sudah tidak ada lagi fase pengembangan yang tersisa.
- **Ruang Lingkup Pemeriksaan (Definition of Done — [`AGENTS.md` §6](file:///home/pinefeast/Projects/nautika/AGENTS.md#L60-L75))**:
  1. **Audit Form & Dropdown Relasional**: Pastikan semua form di 9 divisi + Kegiatan Pendukung memakai pemilih relasional (Kapal, WPP, Kawasan Konservasi dari Master Data), bebas free-text liar.
  2. **Validasi Server-Side**: Pemeriksaan ketat bahwa seluruh kalkulasi, pengecekan keabsahan data, dan pembatasan scope dijalankan di Google Apps Script (Apps Script = single source of truth).
  3. **Penegakan RBAC**: Staf & Kadiv hanya memiliki hak CRUD pada divisinya; Direktur & Superadmin beroperasi lintas divisi.
  4. **Versioning & Audit Trail**: Setiap transaksi perubahan memakai mekanisme `SUPERSEDED` dan pembatalan memakai `VOID`, tercatat lengkap dengan `UserID`, `Timestamp`, dan `Alasan`.
  5. **Akumulasi Otomatis**: Verifikasi agregasi mingguan -> bulanan -> YTD dihitung sistem di backend tanpa intervensi manual.
  6. **Evidence Dual-Mode**: Unggah berkas langsung dan penyalinan tautan Google Drive tersimpan rapi pada struktur folder Drive yang benar.
  7. **Kepatuhan Desain & Visualisasi**: Tidak ada pelanggaran negative prompt ([`DESIGN.md` §1](file:///home/pinefeast/Projects/nautika/DESIGN.md)), palet warna semantik konsisten, chart sesuai tipologi data ([`DESIGN.md` §6](file:///home/pinefeast/Projects/nautika/DESIGN.md)).
  8. **Global Filter Integration**: Filter periode (bulanan / rentang tanggal) terbukti mengendalikan seluruh tampilan aktif secara sinkron.

---

Mulai dari **Fase 0** sekarang: baca dokumen-dokumen yang disebutkan, lalu berikan rangkuman pemahamanmu ke saya sebelum menyentuh kode apa pun.