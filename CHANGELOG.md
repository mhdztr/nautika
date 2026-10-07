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

