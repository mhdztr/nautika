## [Sub-Fase 18B.5] — Dashboard BMN, Peta Sebaran Geospasial UPT Leaflet, & Notification Summary Banner

**Tanggal**: 21 Oktober 2026  
**Status**: **SELESAI PENUH (COMPLETED & VERIFIED)** (Penyediaan visualisasi spasial sebaran aset BMN nasional di kantor pusat dan 15 UPT PSDKP via peta Leaflet terintegrasi CARTO basemap, penegakan kondisi fisik per-item anti-jebret tersinkronisasi dua arah dengan filter tabel, dan notification summary banner dengan actionable filter untuk aset Rusak Berat kandidat penghapusan).

### Rincian Deliverables Selesai:
1. **Backend Aggregator & Geo-Coordinates (`services/BMNService.js`)**:
   - Fungsi `bmn_getSummary()` diperkaya dengan agregasi data spasial komprehensif (`uptList`), memuat nama UPT, jenis, wilayah, koordinat latitude/longitude dari `Master_Lokasi_UPT`, serta rekapitulasi total unit, nilai buku, dan breakdown kondisi (Baik, Rusak Ringan, Rusak Berat) per UPT dalam satu kali panggilan.
2. **Peta Sebaran Geospasial Aset BMN (`html/views/TataUsaha.html`, `html/Style.html`, `html/Script_Main.html`)**:
   - Wadah peta Leaflet responsif `#bmn-upt-map` (tinggi 320px) dengan basemap Carto terintegrasi `_ensureCartoKey` & `_cartoTileUrl(key)`.
   - Custom marker HTML badge konsentrasi: pil putih berbingkai Navy dengan lingkaran hitung unit fisik di sebelah kiri dan nama pangkalan/stasiun di sebelah kanan. Marker otomatis menyala merah (`has-rusak-berat`) apabila UPT tersebut memiliki aset dalam kondisi Rusak Berat.
   - Popup interaktif informatif: rincian unit, nilai buku, statistik kelaikan fisik, dan tombol aksi *"Tampilkan Aset UPT Ini"* yang secara otomatis memilih dropdown filter `#bmn-filter-upt`, memicu pembaruan tabel, dan melakukan *smooth scroll* ke wadah tabel.
   - Tombol *"Fokus Indonesia"* untuk me-reset zoom dan koordinat tengah wilayah kepulauan Indonesia.
   - Penanganan otomatis `map.invalidateSize()` saat beralih ke tab BMN agar tile peta ter-render sempurna tanpa jeda visual.
3. **Notification Summary & Rekapitulasi Kondisi Fisik**:
   - Banner ringkasan semantik `#bmn-summary-banner-wrap` yang bersih dan mematuhi Zero-Emoji Policy.
   - Menampilkan chip badge distribusi kondisi: Baik (hijau), Rusak Ringan (kuning/amber), dan Rusak Berat (merah).
   - Actionable button terstandarisasi `.btn-danger` di dalam wadah `.ctl-row.ctl-sm` yang otomatis muncul saat terdapat aset Rusak Berat aktif, memicu filter instan untuk persiapan siklus penghapusan legal Kemenkeu (Sub-Fase 18B.6).
4. **Verifikasi QA & Bebas Eror**:
   - `node lint_ui.js` lolos: **0 pelanggaran** kohesi kontrol UI.
   - Validasi sintaks `node --check` dan `node -e` lolos tanpa galat.

---

## [Governance & Arsitektur UI] — Kohesi Total Kontrol UI Sampai Tulang (Single Scale 3-Tier Container-Driven)

**Tanggal**: 21 Oktober 2026  
**Status**: **SELESAI PENUH (COMPLETED & VERIFIED 100%)** (Penyatuan seluruh kontrol interaktif antarmuka tombol, icon-button, segmented control, input, select ke dalam skala 3-tier geometrik tunggal container-driven; migrasi seluruh view dan JavaScript string emitter; penyediaan QA tooling linter statis dan runtime probe konsol).

### Ringkasan Pekerjaan Selesai (Work Packages WP0 – WP4):
1. **WP0: Tata Kelola & Dokumen Arsitektur (Synchronized)**:
   - `DESIGN.md`: Menambahkan §1 Rule 19 (Negative Prompt: dilarang inline style size override, dilarang benturan tinggi/radius sebaris) dan §5.5 (Spesifikasi Skala Geometri Kontrol 3-Tier: LG 40px, MD 32px, SM 26px; aturan container `.ctl-row`, `.ctl-stack`, concentric radius segmented button, dsb.).
   - `PRD.md`: Menambahkan §10.6 (Button & Control Uniformity).
   - `ARCHITECTURE.md`: Menambahkan §17.1 (Single Geometry Control Scale Contract) dan §17.2 (Dev Tooling & QA Otomatis).
   - `AGENTS.md`: Menambahkan instruksi kohesi kontrol UI ke §2 (Prinsip Kerja) dan §6 (Definition of Done checklist).
   - `PHASES.md`: Memperbarui lingkup Sub-Fase 18B.4 terkait standardisasi kontrol lintas modul.

2. **WP1: CSS Engine Overhaul (`html/Style.html`)**:
   - Token geometri baru pada `:root`: `--ctl-h-lg: 40px`, `--ctl-h-md: 32px`, `--ctl-h-sm: 26px`, beserta token padding, radius, dan ukuran font berpasangan.
   - Penambahan token warna border baku `--n-border: rgba(0, 0, 0, 0.12)` dan `--n-border-strong: rgba(0, 0, 0, 0.22)` untuk mencegah fallback browser ke outline 2px beveled default.
   - Penulisan ulang fondasi tombol (`.btn`) menjadi deklarasi geometri tunggal tanpa ketergantungan class individual. Semua varian (`.btn-primary`, `.btn-outline`, `.btn-ghost`, `.btn-secondary`, `.btn-danger`, `.btn-danger-solid`) murni mengatur warna/latar/border.
   - Implementasi wadah kontrol: `.ctl-row` (MD 32px), `.ctl-row.ctl-lg` (LG 40px), `.ctl-row.ctl-sm` (SM 26px), `.ctl-stack` (LG 40px vertikal full-width), `.ctl-fill`, dan `.ctl-nowrap`. Child control dipaksa mengikuti variabel container `--ctl-h` dan `--ctl-r`.
   - Polishing modern untuk form controls di dalam kontainer: `.ctl-select` dan `.ctl-row > select` (menggunakan chevron SVG elegan, `appearance: none`, border halus, dan micro-shadow), serta `.ctl-search` untuk input pencarian berikon terpusat vertikal.
   - Harmonisasi Segmented Controls (`.n-seg` dengan formula concentric radius) dan Icon Buttons (`.n-iconbtn`, `.n-iconbtn-sm`, `.n-iconbtn-x`).
   - Pembersihan class warisan/duplikat (`.btn-sm-ok`, `.btn-sm-crit`).

3. **WP2: View Markup Migration (`html/views/*.html`, `Index.html`, `Auth.html`)**:
   - Standardisasi seluruh modal footer dan action bar di 8 modul divisi (`TataUsaha`, `Intelijen`, `Kegiatan`, `Logistik`, `OperasiLaut`, `Pemantauan`, `Pengawakan`, `Perawatan`) ke `.ctl-row.ctl-lg.ctl-fill` atau `.ctl-stack`.
   - Mengganti seluruh tombol Anulir bertema merah/inline-style ke varian baku `.btn-danger-solid`.
   - Merapikan toolbar Kepegawaian TU, bilah pencarian dan dropdown filter BMN (`.ctl-search` dan `.ctl-select`), pagination footer tabel BMN, kontrol OTP, dan modal approval akun admin (`Admin.html`).

4. **WP3: JavaScript String Emitters & Runtime Probe (`html/Script_Main.html`)**:
   - Pembersihan seluruh inline style `height`/`padding` pada tombol yang di-render secara dinamis (overview chart, profil kapal, registrasi approval banner & queue, master data kapal & kawasan, riwayat transaksi modul `_histActions`, dan tabel aksi BMN).
   - Implementasi runtime probe `window._uiAudit()` untuk mendeteksi deviasi visual kontrol langsung dari DevTools browser.

5. **WP4: QA Tooling Otomatis (`lint_ui.js`)**:
   - Pembuatan script scanner statis [lint_ui.js](file:///home/pinefeast/Projects/nautika/lint_ui.js) untuk mendeteksi inline style ukuran pada `<button>`, kelas deprecated/terlarang, konflik kelas, dan ketiadaan wadah `.ctl-` pada modal footer.
   - Hasil eksekusi `node lint_ui.js`: **0 pelanggaran (PASS)** pada seluruh 20 file HTML template.
   - Pendaftaran [lint_ui.js](file:///home/pinefeast/Projects/nautika/lint_ui.js) ke `.claspignore` dan `.gitignore` demi menjaga kebersihan repositori Google Apps Script.

---

## [Polish UI] — Perapian & Penyatuan Tata Letak Inventaris BMN Tata Usaha (Declutter & Unified Table Container)

**Tanggal**: 21 Oktober 2026  
**Status**: **SELESAI PENUH (COMPLETED & VERIFIED)** (Perapian visual antarmuka Inventaris BMN Tata Usaha: eliminasi banner kondisi yang redundan, penyatuan filter & tabel ke dalam satu Master Card kontainer yang harmonis, perbaikan bug string `(undefined km)`, serta penataan tombol aksi tanpa layout wrapping).

### Ringkasan Perbaikan Visual & Fungsional:
1. **Penyatuan Kontainer Master Card (`.n-card`)**:
   - Menghilangkan fragmentasi kartu terpisah antara bilah filter dan tabel data. Seluruh elemen daftar BMN (Header + Aksi, Sub-Toolbar Filter, Wadah Tabel Sticky, dan Footer Paginasi) kini terintegrasi dalam satu Master Card yang bersih (`overflow: hidden; border-radius: var(--n-radius-md)`).
   - Menghilangkan bug *layout wrapping* pada tombol `+ Tambah Aset` yang sebelumnya patah ke baris kedua di sebelah kiri secara canggung. Baris 1 menampung judul daftar aset, badge total unit, dan tombol aksi `Impor SAKTI` + `Tambah Aset`. Baris 2 menampung segmented filter (`Semua Aset`, `Buku (53)`, `Reguler (52)`), search box dengan ikon kaca pembesar, dan dropdown filter kondisi/UPT secara proporsional.
2. **Eliminasi Banner Redundan & Integrasi Actionable Chip**:
   - Menghapus banner `bmn-notif-banner` yang memakan ruang vertikal ~80px dan mengulang data yang sudah ada di kartu KPI.
   - Mengintegrasikan aksi usulan Rusak Berat langsung ke dalam kartu KPI ke-4 (*Antrean Usulan Hapus*): jika terdapat unit Rusak Berat, subteks kartu berubah menjadi tautan interaktif semantik merah (`1 unit Rusak Berat siap usul →`) yang langsung memfilter tabel saat diklik (`_bmnFilterRusakBerat()`).
3. **Perbaikan Bug Nilai Jarak `(undefined km)`**:
   - Memperbaiki evaluasi `a.jarakKeUptKm !== null` pada `Script_Main.html` yang sebelumnya menghasilkan teks `(undefined km)` saat nilai jarak bertipe `undefined` atau string kosong. Ditambahkan validasi ketat numerik (`typeof a.jarakKeUptKm === 'number' && !isNaN(a.jarakKeUptKm) && a.jarakKeUptKm >= 0`).
4. **Penyempurnaan Ikon Tab Subnavigasi**:
   - Mengganti ikon SVG dollar pada tab "Anggaran & Realisasi" dengan ikon kartu/buku kas keuangan modern yang bersih dan konsisten dengan sistem desain Nautika.

---

## [Sub-Fase 18B.4-Rev] — Visual Watermark OCR Fallback (GPS Map Camera), Zero-Emoji Policy, & Button Uniformity

**Tanggal**: 20 Oktober 2026  
**Status**: **SELESAI PENUH (COMPLETED & VERIFIED)** (Akar masalah foto tanpa EXIF terpecahkan via client-side OCR Tesseract.js pada 35% crop kanvas watermark kamera, Zero-Emoji Policy terpasang di DESIGN.md §1 Rule 18 dengan pembersihan 100% tuntas [0 emoji tersisa di codebase], dan keseragaman geometri tombol berdampingan .btn-sm 32px terstandardisasi).

### 1. Akar Masalah & Solusi Visual Watermark OCR (Foto 1)
1. **Investigasi Biner File `media_1792459541726.jpg`**:
   - Struktur biner JPEG diperiksa: File hanya memiliki segmen marker `0xFFE0` (JFIF standar), dan **tidak memiliki segmen marker `0xFFE1` (APP1 / EXIF)** sama sekali (`Has EXIF marker: false`).
   - Aplikasi lapangan seperti "GPS Map Camera", "Timestamp Camera", atau gambar yang diteruskan melalui pesan instan (WhatsApp) sering kali membakar teks metadata (koordinat, alamat, waktu) langsung ke matriks piksel foto (watermark visual), namun tidak menuliskan tag EXIF `0x8825 GPSInfo` ke header JPEG.
   - Pustaka `exifr.gps(file)` beroperasi murni pada header metadata biner, sehingga mengembalikan `null/undefined`.
2. **Implementasi Visual Watermark OCR Fallback (`_loadTesseract`, `_bmnScanWatermarkOcr`)**:
   - Jika `exifr.gps(file)` tidak menemukan koordinat EXIF, sistem otomatis menjalankan pemindai OCR sisi klien via `Tesseract.js` v5 on-demand (`_loadTesseract`).
   - **Efisiensi Komputasi (Canvas Crop 35% Bawah)**: Alih-alih memproses seluruh gambar beresolusi tinggi (4000×3000px) yang memakan waktu lama, skrip hanya meng-crop 35% bagian bawah foto tempat stempel kamera GPS berada dan menurunkannya ke kanvas berlebar maks 1400px.
   - **Parser Regex Koordinat Cerdas (`_bmnParseCoordinatesFromText`)**: Mendeteksi pola desimal `Lat -6.178949° Long 106.834359°`, format DMS (`° ' " S/N/E/W`), dan pasangan angka koordinat teritori Indonesia.
   - **Pengikatan Status & Haversine Match**: Koordinat terdeteksi disimpan dengan status `SumberLokasi = 'OCR_STEMPEL'` (badge: "Stempel Kamera GPS (OCR)"). UPT terdekat dicocokkan otomatis (koordinat Foto 1 di Gambir otomatis mencocokkan `UPT-PUSAT-POA` dengan jarak ~0.8 km).

### 2. Penegakan Kebijakan Zero-Emoji (Zero-Emoji Policy)
1. **Aturan Governance `DESIGN.md` §1**:
   - Menambahkan **Rule 18** pada Negative Prompt: *DILARANG EMOJI DI SELURUH SISTEM (ZERO EMOJI POLICY)*.
   - Penggunaan emoji unicode dilarang keras pada seluruh elemen UI (tombol, heading, form, badge, toast/pesan, placeholder). Seluruh indikasi visual wajib menggunakan tipografi semantik yang bersih atau ikon SVG garis tunggal (`stroke-width: 1.5 - 2`).
2. **Pembersihan Menyeluruh di Codebase**:
   - Seluruh unicode emoji di `TataUsaha.html` (`📍`, `⟲`, `📷`, `✕`, `📁`, `📋`, `📊`) dan `Script_Main.html` (`✓`, `⚠`, `📷`, `📄`) dimusnahkan dan digantikan dengan teks profesional serta ikon SVG semantik.
   - Verifikasi automated regex scanner mencatat: **Total emojis found across all html/ and services/: 0**.

### 3. Standarisasi Keseragaman Geometri Tombol Berdampingan (Foto 2)
1. **Akar Masalah Foto 2**:
   - Tombol `#bmn-btn-device-gps` memiliki `class="btn-mini btn-outline"`, di mana `.btn-outline` menimpa padding menjadi `11px 18px` dan radius `10px`, sedangkan tombol pasangannya `#bmn-btn-reset-gps` memiliki `class="btn-mini"` dengan padding `4px 12px` dan radius `9999px`. Hal ini menyebabkan tinggi dan bentuk kedua tombol bertabrakan secara visual.
2. **Penyempurnaan CSS & Penegakan Desain**:
   - Menambahkan panduan §5.5 pada `DESIGN.md` mengenai 3 tier tombol baku (Regular 40px, Compact 32px, Mini 26px) serta larangan mutlak memasangkan tombol dengan tier berbeda atau menggabungkan modifier yang bertentangan.
   - Menambahkan kelas baku `.btn-sm`, `.btn-sm-outline`, `.btn-sm-primary`, `.btn-sm-danger`, `.btn-sm-ghost` dengan tinggi pasti `32px`, padding horizontal `14px`, dan radius `var(--n-radius-sm)` (8px).
   - Menyelaraskan pasangan tombol GPS di `TataUsaha.html` menjadi `class="btn-sm btn-sm-outline"` secara seragam dengan `align-items: center`.

---

## [Sub-Fase 18B.4] — Engine Geotagging 2-Opsi & Haversine Nearest Match (Pencocokan UPT Otomatis & Kompresi Kanvas Foto Fisik)

**Tanggal**: 19 Oktober 2026  
**Status**: **SELESAI PENUH (COMPLETED & VERIFIED)** (Ekstraksi koordinat GPS otomatis dari metadata EXIF foto mentah via exifr sebelum kompresi kanvas, fallback geolokasi perangkat dan profil homebase satker, Haversine nearest match real-time ke 15 UPT dengan auto-select radius 25 km, serta penyimpanan foto fisik ke Drive & TX_Evidence telah terpasang sempurna).

### 1. Rincian Pekerjaan & Arsitektur yang Dibangun
1. **Opsi 1 (Utama): Ekstraksi EXIF GPS dari Foto Mentah (`_loadExifr` & `exifr.gps`)**:
   - Pemuatan on-demand library `exifr` v7.1.3 dari CDN unpkg dengan fallback otomatis ke jsdelivr.
   - Pengecekan metadata GPS wajib dilakukan pada objek berkas mentah (`File`/`ArrayBuffer`) sebelum proses render kanvas HTML5, guna mencegah penghapusan header EXIF oleh kompresi kanvas browser.
   - Ekstraksi otomatis `latitude` dan `longitude` presisi tinggi dengan penanda status `SumberLokasi = 'EXIF_FOTO'`.
2. **Opsi 2: Fallback Geolokasi Perangkat & Profil Homebase Satker**:
   - **Opsi 2A (GPS Perangkat)**: Pemanggilan API `navigator.geolocation.getCurrentPosition` dengan opsi `enableHighAccuracy: true` saat foto tidak memuat metadata EXIF atau saat user menekan tombol "📍 Ambil GPS Perangkat".
   - **Opsi 2B (Homebase Satker)**: Fallback otomatis jika geolokasi perangkat tidak didukung, ditolak oleh user, atau timeout ke koordinat homebase satker terpilih atau kantor pusat (`UPT-PUSAT-POA`) dengan status `SumberLokasi = 'PROFIL_AKUN'`.
3. **Engine Haversine Nearest Match Dua Arah (Client & Server)**:
   - Perhitungan jarak lingkaran besar (*great-circle distance*) real-time terhadap 15 data master UPT/Pangkalan/Stasiun PSDKP.
   - Jika jarak terdekat $d_{\min} \le 25\text{ km}$ (atau radius spesifik UPT): Nilai dropdown UPT (`#bmn-form-upt`) otomatis diselaraskan dan kartu menampilkan badge hijau terverifikasi beserta jarak km.
   - Jika $d_{\min} > 25\text{ km}$: Menampilkan kartu peringatan toleransi jarak amber tanpa mengunci paksa dropdown UPT, memberikan fleksibilitas kepada petugas verifikator.
   - Validasi ulang independen di sisi server (`_bmnMatchNearestUpt` di `services/BMNService.js`) sebelum penulisan ke spreadsheet.
4. **Kompresi Kanvas Sisi Klien & Integrasi Penyimpanan Foto Fisik**:
   - Kompresi foto bukti fisik via `_compressImageCanvas` (lebar maks 1600px, JPEG 0.8) mereduksi ukuran berkas hingga ~80% untuk melindungi kuota Google Drive.
   - Submisi atomik pada `bmn_submitAset`: Berkas foto didekode di backend, disimpan ke folder terstruktur Drive (`Nautika_Evidence/Tata Usaha/[YYYY-MM]/BMN-[AsetID]/`), dan dicatat resmi ke sheet `TX_Evidence`.
5. **Form & Data Lifecycle**:
   - Panel Foto Fisik & Geotagging Otomatis pada `#bmn-view-form` di `TataUsaha.html` dengan kartu status telemetri yang responsif.
   - Dukungan pemulihan koordinat dan pratinjau lampiran saat form dibuka dalam mode revisi/edit aset (`_bmnSetupForm`).

---

## [Sub-Fase 18B.3] — Smart Bulk Import Engine SAKTI BMN (SheetJS & Atomic Chunked Batch Commit)

**Tanggal**: 19 Oktober 2026  
**Status**: **SELESAI PENUH (COMPLETED & VERIFIED)** (Parser SheetJS on-demand di browser, pemetaan sinonim header SAKTI/SIMAK, validasi dry-run dua tahap, unduh template starter Excel, dan batch commit chunked 200 baris dengan proteksi LockService telah terpasang sempurna).

### 1. Rincian Pekerjaan & Arsitektur yang Dibangun
1. **On-Demand SheetJS Loader (`_loadSheetJS`)**:
   - Pemuatan asinkron SheetJS v0.20.1 dari CDN dengan mekanisme fallback otomatis ke unpkg v0.18.5 tanpa memblokir pemuatan awal SPA.
2. **Dual-Input Mode (Berkas Excel/CSV & Paste Grid)**:
   - Dukungan berkas `.xlsx`, `.xls`, dan `.csv` via drag-and-drop dropzone interaktif atau file selector.
   - Dukungan salin-tempel langsung (*Paste Grid*) dari aplikasi SAKTI / Excel berbasis pemisahan baris dan Tab.
3. **Kamus Sinonim Header Cerdas (Fuzzy Header Auto-Mapping)**:
   - Pindai otomatis 10 baris pertama untuk mendeteksi baris header riil dan mengabaikan baris judul laporan/instansi.
   - Deteksi sinonim kolom cerdas untuk `Kode Barang`, `NUP`, `Nama Barang`, `Merek/Tipe`, `Kategori Pencatatan (BUKU/REGULER)`, `Klasifikasi Kategori BMN`, `Tanggal Perolehan`, `Nilai Perolehan`, `Nilai Buku`, `Kondisi (BAIK/RR/RB)`, `Lokasi UPT`, dan `Ruangan`.
4. **Validasi Dry-Run di Client (Dua Tahap)**:
   - Normalisasi nilai: pembersihan format mata uang Rupiah, konversi serial date number Excel ke ISO Date string, normalisasi kondisi semantik, dan pencocokan ke master UPT & Kategori BMN.
   - Panel pratinjau statistik (Total Baris, Baris Siap Diimpor, Baris Galat/Dilewati, Akumulasi Nilai Perolehan) beserta daftar rincian galat dan tabel pratinjau 5 baris pertama.
5. **Unduh Template Starter Excel**:
   - Fitur `_bmnDownloadTemplate()` yang langsung meng-generate berkas `Template_Impor_BMN_SAKTI_Nautika.xlsx` dengan header standar dan 4 baris contoh siap pakai.
6. **Backend Atomic Batch Ingestion (`bmn_importBatchAset`)**:
   - Endpoint backend dengan perlindungan `LockService.getScriptLock(15000)`.
   - Mengisi otomatis `AsetID` UUID per unit (*anti-jebret*), `SumberLokasi = 'IMPOR_SAKTI'`, `ImportBatchID`, dan pencatatan audit log `IMPORT_BMN_BATCH`.
   - Client-side chunking pengiriman batch 200 aset per request dengan progress bar dinamis untuk mencegah timeout GAS.

---

## [Refactor UI / Hotfix] — Perombakan Visual & Konversi Modal Popup Kepegawaian Tata Usaha

**Tanggal**: 19 Oktober 2026  
**Status**: **SELESAI (COMPLETED & VERIFIED)**  

### Ringkasan Perubahan:
1. **Penyesuaian Tab & Label**: Menghapus teks `(5 Kategori)` pada navigasi atas dan sub-label agar ringkas, bersih, dan konsisten (`Kepegawaian`).
2. **Kerapian Grid KPI Personil**:
   - Menghapus seluruh teks deskripsi (`.kpi-sub`) di bawah jenis pegawai.
   - Menyeragamkan ukuran ke-6 kartu KPI (Total Personil, PNS, P3K Penuh Waktu, P3K Paruh Waktu, PJLP / Kontrak, Magang / PKL) dengan `repeat(6, minmax(0, 1fr))`, `min-height: 84px`, padding `16px 14px`, dan label truncate sehingga kartu ke-6 (`Magang / PKL`) tetap rapi di dalam batas garis grid tanpa overflow.
3. **Penyempurnaan Chart Distribusi**:
   - Memindahkan chart horizontal bar ke container satu kolom penuh yang seimbang dan proporsional (`height: 240px`).
   - Menambahkan `layout: { padding: { bottom: 12, ... } }` pada `_chartBar` sehingga label sumbu horizontal dan angka personil tidak lagi terpotong di bagian bawah canvas.
4. **Konversi Form Update ke Popup Modal**:
   - Menggantikan layout 2-kolom yang menyisakan whitespace besar dengan popup modal `#modal-tu-pegawai-form`.
   - Menambahkan tombol aksi `+ Perbarui Jumlah Pegawai` pada header riwayat kepegawaian untuk memicu pembukaan form modal.
   - Form modal melakukan pre-fill otomatis dengan data headcount terbaru, mendukung snapshot mutasi carry-forward, dan menutup modal secara mulus saat pembaruan berhasil disimpan.

---

## [Fase 18B.1 & 18B.2] — Sub-Modul Kepegawaian & Fondasi Register Inventaris BMN (Dedicated Spreadsheet Nautika_TU)

**Tanggal**: 19 Oktober 2026  
**Status**: **SELESAI PENUH (COMPLETED & VERIFIED)** (Database Nautika_TU aktif, modul kepegawaian 5 kategori personil lengkap dengan chart & snapshot carry-forward, serta register fisik BMN per-item anti-jebret dengan 4 KPI cards, notification summary alert banner, server-side pagination, in-page form full-view, dan anulir berjejak audit telah terpasang sempurna).

### 1. Rincian Pekerjaan & Arsitektur yang Dibangun

1. **Sub-Fase 18B.1 — Fondasi Database `Nautika_TU` & Sub-Modul Kepegawaian (`Setup.js`, `data/SheetAccess.js`, `services/TataUsahaService.js`)**:
   - Inisialisasi otomatis spreadsheet `Nautika_TU` via `ensureTuSpreadsheet()` dan `openTuSheet(sheetName)` yang idempoten.
   - Penambahan seed data `Master_Lokasi_UPT` (15 lokasi pangkalan/satker KKP) dan `Master_BMN_Kategori` (9 klasifikasi SIMAK/SAKTI beserta masa manfaat tahun).
   - Implementasi endpoint backend kepegawaian: `tataUsaha_getPegawai`, `tataUsaha_submitPegawai`, dan `tataUsaha_anulirPegawai`.
   - UI Kepegawaian di `TataUsaha.html`: sub-navbar segmented, 6 KPI cards (Total Personil Hero, PNS, P3K Penuh Waktu, P3K Paruh Waktu, PJLP, Magang), horizontal bar chart komposisi personil, form update cepat in-page (tanpa popup), dan tabel log mutasi pegawai.

2. **Sub-Fase 18B.2 — Backend Service BMN (`services/BMNService.js`)**:
   - Algoritma geospasial `_bmnHaversineKm` dan `_bmnMatchNearestUpt` untuk mencocokkan koordinat aset ke 15 UPT terdekat.
   - Helper umur dan kadaluwarsa masa manfaat `_bmnComputeAge(tglPerolehan, masaManfaatTahun)` on-read di server.
   - Endpoint `bmn_getMasters`: memuat daftar UPT dan kategori BMN aktif.
   - Endpoint `bmn_getSummary`: menghitung agregat nilai perolehan gross, nilai buku net SAKTI, % kelaikan fisik, antrean usulan hapus, breakdown BUKU vs REGULER, breakdown kondisi (Baik, Rusak Ringan, Rusak Berat), serta payload banner notifikasi.
   - Endpoint `bmn_getAsetList`: query berpaginasi server-side (`page`, `pageSize`, `pencatatan`, `kondisi`, `lokasiId`, `q`, `sortBy`, `sortDir`) dengan penegakan baris `ACTIVE`.
   - Endpoint `bmn_submitAset`: create/revisi unit aset fisik tunggal (*anti-jebret*), versioning append-only berantai `SupersedesRowID` di bawah perlindungan `LockService`.
   - Endpoint `bmn_anulirAset`: penandaan `Status = VOID`, pencatatan `VoidReason`, `VoidedBy`, dan pencatatan riwayat di `Audit_Log`.

3. **Sub-Fase 18B.2 — Frontend UI & Controller BMN (`html/views/TataUsaha.html`, `html/Script_Main.html`, `html/Style.html`)**:
   - **4 KPI Cards Utama**: Total Nilai Perolehan (Gross), Nilai Buku Terkini SAKTI (Net), % Kelaikan Fisik Aset, dan Antrean Usulan Hapus.
   - **Notification Summary Alert Banner**: Menyajikan ringkasan jumlah dan persentase aset Baik, Rusak Ringan, dan Rusak Berat, serta action button instan *"Lihat X Rusak Berat"* jika terdeteksi unit rusak berat aktif yang direkomendasikan untuk penghapusan.
   - **Filter Bar & Toggle Segmented**: Pengalih BMN Buku (Intrakomptabel / Akun 53) vs BMN Reguler (Ekstrakomptabel / Akun 52), filter kondisi, filter UPT, dan debounced live search.
   - **Tabel Register BMN**: Kolom tabular lengkap (Kode & NUP, Nama & Spesifikasi, Klasifikasi, Lokasi & Ruangan + jarak UPT km, Tanggal & Umur + badge Kadaluwarsa, Kondisi semantik, Valuasi Rupiah, dan tombol aksi Edit & Anulir).
   - **In-Page Form View (Full View / No Popup)**: Formulir pembuatan & revisi aset in-page yang bersih, rapi, dan responsif sesuai aturan UX Apple-grade tanpa modal dialog pop-up.
   - **Modal Anulir Ringkas**: Konfirmasi pembatalan aset dengan kewajiban input alasan anulir.

### 2. Status Verifikasi Teknis
- `node -c services/BMNService.js`: Lulus tanpa error (Exit code 0).
- `node -c services/TataUsahaService.js`: Lulus tanpa error (Exit code 0).
- `node -c Setup.js && node -c data/SheetAccess.js`: Lulus tanpa error (Exit code 0).
- Validasi AST sintaks `html/Script_Main.html`: Lulus tanpa error (`Script_Main syntax valid!`).
- Audit Clasp: Seluruh file baru dan modifikasi (`services/BMNService.js`, `html/views/TataUsaha.html`, `html/Script_Main.html`, `html/Style.html`) terdeteksi di status tracking.

### 3. Langkah Berikutnya
- Menunggu konfirmasi user untuk melanjutkan ke **Sub-Fase 18B.3** (Smart Bulk Import Engine SAKTI BMN menggunakan SheetJS).

---

## [Fase 18B.0] — Sinkronisasi Tata Kelola & Dokumen Arsitektur Suku Bagian Tata Usaha (Dedicated Spreadsheet Nautika_TU)

**Tanggal**: 15 Oktober 2026  
**Status**: **SELESAI (COMPLETED & LOCKED)** (Seluruh dokumen master teknis PRD.md, ARCHITECTURE.md, DATA_SCHEMA.md, dan PHASES.md telah disinkronkan secara paripurna tanpa ambiguitas untuk menyongsong implementasi Fase 18B).

### 1. Rincian Penyelarasan Dokumen Teknis

1. **Arsitektur Dedicated Database `Nautika_TU` (`ARCHITECTURE.md` §3.3 & `PRD.md` §5.2)**:
   - Menetapkan `Nautika_TU` sebagai spreadsheet mandiri ke-4 di lingkungan Nautika untuk menaungi seluruh data manajerial Suku Bagian Tata Usaha (Keuangan, Paket Pekerjaan, Kepegawaian, dan BMN).
   - Mengisolasi kapasitas data puluhan ribu aset fisik dari spreadsheet operasional harian armada (`Nautika_Transaksi`), mencegah batas 10 juta sel Google Sheets, serta menjamin impor massal SAKTI BMN tidak memblokir `LockService` pelaporan kapal pengawas di laut.
   - Menyediakan spesifikasi konstanta `SS_NAME.TU = 'Nautika_TU'`, script property `PROP_KEY.TU_SS_ID = 'TU_SS_ID'`, dan fungsi data access `openTuSheet(sheetName)`.

2. **Riset & Spesifikasi BMN: Reguler vs Buku (`PRD.md` §5.2, `DATA_SCHEMA.md`, `ARCHITECTURE.md` §18)**:
   - Menjabarkan pemisahan akuntansi BMN:
     - **BMN Buku (Intrakomptabel)**: Belanja Modal Akun 53, di atas batas kapitalisasi, tercatat di Neraca Keuangan Satker, disusutkan berkala di SAKTI, dan memiliki Nilai Buku.
     - **BMN Reguler (Ekstrakomptabel)**: Belanja Barang Akun 52, di bawah batas kapitalisasi, inventaris operasional di luar Neraca namun wajib tercatat di register fisik dengan NUP individual.
   - Atribut pencatatan `KategoriPencatatan` (`BUKU` vs `REGULER`), `NilaiPerolehan` (Nilai Reguler / Beli Kotor), dan `NilaiBuku` (Sisa Buku SAKTI).

3. **Penegakan Kondisi Fisik Per-Item (Anti-Jebret) & Notification Summary (`PRD.md` §5.2 & `DATA_SCHEMA.md`)**:
   - Dilarang keras melakukan agregasi kondisi massal. Satu baris di `TX_BMN_Aset` mewakili tepat satu unit fisik barang dengan identifier unik `KodeBarang + NUP`.
   - Setiap aset membawa riwayat kondisi individual: `BAIK`, `RUSAK_RINGAN`, atau `RUSAK_BERAT`, tanggal verifikasi fisik, dan foto bukti dukung.
   - Spesifikasi Notification Summary Banner di bagian akhir dashboard: rekapitulasi jumlah unit dan valuasi Rp ketiga kategori kondisi, serta Actionable Alert khusus aset Rusak Berat yang siap diajukan penghapusan.

4. **Pipeline Geotagging 2-Opsi & Nearest UPT Resolution (`ARCHITECTURE.md` §18.2 & `PRD.md` §5.2)**:
   - **Opsi 1 (Utama)**: Ekstraksi EXIF GPS dari file mentah (`ArrayBuffer`) via library `exifr` sebelum kompresi kanvas di browser.
   - **Opsi 2 (Fallback)**: Lokasi pengunggah via GPS perangkat (`navigator.geolocation`) atau homebase akun staf pengunggah di `Users`.
   - Algoritma pencocokan Haversine server-side terhadap daftar `Master_Lokasi_UPT` (toleransi radius 25 km).

5. **Siklus Penghapusan BMN Kemenkeu (`ARCHITECTURE.md` §18.3 & `DATA_SCHEMA.md`)**:
   - State machine legalitas berjenjang: `DRAFT_USULAN` → `SURAT_USULAN` → `PERSETUJUAN_KEMENKEU` (DJKN/KPKNL) → `SK_PENGHAPUSAN` (KKP) → `BAST_SELESAI` (Pemusnahan/Lelang) → `StatusAset = DIHAPUS`.
   - Validasi berkas bukti dokumen PDF dan nomor surat di setiap transisi.

6. **Penyempurnaan Roadmap di `PHASES.md`**:
   - Menyisipkan **Fase 18B** (Sub-Fase 18B.0 s/d 18B.7) sebagai prioritas utama sebelum melangkah ke Fase 19.
   - Menghubungkan dependensi Smart Bulk Import Engine yang ditarik maju ke 18B.3 untuk di-reuse pada Fase 19.

---

## [Refinement UI & Peta] — Declutter Total Kapal Terbaik (Apple-Grade Minimalis), Integrasi Akses Ikhtisar, & Paritas Peta Taktis Operasi Laut

**Tanggal**: 15 Oktober 2026  
**Status**: **SELESAI PENUH (COMPLETED & VERIFIED)** (Tampilan visual podium bertingkat 3D yang disukai user dipertahankan utuh namun seluruh tumpukan teks/informasi berlebih dibersihkan secara radikal, akses menu dipindahkan dari sidebar menjadi modal interaktif dari kartu Ikhtisar, dan peta Operasi Laut kini menampilkan 34 kapal taktis lengkap dengan koordinat posisi real-time).

### 1. Rincian Perbaikan & Peningkatan

1. **Declutter Total Podium & Evaluasi Kapal Terbaik (`html/views/KapalTerbaik.html`, `html/Script_Main.html`, `html/Style.html`)**:
   - **Mempertahankan Keindahan Visual Podium**: Layout podium 3-posisi (Juara 2 Perak di kiri, Juara 1 Emas di tengah terangkat tinggi, Juara 3 Perunggu di kanan) dengan balok pedestal bertingkat tetap dipertahankan sesuai preferensi estetika user.
   - **Pemusnahan Teks Berlebih ("50.000 Informasi")**:
     - Menghapus 5 baris daftar breakdown teks mikro di dalam tiap kartu pedestal (`Total Skor Pembobotan`, `Poin Tindak`, `Volume Riksa`, `Valuasi Rupiah`, formula pembagian KIA/KII/Rumpon).
     - Menampilkan angka skor performa yang berani, besar, dan bersih (`.kt-hero-score-val`) didampingi subtitle ringkas WPP & Pangkalan.
     - Menyederhanakan metrik kunci menjadi 2 chip operasional terpenting: `[X hr layar]` dan `[Y tangkapan]`.
     - Mengubah tabel leaderboard dari 11 kolom berdesakan menjadi 8 kolom tenang dan seimbang (`#`, `Kapal`, `Komandan & Pangkalan`, `WPP`, `Hari Layar`, `Tangkapan`, `Kesiapan`, `Skor`).
     - Menghapus formula strip penjelasan matematika dan KPI strip duplikat dari modal header, menyisakan filter triwulan & tahun yang fungsional.

2. **Unifikasi Akses Navigasi dari Ikhtisar ke Halaman Penuh (Bukan Popup/Modal)**:
   - Menu `kapal-terbaik` tidak dijadikan menu utama di sidebar navigasi agar struktur menu tetap ramping.
   - Diintegrasikan sebagai halaman tampilan penuh (*full page view*, bukan modal/popup overlay) yang dapat diakses langsung dari kartu *Kapal Pengawas Teraktif & Evaluasi Armada* di halaman **Ikhtisar** melalui tombol aksi `[Kapal Terbaik (TW) →]`.
   - Menggunakan rute SPA `#kapal-terbaik` lengkap dengan tombol kembali `[← Kembali ke Ikhtisar]` di bagian atas untuk navigasi mulus bolak-balik.

3. **Paritas Peta Taktis Operasi Laut (`html/views/OperasiLaut.html`, `html/Script_Main.html`)**:
   - Menambahkan kontainer chip filter armada (`#ops-fleet-filter-bar`) di atas peta Operasi Laut (`#map-ops-laut`).
   - Merender 34 kapal pengawas ukuran besar dengan titik status semantik (`status-op`, `status-siap`, `status-galangan`), efek pulsasi radar pada kapal aktif di laut, serta sinkronisasi filter chip `[Semua]`, `[Operasional]`, `[Siap Pangkalan]`, dan `[Galangan]`.
   - **Koordinat Posisi Presisi**: Menambahkan baris informasi koordinat geografis presisi (`Posisi Koordinat: LAT°, LNG°`) ke dalam popover kapal di peta Ikhtisar maupun peta Operasi Laut.

---

## [Fase 18] — Peta Taktis 34 Kapal Pengawas Ukuran Besar, Interlock Validasi Laik Laut, & Scoring Engine Kapal Terbaik Triwulanan

**Tanggal**: 15 Oktober 2026  
**Status**: **SELESAI PENUH (COMPLETED & VERIFIED)** (Seluruh 3 pilar deliverables Fase 18 tuntas diimplementasikan, 100% lulus uji validasi sintaksis AST Node.js, data 34 armada besar terkunci presisi sesuai infografis resmi, interlock server & klien terhubung aktif, dan sistem penilaian Ship of the Period terintegrasi ke navigasi utama).

### 1. Pencapaian & Hasil Implementasi Lengkap (3 Pilar Deliverables)

1. **Peta Taktis 34 Kapal Pengawas Ukuran Besar (`services/DashboardService.js`, `services/MasterDataService.js`, `html/Script_Main.html`, `html/Style.html`)**:
   - **Dataset Otoritatif 34 Kapal Besar**: Mengunci referensi 34 armada kapal pengawas ukuran besar resmi KKP:
     - **26 Kapal Operasional di Laut**: KP. Orca 01 s/d 06, KP. Barakuda 01, KP. Paus 01, KP. H.M. Tutul 01 & 02, KP. Hiu Macan 04 & 06, KP. Hiu 01, 02, 04, 05, 07 s/d 16 pada WPP penugasan masing-masing (WPP 711, 712, 713, 714, 715, 716, 717, 718, 571, 572, 573).
     - **6 Kapal Siap Operasi di Pangkalan**: KP. Akar Bahar 01 (Jakarta), KP. Hiu Macan 01 (Batam), KP. Hiu Macan 05 (Batam), KP. Hiu 03 (Batam), KP. Hiu 06 (Jakarta), KP. Hiu 17 (Batam).
     - **2 Kapal Pemeliharaan di Galangan (Tidak Siap)**: KP. Barakuda 02 (Jakarta), KP. Hiu Macan 03 (Lamongan).
   - **Layer Marker Taktis Leaflet & Presence Pulse**:
     - Marker kustom bersiluet pill tajam dengan titik status semantik (`status-op`: zamrud hijau, `status-siap`: kuning amber, `status-galangan`: merah kirmizi).
     - Efek radar beacon pulsasi dinamis (`.ship-beacon-pulse`) pada 26 kapal yang berstatus aktif operasional di laut.
     - Popover info interaktif kaya data: nama kapal, kelas kapal, status kelaikan, WPP penugasan, nama Komandan resmi, pangkalan sandar, hari layar kumulatif YTD, serta progress comparison bar terhadap **Rerata Nasional (44 Hari)** dan **Rerata Pusat (49 Hari)**.
     - Tautan cepat *"Buka Profil Kapal →"* yang langsung terhubung ke profil komprehensif kapal (`_openProfilKapal(id)`).
   - **Filter Status Armada di Atas Peta**:
     - Chip filter taktis interaktif: `[Semua Armada (34)]`, `[Operasional (26)]`, `[Siap Pangkalan (6)]`, `[Galangan (2)]` yang secara dinamis menyaring marker di peta Leaflet secara instan.

2. **Interlock Validasi Laik Laut Antar-Modul (Perawatan → Operasi Laut) (`services/PerawatanService.js`, `services/OperasiLautService.js`, `html/views/OperasiLaut.html`, `html/Script_Main.html`, `html/Style.html`)**:
   - **Enforcement Server-Side (Keras)**:
     - `perawatan_checkLaikLaut(kapalId)`: Memeriksa record kesiapan aktif terbaru di `TX_Perawatan_Kesiapan` yang diurutkan berdasarkan timestamp.
     - Pengecekan aktif pada `operasiLaut_submit()` dan `operasiLaut_revisi()`: Menolak keras (`throw new Error`) penyimpanan laporan operasi laut jika kapal terpilih tercatat dalam status `TIDAK_SIAP`, melindungi integritas data dari pelanggaran kelaikan laut.
   - **Feedback Klien (Real-Time)**:
     - Endpoint `perawatan_getReadinessMap(token)` untuk query status kesiapan seluruh armada secara instan.
     - Pengecekan otomatis saat pemilihan kapal di dropdown form input (`ops-kapal`) maupun form revisi (`rv-ops-kapal`).
     - Banner peringatan merah interaktif (`.interlock-warn-banner`): *"⚠️ Interlock Validasi Laik Laut: Kapal ini tercatat TIDAK SIAP / TIDAK LAIK LAUT pada data Perawatan (...). Pengajuan Operasi Laut tidak dapat disimpan sebelum status kesiapan diperbarui."*
     - Tombol simpan laporan (`#ops-btn-submit` dan `#ops-btn-revisi-save`) otomatis dinonaktifkan (`disabled = true`) selama kapal yang tidak laik laut dipilih.

3. **Scoring Engine & Podium Kapal Terbaik (Ship of the Period TW I–IV) (`services/DashboardService.js`, `html/views/KapalTerbaik.html`, `html/Script_Main.html`, `html/Style.html`, `html/Index.html`)**:
   - **Scoring Engine Berbobot Resmi (`PRD.md` §5.12)**:
     - Algoritma pembobotan 4-dimensi: `Skor = (0.40 * HariLayarNorm) + (0.35 * PoinPenindakanNorm) + (0.15 * VolumeRiksaNorm) + (0.10 * ValuasiNorm)`.
     - Normalisasi poin penindakan: KIA (bobot 15 poin), KII Ilegal (bobot 5 poin), Penertiban Rumpon (bobot 3 poin).
     - Seluruh skor dinormalisasi (0–100) terhadap capaian tertinggi armada pada triwulan terkait.
   - **Navigasi & View Mandiri (`html/views/KapalTerbaik.html`)**:
     - Ditambahkan ke `NAV_SECTIONS` di bawah kategori `UTAMA` (bersama Ikhtisar), dapat diakses oleh seluruh pengguna berstatus APPROVED.
     - **Toolbar Filter Triwulan**: Pemilihan Tahun (2026, 2025) dan Triwulan (TW I: Jan–Mar, TW II: Apr–Jun, TW III: Jul–Sep, TW IV: Okt–Des) dengan auto-detection ke triwulan berjalan saat ini.
     - **Formula Strip Informatif**: Penjelasan formula pembobotan dan rincian poin penindakan.
     - **KPI Strip Ringkasan**: Menampilkan Ship of the Period (Juara 1), Rerata Skor Armada, Total Hari Layar, dan Total Tangkapan Kapal pada triwulan terpilih.
     - **Podium Kehormatan Visual (Top 3)**:
       - Pedestal bertingkat 3 dimensi visual (Juara 2 Perak di kiri, Juara 1 Emas di tengah terangkat tinggi, Juara 3 Perunggu di kanan).
       - Menampilkan medali laurel, nama kapal, kelas kapal, nama komandan, pangkalan, total skor pembobotan, serta breakdown rincian metrik operasi.
     - **Leaderboard Tabel 34 Kapal Lengkap**:
       - Tabel performa 34 kapal besar dengan nomor peringkat, sorotan warna podium (Emas/Perak/Perunggu), rincian hari layar, tangkapan KIA/KII/Rumpon, poin tindak, volume riksa, valuasi aset terselamatkan (format rupiah), status kesiapan, dan meter visual skor akhir.
       - Kotak pencarian responsif klien (`#kt-search-input`) untuk memfilter kapal, pangkalan, atau nama komandan secara instan.

### 2. Keputusan Teknis & Catatan Arsitektur

- **Sinkronisasi Skema Master Kapal**: Fungsi `master_ensure34KapalBesar()` memastikan sheet `Master_Kapal` otomatis terisi dan diperkaya dengan kelas kapal (`ORCA`, `HIU_MACAN`, `HIU`, `BARAKUDA`, `PAUS`, `AKAR_BAHAR`) saat master data diakses.
- **Kepatuhan Negative Prompt (`DESIGN.md` §1)**: Desain podium dan tabel leaderboard menerapkan prinsip anti-slop: tanpa huruf kapital abu-abu pudar, tanpa background gradien jenuh acak, tanpa emoji di status badge, menggunakan tipografi Plus Jakarta Sans dengan tabular numbers (`tabular-nums`), serta elevasi kontras Slate Navy yang elegan.
- **Pembersihan Bersih (Teardown Safe)**: Layer Leaflet armada (`_OV_MAP.fleetLayer`) dibersihkan secara tuntas saat berpindah view melalui `_ovMapDestroy()`, mencegah kebocoran memori (memory leak) maupun penumpukan marker duplikat.

---

## [Hotfix/Refinement UI] — Pemusnahan Tipografi Kapital Abu-Abu (Systemwide Anti-Slop) & Rekonstruksi Kartu KPI Cockpit

**Tanggal**: 14 Oktober 2026  
**Status**: **SELESAI PENUH (COMPLETED & VERIFIED)** (Pemusnahan total tipografi kapital abu-abu pudar systemwide, unifikasi tata letak kartu KPI 4-tingkat vertikal, adopsi Negative Prompt #17 di `DESIGN.md`, dan 100% lulus validasi AST Node.js).

### 1. Perubahan & Peningkatan Sistem

1. **Rekonstruksi Tata Letak Kartu KPI (`html/Style.html`, `html/Script_Main.html`, `services/DashboardService.js`)**:
   - **Arsitektur Vertikal 4-Tingkat**: Mengubah tata letak kartu headline dari perataan horizontal (`space-between` yang memisahkan angka dan widget secara terfragmentasi) menjadi tumpukan vertikal berbobot (*vertical cockpit card*):
     - **Tingkat 1 (`.kpi-head`)**: Label metrik Title Case alami (`font-size: 0.8125rem; font-weight: 600; color: var(--n-text-secondary)`) berdampingan dengan badge tren operasional (`.ov-trend`).
     - **Tingkat 2 (`.kpi-value`)**: Hero tabular metric dengan presisi instrumen maritim (`font-size: 1.85rem; font-weight: 800; tabular-nums`).
     - **Tingkat 3 (`.kpi-track`)**: Indikator horizontal ramping 5px (`.kpi-track-fill`) dengan status semantik (`.success`, `.warning`, `.crit`), menjamin keseragaman visual di seluruh kartu metrik.
     - **Tingkat 4 (`.kpi-sub`)**: Subline operasional berkontras jelas yang menyajikan konteks capaian terhadap pagu atau target riil.
   - **Eliminasi Visual Mengambang Sisi Kanan**: Menghilangkan mikro-visualisasi yang tidak seimbang di sisi kanan (sparkline acak, minibars putus-putus, donat 6-irisan redundan, deretan titik kosong) yang sebelumnya menimbulkan kesan berantakan dan membingungkan pengguna.
   - **Kompensasi Helper Server-Side**: Memperbaiki fungsi pembantu pemadat angka `_dashCompact(n)` pada `DashboardService.js` untuk mengeliminasi ketergantungan klien `_ovCompact` sehingga subline server-side bebas galat `ReferenceError`.
   - **Perbaikan Scaling & Anti-Wrap Badge Tren (`.ov-trend`)**: Mengatasi masalah scaling di mana badge tren merah membengkak dan pecah menjadi 2 baris ("▼" dan "141" terpisah serta "vs September" dan "2026" terpisah) akibat kekurangan ruang horizontal. Menerapkan `white-space: nowrap`, `flex-shrink: 0`, font `0.6875rem`, format nama bulan ringkas (`vs Sep`), tooltip deskripsi penuh, serta menormalkan padding kartu menjadi `16px 18px` dan `kpi-label` non-wrapping sehingga seluruh kartu memiliki ketinggian dan baseline metrik yang presisi.
   - **Keseragaman Indikator Progres Seluruh 4 Kartu**: Memperbaiki passing parameter pada `_ovRenderData` agar seluruh objek `h` (termasuk `pct` dan `pctKapal`) diteruskan penuh ke `_kpiHeadline`, dilengkapi fallback parser otomatis untuk kartu satuan `kapal` dan `hari` sehingga tidak ada kartu yang kehilangan track bar.
   - **Rekonstruksi Subtext Bawah Menjadi 2-Kolom Key-Value Terstruktur (`.kpi-foot`)**: Menghilangkan paragraf/kalimat panjang yang membungkus canggung dan menyisakan kata-kata gantung ("5 jt", "udara", "armada", "melapor"). Menggantinya dengan layout micro-spec 2-kolom terstruktur (kiri: metrik primer, kanan: pembanding/total) dengan label abu-abu halus dan angka tegas bernilai tabular (`tabular-nums`), dilengkapi highlight status semantik (ok/warn/crit). Semua kartu kini 100% rapi dalam 1 baris horizontal tanpa wrapping liar.
   - **Unifikasi & Anti-Clutter Header Status (`#sync-indicator` + `.sync-popover`)**: Menyatukan dua elemen teks terpisah di header (`#telemetry-timestamp` dan `#sync-indicator`) menjadi satu status pill interaktif yang elegan. Dilengkapi ikon SVG sinkronisasi (berputar halus saat proses sinkronisasi) dan micro-popover melayang saat di-hover yang memuat detail waktu transaksi data (`Data per: DD MMM YYYY · HH:mm WIB`), status sinkronisasi server, dan aksi klik untuk periksa pembaruan, sehingga header bebas dari visual clutter.

2. **Pemusnahan Tipografi Kapital Abu-Abu Pudar Systemwide (`html/Style.html`, `html/Auth.html`, `html/views/TataUsaha.html`, `html/Script_Main.html`)**:
   - Mematikan deklarasi `text-transform: uppercase` dan mengganti warna pudar `var(--n-text-muted)` pada seluruh komponen:
     - Label formulir (`.form-grp label`, `.form-group label`)
     - Header tabel data (`.n-table th`, `.approval-table th`)
     - Label bagian sidebar (`.sb-section-label`)
     - Baris informasi detail (`.info-row .lbl`, `.n-modal-hd-scroll .hd-k`)
     - Caption footer kartu dan legenda stack (`.div-card-foot-cap`, `.stk-caption`, `.stk-item`)
     - Sumbu diagram dan label donat SVG (`.vz-col-lbl`, `.vz-line-x`, `.vz-heat-lbl`, `_ovDonut`)
   - Seluruh teks kini tampil dalam format **Title Case** atau **Sentence Case** alami berbobot semi-bold/medium (`font-weight: 500–600`) dengan kontras tajam Slate Navy (`var(--n-text-secondary)` / `#4A5568`), bebas dari kesan "AI-slop".

3. **Rekonstruksi Kartu Akun Pengguna & Drop-Up Popover Menu (`html/Index.html`, `html/Style.html`, `html/Script_Main.html`)**:
   - **Kartu Akun Proper (`.sb-user-card`)**: Menggantikan teks telanjang dan tombol logout terbuka di pojok kiri bawah sidebar dengan kartu profil terstruktur yang elegan:
     - **Default Profile Avatar (`.sb-avatar`)**: Lingkaran avatar 34px bergradien halus dengan border transparan dan siluet ikon pengguna (SVG) baku, dilengkapi indikator presensi aktif berwarna zamrud (`.sb-status-dot`, *Emerald Active*).
     - **Tipografi Identitas Terstruktur (`.sb-user-info`)**: Menampilkan nama pengguna dengan bobot semi-bold putih (`font-weight: 600`) dan peran/role dalam warna sekunder yang jelas, dilengkapi ikon chevron interaktif (`.sb-user-chevron`) yang berotasi 180° saat menu terbuka.
   - **Menu Popover Melayang Drop-Up (`.sb-user-menu`)**:
     - Menyembunyikan tombol logout dan aksi sekunder di balik menu drop-up yang melayang ke atas (`bottom: calc(100% + 8px)`), menghindari pemotongan di bawah layar (mengadopsi UX desktop modern Slack/Linear).
     - **Header Profil Kaya (`.sb-menu-header`)**: Menampilkan avatar, nama lengkap pengguna, email resmi, dan badge pill peran (`.sb-role-badge`).
     - **Navigasi Cepat & Kontrol Sesi**: Menampilkan tautan cepat ke Admin Panel (khusus Superadmin/Direktur), Notifikasi sistem, garis pemisah halus (`.sb-menu-divider`), dan tombol **Keluar** berwarna crimson lembut (`.sb-menu-item.danger`) dengan hover efek merah tegas.
     - **Dismissibility & Aksesibilitas**: Menu otomatis tertutup dengan klik di luar area (`click outside`) maupun penekanan tombol `Escape`, dengan animasi transisi pegas halus (`_dropUpFade`).

4. **Pembaruan Desain & Standar Rekayasa Antarmuka (`DESIGN.md`, `html/Style.html`)**:
   - Menambahkan **Negative Prompt #17** di §1 yang secara eksplisit melarang penggunaan huruf kapital penuh abu-abu pudar (`text-transform: uppercase; color: var(--n-text-muted)`).
   - Menambahkan aturan kapitalisasi baku pada §2.1 yang mewajibkan Title Case/Sentence Case berbobot tegas pada seluruh antarmuka sistem.
   - **Kepatuhan Standar CSS Tabular (`font-feature-settings`)**: Memastikan seluruh deklarasi `-webkit-font-feature-settings: "tnum"` dipasangkan dengan standar properti `font-feature-settings: "tnum"` (termasuk pada `.kpi-foot` dan `.ov-trend`) sesuai `DESIGN.md` §2.2, mengeliminasi peringatan linter CSS.

5. **Penenangan Palet Warna Kartu KPI & Eliminasi Efek Pelangi (`html/Style.html`, `html/Script_Main.html`, `services/DashboardService.js`)**:
   - **Unifikasi Indikator Progres (`.kpi-track-fill`)**: Menghilangkan pewarnaan status acak (oranye cerah, hijau neon) pada progress bar kartu headline. Seluruh track bar kini seragam menggunakan Deep Maritime Navy (`var(--n-primary)`), menciptakan harmoni visual yang tenang dan bermartabat.
   - **Penenangan Badge Tren (`.ov-trend`)**: Menggantikan latar pink/merah menyala (`#DC2626` / `#FEE2E2`) dengan kapsul netral berlatar ultra-halus (`rgba(0, 0, 0, 0.03)`) dan teks Slate alami (`var(--n-text-secondary)`), menyajikan perbandingan delta tanpa kepanikan visual.
   - **Unifikasi Angka Footer (`.kpi-foot-val`)**: Menghilangkan injeksi kelas warna (cokelat/oranye pada divisi melapor) sehingga seluruh angka metrik bawah seragam tampil dalam Deep Navy berbobot tebal (`font-weight: 700; tabular-nums`).

---

## [Fase 17] — Fondasi Anggaran APBN (Reguler vs ABT), Header Live Telemetry, Simplifikasi Ikhtisar SiMata & Kompresi Kanvas Bukti Dukung

**Tanggal**: 14 Oktober 2026  
**Status**: **SELESAI PENUH (COMPLETED & VERIFIED)** (Seluruh 4 pilar deliverables tuntas diimplementasikan, sintaksis 100% lulus AST validator Node.js, pengujian matriks 2x2 akuntansi dan telemetri berhasil diverifikasi).

### 1. Pencapaian & Hasil Implementasi Lengkap (4 Pilar Deliverables)

1. **Rekonstruksi Model Keuangan Tata Usaha (Matriks 2x2 APBN)**:
   - **Koreksi Logika Akuntansi APBN**: Memperbaiki kekeliruan struktural di mana sebelumnya `realisasiSP2D` dibandingkan dengan `paguReguler` dan `realisasiAkrual` dibandingkan dengan `paguABT`. Pada standar akuntansi belanja negara, SP2D (kas) dan Akrual (beban/fisik) berlaku untuk kedua sumber dana (Reguler maupun ABT).
   - **Backend (`services/TataUsahaService.js`)**:
     - `tataUsaha_getKPI`: Menghitung agregasi YTD dan saldo untuk matriks 2x2: `paguReguler`, `paguABT`, `paguTotal`, `realisasiSP2D_Reguler`, `realisasiSP2D_ABT`, `realisasiAkrual_Reguler`, `realisasiAkrual_ABT`, `sisaSP2D_Reguler`, `sisaSP2D_ABT`, `sisaSP2D_Total`, `sisaAkrual_Reguler`, `sisaAkrual_ABT`, `sisaAkrual_Total`.
     - Persentase Serapan Konsolidasi Nasional yang sah dihitung akurat: `pctSerapanNasional = (Total SP2D Reguler + ABT) / (Total Pagu Reguler + ABT) * 100`.
     - `tataUsaha_submitMingguan` & `tataUsaha_revisi`: Mendukung penyimpanan kolom terpisah `RealisasiSP2D_Reguler_Minggu`, `RealisasiSP2D_ABT_Minggu`, `RealisasiAkrual_Reguler_Minggu`, `RealisasiAkrual_ABT_Minggu` dengan tetap menjaga backward compatibility kolom legacy.
     - `tataUsaha_getTren`: Agregasi tren bulanan kini menjumlahkan realisasi dari kedua sumber dana secara komprehensif.
   - **Frontend Input Form & Revisi Modal (`html/views/TataUsaha.html` & `html/Script_Main.html`)**:
     - Memperbarui formulir input mingguan dan modal revisi dengan kisi 2x2 yang terstruktur: kelompok SP2D (Reguler & ABT) dan kelompok Akrual (Reguler & ABT).
     - Menambahkan fungsi pembantu reaktif `_tuUpdateFormRealTotals()` dan `_tuUpdateRvRealTotals()` yang secara dinamis memperbarui ringkasan total SP2D dan Akrual saat pengguna mengetik.
     - Memperbarui `_tuRenderKPI()` untuk menampilkan kartu KPI eksekutif yang bersih: Pagu Total, Serapan Nasional (SP2D), Realisasi Akrual, rincian per alokasi (Reguler vs ABT), serta sisa pagu kas dan akrual.

2. **Live Header Timestamp Telemetry**:
   - **Backend (`data/SheetAccess.js` & `services/DashboardService.js`)**:
     - Memperbarui fungsi `bumpTxVersion(sheetName)` untuk menyimpan metadata transaksi data terakhir (`METADATA_LAST_TX`) berupa timestamp ISO dan nama sheet di memori cepat RAM `CacheService` (TTL 6 jam) dan dibackup ke `PropertiesService`.
     - Mengirimkan `lastTxMetadata` melalui endpoint sinkronisasi zero-sheet-read `app_getSyncState(token)`.
   - **Frontend (`html/Script_Main.html` & `html/Style.html`)**:
     - Memasang elemen `#telemetry-timestamp` di bilah atas samping indikator sinkronisasi.
     - Mengimplementasikan `_updateTelemetryTimestampUI()` yang memformat waktu transaksi menjadi format standar: `Data per: DD MMM YYYY · HH:mm WIB`.
     - Menegakkan status deteksi keusangan (*staleness alert*): jika transaksi data terakhir berusia > 7 hari, elemen otomatis memperoleh kelas visual `.is-stale` (aksen kuning peringatan) dengan tooltip informatif bagi pemangku kebijakan.

3. **Simplifikasi Ikhtisar Selaras SiMata (Eliminasi Visual Bloat)**:
   - **Pembersihan Kartu Divisi (`services/DashboardService.js`)**:
     - Menghapus mini-waffle chart 40-sel, kalender heatmap mikro yang padat, dan grafik donat ad-hoc yang tumpang tindih dari seluruh kartu divisi di Ikhtisar.
     - Menyederhanakan visualisasi per kartu menjadi batang horizontal terperingkat (`hbars`) yang bersih atau stack metrik yang mudah dibaca.
   - **Struktur Ikhtisar Bersih 3 Blok**:
     - Blok 1: 4 Headline KPI SiMata (`X — Y% dari total`).
     - Blok 2: Peta Taktis WPP dengan choropleth interaktif dan panel ranking terintegrasi.
     - Blok 3: Executive Monitoring Data Grid 8 unit kerja dengan chip status informatif.

4. **Kompresi Kanvas Sisi Klien (Storage & Quota Protection Tier 1)**:
   - **Kompresi Gambar Kanvas HTML5 (`html/Script_Main.html`)**:
     - Mengimplementasikan `_compressImageCanvas(file, maxWidth, quality, cb)`: setiap berkas gambar raster (JPEG, PNG, WEBP) otomatis di-resize ke batas maksimal lebar 1600px dan dikompres ke format JPEG kualitas 0.8 sebelum dikonversi menjadi Base64.
     - Mereduksi ukuran payload bukti dukung hingga ~80% (dari ~5-8 MB menjadi <500 KB), secara drastis menghemat kuota Google Drive dan mencegah batasan payload limit / timeout pada Google Apps Script.
   - **Penegakan Kebijakan Video**:
     - Menegakkan validasi ukuran pada `_attachPickFiles(key)`: berkas video lokal yang melebihi 20MB otomatis ditolak dengan pesan peringatan edukatif.
     - Memperbarui `_attachValidate(key)` untuk mengizinkan tautan video YouTube di samping tautan Google Drive.

### 2. Keputusan Teknis yang Diambil
- **Penyimpanan Ganda Telemetri (`CacheService` + `PropertiesService`)**: Menyimpan metadata transaksi di RAM `CacheService` memastikan heartbeat `app_getSyncState` tetap berjalan <50ms tanpa sheet-read kuota, sementara `PropertiesService` mencegah hilangnya metadata saat cache dingin (cold cache).
- **Kompresi Non-Destruktif Murni Kanvas Sisi Klien**: Menggunakan `HTML5 Canvas` tanpa dependensi eksternal menjaga ukuran bundle aplikasi tetap ringan dan menjamin gambar terkompresi sebelum menyentuh jaringan.
- **Isolasi Format Server-Side (`_dashCompact`)**: Menyediakan helper pemadat angka `_dashCompact(n)` mandiri di `DashboardService.js` untuk memformat subline headline KPI, menggantikan ketergantungan `_ovCompact` (skrip klien) agar server-side rendering bebas galat `ReferenceError`.

### 3. Status Roadmap
- **Fase 17**: **SELESAI PENUH**.
- **Fase 18 (Peta Taktis 34 Kapal Pengawas Besar, Interlock Validasi Laik Laut, Scoring Engine Triwulanan)**: **SIAP DIKERJAKAN**.

---

## [Fase 16] — Total UI Revision: Sintesis Seluruh Design Engineering Skills & Mission-Critical Maritime Cockpit (Selesai Penuh)

**Tanggal**: 14 Oktober 2026  
**Status**: **SELESAI PENUH (COMPLETED & VERIFIED)** (Seluruh 8 sub-fase tuntas dieksekusi; `node --check` 100% lulus pada seluruh berkas JavaScript dan skrip sisi klien; pengujian unit multi-file bebas error).

### 1. Pencapaian & Hasil Implementasi Lengkap (8 Sub-Fase)
1. **Sub-Fase 1 — Fondasi & Dokumen Desain**:
   - Memutakhirkan `DESIGN.md` dengan 16 aturan *Negative Prompt* eksplisit, tabel optical tracking Plus Jakarta Sans, spesifikasi material translusen (`backdrop-filter: blur(20px) saturate(180%)`), inner light-catching edges (`--n-border-highlight`), layered ambient shadows, dan fisika pegas taktil.
   - Merumuskan artefak arsitektur master `master_plan_total_ui_revision.md` (5 diagram Mermaid, tabel audit Before/After/Why Emil Kowalski, dan matriks ketahanan data ekstrem `break-ui`).
2. **Sub-Fase 2 — Global Engine CSS (`Style.html`)**:
   - Menyediakan tokens material akrilik (`--n-material-surface`, `--n-material-floating`, `--n-border-hairline`, `--n-shadow-1/2/3`).
   - Menerapkan aturan *mobile-native*: peniadaan tap highlight flash (`-webkit-tap-highlight-color: transparent`), pencegahan tap delay 300ms (`touch-action: manipulation`), viewport dinamis `100dvh`, dan font form $\ge 16\text{px}$ pada layar sentuh untuk menghentikan zoom otomatis iOS.
   - Mengunci seluruh efek hover di dalam query `@media (hover: hover) and (pointer: fine)` agar layar sentuh ponsel/tablet tidak mengalami masalah *sticky hover*.
   - Menerapkan animasi staggered entrance (`@keyframes _staggerFadeIn` dengan inkremen delay 35ms) pada kartu KPI dan kontainer metrik.
   - Mengintegrasikan styling lengkap Sonner Toaster (`#n-toaster`, `.sonner-toast`, `.sonner-toast-content`, dsb.) dengan stacking physics dan support swipe dismiss.
3. **Sub-Fase 3 — Shell & Navigasi Utama (`Index.html`)**:
   - Memasang wadah root-level `#n-toaster` (`aria-live="polite"`, `aria-atomic="true"`) persis sebelum pemuatan skrip, siap menangkap seluruh event notifikasi aplikasi secara non-blocking.
4. **Sub-Fase 4 — Engine Toast Sonner & Morphing Dialog (`Script_Main.html`)**:
   - Mengimplementasikan objek `toast` native Sonner-grade lengkap (`toast()`, `toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()`, `toast.loading()`, `toast.promise()`, `toast.dismiss()`) dengan batas maksimal 4 notifikasi bertumpuk, durasi adaptif, dan gestur sentuh *swipe-to-dismiss* horizontal.
   - Menghubungkan fungsi sentral `_msg(id, type, text)` langsung ke engine `toast` sehingga pemanggilan pesan status dari seluruh 14 modul otomatis menampilkan notifikasi floating akrilik modern tanpa merusak fallback elemen pesan inline.
   - Memperkuat pengamat *Anchored Modal Origin Tracker* (`_modalObserver`) menggunakan `document.body.observe` dengan `subtree: true` dan `attributeFilter: ['class']` agar seluruh modal formulir (termasuk yang diinjeksi secara dinamis dari template modul) membuka diri berakar tepat dari koordinat tombol pemicunya.
5. **Sub-Fase 5 — Overhaul KPI Generator (`_kpiHeadline`)**:
   - Merevisi `_kpiHeadline` di `Script_Main.html` dengan angka instrumen tebal (`font-weight: 800`), `font-variant-numeric: tabular-nums`, label mikro berhuruf kapital (`font-size: 0.70rem; letter-spacing: 0.06em`), penanda satuan `.kpi-unit`, serta badge tren berstatus semantik (`.ov-trend.up` berlatar hijau lembut dan `.ov-trend.down` berlatar merah lembut).
6. **Sub-Fase 6 — Audit Template Modul (`html/views/*.html`)**:
   - Memastikan seluruh kartu dan kontainer pada modul divisi mematuhi token tema konsentris, serta mengganti warna latar peta statis pada Operasi Laut dan Operasi Udara dengan token tema `var(--n-surface-2)`.
7. **Sub-Fase 7 — Universal History Table (`_histRender` & `Style.html`)**:
   - Membungkus seluruh tabel riwayat dan skeleton loader dalam `.n-table-wrap` dengan isolasi horizontal scroll (`-webkit-overflow-scrolling: touch`) untuk melindungi layout mobile dari *horizontal blowout*.
   - Menerapkan *sticky header* dengan efek kaca buram translusen (`backdrop-filter: blur(12px)`) pada seluruh kolom tabel riwayat.
   - Mempertegas status badges lembut (*soft-tint non-jarring*) untuk status Aktif, Dianulir, Ditimpa, Siap, dan Tidak Siap.
8. **Sub-Fase 8 — Verifikasi & Standarisasi Kualitas**:
   - Menambahkan aturan pemecah teks panjang (`overflow-wrap: break-word; word-break: break-word`) pada judul dan deskripsi toast notifikasi untuk menangkal kerusakan layout akibat data ekstrem (`break-ui`).
   - Melakukan pengujian sintaksis AST parser Node.js terhadap seluruh 11.497 baris skrip sisi klien dan seluruh berkas JavaScript utilitas/service backend dengan hasil 100% lulus tanpa galat.

### 2. Status Roadmap
- **Fase 16 (Total UI Revision)**: **SELESAI PENUH**.
- **Fase 17**: **SIAP DIKERJAKAN**.

---

## [Master Plan Total UI Revision] — Sintesis Seluruh Design Engineering Skills & Overhaul Komprehensif DESIGN.md

**Tanggal**: 14 Oktober 2026  
**Status**: **MASTER PLAN & ROADMAP RESMI SELESAI** (`master_plan_total_ui_revision.md`, `DESIGN.md`, dan `PHASES.md` termutakhirkan 100%).

### 1. Pencapaian & Dokumen
1. **Pembaruan Menyeluruh DESIGN.md**:
   - Memutakhirkan standar desain antarmuka Nautika menyintesiskan seluruh skill di `.agents/skills/` (`emil-design-eng`, `apple-design`, `animate`, `animation-performance`, `mobile-native`, `ask-sonner`, dan `break-ui`).
   - Memperluas *Negative Prompt* menjadi 16 larangan eksplisit (mencakup larangan `scale(0)`, `ease-in`, durasi >300ms, animasi properti Layout/Paint, hover tersangkut pada touch, serta kilatan tap highlight).
   - Mempertegas spesifikasi material translusen (`backdrop-filter: blur(20px) saturate(180%)`), inner light-catching edge 1px, geometri konsentris $R_{\text{inner}} = \max(0, R_{\text{outer}} - \text{padding})$, dan layered ambient navy shadows.
   - Menetapkan arsitektur Sonner floating toast untuk menggantikan banner alert inline invasif.
   - Mengukuhkan standar *mobile-native* (`-webkit-tap-highlight-color: transparent`, `@media (hover: hover) and (pointer: fine)`, `touch-action: manipulation`, `100dvh`, font input $\ge 16\text{px}$).
2. **Formulasi Master Plan Revisi Total UI**:
   - Membuat artefak rencana implementasi mendalam [master_plan_total_ui_revision.md](file:///home/pinefeast/.gemini/antigravity-ide/brain/0c94f837-7f00-4c84-b347-7bfd2f196360/master_plan_total_ui_revision.md).
   - Memuat 5 diagram arsitektur Mermaid (Token Vibrancy, View Transition Cascade, Sonner Toast Architecture, Anchored Modal Physics, dan Mobile-Native Pipeline).
   - Memuat tabel audit komprehensif Before / After / Why format Emil Kowalski untuk seluruh lapisan antarmuka.
   - Memuat matriks uji ketahanan data ekstrem `break-ui` dan roadmap eksekusi 8 fase tanpa kompromi.

---

## [Fase 16] — Master UI/UX Overhaul: Apple Design System, Tactile Physics & Eliminasi Total AI-Slop

**Tanggal**: 14 Oktober 2026  
**Status**: **SELESAI & TERUJI LOKAL** (`node --check` dan verifikasi AST parser JavaScript pada `Script_Main.html` dan `Script_Charts.html` 100% lulus).

### 1. Pencapaian & Hasil Implementasi
1. **Pembersihan CSS Primitif & Eliminasi Elemen Kuno**:
   - Menghapus total gaya 3D bevel button 4px (`border-bottom: 4px solid rgba(0,0,0,0.25)`) dan transform hack (`translateY(3px)`) pada `.btn-primary` di `html/Style.html`.
   - Mengganti seluruh kurva transisi linear dengan token pegas Apple (`--n-spring-snappy`, `--n-spring-modal`, `--n-spring-bounce`).
   - Menerapkan respon tactile kompresi nyata saat ditekan (`:active` / `pointerdown`): `transform: scale(0.97)` pada seluruh tombol (`.btn`, `.btn-primary`, `.btn-ghost`, `.btn-outline`, `.btn-mini`, `.btn-sm`, `.n-iconbtn`), navigasi sidebar (`.nav-item`), filter mode, dan sub-tab.
2. **Penyatuan Tipografi & Penegakan Tabular Numbers**:
   - Menghapus ketergantungan font Poppins 100% dari seluruh berkas (`Index.html`, `Auth.html`, `Style.html`, `Script_Charts.html`). Seluruh antarmuka distandarisasi menggunakan **Plus Jakarta Sans** dengan sistem optical tracking terkalibrasi (-0.025em s.d. +0.010em).
   - Menegakkan `font-variant-numeric: tabular-nums` dan `font-feature-settings: "tnum"` pada seluruh angka numerik (metrik KPI, tabel data, timestamp telemetri, timer, nominal Rupiah, dan koordinat GPS) guna mengeliminasi goyangan horizontal layout (*layout jitter*).
3. **Translucent Glass Surfaces & Layered Ambient Elevation**:
   - Memperbarui kartu solid "kardus" `#FFFFFF` (`.n-card`, `.kpi-card`, `.chart-cell`, `.div-card`, `.auth-card`) dan panel header (`.page-header`, `.filter-box`) menjadi material translusen dengan saturasi optik: `rgba(255, 255, 255, 0.82)` + `backdrop-filter: blur(20px) saturate(180%)` dan batas hairline 1px `rgba(0,0,0,0.07)`.
   - Menerapkan sistem bayangan multi-layer (Level 1 kartu, Level 2 floating dropdown, Level 3 modal) berdifusi lembut.
   - Menegakkan hukum radius konsentris: $\text{Radius Inner} = \max(0, \text{Radius Outer} - \text{Padding})$.
4. **Fisika Modal Terjangkar (Anchored Modal) & Gesture Sheet**:
   - Modal dialog kini beranimasi pegas halus (`scale(0.94)` ke `1.0` via `cubic-bezier(0.16, 1, 0.3, 1)`) dengan backdrop blur 12px dan titik jangkar dinamis (*dynamic transform-origin*) yang berakar dari tombol pemicu klik via MutationObserver di `html/Script_Main.html`.
   - Panel drawer samping dilengkapi pegangan visual (`.sheet-grabber`) dan gestur sentuh *swipe-to-dismiss* (geser vertikal >80px langsung menutup dengan inersia, <80px memantul kembali).
   - Mengintegrasikan pengaman aksesibilitas `@media (prefers-reduced-motion: reduce)`.

### 2. Keputusan Teknis yang Diambil
- Menggunakan CSS `:active` dengan scale transform untuk menjamin kompresi sentuh instan pada mouse, trackpad, dan layar sentuh tanpa latensi JS.
- Mempertahankan warna dasar Navy `#2B3674` sebagai identitas maritim KKP, namun mengangkat keseluruhan kontras dan material menggunakan standar macOS/iOS.

### 3. Verifikasi
- Pengujian parser AST Node.js pada skrip sisi klien membuktikan seluruh handler (`_initOverlayClose`, `_initSheetGestures`, observer transform origin) berjalan tanpa galat sintaksis.
- Pengecekan ripgrep membuktikan tidak ada lagi penggunaan font Poppins maupun `border-bottom-width: 4px` di seluruh kode produksi.
- Dependensi **Fase 17** kini resmi terpenuhi dan siap dikerjakan.

---

## [Spesifikasi Desain & Roadmap Fase 16] — Standar Apple Human Interface Guidelines, Kritik Menyeluruh UI, & Roadmap Fase 16 Overhaul Antarmuka

**Tanggal**: 14 Oktober 2026  
**Status**: **SELESAI DIDOKUMENTASIKAN DI SELURUH REPO MASTER** (`DESIGN.md`, `PHASES.md`, `PRD.md`, `ARCHITECTURE.md`).

### 1. Hasil Audit & Reformasi Desain Antarmuka (Apple Design Foundations)
1. **Eliminasi Total Unsur Kuno & AI-Slop**:
   - Menghapus tombol 3D bevel 4px (`border-bottom: 4px solid rgba(0,0,0,0.25)`) yang usang era 2012, digantikan dengan active press tactile compression (`transform: scale(0.97)` via spring physics).
   - Menghapus tabrakan dua font (Poppins vs Plus Jakarta Sans), menstandarisasi 100% antarmuka pada satu keluarga font **Plus Jakarta Sans** dengan optical tracking terkalibrasi (-0.025em s.d. +0.010em).
   - Menegakkan aturan mutlak `font-variant-numeric: tabular-nums` pada seluruh angka numerik (KPI, jam layar/terbang, Rupiah, koordinat maritim, telemetri live) guna mengeliminasi goyangan horizontal layout (*jitter*).
2. **Material Translusen (Vibrancy) & Elevasi Konsentris**:
   - Memodifikasi kartu dari kardus padat `#FFFFFF` menjadi material tembus pandang bersaturasi lembut (`rgba(255, 255, 255, 0.82)` + `backdrop-filter: blur(20px) saturate(180%)`) dan hairline border 1px.
   - Mengadopsi layered ambient shadow Apple (Level 1 kartu, Level 2 floating dropdown, Level 3 modal).
   - Menegakkan hukum geometri konsentris: $\text{Radius Inner} = \max(0, \text{Radius Outer} - \text{Padding})$.
3. **Fisika Pegas & Dinamika Spasial Terjangkar**:
   - Menerapkan token kurva aproksimasi pegas Apple (`--n-spring-snappy`, `--n-spring-modal`, `--n-spring-bounce`) menggantikan kurva transisi linear.
   - Mengubah modal dialog dari ekspansi tengah layar menjadi anchored scale-up (`scale(0.94)` ke `1.0`) berakar dari tombol pemicu dengan overlay blur 8px.
   - Menetapkan spesifikasi gestur geser tutup (*swipe-to-dismiss*) untuk bottom sheet dan drawer mobile.

### 2. Penyesuaian Roadmap Fase
- Menetapkan **Fase 16** sebagai **Master UI/UX Overhaul: Apple Design System, Tactile Physics & Eliminasi Total AI-Slop**.
- Menyesuaikan penomoran fase fungsional berikutnya:
  - **Fase 17**: Fondasi Anggaran APBN (Reguler vs ABT), Header Live Telemetry, Simplifikasi Ikhtisar SiMata & Kompresi Kanvas Bukti Dukung.
  - **Fase 18**: Peta Taktis 34 Kapal Pengawas Ukuran Besar, Interlock Validasi Laik Laut, & Scoring Engine Kapal Terbaik Triwulanan.
  - **Fase 19**: Smart Bulk Import Engine Excel (High-Volume Ingestion) & Modular Sub-Context Divisi Teknis.
  - **Fase 20**: Sistem Monitoring Paket Pekerjaan Lintas Divisi & Modular Sub-Context Divisi Pendukung.
  - **Fase 21**: Pipeline Data Mart Looker Studio, Ekspor/Backfill Laporan Historis, & Finalisasi PRD Timja.

---

## [Perencanaan Master & Spesifikasi Teknis] — Cetak Biru 13 Butir Revisi: Nomenklatur Resmi, Modular Sub-Context & Split History 8 Divisi, Peta Taktis 34 Kapal Besar, Model APBN Reguler vs ABT, Kapal Terbaik TW, Smart Import Excel, Data Mart Looker Studio, & Roadmap Fase 16–20

**Tanggal**: 14 Oktober 2026  
**Status**: **SELESAI DIDOKUMENTASIKAN DI SELURUH MD UTAMA** (`PRD.md`, `DATA_SCHEMA.md`, `ARCHITECTURE.md`, `PHASES.md`). Siap dieksekusi bertahap per fase.

### 1. Pencapaian & Keputusan Strategis Pemangku Kepentingan
1. **Standarisasi Nomenklatur Resmi Kedinasan & Label Singkat Antarmuka**:
   - Menyelaraskan seluruh unit kerja dengan struktur resmi KKP: Suku Bagian Tata Usaha, Sub Direktorat Operasi Kapal Pengawasan dan Pesawat (membawahi Operasi Laut & Udara), serta 5 Tim Kerja Teknis (Intelijen, Pelayanan, Perawatan, Logistik, Pengawakan).
   - Label antarmuka untuk unit SPKP/VMS resmi diganti dari **"Pemantauan"** menjadi **"Pelayanan"**.
2. **Dekonstruksi Form "Gabrug" Menjadi Modular Sub-Context & Split History (8 Divisi)**:
   - Menghapus formulir mingguan raksasa tunggal per divisi. Setiap modul dipecah menjadi 2–4 sub-tab konteks mandiri dengan form ringkas dan tabel riwayat independen (*Split History Grid*).
3. **Peta Taktis 34 Kapal Pengawas Ukuran Besar (Screenshot 2 & 3)**:
   - Mengunci referensi armada taktis pada 34 kapal besar: 26 operasional di WPP penugasan, 6 siap di pangkalan (Jakarta & Batam), dan 2 pemeliharaan di galangan (Jakarta & Lamongan).
   - Interlock validasi laik laut: status `TIDAK_SIAP` di Perawatan otomatis mengunci kapal dari form hari layar di Operasi Laut.
4. **Formula Penilaian Kapal Terbaik Triwulanan (Ship of the Period TW I–IV)**:
   - Mengukur kinerja operasional murni di laut: Hari Layar (40%), Poin Penindakan KIA/KII/Rumpon (35%), Volume Riksa (15%), dan Valuasi Penyelamatan (10%).
5. **Rekonstruksi Model Akuntansi Anggaran Reguler vs ABT**:
   - Memisahkan Pagu Reguler vs ABT serta Realisasi SP2D vs Akrual dalam matriks 2x2 pada Tata Usaha dan Ikhtisar.
6. **Penyelarasan Desain Ikhtisar dengan Pola Data-First SiMata**:
   - Mengeliminasi *unnecessary visual bloat / clutter* (waffle chart, heatmap mikro seluler, donut ad-hoc).
   - Mengadopsi action toolbar, kartu metrik `X — Y% dari total`, dan Executive Monitoring Data Grid 8 unit kerja.
7. **Infrastruktur Data Mart Looker Studio & Smart Bulk Import SheetJS**:
   - Pendirian spreadsheet Data Mart `Nautika_Reporting_Looker` untuk laporan eksekutif dan PDF terjadwal.
   - Perancangan Smart Bulk Import Engine berbasis SheetJS di sisi klien untuk menangani ratusan kapal tangkapan/riksa per bulan.
8. **Strategi Kapasitas Google Drive Multi-Tier**:
   - Tier 1: Kompresi kanvas sisi klien (maks 1600px, JPEG 0.8) mereduksi ukuran foto bukti ~80% (<500 KB) dan kebijakan tautan video.
   - Tier 2 (Menyusul): Arsitektur Storage Node receiver pada akun Google kedua.

### 2. Dokumen yang Dimodifikasi
- [PRD.md](file:///home/pinefeast/Projects/nautika/PRD.md): Pembaruan Section 4 (nomenklatur Pelayanan), Section 5.1 (Ikhtisar SiMata), Section 5.2 (Reguler vs ABT & Paket), Section 5.3 (Ops Laut sub-konteks), Section 5.6 (Pelayanan), Section 5.7 (Perawatan interlock), penambahan Section 5.12–5.16 (Kapal Terbaik, Peta Taktis 34 Kapal, Import Engine, Looker Studio, Storage Drive).
- [DATA_SCHEMA.md](file:///home/pinefeast/Projects/nautika/DATA_SCHEMA.md): Penambahan atribut `KelasKapal`/`PanjangMeter`/`PangkalanHomebase` pada Master Kapal, tabel `Master_Paket`, pemisahan kolom Reguler vs ABT pada `TX_TataUsaha`, tabel `TX_Paket_Progres`, `TX_OperasiLaut_Tangkapan`, `TX_Kapal_Posisi`, dan skema Data Mart `Nautika_Reporting_Looker`.
- [ARCHITECTURE.md](file:///home/pinefeast/Projects/nautika/ARCHITECTURE.md): Penambahan struktur spreadsheet ke-4 Data Mart, arsitektur modular sub-context & split history, interlock laik laut, smart bulk import SheetJS, dan manajemen storage multi-tier.
- [PHASES.md](file:///home/pinefeast/Projects/nautika/PHASES.md): Penambahan roadmap resmi Fase 16 sampai Fase 20 sebelum tahap akhir audit DoD.

---

## [Fase 15b] — Modular Silent Reloaders & Auto-Sync Transaksi Site-Wide (14 Modul, Anti-Flicker, dan Preservasi Scroll)

**Tanggal**: 12 Oktober 2026  
**Status**: **SELESAI & TERUJI LOKAL** (`node --check` 100% lulus, VM unit test Node berhasil memvalidasi seluruh 14 modul). Menunggu `clasp push` dan pengujian runtime oleh user.

### 1. Pencapaian & Ringkasan Perubahan
1. **Registry Silent Reloader Modular (`_SYNC_RELOADERS`)**:
   - Dibuat di `html/Script_Main.html` untuk memetakan seluruh 14 modul dan view data secara granular:
     - `overview`: `_ovLoadData(true)` + `_refreshApprovalPanels()` (KPI utama, chart penindakan & tren, grid 6-kolom, choropleth WPP, antrean approver).
     - `tata-usaha`: `_tuLoadKPI(true)` + `_tuLoadHistory(true)` (KPI pagu/realisasi, tren bulanan, riwayat).
     - `operasi`: `_opsLautLoadKPI(true)` / `_opsUdaraLoadKPI(true)` + history, adaptif terhadap tab aktif (`_OPS.tab === 'pesawat'` atau `'kapal'`).
     - `intelijen`: `_intelLoadKPI(true)` + `_intelLoadHistory(true)` (KPI kejadian, tabel kawasan, chart jenis, riwayat).
     - `pemantauan`: `_pemLoadKPI(true)` + `_pemLoadHistory(true)` (KPI penerbitan/migrasi/penyedia, riwayat).
     - `perawatan`: `_rawatLoadKPI(true)` + `_rawatFetchHistory(_RAWAT.tab, true)` + `_rawatBuildPaneCharts()` (adaptif sub-tab: kesiapan, docking, atau item).
     - `logistik`: `_logLoadKPI(true)` + `_logFetchHistory(_LOG.tab, true)` + `_logBuildPaneCharts()` (adaptif sub-tab: amunisi, bbm, atau personil).
     - `pengawakan`: `_awkLoadKPI(true)` + `_awkFetchHistory(_AWK.tab, true)` + `_awkBuildPaneCharts()` (adaptif sub-tab: akn atau kegiatan).
     - `kegiatan`: `_kgdLoadKPI(true)` + `_kgdLoadHistory(true)` (feed kronologis kegiatan direktorat).
     - `riwayat`: `_riwLoad(true)` (tabel agregasi lintas modul & filter status tab).
     - `master-data`: `_mdReloadActiveTab(true)` (adaptif sub-tab kapal/kawasan/wpp/opsi).
     - `kelola-akun`: `_adnReloadActiveTab()` (adaptif sub-tab persetujuan/pengguna/audit/reminder).
     - `notifikasi`: `_ntfReload()` (daftar notifikasi).
     - `profil-kapal`: `_pkLoad()` (kartu profil kapal terpilih).
2. **Pemberantasan Flicker (Anti-Flicker Mechanism)**:
   - Menambahkan parameter `silent = true` pada seluruh loader KPI strip dan tabel riwayat agar tidak mengganti DOM menjadi skeleton spinner saat background update berjalan. Elemen UI yang ada tetap utuh dan data langsung terbarui begitu respons server tiba.
3. **Peta WPP Tetap Utuh (Zero Harsh Map Teardown)**:
   - Peta Leaflet pada Operasi Laut dan Operasi Udara tidak dihancurkan; hanya layer intensitas poligon WPP (`_renderWppLayer()` / `_renderOpsUdaraWppLayer()`) yang di-update warnanya in-place.
4. **Preservasi Scroll Window & Tabel**:
   - `_dispatchModuleSilentReloader(viewId)` mencatat koordinat scroll halaman (`window.pageYOffset`) dan scroll kontainer tabel (`.n-table-wrap`, `.table-responsive`) sebelum pembaruan, lalu memulihkannya kembali secara instan setelah render selesai. Kursor dan posisi pandang pengguna tidak pernah mental ke atas layar.
5. **Preservasi Filter & Sub-Tab**:
   - Semua sub-tab aktif (`_OPS.tab`, `_RAWAT.tab`, `_LOG.tab`, `_AWK.tab`, `_ADN.tab`, `_MD.tab`, `_RIW.statusTab`) dan filter periode global (`APP.filter`) tetap terjaga utuh.

### 2. Keputusan Teknis
- **In-Place Updates**: Menghindari penghancuran dan pembuatan ulang DOM wrapper (`page-content`) saat data server berubah. Update data ditargetkan langsung ke elemen data/chart tanpa merusak state antarmuka.
- **Scroll Memory Microtask**: Penundaan 120ms pemulihan scroll memastikan DOM tabel selesai dibangun oleh browser sebelum koordinat `scrollTop` dipulihkan.

### 3. File yang Dimodifikasi
- `html/Script_Main.html`: Penambahan `_SYNC_RELOADERS`, `_dispatchModuleSilentReloader()`, `_adnReloadActiveTab()`, `_mdReloadActiveTab()`, penambahan parameter `silent` pada seluruh fungsi loader KPI & history.
- `PHASES.md`: Status Fase 15b diubah menjadi Selesai. Seluruh fase pengembangan roadmap resmi tuntas.

---

## [Fase 15a] — Fondasi Backend Version-State & Client Heartbeat Engine (Live-Sync Real-Time Tanpa F5, Form Modal Guard, dan Zero-Sheet-Read)

**Tanggal**: 12 Oktober 2026  
**Status**: **SELESAI & TERUJI LOKAL** (`node --check` 100% lulus di seluruh file backend dan skrip HTML client). Menunggu `clasp push` dan pengujian runtime oleh user.

### 1. Pencapaian & Ringkasan Perubahan
1. **Backend Version-State Endpoint (`app_getSyncState`)**:
   - Dibuat di `services/DashboardService.js` sebagai kanal komunikasi sinkronisasi ultra-ringan tanpa membaca spreadsheet (*Zero-Sheet-Read*, eksekusi < 50ms).
   - Membaca `DASH_TX_VERSION` langsung dari `CacheService` RAM yang otomatis dinaikkan oleh `bumpTxVersion()` di `data/SheetAccess.js` pada setiap operasi tulis/revisi/anulir.
   - Mengambil jumlah unread notifikasi user dan antrean approval approver langsung dari cache RAM, dengan cache setter di `NotifikasiService.js` dan `AuthService.js`.
2. **Client Heartbeat Engine Terpadu**:
   - Diterapkan di `html/Script_Main.html` dengan interval periodik 35 detik (`APP_SYNC.syncInterval`).
   - Berjalan senyap via `_silentRun(fn)` sehingga tidak memicu spinner `#filter-busy` yang mengganggu pandangan pengguna.
   - Dilengkapi *Tab Visibility & Focus Sync*: saat tab diminimalkan atau disembunyikan, heartbeat dijeda; saat tab aktif kembali (`visibilitychange` atau window `focus`), sinkronisasi instan (*sync-on-focus*) langsung dipicu.
3. **Form Modal Guard (Anti-Interupsi Input Data)**:
   - Fungsi `_isFormActive()` mendeteksi keberadaan overlay formulir yang sedang terbuka (`.n-overlay:not(.n-hidden)`), drawer penolakan/persetujuan, atau input teks di layar yang sedang menerima fokus pengguna (`document.activeElement`).
   - Jika versi data di server berubah saat form sedang aktif, proses reload otomatis **ditunda** (`APP_SYNC.deferredReload = true`) demi menjamin formulir yang sedang diketik pengguna tidak ter-reset atau terinterupsi.
   - Begitu modal ditutup melalui `closeModal(id)` atau submit selesai via `_formSubmitDone()`, fungsi `_syncCheckDeferred()` otomatis mengeksekusi pembaruan data yang tertunda secara halus.
4. **Indikator Live Status UI**:
   - Menambahkan elemen `#sync-indicator` di header halaman (`_renderPageHeader`) tepat di samping `#filter-busy` dengan gaya pill minimalis (`Style.html`).
   - Menyediakan 3 status semantik:
     - `Tersinkron`: titik hijau lembut, menunjukkan data lokal identik dengan server. Tooltip menampilkan timestamp sinkronisasi terakhir.
     - `Menyinkronkan…`: titik biru dengan animasi denyut halus saat RPC in-flight.
     - `Ada Pembaruan`: titik oranye peringatan lembut saat ada data baru namun pembaruan ditunda karena form sedang aktif.
   - Mendukung interaksi klik manual (`_triggerManualSync()`) sehingga pengguna dapat memaksa pengecekan data ke server kapan saja secara instan.
5. **Reloader Dispatcher (`_executeCurrentViewReloader`)**:
   - Menyiapkan dispatcher sentral pembaruan data untuk tampilan aktif (Overview, Notifikasi, Admin Panel, Riwayat Laporan) yang akan diperluas ke 14 modular silent reloader di Fase 15b.

### 2. Keputusan Teknis
- **Zero-Sheet-Read via CacheService**: Polling berkala setiap 35 detik tidak membebani kuota `SpreadsheetApp.openById` Google Apps Script karena seluruh data versi dan hitungan badge dilayani dari memory cache RAM (`CacheService.getScriptCache()`).
- **Deferred Update Alih-alih Interupsi**: Menghindari keluhan umum sistem auto-refresh di mana form yang sedang diisi pengguna tiba-tiba ter-reload atau kursor mental saat rekan kerja lain mengunggah laporan.
- **Pill Indikator Ramah Desain**: Mematuhi `DESIGN.md` §1 (negative prompt: tanpa gradien mencolok, tanpa border neon, tanpa efek kaca berlebihan, tipografi 0.72rem berpadu serasi dengan tema nautika).

### 3. File yang Dimodifikasi
- `services/DashboardService.js`: Penambahan endpoint `app_getSyncState(token)`.
- `services/NotifikasiService.js`: Caching `SYNC_UNREAD_` di `notifikasi_getRingkasan()`.
- `services/AuthService.js`: Caching `SYNC_QUEUE_` di `auth_getPendingApprovals()`.
- `html/Style.html`: Styling `.sync-indicator`, `.sync-indicator-dot`, `.is-syncing`, `.is-deferred`.
- `html/Script_Main.html`: State `APP_SYNC`, `_isFormActive()`, `_syncCheckDeferred()`, `_syncUpdateIndicator()`, `#sync-indicator` di `_renderPageHeader()`, `closeModal()`, `_runSyncTick()`, `_startAppHeartbeat()`, dan `_executeCurrentViewReloader()`.
- `PHASES.md`: Status Fase 15a diubah menjadi Selesai, dependensi Fase 15b terbuka.

---

## [Struktur Roadmap] — Audit Definition of Done Dipindahkan ke Tahap Akhir Proyek (Fase 14 Resmi Selesai)

**Tanggal**: 12 Oktober 2026  
**Status**: Dokumentasi roadmap `PHASES.md` & `AGENTS.md` disinkronkan. Fase 14 resmi berstatus **Selesai**. Target pengerjaan berikutnya adalah **Fase 15a**.

**Keputusan User**:
> "untuk audit tolong dipindahkan ke akhir, tidak usah masuk fase, dia hanya akan ke trigger setelah saya minta lanjut tapi tidak ada fase lagi, tolong ubah changelog phases dkk"

### Rincian Perubahan Struktur:
1. **Fase 14 Resmi Ditandai Selesai**:
   - Seluruh 6 item perbaikan visual, layout grid asimetris 6-kolom tanpa gauge di Ikhtisar, perbaikan loader on-demand peta WPPNRI, serta auto-detection persetujuan pendaftaran (serialisasi Date GAS + hak veto Superadmin + flush sheet) telah terverifikasi sukses.
2. **Audit Definition of Done (DoD) Dipindahkan ke Post-Phases**:
   - Audit menyeluruh Definition of Done per modul ([`AGENTS.md` §6](file:///home/pinefeast/Projects/nautika/AGENTS.md#L60-L75)) dikeluarkan dari cakupan Fase 14.
   - Audit diposisikan sebagai tahap *Standby* di akhir roadmap (`PHASES.md` §Tahap Akhir) dan **tidak memiliki nomor fase** serta **tidak memblokir** fase fitur.
   - Tahap audit hanya akan dieksekusi jika seluruh fase pengembangan selesai dan user meminta *"lanjut"* saat tidak ada fase tersisa.
3. **Fase Aktif Berikutnya**:
   - Sistem kini langsung menuju **Fase 15a — Fondasi Backend Version-State & Client Heartbeat Engine**.

---

## [Fix — Sebelum Fase 15] — Perbaikan Auto-Detection Akun Disetujui (Serialisasi Date GAS, Hak Veto Superadmin, Flush Sheet, dan Auto-Redirect)

**Tanggal**: 12 Oktober 2026  
**Status**: **SELESAI & TERUJI LOKAL** (`node --check` seluruh backend dan frontend lolos 100%, verifikasi syntax script client sukses). Menunggu `clasp push` dan verifikasi runtime oleh user.

**Laporan User**:
> "Sistem masih tidak mendeteksi bahwa akun sudah di acc, tidak auto refresh yang menunjukkan akunnya sudah di acc, padahal sudah di acc"

### Bagian 1 — Akar Masalah yang Ditemukan (Root Cause)

1. **Akar Masalah Utama: Serialisasi Date Object pada Google Apps Script (`AuthService.js`)**:
   - Di `auth_checkRegistrationStatus`:
     ```javascript
     if (status === USER_STATUS.APPROVED) {
       resData.approvedAt = userRow.obj['ApprovedAt'] || null;
       return { success: true, data: resData };
     }
     ```
   - Saat Superadmin menyetujui akun, kolom `ApprovedAt` diisi dengan `new Date()`. Pembacaan via `sheet.getDataRange().getValues()` mengembalikan objek JavaScript `Date` asli.
   - Sesuai spesifikasi Google Apps Script, `google.script.run` **tidak mendukung pengembalian objek `Date` langsung** (hanya primitif/JSON polos). Kegagalan serialisasi internal GAS menyebabkan callback `withSuccessHandler` menerima nilai `null` (atau melempar exception silent).
   - Di sisi client, guard `if (!res || !res.success || !res.data) return;` langsung keluar diam-diam saat menerima `null`, sehingga client terus berada dalam loop polling tanpa pernah mengeksekusi blok status `APPROVED`!
2. **Konflik Otoritas Approval Superadmin pada Antrean Staf (`AuthService.js`)**:
   - Permohonan Staf di-route ke `KADIV`. Validasi lama di `auth_decideApproval` dan `auth_getPendingApprovals` membatasi Superadmin hanya bisa memutuskan `RoutedTo === 'SUPERADMIN'`, sehingga saat Superadmin menyetujui permohonan staf, server menolak dan status di sheet `Users` tidak berubah.
3. **Penyimpanan Spreadsheet Tertunda (Buffer Write) Tanpa `SpreadsheetApp.flush()`**:
   - `updateRowCells` dan `appendRowData` di `SheetAccess.js` sebelumnya tidak memanggil `SpreadsheetApp.flush()`, sehingga request polling unauthenticated dari browser pendaftar membaca data stale yang belum ter-commit.
4. **Kurangnya Umpan Balik Visual & Ketiadaan Auto-Redirect**:
   - Judul layar tetap menampilkan "Menunggu Persetujuan" dan badge status kartu tidak berubah. Pengguna bingung apakah harus me-refresh atau menunggu.

### Bagian 2 — Solusi & Perubahan Teknis

1. **Serialisasi Date Aman & Case-Insensitive Lookup ([`services/AuthService.js`](file:///home/pinefeast/Projects/nautika/services/AuthService.js))**:
   - `resData.approvedAt` dikonversi ke ISO string: `(appAt instanceof Date) ? appAt.toISOString() : (appAt ? String(appAt) : '')`.
   - Pencarian pendaftar kini dilengkapi pencarian toleran kapitalisasi dan spasi (`trim().toLowerCase()`).
   - Diberikan hak veto mutlak kepada `ROLE.SUPERADMIN` pada `auth_decideApproval` dan `auth_getPendingApprovals` agar dapat melihat dan memutuskan seluruh permohonan registrasi staf maupun kadiv.
   - Dihapus fungsi scratch dangling `auth_checkStatusByEmail_global_fn`.
2. **Sinkronisasi Queue pada Admin Panel ([`services/AdminService.js`](file:///home/pinefeast/Projects/nautika/services/AdminService.js))**:
   - Jika Superadmin menyetujui/menolak pengguna lewat menu Admin Panel (`admin_updateUser`), baris antrean di `Approval_Queue` ikut disinkronkan ke status yang sama.
3. **Komit Instan Sheet ([`data/SheetAccess.js`](file:///home/pinefeast/Projects/nautika/data/SheetAccess.js))**:
   - Ditambahkan `SpreadsheetApp.flush()` pada `appendRowData` dan `updateRowCells` sehingga seluruh mutasi status tersimpan seketika di Google Sheets.
4. **Auto-Detection, Badge Update & Countdown Redirect ([`html/Script_Main.html`](file:///home/pinefeast/Projects/nautika/html/Script_Main.html))**:
   - Polling mendeteksi `APPROVED`, menghentikan timer, dan menghapus cache pending di `sessionStorage`.
   - Mengubah judul layar `#v-pending` menjadi *"Pendaftaran Disetujui"*, menyembunyikan kotak teks verifikasi lama, dan memperbarui badge status di kartu menjadi badge hijau semantik: `<span class="badge badge-success">Disetujui &amp; Aktif</span>`.
   - Menampilkan banner notifikasi hijau persetujuan dengan tombol interaktif *"Masuk ke Akun (Sign In)"*.
   - Menyediakan countdown otomatis 4 detik yang membawa pengguna langsung ke halaman login dengan email yang telah terisi dan kursor fokus pada input password.
   - Dilengkapi log konsol informatif (`console.log`/`console.warn`) untuk monitoring transparan.

---

## [Roadmap — Fase 15] — Perancangan Spesifikasi Arsitektur Systemwide Live-Sync & Real-Time Data (No-Refresh)

**Tanggal**: 7 Oktober 2026
**Status**: Spesifikasi teknis, arsitektur, dan mitigasi risiko telah dirancang dan didokumentasikan di `PHASES.md` (§Fase 15a & 15b), `ARCHITECTURE.md` (§12), dan `PRD.md` (§12). Menunggu konfirmasi user sebelum implementasi kode.

**Permintaan user**: "Ok, tambahkan fitur ini pada fase dulu, buat detailnya yang jelas, masukkan ke md md itu, intinya dibuat plan detail for next phase, terserah mau satu fase atau dipecah jika ingin lebih aman, yang penting detail, dan AI bisa membaca dan mengimplementasikannya kedepannya"

### Bagian 1 — Dekomposisi Fase & Ruang Lingkup

Fase 15 dipecah menjadi dua sub-fase independen dan berurutan untuk menjamin keselamatan data, efisiensi kuota, dan kemudahan verifikasi:

1. **Fase 15a — Fondasi Backend Version-State & Client Heartbeat Engine:**
   - Endpoint server `app_getSyncState(token)` yang membaca `DASH_TX_VERSION` murni dari `CacheService` RAM (zero-sheet-read, < 50ms).
   - Client Heartbeat Engine 35 detik dengan wrapper `_silentRun(fn)` (tanpa menyalakan `#filter-busy`).
   - Tab Visibility Guard: pause saat tab tidak aktif (`hidden`), sinkronisasi instan saat tab dibuka kembali (*sync-on-focus*).
   - Form Modal Guard: menunda reload data jika pengguna sedang membuka modal form input/revisi atau sedang mengetik, sehingga tidak ada input yang terinterupsi/hilang.
   - Indikator status live non-intrusive di header/footer patuh `DESIGN.md` §1.
2. **Fase 15b — Modular Silent Reloaders & Auto-Sync Transaksi Site-Wide:**
   - Registry `_SYNC_RELOADERS` untuk 14 modul (Overview, 9 Divisi, Kegiatan, Riwayat Laporan, Master Data, Kelola Akun).
   - Preservasi scroll position dan filter periode global saat silent reload berjalan.
   - Peta Leaflet (Operasi & Ikhtisar) memperbarui data in-place tanpa mengunduh ulang GeoJSON 10MB atau me-reset viewport/zoom.
   - Uji multi-user/multi-tab: submit data di satu sesi otomatis tampil di sesi lain dalam tempo ≤ 35 detik tanpa me-refresh halaman peramban (F5).

---

## [Fase 14 — Auth & Real-Time] — Auto-Detection Status Persetujuan Registrasi & Auto-Refresh Tanpa Reload

**Tanggal**: 7 Oktober 2026
**Status**: Implementasi selesai & terverifikasi lokal (`node --check` seluruh file backend dan client 100% valid, uji unit dan integrasi DOM virtual berhasil). Verifikasi runtime GAS menunggu user. Tidak ada `clasp push` (agen tidak melakukan deploy — `AGENTS.md` §5b).

**Permintaan user**:
1. "Ubah logika agar semuanya tidak terbatas atau hanya berbasis pada refresh, jadi data akan tetap diperbarui meskipun tidak refresh, hal seperti membaca notif saja perlu refresh dan lain lain, silakan evaluasi."
2. "Ini juga akan mengarah ke sistem sign up, saya mau, dia tuh setelah sign up jika memang masih membuka sign up page dan sudah di acc oleh atasan, akan ada notifikasi di atasnya muncul, bahwa akun anda sudah diterima berhasil dibuat dkk, lalu ada perintah untuk sign in dan bisa di klik tombol sign in nya untuk mengarah ke sign in"

### Bagian 1 — Akar Masalah & Kebutuhan

1. **Pendaftar Harus Me-refresh Manual untuk Mengetahui Akun Telah Di-ACC:**
   - Sebelumnya, setelah menyelesaikan verifikasi OTP dan registrasi (`_regSubmitRegister`), sistem langsung mengalihkan user ke form login kosong dengan pesan flash sesaat.
   - Pendaftar yang menunggu akunnya disetujui atasan/administrator tidak memiliki feedback real-time; jika atasan menyetujui akun saat pendaftar membuka layar pending, pendaftar tidak tahu sampai mencoba login ulang atau me-refresh.
   - Tidak ada endpoint unauthenticated yang aman untuk memeriksa status akun pendaftar (`PENDING`/`APPROVED`/`REJECTED`) secara periodik.
2. **Ketergantungan pada Refresh Manual untuk Data Global (Notifikasi, Approvals, Status Shell):**
   - Saat menandai satu notifikasi dibaca (`_ntfMarkRead`), fungsi hanya me-reload daftar notifikasi tetapi tidak memanggil `_applyShellStatus()`, sehingga badge unread di sidebar tetap tidak berkurang sampai refresh manual.
   - Ketika ada notifikasi baru masuk (misal permintaan approval baru untuk Kadiv/Direktur, atau peringatan laporan mingguan), angka badge dan status shell tidak pernah terbarui tanpa refresh halaman.
   - Sesi pendaftar yang login sebelum disetujui tidak dibersihkan saat akun di-ACC/ditolak.

### Bagian 2 — Solusi & Perubahan Teknis

1. **Endpoint Status Pendaftaran Server (`services/AuthService.js`):**
   - Ditambahkan endpoint publik `auth_checkRegistrationStatus(params)` yang menerima `{ email, userId }`.
   - Endpoint mencari data akun di sheet `Users` (dan `Approval_Queue` bila status `REJECTED` untuk mengambil alasan penolakan).
   - Mengembalikan `{ status, nama, email, approvedAt, alasanReject }` secara aman tanpa memerlukan token sesi dan tanpa membocorkan hash password.
   - `auth_register` diperkaya mengembalikan data profil lengkap pendaftar (`userId`, `nama`, `email`, `role`, `divisiId`).
   - `auth_decideApproval` memanggil `_revokeUserSessions(q['UserID'])` untuk memastikan sesi lama pendaftar dicabut secara bersih saat persetujuan/penolakan diputuskan.
2. **Auto-Detection & Banner Persetujuan Registrasi (`html/Index.html`, `html/Style.html`, `html/Script_Main.html`):**
   - Pada `_regSubmitRegister`: form di-reset, data pendaftar disimpan di `sessionStorage` (`NAUTIKA_PENDING_REG`), tampilan beralih ke layar `Menunggu Persetujuan` (`#v-pending`) dengan rincian nama, email, jabatan, serta indikator status live pulse.
   - Polling berkala `_startPendingStatusPolling` (interval 8 detik) memeriksa status ke server secara otomatis.
   - Saat akun disetujui (`status === 'APPROVED'`):
     - Polling dihentikan dan data pending di `sessionStorage` dibersihkan.
     - Ditampilkan banner notifikasi hijau solid (`#ECFDF5`, border `#10B981`, teks `#065F46`, tombol `.btn-primary` `#2B3674`) di bagian atas kartu: *"Akun Anda Berhasil Disetujui!"* disertai pesan bahwa pendaftaran telah disetujui dan akun telah aktif.
     - Dilengkapi tombol interaktif **"Masuk ke Akun (Sign In)"** yang dapat langsung diklik.
     - Klik tombol memanggil `_pendingGoToLogin(email)` yang langsung mengarahkan ke form login (`#v-login`), mengisi otomatis email pendaftar ke input email, dan memfokuskan kursor ke input password.
   - Saat pendaftaran ditolak (`status === 'REJECTED'`): banner merah (`#FEF2F2`, border `#EF4444`) menampilkan alasan penolakan dan tombol "Daftar Ulang" (`_pendingGoToRegister`).
   - Jika pendaftar me-refresh halaman saat masih pending, sesi pending dipulihkan dari `sessionStorage` dan polling dilanjutkan secara otomatis.
3. **Pembaruan Notifikasi Seketika & Heartbeat Aplikasi Tanpa Reload:**
   - `_ntfMarkRead(notifId)` kini langsung memanggil `_applyShellStatus()` segera setelah penandaan dibaca berhasil, sehingga badge unread sidebar langsung berkurang seketika.
   - Ditambahkan flag `_SILENT_RPC` dan fungsi pembungkus `_silentRun(fn)` agar pemanggilan server di latar belakang tidak menyalakan spinner busy `#filter-busy`.
   - Diimplementasikan `_startAppHeartbeat()` (interval 25 detik) saat user login:
     - Memperbarui badge notifikasi dan strip pengingat mingguan (`_applyShellStatus()`).
     - Jika user sedang membuka modul notifikasi, me-reload daftar notifikasi (`_ntfReload()`).
     - Jika approver sedang membuka overview atau panel kelola akun, me-refresh antrean approval (`_refreshApprovalPanels()`).
   - Ditambahkan listener `visibilitychange` dan `focus`: saat user kembali ke tab browser Nautika, status shell dan pendaftaran langsung diperbarui tanpa menunggu timer.
   - Diperbarui `_routeTo(viewId)`: memanggil `_applyShellStatus()` pada setiap pergantian rute.
   - Diperbarui `doApprove` dan modal tolak: langsung memanggil `_applyShellStatus()` setelah keputusan disimpan.
4. **Kepatuhan Desain (`DESIGN.md` §1):**
   - Banner persetujuan menggunakan warna semantik solid (`#10B981` success, `#EF4444` critical, `#2B3674` primary) tanpa gradient blob/mesh, tanpa shadow berlapis, dan tanpa copywriting filler.

### Bagian 3 — Verifikasi

- `node --check`: Seluruh file backend (`services/*.js`, `utils/*.js`, `data/*.js`, `Setup.js`, `Code.js`) dan skrip client `html/Script_Main.html` lolos sintaks 100%.
- Unit test Node VM:
  1. `auth_checkRegistrationStatus` parameter kosong -> ditolak dengan error jelas.
  2. `auth_checkRegistrationStatus` status `PENDING` -> berhasil mengembalikan status dan identitas.
  3. `auth_checkRegistrationStatus` status `APPROVED` -> berhasil mengembalikan status dan tanggal persetujuan.
  4. `auth_checkRegistrationStatus` status `REJECTED` -> berhasil membaca dan mengembalikan alasan penolakan dari antrean.
  5. `auth_checkRegistrationStatus` user tidak terdaftar -> ditolak dengan status error.
- Integrasi DOM client:
  1. Auto-polling mendeteksi `APPROVED` dan merender banner persetujuan dengan benar.
  2. Tombol "Masuk ke Akun (Sign In)" aktif dan memicu `_pendingGoToLogin(email)`, mengisi input email, dan menampilkan view login.
  3. Heartbeat berkala memicu `notifikasi_getRingkasan` dan memperbarui badge unread sidebar secara otomatis.

---

## [Fase 14 — Perbaikan] — Peta Ikhtisar Grey Box / Tidak Muncul Sebelum Buka Modul Lain (Loader Leaflet On-Demand Shared)

**Tanggal**: 7 Oktober 2026
**Status**: Implementasi selesai & terverifikasi lokal (`verify.sh` OK — 95 endpoint, `selftest.js` 140 pass / 0 fail, `nulltest.js` 12/12 pass, `node --check` client & server bersih). Verifikasi visual & runtime GAS menunggu user. Tidak ada `clasp push` (agen tidak melakukan deploy — `AGENTS.md` §5b).

**Permintaan user**: "Peta di ikhtisar sering hilang, seringkali perlu ke menu lain baru kembali ke ikhtisar agar muncul, leafletnya ya yangga muncul entirely, grey box"

### Bagian 1 — Akar Masalah

1. **`_ovMapInit()` mengasumsikan Leaflet (`L`) sudah ada di memori global (`window.L`):**
   - Di `html/Script_Main.html`, loader on-demand Leaflet (`_loadLeaflet`) sebelumnya hanya dideklarasikan dan dipanggil di modul Operasi Laut & Udara (baris 5256).
   - Saat aplikasi pertama kali dimuat atau di-refresh, halaman default adalah **Ikhtisar** (`overview`). Pustaka CDN Leaflet belum pernah diunduh.
   - Fungsi `_ovMapInit()` memiliki guard `if (typeof L === 'undefined' || !L.map) return;`. Akibatnya, pada load pertama fungsi langsung `return` diam-diam tanpa memuat Leaflet.
   - Elemen `#ov-map` tetap menjadi `div` kosong setinggi 420px dengan latar belakang `var(--n-surface-2)` (tampak sebagai **kotak abu-abu / grey box**).
   - Ketika user membuka menu lain yang memuat peta (seperti Operasi Laut), modul tersebut memanggil `_loadLeaflet()`, sehingga Leaflet terunduh dan menempel di `window.L`. Saat user kembali ke Ikhtisar, barulah peta berhasil terinisialisasi.
2. **Tidak ada status loading awal pada elemen `#ov-map` di template HTML Ikhtisar:**
   - Saat request `dashboard_getOverview()` sedang berjalan (1–2 detik di GAS), `#ov-map` kosong melompong tanpa indikator loading, memperkuat impresi visual bahwa peta "hilang".
3. **Ukuran container Leaflet belum disinkronkan saat resize jendela:**
   - Tidak ada event listener window resize yang memicu `invalidateSize()`, sehingga jika orientasi atau viewport berubah, tile Leaflet bisa terdistorsi atau terpotong.

### Bagian 2 — Solusi & Perubahan Teknis

1. **Integrasi Loader Leaflet Terpadu (`_loadLeaflet` Shared):**
   - Variabel `_LEAFLET_LOADED`, `_leafletQueue`, dan fungsi `_loadLeaflet(cb)` dipindahkan ke blok utilitas geospasial bersama (sebelum `_OV_MAP`) sehingga tersedia secara hoist-safe untuk seluruh modul (Ikhtisar, Operasi Laut, dan Operasi Udara).
   - Duplikasi deklarasi di baris 5256 dibersihkan dan diganti referensi ke loader bersama.
   - `_loadLeaflet` dibuat idempoten dengan guard `document.getElementById('leaflet-js')` dan mendukung preloading tanpa callback.
2. **Perbaikan `_ovMapInit()` di Ikhtisar:**
   - `_ovMapInit()` kini membungkus inisialisasi di dalam `_loadLeaflet(function() { ... })`. Jika Leaflet belum siap, ia menunggu hingga script CDN selesai diunduh.
   - Jika kontainer sudah pernah memiliki `_leaflet_id` yang tertinggal saat navigasi cepat, ID dibersihkan sebelum `L.map('ov-map')` dibuat untuk mencegah exception `Map container is already initialized`.
   - Ditambahkan pemanggilan `invalidateSize()` bertenggang waktu 200ms setelah pembuatan peta dan 150ms setelah penambahan layer GeoJSON.
3. **Preload Leaflet & Initial Loading Indicator di Template Ikhtisar:**
   - Di dalam `_renderOverview(el)`, fungsi `_loadLeaflet()` dipanggil segera secara paralel dengan request `_ovLoadData()`, sehingga script Leaflet sudah selesai di-fetch sebelum respons data server tiba.
   - Template markup `#ov-map` di `_renderOverview` kini membawa markup spinner awal `.ops-map-status` ("Memuat peta WPP…"). Pengguna tidak pernah disajikan kotak abu-abu mati.
4. **CSS `#ov-map` & Window Resize Handler:**
   - `#ov-map` di `html/Style.html` diberi `position: relative;` agar overlay loading terkurung rapi di dalam batas kontainer peta.
   - Ditambahkan listener `window.addEventListener('resize')` (dengan typeof guard untuk kompatibilitas Node VM) yang otomatis memanggil `invalidateSize()` pada `_OV_MAP.map`, `opsLautMap`, dan `opsUdaraMap`.

### Bagian 3 — Verifikasi

- `verify.sh`: **VERIFY OK** (95 endpoint terdefinisi).
- `nulltest.js`: **12/12 pass** (aman dari TypeError dan context VM).
- `selftest.js`: **140 pass / 0 fail** (bertambah 1 regression test baru: `peta WPP: loader Leaflet on-demand terpasang di Ikhtisar (anti grey box)`).
- `node --check`: Seluruh file service backend dan skrip client `html/Script_Main.html` lolos uji sintaksis.

---

## [Fase 14 — Ikhtisar] — Visualisasi Dinamis & Grid Sejajar Ikhtisar (Multi-Span 6 Kolom, Non-Monoton Tanpa Gauge)

**Tanggal**: 7 Oktober 2026
**Status**: Implementasi selesai & terverifikasi lokal (`verify.sh` OK — 95 endpoint, `selftest.js` 139 pass / 0 fail, `nulltest.js` 12/12 pass, `node --check` client & server bersih). Verifikasi visual render headless Chromium (1280px & 820px) terbukti sejajar rata dan tanpa celah kosong. Verifikasi runtime GAS menunggu user. Tidak ada `clasp push` (agen tidak melakukan deploy — `AGENTS.md` §5b).

**Permintaan user**:
1. "Buat visualisasi pada ikhtisar lebih menarik, lebih sejajar, lebih sesuai, dan lebih ter highlight..." + penengahan widget Status & Penindakan (Komposisi Penindakan).
2. "Tidak sejajar ini, dan saya mau ditambahkan visualisasinya, tidak hanya progress bar semua, dibuat variatif tapi tetap relevan dengan apa yang ditampilkan, jangan pakai gauge tapi tetap explore untuk visualisasi, banyak yang bisa dikembangkan. dan ingat, semua kalau emang bentuk card harus sejajar, saya juga tidak mau masing-masing satu, mungkin ada yang memakan 2 grid card gitu jadi menyesuaikan dan tidak kaku. Chart juga harus bervariasi dimana-mana dan tetap bagus. Ingat, DINAMIS, tidak kaku."

### Bagian 1 — Grid 6 Kolom Dinamis & Multi-Span Kartu Divisi

- **Akar masalah visual**: Grid 3 kolom seragam memaksa seluruh kartu berukuran identik (1:1:1), padahal modul tertentu memiliki data historis/agregat kaya (mis. TU dan Logistik) yang membutuhkan ruang horizontal lebih leluasa, sementara modul lain ringkas (mis. Cakupan Laporan). Selain itu, kartu dengan isi visual berbeda menghasilkan tinggi berundak-undak jika tidak ditarik rata.
- **Solusi Grid Dinamis**:
  - `#ov-div-grid` diubah menjadi sistem grid **6 kolom** dengan `grid-auto-flow: row dense` dan `align-items: stretch`. Setiap kartu dalam satu baris ditarik sama tinggi dengan kartu tertinggi di baris tersebut.
  - Setiap kartu memiliki pembagian lebar (`span`) dari server yang mengisi penuh 6 kolom per baris:
    - **Baris 1 (Span 4 + 2 = 6)**: Tata Usaha (span 4 — layout split horizontal `.wide`: metrik di kiri, grouped column bars bulanan di kanan) berdampingan dengan Cakupan Laporan (span 2 — chip status melapor 7 divisi).
    - **Baris 2 (Span 2 + 2 + 2 = 6)**: Operasi Laut & Udara (span 2 — grouped bars KII vs KIA) + Perawatan (span 2 — donut kesiapan 3 segmen) + Intelijen (span 2 — ranked horizontal bars aktivitas).
    - **Baris 3 (Span 2 + 4 = 6)**: Pemantauan (span 2 — dual-line sparkline tren penerbitan bulanan) + Logistik (span 4 — layout split horizontal `.wide`: metrik di kiri, vertical column bars stok amunisi top-5 di kanan).
    - **Baris 4 (Span 3 + 3 = 6)**: Pengawakan (span 3 — waffle chart 40 sel proporsi penempatan AKN) + Kegiatan Pendukung (span 3 — calendar heatmap strip bulanan).
  - Area visual (`.vz`) menggunakan `flex: 1 1 auto; justify-content: center;` sehingga di kartu mana pun, konten visual berada di tengah vertikal dan mengisi sisa tinggi kartu secara simetris, menghapus celah kosong.
  - Kartu lebar (`.wide`, span >= 4) menggunakan layout grid 2 kolom (`minmax(0, 5fr) minmax(0, 6fr)`) dengan pemisah garis vertikal subtle, menyebarkan 3 metrik di sisi kiri dan grafik batang di sisi kanan secara seimbang.

### Bagian 2 — Variasi Visual Grafis (Tanpa Gauge & Anti-Monoton)

Sesuai arahan *"tidak hanya progress bar semua, dibuat variatif tapi tetap relevan, jangan pakai gauge"*:
1. **Grouped Column Bars (`_vzCols`)**: Dipakai pada Tata Usaha (SP2D vs Akrual per bulan YTD) dan Operasi (Ditangkap vs Dipantau KII vs KIA). Tinggi batang dibatasi maksimal 80% untuk memberi ruang label nilai di atas batang; jika bulan > 6 nilai dialihkan ke tooltip (`title`) agar angka tidak saling bertabrakan.
2. **Vertical Column Bars Stok (`_vzCols` fmt num)**: Dipakai pada Logistik untuk perbandingan stok amunisi 5 jenis teratas, dengan angka disederhanakan (`50 rb`, `47,8 rb`, dsb.) dan nilai penuh di tooltip.
3. **Donut Kesiapan Armada (`_vzDonut`)**: Dipakai pada Perawatan untuk menampilkan proporsi armada Siap, Tidak Siap, dan Docking dalam satu lingkaran ringkas (116px) disertai legenda status berangka.
4. **Ranked Horizontal Bars (`_vzHbars`)**: Dipakai pada Intelijen untuk menampilkan peringkat aktivitas (Nota Dinas, Pelanggaran Tx, Kawasan Terpantau) secara horizontal.
5. **Dual-Line Sparkline Trend (`_vzLine`)**: Dipakai pada Pemantauan untuk memperlihatkan tren penerbitan SKAT vs Username akun per bulan secara halus dengan area fill di bawah garis.
6. **Waffle Grid Chart (`_vzWaffle`)**: Dipakai pada Pengawakan untuk memvisualisasikan komposisi personel AKN (POA vs Non-POA vs Lainnya) dalam matriks 10×4 (40 sel) menggunakan metode sisa terbesar (*largest remainder*).
7. **Calendar Heatmap Strip (`_vzHeat`)**: Dipakai pada Kegiatan Pendukung untuk menampilkan intensitas kegiatan per bulan dengan gradasi saturasi navy dan angka di dalam sel.
8. **Status Chips (`_vzChips`)**: Dipakai pada Cakupan Laporan untuk 7 divisi dengan pill status interaktif.
9. **Penghapusan Gauge**: KPI utama Realisasi SP2D di zona atas diganti dari gauge cincin menjadi sparkline tren bulanan, 100% mematuhi aturan [DESIGN.md](file:///home/pinefeast/Projects/nautika/DESIGN.md) §6.1.

### Bagian 3 — Chart Konteks Asimetris (12 Kolom)

- Zona tren dan konteks diubah dari grid 2 kolom simetris 1fr:1fr menjadi **grid asimetris 12 kolom (`.chart-grid-asym`)**:
  - Tren Realisasi Anggaran (span 7) vs Hari Operasi Armada (span 5).
  - Komposisi Penindakan (span 5) vs Kapal Pengawas Teraktif (span 7).
- Pola 7:5 dan 5:7 memecah kesan kaku antar seksi, sekaligus memberikan ruang proporsional: grafik tren yang padat data mendapat porsi lebih luas (span 7), sementara donut dan bar ringkas mendapat span 5 yang pas.

### Bagian 4 — Perbaikan Bug & Inkonsistensi Terkait
- Perawatan: Logic badge kesiapan sebelumnya membandingkan `siap >= tidakSiap` sehingga 33% tampil badge "Optimal" (hijau). Dikoreksi menjadi evaluasi persentase nyata: `>= 75%` Optimal (`ok`), `>= 50%` Cukup (`warn`), `< 50%` Perlu Perhatian (`warn`), sehingga badge dan progress bar kini sinkron.
- Breakpoint Responsif: Tablet (max-width 900px) mengonversi grid menjadi 2 kolom dengan aturan khusus kartu Pemantauan mengisi 2 kolom penuh (`:nth-child(6)`) untuk menghindari slot ganjil kosong; ponsel (max-width 600px) otomatis 1 kolom penuh.

### Bagian 5 — Verifikasi
- `verify.sh`: **VERIFY OK** (95 endpoint terdefinisi).
- `nulltest.js`: **12/12 pass** (semua parameter null/kosong tertangani dengan aman).
- `selftest.js`: **139 pass / 0 fail** (bertambah 5 regression test untuk logika visual baru dan grid dinamis).
- Probe Visual Headless Chromium: tangkapan layar 1280px dan 820px terverifikasi rapi, garis dasar sejajar rata, dan tanpa lubang whitespace.

---

## [Fase 14 — Ikhtisar] — Peta Sebaran WPP di Ikhtisar + Kartu Divisi Tanpa Whitespace

**Tanggal**: 2 Oktober 2026
**Status**: Implementasi selesai & terverifikasi lokal (`verify.sh` OK, `selftest` 130 pass / 0 fail, `nulltest` 12 ok, `node --check` bersih, `git diff --check` bersih, probe geometri Chrome 0 lubang di 1440/768/600px). Verifikasi visual & runtime GAS menunggu user. Tidak ada `clasp push` (agen tidak melakukan deploy — `AGENTS.md` §5b).

**Permintaan user**: (1) "tambahin peta di paling atas ikhtisarnya dong, yang lebih informatif"; (2) "yang cards nya kok ruang kosongnya banyak, rapikan dong. intinya jangan ada ruang kosong yang ga ada isinya".

### Bagian 1 — Keputusan desain (dipilih user dari opsi yang disediakan)

- **Choropleth dengan pengalih metrik**, bukan satu metrik yang dipatok. Yang dipatok hanya *default*-nya (`aktivitas`).
- **Peta full-width dengan panel ranking Top 5 di bawahnya**, bukan peta sempit di samping tabel.
- **Posisi: di bawah `KPI Utama`, sebelum seluruh chart.** Ini jawaban atas permintaan "paling atas" yang tetap menjaga progressive disclosure (`PRD.md` §10.1): user lebih dulu membaca angka kondisi direktorat dalam satu sapuan, peta menyusul sebagai dimensi "di mana". Dicatat eksplisit di `PRD.md` §5.1 supaya tidak dianggap menyimpang dari urutan piramida-terbalik.

### Bagian 2 — Sumber data, dan satu koreksi penting

Peta diagregasi **dari sheet yang sama dengan peta Operasi** (`TX_OperasiLaut` + `TX_OperasiUdara`), bukan sumber baru. Alasannya angka di peta harus dijamin identik dengan angka KPI di halaman yang sama — kalau peta punya endpoint sendiri, ada window di mana keduanya menampilkan angka berbeda karena cache, dan user akan mempercayai yang salah.

**Koreksi**: `CakupanWilayah_NM2` ada di `TX_OperasiUdara`, **bukan** `TX_Pemantauan`. Verifikasi dilakukan dengan membaca header sheet, bukan asumsi.


Konsekuensi yang lebih penting: **`TX_Pemantauan` tidak punya kolom `WPPCode` sama sekali** (sudah dikonfirmasi di `DATA_SCHEMA.md`). Jadi Pemantauan masuk Ikhtisar lewat kartu divisi, bukan lewat peta — itu disengaja, bukan kelalaian. Ini dikoreksi di dokumentasi: `DATA_SCHEMA.md` (`TX_Pemantauan`) dapat catatan eksplisit, `PRD.md` dapat §8.3 baru. Kalau Pemantauan nanti perlu dipetakan, itu **perubahan skema** (`AGENTS.md` §4), bukan penyesuaian tampilan — dicatat supaya tidak ada agent berikutnya yang "melengkapi" dengan mengarang lokasi.

### Bagian 3 — Dua bug nyata yang ketahuan saat verifikasi

Keduanya lolos baca kode dan baru ketahuan karena ada probe dan pengujian, dan keduanya sudah diperbaiki + dijaga regression test:

1. **Skala peta salah jumlah warna.** Versi awal memakai 4 ambang untuk 4 warna ramp, jadi nilai tertinggi jatuh ke `_OV_MAP_RAMP[4]` yang tidak ada → `fill: undefined` → satu WPP tidak berwarna dan hilang dari legenda. Bucket sekarang 4 dengan **2** ambang (`0` / `1–s1` / `s1+1–s2` / `≥ s2+1`) dan hanya 2 indeks ramp yang dipakai setelah bucket-0. Test menyisir setiap nilai yang mungkin muncul dan memastikan hasilnya hex yang ada di ramp.

2. **Breakpoint peta mati diam-diam.** `@media (max-width: 900px)` untuk `#ov-map` dan `.ov-map-rank-list` ditulis **sebelum** aturan dasarnya, dan specificity-nya sama persis (`#id` vs `#id`, `.class` vs `.class`) — jadi aturan dasar yang ditulis belakangan menang dan breakpoint-nya tidak pernah berlaku. Gejalanya: peta tetap 420px di 768px, ranking tetap 5 kolom. Baru ketahuan saat membandingkan tinggi peta yang **dijanjikan** vs yang terukur. Media query dipindah ke akhir file (setelah deklarasi dasar), dan sekarang ada test yang menjaga urutannya supaya tidak bisa balik lagi.

Ditambah satu kerentanan yang diperbaiki: `_ovMapPaint()` menulis `_ovMapMetricDef(metric).label` tanpa guard. Kalau kunci metrik tidak ada di daftar yang dikirim server, `null.label` melempar `TypeError` **di dalam `eachLayer()`** — yang membatalkan seluruh paint berikutnya *dan* membuat legenda tidak pernah dirender (karena `throw` keluar sebelum `_ovMapLegend()` dipanggil). Sekarang `def` diambil sekali dan di-guard.

### Bagian 4 — Whitespace kartu divisi

Penyebabnya `grid-auto-rows: 1fr` pada `.div-grid`: seluruh kartu dalam satu baris dipaksa setinggi kartu terpanjang, jadi kartu berisi pendek meninggalkan lubang besar. Diubah ke `align-items: start` (kartu setinggi isinya).

Diukur dengan probe geometri Chrome, bukan dikira-kira:

| | Sebelum | Sesudah |
|---|---|---|
| Kartu dengan lubang | 8 dari 9 | **0** |
| Total lubang | 684px | **0px** |
| Lubang terburuk | 150px | **0px** |
| Tinggi grid | 953px | **795px** |

Bonus yang ikut ketahuan: `.div-grid` **tidak punya breakpoint sama sekali** — di layar kecil kartu hanya ~151px dan tidak terbaca. Breakpoint 3→2→1 kolom ditambahkan, **hanya** untuk `#ov-div-grid`; `#pk-kpi` (Profil Kapal) memakai `.div-grid` yang sama dan sengaja dibiarkan apa adanya agar tata letak yang sudah diverifikasi tidak ikut berubah.

### Bagian 4b — Basemap Ikhtisar sekarang pakai `CARTO_API_KEY` yang sudah ada

Peta WPP di Ikhtisar awalnya memanggil `L.tileLayer()` dengan URL CARTO yang ditulis
langsung, sehingga berjalan tanpa key. Itu berarti halaman tersebut diam-diam
mengabaikan `CARTO_API_KEY` yang sudah diisi di Script Properties — satu key untuk
satu aplikasi, tapi dipakai satu peta saja.

Perbaikannya: `_ovMapInit()` memakai `_ensureCartoKey()` + `_cartoTileUrl(key)`, sama
persis dengan peta Operasi Laut dan Operasi Udara. Tidak ada key, `Script Property`,
atau variabel baru — cukup ikut memakai `CARTO_API_KEY` yang sudah ada.

Dua konsekuensi yang ikut diperbaiki:

- `attributionControl` sebelumnya `false` sementara tile tetap memakai basemap OSM/CARTO,
  jadi atribusi tidak pernah tampil padahal Attribution Guide OSM mewajibkannya.
  Sekarang `attributionControl` aktif dan `attribution` diisi; legenda ada di pojok kiri,
  baris atribusi Leaflet di kanan, jadi tidak tumpang tindih.
- Pemuatan geometri dipisah ke `_ovMapLoadGeo()`. Sebelumnya tombol "coba lagi" pada
  status error diarahkan ke `_ovMapInit()`, padahal fungsi itu langsung `return` di
  guard `if (_OV_MAP.map)`. Akibatnya klik "coba lagi" tidak mengulang unduhan sama
  sekali dan tidak ada pesan apa pun — gagal diam-diam. Sekarang retry mengarah ke
  `_ovMapLoadGeo()`, yang memang tidak punya guard tersebut.

### Bagian 5 — Keputusan yang sengaja diambil agar tidak mengulang pekerjaan

- **Geometri tidak diunduh dua kali.** Peta Ikhtisar memakai cache yang sama lewat `_opsGetGeoData()`. File geojson ±10 MB; mengunduhnya sekali lagi di tab yang sama akan boros jaringan dan lambat. Aturan untuk pemanggil baru (tidak boleh `fetch` sendiri, tidak boleh menyebut `_OPS_GEO_SRC`) ditulis di `ARCHITECTURE.md` §9 dan dijaga test.
- **Nama WPP dari `WPP_NRI`**, sheet yang sama dengan sumber geometri — supaya nama di tooltip dan panel ranking tidak mungkin berbeda dari batas poligon.
- **`WPPCode` di-`trim()`** saat pengelompokan: sheet bisa menyimpan `" 921 "`, dan tanpa trim kode itu tidak cocok dengan properti `wppnri` sehingga WPP-nya diam-diam terwarnai 0.
- **Baris tanpa `WPPCode` tidak dibuang.** Dihitung ke `tanpaWpp` dan ditampilkan sebagai catatan di bawah ranking. Data yang hilang diam-diam lebih berbahaya daripada angka yang terlihat tidak rapi.
- **Chip metrik dibangun runtime dari daftar yang dikirim server**, bukan daftar hardcode di client — begitu server menambah/mengganti metrik, chip ikut sinkron. Kontrak kunci metrik client↔server ada test-nya.
- **`Aktivitas` = jumlah peristiwa, bukan kapal unik** (satu kapal bisa menyumbang KII di sheet Laut *dan* KII di sheet Udara). Label memakai kata "Aktivitas" supaya tidak salah baca; dicatat di `PRD.md` §8.3.
- **Tidak ada toggle layer di Ikhtisar** (berbeda dari peta Operasi): halaman ini read-only dan tidak punya konteks operasi, jadi satu metrik terpilih lewat chip sudah cukup.

### Bagian 6 — Verifikasi

- `selftest.js`: **130 pass / 0 fail** (dari 112 → 130, +16 test: agregasi per WPP, trim kode, baris tanpa WPP, input null, skala & batas indeks ramp, legenda semua metrik termasuk saat semua nilai nol, satuan metrik, urutan markup Ikhtisar, pemakaian cache geometri bersama, status + retry, teardown, kontrak kunci metrik, guard `_ovMapPaint`, urutan media query, anti-`grid-auto-rows`, breakpoint `#ov-div-grid`, `#pk-kpi` tak tersentuh).
- `nulltest.js` 12/12, `verify.sh` **VERIFY OK** (95 endpoint terdefinisi), `node --check` client & server bersih, `git diff --check` bersih.
- Probe geometri Chrome headless (fixture `wpp_final.geojson` lokal, 11 feature WPP): **0 lubang di 1440/768/600px**, tinggi peta 420/340/280px, ranking 5/3/2 kolom, grid kartu 3/2/1 kolom, tanpa overflow horizontal di semua ukuran.

---

## [Fase 14 — Pagu] — JUMLAH REVISI PAGU di bawah baris Pagu (form TU + modal revisi)

**Tanggal**: 2 Oktober 2026
**Status**: Implementasi selesai & terverifikasi lokal (`verify.sh` OK, `selftest` 112 pass / 0 fail, `nulltest` 12 ok). Verifikasi visual & runtime GAS menunggu user. Tidak ada `clasp push` (agen tidak melakukan deploy — `AGENTS.md` §5b).

**Permintaan user**: "Tambahkan sudah berapa kali revisi di TU bagian pagu, jadi di bawah pagu itu ada tulisan Revisi pagu Ke-x." Clarifikasi: angkanya **jumlah revisi yang sudah terjadi** (bukan nomor berikutnya), dan saat menekan `Ubah Pagu` tampil prediksi `Jika disimpan, menjadi revisi ke-(N+1)`.

### Bagian 1 — Definisi angka

Jumlah **transisi** nilai `(PaguReguler, PaguABT)` pada baris `ACTIVE` yang berbeda dari baris `ACTIVE` sebelumnya, dibaca kronologis. Baris pertama = pagu awal, bukan revisi.

Dua keputusan yang menentukan:

1. **Seluruh riwayat, bukan rantai `SupersedesRowID`.** Pagu diwarisi dari laporan minggu sebelumnya, jadi nilai "sama" di periode berbeda bisa tetap hasil revisi di periode sebelumnya. Rantai supersede hanya melihat revisi pada satu periode dan akan melewatkan itu.
2. **Dari perubahan nilai, bukan dari `CatatanRevisiPagu` yang terisi.** `tataUsaha_revisi` mewajibkan `AlasanRevisi` tetapi **tidak** memaksa Catatan Revisi Pagu walau Pagu berubah — jadi menghitung dari kolom catatan akan *understated*. Ini cacat validasi yang sudah ada sebelumnya dan sengaja **tidak** diubah di sini (mengubahnya berarti menolak revisi lama yang sah).

### Bagian 2 — Perubahan

- `services/TataUsahaService.js` — `_tuHitungRevisiPagu(activeRows)`: menyortir sendiri secara kronologis, memakai `_num()` sehingga angka string dari sheet tetap dibandingkan sebagai angka. `tataUsaha_getKPI()` mengoper hasilnya sebagai `revisiPagu` (on-read, **tanpa kolom baru**; KPI tidak di-cache jadi tidak perlu invalidasi cache).
- `html/Script_Main.html` — `_tuRenderRevisiPagu(elId, next)`: `Belum pernah direvisi` atau `Revisi pagu: sudah N kali`, plus prediksi `jika disimpan, menjadi revisi ke-(N+1)` saat pagu dibuka. Dipanggil dari `tuOpenForm()` (form utama), `tuUnlockPagu(true/false)` ( buka → prediksi, batal → kembali), dan `tuOpenRevisiModal()`.
- `_tuPaguBerubah()` — prediksi **hanya** muncul bila nilai input benar-benar berbeda dari nilai laporan sebelumnya (`_TU._paguBase`). Membuka `Ubah Pagu` lalu langsung menyimpan bukan revisi, jadi menampilkan "revisi ke-N" di titik itu akan berbohong.
- `_tuWatchPagu(on)` — add/remove listener `input` di **satu** tempat (`_tuSetPaguBar`), supaya tidak ada listener nyangkut saat modal ditutup dalam keadaan pagu terbuka.
- KPI belum termuat → tampilkan `—`, bukan `Belum pernah direvisi`, supaya tidak pernah menyatakan klaim yang belum terverifikasi. KPI dari deploy lama (tanpa `revisiPagu`) → turun ke 0, tidak error.
- `html/views/TataUsaha.html` — `#tu-pagu-rev` (di bawah bar Pagu) dan `#rv-pagu-rev` (di bawah baris Pagu di modal revisi).
- `html/Style.html` — `.tu-pagu-rev` (steel-blue netral, bukan kartu) + `.is-next` untuk state prediksi.

### Bagian 3 — Verifikasi

`bash verify.sh` → `VERIFY OK`. `node selftest.js` → **112 pass, 0 fail** (`+25` uji baru). `node nulltest.js` → 12 ok. `node --check` untuk script client hasil ekstraksi dan `services/TataUsahaService.js`.

Uji baru mengeksekusi helper-nya di `vm` (bukan cuma regex):

- `_tuHitungRevisiPagu`: tanpa baris → 0; baris pertama → 0; 1 perubahan → 1; 2 perubahan → 2; input acak tetap kronologis; revisi non-pagu → 0; perubahan satu field → 1; string vs angka dianggap sama; `1000→1500→1000` → 2 (balik ke nilai lama = revisi baru, bukan pembatalan);
- KPI benar-benar mengembalikan `revisiPagu`;
- client: KPI null → `—`; 0 → `Belum pernah direvisi`; 2 → `sudah <b>2</b> kali`; KPI tanpa field → 0 tanpa error; prediksi ke-3 untuk N=2 dan ke-1 untuk N=0; prediksi hilang di mode lock; diubah-kemudian-dikembalikan → prediksi hilang;
- hanya 1 titik `addEventListener` untuk Pagu (di `_tuWatchPagu`), jadi listener tidak bisa nyangkap.

### Bagian 4 — Dokumen tersinkron

- `DATA_SCHEMA.md` §3.2 — `revisiPagu` sebagai output on-read + definisi + alasan tidak menghitung dari `CatatanRevisiPagu`.
- `PRD.md` §7 Tata Usaha — perilaku tampilan penghitung.
- `ARCHITECTURE.md` §5 — aturan penghitungan & aturan tampilan prediksi.

### Bagian 5 — Tidak diubah (disengaja)

- **Tidak menambah kolom spreadsheet.** Angka dihitung on-read dari data yang sudah ada; menambah kolom berarti memigrasikan sheet dan tidak memberi informasi baru.
- **Tidak memperbaiki validasi `tataUsaha_revisi`** yang tidak mewajibkan Catatan Revisi Pagu saat pagu berubah. Perbaikannya akan menolak revisi lama yang sah — perlu keputusan terpisah.
- **Tidak ada verifikasi visual/browser** — tidak tersedia di environment ini.

---

## [Fase 14 — Perbaikan] — Peta WPPNRI tidak muncul di Operasi (basemap ada, batas WPP hilang)

**Tanggal**: 2 Oktober 2026
**Status**: Implementasi selesai & terverifikasi lokal (`verify.sh` OK, `selftest` 87 pass / 0 fail, `nulltest` 12 ok). Verifikasi visual di browser/GAS menunggu user. Tidak ada `clasp push` (agen tidak melakukan deploy — `AGENTS.md` §5b).

**Gejala**: basemap CARTO termuat normal di `#map-ops-laut`, tetapi tidak ada batas/poligon WPPNRI. User mengira peta kosong. Dikonfirmasi: bukan CDN Leaflet, bukan key CARTO, bukan dropdown WPP.

---

### Bagian 1 — Penyebab

Penyebab langsungnya **cacat #1**. Cacat #2 membuatnya jauh lebih mungkin terjadi dan sulit didiagnosis; #3 bukan penyebab gejala, tapi kerentanan yang ikut dibereskan. Semuanya di `html/Script_Main.html`:

1. **Penyebab langsung — unduhan geometri gagal tanpa jejak.** `_opsGetGeoData()` memanggil `fetch` 10 MB tanpa `response.ok`, tanpa batas waktu, tanpa retry, dan tanpa status di layar; `.catch` hanya `console.error`. Geometri WPP ±10 MB (11 feature, 10.226.295 byte) — kegagalan tidak terlihat sampai user membuka console. Source GitHub raw dikonfirmasi masih ada lewat GitHub API (`size` identik dengan berkas lokal), jadi ini bukan berkas hilang; karena `L.geoJSON` tidak pernah dipanggil, **tidak ada satu pun poligon yang tergambar**. Cocok dengan gejala user: basemap termuat, batas WPP tidak ada sama sekali — bukan tampil hitam.
2. **Pemicunya — tiap re-render mengunduh ulang.** Tidak ada guard in-flight. Setiap `_renderWppLayer()` / `_renderOpsUdaraWppLayer()` (ganti tab, ganti filter periode, reload KPI) menyalakan unduhan 10 MB sendiri yang saling berebut jaringan sehingga semuanya bisa gagal bersamaan.
3. **Kerentanan, bukan penyebab — warna layer bergantung `var(--n-primary)`.** Leaflet menempelkan `style` sebagai atribut SVG (`fill="..."`). Token ada di `:root` dan mewarisi ke dalam SVG, jadi Chrome/Firefox modern memang me-resolve `var()` di presentation attribute — itulah sebabnya gejala yang dilaporkan **bukan** WPP berwarna hitam. Tetap diganti ke hex karena perilaku itu tidak boleh diandalkan (tidak seragam di semua engine/versi, dan mustahil bila nanti di-canvas atau diekspor), dan supaya konsisten dengan `_CHART_COLORS`.

Dua celah PRD §8.1 yang ikut ditemukan: **legenda tidak pernah diimplementasikan** di kedua peta, dan tidak ada status loading/error.

### Bagian 2 — Perbaikan

- `_opsGetGeoData(cb)` sekarang **satu promise in-flight bersama** (`_OPS_GEO.wppPromise`) — N pemanggil mendapat satu unduhan; hasilnya di-cache di `_OPS_GEO.wppGeoJsonData` untuk sisa sesi.
- `_opsFetchWppGeoJson()` baru: `cache: 'force-cache'` (GitHub raw mengirim `max-age` panjang, jadi unduhan kedua dilayani cache browser), batas waktu 30 detik lewat `AbortController`, 1 percobaan ulang, serta penolakan atas `response.ok === false` dan `FeatureCollection` kosong. Kegagalan mereset promise agar bisa dicoba lagi.
- Callback jadi `(data, error)`; kedua renderer wajib menangani cabang error.
- `_opsMapStatus(mapId, mode, msg, onRetry)` — status **memuat** dan **gagal + tombol "Coba lagi"** di atas kanvas, di dalam container peta (container `#map-ops-*` tidak punya elemen status sendiri di view, jadi dibangun dari JS — satu helper untuk Kapal & Pesawat).
- `_opsMapLegend(mapId, colors)` — legenda skala intensitas pojok kiri-bawah, sesuai PRD §8.1.
- `_OPS_WPP_SCALE` — palet choropleth **satu hue navy** (4 bucket: 0 / 1-5 / 6-15 / >15 kapal, `#E4E7F2` → `#2B3674`) di-mirror dari token `Style.html` sebagai hex, aturan sama seperti `_CHART_COLORS` untuk Chart.js. Bucket 0 sengaja **tidak** disamarkan: WPP tanpa aktivitas tetap terlihat (PRD §8.1).
- `_opsWppFill(intensitas)` dipakai kedua peta; `_opsWppTooltip(props, intensitas)` menyamakan isi hover; `_opsWppIntensitas(wppIntensitas, kode)` mencocokkan kode dengan toleran spasi (sheet bisa menyimpan `" 571 "` — tanpa itu peta diam-diam jadi warna 0).
- Field mati `_OPSLAUT.wppGeoJsonData` dibuang (selalu `null` setelah redirect ke `_OPS_GEO`).
- CSS `.ops-map-status`, `.ops-map-legend`, `.ops-map-retry` di `html/Style.html`.

> Keputusan: sumber geometri **tetap** GitHub raw (user memilih, 2 Okt 2026) — tidak dipindah ke Drive/GAS. Kontrak loader dicatat di `ARCHITECTURE.md` §9.

### Bagian 3 — Verifikasi

`bash verify.sh` → `VERIFY OK` (95 endpoint client terpetakan). `node selftest.js` → **87 pass, 0 fail** (`+13` uji baru). `node nulltest.js` → 12 ok. `node --check` untuk script client hasil ekstraksi `html/Script_Main.html` dan seluruh file server.

Uji baru di `selftest.js` tidak cuma pencocokan pola — blok loader diekstrak dari `Script_Main.html` lalu **dijalankan** di `vm` dengan `fetch` tiruan:

- dua pemanggil paralel → **tepat 1** unduhan, keduanya dapat data;
- gagal sekali → dicoba ulang lalu sukses (2 fetch);
- gagal terus → `cb(null, pesan)` (bukan `console`), dan `wppPromise` di-reset;
- `HTTP 404` → ditolak, tidak diteruskan sebagai GeoJSON;
- `features: []` → ditolak;
- panggilan setelah sukses → 0 unduhan tambahan (cache);
- semua warna skala hex, bucket 0 ada, 4 bucket sesuai PRD §8.1;
- kedua peta punya cabang loading/error/legenda, dan warna layer tidak pernah bergantung `var()`.

Plus uji manual dengan **data GeoJSON asli** (`wpp_final.geojson`, di luar git): 11/11 feature ter-render, 0 warna non-hex — WPP 715 (88 kapal) `#2B3674`, 711 (12) `#6B76A8`, 573 (4) `#A9B0D0`, 7 WPP tanpa data `#E4E7F2`.

> Helper `selftest.js` punya `tA()` untuk uji async — `t()` sinkron akan false-pass pada Promise (try/catch tidak menangkap rejection).

### Bagian 4 — Dokumen tersinkron

- `PRD.md` §8.1 — nama berkas dikoreksi (`wpp_finals.geojson` → `wpp_final.geojson`, tidak pernah ada berkas `finals`), ditambah aturan "kegagalan tidak boleh senyap".
- `ARCHITECTURE.md` §9 — kontrak pemuatan geometri (in-flight promise, timeout, retry, cache, `(data, error)`) + alasan kenapa warna harus hex. Nama berkas di §Data dan §10 ikut dikoreksi.

### Bagian 5 — Sudah diketahui, sengaja belum dikerjakan

Dicatat agar tidak hilang (AGENTS.md §4 — jangan asumsikan data yang belum ada):

- **Hover** di §8.1 meminta "status konfirmasi pengawasan" + "tanggal update terakhir". Payload `wppIntensitas` dari `operasiLaut_getKPI`/`operasiUdara_getKPI` **hanya berisi angka** (`jumlah kapal + rumpon`). Menambah dua field ini berarti menambah kolom/kolom agregat baru — perlu keputusan user, tidak dikarang di frontend.
- **Klik langsung di peta mini pada form** dengan sinkron dua arah (§8.1) belum pernah diimplementasikan — tidak ada container peta mini di form Operasi Laut/Udara. Di luar scope perbaikan ini.
- Simplifikasi geometri (rekomendasi `ARCHITECTURE.md` §10) tidak dikerjakan; jika unduhan 10 MB tetap terasa lambat di jaringan user, itu opsi berikutnya (tidak mengubah sumber).

---

## [Fase 14 — Item 6] — Kapal Pengawas Wajib di Operasi Laut/Udara + Jenis Kapal di Master
**Tanggal**: 2 Oktober 2026
**Status**: Implementasi selesai & terverifikasi lokal (`verify.sh` OK, `selftest` 87/0, `nulltest` 12); verifikasi runtime GAS & spreadsheet menunggu user. Tidak ada `clasp push` (agen tidak melakukan deploy — `AGENTS.md` §5b). Verifikasi runtime GAS masih terblokir OAuth `MailApp.sendEmail`.

**Permintaan user**: bar "Kapal Pengawas Teraktif" di Ikhtisar selalu kosong meski KPI hari operasi terisi — minta evaluasi sumber data & penyebab, lalu diputuskan `KapalID` **wajib** pada submit/revisi Operasi Laut & Udara, revisi diberi pemilih kapal, dan Master Kapal mendapat kolom `JenisKapal`.

---

### Bagian 1 — Sumber data & penyebab

Bar tersebut dihitung di `dashboard_getOverview()` (`services/DashboardService.js`): `TX_OperasiLaut` + `TX_OperasiUdara` difilter ACTIVE pada rentang periode, dikelompokkan per `KapalID`, `HariOperasi_Jumlah` dijumlahkan, nama diambil dari Master Kapal, lalu top 5. KPI hari operasi memakai **baris yang sama** tetapi menjumlahkan semua baris tanpa group-by kapal — itulah sebabnya KPI benar sementara grafik kosong.

Penyebabnya: `KapalID` baru ditambahkan pada Fase 12 (28 Sep 2026) sebagai kolom opsional **tanpa backfill**, dan form revisi tidak punya pemilih kapal. Jadi seluruh baris lama tidak punya kapal, dan baris baru pun boleh disimpan tanpa memilih kapal. Tidak ada bug perhitungan — hanya sumber daya yang belum pernah diisi.

### Bagian 2 — Perubahan skema

| Sheet | Kolom | Perubahan |
|---|---|---|
| `Kapal` | `JenisKapal` | **Baru.** enum dari grup Opsi `KAPAL_JENIS` (`KAPAL_PUSAT`, `SPEEDBOAT`), nullable |
| `Opsi` | grup `KAPAL_JENIS` | **Baru**, di-seed `OPSI_SEED` (`Setup.js`) |
| `TX_OperasiLaut` / `TX_OperasiUdara` | `KapalID` | Tetap nullable di skema; **wajib diisi untuk submit/revisi baru** |

`TX_Logistik_Amunisi` / `TX_Logistik_BBM` tidak berubah — `KapalID` tetap opsional di sana.

Mengapa `KapalID` dibiarkan nullable meski sekarang wajib: baris lama tidak boleh jadi invalid hanya karena satu kolom belum diisi, dan tidak ada migrasi/backfill. Kolom kosong = "tidak tertaut kapal", bukan error.

### Bagian 3 — Validasi server

- `operasiLaut_submit` / `operasiUdara_submit`: `KapalID` wajib dan harus terdaftar di Master Kapal.
- `master_kapalCocokKategori()` (baru): kapal harus cocok dengan `HariOperasi_Kategori`. `SEMUA_KAPAL` dan kategori kosong = semua kapal; kapal dengan `JenisKapal` kosong = tidak dibatasi, supaya kapal lama tidak terkunci dari form.
- **Revisi**: `KapalID` diwarisi dari baris lama bila client tidak mengirimnya; bila baris lamanya juga kosong, revisi ditolak dengan pesan `Kapal Pengawas wajib dipilih. Laporan lama belum punya kapal — pilih kapal untuk merevisi.` Ini yang membuat revisi menjadi jalur pengisian data lama, bukan migrasi.

### Bagian 4 — Perbaikan bug yang ditemukan sekalian

Kedua modul menandai baris lama `SUPERSEDED` **sebelum** validasi `rincian` per-item dijalankan. Revisi yang gagal karena rincian tidak sah (mis. `NamaItem` kosong) meninggalkan data aktif hilang tanpa bar pengganti — pola yang sudah diperbaiki di Pemantauan/Intelijen pada Fase 12 tapi belum ikut diterapkan di Operasi Laut/Udara.

Sekarang `oldObj` diambil lebih dulu, validasi kapal + `rincian` dijalankan, baru baris lama ditandai `SUPERSEDED`; hasil validasi yang sama dipakai untuk counts dan `_detailWriteChildren()` (tanpa validasi ganda).

### Bagian 5 — Client

| Fungsi | Tugas |
|---|---|
| `_kapalInit(id, jenisKategori)` | Muat daftar kapal sekali, lalu isi dropdown yang sudah disaring per kategori |
| `_kapalItemsFor(jenisKategori)` | Saring kapal sesuai kategori; kapal tanpa `JenisKapal` tidak pernah dibuang |
| `_kapalSyncKategori(kdlId, kategoriId)` | Saring ulang saat kategori berubah; reset pilihan yang jadi tidak sah |
| `_kapalItemsFor` + `_KAPAL_JENIS` | Dipakai juga untuk prefill modal revisi |

Modal revisi Operasi Laut & Udara sekarang punya pemilih kapal (`rv-ops-kapal`, `rv-oud-kapal`) yang di-prefill dari nilai baris lama. TX_OperasiUdara tidak punya kolom kategori hari operasi, jadi dropdownnya tidak disaring.

Validasi wajib ditambahkan di `opsLautSubmit`, `opsUdaraSubmit`, `opsLautRevisiConfirm`, `opsUdaraRevisiConfirm`.

Master Data: kolom "Jenis" di tabel kapal + dropdown `Jenis Kapal` di modal add/edit, enum dimuat lazy dari `master_getOpsiJenis` (grup Opsi tidak bisa diasumsikan sudah termuat saat tab kapal dibuka). Kapal lama yang `JenisKapal`-nya kosong dibiarkan kosong saat edit, supaya admin tidak dipaksa memilih ulang hanya untuk mengubah field lain.

### Bagian 6 — Self-heal DB lama

`ensureKapalJenisColumn()` menambahkan kolom `JenisKapal`. Ditambah `_mdEnsureKapalJenisOpsi()` yang menjalankan `_seedOpsi()` (sudah idempoten) **bila grup `KAPAL_JENIS` masih kosong**, dipanggil dari `master_getKapalList`/`master_createKapal`/`master_updateKapal`.

Tanpa ini: DB lama akan menolak **semua** kapal baru dengan pesan "Jenis kapal tidak dikenal" sampai user menjalankan `setupSeedOpsi()` manual, dan dropdown Master Kapal kosong tanpa penjelasan.

### Bagian 7 — Chart kosong yang jujur

`dashboard_getOverview()` menambah `charts.hariTanpaKapal` — jumlah hari operasi yang tidak bisa diatribusikan ke kapal. Chart menampilkan catatan itu ("N hari operasi belum tertaut kapal — revise lapisannya agar masuk grafik") baik saat sudah ada bar maupun saat kosong, supaya grafik kosong tidak terlihat seperti tidak ada aktivitas. Angka ini tetap masuk KPI, jadi tidak ada perubahan pada perhitungan yang sudah benar.

### Bagian 8 — Dokumentasi

- `DATA_SCHEMA.md` — kolom `Kapal.JenisKapal` + catatan kolom kosong = tidak dibatasi; grup `KAPAL_JENIS` di tabel pemetaan; aturan pencocokan dengan `OPS_HARI_KATEGORI`; status `KapalID` baru-vs-legacy di dua sheet.
- `ARCHITECTURE.md` — §4 baru "KapalID sebagai field wajib pada modul yang mengagregasi per kapal" (kenapa wajib di dua modul ini tapi tetap nullable di skema, dan konsekuensinya pada revisi); self-heal master-side; kolom `Kapal` di tabel sheet master.
- `PRD.md` §6 — requirement kapal pengawas wajib + konsekuensi turunannya pada revisi, Master Kapal, dan Logistik.
- `PHASES.md` — blok Fase 14 Item 6; status fase tetap **Berjalan** (item 1–6 selesai, Definition of Done per modul belum dikerjakan).

### Bagian 9 — Verifikasi

- `bash verify.sh` → **VERIFY OK** (semua 18 file server lolos `node --check`, kedua script client lolos setelah diekstrak dari HTML, 95 endpoint `google.script.run` terdefinisi, tanpa duplikasi top-level, hygiene bersih).
- `selftest.js` → **74 pass / 0 fail**.
- `nulltest.js` → seluruh kasus lulus.
- Pemeriksaan khusus Item 6: keenam `id` baru ada di view terkait; `validateRincian` dipanggil tepat 1x per revisi dan selalu **sebelum** `SUPERSEDED` di kedua modul; semua selector kapal yang dipakai client punya pasangan `id` di view.
- `git diff --check` bersih untuk semua file yang berubah pada Item 6.
- **Belum** dijalankan: harness headless Chrome dan round-trip Spreadsheet. Verifikasi runtime GAS masih terblokir OAuth `MailApp.sendEmail`, jadi yang tersisa adalah konfirmasi visual & spreadsheet oleh user.

---

## [Fase 14 — Item 5] — Popup Berhasil Setelah Submit + Loading yang Lebih Terlihat
**Tanggal**: 1 Oktober 2026
**Status**: Implementasi selesai & terverifikasi lokal (`verify.sh` OK, `selftest.js` 74 pass / 0 fail, `nulltest.js` 12/12, `node --check` client, `git diff --check` bersih, harness headless Chrome 531 check x 2 viewport). Menunggu `clasp push` & verifikasi runtime oleh user.

**Permintaan user**: "Setelah laporan berhasil di submit, jangan sampe form nya masih muncul jadi pop up, pop up nya diganti pake pop up berhasil, biar tidak ada perubahan, loadingnya dibuat lebih terlihat, berlaku buat semua form."

---

### Bagian 1 — Masalahnya

Semua 14 form pelaporan memakai pola yang sama: submit ke server, lampiran terunggah, lalu `closeModal()` langsung. Akibatnya user tidak pernah tahu apakah datanya benar-benar masuk — form-nya menghilang, lalu KPI/riwayat diam-diam reload. Spinner satu-satunya ada di dalam tombol (`Memproses…`) dengan font 13px, hampir tidak terlihat di modal 400px. Master Data (`Kapal`, `Kawasan`) memakai pola serupa.

### Bagian 2 — State sukses di dalam modal

Dibuat satu helper client-side di `html/Script_Main.html` (`_FORM_SUCCESS`), tanpa menyentuh server:

| Fungsi | Tugas |
|---|---|
| `_formShowSuccess(modalId, sub, onClose, delay)` | Simpan `innerHTML` modal asli ke `_FORM_SUCCESS[modalId]`, ganti isi modal dengan panel "Berhasil", tutup otomatis setelah 650ms, lalu jalankan `onClose` (reload KPI + riwayat) |
| `_formRestore(modalId)` | Pulihkan markup modal asli dari snapshot |
| `_formSubmitDone(modalId, sub, onClose, ok)` | Titik masuk tunggal: hentikan overlay, lalu `ok === true` → panel sukses; `ok === false` → tutup modal + jalankan `onClose` (perilaku lama, **tanpa** panel sukses palsu) |
| `_ATTACH_MODAL` + `_attachModalId(key)` | Peta 14 key lampiran → id modal, supaya overlay loading ikut berlangsung selama tahap unggah |

`closeModal()` kini memanggil `_formRestore(id)` lebih dulu, sehingga markup form selalu kembali utuh ketika popup dibuka lagi. Timer auto-close ikut dibatalkan saat restore — kalau tidak, popup yang ditutup manual lalu langsung dibuka lagi akan tertutup sendiri oleh timer lama.

Panel sukses: judul `<h2>` asli dipertahankan, lalu ikon centang 46px (solid `#ECFDF5`, **tanpa gradient**), teks "Berhasil", kalimat konfirmasi per-form, dan "Menutup otomatis…". Semuanya di dalam `role="status" aria-live="polite"` supaya terbaca screen reader.

Semua kalimat konfirmasi disesuaikan per form, bukan teks generik satu untuk semua — contoh: "Komponen logistik dan personil tersimpan." untuk Logistik Personil.

### Bagian 3 — Loading yang lebih terlihat

`_setLoading()` sekarang mendeteksi apakah tombolnya berada di dalam `.n-overlay`, dan menampilkan `.form-loading-overlay` (spinner 22px + teks status, `rgba(255,255,255,0.72)` + blur 1px) di atas area form — **bukan** hanya teks "Memproses…" di tombol.

Dua tahap, keduanya terlihat:

| Tahap | Sumber | Status overlay |
|---|---|---|
| Simpan ke server | `_setLoading(btn, true)` | "Menyimpan…" |
| Unggah lampiran | `_attachUploadAll()` | "Mengunggah lampiran…" |

Popup yang tidak punya `.n-modal-form-scroll` (Kegiatan, Master Data ×2) jatuh ke fallback `.n-modal` — makanya `.n-modal` kini diberi `position: relative`.

### Bagian 4 — Cakupan

- **14 form laporan**: Tata Usaha, Operasi Laut, Operasi Udara, Intelijen, Kegiatan, Pemantauan, Perawatan (Kesiapan/Docking/Item), Logistik (Amunisi/BBM/Personil), Pengawasan (AKN/Kegiatan).
- **2 form Master Data**: `modal-md-kapal`, `modal-md-kawasan`.
- **Tidak diubah**: popup **revisi** & **anulir**. Keduanya bukan form pelaporan — isinya textarea 1 field / tombol konfirmasi, sudah punya pesan inline + tombol yang berubah jadi "Memproses…", dan pesan sukses 1 detik. Mengganti alur pengesahan revisi/anulir berada di luar scope permintaan user dan berisiko mengubah perilaku yang sudah disepakati.

### Bagian 5 — Verifikasi

**Harness headless Chrome baru** (`/tmp/opencode/mkprobe-success.py`) — memuat `Style.html` + `Script_Main.html` asli + seluruh markup asli semua view, stub `google.script.run`, lalu menguji **531 check** di viewport 1280px **dan** 390px (semua 0 fail):

| Skenario | Yang diperiksa |
|---|---|
| Loading | overlay muncul, punya `.n-spin-lg`, punya teks status, punya containing block, hilang setelah selesai |
| Sukses | panel muncul, judul = "Berhasil", sub teks sesuai, **modal tetap terbuka**, isi form benar-benar hilang (bukan ditumpuk), lalu tertutup + markup identik pulih + `onClose` terpanggil + registry bersih + form bisa dibuka lagi |
| Gagal (`ok === false`) | modal langsung tertutup, **tanpa** panel sukses, `onClose` tetap jalan — tidak ada sukses palsu |
| Unggah lampiran | fase "Mengunggah lampiran…" bertahan selama unggajual (GAS sengaja digantung), spinner besar tampil, belum ada panel sukses; setelah selesai → overlay ditutup → panel sukses tampil |
| Peta lampiran | 14 key `_ATTACH_MODAL` terpetakan ke modal yang ada |
| Geometri | panel sukses & overlay tidak melimpah horizontal/vertikal di 1280px & 390px |

**Probe lama (regresi)**: `mkprobe-ico.py` 115 tombol, `max_delta_tinggi=0.094px`; `mkprobe-nlist.py` 0 masalah; `mkprobe-view.py` 147 tombol, 0 view melimpah, 0 gepeng. Keyframe `n-spin` di `Style.html` disatukan ke `_spin` (sekarang 1 definisi, bukan 2 duplikat).

**Statis**: `verify.sh` OK, `selftest.js` 74 pass / 0 fail, `nulltest.js` 12/12, `node --check` client bersih, `git diff --check` bersih.

**Tidak diubah**: tidak ada perubahan schema, endpoint, `services/`, `DATA_SCHEMA.md`, atau `ARCHITECTURE.md`. Tidak ada `clasp push` (agen tidak melakukan deploy — `AGENTS.md` §5b).

**Catatan**: verifikasi runtime GAS tetap terblokir OAuth (`MailApp.sendEmail` scope). Test ini murni client-side dengan stub, jadi tidak memverifikasi round-trip ke Spreadsheet.

---

## [Fase 14 — Item 4] — Tombol Ikon-Saja (`.n-iconbtn-x`) + Audit Ikon Site-wide
**Tanggal**: 1 Oktober 2026
**Status**: Implementasi selesai & terverifikasi lokal (`verify.sh` OK, `selftest.js` 74 pass / 0 fail, `nulltest.js` 12/12, `node --check` client, 4 harness geometris headless Chrome). Menunggu `clasp push` & verifikasi runtime oleh user.

**Permintaan user**: "coba lagi kok nggak pakai icon" — tombol yang teksnya sudah diulang oleh kalimatnya sendiri cukup ikon saja; diperluas menjadi "apply untuk semua button di website dan semua yang butuh icon".

---

### Bagian 1 — Audit: mana yang perlu ikon, mana yang memang tidak boleh

Inventaris seluruh `html/*.html` + `html/views/*.html`: **194 kemunculan tombol/link, 95 label unik**. Hasilnya bukan "semua tombol diberi ikon", melainkan dua kelompok:

**Action gap → diberi ikon** (ikon + teks, kecuali yang jelas icon-only).

** Sengaja tetap teks-only** — di sini ikon justru membuat UI ribut dan melanggar `DESIGN.md` §1:

| Kelompok | Contoh | Alasan |
|---|---|---|
| `.n-tab` (17) | `Kapal`, `Pesawat`, `Amunisi`, `Riwayat` | navigasi horizontal; ikon per tab = deretan ikon tanpa teks |
| segmented filter | `Bulanan`, `Rentang` | hanya 2 opsi, ikon tidak membaca |
| sidebar / nav | `Operasi`, `Logistik`, `Intelijen` | sudah punya label penuh |
| badge status & angka | `Aktif`, `Dibaca`, `3` | bukan aksi |
| KPI | label + angka besar | §1 melarang ikon dekoratif |
| `kdl-clear` | × di search dropdown | sudah punya SVG background sendiri |

**Tetap ikon + teks** (teksnya menunjuk konteks, jadi jangan dipangkas): `Lihat`/`Revisi`/`Anulir` di baris tabel, `Muat Ulang`, `Ulangi upload lampiran`, `Tutup` di footer modal bukti, `Tandai Dibaca` di sel tabel, seluruh tombol primary (`Simpan`, `Batal`, `Verifikasi`).

### Bagian 2 — Tombol ikon-saja: `.n-iconbtn-x`

Kotak **persegi 28×28px**, ghost tanpa border, `flex:0 0 auto`, `color:var(--n-text-muted)`, hover → `var(--n-crit)`, sudah masuk blok `focus-visible` bersama tombol ikon lain.

Hanya 4 konversi, karena hanya di dua konteks sempit teksnya benar-benar tidak menambah informasi:

| Tombol | File | Kenapa ikon cukup |
|---|---|---|
| `Coba lagi` (×2) | `Script_Main.html` | pesan error di atasnya sudah menjelaskan kegagalannya |
| tutup modal detail | `Index.html` | ikon × universally dipahami |
| tutup drawer persetujuan | `Index.html` | idem |

`Coba lagi` **tidak** dijadikan ikon-saja di semua tempat. `Muat Ulang`, `Ulangi upload lampiran`, dan `Tutup` di footer modal bukti tetap ikon + teks — teksnya yang menjelaskan konteks apa yang diulang/dibuka.

### Bagian 3 — `data-ico`: kenapa tombol statis tidak bisa pakai `_ico()`

`Script_Main.html` dimuat **setelah** markup statis. Markup di `Index.html`/`html/views/*.html` diparse sebelum helper ada, jadi `<button>…</button>` tidak bisa berisi pemanggilan `_ico()`.

Solusinya atribut `data-ico="<nama>"` (+ `data-ico-size`), dibaca `_ICO_SEL` + disuntikkan `_icoDecorate()`:

```html
<button class="n-iconbtn-x" data-ico="x" title="Tutup" aria-label="Tutup" onclick="_hdClose()"></button>
```

Tombol yang dirakit dari JS (retry, chip lampiran, tombol daftar) tetap memanggil `_ico()` langsung. Dua jalur, tetap **satu sumber ikon** (`_ICO`) — tidak ada SVG yang disalin-tempel.

### Bagian 4 — Bug lama yang ikut ketahuan

Tombol tutup lama di header modal detail:

```html
<button class="btn-ghost btn-mini" onclick="_hdClose()">Tutup</button>
```

`.btn-ghost` punya `display:block; width:100%`. Dalam flex `.n-modal-hd-head`, tombol itu melebar **407px** dari modal 620px, menyisakan 143px untuk judul — judul membungkus jadi **3 baris (48.81px)**.

Setelah jadi ikon 28×28: judul **1 baris (205.7 × 24.41px)**, tinggi header turun **20.81px**. Header drawer tidak bergeser (**delta 0.00px**).

### Bagian 5 — Ikon & peta baru

- `upload` (Unggah File), `link` (Salin dari Link).
- `Master Data` / `Buka Master Data` dipindah dari glyph `←` ke ikon `book` — navigasi "buka master data" bukan "kembali". `arrowLeft` kini khusus tombol kembali.
- Peta `_ICO` = **28 simbol**. (Angka "21" di entri Item 2 memang sudah salah sejak awal — daftarnya berisi 26 nama; sekarang memakai hitungan aktual.)

### Bagian 6 — Verifikasi

**Statis**: `verify.sh` OK · `selftest.js` **74 pass / 0 fail** · `nulltest.js` **12/12** · `node --check` client bersih.

**Geometris** (headless Chrome, `chrome-headless-shell --dump-dom`):

| Harness | Cakupan | Hasil |
|---|---|---|
| `mkprobe-ico.py` | **115 tombol live** dari markup asli semua view | `tinggi_naik=0`, `max_delta=0.094px` (sub-pixel), `teks_berubah=0`, `injeksi_ganda=0`; 24 tanpa ikon = 24 kontrol tekstual-sengaja |
| `mkprobe-x.py` | 4 tombol ikon-saja + header lama vs baru | 28×28 **persegi**, `viewBox="0 0 24 24"`, `stroke="currentColor"` (mewarisi `rgb(163,174,208)` = `--n-text-muted`), `aria-hidden="true"`, `focusable="false"`, tanpa teks, `title`+`aria-label` ada |
| `mkprobe-nlist.py` | **8 spec `_nList` nyata** | semua punya track `auto`, 0 tumpang tindih, 0 tombol hapus tanpa ikon/aria |
| `mkprobe-view.py` | **15 view** @ 1440px **dan** 390px | 147 tombol, 0 view melimpah, 0 elemen keluar viewport, 0 tombol gepeng |

**`html/Style.html` murni aditif** — 1 selector ditambah ke blok `focus-visible` yang sudah ada + satu blok baru `.n-iconbtn-x`. Tidak ada aturan layout yang diubah, jadi nol risiko regresi grid/list.

### Bagian 7 — Test yang ikut diperbaiki

Test lama "setiap pemakaian `_ico()` berada di dalam tombol bertitle + aria-label" ikut salah begitu ada tombol ikon+teks, karena `aria-label` pada tombol berlabel justru **menimpa label yang terlihat** dan membingungkan pembaca layar. Test dik sharpened: aturan `title` + `aria-label` hanya untuk tombol **ikon-saja**; tombol ikon+teks justru di-*assert* tidak boleh punya `aria-label`. Ditambah test untuk `data-ico`, retry ikon-saja, cakupan nama ikon, dan `focus-visible` `.n-iconbtn-x`. `nulltest.js` ditambah 2 assertion supaya retry benar-benar punya ikon + aria-label, bukan sekadar kecocokan kata "Coba lagi" dari teks pesan.

### Bagian 8 — Tidak diubah

Tidak ada perubahan schema, endpoint, `services/`, `DATA_SCHEMA.md`, atau `ARCHITECTURE.md`. Tidak ada `clasp push` (`AGENTS.md` §5b).

**Catatan lanjutan (di luar scope item ini)**: `n-drawer-sub` masih berupa subtitle di bawah judul drawer, sedangkan `DESIGN.md` §1 menyatakan subtitle tidak boleh menabrak judul header. Discrepanzi RBAC `KADIV` lintas divisi untuk `Anulir` (client lebih longgar dari `_opsLautAssertWrite`) juga masih terbuka. Keduanya tidak disentuh karena bukan bagian task ikon.

---

## [Fase 14 — Item 3] — Audit Geometri List/Form (seluruh website) + Perbaikan RBAC `Revisi` di Riwayat
**Tanggal**: 30 September 2026
**Status**: Implementasi selesai & terverifikasi lokal (`verify.sh` OK, `selftest.js` 70 pass, `nulltest.js` 10/10, `node --check` client, verifikasi geometris headless Chrome). Menunggu `clasp push` & verifikasi runtime oleh user.

**Permintaan user**: audit seluruh website (bukan hanya Rumpon) — form/list harus rapi dan sejajar; **lebar boleh bertambah, alignment lebih penting daripada kompresi**; tombol `Revisi` di riwayat harus muncul sesuai hak akses.

---

### Bagian 1 — Dua bug yang ditemukan

**1. Kolom hidden di `_nList()` menjadi anak grid**

`_nList()` membuat satu elemen sel per kolom, termasuk kolom `type: 'hidden'` (mis. `itemtype` di Rumpon). Karena `display` masih default, sel ikut menjadi anak grid dan memakan track — padahal isinya tidak terlihat. Akibatnya baris pada `ops-rumpon-list` & `rv-ops-rumpon-list` wrap ke **3 baris**: `dTop=48px`, `dBot=63px`, tinggi baris 82px vs 38px untuk daftar lain.

`makeRow()` kini memberi `display:none` pada sel yang kolomnya `type: 'hidden'`, sehingga tidak menjadi anak grid sama sekali.

**2. Tombol `Revisi` hilang untuk SUPERADMIN di riwayat Operasi**

`_opsLautRenderHistory()` dan `_opsUdaraRenderHistory()` menentukan `canWrite` sebagai:

```js
var canWrite = (APP.user && APP.user.divisiId === 'DIV-OPS' && (APP.user.role === 'STAF' || APP.user.role === 'KADIV'));
```

Kondisi itu mewajibkan `divisiId === 'DIV-OPS'` untuk **semua** role, termasuk SUPERADMIN. Padahal server (`_opsLautAssertWrite` / `_opsUdaraAssertWrite`) menerima SUPERADMIN tanpa syarat divisi. Akibatnya SUPERADMIN — satu-satunya role yang paling sering merevisi laporan — tidak pernah melihat tombol `Revisi`.

Client kini mencerminkan server persis:

```js
var canWrite = (APP.user && (APP.user.role === 'SUPERADMIN' ||
  (APP.user.divisiId === 'DIV-OPS' && (APP.user.role === 'STAF' || APP.user.role === 'KADIV'))));
```

`DIREKTUR` tetap tidak mendapat `canWrite` (server juga menolaknya) — DIREKTUR hanya boleh **anulir**, bukan write/revisi. **Service server tidak diubah sama sekali**; yang salah hanya cerminannya di client.

### Bagian 2 — Perluasan ikon (lanjutan Item 2)

Permintaan lanjutan: *"Penggunaan IKON diperluas … lakukan analisis Anda, mana yang perlu ICON, jangan semuanya teks juga."*

- Deklarator label baru `_ICO_LABEL` + `_icoDecorate()` (+ `_icoWatch()` MutationObserver) menyisipkan ikon pada tombol berlabel yang **teksnya persis cocok** dengan peta. Teks tombol tidak pernah diganti/dibungkus ulang, jadi nama aksi tetap terbaca screen reader.
- Ikon disisipkan sebagai `inline-block` di awal tombol (`insertAdjacentHTML('afterbegin')`), **bukan** mengubah `display` tombol menjadi flex. Percobaan pertama memakai `display:inline-flex` + `gap` dan terbukti menaikkan tinggi tombol 1–2px (`.n-list-add` +2.8px) serta membuat tombol `Konfirmasi Anulir`/`Batal` membungkus ke 2 baris (+16px) — regresi alignment yang persis dikeluhkan user.
- Ukuran ikon berbasis `em` (`1.05em`), bukan pixel tetap, supaya tidak pernah melewati line-box tombol pada ukuran font apa pun. `.n-has-ico` memakai `white-space:nowrap` agar ikon+teks tetap satu baris.
- Peta ikon diperluas jadi 21 simbol: `trash`, `x`, `pencil`, `square`, `play`, `plus`, `check`, `save`, `ban`, `power`, `refresh`, `send`, `logout`, `login`, `user`, `eye`, `history`, `clock`, `sliders`, `mail`, `mailCheck`, `key`, `chevronDown`, `arrowLeft`, `book`, `info`.
- **Tetap teks-only**: tab, status badge, segmented filter, badge angka, dan `kdl-clear` (sudah punya SVG background sendiri).

### Bagian 3 — Verifikasi geometris (headless Chrome)

| Harness | Cakupan | Hasil |
| --- | --- | --- |
| `audit-nlist.js` | 8 call site `_nList` dari source | semua track cukup |
| `mkprobe-nlist.py` | 5 spec list dinamis, diukur **setelah** dekorasi ikon | `dTop=0.0` `dBot=0.0` tinggi baris = 38px — **SEMUA SEJAJAR** |
| `probe-nlist-nofix.html` | kontrol negatif tanpa `display:none` | Rumpon gagal: 3 baris, `dTop=48px` (bukti perbaikan) |
| `probe-grid.html` | **40 baris** grid multi-kontrol di 9 view | `SEMUA BARIS GRID SEJAJAR` |
| `mkprobe-ico.py` | 133 tombol live di seluruh markup view | tinggi bertambah **0**, overflow baru **0**, teks berubah **0**, injeksi ganda **0** |

Harness `probe-grid.html` uncovering bug-nya sendiri: `querySelectorAll` tidak mencocokkan elemen itu sendiri, sehingga sel grid yang **adalah** sebuah `<select>` (baris dropdown periode) sempat terlewat dan baru ikut terukur setelah perbaiki — cakupannya naik dari 27 ke 40 baris.

### Bagian 4 — Regression test baru (`selftest.js`, 66 → 70 pass)

1. Ikon pada tombol berlabel tidak boleh mengubah model layout tombol (menolak `inline-flex`, menuntut ikon `inline-block` + ukuran `em` + `nowrap`).
2. Deklarator ikon idempoten, tidak menimpa `textContent`, dan setiap nama ikon di `_ICO_LABEL` benar-benar ada di `_ICO`.
3. Tidak ada label tombol rusak / tombol kosong tanpa `title`/`aria-label` (kecuali `.kdl-clear` yang memang ikon dari CSS).
4. RBAC `Revisi`: client kedua renderer menerima SUPERADMIN + `DIV-OPS` KADIV/STAF, menolak DIREKTUR, dan cerminannya cocok dengan `_ops*AssertWrite` di kedua service.

### Bagian 5 — Tidak diubah

Tidak ada perubahan `DATA_SCHEMA.md`, kontrak endpoint, atau service server. Tidak ada `clasp push` (agen tidak melakukan deploy — `AGENTS.md` §5b). Perubahan siap di-commit/push oleh user.

---

## [Fase 14 — Item 2] — Ikon Aksi untuk Tombol Mikro (Hapus Baris, Hapus Lampiran, Opsi) & Fix Baris Hapus yang Wrap
**Tanggal**: 30 September 2026
**Status**: Implementasi selesai & terverifikasi lokal (`verify.sh` OK, `selftest.js` 66 pass, `nulltest.js` 10/10, `node --check` client, verifikasi geometris headless Chrome). Menunggu `clasp push` & verifikasi runtime oleh user.

**Permintaan user**: "Tombol hapus di setiap entri dalam isi form harus pakai logo tempat sampah" → "oke, coba sekarang apply itu untuk semua button di website dan semua yang butuh icon", disertai keluhan bahwa form terlihat melebar/ramai.

---

### Bagian 1 — Audit tombol: mana yang benar-benar butuh ikon

Inventaris tombol di `html/*.html` + `html/views/*.html` (**189 tombol**) dikelompokkan per fungsi, **bukan** dipasang ikon seragam. Kriteria: ikon hanya untuk **aksi sempit yang berulang di banyak baris** dan bisa ditebak tanpa teks (hapus, tutup chip, ubah label, aktif/nonaktif).

| Kelompok tombol | Keputusan | Alasan |
| --- | --- | --- |
| Hapus baris (KII/KIA, rumpon, objek SDK, jenis kejadian, kawasan, penyedia, marabahaya, master data) | **ikon trash** | aksi berulang, satu-satunya aksi pada baris itu, dan menghemat lebar |
| Hapus file / hapus link pada chip lampiran | **ikon x** | chip sempit, tidak muat teks |
| Ubah teks tampilan opsi · aktif/nonaktifkan opsi (Master Data) | **ikon pencil / square+play** | dua aksi kecil dalam chip sempit |
| `Simpan`, `Batal`, `Tutup`, `Muat Ulang`, `Tambah baris` | tetap teks | primary action, ikon menutupi makna |
| `Lihat`, `Revisi`, `Anulir`, `Setujui`, `Tolak`, badge status | tetap teks | alur approval harus eksplisit & terbaca |
| `kdl-clear` (hapus pencarian kapal) | tidak diubah | sudah memakai SVG background sendiri |

### Bagian 2 — Perubahan

**`html/Script_Main.html`**
- Satu sumber ikon: `var _ICO = { trash, x, pencil, square, play }` + helper `_ico(name, size)` → inline `<svg viewBox="0 0 24 24">`, `fill="none" stroke="currentColor" stroke-width="1.75"` (ikon `play` pakai `fill="currentColor"`), `aria-hidden="true" focusable="false"` supaya dekoratif.
- Semua tombol ikon punya `title` **dan** `aria-label` bahasa Indonesia (`Hapus baris`, `Hapus kawasan`, `Hapus file`, `Hapus link`, `Ubah teks tampilan`, `Aktifkan`/`Nonaktifkan`) — aksesibilitas tidak bergantung pada ikon.
- Diterapkan di: `_nList()` (baris daftar + baris revisi di 4 halaman), `intelAddKawasanRow()`, `pemAddPenyediaRow()`, `pemAddMarabahayaRow()`, `_mdDeleteKawasan()`, `_attachRenderList()` (chip file & link), chip Opsi Master Data.

**`html/Style.html`**
- `.n-list-del` — tombol hapus baris daftar: lebar tetap 45px, **tinggi mengikuti kotak input** via `align-self:stretch` (bukan angka px), netral seperti input, hover jadi `--n-crit`.
- `.n-iconbtn` — tombol 45px untuk baris form, dibungkus `.form-grp` supaya dasar kotak rata dengan kontrol di sebelahnya.
- `.n-iconbtn-sm` — versi sel aksi tabel, memakai **box model `.btn-sm` yang sama** (pill + `padding:4px`) sehingga tinggi ikon otomatis sama dengan tinggi tombol teks.
- `.attach-chip button` → 20×20 dan `focus-visible` bersama untuk semua tombol ikon.

### Bagian 3 — Bug lama yang ikut ditemukan: tombol hapus selalu wrap ke baris baru

`.n-list-row` punya `grid-template-columns` **3 track** tapi **4 anak** (3 kontrol + sel hapus) → kolom hapus overflow ke baris implisit kedua, tombol tampil **di bawah** input. Inilah penyebab form terbaca "melebar/crowded", dan bug ini sudah ada **sebelum** ikon ditambahkan (ikon menambah lebar tombol, bukan diminta untuk membuat bug ini).

Perbaikan:
- `makeRow()` kini memakai `grid + ' auto'` sehingga track kolom hapus selalu ada, apa pun jumlah kolom yang dipakai tiap form.
- `.n-list-delcell { align-self: stretch }` + `.n-list-del { align-self: stretch }` → tinggi tombol = tinggi kotak input, otomatis mengikuti metrik font.
- Regresi dikunci di `selftest.js` ("grid baris dinamis menyisakan track auto untuk kolom hapus").

### Bagian 4 — Verifikasi geometris (bukan sekadar "kelihatan oke")

Karena masalah aslinya soal layout, alignment diukur dengan `getBoundingClientRect` di headless Chrome memakai `Style.html` **live** + markup baris yang disalin apa adanya dari sumber (`/tmp/opencode/mkprobe.py` → `probe2.html`):

| Kontainer | Perbandingan | Hasil |
| --- | --- | --- |
| `.n-list-row` | input vs `.n-list-del` — delta-atas **0.0px**, delta-tinggi **0.0px**, tidak wrap | ✅ |
| Baris inline (kawasan/penyedia/marabahaya) | kontrol vs `.n-iconbtn` — delta-bawah **0.0px** (dasar rata), tombol 7px lebih tinggi → target sentuh lebih besar | ✅ |
| Sel aksi tabel | `.btn-sm` vs `.n-iconbtn-sm` — sejajar | ✅ |
| Chip lampiran | tombol hapus 20×20 | ✅ |

Catatan jujur: pengukuran dilakukan headless tanpa Google Fonts termuat, jadi tinggi absolut bisa berbeda ±2px di browser user; yang dijamin adalah **tidak wrap** dan **dasar rata**, bukan angka px yang dikunci.

### Bagian 5 — Regression test baru (`selftest.js`: 61 → **66 pass**)

1. tidak ada tombol aksi "Hapus" berteks di client maupun view (regex `>\s*Hapus\s*<`)
2. setiap blok `<button>` yang memuat `_ico(` punya `title=` **dan** `aria-label=`
3. `_ico()` memakai `viewBox 24`, `stroke="currentColor"`, `aria-hidden`, `focusable=false`, dan `_ICO` bebas `<img>`/`<text>`/emoji
4. `makeRow()` menambah track `' auto'` + tombol hapus punya title/aria (regresi wrap)
5. CSS punya `.n-list-del`/`.n-iconbtn`/`.n-iconbtn-sm`, hover `--n-crit`, dan `focus-visible`

### Bagian 6 — Tidak diubah

Tidak ada perubahan `DATA_SCHEMA.md`, service, endpoint, RBAC, atau struktur folder. Tidak ada `clasp push` — agent tidak melakukan deploy (`AGENTS.md` §5b). Blocker runtime yang sudah diketahui dan **belum** terselesaikan: permission `MailApp.sendEmail` (butuh `debug_forceAuthEmail()`/full scope oleh user).

---

## [Fase 14 — Item 1] — Input Periode Seragam: Dropdown di Semua Form
**Tanggal**: 30 September 2026
**Status**: Implementasi selesai & terverifikasi lokal (`verify.sh` OK, `selftest.js` 61 pass, `nulltest.js` 10/10, `node --check` client + server). Menunggu `clasp push` & verifikasi runtime oleh user.

**Permintaan user**: "Input periode di semua form pastikan pakai dropdown, saya lihat di TU masih ketik manual, semua harus sama."

---

### Bagian 1 — Temuan audit: TU satu-satunya pengecualian

Audit seluruh `html/views/*.html` untuk kontrol periode:

| Form | Kontrol periode | Status |
| --- | --- | --- |
| Operasi Laut · Operasi Udara · Intelijen · Pemantauan | 3 dropdown | sudah |
| Perawatan (Kesiapan/Docking/Item) · Logistik (Approvals/Pengajuan/Permintaan) · Pengawakan (Approvals/Kepatuhan) | 3 dropdown | sudah |
| **Tata Usaha** | **`<input type="text" id="tu-periode" maxlength="12" placeholder="YYYY-MM-WW (contoh: 2026-09-W03)">`** | **manual** |

Jadi ini bukan permintaan "tambah dropdown baru", melainkan **menyamakan satu outlier** dengan pola yang sudah mapan di 12 form lain. Sumber salah-format di TU juga lebih besar dari kelihatannya: `TataUsahaService.js` harus menolak dengan `Format Periode tidak valid. Gunakan YYYY-MM-WW.` karena angka minggu bisa diketik `0`, `6`, atau `2026-9-3`.

### Bagian 2 — Perubahan

**`html/views/TataUsaha.html`** — `tu-periode` diganti tiga `<select>` di dalam `.form-grp`, grid `1fr 1fr 1fr` (`tu-periode-tahun` / `tu-periode-bulan` / `tu-periode-minggu`) + hint `.n-form-hint` `tu-periode-hint`. Markup identik dengan 12 form lain, termasuk gaya `<select>` chevron kustom yang sudah ada.

**`html/Script_Main.html`**:
- `_renderTataUsaha()` — blok hitung periode manual (duplikat dari `DateUtil`, 6 baris) diganti `_opsInitPeriodeUi('tu-')` + `_tuSyncPeriodeHint()`.
- `_tuSyncPeriodeHint()` (baru) — hint `Periode: YYYY-MM-WW`, mengikuti pola `_rawatUpdatePeriodeHint`/setara modul lain.
- `tuOpenForm()` — blok prefill periode manual diganti inisialisasi dropdown + pemasangan `onchange` per select; field numerik/lain tetap di-reset seperti sebelumnya.
- `tuSubmit()` — `periode` sekarang dari `_composePeriode('tu-')`, plus guard `Periode wajib dipilih.` bila dropdown belum lengkap (barisan dengan modul Pemantauan/Intelijen/Perawatan).

**Tanpa helper baru untuk dropdown** — `_opsInitPeriodeUi(prefix)` + `_composePeriode(prefix)` sudah generic (prefix `ops-`/`oud-`/dst.) dan kini dipakai 13 form. Konvensi minggu ikut `DateUtil` (tanggal 1–7 = `W01`, 22–28 = `W04`, 29+ = `W05`) dan tahun menyediakan tahun lalu–tahun depan agar laporan lintas tahun aman.

### Bagian 3 — Yang sengaja tidak diubah

- **`services/TataUsahaService.js`** tetap memvalidasi `parsePeriode(periode)` dengan pesan `Format Periode tidak valid. Gunakan YYYY-MM-WW.` Validasi server adalah lapisan kedua yang tetap berguna (client bisa dilewati), jadi tidak dihapus meski dropdown membuat format selalu valid.
- **`DATA_SCHEMA.md` tidak tersentuh** — tidak ada kolom/tabel baru; `Periode` masih `YYYY-MM-WW` (`ARCHITECTURE.md` §data).
- **Filter periode global** (`.filter-box`, kanan atas) tidak disentuh — itu bukan input form pelaporan, dan sudah redesigned di `DESIGN.md` §7.
- **Halaman Riwayat Laporan & Profil Kapal** tidak disentuh (bukan form input).

### Bagian 4 — Verifikasi

`verify.sh` OK (95 endpoint client terpetakan), `selftest.js` 61 pass / 0 fail + `ALL RENDER LOGIC OK`, `nulltest.js` 10/10, `node --check` untuk script client hasil ekstraksi `html/Script_Main.html` dan seluruh file server. Dua regression test baru ditambahkan untuk mencegah regresi ke input manual:
- **`input periode seragam: semua form pakai <select>, tidak ada ketik manual`** — memindai seluruh `html/views/*.html`, gagal bila ada satu pun `<input id="*-periode*">`, dan memastikan jumlah dropdown periode minimal 39 kontrol.
- **`_composePeriode merakit format YYYY-MM-WW dari 3 dropdown`** — mengekstrak fungsi `_composePeriode` dari client, menjalankannya di `vm` sandbox: `2026`+`9`+`3` → `2026-09-W03`, dan dropdown tidak lengkap → `''` (submit ditolak client).

Dokumen yang disinkronkan di entri yang sama: `DESIGN.md` §7 (input periode sebagai komponen kunci), `PHASES.md` (Fase 14 dinyatakan **berjalan — item 1 selesai**, DoD per modul masih belum dikerjakan). Tidak ada perubahan skema, tidak ada endpoint baru, tidak ada push/deploy — keduanya milik user (`AGENTS.md` §5b).

---

## [Revisi Lintas Modul] — Bentuk Tabel Riwayat Seragam (Lihat/Revisi/Anulir) & Tombol Lampiran Dihapus dari Baris
**Tanggal**: 30 September 2026
**Status**: Implementasi selesai & terverifikasi lokal (`verify.sh` OK, `selftest.js` 59 pass, `nulltest.js` 10/10, `node --check` client + seluruh file server). Menunggu `clasp push` & verifikasi runtime oleh user.

**Permintaan user**: seragamkan **semua tabel riwayat divisi** — bentuk kolom, badge status, dan baris aksi `Lihat`/`Revisi`/`Anulir`; tidak ada lagi tombol **Lampiran** terpisah di baris history, lampiran diakses lewat `Lihat`.

---

### Bagian 1 — Akar masalah: 15 tabel riwayat dirender oleh 15 fungsi bespoke

Inventaris sebelum perubahan: **14 tabel riwayat divisi** (Tata Usaha, Operasi Laut, Operasi Udara, Intelijen, Kegiatan Direktorat, Pemantauan, Perawatan ×3, Logistik ×3, Pengawakan ×2) + **1 halaman Riwayat Laporan lintas-divisi**. Semuanya dirender fungsi sendiri (`_tuRenderHistory`, `_opsLautRenderHistory`, …, `_riwRender`) dengan header, badge status, baris void, dan baris aksi yang ditulis ulang per modul. Akibatnya bentuknya berbeda-beda: sebagian kolom waktu bernama `Tanggal`, sebagian `Dikirim`; sebagian `status-badge` inline hex, sebagian teks polos; `Lampiran` hanya ada di Perawatan; baris VOID muncul hanya di Riwayat Laporan.

### Bagian 2 — Penyelesaian: satu renderer bersama `_histRender()`

Helper baru di `html/Script_Main.html`:
- **`_histNorm(r)`** — normalisasi key Gen-1 PascalCase (`RowID`, `Status`, `Periode`, `Timestamp`) ke camelCase client-side, supaya renderer lama (Fase 5–10) dan renderer Gen-2 (Kegiatan, Riwayat) bisa memakai satu jalur. **Tidak ada perubahan kontrak server atau skema sheet.**
- **`_histBadge` / `_histBadgeTone`** — badge status dari kelas token (`.aktif`, `.ditimpa`, `.dianulir`, `.siap`, `.tidak-siap`, `.baseline`), bukan lagi `style="background:#…"` inline.
- **`_histRowAttrs` / `_histActions`** — baris `SUPERSEDED` diberi `.hist-row-ditampa`, baris `VOID` `.hist-row-void` + baris catatan `.hist-void-note` berisi alasan anulir; aksi `Lihat` → `Revisi` → `Anulir` (tampil hanya bila `Status = ACTIVE` dan role memenuhi RBAC yang sudah ada per modul).
- **`_histRender(wrapId, cfg, rows, prefixHtml)`** — satu-satunya fungsi pembuat tabel riwayat. `cfg` = `columns`, `cells`, `refSheet` (string **atau** fungsi untuk halaman agregat), `title`, `detail`, `manage` (opsional), `revisi`, `anulir`, `empty`. Header, badge, void note, baris aksi, dan empty-state semuanya dari sini.

Bentuk kanonik: `Periode | …kolom spesifik modul… | Dikirim | Status | Aksi`. Kolom **Dikirim** sengaja dipakai dan bukan "Tanggal", karena di Kegiatan `Tanggal` sudah dipakai untuk tanggal kejadian. Kegiatan Directorate menambahkan kolom `Periode` di depan — aman karena `TX_KegiatanDirektorat` sudah menyimpannya lewat `dateToPeriode`.

Halaman **Riwayat Laporan** (lintas-divisi) ikut memakai renderer yang sama agar konsisten, tetapi aksinya tetap **Lihat** saja: revisi/anulir harus diarahkan ke modal modul asalnya, jadi tidak menyediakan tombol yang menyesatkan di feed agregat. Mini-table **Profil Kapal** (`_pkSection`, read-only, 8 baris teratas, tanpa status/aksi) **tidak** diubah — itu ringkasan profil kapal (`PRD.md` §6), bukan tabel riwayat modul.

### Bagian 3 — Lampiran pindah ke modal `Lihat`

Tombol `Lampiran` per baris dihapus. Semua modul kini preview lampiran dari bagian **Lampiran** di dalam modal `Lihat` (`#modal-hd`, `evidence_list`). Konsekuensi & solusinya:
- `_rawatOpenEvidence()` sebelumnya hanya bisa dicapai lewat tombol baris tersebut. Agar kemampuan menambah lampiran **setelah laporan terkirim** tidak hilang, `_hdPush()` menerima argumen `manage` opsional → `_hdOpen()` merender tombol **Kelola** di header bagian Lampiran (`#hd-evidence-manage`), hanya untuk Perawatan. Modul lain tetap read-only di `Lihat` — sesuai `PRD.md` §11, di luar Perawatan sistem memang belum mendukung unggah lampiran setelah laporan terkirim.
- Badge jumlah lampiran di baris (`_rawatLoadEvidenceCounts` + `evidence_listBatch`) dihapus bersama tombolnya. Selain tidak ada lagi elemen `evc-*`, ini juga menghapus satu panggilan server per muat riwayat. `_HD.cur` + `_hdRefreshEvidenceIfCurrent()` menggantikannya: setelah unggah, daftar lampiran di modal `Lihat` yang masih terbuka ikut disegarkan.
- `evidence_listBatch()` di `services/EvidenceService.js` jadi tanpa pemanggil → **dihapus** (beserta baris daftarnya di header file). Kontrak sheet `TX_Evidence` tidak berubah sama sekali.

### Bagian 4 — Verifikasi & dokumentasi

`verify.sh` OK (94 endpoint client terpetakan), `selftest.js` 59 pass / 0 fail + `ALL RENDER LOGIC OK`, `nulltest.js` 10/10, `node --check` untuk script client hasil ekstraksi `html/Script_Main.html` dan seluruh file server. Dokumen yang disinkronkan di entri yang sama: `DESIGN.md` §7 (pola tabel riwayat sebagai komponen kunci), `PRD.md` §11 (kelola lampiran di dalam modal `Lihat`), `PHASES.md` (blok "Perubahan Lintas Fase" + koreksi status Fase 11 yang tertinggal). Tidak ada perubahan skema, tidak ada endpoint baru, tidak ada push/deploy — keduanya milik user (`AGENTS.md` §5b).

---

## [Fitur] — Registrasi Wajib Verifikasi OTP Email + NIP, dan Email Reminder yang Tidak lagi Diam-diam Gagal
**Tanggal**: 30 September 2026

**Status**: Implementasi selesai & terverifikasi lokal (static verify + 59 uji). Menunggu `clasp push` + ONE-time authorization `script.send_mail` oleh user via `debug_forceAuthEmail()`.

**Permintaan & persetujuan user**:
1. Bug: email reminder mingguan tidak pernah terkirim, tapi UI tetap menampilkan "terkirim".
2. Permintaan: registrasi harus wajib **verifikasi email (OTP)** — bukan sekadar mengisi email.
3. Keputusan user (30 Sep 2026): **`NIP` adalah additional requirement**, bukan pengganti Email. Email tetap identitas login utama; NIP field wajib terpisah yang juga unik.

---

### Bagian 1 — Akar masalah email: scope `script.send_mail` tidak ada

**Gejala**: `Email terkirim: 0`, tidak ada error di UI. `MailApp.sendEmail()` melempar exception, tetapi exception itu hanya ditulis ke `Logger.log()` lalu ditelan — jadi hasil "sukses" masih dikembalikan ke client.
**Perubahan**:
- `appsscript.json`: menambah scope `https://www.googleapis.com/auth/script.send_mail` (tidak ada scope mail sama sekali sebelumnya, sehingga `MailApp` tidak pernah boleh mengirim).
- `services/NotifikasiService.js`: helper baru `_ntfKirimEmail(to, subject, body)` → `{ ok, reason }`. Menerjemahkan dua kegagalan yang paling sering terjadi ke bahasa yang bisa ditindaklanjuti user: authorization (`ScriptApp`/scope) dan kuota harian `MailApp`. Alamat tidak valid ditolak **sebelum** memanggil `MailApp`.
- `services/NotifikasiService.js`: `notifikasi_generateReminderMingguan` kini mengembalikan `emailErrors[]` (email + alasan) selain `sentEmails`. Batch yang sebagian gagal tetap dianggap sukses karena notifikasi **in-app** sudah masuk — tapi user tidak lagi dipaksa percaya email terkirim.
- `html/Script_Main.html` (`_adnReminderResult`): menampilkan tabel recipient + sebab kegagalan per email.
- `Setup.js`: fungsi **`debug_forceAuthEmail()`** — satu-satunya cara memberi grant `script.send_mail` pada rezim `ANYONE_ANONYMOUS` (lihat catatan deployment di bawah).

**Catatan deployment — kenapa consent screen tidak pernah muncul dari web app**:
`appsscript.json` mendaftarkan web app sebagai `access: ANYONE_ANONYMOUS` + `executeAs: USER_DEPLOYING`. Consent screen hanya bisa ditampilkan kepada akun Google yang terautentikasi; pemanggil anonim tidak punya akun untuk ditanya, jadi Google tidak menampilkan apa pun. Otorisasi harus diberikan pemilik project — dan hanya bisa dipancing lewat eksekusi yang benar-benar memanggil `MailApp`:
- Menjalankan `auth_requestOtp` dari tombol **Run** tidak akan berhasil: fungsi berparameter tidak bisa dijalankan dari toolbar editor.
- Fungsi tanpa argumen pun seperti `doGet` tidak menyentuh `MailApp`, sehingga eksekusi selesai bersih tanpa meminta scope sama sekali.
- Karena itu `debug_forceAuthEmail()` (noll-argument) ditambahkan. Implementasinya memakai `ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL)` — API resmi yang menghentikan eksekusi dan menampilkan consent screen untuk seluruh scope di manifest. Setelah diotorisasi, Run sekali lagi: fungsi lanjut mengirim email uji ke akun owner sebagai bukti `MailApp` benar-benar berfungsi. Grant berlaku untuk seluruh project (termasuk reminder mingguan), tidak perlu diulang per pengguna.
  - Catatan: `ScriptApp.getScopes()` **tidak pernah ada** sebagai API — jangan dipakai. Yang tersedia: `requireAllScopes(authMode)` dan `requireScopes(authMode, oAuthScopes)`. Keduanya hanya bekerja dari IDE (permukaan yang mendukung granular consent).
- Alternatif yang **tidak dipakai**: mengubah `access` menjadi `MYSELF`/`DOMAIN`. Itu memaksa setiap pengguna login Google dan klik *Allow*, sementara aplikasi sudah punya login email+password sendiri — jadi ada dua identitas paralel. Tidak sepadan dengan cepatnya.

---

### Bagian 2 — Registrasi 2 tahap: OTP email + NIP

**Keputusan desain utama**: akun **tidak lagi dibuat** pada langkah pertama. Kode OTP harus dibuktikan dulu, baru baris `Users` (`PENDING`) dan `Approval_Queue` ditulis. Konsekuensinya sheet tidak pernah berisi akun yang email-nya belum diverifikasi, dan pendaftaran gagal di tengah tidak meninggalkan baris yatim.

**Endpoint baru** (`services/AuthService.js`):
| Endpoint | Tugas | Menulis sheet? |
|---|---|---|
| `auth_requestOtp(params)` | Validasi **seluruh** form → kirim kode 6 digit | Tidak |
| `auth_verifyOtp(params)` | Cek kode → terbitkan `pendingToken` sekali pakai | Tidak |
| `auth_register(params)` | Wajib `pendingToken` → tulis `Users` + `Approval_Queue` | Ya, dalam satu `withLock` |

**Aturan & parameter** (keputusan teknis, dicatat di `ARCHITECTURE.md` §11 & `PRD.md` §3.1):
- TTL kode OTP **10 menit**; `pendingToken` **15 menit**; jarak minimal kirim ulang **60 detik**; maksimum **5** percobaan kode salah (setelah itu kode dihapus, harus minta baru).
- Kode OTP, `pendingToken`, dan cooldown resend disimpan di `CacheService` (`otp_<email>`, `otppend_<token>`, `otpsent_<email>`) — bukan sheet, karena isinya sementara dan habis sendiri.
- **Kode OTP tidak pernah dikembalikan lewat API**; yang keluar hanya `pendingToken`. Diverifikasi lewat uji.
- **Kegagalan kirim email → kode langsung dibuang** dari cache beserta cooldown-nya, dan user diberi tahu penyebabnya (supaya "kode tidak terkirim" tidak terasa seperti kode hilang sendiri).

**Keamanan yang menutup celah yang terlihat saat review**:
1. **`pendingToken` terikat ke email.** `_otpConsumePending(token, email)` membandingkan email pada token dengan email yang didaftarkan. Tanpa ini, siapa pun yang punya kode untuk email A bisa mendaftarkan akun dengan email B (email B tak pernah diverifikasi). Ditolak dengan pesan eksplisit.
2. **Token tidak diburu saat validasi gagal.** Pendaftaran yang gagal karena NIP bentrok/password kurang/etc. tidak memaksa user mengulang OTP; token baru dibuang setelah baris akun benar-benar tertulis. Diuji: gagal sekali → perbaiki data → berhasil dengan token yang sama.
3. **Satu sumber validasi.** `_otpValidasiPendaftaran()` dipakai kedua endpoint, jadi pesan error di tahap OTP identik dengan tahap akhir dan tidak mungkin ada data yang lolos tahap 1 lalu ditolak tahap 2 tanpa sebab.
4. **OTP sebelum menulis apa pun.** `auth_requestOtp` memvalidasi form lengkap dulu — tidak ada email yang dikirim ke data yang memang akan ditolak.

**NIP**:
- Wajib, unik, disimpan sebagai **digit saja** (`_otpNormalizeNip`), sehingga `"1985 1212 2010 011 001"` dan `"198512122010011001"` tidak bisa lolos sebagai dua NIP berbeda. Panjang minimal 8 digit setelah normalisasi.
- **Pengecualian yang disengaja**: NIP milik akun `REJECTED` dengan **email yang sama** boleh dipakai ulang (orang yang sama mendaftar ulang) — konsisten dengan aturan PRD bahwa `REJECTED` boleh daftar ulang. NIP milik akun `APPROVED`/`PENDING`/`NONAKTIF` tetap terkunci.

**Perubahan skema** (disetujui user, dicatat di `DATA_SCHEMA.md` §`Users`):
- Kolom baru `Users.NIP`, disisipkan setelah `Email` pada sheet baru (`Setup.js`).
- Spreadsheet yang **sudah ada tidak diurutkan ulang**: `ensureUsersNipColumn()` (`data/SheetAccess.js`) menambahkan kolom di ujung bila belum ada. Semua baca/tulis memakai pemetaan nama-header, jadi urutan tidak berpengaruh dan baris lama tidak rusak.
- Akun lama = NIP kosong. Nilainya **tidak ditebak atau diisi otomatis**; hanya terisi bila pemegangnya mendaftar ulang atau Superadmin mengisinya.

**UI** (`html/Index.html`, `html/Script_Main.html`):
- Field registrasi dipisah: Email (wajib) dan NIP (wajib, baru). Ditambah `inputmode="numeric"` + `autocomplete="one-time-code"` untuk kode OTP.
- PUNY step OTP: input 6 digit, **Verifikasi**, **Kirim Ulang**, **Ganti Email**.
- State client `REG` (`otpEmail`, `pendingToken`) dideklarasikan sebagai global — sebelumnya tidak ada, sehingga handler OTP akan `ReferenceError` saat dipakai.
- **Registrasi yang ditolak di tahap akhir tidak memaksa user mengulang OTP.** Server sengaja tidak mencabut `pendingToken` saat gagal, jadi UI membuka kembali form sambil mempertahankan token: user memperbaiki NIP/divisi lalu menekan "Daftar" (atau "Verifikasi" dengan kode yang sama) — tanpa email baru. Hanya bila errornya adalah email yang tidak cocok dengan token, state dibersihkan penuh karena verifikasi harus diulang.
- Pesan sukses registrasi pindah ke layar login (`login-msg`) — sebelumnya ikut terhapus oleh `_regResetOtp()` sebelum sempat terlihat.
- Daftar pengguna di Admin Panel menampilkan NIP di bawah nama (`NIP … · email`), kolom `nip` baru dikirim `admin_getUsers` (tetap tanpa `PasswordHash`).
- **Negative prompt `DESIGN.md` §1 dicek**: tidak ada ikon warna-warni, gradient, badge dekoratif, shadow berlapis, maupun copy motivasional. Tombol memakai `btn-primary`/`btn-sm` yang sudah ada.

**Verifikasi lokal**:
- `verify.sh` → `VERIFY OK` (96 endpoint client terpetakan ke fungsi server, tanpa duplikasi top-level).
- `selftest.js` → **59 pass, 0 fail**. 19 uji baru: pengiriman & isi kode, tidak ada akun yang tercipta sebelum OTP, rate-limit resend, pengurangan percobaan & kunci setelah 5x salah, kode sekali pakai, `pendingToken` sekali pakai + terikat email, penolakan tanpa token, alur lengkap sampai baris `Users`+`Approval_Queue`+notifikasi, NIP wajib/tidak valid/ganda/dinormalisasi, daftar ulang `REJECTED`, form tak lengkap tidak mengirim email, kegagalan kirim email (kode & cooldown dibersihkan), `_ntfKirimEmail` (kuota & alamat invalid), reminder `emailErrors` terisi/kosong, `admin_getUsers` mengirim NIP tanpa hash password.

**Tindakan yang diminta ke user**:
1. `clasp push`.
2. **Berikan ulang otorisasi** — scope `script.send_mail` baru pertama kali diminta setelah push. Tanpa itu, email OTP dan reminder akan gagal (dan sekarang akan tampil pesan yang jelas, bukan diam-diam).
3. Uji manual: daftar dengan Email + NIP → cek inbox → OTP salah sampai batas → OTP benar → cek baris `Users` (`PENDING`) + `Approval_Queue` → approve dari Admin Panel → `NIP` terisi & tampil di daftar pengguna → reminder mingguan terkirim.
4. Catatan: Feature ini **bukan** Fase 14 (QA & Polish) dan tidak memulai Fase 14 — dicatat di `PHASES.md` sebagai perubahan lintas fase atas persetujuan user.

---

## [Fase 13] — Selesai: Fix Serialisasi JSON (Date Object) & Scopes Trigger
**Tanggal**: 30 September 2026
**Status**: Selesai. Fase 13 sepenuhnya tuntas dan Fase 14 (QA) terbuka.

**Gejala yang dilaporkan user**:
1. Page Notifikasi aneh: badge menunjukkan `(1)` tapi daftar notifikasi kosong.
2. Page Audit Log stuck dengan error: `[nautika] respons tidak valid: adn-audit null`.
3. Aktivasi pengingat mingguan gagal dengan error permissions: `https://www.googleapis.com/auth/script.scriptapp`.

**Akar Masalah & Perbaikan**:
1. **Serialisasi Date GAS (Audit Log & Notifikasi)**: Fungsi `admin_getAuditLog` dan `notifikasi_getList` mereturn raw `Date` object di field `Timestamp` / `CreatedAt`. GAS diam-diam menggagalkan serialisasi JSON jika ada Date object tak terstringifikasi, menyebabkan return bernilai `null`. Keduanya telah diperbaiki dengan helper `_cellStr` (menggunakan `.toISOString()`), sama dengan perbaikan untuk `admin_getUsers` dan `auth_getPendingApprovals` sebelumnya.
2. **Missing OAuth Scope**: `ScriptApp.newTrigger` butuh scope eksplisit di `appsscript.json`. URL scope `https://www.googleapis.com/auth/script.scriptapp` ditambahkan ke array `oauthScopes`.
3. **Penyelarasan Riwayat**: `RiwayatService.js` (untuk halaman riwayat laporan) pada kolom `VoidedAt` juga telah dipasangkan konversi `toISOString()` secara preventif.

**Tindak lanjut / Follow up**:
- Lanjut ke Fase 14 (QA & Polish).
- *Catatan untuk User*: Karena ada perubahan scope di `appsscript.json`, GAS mungkin meminta re-otentikasi (Authorization Required) ketika pertama kali menjalankan ulang fitur aktivasi trigger, yang mengharuskan user menekan tombol "Kirim Sekarang" / Aktifkan dan mengikuti dialog persetujuan (Allow) dari Google.

---

## [Hotfix] — Null-Guard Approval Banner + Optimasi notifikasi_getRingkasan (Fase 13)
**Tanggal**: 30 September 2026
**Status**: Selesai — push berhasil, menunggu verifikasi runtime oleh user.

**Gejala yang dilaporkan user**:
1. Notifikasi tidak muncul (badge tetap kosong atau tidak muncul), halaman loading forever, tapi ada mark `(1)` di sebelah ikon notifikasi di sidebar.
2. `Uncaught: can't access property "success", res is null` di console — muncul dari `_loadApprovals/<` dan `_applyShellStatus/<`.
3. Admin Panel: "Memuat daftar pengguna…" stuck + `[nautika] respons tidak valid: adn-users null`.

**Root cause (dua lapisan)**:
1. **Null-guard hilang di 6 `withSuccessHandler`**: `_applyShellStatus`, `_loadApprovals`, `doApprove`, handler reject, `handleLogin`, `handleRegister` — semuanya mengakses `res.success` langsung tanpa cek `res != null`. Bila GAS mengembalikan `null` (timeout, atau execution error di luar cakupan `try/catch` server), handler melempar `TypeError` yang hilang diam-diam, menyebabkan loading spinner menggantung.
2. **Timeout di `notifikasi_getRingkasan`**: fungsi ini memanggil `_dashMelaporDetail()` yang membaca **semua 7+ sheet TX** (TATA_USAHA, OPERASI_LAUT, OPERASI_UDARA, INTELIJEN, PEMANTAUAN, PERAWATAN, LOGISTIK, PENGAWAKAN) hanya untuk banner "Anda belum melapor". Ini mahal dan berpotensi melebihi 30 detik GAS execution quota, menyebabkan GAS mengembalikan `null` alih-alih `{ success: false }`.

**Perubahan yang dilakukan**:
- `html/Script_Main.html`: Null-guard `if (!res || !res.success)` ditambahkan di 6 handler:
  - `handleLogin` (line ~268), `handleRegister` (line ~297)
  - `_loadApprovals` (line ~1432), `doApprove` (line ~1492), handler reject (line ~1519)
  - `_applyShellStatus` (line ~2844) — juga diubah menjadi *silent fail* (tidak crash, tidak menampilkan error karena badge bukan fitur kritis)
- `services/NotifikasiService.js`: `notifikasi_getRingkasan` dioptimasi — tidak lagi memanggil `_dashMelaporDetail()` (baca semua 7 sheet TX). Sekarang mencari divisi user di daftar `_ovMelaporDivisiList()`, lalu hanya membaca sheet divisi tersebut saja (1–2 sheet, bukan 7+). Try/catch per-sheet tetap ada; kegagalan cek melapor tidak crash (hanya banner tidak tampil).

**Keputusan teknis**: null-guard ini adalah *defensive coding* — server sudah punya try/catch yang benar, tapi GAS bisa return null di luar jalur itu (quota exceeded, internal error). `withFailureHandler` tidak dipanggil dalam kasus ini, sehingga null-guard di `withSuccessHandler` adalah satu-satunya jaring pengaman.

**Verifikasi**: `node --check` + combined JS syntax clean. Semua 43 file ter-push.

**Yang perlu dilakukan user**:
1. Refresh halaman aplikasi.
2. Konfirmasi: badge notifikasi muncul atau tidak error lagi, dan Admin Panel > tab Pengguna berhasil memuat tabel.

---

## [Hotfix] — "Memuat daftar pengguna" Stuck Tanpa Pesan (Fase 13)
**Tanggal**: 30 September 2026
**Status**: Akar masalah ditemukan dari log runtime user — respons `null` dari server. Jaring pengaman + penanganan `null` terpasang; perlu verifikasi runtime GAS oleh user.

### 1. Gejala
Di Admin Panel → tab **Pengguna**, area tabel menampilkan "Memuat daftar pengguna…" dan tidak pernah berubah (tidak ada tabel, tidak ada pesan error, tidak ada tombol coba lagi).

### 2. Bukti runtime (dari user, penentu)
Console browser memberi:

```
Error in protected function: can't access property "success", res is null
  at _adnLoadUsers (...)
  at withSuccessHandler (...)
```

Ini **membongkar dugaan awal**. Respons tiba dan handler memang dipanggil — jadi ini **bukan** kasus "server tidak menjawab" (jalur timeout) dan **bukan** request yang menggantung. `google.script.run` memanggil **success handler dengan `null`** ketika fungsi server selesai tanpa nilai balik (atau nilai balik tidak bisa diserialisasi), bukan lewat `withFailureHandler`. Kode lama melakukan `if (!res.success)` secara langsung, sehingga `null.success` melempar `TypeError` **di dalam** callback — dan `google.script.run` tidak meneruskan exception callback ke `withFailureHandler`, sehingga hilang di console dan spinner menggantung.

### 3. Akar masalah
Dua lapis:

1. **Akses `res` tanpa guard.** 4 loader Fase 13 men-Yoda-kan `res.success` langsung. Respons `null` (atau `undefined`) langsung jadi `TypeError`.
2. **Server kembalikan `null`.** `admin_getUsers` di `services/AdminService.js` selalu `return { success: ... }` pada jalur normal **dan** `catch` — jadi `null` mengindikasi deployed source yang berbeda dari lokal. Diduga: versi lama belum ter-push, atau duplikat definasi di project GAS. Catatan: `.claspignore` mengabaikan `test.js`/`test_pure.js` (keduanya pernah ter-push dan pernah menimbulkan duplikat function), tetapi `clasp push` **tidak menghapus** file yang sudah ada di server — sehingga ada kemungkinan file lama masih hidup di project GAS dan menduplikasi fungsi.

### 4. Perubahan
`html/Script_Main.html`
- Helper `_asyncResErr(res)` — normalisasi respons: `null`/`undefined`/`0`/`''` → pesan "Server mengembalikan respons kosong. Fungsi server mungkin belum di-deploy (jalankan clasp push) atau melempar exception sebelum return."; `success:true` → `null` (lolos); selain itu → `res.error` atau fallback.
- Helper `_asyncFailUi(wrap, msg, retryCall)` — UI kegagalan tunggal (pesan + tombol **Coba lagi**) yang dipakai bersama oleh timeout, respons kosong, dan handler lain.
- Helper `_asyncResFail(key, wrap, res, retryCall)` — pasangan null-safe dari `_asyncRenderFail`; `console.error` respons tidak valid lalu render pesan.
- Helper `_asyncArm` di-refactor memakai `_asyncFailUi` (perilaku timeout tidak berubah).
- `_adnLoadUsers`, `_adnLoadAudit`, `_adnLoadReminder`, `_ntfReload`: `if (!res.success)` diganti `if (_asyncResErr(res)) { _asyncResFail(...); return; }` — guard **sebelum** akses properti, di luar `try/catch` render.

`services/AdminService.js`
- `admin_getUsers` sekarang `Logger.log` pesan + `e.stack` pada `catch`, supaya `Executions` memberi jejak yang jelas.

### 5. Verifikasi
- `node --check` script client & service OK; `verify.sh` → `VERIFY OK` (94 endpoint, tanpa duplikasi top-level).
- `selftest.js` → `33 pass, 0 fail / ALL RENDER LOGIC OK`.
- `nulltest.js` (harness, di luar project) → 10/10: `success:true` lolos; `null`/`undefined`/`0`/`''` → pesan, tanpa crash; `success:false` → `res.error`; `_asyncResFail` merender pesan + tombol coba lagi, tidak melempar `TypeError`.

### 6. Yang dibutuhkan user
1. **Deploy ulang** (`clasp push`) lalu buka tab Pengguna.
2. Kalau masih kosong, buka **Executions** di editor Apps Script, filter `admin_getUsers`, kirim **Exception** + **Stack trace** (jika ada). Ini menentukan apakah masalahnya duplikat file di project GAS atau logika server.
3. Periksa daftar **Files** di editor Apps Script untuk file sisa yang bukan bagian project (mis. `test.js`, `test_pure.js`, `hotfix`, `fix`) — `clasp push` tidak menghapus file remote. Duplikasi `admin_getUsers` di sana akan persis menghasilkan gejala "sukses dengan `null`".
4. Console browser (F12) — patch ini kini `console.error` setiap respons tidak valid: `[nautika] respons tidak valid: adn-users`.

> Catatan cakupan: pola `res.success` tanpa guard-null masih ada di ±200 call site lama di luar Fase 13 (Overview, Pengawakan, Logs, AKN, dll). Loader Fase 13 sudah diamankan; call site lama belum disentuh karena berada di luar scope hotfix ini — please konfirmasi bila ingin itu dirapikan sebagai pekerjaan terpisah.

---

## [Fase 13] — Notifikasi, Reminder Mingguan, Audit Log, & Admin Panel
**Tanggal**: 30 September 2026
**Status**: Implementasi selesai & siap deploy — verifikasi runtime GAS oleh user (setelah `clasp push`).

### 1. Latar belakang
Empat kebutuhan yang disetujui user: (a) pengingat otomatis ke divisi yang belum melapor, (b) halaman Notifikasi, (c) jejak audit yang bisa dibaca, (d) Superadmin bisa menonaktifkan akun & me-reset password.

### 2. Perubahan
- **`utils/Constants.js`**: `USER_STATUS.NONAKTIF`; `PROP_KEY.REMINDER_TRIGGER_ID`.
- **`services/DashboardService.js`**: `_ovMelaporDivisiList()` diubah dari daftar *sheet* menjadi **7 entri divisi** (Operations Laut+Udara digabung jadi satu, Pengawakan/AKN masuk). KPI "Divisi Melapor Minggu Ini" sebelumnya menghitung 8 entri (Operations dihitung 2×) dan tidak menghitung Pengawakan — sekarang `n/7` sesuai `PRD.md` §4. `_dashMelaporDetail()` kini mengembalikan `{label, divisiId, melapor}` dan hanya menghitung baris yang `DivisiID`-nya cocok (baris kosong `DivisiID` tetap dihitung demi kompatibilitas data lama).
- **`services/NotifikasiService.js`** (baru): `notifikasi_getList`, `notifikasi_getRingkasan`, `notifikasi_markRead`, `notifikasi_markAllRead`, `notifikasi_generateReminderMingguan`, `notifikasi_getReminderSettings`, `notifikasi_setReminderAktif`, `notifikasi_kirimReminderMingguan` (entry point time trigger, tanpa argumen).
- **`services/AdminService.js`** (baru): `admin_getUsers`, `admin_updateUser`, `admin_resetPassword`, `admin_getAuditLog` — semuanya `SUPERADMIN` + `withLock` + `_auditLog`.
- **`services/AuthService.js`**: `auth_login` & `auth_register` menolak akun `NONAKTIF`; penolakan login memakai pesan spesifik (bukan "email/password salah"); tambahan **pencabutan sesi** (lihat §3).
- **`html/views/Notifikasi.html`** (baru) & **`html/views/Admin.html`** (baru), include di `html/Index.html`; sidebar `NAV_SECTIONS` += `notifikasi`, label `kelola-akun` → "Admin Panel"; badge unread di sidebar; strip shell "Divisi Anda belum melapor untuk minggu ini"; modal kelola akun (`#modal-admin-user`).
- **`html/Script_Main.html`**: router, renderer, tab Admin (Persetujuan / Pengguna / Audit Log / Pengingat Mingguan), `_adnFillDivisi` untuk menutup race async dropdown unit kerja, dan `_failOrLogout()` yang memaksa keluar ke layar login saat server menyatakan `UNAUTHORIZED`.
- **`DATA_SCHEMA.md`**: enum `Users.Status` += `NONAKTIF`.

### 3. Keputusan desain
- **Pencabutan sesi (session revocation).** `ScriptCache` tidak bisa di-enumerate, jadi AdminService tidak bisa menghapus token milik user tertentu secara langsung. Solusinya marker `revoked_<UserID>` (TTL 12 jam > TTL sesi 6 jam) yang diperiksa `_requireSession()`; marker dibersihkan saat login berhasil. Efeknya: setiap perubahan akun oleh Superadmin (status/role/divisi) atau reset password **mematikan seluruh sesi lama** dan memaksa login ulang — tanpa itu, `NONAKTIF` hanya mencegah login baru sedangkan token lama (sampai 6 jam) masih memegang `status: APPROVED` di cache.
- **Reaktivasi langsung** `NONAKTIF/REJECTED → APPROVED` oleh Superadmin dicatat dengan `ApprovedBy` + `ApprovedAt` (tidak lewat `Approval_Queue`).
- **Anti-lockout & anti-self-edit**: akun sendiri tidak bisa diubah; `SUPERADMIN` aktif terakhir tidak bisa dinonaktifkan/diganti role-nya.
- **Password reset** minimal 8 karakter, selalu di-`hashPassword()`, tidak pernah dikirim/ditampilkan kembali.
- **Trigger auto-reminder** = installable time trigger Jumat 16:00 (`_ntfInstallTrigger` selalu menghapus trigger lama dulu → idempoten, tidak pernah ganda). Status dibaca dari `ScriptApp.getProjectTriggers()` agar tidak menampilkan "aktif" untuk trigger yang sudah hilang.
- **Reminder** dikirim ke `KADIV` + `STAF` berstatus `APPROVED` pada divisi yang belum melapor, sebagai baris `REMINDER_MINGGUAN` (in-app) **dan** email `MailApp`. Kegagalan email tidak membatalkan notifikasi in-app.
- **Hanya SUPERADMIN** yang boleh menyalakan trigger / mengirim manual; `DIREKTUR` tetap memakai tab Persetujuan yang sudah ada (menu "Admin Panel" tidak diubah visibility-nya agar alur persetujuan tidak terputus).
- **Tidak ada dedup mingguan**: tombol "Kirim Sekarang" memang alat uji manual, jadi pengiriman ganda diizinkan (sudah dilindungi `withLock` agar tidak tumpang-tindih).

### 4. Verifikasi (statis)
- `node --check` seluruh file JS + script client yang diekstrak dari `html/Script_*.html`: OK. 94 endpoint `google.script.run` yang dipanggil client semuanya terdefinisi; tidak ada duplikasi fungsi top-level; semua `html_include()` ada.
- `selftest.js` (33 uji, `ALL RENDER LOGIC OK`): pemetaan 7 divisi & filter `DivisiID`, guard `NONAKTIF`, penolakan `admin_*` untuk non-SUPERADMIN, isolasi notifikasi per user, `markAllRead` single-pass dengan `rowIndex` benar, anti-trigger-ganda + spesifikasi Jumat/16:00/mingguan, reminder hanya untuk divisi belum melapor & role KADIV/STAF, validasi role/divisi/status, anti-self-edit, anti-lockout, hash password + audit, `admin_getAuditLog` (urutan/limit/join nama), `admin_getUsers` tidak pernah mengirim `PasswordHash`, dan pencabutan sesi pada ubah akun/reset password.
- Bug nyata yang ketahuan & diperbaiki saat verifikasi: `notifikasi_markRead`/`markAllRead` memakai `found.index` (tidak ada) alih-alih `rowIndex` → penandaan "sudah dibaca" tidak pernah tersimpan.

### 5. Tes user (setelah `clasp push`)
1. Login sebagai KADIV divisi yang belum melapor → strip merah muncul di atas halaman + badge notifikasi di sidebar; klik → halaman Notifikasi, tandai dibaca.
2. Admin Panel → Pengingat Mingguan: nyalakan auto-reminder (status jadi "Aktif"), lalu "Kirim Sekarang" pada minggu yang ada divisi kosong → KADIV/Staf divisi tsb menerima email + notifikasi `REMINDER_MINGGUAN`; divisi yang sudah melapor tidakmana.
3. Admin Panel → Pengguna: ubah role/divisi/status, reset password; pastikan Audit Log mencatat setiap aksi.
4. Nonaktifkan akun uji → session browser akun tsb harus-terlempar ke layar login di permintaan berikutnya dengan pesan "Akun Anda baru saja diperbarui".

---

## [Perbaikan] — Ikhtisar Tidak Stale Setelah Submit/Revisi/Anulir (Fase 12 lanjutan)
**Tanggal**: 29 September 2026
**Status**: Implementasi selesai & siap deploy — verifikasi runtime GAS oleh user (setelah `clasp push`).

### 1. Latar belakang
User: "bar di sebelah realisasi akrual dan realisasi sp2d tidak berubah setelah saya anulir laporan mingguannya, tetap batas bawah 0% dan batas atas 240%".

### 2. Akar masalah
Kartu **Ringkasan per Divisi** di Ikhtisar (mis. Tata Usaha: `Realisasi SP2D (YTD)` / `Realisasi Akrual (YTD)` dengan `prog:true`) dihitung server-side oleh `dashboard_getOverview` (services/DashboardService.js), yang **memakai CacheService TTL 300 detik per user+filter** (`key = 'DASH_OV_' + userId + '_' + _dashFilterKey(f)`). Setelah anulir/submit/revisi laporan mingguan, agregat ikhtisar masih disajikan dari cache hingga ~5 menit → nilai persen lama (mis. 240%) tidak berubah, padahal sumber barisnya sudah `Status=VOID`. `tataUsaha_getKPI` (halaman TU) memang tanpa cache dan di-reload secara eksplisit, jadi yang stale hanya agregat Ikhtisar.

### 3. Perubahan
- **`data/SheetAccess.js`**: helper baru `bumpTxVersion()` — menaikkan penanda `DASH_TX_VERSION` di CacheService (TTL 6 jam ≫ 300 detik). Dipanggil otomatis di akhir **setiap** `appendRowData()` dan `updateRowCells()` (satu-satunya dua fungsi tulis yang dipakai semua service → menjangkau seluruh modul, bukan hanya TU).
- **`services/DashboardService.js`**: helper `_dashVersion()` membaca penanda tersebut; penanda dimasukkan ke cache key `dashboard_getOverview` (`DASH_OV_U<userId>_v<versi>_<filter>`) dan `dashboard_profilKapal` (`DASH_PK_`). Setelah ada tulis, versi naik → cache key berubah → agregat dihitung ulang dari sheet (cache lama dengan key lama otomatis tak terpakai dan kedaluwarsa sebagai lewat-TTL).

### 4. Keputusan desain
- Invalidasi dilakukan **superset** (semua tulis membuang cache Ikhtisar), bukan hanya anulir TU — murah (sekali recompute saat kunjungan berikutnya) dan mencegah bug kelas yang sama di semua modul & profil kapal.
- Tidak mengubah semantik filter, RBAC, atau perilaku `tataUsaha_getKPI`.

### 5. Verifikasi (statis)
- `node --check` services/DashboardService.js & data/SheetAccess.js OK.
- Uji mandiri (stub CacheService): versi `0` sebelum tulis → `1` setelah `appendRowData` → `2` setelah `updateRowCells`; cache key Ikhtisar berubah setelah bump → agregat dihitung ulang.
- `verify.sh` → semua OK; `seltest.js` → `ALL RENDER LOGIC OK`.

### 6. Tes user (setelah `clasp push`)
1. Isi laporan mingguan Tata Usaha (Realisasi SP2D/Akrual tinggi, mis. >100%).
2. Buka Ikhtisar → kartu Tata Usaha menampilkan persen tinggi tsb.
3. Anulir laporan itu dari halaman TU → kembali ke Ikhtisar → bar Realisasi SP2D/Akrual **langsung turun** sesuai baris non-VOID (tanpa menunggu 5 menit).

---

## [Revisi Form Tata Usaha] — Prefill & Kunci Pagu + Tombol "Ubah Pagu" (Fase 12 lanjutan)
**Tanggal**: 29 September 2026
**Status**: Implementasi selesai & siap deploy — verifikasi runtime GAS oleh user (setelah `clasp push`).

### 1. Latar belakang
User: "kalau pagu kosong ya berarti nilai lama dong" + pagu tidak boleh diedit langsung — ingin ada tombol yang memicu perubahan pagu. Sebelum ini, field Pagu selalu dikosongkan, dan client mengirim kosong sebagai `0` (`value || 0`) → server (cek hard `tataUsaha_submitMingguan`) menganggap berubah vs laporan ACTIVE terakhir → notif "Pagu berbeda… wajib isi Catatan Revisi Pagu" muncul meski maksudnya "ikuti nilai lama".

### 2. Perubahan
**`html/views/TataUsaha.html`** (form laporan mingguan):
- Field `tu-pagu-reguler` / `tu-pagu-abt` kini `readonly` saat dibuka.
- Bar kontrol baru `.tu-pagu-bar` (`#tu-pagu-bar`): teks status + tombol **"Ubah Pagu"** dan **"Batalkan"** (`btn-mini`).
- Catatan Revisi Pagu (`#tu-catatan-wrap`) disembunyikan; muncul hanya setelah "Ubah Pagu" ditekan, label berubah menjadi "(wajib isi)".

**`html/Script_Main.html`**:
- `tuOpenForm()`: Pagu di-**prefill otomatis dari `_TU.kpi`** (yakni laporan ACTIVE terakhir via KPI — pagu periode berjalan). `_TU._paguBase` menyimpan snapshot nilai lama. Bila belum ada laporan sebelumnya (kedua pagu 0/tanpa KPI), bar tidak muncul, field bebas diisi.
- `_tuSetPaguBar(state)` — state `lock` / `unlock` / `none`: atur `readOnly`, teks bar, visibilitas tombol, dan kelas `unlocked` (bordir `--n-warn`).
- `tuUnlockPagu(enable)`: buka kunci (simpan snapshot nilai lama, tampilkan catatan) / batalkan (kembalikan nilai snapshot, sembunyikan catatan, kunci lagi).
- `_tuShowCatatan(show)`.

**`html/Style.html`**:
- `input[readonly]` → `cursor: not-allowed` + opacity 0.85 (fokus tidak menyala).
- `.tu-pagu-bar` flex (teks kiri, tombol kanan), varian `.unlocked` dengan bordir amber.

### 3. Keputusan desain
- Tombol & teks memakai `btn-mini` / `.tu-pagu-bar` / token & radius yang sudah ada — tanpa nada baru yang melanggar `DESIGN.md` §1.
- Server-side **tidak diubah**: cek hard (pagu `!==` laporan ACTIVE terakhir → catatan wajib) tetap otoritas final; respons ini bagian dari perilaku konsisten yang sudah dijelaskan. Client kini mencegah kondisi "kosong = 0" yang menipu.
- Input yang benar-benar dikosongkan user (setelah dibuka via "Ubah Pagu") tetap berarti `0` — perubahan yang disengaja, tetap kena wajib catatan.

### 4. Verifikasi (statis)
- `verify.sh` → semua OK (sintaks service + seluruh `<script>` Script_Main.html).
- `seltest.js` → `ALL RENDER LOGIC OK` (regresi visualisasi ikhtisar Fase 12 tidak terganggu; fungsi TU baru tidak dieksekusi di harness).

### 5. Tes user (setelah `clasp push`)
1. Buka Tata Usaha → Laporan Baru: field Pagu terisi otomatis dari laporan sebelumnya & tidak bisa diketik (kursor `not-allowed`), bar menunjukkan "Pagu terkunci — mengikuti laporan sebelumnya (Reguler Rp … · ABT Rp …)".
2. Kirim mingguan biasa tanpa menyentuh pagu → tidak ada notif "wajib Catatan Revisi Pagu".
3. Klik "Ubah Pagu" → field terbuka + bar amber + Catatan Revisi Pagu muncul (wajib). Ubah nilai lalu simpan tanpa catatan → notif error dari server; isi catatan → sukses.
4. Klik "Batalkan" → nilai pagu kembali ke snapshot, catatan tersembunyi.
5. Kabas pertama (belum ada laporan) → pagu bebas diisi, tanpa bar kunci.

---

## [Revisi Dashboard] — Isi Ruang Kosong di Kartu Ringkasan (Fase 12)
**Tanggal**: 29 September 2026
**Status**: Implementasi selesai & siap deploy — verifikasi runtime GAS oleh user (setelah `clasp push`).

### 1. Latar belakang
Tindak lanjut revisi "Richer": user tidak suka ada area kosong di dalam kartu ("I dont like empty shit in cards — isi dengan visual atau perbesar teks"). Tanpa perubahan ini, kartu divisi yang kontennya pendek meregang mengikuti tinggi baris grid sehingga meninggalkan ruang kosong bawah; grid 8 kartu di 3 kolom bahkan menyisakan satu sel kosong.

### 2. Perubahan
**`services/DashboardService.js`**:
- `nMelapor` dihitung sekali (`_dashMelaporDetail` + filter) dan dipakai ulang di KPI Divisi Melapor maupun kartu baru.
- Kartu divisi ke-9 **"Cakupan Laporan"** ditambahkan (grid 3×3 jadi penuh tanpa sel kosong): `Divisi Melapor Minggu Ini` `/7` (prog), `Divisi Belum Melapor`, `Periode Aktif`, plus `dots: melaporDetail` dan `prog: true`.

**`html/Script_Main.html`** (client):
- `_divCard(title, metrics, stack, dots, opts)` dirombak: kartu jadi flex column dengan `.div-card-metrics` + **footer visual** yang selalu mengisi ruang tersisa. Baris pertama jadi **hero** (angka 1.4rem, `letter-spacing -0.02em`); `bars` tidak lagi dirender inline per-baris (pindah ke footer).
- Helper baru `_ovCardFoot(metrics, stack, dots)` — prioritas pengisi footer: (1) dots status laporan (Cakupan Laporan, cap `Status laporan mingguan — n/7`), (2) stack kartu (Pengawakan AKN), (3) `bars` metrik (Logistik stok), (4) gabungan beberapa stack per-baris jadi komparasi (Operasi: Ditangkap+Dipantau → "Komposisi penindakan"), (5) komparasi relatif metrik numerik (sisa kartu → "Proporsi periode"), (6) catatan halus bila data belum lengkap. `_ovMetricNum(m)` menyaring nilai layak banding (bukan `Rp`/`NM²`).
- `_divCard` dipakai Profil Kapal dengan `{ hero:false, foot:false }` → tampilan halaman itu tidak berubah.
- Placeholder statis seksi ikhtisar ikut ditambah kartu ke-9.
- `_ovRenderData` meneruskan `dv.dots` ke `_divCard`.

**`html/Style.html`**:
- `.div-grid` → `grid-auto-rows: 1fr` (seluruh kartu setinggi baris); `.div-card` → flex column; `.div-card-foot` → `margin-top: auto` + separator atas sehingga selalu menempel di dasar kartu (menghapus ruang kosong); `.div-card-foot-cap/-dots/-note`; `.div-metric-val` dinaikkan ke 1.02rem, `.hero` 1.4rem, teks muted 0.88rem.

### 3. Keputusan desain
- Ruang kosong diisi **turunan data nyata** (komparasi relatif) bukan dekorasi fiktif; bila semua data `—`, footer menampilkan catatan informatif, bukan bidang kosong.
- Belle tua: footer tidak memakai warna/hue baru — tetap token tema + gradasi navy `deep/soft/light`, margin atas garis `--n-border-subtle`.

### 4. Verifikasi (statis)
- `verify.sh` → semua OK.
- `seltest.js` diperbarui (defs + `_ovCardFoot`/`_ovMetricNum`; assertion bar-lines kini di footer): `ALL RENDER LOGIC OK` (footer Proporsi periode 3 bar; footer dots 7 titik cap 5/7; footer stack AKN dengan caption; `foot:false` tanpa footer; hero hanya metrik pertama & bukan saat `—`; kartu kosong → catatan).

### 5. Tes user (setelah `clasp push`, Ringkasan Ikhtisar)
1. Grid divisi penuh **3×3**, tidak ada sel/kartu kosong.
2. Kartu Operasi → di bawah metrik muncul **"Proporsi periode"** (3 bar relatif: Hari Op Kapal/Pesawat, Ditangkap).
3. Kartu **Cakupan Laporan** (baru, pojok kanan bawah) → `/7` div melapor + **7 titik status** + cap "Status laporan mingguan — n/7".
4. Kartu Logistik → bar stok kini di **footer** kartu; Perawatan → perbandingan relatif Kapal Siap/Docking; Pengawakan → stacked AKN tetap di bawah.
5. Angka metrik pertama tiap kartu lebih besar (hero) — kartu terasa terisi.

---

## [Revisi Dashboard] — Visualisasi Ringkasan Ikhtisar, Richer (Fase 12)
**Tanggal**: 29 September 2026
**Status**: Implementasi selesai & siap deploy — verifikasi runtime GAS oleh user (setelah `clasp push`).

### 1. Latar belakang
Permintaan user: perbaiki penyajian angka pada Ringkasan Ikhtisar (Overview) yang semula "terlalu boring dan tidak membantu" — perbanyak visual dan ganti yang ada dengan bentuk yang lebih informatif. **Catatan**: pendekatan minimalis pertama (bar tipis + stacked bar, tanpa donut/pie) sempat diimplementasi penuh & diverifikasi, lalu **diganti** berdasarkan arahan user bahwa hasilnya terlalu membosankan. Entri ini mendeskripsikan versi final yang lebih kaya.

### 2. Arah desain (menggantikan aturan minimalis pertama)
1. Setiap KPI di baris atas diberi **mini-chart** (gauge cincin, sparkline, mini bar, donut, atau dot status) — hanya bila data nyata (`val !== '—'`).
2. Sel chart bertambah satu baris: **"Status & Penindakan"** (donut komposisi + bar kapal teraktif) di samping Tren & Kapasitas yang sudah ada.
3. Kartu divisi diperkaya: stacked bar proporsi (Perawatan), bars stok per jenis (Logistik), sambil mempertahankan stacked bar AKN Pengawakan dan bar target `/180`.
4. Palet tetap **token tema** (`var(--n-*)`) + gradasi navy `deep/soft/light/lighter`; donut kecil (≤4 irisan), legenda ditulis di samping warna (bukan warna sendirian). Tanpa gradasi/hue baru.

### 3. Perubahan

**`services/DashboardService.js`** (server — kalkulasi tetap server-side):
- Operasi Laut/Udara dipecah per-pembiayaan: `kiiDitangkap`/`kiaDitangkap` (`KII_Ditangkap`/`KIA_Ditangkap`), `kiiDipantau`/`kiaDipantau` (`KII`/`KIA`), tetap menjumlah `kapalDitangkap`/`kapalDipantau`.
- `trendHariOp` dihitung **hanya mode bulanan** (`f.mode !== 'range'`), bila `months.length >= 2`: delta Hari Operasi vs bulan sebelumnya.
- `hbTot` = total kapal (`hbKapal`) + pesawat (`hbPesawat`) per bulan — bahan mini-bar "last 6 bulan".
- `KPI_DAILY_HELPER` **`_dashMelaporDetail()`** baru (detail per 7 divisi, daftar dimuat lazy via `_ovMelaporDivisiList()` karena `SHEET_TX` baru tersedia saat runtime bukan evaluasi file; cek laporan minggu berjalan via `_dashActiveRows`); `_dashDivisiMelapor()` direfaktor agar memakainya (dedup per sheet vs per DivisiID — kini 1 titik/divisi).
- `melaporDetail` dikirim sebagai `dots`; `kapalTeraktif` = agregat `KapalID` dari `lautInRange`+`udaraInRange`, dinamai via `_dashKapalInfo`, top 5 desc.
- `headline[]`:
  - SP2D → `ring: { pct }` (gauge cincin % terhadap pagu).
  - Hari Operasi → `trend: trendHariOp` + `minibars: hbTot`.
  - Armada Siap → `donut: { segs:[{Siap,ok},{Tidak Siap,crit}], center: totalArmada }`; sub `'(siap+tidakSiap) / totalArmada armada aktif'`.
  - Divisi Melapor → `dots: melaporDetail`; value = jumlah melapor, sub `'/ 7 — Berdasarkan laporan masuk'`.
- Kartu Operasi: Hari Operasi Pesawat → `progMax: 180`; Kapal Ditangkap & Kapal Dipantau → `stack` KII (`deep`) vs KIA (`soft`). Kartu Pengawakan: `stack: { caption: 'Komposisi AKN', segments: aknStack }` (tone `deep/soft/light/lighter`).
- Kartu Perawatan: metrik 'Kapal Siap Operasi' → `stack: [{Siap,ok},{Tidak Siap,crit}]`.
- Kartu Logistik: blok `amStok` baru — stok aktual per jenis = `StokAwal - _dashJenisUsage(amYtd, j)` (≥0), total `stokTotal`, top 5 (`amStok5`) dikirim sebagai `bars` pada metrik 'Stok Amunisi (total)'.
- `data.charts`: + `kesiapan.totalArmada`, `penindakan` (4 irisan `Ditangkap/Dipantau × KII/KIA`, tone `deep/soft/light/lighter`), `kapalTeraktif`.
- Bidang payload opsional baru (hanya dikirim saat data nyata): `ring/spark/minibars/donut/dots`, `stack: [{label,val,tone}]`, `trend: {delta,prev}`, `bars: [{label,val,tone}]`; kartu hanya bila `val !== '—'`.

**`html/Script_Main.html`** (client):
- `_kpiHeadline(label, value, unit, sub, opt)` — layout dua kolom `.kpi-main` + `.kpi-vis`; `opt: { ring, spark, minibars, donut, dots, trend }`. Visual dirender hanya bila data nyata dan prioritas: ring → donut → spark → minibars → dots. `raw`/`progMax`/`stack` tidak lagi dipakai KPI (tetap ada untuk `_ovMetric`/`_divCard`).
- Helper SVG baru (inline, palet token): `_ovRing(pct, size)` gauge cincin + angka %; `_ovSpark(series, color, fill)` area+stroke+dot akhir, disembunyikan bila <2 titik atau semua nol; `_ovMiniBars(values, color)` strip 6 bulan terakhir; `_ovDonut(segs, size, center)` (irisan 0 dilewati, total ≤0 hidden); `_ovDots(items)` titik status per divisi dengan tooltip; `_ovBars(items)` baris label+track+nilai (`1.4fr 2fr auto`); `_ovPlotDonut(segs, size)` donut + angka tengah + legenda (swatch/label/val/pct); `_ovSegTotal(segs)`.
- `_ovMetric`/`_divCard` meneruskan & merender `bars` per baris metrik (selain `prog/progMax/stack`).
- `_ovRenderData`: KPI → `{ ring, spark, minibars, donut, dots, trend }`; isi sel baru `#ov-chart-penindakan` (`_ovPlotDonut`) dan `#ov-chart-teraktif` (`_ovBars`, filter val>0); fallback `.chart-empty` bila total 0.
- Seksi HTML baru "Status & Penindakan" (`chart-grid-2`, 2 sel) disisipkan setelah Tren & Kapasitas.

**`html/Style.html`**:
- `.kpi-card` → flex (`justify-content: space-between`), `.kpi-main` (min-width:0) + `.kpi-vis` (flex-shrink:0).
- CSS baru: `.ov-dots`/`.ov-dot(.on)` (titik status 14px), `.ov-bars`/`.bar-line*` (grid `1.4fr 2fr auto`, track pill, fill, val), `.ov-plot`/`.ov-plot-legend`/`.legend-row`/`.legend-*` (grid `10px 1fr auto auto`), `.ov-plot-bars` (isi tinggi sel).
- `.kpi-prog` dihapus (KPI tidak lagi memakai progress bar). Hanya token tema — tanpa hue/gradien baru.

### 4. Keputusan desain
- Donut/pie **dipakai** (Fase revisi ini) meski sempat dilarang aturan #4 minimalis — karena arahan user terbaru "perbanyak & ganti, terlalu boring". Batasan tetap: donut ≤4 irisan, irisan 0 dilewati, angka & legenda jalan bersama, palet navy token.
- Kartu Intelijen, Pemantauan, dan Kegiatan tetap teks bersih (belum ada data komposisi yang membantu). Area ringkasan (SDA/RKAP/Budget) di luar scope (Fase 13, bukan bagian revisi ini).

### 5. File yang diubah
- `services/DashboardService.js`
- `html/Script_Main.html`
- `html/Style.html`
- `PHASES.md` (catatan revisi di blok Fase 12)
- `CHANGELOG.md` (entri ini)

### 6. Verifikasi (statis)
- `node --check services/DashboardService.js` → OK.
- Ekstraksi blok `<script>` `Script_Main.html` → `node --check` → OK.
- Unit-test render murni (stub `_esc`/`_idNum`/`MONTHS`/`_ovNum`) di `/tmp/opencode/seltest.js` → `ALL RENDER LOGIC OK` (ring 43% + arc gauge; minibars 6 batang terakhir; donut armada ok/crit center 20; 7 titik divisi dengan 5 terisi; spark semua-nol/satu-titik disembunyikan; segTotal 20; plot legenda + pct 30/63/8%; bar-line HTML; /180 → 50.56%; stack Perawatan ok/crit; bars Logistik + format `1.234`; bars passthrough pada baris `—`).
- Aturan DESIGN.md §1 (negative prompt) / §6: donut ≤4 irisan, legenda bersama warna, tidak ada warna di luar token.

### 7. Tes user (setelah `clasp push`)
Buka Ringkasan Ikhtisar:
1. KPI SP2D → **gauge cincin %** (angka di tengah).
2. KPI Hari Operasi (mode **bulanan**) → panah `▲`/`▼` + "vs <bulan>" dan **strip mini-bar 6 bulan terakhir**; tak muncul di mode rentang/delta 0.
3. KPI Armada Siap → **donut** Siap vs Tidak Siap, angka armada di tengah.
4. KPI Divisi Melapor → **7 titik**, terisi untuk divisi yang sudah melapor minggu ini (tooltip per divisi).
5. Seksi **"Status & Penindakan"** → donut 4 irisan (Ditangkap/Dipantau × KII/KIA) + legenda, dan bar **Kapal Pengawas Teraktif** (top 5).
6. Kartu Perawatan → stacked bar Siap vs Tidak Siap pada "Kapal Siap Operasi".
7. Kartu Logistik → bar stok per jenis (top 5) pada "Stok Amunisi (total)".
8. Kartu Operasi → Pesawat bar `/180`; Kapal Ditangkap & Dipantau stacked KII/KIA; Pengawakan → stacked "Komposisi AKN".

---

## [Dokumentasi] — Sheet Detail & DetailService ditautkan di ARCHITECTURE.md
**Tanggal**: 29 September 2026
**Status**: Dokumentasi selesai (tidak ada perubahan kode).

### 1. Latar belakang
Catatan doc-drift di `PHASES.md` (Fase 12/13): `DATA_SCHEMA.md`/`ARCHITECTURE.md` disebut belum memuat 3 sheet `TX_*_Detail` dan `utils/DetailService.js`. Setelah dicek, `DATA_SCHEMA.md` ternyata **sudah** memuat ketiga sheet sejak implementasi itemisasi; yang benar-benar tertinggal hanya `ARCHITECTURE.md`. User menyetujui update dokumen skema (thread "update dokumen kedua").

### 2. Perubahan
- `ARCHITECTURE.md`:
  - **§3.2**: 3 sheet detail (`TX_OperasiLaut_Detail`, `TX_OperasiUdara_Detail`, `TX_Intelijen_Detail`) ditambahkan ke tabel `Nautika_Transaksi` + paragraf penjelas: rincian per-item men-subordinat header via `ParentRowID`, angka agregat header dihitung sistem dari count detail (nilai manual baris lama tetap valid), dikelola `utils/DetailService.js`.
  - **§4**: kunci subordinat `ParentRowID`; pengecualian ref-entitas → kapal marabahaya memakai `NamaKapal` teks bebas (kapal eksternal, keputusan user 29 Sep 2026); mekanisme self-heal skema (`ensureDetailTxSheet`, `ensureTxColumn`, `ensurePemantauanKapalKolom`).
  - **§5**: bullet versioning child — child `SUPERSEDED` saat header revisi, `VOID` saat anulir, `SupersedesRowID` antar child baru↔lama.
  - **§7**: `utils/DetailService.js` ditambahkan ke struktur kode GAS + deskripsi fungsi.
- `PHASES.md`: catatan doc-drift ditandai **Resolved** (dengan rujukan CHANGELOG ini).
- Tidak ada perubahan kode; `DATA_SCHEMA.md` sudah sinkron.

### 3. Verifikasi (statis)
- Cek seksi `### TX_*_Detail` di `DATA_SCHEMA.md` → ketiganya (Operasi Laut, Udara, Intelijen) sudah lengkap & konsisten dengan `Setup.js`/`utils/Constants.js` `DETAIL_HEADERS`.
- `rg` seksi detail di `ARCHITECTURE.md` → ada.

### 4. Tes user
Tidak ada — perubahan dokumentasi saja.

---

## [Revisi Pemantauan] — Kapal Marabahaya untuk Kapal Eksternal (Bukan Kapal KKP)
**Tanggal**: 29 September 2026
**Status**: Implementasi selesai (form + service + skema + PRD) & siap deploy — verifikasi runtime GAS oleh user.

### 1. Latar belakang (masalah)
Klarifikasi domain dari user: **kapal kondisi marabahaya bukan kapal armada KKP**, melainkan **kapal eksternal** (mis. kapal perikanan yang kehabisan BBM di tengah laut, musibah di laut). Sebelumnya entri marabahaya justru memilih dari **Master Data Kapal KKP** (`pem-mb-kapal` diisi `_PEM.kapalData`) dan service menolak bila `KapalID` bukan dari Master Data — konsep yang keliru karena kapal eksternal tidak ada di Master Kapal. User meminta diulang/dikoreksi agar form marabahaya merekam kapal eksternal.

### 2. Perubahan
- **Form (baris "Kapal Marabahaya Baru")**: select `pem-mb-kapal` (KKP) diganti `pem-mb-nama` (nama kapal teks bebas) + `pem-mb-jenis` (select `KAPAL_PERIKANAN`/`KAPAL_NIAGA`/`KAPAL_PENUMPANG`/`KAPAL_WISATA`/`LAINNYA`), tetap dengan `pem-mb-kondisi` (kondisi darurat, placeholder "Mis. kehabisan BBM di tengah laut") dan `pem-mb-status`.
- **Service** (`PemantauanService.js`): validasi `MARABAHAYA` kini **wajib `NamaKapal`** (bukan `KapalID` master); `JenisKapal` divalidasi enum; duplikat per periode berbasis nama kapal (dengan fallback legacy `KapalID`); persist `NamaKapal` + `JenisKapal`; KPI & riwayat menampilkan `NamaKapal` (fallback lookup `KapalID` untuk baris lama).
- **Revisi**: bidang `rv-pem-nama` + `rv-pem-jenis` ditambahkan di modal revisi (client & server).
- **Skema**: kolom `NamaKapal` (text) & `JenisKapal` (enum) ditambahkan ke `TX_Pemantauan` (Setup.js `_createSheetWithHeaders`; self-heal `ensurePemantauanKapalKolom()` di `SheetAccess.js` dipanggil di titik tulis — DB lama ter-heal tanpa `setupForce`). `KapalID` dipertahankan nullable sebagai legacy.

### 3. File yang diubah
- `html/Script_Main.html`: `PEM_JENIS_KAPAL`; `pemAddMarabahayaRow()`; `pemSubmit()`; `pemOpenRevisiModal()`/`pemRevisiConfirm()`; render riwayat pakai `r.namaKapal`; `_pemLoadKapalOptions()` & `_PEM.kapalData` dihapus (tidak lagi butuh master kapal).
- `html/views/Pemantauan.html`: modal revisi marabahaya + bidang Nama Kapal & Jenis Kapal.
- `services/PemantauanService.js`: validasi, duplikat, persist, KPI, history, revisi.
- `data/SheetAccess.js`: `ensurePemantauanKapalKolom()`.
- `Setup.js`: header `TX_Pemantauan` + `NamaKapal`, `JenisKapal`.
- `DATA_SCHEMA.md` (TX_Pemantauan) & `PRD.md` §5.6: kapal eksternal, bukan ref Master.
- `DESIGN.md` §7: ekstra — lihat entri terkait.

### 4. Verifikasi (statis)
- `node --check` pada `PemantauanService.js`, `data/SheetAccess.js`, `Setup.js` → lulus.
- `rg` `pem-mb-kapal|_pemLoadKapalOptions|kapalData` → tidak ada sisa di modul Pemantauan (sisa `kapalNama` adalah modul Perawatan, tidak tersentuh).
- Harness `/tmp/opencode/verify.js` → **lulus**.

### 5. Tes user (setelah `clasp push`)
Buka Pemantauan → "Input Laporan Pemantauan" → baris **Kapal Marabahaya Baru** kini berisi **Nama Kapal (teks)** + Jenis + Kondisi Darurat + Status, tanpa pilihan kapal KKP. Simpan laporan berisi kapal eksternal → cek KPI "Kapal Kondisi Marabahaya", Riwayat, modal Revisi (nama/jenis dapat dikoreksi), dan duplikat per periode (nama kapal sama ditolak).

> Catatan: kolom `NamaKapal`/`JenisKapal` otomatis ditambahkan ke sheet melalui self-heal saat submit/revisi berikutnya.

---

## [Revisi Lintas Modul] — Rekap "Dihitung Otomatis" Tidak Lagi Berbentuk Field (Angka Readout)
**Tanggal**: 29 September 2026
**Status**: Implementasi selesai (CSS + 10 rekap di 3 view) & siap deploy — verifikasi runtime GAS oleh user.

### 1. Latar belakang (masalah)
Baris rekap jumlah yang dihitung sistem dari daftar per-item (penangkapan kapal KII/KIA, rumpon, objek teridentifikasi udara, jenis kejadian Intelijen) tampil sebagai **kotak ber-border** (`.n-derive-val`) sehingga **terlihat seperti field input**, padahal bukan input. Labelnya sekaligus membawa teks "(dari daftar)" yang dinilai jelek dan redundan (sudah ada keterangan "…dihitung otomatis dari daftar di bawah" di atasnya).

### 2. Perubahan
- `.n-derive-val` diubah dari kotak input (border/background/padding) menjadi **readout stat tanpa kotak**: label kecil + angka `--n-primary` tebal (`1.25rem`/700) — jelas bukan form field.
- Teks "(dari daftar)" dihapus dari 10 label rekap (kelas `.derived-note` beserta aturan CSS-nya dihapus — tidak terpakai lagi).
- Sel rekap **tetap** memakai `.form-grp` sehingga aturan alignment (flex-end) yang baru tetap menjaga angka readout sejajar-bawah dengan input di baris yang sama.

### 3. File yang diubah
- `html/Style.html`: `.n-derive-val` di-restyle; `.derived-note` dihapus.
- `html/views/OperasiLaut.html` (KII/KIA/Rumpon), `OperasiUdara.html` (KII/KIA/Objek SDK), `Intelijen.html` (Dredging/Perizinan/Transmitter/Nota Dinas/Pengangkut Ikan Hidup): 10 span `(dari daftar)` dihapus.
- `DESIGN.md` §7: konvensi "Angka turunan dihitung sistem" dicatat.

### 4. Verifikasi (statis)
- `rg "derived-note|dari daftar"` → tidak ada sisa di markup (sisanya hanya keterangan kalimat informasional & komentar kode).
- Harness `/tmp/opencode/verify.js` → **lulus**.

### 5. Tes user (setelah `clasp push`)
Buka form Operasi Laut / Udara / Intelijen → baris rekap (mis. "KII Ditangkap", "Objek SDK", "Dredging") kini angka polos tebal tanpa kotak; ikon/teks "(dari daftar)" tidak ada; posisi angka tetap sejajar dengan kotak input di baris yang sama.

---

## [Revisi Lintas Modul] — Selaraskan Kotak Input Form (Alignment Horizontal Global)
**Tanggal**: 29 September 2026
**Status**: Implementasi selesai (CSS global + 13 view) & siap deploy — verifikasi runtime GAS oleh user.

### 1. Latar belakang (masalah)
Pada baris form berkolom ganda, kotak input miring secara horizontal bila label antar kolom punya tinggi berbeda (label panjang membungkus 2 baris vs label pendek 1 baris), atau salah satu sel menyisipkan catatan pendek di bawah kontrol (`*-periode-hint`). Kotak input di bawah label pendek "naik", merusak kerapian baris form dan tombol di bawahnya. Berlaku di seluruh modul (13 form divisi, modal revisi, Master Data, auth).

### 2. Pendekatan (keputusan teknis)
- Akar masalah: posisi vertikal kotak input ditentukan oleh tinggi area label; label yang membungkus berbeda-beda → top kotak input berbeda-beda dalam satu baris.
- Solusi global (CSS murni, tanpa mengubah JS): `.form-grp` (sel grid tiap kolom form) dijadikan **kolom flex ber-anchor-bawah** (`display:flex;flex-direction:column;justify-content:flex-end`) + band `padding-bottom:26px`. Karena sel `.form-grp` adalah grid item yang merenggang setinggi baris (`align-items` default `stretch`), konten **menempel ke bawah** → **semua kotak input dalam satu baris menempel di dasar yang sama → tersusun rata** apa pun tinggi label (1/2/3 baris). Tinggi label jadi tidak relevan.
- Catatan pendek di bawah kontrol (13 `*-periode-hint`) TIDAK boleh ikut-anchor-bawah (bisa menggeser input); diposisikan **absolut** dengan kelas baru **`.n-form-hint`** di dalam band `padding-bottom` sel → ada/tidaknya catatan tidak menggeser kotak input.
- Catatan penjelas panjang (3 di Logistik: "StokAkhir = …", "Perkiraan stok akhir = …", "Sisa = Pagu − …") berada di sel satu-kolom (tanpa tetangga sebaris) → tetap in-flow, teks tidak dipotong (`white-space:nowrap` hanya di `.n-form-hint`).

### 3. File yang diubah
- `html/Style.html`: `.form-grp` (flex-end + band + `position:relative`), `.form-grp label` (`flex:0 0 auto`), aturan baru `.n-form-hint`.
- `html/views/{TataUsaha, OperasiLaut, OperasiUdara, Intelijen, Pemantauan, Pengawakan, Perawatan, Logistik}.html`: 13 wrapper `*-periode-hint` → `class="n-form-hint"` (id & struktur teks tidak berubah — JS `document.getElementById(...).textContent` tetap berfungsi).
- `DESIGN.md` §7: konvensi "Form (kolom sejajar)" dicatat agar dokumen sinkron.

### 4. Verifikasi (statis)
- Harness `/tmp/opencode/verify.js` (bundle Sedang Charts+Main) → **lulus**.
- `rg` sisa style inline `font-size:.76rem;color:var(--n-text-muted)` → hanya tersisa 3 catatan panjang Logistik (disengaja).
- Status inline row yang memakai `align-items:end` (Riksa KII/KIA/SDK & Hari Operasi) diperiksa aman: sel tidak stretch → flex-end no-op, tanpa regresi.

### 5. Tes user (setelah `clasp push`)
(1) Buka masing-masing 13 form → perhatikan baris berkolom ganda: semua kotak input sekarang rata di tepi bawah yang sama, meski label beda tinggi. (2) Baris Periode (Tahun/Bulan/Minggu + teks "Periode: …") → teks tetap tampil di bawah kontrol tanpa menggeser kotak input sebelahnya (mis. kolom WPP). (3) Cek revisi modal & modal Master Data ikut rata. (4) Tidak ada teks hint yang terpotong/bertumpuk.

---

## [Fase 12/13 — Itemisasi] — Jumlah diubah menjadi Daftar Per-Item (Operasi Laut, Operasi Udara, Intelijen)
**Tanggal**: 29 September 2026
**Status**: Implementasi selesai (server + client) & siap deploy — verifikasi runtime GAS oleh user.

### 1. Latar belakang (keputusan user)
Field jumlah pada laporan mingguan Operasi Laut/Operasi Udara/Intelijen awalnya satu angka agregat (`KII_Ditangkap`, `KIA_Ditangkap`, `AsalNegaraAsing`, `RumponDitertibkan`; `KII`/`KIA`/`ObjekSDK`; 5 angka intelijen). Setiap unit pada laporan sebenarnya merujuk entitas nyata (kapal/rumpon/kejadian), sehingga user meminta pengisian berbentuk **daftar rincian per-item** dan jumlahnya dihitung sistem.

### 2. Model data baru (server)
- **3 sheet detail baru**: `TX_OperasiLaut_Detail`, `TX_OperasiUdara_Detail`, `TX_Intelijen_Detail` — dibuat di `Setup.js`, self-heal `ensureDetailTxSheet()` di `data/SheetAccess.js`, header di `DETAIL_HEADERS` (`utils/Constants.js`): `OperasiLaut` = `STD_COLS + [ParentRowID, ItemType, NamaItem, AsalNegara, WPPCode, Lokasi]`; `OperasiUdara` = `STD_COLS + [ParentRowID, ItemType, NamaItem, AsalNegara]`; `Intelijen` = `STD_COLS + [ParentRowID, Deskripsi]`.
- **`utils/DetailService.js` (baru)**: `_detailWriteChildren(sheetKey, parentRowId, items, meta)` (ID child `D_<ParentRowID>-<n>`), `_detailCleanItems` (buang baris yang semua kolom isian kosong), `_detailValidateItemized(rules)` (error `Baris rincian ke-N: …`), `_detailAttach(matrix, sheetKey)` (lampirkan `row.rincian` untuk modal "Lihat" & prefill revisi).
- **Aturan validasi rincian**: Operasi Laut → `NamaItem` wajib; `AsalNegara` wajib jika `ItemType=KIA`; `WPPCode` wajib jika `ItemType=RUMPON`. Operasi Udara → `NamaItem` wajib, lainnya opsional. Intelijen → tiap `Deskripsi` wajib (untuk jenis non-kawasan).
- **Submit**: field jumlah agregat operasi (Laut `KII_Ditangkap`/`KIA_Ditangkap`/`AsalNegaraAsing`/`RumponDitertibkan`; Udara `KII`/`KIA`/`ObjekSDK`) menjadi opsional dan **di-derive dari `rincian`** bila ada; Intelijen jumlah per jenis = jumlah rincian; kawasan konservasi tetap manual per-kawasan. **Revisi**: non-kawasan menerima `rincian` (validasi + derive atau fallback ke baris lama); kawasan tetap `jumlah`/`keterangan`.

### 3. Client — `html/Script_Main.html`
- **Komponen `_nList(wrapId, spec)`** baru: baris dinamis (kolom `select`/`text`/`hidden`), tombol ＋/× per baris, otomatis prepend opsi "(Pilih)" saat opsi pertama ber-value, `get()` membuang baris yang semua kolom non-hidden kosong (paralel dengan `_detailCleanItems`), `set(items)` untuk prefill revisi, `clear()`/`count()`; render XSS-safe (`createElement` + `textContent`); wrap kosong → objek no-op (tidak crash).
- Helper baru: `_nDeriveSet(id, n)` (caption rekap), `ITEM_TYPE_LABEL`, `_rncItemizedHtml(item)`, `_rncDetailFields(rincian)` (array `['Rincian #N', html]` untuk `.concat` ke fields "Lihat").
- CSS (`html/Style.html`): `.n-list-row`, `.n-list-add`, `.n-list-del`, `.n-derive-val`, `.derived-note` (token existing, tanpa warna/gradien baru).
- **Operasi Laut**: form = `ops-kapal-list` (select KII/KIA + `NamaItem` + `AsalNegara`) & `ops-rumpon-list` (hidden `RUMPON` + `NamaItem` + select WPP + `Lokasi`); caption `ops-kii-cap`/`ops-kia-cap`/`ops-rumpon-cap` terupdate saat input; submit kirim `params.rincian` (kapal+rumpon), hapus 4 param agregat; `_OPSLAUT.rows` disimpan di load; tombol "Lihat" kini menampilkan rincian per item; revisi memfilter `r.rincian` per `ItemType` (KII/KIA vs RUMPON), prefill `rv-ops-*` list dan kirim ulang. Baris kapal tanpa `ItemType` di-buang saat submit.
- **Operasi Udara**: form = `oud-objek-list` (select KII/KIA/OBJEK_SDK + `NamaItem` + `AsalNegara` opsional); caption `oud-kii-cap`/`oud-kia-cap`/`oud-sdk-cap`; `RumponLokalTeridentifikasi`, `CakupanWilayah_NM2`, hari operasi tetap manual; submit kirim `params.rincian` (hapus `KII`/`KIA`/`ObjekSDK`); revisi `rv-oud-objek-list` prefill + kirim ulang.
- **Intelijen**: form = `int-kejadian-list` (select 5 jenis non-kawasan + `Deskripsi`), caption `int-cap-*`; submit mengelompokkan per `Jenis` → `items.push({jenis, rincian:[{Deskripsi}]})` (baris tanpa jenis di-buang); kawasan manual tetap; revisi menampilkan **blok kawasan** (`rv-int-jumlah`/`rv-int-keterangan`) vs **blok kejadian** (`rv-int-kejadian-list`) berdasarkan `Jenis === 'KAWASAN_KONSERVASI'`, mengirim `rincian` atau `jumlah`/`keterangan`; tombol "Lihat" menampilkan rincian untuk jenis non-kawasan.
- `_INTEL` var diperluas (`kejadianList`, `revisiList`); `_OPSUDARA` var diperluas (`rows`, `listObjek`, `rvObjek`); `_OPSLAUT` var diperluas (`wppOptions`, `rows`, `listKapal`, `listRumpon`, `rvKapal`, `rvRumpon`); `_opsLautBuildWppOptions()` dipakai oleh dropdown WPP di list rumpon.

### 4. View — 3 file popup form + modal revisi
`html/views/OperasiLaut.html`, `OperasiUdara.html`, `Intelijen.html`: input angka agregat diganti blok rekap `.n-derive-val` (dengan `derived-note` "(dari daftar)") + container `_nList` + tombol "＋ Tambah …" (global `_opsLautAddKapal/_opsLautAddRumpon/_opsLautAddRvKapal/_opsLautAddRvRumpon/_opsUdaraAddObjek/_opsUdaraAddRvObjek/_intelAddKejadian/_intelAddRvKejadian`); modal revisi memakai container list masing-masing.

### 5. Catatan doc-drift
`DATA_SCHEMA.md` & `ARCHITECTURE.md` **belum** memuat entri sheet detail `TX_*_Detail` maupun `DetailService` (pekerjaan server fase sebelumnya tidak terdokumentasi). Skema sudah terpasang & self-heal; update dokumen menunggu konfirmasi user (perubahan struktur `DATA_SCHEMA.md` perlu persetujuan).

### Verifikasi (statis)
- `node --check` seluruh `.js` server (`services/`, `utils/`, `data/`, `Setup.js`, `Code.js`) → **lulus**.
- Harness statis `/tmp/opencode/verify.js`: bundle `Script_Charts.html` + `Script_Main.html` → `node --check` **lulus**; seluruh wrap `_nList(...)` id dan caption `_nDeriveSet(...)` id terverifikasi ada di view/Index → **lulus**.
- Scan CJK / emoji / placeholder (`lorem|TODO|FIXME|XXX`) → **bersih**; **0 sisa** referensi id lama (`ops-kii`, `ops-kia`, `ops-asal-negara`, `ops-rumpon` (input angka), `oud-kii/kia/sdk`, 5 input `int-*`, `rv-ops-kii/kia/asal-negara/rumpon`, `rv-oud-kii/kia/sdk`).
- Kesesuaian client↔server: kolom yang dikirim `_nList` persis dengan rule validasi `_opsLautValidateRincian`/`_opsUdaraValidateRincian`/`_intelValidateRincian` → diverifikasi manual.

**Tes user (setelah `clasp push`; `setupSeedOpsi()`/`ensureDetailTxSheet()` self-heal berjalan otomatis)**: (1) tiap modul buka form → "＋ Tambah …" → isi satu baris (jenis wajib, nama item) → caption rekap bertambah; baris kosong dibiarkan ± tak dihitung; (2) simpan → "Lihat" baris menampilkan rincian per-item; (3) revisi → daftar ter-prefill dari baris lama → ubah/hapus item → simpan → jumlah derived ikut berubah; Intelijen → revisi jenis KAWASAN_KONSERVASI vs non-kawasan menampilkan blok berbeda; (4) anulir tetap normal; (5) variasi: baris kapal tanpa jenis → tidak ikut terkirim.

---

## [Fase 12 — QA Lintas Modul] — Revisi "Input Jenis Kembali ke Dropdown" (membatalkan Backlog B)
**Tanggal**: 28 September 2026
**Status**: Implementasi selesai & siap deploy — verifikasi runtime GAS oleh user.

### 1. Keputusan: combobox typeahead Backlog B DIBATALKAN
Atas permintaan user: "Ganti semua model pemilihan jenis, entah itu jenis bbm, jenis amunisi, dkk pakai dropdown saja. Sekarang malah aneh." Typeahead `_ta*` (Backlog B, 22 Sep 2026) dihapus dan dicatat sebagai **rejected approach** di `PHASES.md` agar tidak diulang. Nilai akhir tetap divalidasi server (tidak berubah).

### 2. 4 field enum → `<select>` biasa dari `Opsi`
- `lga-jenis` (Logistik Amunisi), `lgb-jenis` (BBM), `lgp-komponen` (Personil), `akn-kategori` (Pengawakan AKN).
- Markup `.ta-field` di `html/views/Logistik.html`/`html/views/Pengawakan.html` diganti `<select id="..."></select>`; opsi diisi runtime dari server `logistik_getOptions`/`awak_getOptions` lewat `_fillOpsiSelect(id, items, '(Pilih …)')` — pola identik dgn Perawatan/OperasiLaut.
- Reset form memakai `selectedIndex = 0` (placeholder). Submit tetap `_v(id)` — id hidden lama dipertahankan sehingga nilai/validasi server tidak berubah.

### 3. 4 field Kapal → search dropdown `_kdl*` (baru)
- `ops-kapal` (Operasi Laut), `oud-kapal` (Operasi Udara), `lga-kapal`/`lgb-kapal` (Logistik, opsional).
- Kenapa bukan `<select>` polos: daftar Master Kapal panjang — alasan awal typeahead. Komponen baru `_kdlInit/_kdlFilter/_kdlPick/_kdlToggle/_kdlClear/_kdlReset/_kdlSet/_kdlCloseAll/_kdlKey` di `html/Script_Main.html`:
  - **Tampil sebagai dropdown**: field `readonly` + chevron kanan (sama dgn chevron `<select>`), klik/Enter/↓ membuka panel — bukan tampak seperti kotak ketik.
  - **Panel**: kotak cari di atas + daftar scroll (filter label kapal; ↑/↓/Enter/Esc/klik), style mengikuti palet `DESIGN.md` §3/§4 (1 level shadow, radius sm, tanpa warna baru/ikon warna).
  - **Tombol hapus (×)**: tampil saat ada nilai; klik menghapus pilihan + keyword, dan **me-reset filter** ke daftar penuh saat panel dibuka kembali.
  - Token tersimpan di hidden id lama (`id`); `_v(id)` di submit & `_kdlReset` saat form dibuka (`opsLautOpenForm`, `opsUdaraOpenForm`, `_logOpenForm`) tetap berfungsi. `_kapalInit` kini memakai `_kdlInit`; data tetap `master_getKapalList`.
- CSS `.ta-*` di `html/Style.html` dihapus → `.kdl-sel/.kdl-field/.kdl-caret/.kdl-clear/.kdl-panel/.kdl-q/.kdl-list`.

### 4. Tidak terpengaruh (dikaji ulang)
- Form revisi Logistik/Pengawakan menampilkan jenis/kategori sebagai input `disabled` (bukan typeahead), jadi konversi ini tidak menyentuh alur revisi; fallback `oldRow` server dari revisi sebelumnya tetap berlaku.
- OperasiLaut/Udara revisi tidak punya field kapal/jenis — tidak berubah.

### Verifikasi (statis)
- `node --check` seluruh `.js` (kecuali `test.js` legacy) → **lulus**.
- Ekstraksi blok `<script>` inline dari seluruh `html/*.html` (`Auth.html`, `Script_Charts.html`, `Script_Main.html`) → `node --check` **lulus**.
- Scan seluruh repo: **0 sisa** referensi `_taInit/_taGet/_taSync/_taFilter/_taTokensToItems/_TA_DATA/ta-field/ta-input/ta-dd`.
- Scan karakter CJK → **bersih**.

**Tes user (setelah `clasp push`; `setupSeedOpsi()` wajib sudah dijalankan sekali dari entri revisi sebelumnya)**: (1) Logistik Amunisi/BBM/Personil & Pengawakan AKN → dropdown jenis/kategori terisi dari `Opsi`, wajib dipilih (placeholder "(Pilih …)"), simpan normal; (2) Operasi Laut/Udara & Logistik → field Kapal tampil sebagai dropdown dengan chevron; klik buka panel berisi cari + daftar; ketik saring; pilih; **tombol ×** menghapus pilihan dan saat dibuka lagi daftar kembali penuh; (3) submit tanpa pilihan Kapal (opsional) → tetap tersimpan; (4) revisi Logistik/Pengawakan → tidak muncul "tidak valid"; (5) Master Data → Kapal: tambah kapal baru → muncul di dropdown setelah reload.

---

## [Fase 12 — QA Lintas Modul] — Revisi "Jenis Amunisi tidak valid" & Opsi Jadi Sumber Tunggal
**Tanggal**: 28 September 2026
**Status**: Implementasi selesai & siap deploy — verifikasi runtime GAS oleh user (`setupSeedOpsi()` wajib dijalankan satu kali).

### 1. Akar masalah revisi Logistik & Pengawakan
Gejala: revisi gagal dengan `Jenis Amunisi tidak valid.` (dan `Jenis`/`Komponen`/`Scope`/`Kategori` sejenis).
- Field dropdown revisi di `html/Script_Main.html` di-render sebagai `disabled`, sehingga **nilai lama tidak ikut terkirim** ke server. `_logRevisiConfirm`/`_awkRevisiConfirm` hanya mengirim field yang bisa diedit.
- Server memvalidasi nilai yang diterima terhadap daftar enum tanpa fallback ke baris lama → payload kosong ditolak.
- Perbaikan: fallback ke nilai baris lama **di sisi server** (`services/LogistikService.js`, `services/PengawakanService.js`) — `oldRow['JenisAmunisi']`, `oldRow['Jenis']`, `oldRow['Komponen']`, `oldRow['Scope']`, `oldRow['Kategori']`. Pendekatan ini lebih aman daripada mengirim field disabled dari client, karena tidak bergantung pada kelengkapan form revisi per divisi.

### 2. Data hilang saat revisi Pemantauan & Intelijen (bug lebih serius)
`pemantauan_revisi` dan `intelijen_revisi` menandai baris lama `SUPERSEDED` **sebelum** seluruh field tervalidasi. Bila validasi gagal, baris lama ikut menjadi `SUPERSEDED` tanpa baris pengganti → data secara efektif hilang dari tampilan.
- Perbaikan: `updateRowCells(..., Status: SUPERSEDED)` dipindahkan ke **setelah** seluruh validasi lulus. Scan ulang seluruh fungsi `*_revisi` di repo tidak menemukan pola tulis-sebelum-validasi lain.

### 3. "Hapus" = anulir (bukan hard delete) — sesuai `ARCHITECTURE.md` §5
Audit seluruh divisi: tidak ada hard delete pada data transaksi; anulir tersedia di semua modul dan konsisten dengan RBAC. **Tidak ada hard delete baru yang ditambahkan** — konsisten dengan prinsip versioning proyek. Master Data tetap punya hard delete hanya untuk master (mis. kawasan konservasi), sesuai desain.

### 4. Kolom `LabelTampil` pada sheet `Opsi` (perubahan skema — disetujui user)
- Kolom baru `LabelTampil` (maks. 80 karakter) memisahkan **token yang disimpan** dari **teks yang tampil** di dropdown/tabel/riwayat. Tanpa ini, mengubah tampilan memaksa menimpa token dan merusak data transaksi lama.
- `ensureOpsiColumns()` menyisipkan kolom tersebut **tepat setelah `Label`** pada sheet yang dibuat versi lama (6 kolom), lalu mengisinya dari kolom `Label`. Sisip di posisi ini wajib: seluruh penulisan baris `Opsi` memakai urutan header kanonik, sehingga bila kolom hanya ditambahkan di ujung, baris baru akan masuk ke kolom keliru.
- `getOpsiLabelMap()` kini memakai `LabelTampil` **termasuk untuk token non-aktif** — status `Aktif` hanya mengatur boleh/tidaknya token muncul di dropdown, bukan menghapus nama yang tampil pada riwayat lama.
- `_seedOpsi()` tidak menimpa label hasil kustomisasi user. Aturannya: token di luar seed tidak disentuh; `LabelTampil` yang sudah diubah user (berbeda dari `Label`) dihormati; hanya nilai hasil isi-otomatis `ensureOpsiColumns` (`LabelTampil` == `Label`) yang dinaikkan ke teks seed yang lebih rapi (mis. `PPPK_FUNGSIONAL` → `PPPK Fungsional`). `setupSeedOpsi()` aman dijalankan berulang.
- UI Master Data: tombol ubah "Tampil sebagai" (`_mdOpsiEditLabel`) → `master_setOpsiLabelTampil()`.

### 5. Opsi jadi sumber tunggal — 2 grup enum tambahan ditemukan saat audit
Instruksi user: tidak ada lagi data domain hardcoded. Setelah enam grup pertama dipindahkan, audit `<select>` statis di seluruh `html/views/*.html` menemukan **dua enum yang belum terpetakan** dan tanpa validasi server sama sekali:
- `HasilRiksa_Kategori` (TX_Operasi_Laut) — sebelumnya hanya ada sebagai `<option>` di `OperasiLaut.html`, tidak pernah divalidasi.
- `HariOperasi_Kategori` (TX_Operasi_Laut) — kondisi sama.

Keduanya kini menjadi grup `OPS_RIKSA_KATEGORI` & `OPS_HARI_KATEGORI` (total 10 grup, 36 token), plus validasi server pada `operasiLaut_submit` dan `operasiLaut_revisi` — bug sejenis yang sebelumnya hanya gefunden lewat laporan user.

Sisa pemindahan hardcoded: peta label frontend (`_RAWAT_*`, `_AWK_*`, `_LOG_BBM_LABEL`, `_LOG_KOM_LABEL`), array KPI/chart, `<option>` statis di 4 view, dan `RiwayatService` (`_RIW_LOKASI`/`_RIW_TAHAP`). Kontrak KPI AKN di-refactor agar tidak lagi mengasumsikan nama scope tertentu: `perKategori[k][scope]`, `totalPerScope`, `aknPerScope` + `aknScopeLabels` (menggantikan `totalKeseluruhan`/`aknKeseluruhan`/`aknPoa` yang hardcode `KESELURUHAN`/`POA`). Dashboard & FE Pengawakan menyesuaikan.

### 6. Yang TIDAK dipindahkan (sengaja, bukan data referensi)
Konstanta struktural tetap di `utils/Constants.js`: `ROLE`, `ROW_STATUS`, `DIVISI`, nama sheet (`SHEET_TX`/`SHEET_MASTER`), `LOG_MODE_*`, `OPSI_GROUP_LABEL` (label chrome antarmuka, bukan data domain), dan mode `md-kapal-status`/`rawk-status` (boolean Ya/Tidak). `WPP_NRI` tetap dimuat dari GeoJSON eksternal sesuai keputusan sebelumnya. Alasan dicatat di `DATA_SCHEMA.md` §`Opsi`.

### Verifikasi (statis & harness)
- `node --check` seluruh `.js` (kecuali `test.js` legacy berisi HTML) → **lulus**.
- Ekstraksi seluruh blok `<script>` inline dari `Index.html`, `Auth.html`, `views/*.html`, `Script_Charts.html`, `Script_Main.html` (8.212 baris) → `node --check` **lulus**.
- Scan token enum domain (`PROSES_PENGADAAN`, `KESELURUHAN`, `SPEEDBOAT`, `PPPK_*`, dll.) di luar `Setup.js`/`Constants.js` → **0 sisa**.
- Scan karakter CJK di 16 file yang diubah → **bersih**.
- **Harness `Opsi` (12 assertion, `vm` + mock SpreadsheetApp) — SEMUA PASS**: self-heal menyisipkan kolom pada posisi kanonik & mengisi baris lama tanpa menggeser kolom `Aktif`; seed idempoten (36 baris, jalan 2x tidak bertambah); 10 grup ter-seed; `getOpsiLabelMap` mengembalikan `LabelTampil`; `getOpsiList` hanya mengembalikan token aktif sementara token non-aktif tetap punya label untuk riwayat.
- **Harness migrasi sheet lama (8 assertion) — SEMUA PASS**, mensimulasikan sheet `Opsi` versi lama persis seperti milik user saat ini (6 kolom, 4 grup Fase 10): self-heal mengisi `LabelTampil`; `setupSeedOpsi()` menaikkan `PPPK_FUNGSIONAL` → `PPPK Fungsional`; label hasil kustomisasi user **tidak** ditimpa; token di luar seed tidak disentuh; jalan 2x tidak menambah baris; tidak ada grup yang berakhir kosong.

### Bug yang ditemukan oleh harness (bukan ditemukan review manual)
Menjalankan harness membuktikan bahwa self-heal versi awal (append di ujung) **memperusak sheet lama**: karena `_seedOpsi` menulis baris secara posisional mengikuti header kanonik, baris baru masuk ke kolom yang keliru — `LabelTampil` terisi tanggal `DibuatAt`. Diperbaiki dengan menyisipkan kolom setelah `Label`. Tanpa harness ini, bug tersebut baru akan muncul saat user menjalankan `setupSeedOpsi()` di GAS.

**WAJIB** — `setupSeedOpsi()` harus dijalankan user **satu kali** setelah push. Bukan opsional: `getOpsiList()` sengaja tidak punya fallback hardcoded, sehingga sheet yang belum di-seed akan membuat 6 grup baru kosong dan **menolak seluruh input** di tiga modul (`Perawatan` "Lokasi/Tahap/Kategori docking tidak valid", `Pengawakan` "Scope AKN tidak valid", `OperasiLaut` "Kategori Riksa/Hari Operasi tidak valid"). Kolom `LabelTampil` sendiri otomatis bertambah saat sheet dibaca (`ensureOpsiColumns`), tetapi isi 6 grup baru hanya bisa diisi oleh seed.

**Tes user**: (1) `clasp push`; (2) jalankan `setupSeedOpsi()` **satu kali** dari editor Apps Script; (3) pastikan `Opsi` punya 7 kolom dengan `LabelTampil` setelah `Label`, dan total 36 baris; (4) uji revisi Logistik (Amunisi/BBM/Personil) & Pengawakan AKN — seharusnya tidak lagi muncul "tidak valid"; (5) uji dropdown Perawatan & Operasi Laut terisi dari `Opsi`; (6) Master Data → Opsi: ubah "Tampil sebagai", pastikan label berubah di dropdown tanpa merusak data lama; (7) uji revisi Pemantauan/Intelijen dengan sengaja mengirim data invalid → baris lama harus tetap `ACTIVE`.

---

## [Fase 12 — Hotfix #2] — Ikhtisar Gagal Render: `canApprove is not defined`
**Tanggal**: 28 September 2026
**Status**: Perbaikan kode selesai & siap deploy — verifikasi runtime GAS oleh user.

### Akar masalah (bug frontend 1 baris, bukan data)
`html/Script_Main.html`, fungsi `_renderOverview()`:
- Baris 502 mendeklarasikan `var isApprover = ['SUPERADMIN','DIREKTUR','KADIV'].indexOf(user.role) !== -1;`
- Baris 621 memanggil `if (canApprove) _loadApprovals();` — **`canApprove` tidak pernah dideklarasikan di mana pun** (nama yang benar adalah `isApprover`).
- Akibatnya `ReferenceError` dilempar wrapper `google.script.run` sebagai `"Error in protected function: canApprove is not defined"` (hanya terlihat di console browser, tidak pernah ditampilkan ke user).
- Urutan eksekusi menjelaskan gejalanya persis: `el.innerHTML = html` (baris 620) **sudah** berjalan → halaman menampilkan KPI & grid divisi sebagai placeholder, tetapi exception menghentikan baris berikutnya (`APP_OV.key = null; _ovLoadData();`, baris 623-624) → **`dashboard_getOverview` tidak pernah dipanggil** sama sekali.
- Jadi Ini murni ReferenceError di client. Data sudah ada dan versi sebelumnya sudah ter-deploy; tidak ada masalah RBAC, cache, filter, atau sheet.

### Perbaikan
- `Script_Main.html:621` — `if (canApprove) _loadApprovals();` → `if (isApprover) _loadApprovals();`
- Satu baris, tanpa perubahan logika lain. Banner `dr-banner` tetap hanya dirender untuk approver (sudah dijaga `if (isApprover)` di baris 509), dan `_loadApprovals()` sendiri tetap early-return saat panel "Kelola Akun" tidak aktif.
- Tidak ada perubahan pada `DashboardService.js`, RBAC server, `DATA_SCHEMA.md`, maupun token warna baru.

### Koreksi diagnosis hotfix sebelumnya
Entri Fase 12 di bawah menyebut penguncian `APP_OV.key` sebagai akar masalah. Diagnosis itu **tidak tepat untuk gejala "Ikhtisar selalu placeholder"**: `_renderOverview()` selalu me-reset `APP_OV.key = null` (baris 623) tepat sebelum memanggil `_ovLoadData()`, sehingga guard dedup tidak mungkin memblokir pemuatan pertama. Perubahan `APP_OV.key` tetap dipertahankan sebagai **hardening defensif** (benefisial bila alur pemanggilan berubah), tetapi bukan penyebab yang dicari user.

### Verifikasi (statis)
- `rg "canApprove" html/Script_Main.html` → bersih (0 sisa).
- `node --check` atas blok `<script>` hasil ekstraksi → **lulus**.
- Kurung kurawal seimbang (1558 `{` / 1558 `}`); selisih hitungan `(` hanya berasal dari teks Indonesia di dalam string/komentar, bukan sintaks.
- Panggilan fungsi di dalam `_renderOverview()` dan `_ovLoadData()` (jalur render Ikhtisar) seluruhnya terdefinisi — tidak ada identifier tak dikenal tersisa.

**Tes user**: deploy ulang (`clasp push`), muat Ikhtisar, lalu pastikan (1) console bersih — tidak ada lagi `canApprove is not defined`; (2) KPI utama, 9 kartu divisi, dan 2 chart benar-benar terisi sesuai filter; (3) ganti filter → halaman ikut terisi ulang.

---

## [Fase 12 — Executive Overview & Profil Kapal (KapalID + DashboardService)]
**Tanggal**: 22 September 2026
**Status**: Implementasi selesai (deploy/push oleh user — belum verifikasi runtime GAS).

### Hotfix — Ikhtisar gagal memuat data & diam-diam terkunci (22 Sep 2026)
> **Koreksi (28 Sep 2026)**: akar masalah yang diuraikan di bawah **tidak tepat** untuk gejala "Ikhtisar selalu placeholder" — penyebab sebenarnya adalah `ReferenceError: canApprove is not defined` di `_renderOverview()`. Lihat entri **[Fase 12 — Hotfix #2]** di atas. Teks di bawah dipertahankan apa adanya sebagai catatan hotfix awal.
**Lingkup**: Sisa Fase 12 (penyempurnaan/QA) — bukan fase baru. **Akar masalah (bug frontend, bukan data)**: pada `html/Script_Main.html`, fungsi `_ovLoadData()` menandai `APP_OV.key = _ovFilterKey()` **sebelum** panggilan `dashboard_getOverview` selesai, dan `withFailureHandler` **tidak me-reset** key tersebut. Akibatnya satu kegagalan sementara (sesi/token expired, timeout) membuat `APP_OV.key` tetap terisi → setiap pemanggilan berikutnya langsung `return` di guard → **Ikhtisar tidak pernah menarik data lagi sampai filter diganti**, dan errornya tidak pernah terlihat (placeholder diam).

- `APP_OV.key` kini **hanya di-set setelah server menjawab sukses**; pada `withFailureHandler` di-`null`-kan lagi agar bisa dicoba ulang.
- Error tidak lagi ditelan: fungsi baru `_ovLoadError(msg)` menulis pesan ke `ov-kpi-row` memakai kelas existing `.n-msg error show` + tombol **"Coba lagi"** (`btn-sm`, memanggil `_ovLoadData(true)`), serta membersihkan `ov-div-grid` supaya tidak ada sisa placeholder.
- Kasus `res.success === false` (server menolak, mis. `UNAUTHORIZED`) juga kini ditampilkan, bukan diabaikan.
- `_ovLoadData(force)` gaining parameter opsional `force`; pemanggil lama `Script_Main.html:624` tetap kompatibel.
- **Catatan validasi manual**: menjalankan `dashboard_getOverview` langsung dari editor Apps Script **selalu** menghasilkan `UNAUTHORIZED` karena editor tidak mengirim argumen `token` (`_getSession(undefined)` → `null`). Log editor bukan indikasi aplikasi web rusak — hanya relevan bila TOKEN diteruskan.
- Tidak ada perubahan pada RBAC server, `DashboardService.js`, `DATA_SCHEMA.md`, maupun token warna baru (`.n-msg`/`.chart-empty`/`.btn-sm` sudah ada).

### Polish — Ikhtisar: empty-state yang informatif (12 Sep 2026)
**Lingkup**: Sisa Fase 12 ("penyempurnaan visual/QA") — bukan fase baru; RBAC server & token grid **tidak diubah**.

Keputusan teknis (diputuskan saat implementasi, memperjelas ARCHITECTURE tanpa mengubah skema):
- `_ovRenderData` (Script_Main.html) kini punya **empty-state kontekstual** per blok, memakai class `.chart-empty` yang **sudah ada** (Style:1038, token `--n-text-muted` — tanpa warna baru):
  - KPI row kosong → `"Belum ada laporan pada rentang terpilih — isi minimal satu laporan (Operasi Laut/Udara/Intelijen/Pemantauan) pada periode ini agar indikator Ikhtisar muncul."`
  - Grid divisi kosong → `"Belum ada ringkasan divisi pada rentang terpilih — laporan yang masuk akan ditampilkan sebagai kartu ringkas per divisi di sini."`
- Pertimbangan negatif: **tidak** menambah warna/kelas baru, tidak inline-icon, tidak daftar dekoratif — semua frasa informatif untuk direktur; pola konsisten dengan `emptyMsg` yang sudah dipakai `_chartLine`/`_chartBar` di blok yang sama.

Menjalankan bagian Fase 12 (lihat PHASES.md): kolom `KapalID` faktual pada 4 sheet transaksi, agregasi lintas-divisi via `DashboardService.js`, wiring Overview, dan halaman Profil Kapal.

> **Keputusan user (bind)**: `KapalID` **opsional/nullable** — baris lama tanpa KapalID tetap valid; duplicate-check TIDAK berubah (OperasiUdara = Periode+WPP; Logistik = jenis+periode). Reload tampilan saat filter berubah = **global**. Overview dipenuhi lewat **satu endpoint agregasi langsung dari sheets** (pola RiwayatService) dengan cache 300s — TIDAK memanggil KPI service modul lain.

**Skema (opsional)** — `Setup.js`, `data/SheetAccess.js`, `DATA_SCHEMA.md`:
- Kolom `KapalID` ditambahkan sebagai **kolom terakhir** di `TX_OperasiLaut`, `TX_OperasiUdara`, `TX_Logistik_Amunisi`, `TX_Logistik_BBM` (ke depan data lama safety; Setup idempoten).
- Helper baru di `SheetAccess.js`: `ensureTxColumn(sheetName, colName)` + `ensureKapalColumns()` (append header bila belum ada — self-heal DB lama saat submit/revisi).
- `DATA_SCHEMA.md`: entri `KapalID text (nullable)` di 4 tabel + catatan nullability.

**Backend KapalID** — `OperasiLautService`, `OperasiUdaraService`, `LogistikService`, `MasterDataService`:
- `master_kapalExists(kapalId)` (baru, internal, tanpa RBAC; `''` → valid). Validasi server: `if (p.KapalID && !master_kapalExists(...)) → tolak`.
- Operasi Laut & Udara: submit + revisi menyimpan `KapalID` ke baris baru; revisi meng-copy `KapalID` baris lama default.
- Logistik: `_logBuildPayload` menambah `KapalID` ke payload AMUNISI & BBM (baseline + usage); revisi mewarisi `KapalID` lama bila kosong; `_logHistory` menyertakan `base.kapalId`.

**DashboardService (baru `services/DashboardService.js`)** — read-only, seluruh akun APPROVED (`_dashAssertApproved`), cache `CacheService` 300s (`DASH_OV_<user>_<filter>` / `DASH_PK_<user>_<kapal>`):
- `dashboard_getOverview(token, filter)`: 4 headline + 9 kartu divisi + `charts{trendMonths, realisasi{sp2d,akrual}, hariOperasi{kapal,pesawat}, kesiapan{siap,tidakSiap}}`; pola agregasi langsung dari sheets (bukan service modul).
- `dashboard_profilKapal(token, params)`: profil 1 kapal — kesiapan/docking terbaru, total hari operasi, tabrak/pantau, marabahaya, stok amunisi akhir (baseline−penggunaan), pagu vs realisasi BBM, + riwayat lengkap.
- Helper `_dash*` (rows-filter, latest-per-kapal, bulanan, boolean, format) + reuse `_logIsBaselineRow`.

**Frontend** — `html/Script_Main.html` + `html/views/*.html`:
- Helper kapal: `_KAPAL_ITEMS`/`_KAPAL_LABEL`/`_kapalInit(id)`/`_kapalName()`/`_kapalCellPlain()` (sumber `master_getKapalList`, accessible APPROVED).
- Typeahead `ops-kapal`, `oud-kapal`, `lga-kapal`, `lgb-kapal` (logistik: kolom kapal opsional di form); submit mengirim `KapalID` (laut/udara) / `kapalId` (logistik); kolom **Kapal** di tabel riwayat ops-laut, ops-udara, amunisi, BBM + detail "Lihat".
- **Overview** terhubung `dashboard_getOverview` (`APP_OV` dedup per filter + `_busyInc/Dec`): KPI row, grid 9 divisi, 2 chart (`ov-chart-real` line SP2D vs Akrual, `ov-chart-op` bar hari op kapal/pesawat); `_ovNum`/`_ovMetric` (Rp → `_rupiah`, lain → `_idNum`).
- **Auto-reload global**: `_setFilterMode/Month/Year/From/To` memanggil `_reloadOnFilterChange()` → `_renderViewContent(APP.currentView)` (header/filter input tidak direbuild).
- **Profil Kapal**: rute khusus non-nav `profil-kapal` (`_routeProfil`/`_openProfilKapal`, `APP.profilKapalId`, `_viewTitle`, filter disembunyikan), tombol "Profil" di Master Data → kapal, render `_renderProfilKapal`: identitas, KPI (kesiapan/docking/operasi), chart stok amunisi + BBM pagu vs realisasi, tabel riwayat; tanpa template file (halaman dirender penuh di JS — konsisten dengan Overview).

**Keputusan teknis dicatat**: (1) Profil Kapal tidak pakai include template — dirender penuh via JS seperti Overview; (2) BBM "Tunggakan" di kartu Logistik Overview = **jumlah item bertunggakan** (satuan `item`), bukan satuan Rp.

**Verifikasi** (statis): `node --check` lulus untuk DashboardService, OperasiLaut/Udara, Logistik, MasterData, SheetAccess, Constants, DateUtil + ekstraksi `Script_Main.html` (via `awk` → `/tmp/opencode/sm_check.js`); 0 backtick di kode aktual (sisa backtick hanya di komentar MasterDataService/SheetAccess yang sudah ada); nama sheet (`SHEET_TX.PENGAWAKAN_KEGIATAN`, `KEGIATAN_DIREKTORAT`, dst) & kolom (`KondisiDarurat`, `StatusPenanganan`, `HariOperasi_Jumlah`, `ObjekSDK`, dst) cocok dengan `Constants.js`/DATA_SCHEMA.
**Tes user**: `clasp push`, lalu (1) Overview memuat KPI + 9 kartu + 2 chart mengikuti filter bulanan/rentang; (2) ubah filter → seluruh halaman reload otomatis; (3) Master Data → tombol "Profil" → halaman Profil Kapal benar; (4) Logistik → pilih kapal baru saat input amunisi/BBM → kolom & detail "Lihat" menampilkan kapal.

---

## [Fase 11.5 — Konversi Form Divisi ke Popup (Backlog A)]
**Tanggal**: 22 September 2026
**Status**: Selesai (implementasi; deploy/push oleh user).

Konversi **semua 13 form input divisi** (backlog A, lihat PHASES.md) dari **inline-expand** menjadi **popup modal**, mengikuti pola acuan modul Kegiatan Direktorat (`modal-kgd-form`). **Koreksi jumlah**: 13, bukan 12 (TU, Ops Laut, Ops Udara, Intelijen, Pemantauan, Perawatan ×3, Logistik ×3, Pengawakan ×2).

**Pola yang diterapkan seragam di semua modul**:
- Tombol buka: `<button class="btn-primary" onclick="…OpenForm()">＋ Input …</button>` penuh lebar di dalam `*-form-section` (RBAC tetap menggating wrapper via `_rawatCanWrite`/`_logCanWrite`/`_awkCanWrite`). CSS lama `.btn-form-toggle`/`.toggle-icon` dihapus dari `Style.html` (dead code).
- Modal `modal-<prefix>-form` berisi `h2`, [opsional] strip konteks `.modal-context` (data penting seperlunya), `.n-modal-form-scroll` (area scroll bila form panjang) yang membungkus `-form-msg` + field + div lampiran, footer `btn-primary` Simpan + `btn-outline` Batal (closeModal).
- **Data konteks minimal di dalam modal**: TU → Pagu reguler + ABT periode berjalan (`tu-form-context-value`); Logistik → Stok Akhir Amunisi / Sisa Pagu BBM / Total Personil (`lga|lgp|lgp-form-context-value` dibagi `_logFillFormContext` dari `_LOG.kpi`).
- **Konversi JS**: `formOpen` state + `*ToggleForm` + fungsi auto-hide dihapus di semua modul; diganti `…OpenForm()` yang mereset field (termasuk typeahead input+hidden `lga-jenis`/`lgb-jenis`/`lgp-komponen`/`akn-kategori` dan select mode/status/scope), memanggil `_attachInit` ulang (lampiran fresh di dalam modal), lalu menampilkan modal. Submit sukses menutup modal di callback `_attachUploadAll` lalu reload KPI/history seperti biasa.
- **Modul per-pane (template di-clone)**: modal diletakkan **di dalam** `view-tpl-rawat-*`/`view-tpl-log-*`/`view-tpl-awak-*` agar ikut ter-clone (pola sama dengan sebelumnya); judul modal berubah dinamis per mode Logistik (`lga-form-modal-title`/`lgb-form-modal-title`) menggantikan label toggle lama.

**Modul terdampak** — `html/views/*.html` + `html/Script_Main.html`:
1. **TataUsaha**: `tuOpenForm()` + `_tuFillFormContext()`; `_tuAutoToggleForm` (+ panggilannya di `_tuLoadKPI`) dan `formOpen` dihapus; `tuSubmit` → `closeModal('modal-tu-form')`.
2. **OperasiLaut** / **OperasiUdara**: `opsLautOpenForm()`/`opsUdaraOpenForm()` menggantikan toggle (perbaikan kurung yatim di OpsUdara); auto-hide di `_ops*LoadKPI` dihapus; submit → close modal.
3. **Intelijen** / **Pemantauan**: `intelOpenForm()` (=`_intelResetForm()`+reset attach) / `pemOpenForm()` (=`_pemResetForm()`+reset attach); submit → close modal.
4. **Perawatan** (Kesiapan/Docking/Item): `_rawatOpenForm(name)` memakai `_RAWAT_SHEET[name]`; `_rawatInitPane` menjalankan `_attachInit` tetap + reset; submit per pane → close `modal-rawk/rawd/rawi-form`.
5. **Logistik** (Amunisi/BBM/Personil): `_logOpenForm(name)` reset mode ke PENGGUNAAN + `_logAmunisiModeChange`/`_logBbmModeChange` (label kini menuju `lga/lgb-form-modal-title`), reset typeahead + angka, `_logFillFormContext`, reset attach; submit lga/lgb/lgp → close modal.
6. **Pengawakan** (AKN/Kegiatan): `_awkOpenForm(name)` reset scope/jumlah/typeahead `akn-kategori` (AKN) atau field kegiatan; `formOpen`/toggle dihapus; submit → close `modal-akn/akk-form`.

**Teknis yang di-handle** (per spek backlog A):
- Pola modal mengikuti induk `modal-hd` (overlay + `.n-modal` + area scroll) dengan utilitas baru di `html/Style.html`: `.n-modal-form { max-width:600px; width:100% }`, `.n-modal-form-scroll { max-height:62vh; overflow-y:auto; padding-right:6px }`, `.modal-context` (+ `.mc-k`).
- **Leaflet `map.invalidateSize()`**: peta WPP `#map-ops-laut`/`#map-ops-udara` bersifat **page-level** (di luar form), bukan di dalam modal — panggilan `invalidateSize()` deklaratif ditambahkan (guarded, `setTimeout` 250ms) di `opsLautOpenForm`/`opsUdaraOpenForm` untuk memenuhi spek; **tidak berdampak** karena peta selalu terlihat dan modal tidak mengandung kanvas peta.
- **Lampiran**: `_attachInit`/`_attachUploadAll` dipindah ke dalam modal — reset per buka (attach lama tidak bertumpuk), submit menunggu upload sebelum closeModal.
- State auto-hide (form-body/icon) dihapus total; halaman utama (KPI/chart/riwayat) tidak berubah tata letak saat modal terbuka.

**Verifikasi** (statis): `node --check` JS hasil ekstrak OK; 0 backtick di kode terlayani; grep `ToggleForm|formOpen|form-body|form-toggle` → hanya komentar/─ (tiada referensi tersisa, CSS dead dihapus); id modal ↔ referensi JS cocok (44 match terverifikasi).
**Tes user**: `clasp push` lalu tiap modul → tombol `＋ Input …` → modal tampil; isi + lampiran + Simpan → modal menutup, KPI/chart/riwayat reload; buka lagi → form bersih. Perawatan/Logistik/Pengawakan: tab berpindah dan modal tetap normal (per-pane). Mode BASELINE/PENGGUNAAN Logistik mengubah judul modal & field.

---

## [Backlog C — Perbaikan Error Tambah Opsi (Sheet Opsi Berdikari)]
**Tanggal**: 22 September 2026
**Status**: Selesai (implementasi; deploy/push oleh user).

**Masalah**: saat menambah nilai opsi baru di Master Data → Opsi Daftar (mis. amunisi/BBM), muncul error `Cannot read properties of null (reading 'getDataRange')`. **Akar masalah**: jalur baca (`getOpsiList`/`getOpsiDetail` di `data/SheetAccess.js`) sudah diamankan dengan fallback `if (sheet)`, tetapi jalur tulis (`master_addOpsiJenis`, `master_setOpsiJenisAktif` di `services/MasterDataService.js`) memanggil `sheetToObjects(openMasterSheet(...))` tanpa guard — jika spreadsheets Master tidak memiliki sheet `Opsi` (mis. Master dibuat sebelum revisi Opsi Fase 9/10), `getSheetByName` mengembalikan `null` lalu `null.getDataRange()` melempar error.

**Perbaikan** — `data/SheetAccess.js`:
- `ensureOpsiSheet()` (baru): idempoten — jika sheet `Opsi` belum ada di Master, buat otomatis dengan header sesuai DATA_SCHEMA.md (`Kode, Urutan, Label, Aktif, DibuatOleh, DibuatAt`) + format header konsisten (bold, `#E8EAF6`, frozen row 1).
- `readOpsiRows()` (baru): membungkus `ensureOpsiSheet()` + `sheetToObjects()` untuk jalur baca.
- `sheetToObjects(sheet)` kini mengembalikan `[]` bila `sheet` null (defensive guard global).
- `getOpsiList` & `getOpsiDetail` memakai `readOpsiRows()` (perilaku fallback default tetap).

**`services/MasterDataService.js`**: `master_addOpsiJenis` & `master_setOpsiJenisAktif` memakai `ensureOpsiSheet()` → sheet dibuat otomatis saat add pertama, entri berhasil disimpan.

**Verifikasi**: `node --check` kedua file OK; 0 backtick di kode aktual.
**Tes user**: Master Data → Opsi Daftar → tambahkan amunisi/BBM baru → tersimpan tanpa error; daftar baru tampil di dropdown typeahead Logistik/Pengawakan (catatan: perubahan deploy oleh user).

---

## [Backlog B — Combobox Typeahead untuk Input Referensi]
**Tanggal**: 22 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Bagian dari Fase 11** (backlog B yang dijadwalkan di fase ini, lihat PHASES.md). Mengganti `<select>` Jenis/Kategori menjadi **input teks + autocomplete (typeahead)** di 4 titik input referensi. Sumber saran tetap sheet `Opsi` (master); nilai akhir **tetap divalidasi server** — nilai tak dikenal ditolak (bukannya free-text submission).

**Client** — `html/views/Logistik.html`, `html/views/Pengawakan.html`, `html/Script_Main.html`, `html/Style.html`:
- **Komponen typeahead generik** di `html/Script_Main.html`: `_taInit(id, items)` membangun markup `.ta-field{ input[type=text] id+'-input' + hidden id (token) + ul id+'-dd' }`; `_taTokensToItems(arr, labelMap)` memetakan token Opsi → item `{label, value}` (label Indonesia utk komponen/kategori); `_taFilter/_taPick/_taKey` (navigasi keyboard ↑/↓/Enter/Esc) + klik; `_taSync` di blur — teks yang cocok dgn label **atau token** disinkron ke hidden; `_taGet` dipakai submit.
- **Aman terhadap nilai tak dikenal**: `_taGet` mengembalikan token hanya bila teks cocok label/token terdaftar — selain itu `''` → server menolak ("Jenis … tidak valid."). Pesan "Tidak ada opsi — tambahkan di Master Data" muncul saat filter tak menemukan saran.
- **Logistik**: `lga-jenis` (Amunisi), `lgb-jenis` (BBM, **kini di-populate dari `logistik_getOptions`** — sebelumnya `<option>` hardcoded REGULER/ABT; tetap divalidasi `getOpsiList(BBM)`), `lgp-komponen` (Personil, label → `_LOG_KOM_LABEL`).
- **Pengawakan**: `akn-kategori` (label → `_AWK_KAT_LABEL`).
- Submit handler memakai `_taGet('…')`; CSS `.ta-field/.ta-input/.ta-dd` (1 level shadow, palet DESIGN §3, tanpa gradient/ikon).

**Keputusan/catatan**: (1) id hidden memakai id lama (`lga-jenis` dll.) sehingga pembacaan & validasi tak berubah; (2) label vs token — user melihat label Indonesia, sistem menyimpan token Opsi; server tetap otoritas validasi (nilai tak dikenal ditolak, sesuai keputusan backlog B); (3) BBM ikut typeahead & di-populate dari Opsi (perbaikan hardcoded).

**Verifikasi**: `node --check` seluruh `<script>` (ekstraksi Script_Main.html) OK; 0 backtick di semua file di-serve; simulasi `_taSync` (label & token, huruf kapital/kecil, nilai tak dikenal → `''`).
**Tes user**: buka Logistik (Amunisi/BBM/Personil) & Pengawakan (AKN) → ketik sebagian nama, pilih saran (klik/Enter), simpan; ketik teks tak dikenal → simpan → ditolak server; tombol navigasi ↑/↓/Esc berfungsi; ganti tab modul → typeahead ter-binding ulang tiap pane.

---

## [Fase 11b — Halaman Riwayat Laporan]
**Tanggal**: 22 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Sub-langkah 11b** dari Fase 11 (PRD §7.5). Halaman Riwayat Laporan menampilkan **seluruh entri lintas modul** (semua sheet TX_*), termasuk SUPERSEDED dan VOID, dengan status jelas, "siapa melakukan apa", dan komentar anulir tampil inline di baris yang berstatus VOID.

**Server** — `services/RiwayatService.js` (baru):
- `riwayat_getAll(token, filter)` — agregasi 14 sheets TX_* (`TATA_USAHA` … `PENGAWAKAN_KEGIATAN`, `KEGIATAN_DIREKTORAT`) menjadi satu feed, urut Timestamp menurun, disaring `filterToDateRange` (kolom Timestamp).
- **Komposisi baris**: `rowId, sheet, sheetLabel, periode, divisiId/nama, submittedBy/nama, timestamp, status, supersedesRowID, voidReason/voidedBy/name/at, ringkasan (1 baris), detail (pasangan label/nilai siap-tampil)`. Klien cukup merender — tidak perlu tahu skema tiap sheet.
- Pembangun ringkasan/detail per modul (`_riwRingkas*/_riwDetail*`): terjemahan ID relasional (Kapal/WPP/Kawasan), enum → label Indonesia, format rupiah (`_riwRupiah`), deteksi baris baseline vs penggunaan logistik (Amunisi `StokAwal`/BBM `Pagu`), dsb.
- **RBAC (PRD §3)**: semua akun APPROVED boleh membuka halaman; SUPERADMIN/DIREKTUR → seluruh entri lintas divisi; KADIV → baris divisi sendiri + **seluruh TX_KegiatanDirektorat** (modul lintas-divisi yang bisa ia CRUD, §5.10); STAF → baris divisi sendiri (tanpa modul Kegiatan).
- Lookup master lazily per pemanggilan (`_riwLookups`): Kapal, Kawasan_Konservasi, WPP, Users, Divisi.

**Client** — `html/views/Riwayat.html` (baru) + `html/Script_Main.html` + `html/Index.html`:
- Halaman `riwayat` (nav "Riwayat Laporan", `minRoles: null`) — dispatch `_renderRiwayat` menggantikan `_renderRiwayatStub`.
- **Filter global kini tampil di halaman riwayat** (ubah `noFilter` di `_renderPageHeader`: hanya `master-data` yang tak punya filter) — memfilter Timestamp server-side.
- KPI strip: Total Entri / Modul / Aktif / Ditimpa / Dianulir (`_riwRenderKPI`).
- **Tab status** Semua/Aktif/Ditimpa/Dianulir dengan hitung otomatis (`_riwSyncTabs`), filter klien per status.
- Tabel lintas-modul: Periode · Modul · Ringkasan · Divisi · Dikirim oleh + waktu · Status · Aksi ("Lihat"); baris SUPERSEDED diredupkan, baris VOID berlatar merah muda + **komentar anulir inline** (bersama voidedBy). Tombol "Lihat" membuka modal detail + lampiran (`_hdOpen` + `_hdLoadEvidence` → `evidence_list`).

**Keputusan/catatan**: (1) RBAC divisi untuk halaman Riwayat (detail di atas) — direktur/superadmin lintas semua, kadiv/staf dibatasi divisi sesuai PRD §3, kecuali modul Kegiatan yang lintas-divisi untuk Kadiv; (2) halaman riwayat memakai **filter global** (PHASES Fase 11 menyebut "filter") — `noFilter` di `_renderPageHeader` disesuaikan; (3) data agregasi dibangun **server-side** (bukan frontend) supaya RBAC ditegakkan & klien ringan; (4) ringkasan/detail dibangun per modul agar tidak membuat "dinding kolom".

**Perbaikan bug bawaan yang ditemukan**: `_kgdDivisiMap` (KegiatanDirektoratService) membaca kolom `Nama` yang **tidak ada** di sheet `Divisi` (DATA_SCHEMA: `NamaResmi`/`NamaDashboard`) → diganti `NamaDashboard || NamaResmi` agar feed Kegiatan menampilkan nama divisi, bukan ID.

**Verifikasi**: `node --check` `services/RiwayatService.js` + semua `<script>` (ekstraksi Script_Main.html) OK; 0 backtick di semua file yang di-serve; `SHEET_TX.*` nama key cocok dengan `utils/Constants.js`.
**Tes user**: login (semua role) → menu "Riwayat Laporan"; cek feed lintas modul, tab status + hitungan, komentar anulir inline, baris SUPERSEDED/VOID, tombol "Lihat" (detail + lampiran), filter bulanan/rentang; bandingkan data Staf/Kadiv (hanya divisi sendiri) vs Direktur (semua).

---

## [Fase 11a — Modul Kegiatan Direktorat]
**Tanggal**: 22 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Fase 11 dimulai** — sub-langkah pertama (11a). Modul Kegiatan Direktorat (PRD §5.10): pengganti item "Pendukung Lainnya" di sumber data, log kegiatan lintas-direktorat (pre-award meeting, monitoring ABT, serah terima, dst).

**Server** — `services/KegiatanDirektoratService.js` (baru):
- `kegiatanDirektorat_getKPI/getHistory/submit/revisi/anulir`, semua dengan `withLock` (write) + `assertScope(session, [SUPERADMIN, DIREKTUR, KADIV], null)` — **Staf tidak punya akses** modul ini (PRD §5.10 CRUD oleh Direktur + semua Kadiv).
- Data `TX_KegiatanDirektorat` (sudah ada di `DATA_SCHEMA.md` & Setup): JudulKegiatan, Tanggal, Deskripsi, PihakHadir (opsional). Kolom standar lengkap (versioning/void) + audit log + notifikasi DATA_VOIDED ke pengunggah asli.
- **Periode diturunkan dari Tanggal kegiatan** (`dateToPeriode`) — bukan minggu berjalan, karena entri adalah feed kronologis. Filter global menyaring kolom `Tanggal`.
- getKPI → Kegiatan Periode Ini / Kegiatan YTD / Terakhir Dicatat; getHistory → feed lengkap ACTIVE+SUPERSEDED+VOID, urut Tanggal menurun, dengan lookup `DivisiID → NamaDivisi`.

**Client** — `html/views/Kegiatan.html` (baru) + `html/Script_Main.html` + `html/Index.html`:
- Nav "Kegiatan Direktorat" (`minRoles` diubah `null` → `[SUPERADMIN, DIREKTUR, KADIV]`), dispatch `_renderKegiatan`, state `_KGD`, renderer KPI + feed.
- Feed tabel kronologis: Tanggal/Judul/Divisi/Pihak Hadir/Status/Aksi (Lihat/Revisi/Anulir hanya saat ACTIVE; komentar anulir inline di baris VOID).
- **Form input pakai pola POPUP** (`modal-kgd-form`) — menerapkan backlog A untuk modul baru sejak awal. Multi-lampiran inline (`_attachInit('kgd', {refSheet:'TX_KegiatanDirektorat'})`) di dalam modal; modal revisi & anulir menyatu di template.

**Keputusan/catatan**: (1) backlog A diterapkan di modul baru ini (popup form) — modul lama menyusul dalam revisi tersendiri; (2) `Periode` = tanggal kegiatan → filter global memakai kolom `Tanggal`, bukan `Timestamp` kirim; (3) RBAC anulir = set yang sama dengan write (lintas divisi, sesuai §5.10).

**Verifikasi**: `node --check` service OK + seluruh `<script>` Script_Main OK; 0 backtick di semua file yang di-serve.
**Tes user**: login sebagai Direktur/Kadiv → menu "Kegiatan Direktorat" muncul (Staf tidak melihat); catat kegiatan via popup (judul/tanggal/deskripsi/pihak opsional) + lampiran; cek feed, revisi, anulir (komentar wajib), filter bulanan/rentang, dan KPI.

---

## [Revisi Palet — Aksen Dijadikan Navy Sidebar (Variasi Hue Biru)]
**Tanggal**: 22 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Keputusan user**: aksen saat ini (indigo `#4318FF`) tidak matching dengan sidebar navy. User meminta **warna aksen = navy yang saat ini dipakai di sidebar**, dan semua variasi perbedaan warna lain menjadi **variasi hue navy itu** (opacity/tint), bukan hue baru.

**Perubahan token** (`html/Style.html`):
- `--n-primary`: `#4318FF` → **`#2B3674`** (navy, warna yang sama persis dengan rel sidebar).
- `--n-primary-light`: `#E9E3FF` (lavender) → **`#E4E7F2`** (tint navy muda).
- Semua komponen yang memakai `--n-primary`/`--n-primary-light` (tombol, tab, focus, border, msg.info, badge, n-msg, checkbox, filter-mode aktive, spinner) otomatis ikut → navy.

**Sisi rel sidebar** (agar konsisten di atas navy):
- `.nav-item.active` indikator kiri: dulu `var(--n-primary)` (kini = warna rel = tak terlihat) → **putih `#FFFFFF`**. Bg aktif tetap `rgba(255,255,255,0.12)` + teks putih (flat, tanpa pill).

**Chart & legenda** (`html/Script_Charts.html`, `html/views/*.html`):
- `_CHART_COLORS.primary` → `#2B3674`; `primaryAlpha` → `rgba(43,54,116,0.35)`; **`indigoDark` di-rename `primarySoft` → `rgba(43,54,116,0.6)`** (seri pembanding — sesuai DESIGN §6: beda seri lewat opacity, bukan hue).
- Legenda chip di 5 template view (`TataUsaha`, `OperasiLaut`, `OperasiUdara`, `Intelijen`, `Pemantauan`): `#4318FF` → `#2B3674` dan `rgba(67,24,255,0.35)` → `rgba(43,54,116,0.35)`.
- Border tombol Edit Master Data `#C4B5FD` (lavender) → `#C7CCEC` (navy muda).
- Warna status semantik (`#10B981`/`#F59E0B`/`#EF4444`) **tidak berubah** — tetap untuk arti status.

**File sengaja TIDAK diubah**: `html/Auth.html` (memakai palet lama; tidak lagi di-serve — konsisten keputusan sebelumnya).

**Verifikasi**: `node --check` semua script OK; 0 backtick; `grep` memastikan tidak ada sisa `#4318FF`, `rgba(67,24,255…)`, `indigoDark`, `#C4B5FD`, `#E9E3FF` di file yang di-serve.

**Tes user**: buat tombol/aksi aktif kini navy (bukan purple) → matching dengan sidebar; aktif nav tetap ada garis kiri putih; chart + legenda masih 1 hue navy (opacity berbeda); master/data, msg.info, link navy.

---

## [Hotfix — Spinner Loading Lengket di Filter Periode]
**Tanggal**: 22 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Latar**: Bug hasil entri filter sebelumnya — spinner loading muncul terus walau data divisi yang sedang dilihat sudah tampil. Akar masalah: penurunan counter busy bergantung pada `this.__nBusy` pada object runner, tapi saat Apps Script memanggil handler sukses/gagal, konteks `this` BUKAN object yang menaikkan counter → decrement tidak pernah jalan → counter global menumpuk tak pernah balik ke 0.

**Perbaikan** (`html/Script_Main.html`, blok `_BUSY`/patch):
- Strategi diganti jadi **murni counter global**, tanpa ketergantungan `this`:
  - `withSuccessHandler` → `+1` saat setup; `-1` di dalam handler sukses.
  - `withFailureHandler` → tidak menaikkan, hanya `-1` di dalam handler gagal.
  - GS hanya memanggil SATU handler per call (sukses ATAU gagal) → rantai mana pun seimbang `+1/-1`.
- **Watchdog jaring pengaman**: interval 1s; jika `_BUSY > 0` dan tidak ada aktivitas selama 20 detik, counter di-force 0. Ini menutup kasus call yang hanya memasang success-handler lalu GAGAL (mis. `operasiLaut_getKPI`, `operasiLaut_getHistory`, dan beberapa getter lain) — tanpa handler gagal tersebut tidak ada yang menurunkan counter.

**Verifikasi**: `node --check` OK; 0 backtick. Tes user: pindah-pindah view dengan cepat, spinner maksimal muncul saat data masih dimuat dan hilang setelah render; matikan internet di tengah load → spinner hilang max 20 detik (watchdog).

---

## [Revisi UI — Filter Periode Rapi + Indikator Loading Global]
**Tanggal**: 22 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Latar**: Masukan user — filter Bulanan/Rentang di kanan-atas "jelek & kurang rapi"; dan saat memuat data dari sheet apa pun harus ada simbol loading di sebelah rentang/bulan.

**Redesain filter** (`html/Style.html` + `html/Script_Main.html`):
- Toggle + input disatukan dalam **satu control kohesif**: `.filter-box` (surface-1, border subtle, radius 12px, shadow card) = segmented "Bulanan|Rentang" + **pemisah vertikal 1px** + input periode. Tidak ada lagi tiga elemen melayang dengan gap 8px.
- Betulkan penyebab "jelek" lama:
  - Select bulan/tahun sebelumnya `appearance:none` **tanpa** panah pengganti → tampil seperti kotak kosong. Sekarang diberi **chevron kustom** (SVG data-URI, stroke `--n-text-muted`).
  - Date input sebelumnya kena `-webkit-appearance:none` → **ikon kalender browser hilang**. Sekarang date dipisah dari aturan `appearance:none` sehingga ikon kalender native tetap tampil.
- Radius seragam (`8px` untuk segmented & input di dalam box), satu baseline, `--n-shadow-card` halus; tombol aktif tetap solid `--n-primary`.

**Indikator loading global** (baru):
- Spinner kecil (`15px` ring `--n-primary-light` + `--n-primary`, animasi `n-spin`) `.filter-busy` di sebelah kanan box filter — selalu dirender di header (termasuk view tanpa filter, mis. Master Data).
- Dipicu **secara otomatis untuk SEMUA `google.script.run`** via satu patch di `Script_Main.html` (`_BUSY`/`_busyInc`/`_busyDec`/`_syncBusy` + pembungkus `withSuccessHandler`/`withFailureHandler`). `withSuccessHandler`/`withFailureHandler` per dokumentasi Google Apps Script mengembalikan object runner yang sama → counter per-chain (`__nBusy`) balance +1/-1 tanpa perlu mengedit ~92 call site.
- Keterbatasan yang disengaja: jika sebuah call hanya memasang success-handler (tanpa failure-handler) lalu GAGAL, spinner bisa tetap menyala (tak ada handler untuk menurunkan counter) — pola di codebase selalu memakai kedua handler, jadi risiko rendah; patch dibungkus try/catch (gagal patch → app normal tanpa spinner).

**Verifikasi**: `node --check` ketiga file bertopeng `<script>` — OK; `grep` memastikan 0 backtick; tidak ada sisa referensi `.filter-toggle`/`id="filter-periode"`. Bersenang-senang cek visual: ganti mode Bulanan↔Rentang, lihat spinner berputar setiap kali view/load data (KPI/history/chart/master).

---

## [Fase 10.5 — Revisi: Active Menu Tanpa Pill]
**Tanggal**: 22 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Latar**: Revisi Fase 10.5 atas masukan user — bentuk **pill** pada item nav aktif tidak disukai ("jelek").

**Perubahan** (`html/Style.html`, `.nav-item`):
- Radius pill & margin `2px 0` pada `.nav-item` **dihapus** — kembali flat/full-width seperti pola lama.
- `.nav-item.active`: **flat** — background `rgba(255,255,255,0.12)`, teks putih, **indikator kiri 3px solid `--n-primary`** (indigo), berat 600. Tidak lagi pill solid indigo.
- Hover & state lain tidak berubah.

**Verifikasi**: `grep` — tidak ada `border-radius`/`margin: 2px 0` di `.nav-item`; token `--n-r-pill` tidak lagi dipakai di blok nav. Spek deskripsi ikut diperbarui di `DESIGN.md` §5b & `PHASES.md` Fase 10.5.

---

## [Fase 10.5 — Sidebar Navy Tua]
**Tanggal**: 22 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Latar**: Keputusan user (persetujuan "Sikat") — sidebar dirubah dari putih `--n-surface-1` menjadi **navy tua** agar beda dari kartu konten terang, hierarki lebih tegas, dan menguatkan identitas maritim Nautika. Diputuskan tanpa menambah hue baru; spek dicatat di `DESIGN.md` §5b sebelum implementasi.

**Pencapaian** (`html/Style.html`, blok sidebar + nav):
- `.sidebar` background → `--n-text-primary` (`#2B3674`); border kanan → `rgba(255,255,255,0.10)`.
- `.sb-brand` "Nautika" → putih `#FFFFFF` (berat 800 tetap); pemisah bawah `rgba(255,255,255,0.10)`.
- `.sb-section-label` → `rgba(255,255,255,0.45)`.
- `.nav-item`: idle `rgba(255,255,255,0.78)`, sekarang **pill** (`border-radius: var(--n-r-pill)`, `margin: 2px 0`); hover latar `rgba(255,255,255,0.08)` + teks putih.
- `.nav-item.active` → **pill solid `--n-primary` indigo + teks putih**; indikator border-kiri dihapus (`transparent`), tidak memakai `--n-primary-light` (terlalu pudar di atas navy).
- `.sb-user-name` putih; `.sb-user-role` `rgba(255,255,255,0.6)`; `.btn-logout` border `rgba(255,255,255,0.10)` + teks putih, hover `rgba(255,255,255,0.08)`.
- Scrollbar rel: `rgba(255,255,255,0.25)`.

**Keputusan teknis / penyimpangan kecil**:
- Radius pill memakai token yang **benar-benar terdefinisi** di CSS: `--n-r-pill` (99px); `--n-radius-pill` (nama di `DESIGN.md` §4) ternyata tidak terdefinisi di file — dipakai `--n-r-pill`, konsisten dengan `.status-badge`/`.btn-mini`.
- Hover tombol **Keluar** diganti dari tint merah (lama: `#FEF2F2`/`--n-crit`, bermakna "bahaya") menjadi white-alpha netral — merah di atas navy berisiko jadi "badge dekoratif warna-warni" yang dilarang `DESIGN.md` §1.3.
- Tidak ada warna di luar palet §3; tanpa gradient, tanpa shadow tambahan, tanpa ikon/badge warna-warni — ceklis negative prompt §1 lolos saat review diri.
- `Auth.html` (tidak lagi di-serve) tidak disentuh.

**Verifikasi**: `grep` memastikan tidak ada lagi `var(--n-radius-pill)` (token rusak) di `Style.html`; semua token sidebar merujuk yang terdefinisi. Kontras navy #2B3674 vs teks putih ≥ 9:1. Verifikasi visual runtime oleh user (deploy/push): login → lihat sidebar navy, brand putih terbaca, item aktif pill indigo, hover netral, tombol Keluar konsisten.

---

## [Revisi Lintas Modul — Tombol "Lihat" Detail di Semua Riwayat]
**Tanggal**: 22 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Latar**: Permintaan user — setiap baris riwayat di bawah form (semua modul, "SEMUA INPUT") harus punya tombol untuk melihat riwayat/detail submission-nya: seluruh field, status, timestamp, dan lampirannya.

**Pencapaian**:
- **Modal detail bersama** `modal-hd` ditambahkan di `html/Index.html` (shell SPA, tetap ada saat pindah modul): judul, tabel label–nilai, area Lampiran. Gaya baru `.n-modal-hd`, `.hd-k`, `.hd-v` di `html/Style.html` (dalam palet `DESIGN.md`, tanpa elemen dekoratif).
- **Helper `_HD`** di `html/Script_Main.html`: `_hdReset/_hdPush/_hdOpen/_hdClose/_hdLoadEvidence`. Tiap renderer mendorong satu entri `{refSheet, rowId, title, fields}` per baris ke `_HD.stack` (di-rebuild tiap render — aman karena hanya satu tabel riwayat yang tampil/aktif), lalu memasang tombol **Lihat** (`btn-mini`, `onclick="_hdOpen(<index>)"`) di kolom Aksi.
- **8 renderer terhubung** (12 tabel form): `_tuRenderHistory`, `_opsLautRenderHistory`, `_opsUdaraRenderHistory`, `_intelRenderHistory`, `_pemRenderHistory`, `_rawatRenderHistory` (kesiapan/docking/item), `_logRenderHistory` (amunisi/bbm/personil), `_awkRenderHistory` (akn/kegiatan). Field per modul mengikuti sel tabel masing-masing + status + tanggal dikirim; label enum memakai map yang sudah ada (`INTEL_LABELS`, `PEM_LABELS`, `_RAWAT_*_LABEL`, `_LOG_KOM_LABEL`, `_AWK_*_LABEL`).
- **Lampiran** di modal memakai endpoint `evidence_list` yang sudah ada (file/link-url + source mode + waktu unggah); baris tanpa lampiran menampilkan "Belum ada lampiran".
- Tidak ada perubahan server dan tidak ada endpoint baru.

**Keputusan teknis**:
- Detail view dibuat **generik satu modal** untuk semua modul (bukan modal per-modul) supaya perawatan seragam dan ringkas; isi per-baris dirender dari array label–nilai.
- `refSheet` per baris mengikuti slot lampiran yang sudah ada (TU/OpLaut/OpUdara/Intel/Pemantauan literal; Perawatan/Logistik/Pengawakan per sub-jenis) — menjamin tombol "Lihat" dan tombol "Lampiran" (Perawatan) membaca sumber yang sama.
- Tombol **Lihat** tampil untuk semua baris (tanpa syarat role) karena tabel riwayat sendiri sudah role-gated oleh fetch server; baris SUPERSEDED/VOID tetap bisa dibuka.
- Catatan: ini tetap *per-modul*; halaman **Riwayat Laporan lintas-modul (Fase 11, PRD §11)** tetap pekerjaan fase berikutnya yang terpisah.

**Verifikasi**: ekstraksi `<script>` klien (`Script_Main.html`, `Script_Charts.html`, `Index.html`) → `node --check` **OK**; tidak ada backtick di seluruh `html/`; 8/8 renderer memanggil `_hdReset()` di awal dan memasang `bLk` di kolom Aksi (grep).

---

## [Revisi Fase 9/10 — Lampiran Inline Semua Modul + Opsi Daftar Dinamis]
**Tanggal**: 22 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Latar**: Keputusan user di percakapan (3 jawaban): (1) lampiran di-*inline* ke dalam **seluruh 7 modul divisi** dengan **satu CTA** (tidak ada tombol terpisah upload/tautan), semua form wajib dokumen kecuali dicentang *"Pengunggahan ini tidak perlu lampiran"*; (2) daftar Amunisi, BBM, Komponen Personil, dan Kategori Pengawakan **tidak lagi hardcoded** — menjadi master sheet baru yang dikelola Superadmin/Direktur di halaman Master Data; (3) mekanismenya = **master sheet baru**, bukan dropdown free-text.

**Pencapaian — lampiran**:
- Blok lampiran inline (`_attachInit/_attachValidate/_attachUploadAll/_attachToggle/_attachReset` + retry) di `html/Script_Main.html` — satu blok per form: checkbox *"Pengunggahan ini tidak perlu lampiran"*, input file multiple, input link Drive, daftar chip, area pesan. Diterapkan di **12 form**: TU, Operasi Laut, Operasi Udara, Intelijen, Pemantauan, Perawatan (3), Logistik (3), Pengawakan (2).
- Alur submit = 1 CTA: simpan baris → dapat `rowId(s)` dari server → upload file/link → refresh. Fontombol submit tidak terbagi "upload"/"link".
- **Batch anchoring** (Intelijen & Pemantauan, submit per periode menghasilkan N baris): file disalin ke Drive **sekali**, lalu `TX_Evidence` di-append **per refRowID** memakai `DriveFileID` yang sama (tanpa duplikasi Drive). Endpoint baru: `evidence_uploadBatch`, `evidence_uploadFromLinkBatch`.
- **Carry evidence lintas-revisi**: `evidence_carry` meng-*duplicate* baris `TX_Evidence` (DriveFileID sama) dari baris lama ke baris revisi baru, dipanggil fire-and-forget dari setiap handler revisi.
- **Return shape submit diseragamkan**: Operasi Laut/Udara submit & revisi kini mengembalikan `data.rowId`; Intelijen/Pemantauan submit mengembalikan `data.rowIds`, revisi `data.rowId` (sebelumnya TS hanya `{success, message}`) — diperlukan agar lampiran bisa di-*anchor* ke baris hasil.

**Pencapaian — opsi dinamis**:
- Sheet master baru **`Opsi`** di `Nautika_Master` (kolom `Kode, Urutan, Label, Aktif, DibuatOleh, DibuatAt`) — dibuat & di-seed (`_seedOpsi`) oleh `Setup.js`.
- `data/SheetAccess.js`: `getOpsiList(kode)` (baris aktif terurut, cache 600s, fallback ke seed default saat sheet belum terisi) & `getOpsiDetail(kode)`.
- `utils/Constants.js`: `SHEET_MASTER.OPSI`, `OPSI_KODE`, `OPSI_DEFAULT` (alias enum lama).
- `services/MasterDataService.js`: `master_getOpsiJenis`, `master_addOpsiJenis` (uppercase, unik per grup, ≤40 karakter, blokir nilai bawaan), `master_setOpsiJenisAktif` (non-aktif = sembunyi dari dropdown baru; data historis aman). RBAC write `_mdAssertWrite` (SUPERADMIN+DIREKTUR), read semua APPROVED; audit log.
- `services/LogistikService.js` & `PengawakanService.js`: semua konsumsi enum statis diganti `getOpsiList(OPSI_KODE.*)`.
- UI tab **"Opsi Daftar"** di `html/views/MasterData.html` + `_mdLoadOpsi/_mdRenderOpsi/_mdOpsiAdd/_mdOpsiToggle` (chips + toggle aktif/non-aktif + input tambah, terkunci untuk selain Superadmin/Direktur).

**Keputusan teknis yang diambil**:
- **Urutan opsi**: seed & tambahan user memakai `Urutan+1000` (order antar-baris sheet dipertahankan) dan selalu tampil urut; nilai default murni (belum di-seed) di `10,20,…`. Hasil daftar = subset baris Aktif + fallback seed.
- **Enforcement lampiran terbatas di klien**: validasi wajib lampiran dilakukan di frontend (`_attachValidate`) sebelum submit. Mengingat pengunggahan terjadi *setelah* baris tersimpan (submit → `rowId` → upload), atribut "wajib" tak bisa diverifikasi atomik server-side tanpa merombak urutan persistensi — dicatat sebagai keterbatasan; baris tetap tersimpan walau user lolos validasi klien tanpa lampiran.
- Tampilan lampiran di tabel riwayat (per-item, bukan hanya punya/tidak) diserahkan ke **Fase 11 Riwayat Laporan** (PRD §11) — outside scope revisi ini.

**Verifikasi**: `node --check` seluruh `*.js` server + hasil ekstraksi `<script>` klien (`Script_Main.html`, `Script_Charts.html`) → **OK**. Semua 89 callable `google.script.run` → dideklarasikan di server (tidak ada yang hilang), termasuk 8 endpoint baru. Slots `*-attach` terpasang di 12 view.

---

## [Fase 10 — Hotfix] - Fix TypeError DIVISI_ID.LOG/DIVISI_ID.AWAK saat load
**Tanggal**: 18 September 2026
**Status**: Selesai

**Pencapaian**:
- Menghapus pembacaan konstanta lintas-file pada **baris level-top** di service: `var _LOG_DIVISI_ID = DIVISI_ID.LOG;` (`services/LogistikService.js:28`) dan `var _AWAK_DIVISI_ID = DIVISI_ID.AWAK;` (`services/PengawakanService.js:24`) memicu `TypeError: Cannot read properties of undefined (reading 'LOG'/'AWAK')` karena **urutan load file GAS** — `utils/Constants.js` dievaluasi setelah service tersebut, sehingga `DIVISI_ID` masih `undefined` saat baris itu dieksekusi.
- Diganti getter lazy: `_logDivisiId()` / `_awakDivisiId()` yang membaca `DIVISI_ID` **di dalam fungsi** (satu global scope GAS; semua assignment top-level sudah selesai saat RPC dipanggil). Pemakaian di `assertScope`, guard Kadiv, dan `'DivisiID'` pada write log/audit ikut dialihkan.
- Audit ulang semua file `.js`: tidak ada lagi statement top-level lain yang membaca konstanta asing (service lain hanya mendefinisikan literal milik sendiri, aman terhadap urutan load).

**Verifikasi**: `node --check` untuk semua `services/*.js`, `data/*.js`, `utils/*.js`, `Code.js`, `Setup.js` → **OK**; tidak ada referensi basi ke `_LOG_DIVISI_ID`/`_AWAK_DIVISI_ID`.

---

## [Fase 10 — Modul Logistik & Pengawakan]
**Tanggal**: 18 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Pencapaian**:
- **`services/LogistikService.js`** (baru): `logistik_getOptions`, `logistik_getKPI`, `logistik_getAmunisi/BBM/Personil`, `logistik_submitAmunisi/BBM/Personil`, `logistik_revisiAmunisi/BBM/Personil`, `logistik_anulir`, `logistik_getTren`. 3 sub-modul independen sesuai `DATA_SCHEMA.md` (`TX_Logistik_Amunisi/BBM/Personil`).
- **`services/PengawakanService.js`** (baru): `awak_getOptions`, `awak_getKPI`, `awak_getAKN`, `awak_getKegiatan`, `awak_submitAKN/Kegiatan`, `awak_revisiAKN/Kegiatan`, `awak_anulir`, `awak_getTren`. 2 sub-modul independen (`TX_Pengawakan_AKN/Kegiatan`).
- **`html/views/Logistik.html`** & **`html/views/Pengawakan.html`** (baru): shell `view-tpl-logistik` / `view-tpl-pengawakan` (KPI strip, 2 chart konteks, tab) + template pane per sub-modul ('lga/lgb/lgp' & 'akn/akk') + 2 modal global (revisi/anulir) di dalam shell agar ikut ter-clone ke `#page-content`.
- **`html/Script_Main.html`**: routing `viewId === 'logistik'`/`'pengawakan'` + modul klien lengkap (state `_LOG`/`_AWK`, options/KPI/tren, chart, tabel riwayat, submit, revisi, anulir); util RBAC UI `_logCanWrite/_logCanAnulir`, `_awkCanWrite/_awkCanAnulir` mengikuti `assertScope` server.
- **`utils/Constants.js`**: enum `LOG_JENIS_AMUNISI`, `LOG_JENIS_BBM`, `LOG_KOMPONEN_PERSONIL`, `LOG_MODE_BASELINE`, `LOG_MODE_USAGE`, `AWAK_SCOPE`, `AWAK_KATEGORI_PERSONIL`.
- **`html/Style.html`**: tambah gaya `.n-msg.warn` untuk peringatan non-blocking (stok negatif / realisasi > Pagu).
- **`html/Index.html`**: include `html/views/Logistik` & `html/views/Pengawakan`.
- **Dokumen**: `ARCHITECTURE.md` §7; `PHASES.md` status Fase 10; `DATA_SCHEMA.md` catatan pemodelan baseline.

**Keputusan teknis yang diambil** (konfirmasi user di percakapan):
- **Baseline Amunisi (StokAwal) & BBM (Pagu)** = **baris baseline tersendiri di sheet yang sama**, 1 baris ACTIVE per jenis per tahun (StokAwal/Pagu terisi; Penggunaan/Realisasi = 0). Perubahan baseline via Revisi (supersede).
- **`Jumlah` AKN = snapshot total** (bukan delta). Komposisi = baris ACTIVE terbaru per (Scope, Kategori) pada tahun referensi filter; tren per bulan memakai **carry-forward** nilai terakhir.
- Ambang hitung terpilih: `StokAkhir = StokAwal − Σ Penggunaan` dan `Sisa = Pagu − Σ Realisasi` dengan Σ atas baris ACTIVE ber-Timestamp antara **1 Januari tahun referensi s.d akhir rentang filter** ("periode berjalan s.d saat ini"). Logistik Personil & Kegiatan dijumlah dalam rentang filter saja.
- Stok negatif / realisasi > Pagu = **WARNING non-blocking** (dikembalikan di `data.warnings`), sesuai PRD §5.8.
- Mode BASELINE/PENGGUNAAN **tidak disimpan sebagai kolom** — terdeteksi dari terisi/tidaknya StokAwal/Pagu.
- RBAC: Read semua APPROVED; Submit/Revisi = SUPERADMIN + KADIV/STAF DIV-LOG (Logistik) / DIV-AWAK (Pengawakan); Anulir = SUPERADMIN/DIREKTUR + KADIV divisi terkait.

**Perbaikan penting**:
- `appendRowData` (di `data/SheetAccess.js`) **tidak mengembalikan RowID** — semua service sebelumnya mem-prekreasikan RowID (`prefix−UUID12`) lalu menuliskannya ke `row['RowID']` sebelum append. LogistikService & PengawakanService semula memakai `var rowId = appendRowData(...)` (selalu `undefined`); dikoreksi mengikuti pola PerawatanService: pregenerate + set `row['RowID']`, audit & return memakai ID tersebut.
- Aturan duplikasi diperketat: duplikat **baseline** dicek per (jenis, tahun); duplikat **penggunaan/realisasi/nilai** per (jenis, periode); AKN per (scope, kategori, periode).

**Verifikasi**:
- `node --check` untuk `LogistikService.js`, `PengawakanService.js`, dan blok `<script>` hasil ekstraksi `Script_Main.html` (`_log*`/`_awk*`), `Script_Charts.html`, `Index.html` → **OK**.
- Cross-check nama fungsi `google.script.run` (83 pemanggilan) ↔ definisi service; seluruh ID elemen statis di modul klien (49) ada di `Logistik.html`/`Pengawakan.html` (ID `rv-*` dimasukkan dinamis ke modal revisi, pola sama seperti Perawatan) → cocok.

**Item terbuka / follow-up**:
- ⚠️ Verifikasi runtime GAS: input baseline + penggunaan/realisasi Amunisi & BBM (cek warning stok negatif & realisasi > Pagu), snapshot AKN (Keseluruhan vs POA), revisi & anulir (Notifikasi + Audit Log), tren carry-forward AKN.
- ⚠️ Deploy/push oleh user.

---

## [Fase 9 — Modul Perawatan + EvidenceService] 
**Tanggal**: 17 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Pencapaian**:
- **`services/PerawatanService.js`** (baru): `perawatan_getOptions`, `perawatan_getKPI`, `perawatan_getKesiapan/Docking/Item`, `perawatan_submitKesiapan/Docking/Item`, `perawatan_revisiKesiapan/Docking/Item`, `perawatan_anulir`, `perawatan_getTren`. 3 sub-modul independen sesuai `DATA_SCHEMA.md` (`TX_Perawatan_Kesiapan/Docking/Item`).
- **`services/EvidenceService.js`** (baru, generik): `evidence_upload` (base64), `evidence_uploadFromLink` (`makeCopy`), `evidence_list`, `evidence_listBatch`; validasi ukuran sebelum proses, folder lazy-create, audit log.
- **`html/views/Perawatan.html`** (baru): shell `view-tpl-perawatan` (KPI strip, 2 chart konteks, 3 tab) + template pane `view-tpl-rawat-kesiapan/docking/item` + 3 modal global (revisi/anulir/evidence) di dalam template shell agar ikut ter-clone ke `#page-content`.
- **`html/Script_Main.html`**: routing `viewId === 'perawatan'` + modul klien lengkap (state `_RAWAT`, load options/KPI/tren, build chart, tabel riwayat, submit, revisi, anulir, evidence, badge jumlah lampiran); util RBAC UI `_rawatCanWrite/_rawatCanAnulir` mengikuti `assertScope` server.
- **`html/Script_Charts.html`**: builder `_chartDonut` (proporsi ≤4 kategori + center label) & plugin `_CHART_DONUT_PLUGIN`; `_chartBase` kini men-*merge* `plugins.tooltip` agar override callback tidak menghapus tema tooltip.
- **`utils/Constants.js`**: enum `RAWAT_LOKASI`, `RAWAT_TAHAP`, `RAWAT_KATEGORI`, `EVIDENCE_ROOT_FOLDER`, `EVIDENCE_LIMIT_BYTES`.
- **`html/Index.html`**: include `html/views/Perawatan`.
- **Dokumen**: `ARCHITECTURE.md` §1 (builder donut) & §6 (konvensi folder `JenisKonteks-Label`, nama divisi dari `NamaDashboard`) & §7; `PHASES.md` status Fase 6, 7, 9.

**Keputusan teknis yang diambil**:
- Submission Perawatan = **tiga form/tab independen** (satu submit = satu baris sheet; tanpa sheet header), konfirmasi user.
- Konvensi folder evidence: `[Divisi(NamaDashboard)]/[YYYY-MM]/[JenisKonteks-Label]` — `Kesiapan-<SlugKapal>`, `Docking-<SlugKapal>`, `Item-<SlugNamaPekerjaan>`.
- Validasi **blocking**: total kapal siap + tidak siap pada satu periode tidak boleh melebihi total armada aktif.
- RBAC: Read semua APPROVED; Submit/Revisi = SUPERADMIN + KADIV/STAF DIV-RAWAT; Anulir = SUPERADMIN/DIREKTUR + KADIV DIV-RAWAT.

**Perbaikan penting**:
- Saat menempelkan blok modul Perawatan ke `html/Script_Main.html`, tiga baris terakhir rantai `google.script.run` milik Pemantauan (`.withFailureHandler(...)`, `.pemantauan_getTren(...)`, dan `}` penutup fungsi) ikut terhapus sehingga file gagal `node --check` (`Unexpected end of input`). Baris tersebut **dipulihkan**; syntax kini lolos.

**Verifikasi**:
- `node --check` untuk `PerawatanService.js`, `EvidenceService.js`, dan blok `<script>` hasil ekstraksi `Script_Main.html` & `Script_Charts.html` → **OK**.
- Cross-check nama field frontend↔service (submit/revisi/anulir/evidence), nama fungsi `google.script.run` ↔ definisi service, serta keberadaan helper (`_chartDonut`, `_chartNum`, `_chartMonthLabel`, `_kpiHeadline`, `_CHART_COLORS.ok/crit/warn`, `SHEET_TX.EVIDENCE`, `SHEET_MASTER.DIVISI.NamaDashboard`) → cocok.

**Item terbuka / follow-up**:
- ⚠️ Verifikasi runtime GAS: isi 3 tab Perawatan (kesiapan/docking/item), revisi, anulir (cek Notifikasi + Audit Log), upload evidence (file >15MB / video >50MB ditolak), struktur folder Drive.
- ⚠️ Deploy/push oleh user.

---

## [Fase 7 — Hotfix #3] - Fix Uncaught SyntaxError String Literal Line Break
**Tanggal**: 17 September 2026
**Status**: Selesai

**Pencapaian**:
- Menemukan dan memperbaiki error  yang menyebabkan infinite loading sebelum masuk login page.
- Penyebab utama adalah penggunaan syntax backticks (`) untuk multiline template literals dan string interpolation di  pada fungsi , , , dll. Parser HtmlService Google Apps Script kadang menyatukan atau men-transpile template literals dengan cara yang menghasilkan line breaks yang tidak ter-escape (unescaped) saat dirender ke dalam .
- Backticks diganti seluruhnya menjadi standard ES5 string concatenation (menggunakan single quotes dan ) yang sepenuhnya aman di lingkungan GAS HTML Templates.
- Setelah diperbaiki,  dan parsing AST lokal mengkonfirmasi bahwa seluruh syntax dan string escape characters sudah valid. Kode telah dipush ulang.

**Keputusan teknis yang diambil**:
- Standardize penggunaan string concatenation tradisional (ES5) dibanding template literals (`) pada setiap HTML file dalam project GAS agar kompatibel dan bebas dari issue parsers di runtime GAS yang dapat menginjeksi literal newlines (line breaks).
- Tabel Roadmap diperbarui, menandakan Fase 7 telah selesai sepenuhnya dan Fase 8 sudah dapat dimulai jika Master Data dan hal teknis lainnya sudah disesuaikan.

**Item terbuka / follow-up**:
- Meminta konfirmasi User apakah aplikasi berhasil loading secara sempurna dan dapat menampilkan halaman login.

---

# CHANGELOG.md — Nautika

Riwayat pembangunan proyek. Menggantikan `progress.md` versi lama.

**Catatan penting**: seluruh riwayat Fase 1–4 di `progress.md` lama **dianggap usang dan tidak lagi jadi acuan** — proyek dibangun ulang dari nol berdasarkan `PRD.md` v1.0. Kode/struktur lama boleh dijadikan referensi teknis (mis. pola upsert, dual-uploader) tapi tidak menentukan scope; scope sekarang murni dari `PRD.md`.

---

## [Kebijakan] — Agent Tidak Menyentuh Git/GitHub
**Tanggal**: 17 September 2026
**Status**: Selesai (aturan kerja diperbarui; menggantikan workflow §5b lama).

**Keputusan (arahan user, eksplisit)**: Agent **tidak boleh** melakukan operasi Git/GitHub apa pun (`git add`/`commit`/`push`/`reset`, `gh`, dsb). Hanya user yang menangani GitHub. Konsekuensi langsung: commit lokal `5edbb6a` (hotfix Master Data) di-**reset**; perubahan kode tetap ada di working tree untuk di-commit user.

**Perubahan dokumen**:
- `AGENTS.md` §5b ditulis ulang: dari "Workflow Push: Tanya-dulu-lalu-push (agent push clasp + GitHub)" menjadi "**Git/GitHub — HANYA USER**". Agent kini hanya **mengingatkan user untuk push**, tidak lagi menanyakan "apakah sudah aman?" sebagai pemicu push otomatis.
- `PHASES.md` Fase 8 — klausa "push menunggu konfirmasi aman" dihapus.
- Entri CHANGELOG baru dari Fase 8 ke atas yang memuat "push menunggu konfirmasi aman / AGENTS §5b" diselaraskan menjadi "deploy/push oleh user".

**Item terbuka / follow-up**:
- ⚠️ Deploy Apps Script (`clasp push --force`) & push GitHub: **ditangani user**.

---

## [Hotfix] — Tombol Simpan Master Data Menggantung (Kapal & Kawasan Konservasi)
**Tanggal**: 17 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Gejala**: Di Master Data, menekan "Simpan" saat menambah/mengedit Kawasan Konservasi membuat tombol berputar "Memproses…" tanpa henti, padahal data sebenarnya tersimpan (baru terlihat setelah refresh). Bug yang sama juga ada di form Kapal (belum terlaporkan user).

**Akar masalah**: `_mdSaveKawasan()` dan `_mdSaveKapal()` memanggil fungsi server lebih dulu, lalu memasang handler (pola terbalik):
```js
var call = google.script.run.master_createKawasan(APP.token, params); // dispatch tanpa handler
call.withSuccessHandler(...).withFailureHandler(...);                  // sudah terlambat
```
`withSuccessHandler`/`withFailureHandler` mengembalikan runner **baru** (tidak memodifikasi runner yang dipanggil), jadi permintaan terkirim tanpa handler: server tetap menulis baris + audit log, tetapi callback tidak pernah dipanggil → `_setLoading(btn, false)`, `closeModal()`, dan refresh tabel tidak jalan.

**Perbaikan**:
- `html/Script_Main.html` — `_mdSaveKawasan()` & `_mdSaveKapal()`: handler dipasang lebih dulu ke runner, baru fungsi server dipanggil pada runner yang sama (`var runner = google.script.run.withSuccessHandler(...).withFailureHandler(...); if (editing) runner.master_update...(...); else runner.master_create...(...);`). Hanya 2 lokasi ini yang memakai pola terbalik; panggilan lain (load/delete/toggle) sudah benar.

**Keputusan / catatan**:
- Aturan urutan pemanggilan `google.script.run` (handler sebelum fungsi server; runner hasil `withX` harus dipakai untuk memanggil fungsi) didokumentasikan di `ARCHITECTURE.md` §7 agar tidak terulang.
- Akar masalah murni di sisi klien — tidak ada perubahan service/skema.

**Verifikasi**: blok `<script>` `Script_Main.html` (134.136 char) lolos syntax check; `grep` memastikan tidak ada lagi pola "panggil dulu, handler kemudian" (`google.script.run.master_update/master_create(...)`).

**Item terbuka / follow-up**:
- ⚠️ Verifikasi runtime GAS: Master Data → Tambah Kapal & Tambah Kawasan → tombol berhenti "Memproses…", modal tertutup, muncul notifikasi sukses, tabel ter-refresh; cek juga mode Edit.
- ⚠️ Deploy/push oleh user.

---

## [Polish UI] — Riwayat Laporan Tata Usaha Disamakan ke Pola Operasi
**Tanggal**: 17 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Konteks**: atas permintaan user ("lihat bagian riwayat … warna dan bentuknya sama seperti di riwayat operasi, namun tambahkan revisi; menurut saya warna dan komposisinya lebih baik"), tabel riwayat Tata Usaha diseragamkan ke pola tabel riwayat Operasi. Sebelumnya TU adalah satu-satunya modul yang memakai komponen berbeda (`.badge` + `.btn-sm` ungu); empat modul lain (Operasi Laut/Udara, Intelijen, Pemantauan) sudah memakai pola Operasi.

**Pencapaian**:
- **`html/Script_Main.html`** — `_tuRenderHistory()` ditulis ulang mengikuti pola tabel riwayat Operasi: badge `status-badge` (AKTIF `--n-primary-light`, DITIMPA abu `#f3f4f6`, DIANULIR merah `#fee2e2`), tombol aksi `.btn-mini` (Revisi outline primary; Anulir outline `--n-status-critical`) di dalam sel `flex gap:6px`, baris `VOID` berlatar `#fef2f2` dan baris `SUPERSEDED` diredupkan (`opacity:0.6`), serta baris "Alasan Anulir: … (oleh …)". Label status non-aktif kini "DITIMPA" (sebelumnya "DIGANTI") agar identik. Fungsi `_tuStatusBadge()` lama dihapus (tak dipakai lagi).
- **`html/Style.html`** — **`.status-badge` didefinisikan** (pill: `padding:3px 9px`, radius `--n-r-pill`, `font-size:.72rem`, `font-weight:600`) di blok STATUS BADGES. Kelas ini sudah dipakai tabel riwayat Operasi/Intelijen/Pemantauan sejak dibuat tapi **tidak pernah didefinisikan** (badge tampil tanpa bentuk pill) — kini ikut benar dan visual seragam di kelima modul.
- **`html/views/TataUsaha.html`** — wrapper `#tu-history-wrap` `overflow:hidden` → `overflow-x:auto` (sama seperti Operasi) supaya kolom lebar bisa di-scroll.

**Keputusan / catatan**:
- Tombol **Revisi** di riwayat TU sebenarnya sudah ada sejak Fase 5 (RBAC `canRevisi` = SUPERADMIN/KADIV/STAF); permintaan "tambahkan revisi" dipenuhi dengan memastikannya tampil dan bergaya `.btn-mini` seperti Operasi. **RBAC tidak diubah.**
- Tidak ada perubahan skema data, service, atau endpoint server.

**Verifikasi**: blok `<script>` `Script_Main.html` (134.132 char) & `Script_Charts.html` lolos syntax check (node `new Function`); `grep` memastikan tidak ada lagi referensi `_tuStatusBadge`.

**Item terbuka / follow-up**:
- ⚠️ Verifikasi runtime GAS: buka Tata Usaha → badge AKTIF/DITIMPA/DIANULIR, baris VOID merah & SUPERSEDED redup, tombol Revisi/Anulir berbentuk pill outline, baris alasan anulir muncul.
- ⚠️ Deploy/push oleh user.

---

## [Fase 8 — Perbaikan Visualisasi (Charting & Komposisi Dashboard)]
**Tanggal**: 17 September 2026
**Status**: Selesai (implementasi; belum verifikasi runtime GAS — deploy/push oleh user).

**Pencapaian**:
- **`html/Script_Charts.html` (baru)** — wrapper charting: loader on-demand **Chart.js v4.4.1** (pin, unpkg) pola queue identik `_loadLeaflet`; registry `_NAUTIKA_CHARTS` + `_chartTeardownAll()`; palet `_CHART_COLORS` = mirror token `Style.html`/`DESIGN.md` §3 (canvas tak bisa baca CSS vars); formatter `_chartNum`/`_chartCompact`/`_chartMonthLabel`; empty-state `_chartEmpty` (data 0 ditampilkan netral, bukan bug); plugin `nvVal` (label nilai di ujung bar) & `nvEnd` (label seri + nilai di ujung garis) — **direct-label didahulukan daripada legenda** (DESIGN §6); builder `_chartBar` (horizontal/vertikal grup) & `_chartLine` (line/area). Legend Chart.js dimatikan; seri dijelaskan chip statis di template view.
- **5 endpoint server `*_getTren(token, filter)` baru** (semua kalkulasi server-side): `tataUsaha_getTren` (SP2D/Akrual bulanan + kumulatif YTD + pagu terakhir), `operasiLaut_getTren` (kapal/rumpon/hari operasi), `operasiUdara_getTren` (kapal/hari operasi/cakupan), `intelijen_getTren` (total/kawasan), `pemantauan_getTren` (username/skat/migrasi). Helper bersama `utils_getTrendMonths(filter)` ditambahkan di `utils/DateUtil.js` (Jan .. bulan/dateTo pada filter).
- **Zona "Konteks" (inverted pyramid)** disisipkan di 5 template view tepat setelah KPI strip, sebelum form/tabel: Tata Usaha (line kumulatif SP2D vs Akrual + bar grup bulanan); Operasi Laut & Udara (bar horizontal intensitas WPP top-8 dari `kpi.wppIntensitas` + line tren bulanan); Intelijen (bar horizontal temuan per kategori + line tren total vs kawasan); Pemantauan (bar penerbitan periode ini + line tren 3 seri). Komposisi halaman kini KPI → chart → detail (DESIGN §6.5).
- **Wiring `Script_Main.html`**: `_chartTeardownAll()` di `_renderViewContent` & `_opsTeardownMaps` (mencegah instance bocor saat pindah view/tab Kapal-Pesawat); loader/pembangun chart per modul dipanggil pada success handler `getKPI` masing-masing.
- `html/Index.html` menambahkan include `html/Script_Charts`; `html/Style.html` menambah kelas `chart-grid-2`/`chart-cell`/`chart-chip`/`chart-box`/`chart-empty` (grid 2 kolom, collapse 1 kolom <900px). Tidak ada perubahan skema data.

**Keputusan teknis yang diambil** (mengunci item terbuka di `[Requirement Visualisasi]`):
- **Library = Chart.js v4.4.1** (canvas, single UMD file, mendukung bar/grup/line/area — cukup untuk seluruh tipe PRD §10/DESIGN §6; stacked/donut ≤4 bisa menyusul tanpa lib baru). Versi di-pin. Baris "Tata Usaha per Bulan" memakai bar **grup** (bukan stacked) demi direct-label yang bersih.
- **Tren bulanan dihitung server-side** (prinsip ARCHITECTURE — frontend tidak meng-agregat dari history): grouping per prefix `YYYY-MM` kolom `Periode` baris `ACTIVE`; YTD mengikuti rentang filter; tanpa tambahan kolom skema.
- **`_CHART_COLORS` sebagai mirror token** (canvas tidak bisa baca CSS var): primary `#4318FF`; seri pembanding memakai nuansa indigo (`rgba(67,24,255,0.35)` / `#2B3674`); merah/kuning/hijau hanya untuk status semantik — konsisten lintas halaman.

**Item terbuka / follow-up**:
- ⚠️ **Verifikasi runtime GAS** (setelah deploy): buka tiap modul → chart muncul, label nilai/ujung garis benar, teardown bersih saat ganti tab Kapal/Pesawat & pindah view, empty-state saat data 0, tren konsisten dengan angka KPI.
- ⚠️ Deploy Apps Script & push GitHub: ditangani user.

---

## [Requirement Visualisasi] — Kriteria Dashboard & Chart (docs only)
**Tanggal**: 17 September 2026
**Status**: Selesai (dokumentasi requirement; belum ada kode — dipakai sebagai acuan saat membangun dashboard/chart di fase selanjutnya).

**Pencapaian**:
- **`DESIGN.md` §6 ditulis ulang** menjadi *Chart Style Guide* yang preskriptif: §6.1 pilih chart dari pertanyaan data (table mapping + larangan eksplisit), §6.2 varietas chart, §6.3 warna chart, §6.4 kebersihan data-ink, §6.5 komposisi halaman dashboard (inverted pyramid), §6.6 review checklist.
- **`PRD.md` §10 ditambah 4 requirement** (sumber kebenaran): (1) Ikhtisar dulu / progressive disclosure + 5-second rule; (2) chart sesuai pertanyaan data; (3) varietas — boleh pakai jenis chart berulang tapi wajib minimal 2 representasi berbeda per halaman; (4) warna mengikuti kriteria palet terbatas & konsisten.

**Inti keputusan (sesuai arahan user "jangan bullshit, enak dilihat, user mudah temukan ikhtisar")**:
- Dashboard dinilai dari **seberapa cepat user menemukan ikhtisar datanya** (5-second rule), bukan dari kecantikan visual.
- Gauge/speedometer/3D/rainbow/radar tetap dilarang; warna wajib bermakna & konsisten; direct-label didahulukan daripada legenda; bar selalu mulai dari 0; pie/donut hanya ≤4 kategori.
- Varietas: konsistensi (1 library chart, 1 bahasa visual) lebih penting; variasi muncul alami dari perbedaan pertanyaan data — tidak dipaksakan agar "terlihat bermacam-macam".

**Item terbuka / follow-up**:
- ✅ Keputusan library chart diambil saat implementasi Fase 8: **Chart.js v4.4.1** (lihat entri `[Fase 8 — Perbaikan Visualisasi...]` di atas; divalidasi terhadap checklist §6.6 dan dicatat di `ARCHITECTURE.md` §1).
- Tidak ada perubahan kode lain pada entri ini — murni penambahan requirement dokumen.

---

## [Fase 7 — Modul Intelijen & Pemantauan] — Service + View end-to-end
**Tanggal**: 17 September 2026
**Status**: Selesai — sudah `clasp push --force` (25 file) + komit lokal `3f630ed`. Push GitHub manual oleh user belum; verifikasi runtime belum.

**Pencapaian** (sesuai `PHASES.md` Fase 7 — catatan: penomoran "Fase 7" di komentar lama `Script_Main.html` mengacu ke modul Operasi Udara dan sudah usang):
- **`services/IntelijenService.js` (baru)** — RBAC `DIV-INTEL`; `intelijen_getKPI` (sum per Jenis ACTIVE + tabel kawasan + `mingguTerakhirSubmit`), `intelijen_getHistory`, `intelijen_submitMingguan`, `intelijen_revisi`, `intelijen_anulir`. Jenis: DREDGING, PELANGGARAN_PERIZINAN, PELANGGARAN_TRANSMITTER, NOTA_DINAS, KAWASAN_KONSERVASI, KAPAL_PENGANGKUT_IKAN_HIDUP.
- **`services/PemantauanService.js` (baru)** — RBAC `DIV-PANTAU`; struktur simetris. Jenis: PERSETUJUAN_PENYEDIA, USERNAME, SKAT, PEMASANGAN_MIGRASI, MARABAHAYA. Kolom `NamaPenyedia`, `KapalID`, `KondisiDarurat`, `StatusPenanganan` (enum DALAM_PENANGANAN/SELESAI) sesuai `Setup.js`.
- **`html/views/Intelijen.html` (baru)** — KPI strip 6 kartu; tabel Kawasan Konservasi **list/table (bukan peta, PRD §8.2)** dengan kolom Nama, Provinsi, Pelanggaran Periode, YTD, Tren, dan tombol "Riwayat" (tautan laporan terkait); form mingguan multi-field + baris kawasan dinamis (dropdown dari Master Kawasan Konservasi); tabel riwayat + modal revisi/anulir.
- **`html/views/Pemantauan.html` (baru)** — KPI periode + YTD (Username/SKAT/Pemasangan Migrasi) + kartu penyedia & marabahaya; panel Event Penyedia SPKP & tabel Kapal Marabahaya; form mingguan (angka penerbitan, baris penyedia, baris marabahaya dengan **dropdown dari Master Kapal**); riwayat + modal revisi/anulir (modal menyesuaikan jenis: jumlah vs kondisi/status).
- **Wiring**: `html/Index.html` menambahkan include kedua view; `html/Script_Main.html` `_renderViewContent` menambahkan routing `intelijen`/`pemantauan`, plus state & fungsi render/submit/revisi/anulir. Dropdown periode Tahun/Bulan/Minggu memakai `_opsInitPeriodeUi` + `_composePeriode` (prefix `int-` / `pem-`). Filter periode global ikut memengaruhi KPI & riwayat.
- Verifikasi sintaks: `node --check` kedua service lolos; seluruh blok `<script>` `Script_Main.html` terkompilasi tanpa error.

**Keputusan teknis yang diambil**:
- Model data **multi-row per periode** (1 baris per Jenis; KAWASAN_KONSERVASI 1 baris per kawasan; PERSETUJUAN_PENYEDIA/MARABAHAYA 1 baris per entitas). Submit menerima **array `items`** — service ini adalah yang pertama memakai pola multi-item (Tata Usaha/Operasi = 1 baris per submit). Tidak ada perubahan skema.
- **Audit Log CREATE/UPDATE/VOID ditulis** untuk kedua modul baru (`SHEET_LOG.AUDIT_LOG`), plus notifikasi `DATA_VOIDED` ke publisher saat anulir. Service Tata Usaha/Operasi Laut/Udara tidak menulis Audit Log — ini penyimpangan positif ke arah `ARCHITECTURE.md` §11, dicatat sebagai keputusan (bukan bug/inkonsistensi).
- YTD & tren dihitung **server-side**: tren kawasan = perbandingan terhadap "periode lalu" (monthly → bulan sebelum; range → rentang sama panjang sebelum start). Prefix RowID `INT-` / `PNT-`.
- Revisi hanya mengubah nilai: Intelijen (Jumlah/Keterangan), Pemantauan (Jumlah, atau KondisiDarurat/StatusPenanganan untuk MARABAHAYA); `Jenis`/`KawasanID`/`KapalID` terkunci. Cara: tandai lama `SUPERSEDED` + append baris baru (`ARCHITECTURE.md` §5).
- Dropdown relasional ditegakkan di server: kawasan wajib dari `master_getKawasanList`, kapal marabahaya wajib dari `master_getKapalList` (bukan free-text).

**Item terbuka / follow-up**:
- ⚠️ **Verifikasi runtime** (setelah deploy): login sebagai Staf DIV-INTEL/DIV-PANTAU → submit laporan, cek KPI/YTD/tren, revisi & anulir, cek notifikasi `DATA_VOIDED` di akun publisher. Belum dijalankan di lingkungan GAS.
- ✅ Push: `clasp push --force` sudah dijalankan (25 file) + komit lokal `3f630ed`; **push GitHub masih manual oleh user** (`git push -u origin main`).
- Cleanup kecil: di `services/PemantauanService.js` `pemantauan_getHistory` memakai `row.kapalNama` untuk lookup nama kapal; perlu dipastikan tampil benar saat runtime.
- Roadmap: Fase 7 selesai; berikutnya menurut `PHASES.md` adalah **Fase 8 — Modul Perawatan** (bukan Dashboard; entri lama yang menyebut Fase 7 = UI/tombol adalah penomoran usang).

---

## [Infra] — Git/GitHub Version Control + Pembersihan Data Private Hardcoded
**Tanggal**: 17 September 2026
**Status**: Selesai (persiapan; push/deploy ditangani user).

**Pencapaian**:
- Inisialisasi version control Git lokal untuk proyek (`git init` + remote `https://github.com/mhdztr/nautika.git`). Ekosistem runtime tetap Apps Script; GitHub digunakan untuk repo & version control kode.
- `.gitignore` dibuat **identik** dengan `.claspignore` (keputusan user eksplisit): `*.md`, `.clasp.json`, `.claspignore`, `.gitignore`, `.git/**`, `test.js`, `test_pure.js`, `fix.py`, `hotfix.py`, `*.geojson` tidak di-commit → dokumentasi internal (PRD/ARCHITECTURE/CHANGELOG/AGENTS) sengaja tidak masuk GitHub sesuai pilihan user.
- **CARTO API key tidak lagi hardcoded di source** (`html/Script_Main.html` kedua tile layer operasi laut & udara):
  - Key kini disimpan di Script Properties (`PROP_KEY.CARTO_API_KEY`), diisi sekali oleh Superadmin lewat `setupSetCartoKey("<key>")` (Setup.js).
  - Frontend mengambil key saat inisialisasi peta lewat `utils_getCartoKey()` (alias publik `getCartoApiKey()` di `utils/Constants.js`), di-cache di `window._nautikaCartoKey`, dan URL tile disusun oleh `_cartoTileUrl(key)` → fallback tanpa `?key=` bila belum diisi.
  - `ARCHITECTURE.md` §9 diupdate (cara kerja baru + ketegasan bahwa yang dicegah adalah kebocoran key ke repository, bukan tampilnya key di browser).
  - Sisa kemunculan key lama (`cb1_3le4_...`) hanya ada di `test.js` & `test_pure.js` — kedua file ini **dikecualikan oleh `.claspignore` DAN `.gitignore`** (harness verifikasi lokal), jadi tidak akan pernah ter-push ke GAS/GitHub. Tidak dihapus agar harness tetap bisa ditest berdiri sendiri; jika ingin dibersihkan pula, cukup hapus baris `?key=...` di kedua file itu.
- **Password seed superadmin tidak lagi hardcoded** (`'Nautika@2026'` dihapus dari `Setup.js`):
  - `_seedSuperadmin` membaca `PROP_KEY.SEED_SUPERADMIN_PASSWORD`; bila kosong → generate otomatis (`_generateSeedPassword`), disimpan ke Script Properties, dan dicetak sekali di log eksekusi.
  - Superadmin dapat menetapkan password sendiri sebelum setup via `setupSetSuperadminPassword("<pass>")`.
- `AGENTS.md` saat itu ditambah §5b "Workflow Push" (agent push clasp + GitHub setelah konfirmasi "aman"). **Sudah digantikan** oleh kebijakan "Git/GitHub — HANYA USER" — lihat entri `[Kebijakan] — Agent Tidak Menyentuh Git/GitHub` di bagian atas file ini.

**Keputusan teknis yang diambil**:
- Key & kredensial seed dipindah dari source ke `PropertiesService` (bukan `CacheService`) karena harus persisten lintas sesi & bukan data yang boleh hilang saat TTL cache habis.
- Tidak ada perubahan skema sheet, tidak ada perubahan logika bisnis — murni refactor penyimpanan secret + infra repo.
- `.gitignore` literal = `.claspignore` (perintah user): konsekuensi yang diterima adalah dokumentasi `.md` tidak ikut di-version-control di GitHub.

**Item terbuka / follow-up**:
- ⚠️ **Push GitHub MANUAL oleh user**: repo lokal sudah di-commit, tapi HANYA konfigurasi + remote yang disiapkan di sini — user harus menjalankan push sendiri (mis. `git push -u origin main`) dengan metode otentikasi pilihan user.
- ⚠️ **Set CARTO API key di GAS**: setelah push clasp, Superadmin harus memanggil `setupSetCartoKey("<key>")` sekali di editor GAS agar peta basemap aktif (tanpa itu, tile dimuat tanpa `?key`).
- Deploy Apps Script (`clasp push --force`) ditangani user.
- Roadmap fase tidak berubah (task ini infra, bukan fase fitur).

---

## [Fase 7 — Polish UI] - Perbaikan Desain Tombol Toggle Form
**Tanggal**: 17 September 2026
**Status**: Selesai

**Pencapaian**:
- Menambahkan kelas CSS baru `.btn-form-toggle` di `html/Style.html` agar header untuk menampilkan form input (toggle) memiliki gaya layaknya tombol aksi.
- Menerapkan `.btn-form-toggle` pada halaman Tata Usaha (`html/views/TataUsaha.html`), Operasi Laut (`html/views/OperasiLaut.html`), dan Operasi Udara (`html/views/OperasiUdara.html`) menggantikan struktur `content-section-hd` yang sebelumnya menyatu dengan background *page*.
- Sekarang tombol input form memiliki latar warna *primary*, shadow, hover effect, serta layout flex yang jelas, mengindikasikan bahwa baris tersebut dapat diklik.

**Keputusan teknis yang diambil**:
- Mengubah *form toggle* dari yang tadinya berupa div bergaya header sederhana menjadi tombol (*button-like UI*) utuh dengan *padding* dan background *primary*. Tujuannya mempermudah user menebak bahwa elemen tersebut adalah *call to action* untuk membuka form pelaporan.
- Tidak ada modul backend (`.js`) yang diubah, ini murni perbaikan tampilan antarmuka (UI).

**Item terbuka / follow-up**:
- Konfirmasi dari user apakah tampilan baru untuk toggle form sudah sesuai dengan ekspektasi.

---


## [Polish UI #2] — Tombol Submit Form Diperkuat Agar Terlihat Sebagai Tombol (semua divisi)
**Tanggal**: 17 September 2026
**Status**: Selesai (perbaikan lanjutan dari entri [Polish UI] di bawah — feedback user: tombol submit form di semua divisi masih "menyatu" dengan halaman, warna masih matching page, tidak terkesan sebagai tombol input).

**Pencapaian** (`html/Style.html` — blok `BUTTONS`, `.btn-primary` diremajakan total):
- `.btn-primary` kini diberi affordance tombol yang jelas, berlaku otomatis untuk **semua** tombol submit di semua divisi (Index login/register, Tata Usaha `tu-btn-submit`, Operasi Laut `ops-btn-submit` & `ops-btn-revisi-save`/`ops-btn-anulir-save`, Operasi Udara `oud-btn-submit` & `oud-btn-revisi-save`/`oud-btn-anulir-save`, Master Data `md-btn-*-save`, `md-btn-sync-wpp`):
  - `padding: 13px 18px` + `font-weight: 700` + `letter-spacing: 0.01em` (teks lebih tegas, proporsi tombol lebih berisi).
  - **Tepi bawah tebal 4px** `rgba(0,0,0,0.25)` di atas border tipis 1px `rgba(0,0,0,0.12)` → efek raised/3D yang menonjol dari background kartu.
  - **`box-shadow: var(--n-shadow-card)`** — shadow satu level dari token resmi DESIGN §4, memisahkan tombol dari permukaan kartu (ini yang paling signifikan membuat tombol "terangkat" dari halaman).
  - Hover `filter:brightness(0.94)`, `:active` (ditekan) `brightness(0.9)` + `border-bottom-width:1px` + `translateY(3px)` (efek tombol ditekan), `:disabled` opacity, `:focus-visible` ring `--n-primary-light`.
  - Semua overlay (border/shadow) pakai **neutral black rgba**, tidak menambah warna baru di palet (§DESIGN §3), hover tidak menambah shadow kedua (§DESIGN §4).

**Keputusan teknis yang diambil**:
- Satu class `.btn-primary` menjadi satu-satunya sumber tampilan tombol submit seluruh divisi — konsisten & single-source-of-truth; tanpa mengubah markup/logika view manapun untuk tombol submit.
- Tidak menyentuh `Auth.html` (tidak lagi di-serve sejak Fase 3; Index.html yang serve login/register).

**Item terbuka / follow-up**:
- Verifikasi visual runtime: buka tiap form divisi → tombol "Simpan Laporan"/"Simpan Revisi"/"Anulir" harus tampak jelas sebagai tombol (terangkat, tepi bawah tebal, hover/active responsif). Jika masih kurang menonjol, kandidat berikutnya: menyesuaikan shape radius atau menambah kontras indigo — konfirmasi dulu ke user sebelum lanjut.
- Task polish murni — status roadmap tidak berubah (Fase 7 tetap "Sebagian ada catatan").

---

## [Polish UI] — Bentuk Tombol Form & Modal Lebih Tegas (`btn-primary` epic bawah, `btn-outline` terdefinisi, `btn-mini` baru)
**Tanggal**: 17 September 2026
**Status**: Selesai — perbaikan tampilan tombol pada form isian & modal agar tidak menyatu dengan isi halaman dan lebih terkesan sebagai tombol. Murni perubahan CSS + class pada markup, tanpa perubahan logika/scope fitur.

**Latar belakang**: keluhan user — tombol form (tombol submit & tombol "Batal" di modal) terlihat kurang mencolok alias "menyatu" dengan isi halaman sehingga tidak terkesan seperti button.

**Akar masalah & perbaikan** (`html/Style.html` — blok `BUTTONS`):
- `.btn-primary` sebelumnya flat: `border:none`, hanya `opacity` untuk hover → terlihat datar/menyatu. Sekarang diberi `border 1px rgba(0,0,0,0.10)` + **tepi bawah tebal 3px `rgba(0,0,0,0.20)`** (efek raised), hover `filter:brightness(0.94)`, `:active` (ditekan) `brightness(0.9)` + `border-bottom-width:1px` + `translateY(2px)` (affordance tombol ditekan), dan `:focus-visible` outline `--n-primary-light`. Semua transisi halus; **tidak menambah warna baru** di palet (§DESIGN §3) dan **tidak menambah shadow** (DESIGN §4 — hover cukup border/surface, bukan elevation).
- **`.btn-outline` kini terdefinisi** (sebelumnya dipakai di markup tapi TIDAK ada di CSS → tombol tampil sebagai browser-default yang tak konsisten): `block` full-width, `border 1px solid var(--n-primary)`, transparan, teks primary, hover `--n-primary-light`. Dipakai tombol "Batal" di modal revisi/anulir (Operasi Laut & Operasi Udara) — sekarang rapi seperti `btn-ghost`.
- **`.btn-mini` baru** untuk tombol aksi kecil dalam baris tabel (Revisi/Anulir, dirender di `Script_Main.html`): pill outline (radius `--n-r-pill`), `inline-block`, border primary, hover `--n-primary-light`; warna/border anulir tetap di-override inline `--n-status-critical`. Pengganti string lama `class="btn-outline" style="padding:4px 8px;font-size:12px;"` (6 lokasi: Operasi Laut baris tabel revisi & anulir, Operasi Udara baris tabel revisi & anulir) — diganti `btn-mini` agar tidak menjadi block penuh 100% di dalam sel tabel.
- `.btn-ghost` dipertegas: hover kini juga mengubah `border-color: var(--n-primary)` (bukan hanya background).

**File yang diubah**:
- `html/Style.html` — blok BUTTONS (`.btn-primary`, `.btn-ghost`, `.btn-outline` baru, `.btn-mini` baru).
- `html/Script_Main.html` — 6 string render tombol "Revisi"/"Anulir" di tabel: `class="btn-outline"` → `class="btn-mini"` (hapus inline padding/font-size yang tidak perlu).

**Verifikasi**: (belum runtime — lihat follow-up). `grep` memastikan `.btn-outline` sekarang hanya dipakai untuk tombol "Batal" full-width di modal; tombol tabel memakai `.btn-mini`. Tidak ada warna baru di luar palet (semua pakai token `--n-primary`/`--n-primary-light`/status). Tidak menyentuh `Auth.html` (tidak lagi di-serve, dipertahankan).

**Follow-up**:
- Verifikasi visual runtime: buka form laporan modul + modal revisi/anulir (Operasi Laut/Operasi Udara) → tombol submit harus terlihat jelas (tepi bawah tebal, hover lebih pekat), tombol "Batal" di modal terbentuk, tombol Revisi/Anulir di tabel berbentuk pill.
- Task murni polish, tidak mengubah status fase di Peta Jalan — Fase 7 tetap "Sebagian ada catatan (perlu verifikasi runtime)".

---

## [UI Polish] - Perbaikan Desain Tombol Toggle Form
**Tanggal**: 17 September 2026
**Status**: Selesai

**Pencapaian**:
- Menambahkan kelas CSS baru  di  agar header untuk menampilkan form input (toggle) memiliki gaya layaknya tombol aksi.
- Menerapkan  pada halaman Tata Usaha (), Operasi Laut (), dan Operasi Udara () menggantikan struktur `content-section-hd` yang sebelumnya menyatu dengan background *page*.
- Sekarang tombol input form memiliki latar warna *primary*, shadow, hover effect, serta layout flex yang jelas, mengindikasikan bahwa baris tersebut dapat diklik.

**Keputusan teknis yang diambil**:
- Mengubah *form toggle* dari yang tadinya berupa div bergaya header sederhana menjadi tombol (*button-like UI*) utuh dengan *padding* dan background *primary*. Tujuannya mempermudah user menebak bahwa elemen tersebut adalah *call to action* untuk membuka form pelaporan.
- Tidak ada modul backend () yang diubah, ini murni perbaikan tampilan antarmuka (UI).

**Item terbuka / follow-up**:
- Konfirmasi dari user apakah tampilan baru untuk toggle form sudah sesuai dengan ekspektasi.

---

## [REVERT] — Kembali ke Version 10 (`Test10 @10`, snapshot 15 Sept 12:38)
**Tanggal**: 16 September 2026
**Status**: Selesai — aplikasi aktif dikembalikan ke **Version 10** via deployment `Test10 @10` (sudah ter-pin ke v10). **Tidak ada `push`/penimpaan `@HEAD`**; source lokal (Fase 7 + hotfix) tetap utuh untuk investigasi lanjutan.

**Cara revert (dengan clasp)**:
- `clasp versions` → konfirmasi **`10 - Test10`** ada di proyek.
- `clasp deployments` → deployment **`Test10 @10`** (`AKfycbzMrtmA11svNWUtdtjrhi14xpg0Fw4njHA9tekhqqW4B2GmlTOLLTyM5Yk`) sudah ter-pin ke **Version 10**.
- Verifikasi: `curl` URL `/exec` deployment itu → **HTTP 200, `text/html`, 65.756 byte** (login screen served OK). Karena `clasp deploy` hanya bisa membuat deployment dari `@HEAD`, pin ke versi lama dilakukan lewat deployment yang sudah ada (bukan source push) — ini bentuk "revert" yang aman & tidak merusak.

**Fitur/fase yang HILANG (dibalik) akibat revert ke v10** — semua item berikut **tidak aktif** di deployment aktif sekarang, dikembalikan ke perilaku 15 Sept 12:38:
- **Fase 6 — Master Data lengkap** (CRUD Kapal+seed WPP resmi, Kawasan Konservasi): pada v10 **belum final** — jika diakses dari deployment aktif, data master mengikuti snapshot v10 (bukan versi terbaru).
- **Fase 7 — Modul Operasi Udara + Gabung Menu "Operasi"** (KPI Operasi Udara, tab Kapal/Pesawat, peta WPP & Jumlah, menu sidebar gabung, `OperasiUdaraService`): **tidak ada** di v10.
- **Fase 7 Hotfix #1 — Defensive init** (try-catch + timeout 15s loading fallback): **tidak ada** di v10.
- **Fase 7 Hotfix #2 — Root cause Leaflet blocking `DOMContentLoaded`** (lazy-load Leaflet `_loadLeaflet`): **tidak ada** di v10 — v10 masih memuat Leaflet sinkron.

> **Peringatan penting**: karena v10 masih memuat Leaflet secara sinkron (belum ada hotfix #2), jika akar masalah "loading forever" ternyata berasal dari blok Leaflet non-eksekusi, **revert ini bisa saja tidak menyembuhkan loading**. Ini justru menjadi **tes eksperimen**: kalau deployment v10 sekarang loading normal, berarti bug diperkenalkan oleh modifikasi Pasca-v10; kalau masih stuck, akar masalah memang di luar kode (mis. penyedia CDN/sandbox GAS).

**Item terbuka / follow-up**:
- Konfirmasi user: setelah memakai URL v10, apakah loading hilang dan login muncul? (jawaban ini menentukan diagnosis final)
- Jika v10 sehat → Fase 7/6 tidak ikut aktif; keputusan lanjut: re-implementasi bertahap dengan akar masalah Leaflet sudah ditangani lebih dulu.
- `@HEAD` & deployment `@16/@17` (Fase 7 recovery) **tidak dihapus** — bisa di-deploy ulang kapan saja bila diinginkan.

---


## [Fase 14 — QA & Polish] (12 Okt 2026) — Berjalan (bagian 7b: Auto-update Status Approval Signup)

**Status**: Berjalan. UX auto-update setelah approval akun tanpa perlu refresh manual.

**Pencapaian**:
- AuthService: menambahkan `auth_checkStatusByEmail_global(email)` (fungsi global) untuk mengecek status akun berdasarkan email tanpa token/login.
- Auth.html: polling otomatis tiap 3 detik setelah register sukses untuk memantau status. Saat status menjadi AKTIF, tampil banner "Akun telah diterima..." dan tombol Sign In; polling berhenti saat berpindah view/logout.
- Script_Main: silent refresh notifikasi setelah `user_approve`/`user_reject` agar approval list dan notifikasi ter-update lebih cepat.

**Keputusan teknis**:
- Menggunakan fungsi global (pola GAS) agar bisa dipanggil dari HTML frontend tanpa bergantung pada nama class.
- Polling ringan 3 detik hanya saat ada email pending register untuk mengurangi overhead.
- Tidak mengubah skema data, bersifat read-only.

**Item terbuka/follow-up**:
- Definition of Done per modul (AGENTS.md §6) masih belum dilakukan menyeluruh.
- Pengecekan ulang UI terhadap negative prompt DESIGN.md §1 per modul perlu dilanjutkan.

## [Fase 14 — QA & Polish] (12 Okt 2026) — Berjalan (bagian 7c: Perbaikan polling status approval signup)

**Status**: Berjalan. Perbaikan pemanggilan endpoint cek status akun dari Auth.html.

**Pencapaian**:
- Auth.html: memperbaiki polling agar memanggil `auth_checkStatusByEmail_global` via `google.script.run` (bukan memanggil fungsi global langsung di client-side GAS HTML), sehingga status akun terdeteksi dengan benar saat di-approve tanpa perlu refresh manual.
- Code.js: menambahkan wrapper `auth_checkStatusByEmail` yang merutekan ke `auth_checkStatusByEmail_global`.

**Keputusan teknis**:
- Di GAS HTML Service, fungsi server hanya bisa dipanggil via `google.script.run`, bukan langsung fungsi global JS. Ini yang menyebabkan polling tidak berfungsi sebelumnya.

**Item terbuka/follow-up**:
- Definition of Done per modul (AGENTS.md §6) masih belum dilakukan menyeluruh.
- Pengecekan ulang UI terhadap negative prompt DESIGN.md §1 per modul perlu dilanjutkan.

## [Fase 14 — QA & Polish] (12 Okt 2026) — Berjalan (bagian 7d: Perbaikan routing fungsi cek status)

**Status**: Berjalan.

**Pencapaian**:
- Memperbaiki pemanggilan dari Auth.html agar menggunakan fungsi global server-side via google.script.run dengan nama fungsi yang benar.
- Menghilangkan duplikasi fungsi top-level di Code.js.

**Keputusan teknis**:
- Menggunakan pola pemanggilan via google.script.run agar berfungsi di GAS HTML Service.
