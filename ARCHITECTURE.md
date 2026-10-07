# ARCHITECTURE.md — Nautika

Dokumen teknis. Menjabarkan **bagaimana** PRD.md diimplementasikan. Jika ada detail teknis yang tidak disebut di sini, cek `DATA_SCHEMA.md` (skema kolom per sheet) sebelum mengasumsikan sendiri.

---

## 1. Stack

- **Runtime**: Google Apps Script (server-side, `.gs`)
- **Database**: Google Spreadsheet (bukan Firestore/SQL eksternal — sesuai keputusan proyek)
- **Storage file**: Google Drive
- **Frontend**: HTML Service (SPA single-page, di-serve dari GAS) — HTML/CSS/JS murni, tanpa framework build-step (sesuai pola existing, no Bootstrap/React)
- **Charting**: **Chart.js v4.4.1** (satu-satunya library chart; keputusan diambil Fase 8, dicatat di CHANGELOG). Wrapper `html/Script_Charts.html` memuat Chart.js secara on-demand dari unpkg (pola loader queue identik `_loadLeaflet`) dan menyediakan: `_loadCharts`, registry `_NAUTIKA_CHARTS` + `_chartTeardownAll()`, palet `_CHART_COLORS` (mirror token `DESIGN.md` §3/`Style.html`, karena canvas tidak bisa baca CSS vars), builder `_chartBar` (horizontal/vertikal), `_chartLine` (line/area), & `_chartDonut` (proporsi ≤4 kategori, center-label), plugin label nilai (nvVal) & label ujung garis (nvEnd). Semua tren/akumulasi dihitung **server-side** lewat endpoint `*_getTren`. Choropleth tetap Leaflet (bukan library chart).
- **Peta**: Leaflet (ringan, mendukung GeoJSON custom layer + choropleth, cocok untuk kebutuhan cache-sekali-load)

## 2. Prinsip Modular

"Modular tapi integrated" diterjemahkan jadi:
- **Spreadsheet dipisah per fungsi**, bukan per divisi — supaya query lintas-divisi (cross-division, PRD §6) tetap mudah dan tidak perlu buka banyak file.
- **Kode GAS dipisah per layer** (routing, service per modul, data access, util) dalam satu project — bukan 9 project terpisah per divisi, karena RBAC dan filter periode global butuh satu titik kontrol.

## 3. Struktur Spreadsheet (Database)

Tiga Google Spreadsheet terpisah, masing-masing punya peran jelas:

### 3.1 `Nautika_Master`
Data referensi, jarang berubah, dipakai sebagai lookup lintas modul.

| Sheet | Isi |
|---|---|
| `Kapal` | Master armada — `KapalID`, Nama, Kelas, Homebase/UPT, StatusAktif, JenisKapal (enum Opsi `KAPAL_JENIS`) |
| `Kawasan_Konservasi` | `KawasanID`, Nama, Provinsi, Latitude (opsional), Longitude (opsional) |
| `WPP` | `WPPCode`, NamaWilayah (sinkron manual dari `wpp_final.geojson` via `master_syncWpp` — **Fase 6 menggantikan auto-seed darurat**; saat sheet masih kosong, `master_getWppList` mengembalikan konstanta `WPP_NRI` sebagai fallback read-only tanpa menulis apa pun, lihat `CHANGELOG.md` Fase 6) |
| `Divisi` | `DivisiID`, NamaResmi, NamaDashboard, Kode |
| `Users` | `UserID`, Nama, Email, **NIP**, PasswordHash, DivisiID, Role, Status (`PENDING/APPROVED/REJECTED/NONAKTIF`), ApprovedBy, RegisteredAt, ApprovedAt. `NIP` wajib & unik, disimpan sebagai digit saja; kolom kosong hanya mungkin pada akun lama sebelum kolom ini ada (lihat `DATA_SCHEMA.md` §`Users`). |
| `Opsi` | Daftar pilihan dinamis untuk dropdown modul — kolom `Kode` (AMUNISI/BBM/KOM_PERSONIL/AWAK_KATEGORI), `Urutan`, `Label`, `Aktif`. Sumber otoritatif enum `JenisAmunisi`, `JenisBbm`, `KomponenPersonil`, `KategoriPengawakan` (keputusan revisi Fase 9/10, lihat `CHANGELOG.md`). Di-seed `Setup.js`; fallback default via `getOpsiList`. |

### 3.2 `Nautika_Transaksi`
Data transaksional mingguan — satu sheet per modul, semua **append-only dengan versioning** (lihat §5).

| Sheet | Modul |
|---|---|
| `TX_TataUsaha` | Tata Usaha |
| `TX_OperasiLaut` | Operasi Laut |
| `TX_OperasiLaut_Detail` | Operasi Laut — rincian per-item (kapal ditangkap KII/KIA, rumpon ditertibkan) |
| `TX_OperasiUdara` | Operasi Udara |
| `TX_OperasiUdara_Detail` | Operasi Udara — rincian per-item pemantauan udara (KII/KIA/Objek SDK) |
| `TX_Intelijen` | Intelijen |
| `TX_Intelijen_Detail` | Intelijen — rincian per-kejadian (kategori non-kawasan) |
| `TX_Pemantauan` | Pemantauan |
| `TX_Perawatan_Kesiapan` | Perawatan — status kesiapan kapal |
| `TX_Perawatan_Docking` | Perawatan — progres docking |
| `TX_Perawatan_Item` | Perawatan — item pekerjaan pemeliharaan (many-to-one ke submission mingguan) |
| `TX_Logistik_Amunisi` | Logistik — amunisi |
| `TX_Logistik_BBM` | Logistik — BBM |
| `TX_Pengawakan_AKN` | Pengawakan — komposisi personel |
| `TX_Pengawakan_Kegiatan` | Pengawakan — log kegiatan personel |
| `TX_KegiatanDirektorat` | Kegiatan Pendukung (lintas-divisi) |
| `TX_Evidence` | Lampiran — relasi ke baris manapun di atas via `RefSheet` + `RefRowID` |

Alasan pemisahan sheet per sub-topik (mis. Perawatan jadi 3 sheet): tiap punya struktur kolom & relasi berbeda (item pekerjaan itu 1-ke-banyak per submission, kesiapan itu 1 baris per kapal per periode) — memaksa jadi satu sheet akan bikin kolom kosong berlebihan dan sulit divalidasi.

Sheet `TX_*_Detail` adalah **rincian per-item yang men-subordinat header** transaksi: kolom `ParentRowID` merujuk `RowID` header, dan angka agregat (mis. `KII_Ditangkap`, `Jumlah`) di header **dihitung sistem** dari jumlah baris detail (nilai manual baris lama tanpa detail tetap valid). Detail di-create/read/di-update bersama header lewat `utils/DetailService.js` (lihat §5 dan `DATA_SCHEMA.md`).

### 3.3 `Nautika_Log`
| Sheet | Isi |
|---|---|
| `Approval_Queue` | Antrian registrasi menunggu approval |
| `Audit_Log` | Semua create/update/void: siapa, apa, kapan, alasan |
| `Notifications` | Notifikasi in-app per user |

## 4. Kunci Relasional Wajib

Semua sheet transaksi **wajib** punya kolom berikut (detail lengkap per sheet di `DATA_SCHEMA.md`):

- `RowID` — UUID unik baris
- `DivisiID` — scope untuk RBAC
- `Periode` — format `YYYY-MM-WW` (tahun-bulan-minggu ke berapa dalam bulan itu)
- `SubmittedBy` — `UserID`
- `Timestamp` — waktu submit
- `Status` — `ACTIVE` / `SUPERSEDED` / `VOID`
- `SupersedesRowID` — kosong jika baris asli, terisi jika ini revisi dari baris lain
- `VoidReason`, `VoidedBy`, `VoidedAt` — terisi jika `Status = VOID`

Referensi entitas (bukan teks bebas): `KapalID`, `WPPCode`, `KawasanID` — semua ditarik dari `Nautika_Master`, dropdown di form mengambil dari situ.

Subordinat transaksi: sheet `TX_*_Detail` memakai `ParentRowID` → `RowID` header (1-ke-banyak); baris detail wajib menyertakan kolom standar (`RowID`, `DivisiID`, `Periode`, `Status`, dst. — sama seperti header) supaya versioning/audit berjalan per-item. Pengecualian ref-entitas: kapal kondisi marabahaya (Pemantauan) menggunakan **`NamaKapal` teks bebas**, bukan `KapalID` dari Master — kapal marabahaya adalah kapal eksternal (mis. kapal perikanan kehabisan BBM), tidak ada di Master Data (keputusan user 29 Sep 2026).

Self-heal skema: sheet transaksi yang belum ada (mis. `TX_*_Detail` pada DB lama) dan kolom baru dibuat otomatis idempoten saat pertama diakses/ditulis — `ensureDetailTxSheet()` untuk sheet detail, `ensureTxColumn()`/`ensurePemantauanKapalKolom()`/`ensureKapalJenisColumn()` untuk kolom baru — sehingga `setupForce` tidak wajib dijalankan. Master-side juga self-heal: grup Opsi yang baru ditambahkan ikut ter-seed sendiri lewat `_mdEnsureKapalJenisOpsi()` (memakai `_seedOpsi()` yang idempoten) saat endpoint Kapal/Opsi diakses, sehingga enum baru tidak menggagalkan validasi di DB lama.

### 4b. `KapalID` sebagai field wajib pada modul yang mengagregasi per kapal

`KapalID` nullable di skema karena `TX_Logistik_*` masih memakainya sebagai tautan opsional, tetapi **wajib diisi saat submit/revisi baru** pada `TX_OperasiLaut` dan `TX_OperasiUdara` (Fase 14 Item 6) — dua sheet itu adalah sumber tunggal angka "hari operasi" dan bar "Kapal Pengawas Teraktif" di Ikhtisar. Konsekuensinya:

- Kolom tetap nullable di skema agar baris lama tidak-invalid dan tidak perlu dipaksa direvisi hanya demi kelengkapan kolom.
- Jalur pengisian data lama adalah **revisi**: modal revisi sekarang punya pemilih kapal (prefill nilai lama bila ada), jadi baris lama yang kosong bisa dilengkapi tanpa edit langsung ke sheet.
- Saat revisi tidak mengirim `KapalID` sama sekali, server mewarisi nilai baris lama; bila warisan itu juga kosong, revisi ditolak dengan pesan yang menyebut pilih kapal.
- `Kapal.JenisKapal` (enum Opsi `KAPAL_JENIS`) dipakai Operasi Laut untuk mencocokkan kapal dengan `HariOperasi_Kategori` — kapal kosong jenisnya dibaca sebagai "tidak dibatasi" supaya kapal lama tidak terkunci dari form. Pencocokan ditegakkan di server; UI hanya menyaring dropdown sebagai kenyamanan.
- Angka hari operasi yang tidak bisa diatribusikan ke kapal (baris legacy) tetap masuk KPI, dan jumlahnya dikirim terpisah (`charts.hariTanpaKapal`) supaya chart kosong bisa menjelaskan dirinya alih-alih terlihat seperti tidak ada aktivitas.

## 5. Mekanisme Versioning (Revisi & Anulir)

- **Create**: insert baris baru, `Status = ACTIVE`, `SupersedesRowID` kosong.
- **Edit/Revisi**: insert baris baru dengan data terbaru, `SupersedesRowID` = RowID lama. Baris lama diubah `Status = SUPERSEDED`. Alasan revisi disimpan di `Audit_Log`.
- **Anulir**: baris diubah `Status = VOID` di tempat (bukan insert baru), isi `VoidReason/VoidedBy/VoidedAt`.
  - `VoidReason` **wajib diisi** — tidak boleh anulir tanpa komentar penjelasan.
  - Komentar anulir (`VoidReason`) **tampil di tabel Riwayat** — visible kepada seluruh anggota divisi yang sama (bukan hanya si pengunggah), supaya staf tahu apa yang perlu diperbaiki.
  - Setelah anulir, periode tersebut **terbuka kembali** untuk submit baru. Logic duplikat-cek hanya memblokir jika ada baris `ACTIVE` untuk periode yang sama; baris `VOID` atau `SUPERSEDED` tidak menghalangi laporan baru.
  - Dicatat juga di `Audit_Log`.
- **Agregasi** (bulanan/YTD/dashboard): selalu `SUM/COUNT` hanya baris `Status = ACTIVE` dalam rentang `Periode` yang difilter. `SUPERSEDED` dan `VOID` tidak dihitung tapi tetap tampil di Riwayat Laporan.
- **Baris revisi & lampiran**: saat revisi menggantikan baris lama (SUPERSEDED), lampiran dibawa ke baris revisi baru lewat `evidence_carry` (replikasi baris `TX_Evidence` dengan `DriveFileID` yang sama — tidak ada file Drive baru). `TX_Evidence` bukan bagian dari agregasi angka, tapi ikut di-referensikan per `RefRowID` agar tidak "terlantar" ke baris non-aktif.
- **Penghitung revisi pagu (TU)**: `revisiPagu` dihitung on-read di `_tuHitungRevisiPagu()` (`services/TataUsahaService.js`), bukan kolom disimpan dan bukan hasil turunan rantai `SupersedesRowID`.
  - Definisi: jumlah transisi nilai `(PaguReguler, PaguABT)` pada baris `ACTIVE` yang berbeda dari baris `ACTIVE` sebelumnya, dibaca kronologis. Baris pertama = pagu awal, bukan revisi.
  - **Menghitung seluruh riwayat**, bukan hanya rantai supersede satu periode: Pagu diwarisi dari laporan minggu sebelumnya, jadi nilai yang "sama" di periode berbeda bisa tetap hasil revisi di periode sebelumnya — rantai supersede akan melewatkannya.
  - **Dihitung dari nilai, bukan dari `CatatanRevisiPagu` yang terisi**: `tataUsaha_revisi` mewajibkan `AlasanRevisi` tetapi tidak memaksa Catatan Revisi Pagu walau Pagu berubah, jadi menghitung dari kolom catatan akan understated.
  - Client (`_tuRenderRevisiPagu()` di `html/Script_Main.html`) menampilkan angkanya di bawah baris Pagu. Prediksi `revisi ke-(N+1)` hanya muncul bila nilai input benar-benar berbeda dari nilai laporan sebelumnya (`_tuPaguBerubah()`), karena membuka `Ubah Pagu` lalu langsung menyimpan bukan revisi.
  - Angka = revisi yang **sudah terjadi**. Saat KPI belum termuat, client menampilkan `—` dan bukan `Belum pernah direvisi`, supaya tidak pernah menyatakan klaim yang belum terverifikasi.
- **Rincian per-item (`TX_*_Detail`) subordinat header**: saat header direvisi, seluruh child ACTIVE-nya di-set `SUPERSEDED`; baris detail baru ditulis dengan `SupersedesRowID` menunjuk child lama. Saat header dianulir, child ikut di-set `VOID`. Semua di-handle `utils/DetailService.js` (`_detailWriteChildren`, `_detailActiveChildren`, `_detailSetChildrenStatus`, `_detailAttach`).

## 6. Struktur Folder Google Drive

```
Nautika_Evidence/
  [Divisi]/
    [Periode]/            # format YYYY-MM
      [Konteks-Label]/
        file1.pdf
        file2.jpg
```
Contoh: `Nautika_Evidence/Perawatan/2026-08/Docking-KP-Orca04/repair-list.pdf`

- Nama `[Divisi]` memakai kolom `NamaDashboard` dari master `Divisi` (fallback `DivisiID`), dan `[Konteks-Label]` mengikuti konvensi `JenisKonteks-Label` (keputusan Fase 9, lihat CHANGELOG): `Kesiapan-<SlugKapal>`, `Docking-<SlugKapal>`, `Item-<SlugNamaPekerjaan>` untuk modul Perawatan.
- Folder dibuat otomatis (lazy-create) saat upload pertama ke kombinasi path itu.
- Mode "copy dari link Drive": ekstrak File ID dari URL, `DriveApp.getFileById(id).makeCopy(namaBaru, targetFolder)`.
- Validasi ukuran & tipe MIME dilakukan **sebelum** proses copy/upload dieksekusi.
- Setiap file yang tersimpan dicatat sebagai baris di `TX_Evidence` (bukan hanya link di kolom sheet lain) — supaya satu item bisa punya banyak lampiran dan gampang di-query dari halaman Riwayat Laporan.

## 7. Struktur Kode Apps Script (GAS Project)

**Catatan clasp**: `rootDir: ""` di `.clasp.json` berarti root project = root GAS. Tidak ada wrapper `/src` — semua file `.js`/`.html` di project root (dan subdirektorinya) langsung di-push ke GAS. Subdirektori dipertahankan sebagai prefix nama file di GAS editor (mis. `utils/Constants.js` → tampil sebagai `utils/Constants` di editor). Semua file tetap dalam **satu global scope GAS** — tidak ada module system, tidak ada `require()`.

```
[project root]            ← rootDir clasp (= root GAS project)
  Code.js                 # entry point, doGet(), routing HTML
  Router.js               # pemetaan aksi frontend -> service function
  Setup.js                # inisialisasi sheet + header (dijalankan sekali)
  appsscript.json         # manifest GAS (scope OAuth, timezone, runtime)
  /services
    AuthService.js         # login, register, approval flow
    TataUsahaService.js
    OperasiLautService.js    # Kapal — RBAC + KPI/history/submit/revisi/anulir (DIV-OPS)
    OperasiUdaraService.js   # Pesawat — struktur & pola sama dengan Laut (DIV-OPS)
    IntelijenService.js
    PemantauanService.js
    PerawatanService.js
    LogistikService.js
    PengawakanService.js
    KegiatanDirektoratService.js
    MasterDataService.js    # Kapal, Kawasan, WPP, Divisi, Users
    EvidenceService.js      # upload, copy-from-link, validasi ukuran
    DashboardService.js     # agregasi Overview, cross-division profil kapal
    NotifikasiService.js    # daftar notifikasi + tandai dibaca, ringkasan shell, reminder mingguan (baris Notifications + email + time trigger Jumat 16:00)
    AdminService.js         # SUPERADMIN: kelola user (role/unit/status, reset password, status NONAKTIF) + baca Audit_Log
  /data
    SheetAccess.js          # generic read/write/versioning helper ke semua sheet
    ValidationRules.js      # aturan cross-check per modul (PRD §5, §12)
  /utils
    Constants.js            # ID spreadsheet, nama sheet, role enum, divisi enum
    DateUtil.js             # konversi Periode <-> tanggal
    Lock.js                 # wrapper LockService
    DetailService.js        # helper rincian per-item TX_*_Detail (validasi, tulis-anak, supersede/void ikut header, attach ke history) — dipakai OperasiLaut/OperasiUdara/IntelijenService
  /html
    Index.html              # shell SPA
    Style.html              # CSS (ikuti DESIGN.md)
    Script_Main.html        # state management, routing hash, fetch data
    Script_Charts.html      # wrapper chart lmbr (Chart.js v4, loader on-demand, registry/teardown, builder bar/line/donut)
    Script_Map.html         # wrapper Leaflet, load-once cache logic
    /views                  # 1 file per halaman/modul (render function)
      Notifikasi.html       # template halaman Notifikasi (#view-tpl-notifikasi)
      Admin.html            # template Admin Panel (#view-tpl-kelola-akun): Persetujuan / Pengguna / Audit Log / Pengingat Mingguan
```

**Aturan penamaan fungsi service** yang dipanggil dari frontend (`google.script.run`): `modul_aksi`, contoh `tataUsaha_submitMingguan`, `perawatan_getKesiapan`, `master_getKapalList`. Konsisten di seluruh modul supaya predictable buat agent yang melanjutkan development. Modul utilitas mengikuti pola yang sama: `utils_aksi` — contoh `utils_getCurrentPeriode` (alias publik dari helper internal `getCurrentPeriode()` di `utils/DateUtil.js`, yang tetap dipanggil langsung oleh service).

**Aturan pemanggilan `google.script.run` (client-side)**: handler **wajib** dipasang sebelum fungsi server dipanggil — `google.script.run.withSuccessHandler(...).withFailureHandler(...).namaFungsi(args)`. `withSuccessHandler`/`withFailureHandler` mengembalikan runner **baru**, jadi memanggil fungsi server lebih dulu (`var r = google.script.run.namaFungsi(...)` lalu `r.withSuccessHandler(...)`) membuat permintaan berjalan **tanpa handler**: server tetap menulis data, tapi callback tak pernah dipanggil sehingga tombol/modal menggantung di "Memproses…". Untuk pemanggilan kondisional (create vs update), simpan runner yang sudah ber-handler di variabel, lalu panggil fungsi server padanya: `var runner = google.script.run.withSuccessHandler(...).withFailureHandler(...); if (edit) runner.modul_update(...); else runner.modul_create(...);`.

## 8. RBAC Enforcement

- Setiap service function **wajib** cek `session.role` + `session.divisiId` di awal fungsi sebelum baca/tulis — tidak boleh mengandalkan frontend untuk menyembunyikan tombol saja (itu cuma UX, bukan keamanan).
- **Cerminan di frontend wajib sinkron dengan helper server.** Tombol aksi (mis. `Revisi` di riwayat) hanya ditampilkan bila `canWrite` di renderer riwayat memakai kondisi yang **sama persis** dengan `_opsLautAssertWrite()` / `_opsUdaraAssertWrite()`. Ini murni UX, tapi kalau cerminannya meleset, user tidak akan pernah tahu aksi itu tersedia — services yang berbeda pernah menyimpang di sini (SUPERADMIN kehilangan `Revisi` karena `canWrite` client mewajibkan `divisiId`). Saat menambah role/divisi baru, ubah **server helper dulu, baru cerminannya**, dan keduanya dijaga regression test (`selftest.js`).
- Direktur & Superadmin: bypass filter `DivisiID` di query, tapi tetap tercatat di Audit Log dengan `UserID` asli.
- Helper terpusat: `Lock.js`/`SheetAccess.js` menyediakan fungsi `assertScope(user, divisiId)` yang dipanggil di setiap service sebelum operasi tulis.

## 9. Peta — Implementasi Cache

- Basemap memakai tile CARTO (`light_all`). **CARTO mewajibkan API key** — key **TIDAK di-hardcode di source**. Cara kerja saat ini (sejak [Infra] setup Git/GitHub):
  1. Key disimpan di Script Properties dengan key `CARTO_API_KEY` (`PROP_KEY.CARTO_API_KEY`).
  2. Superadmin mengisi key sekali lewat `setupSetCartoKey("<key>")` di editor GAS (di `Setup.js`).
  3. Frontend memanggil `utils_getCartoKey()` (alias dari `getCartoApiKey()` di `utils/Constants.js`) saat inisialisasi peta, lalu menyusun URL tile (`_ensureCartoKey` + `_cartoTileUrl` di `html/Script_Main.html`). Key di-cache di `window._nautikaCartoKey` per sesi.
  4. **Semua peta memakai satu key yang sama.** Operations Laut, Operasi Udara, dan peta WPP di Ikhtisar semuanya lewat `_ensureCartoKey()` → `_cartoTileUrl(key)`. Tidak ada key, `Script Property`, atau variabel terpisah per peta — menambah key kedua hanya berarti satu tempat lagi bisa bocor atau belum diisi. Kalau sebuah peta memanggil `L.tileLayer()` dengan URL CARTO yang ditulis langsung, itu regresi: harus `_cartoTileUrl(key)`.
  5. `attributionControl` **tidak boleh dimatikan** pada peta mana pun. OSM/CARTO mewajibkan atribusi tampil; `subdomains: 'abcd'` wajib karena URL memakai placeholder `{s}`.
  - Bedakan: key-nya tetap terlihat di source page hasil serve publik karena tile dimuat oleh browser — batasi via referrer/domain restriction di dashboard CARTO jika perlu. Yang dihindari adalah key bocor ke repository Git, bukan key tampil di browser.

- Warna layer ditulis sebagai **hex**, bukan `var(--n-token)`. Leaflet menempelkan `style` sebagai atribut SVG (`fill="..."`); Chrome/Firefox modern sebenarnya me-resolve `var()` di presentation attribute, jadi ini **bukan** sumber bug peta yang pernah terjadi — tapi perilaku itu tidak seragam lintas engine/versi dan mustahil di `<canvas>`, jadi hex dipakai agar deterministik. Token tema di-mirror sebagai objek JS (`_OPS_WPP_SCALE`), aturan yang sama seperti `_CHART_COLORS` untuk Chart.js.
- Layer choropleth WPP membaca properti GeoJSON **`wppnri`** (huruf kecil; `name` untuk label tooltip) — cocokkan dengan `WPPCode` transaksi. Jangan memakai `WPPNRI` (tidak ada di source file).
- Frontend load geometri **sekali** saat modul peta pertama dibuka dalam sesi, simpan di `_OPS_GEO.wppGeoJsonData` (via `_opsGetGeoData(cb)`) — dipakai bersama tab Kapal (`_renderWppLayer`) dan Pesawat (`_renderOpsUdaraWppLayer`), tidak re-fetch saat pindah tab dalam SPA yang sama. Biasanya load-once per sesi.
- SPA menimpa `#page-content`/`#ops-tab-pane` tiap masuk view → semua objek Leaflet (`window.opsLautMap`, `window.opsUdaraMap`) harus di-teardown (`map.remove()`) dan dibuat ulang di container baru setiap render view; geometri tetap dari cache (bukan re-fetch). Gunakan `_opsTeardownMaps()` yang mereset kedua map + layer-nya. Lihat `_renderOperasi`/`_renderOperasiLaut`/`_renderOperasiUdara`.
- Saat filter periode berubah: hanya panggil service untuk data agregat per-WPP (jumlah kapal per `WPPCode`), lalu update `style`/warna layer GeoJSON yang sudah ada — **tidak** memanggil ulang parsing file geojson.
- **Kontrak pemuatan geometri** (sudah diimplementasikan di `html/Script_Main.html`): satu promise in-flight dipakai bersama (`_OPS_GEO.wppPromise`), bukan satu `fetch` per pemanggil. Alasannya geometri ±10 MB — tanpa guard, setiap re-render (ganti tab/filter/reload KPI) menyalakan unduhan sendiri dan saling berebut jaringan. Pemuat memakai `cache: 'force-cache'` (GitHub raw mengirim `max-age` panjang), batas waktu 30 detik lewat `AbortController`, 1 percobaan ulang, dan pengecekan `response.ok` + `features` non-kosong. Hasil disimpan di `_OPS_GEO.wppGeoJsonData`; kegagalan mereset promise agar bisa dicoba lagi. Pemanggil menerima `(data, error)` dan **wajib** menampilkan status lewat `_opsMapStatus()` — kegagalan tidak boleh hanya masuk `console`.
- **Peta Ikhtisar (Executive Overview) ikut memakai cache geometri yang sama** — pemanggilnya `_ovMapInit()` → `_opsGetGeoData()`. Aturan untuk pemanggil baru: **tidak boleh** menyebut `_OPS_GEO_SRC` atau memanggil `fetch` sendiri; itu hanya boleh di `_opsFetchWppGeoJson()`. Kalau tidak, geometry ±10 MB terunduh dua kali pada sesi yang membuka Ikhtisar dan Operasi. Ada regression test yang menjaganya (`selftest.js` — "memakai cache geometri bersama, tidak ada fetch kedua").
- **Lifecycle peta Ikhtisar**: state di `_OV_MAP` (`map`, `layer`, `scale`, `data`, `metric`). Inisialisasi **lazy** (baru saat `_ovMapLoad()` dipanggil setelah payload`), teardown di `_renderViewContent()` → `_ovMapDestroy()` yang memanggil `map.remove()` lalu meng-nol-kan referensi — SPA menimpa `#page-content`, jadi map yang tertinggal akan menempel pada container yang sudah tidak ada (`map._container` orphaned, layer tidak tampil). Kalau tambah view berpetakan di masa depan, masukkan ke teardown yang sama.
- **Agregasi peta Ikhtisar** di server: `DashboardService._dashWppMap(lautYtd, udaraYtd)` dipanggil dari `dashboard_getOverview()` dan hasilnya ikut di payload sebagai `wppMap` — bukan endpoint terpisah. Alasannya petanya read-only dan butuh angka yang **harus identik** dengan kartu KPI di halaman yang sama; dua request terpisah risking tampilkan angka berbeda sementara (mis. hanya Salah satu yang kena cache).
  - `WPPCode` di-`String().trim()` saat pengelompokan: sheet bisa menyimpan `" 921 "`, dan tanpa trim kode itu tidak akan cocok dengan properti `wppnri` pada geometri sehingga WPP-nya diam-diam terwarnai 0.
  - Baris tanpa `WPPCode` tidak dibuang — dihitung ke penghitung `tanpaWpp` dan ditampilkan sebagai catatan. Data yang hilang diam-diam lebih berbahaya daripada angka yang tidak rapi.
  - Nama wilayah diambil dari sheet `WPP_NRI` (sumber yang sama dengan geometri), bukan dari kolom nama transaksi, supaya label tooltip dan batas poligon tidak pernah berbeda.
  - Daftar metrik dikirim server sebagai `wppMap.metrics` (`key`/`label`/`unit`) dan **chip di-render runtime dari daftar itu**. Client tidak boleh meng-hardcode kunci metrik; begitu server menambah/mengganti metrik, chip ikut sinkron. `_ovMapMetricDef()` boleh mengembalikan `null` kalau kunci tidak cocok, jadi semua pemakai hasilnya harus di-guard (`def && def.label`) — satu `TypeError` di dalam `eachLayer()` membatalkan seluruh paint **dan** legenda.
- **CSS peta Ikhtisar**: aturan dasar `#ov-map` / `.ov-map-rank-list` ditulis di seksi OVERVIEW, maka **media query-nya harus diletakkan sesudahnya** (akhir file). Specificity sama (ID/class), jadi aturan dasar yang lebih belakangan menang — breakpoint yang diletakkan sebelum aturan dasar mati diam-diam (terbukti lewat probe geometri: tinggi peta tetap 420px di 768px). Ada regression test untuk urutan ini.

## 10. Performance Notes

- `wpp_final.geojson` besar (jutaan baris) — pertimbangkan simplifikasi geometri (mis. `mapshaper`) sebelum dipakai di frontend jika ukuran file jadi masalah loading pertama kali. Ini keputusan teknis saat implementasi, dicatat di `CHANGELOG.md` jika dilakukan.
- Query agregasi dashboard (Overview) sebaiknya di-cache server-side (`CacheService`, TTL pendek, mis. 5 menit) supaya tidak scan ulang seluruh sheet transaksi tiap load — terutama karena data makin banyak seiring waktu (mingguan, akumulatif).

## 11. Keamanan & Audit

- Semua endpoint tulis (create/update/void) wajib lewat `LockService` (`Lock.js`) untuk cegah race condition submit bersamaan.
- Semua create/update/void otomatis insert baris ke `Audit_Log` (siapa, aksi, sheet, RowID, alasan jika ada).
- Password/auth: karena bukan SSO instansi, gunakan hashing standar (jangan simpan plaintext) — detail library hashing dipilih saat implementasi, dicatat di `CHANGELOG.md`.
- **Status akun**: `PENDING` (menunggu persetujuan) → `APPROVED` (aktif) / `REJECTED` (ditolak), plus `NONAKTIF` (dinonaktifkan Superadmin). `REJECTED` & `NONAKTIF` hanya bisa diubah oleh `SUPERADMIN` lewat `services/AdminService.js`.
- **Verifikasi email saat registrasi (30 Sep 2026)**: alur `auth_register` dipecah tiga endpoint — `auth_requestOtp` (validasi penuh + kirim kode 6 digit), `auth_verifyOtp` (tukar kode jadi `pendingToken` sekali pakai), `auth_register` (wajib menyertai `pendingToken`, baru menulis `Users` + `Approval_Queue`). Baris akun **tidak pernah** dibuat sebelum email terbukti. Semua endpoint masuk satu `LockService` untuk mencegah dua registrasi concurrent lolos cek unik.
- **Isi OTP & token disimpan di `CacheService`, bukan sheet** (prinsip §9: cache untuk hal yang sifatnya sementara & berakhir sendiri):
  - `otp_<email>` → `{ code, attempts }`, TTL **10 menit**.
  - `otppend_<pendingToken>` → `{ email, verifiedAt }`, TTL **15 menit**.
  - `otpsent_<email>` → timestamp kirim terakhir, TTL 60 detik + 10 menit (cooldown resend 60 detik).
  - `pendingToken` **terikat ke `email`**: `auth_register` menolak bila email yang didaftarkan berbeda dari email pada token. Dampak yang diinginkan: satu email yang sudah dibuktikan tidak bisa dipakai untuk membuat akun dengan email lain; dan token tetap hidup bila registrasi gagal di tengah (user memperbaiki data tanpa mengulang OTP) — baru dihapus setelah baris akun berhasil ditulis.
- **Kode OTP tidak pernah keluar lewat respons API.** Yang dikembalikan hanya `{ pendingToken }`; kode hanya dikirim lewat email. Batas percobaan 5x per kode, lalu kode dihapus dan harus diminta ulang.
- **Pengiriman email memakai `MailApp`** dan **wajib** scope `https://www.googleapis.com/auth/script.send_mail` di `appsscript.json`. Kegagalan kirim **tidak boleh** diam-diam: `_ntfKirimEmail()` mengembalikan `{ ok, reason }` (alasan error otorisasi/kuota diterjemahkan ke bahasa user), `auth_requestOtp` membuang kode dari cache bila gagal kirim, dan `notifikasi_generateReminderMingguan` melaporkan `emailErrors[]` ke UI alih-alih menampilkan "Email terkirim" padahal 0 terkirim. Menambah scope berarti user harus memberi ulang otorisasi setelah `clasp push`.
- **Validasi registrasi punya satu sumber**: `_otpValidasiPendaftaran()` dipakai `auth_requestOtp` **dan** `auth_register`, sehingga pesan error di tahap OTP sama persis dengan tahap akhir — tidak mungkin ada data yang lolos tahap 1 tapi ditolak tahap 2 tanpa alasan yang jelas.
- **Keunikan ganda**: `Email` unik per akun yang bisa dipakai (lihat status), dan `NIP` unik. Pengecualian NIP: pemilik akun `REJECTED` dengan email yang sama boleh mendaftar ulang memakai NIP-nya sendiri.
- **Sesi & pencabutan** (Fase 13): token sesi disimpan di `CacheService` dengan TTL 6 jam dan **tidak bisa di-enumerate**, jadi Superadmin tidak dapat menghapus token milik user tertentu secara langsung. Karena itu setiap perubahan akun (status/role/divisi) dan reset password menandai `revoked_<UserID>` (TTL 12 jam > TTL sesi) di cache yang sama; `_requireSession()` memverifikasi marker tersebut sehingga token lama langsung ditolak dan user diminta login ulang (marker dibersihkan saat login berhasil). Efek samping yang diinginkan: `status`/`role`/`divisi` yang tersimpan di cache sesi tidak pernah "usang" lebih lama dari satu siklus login.
- **Auto-polling status persetujuan & heartbeat aplikasi (Fase 14 Polish)**: `auth_checkRegistrationStatus` memeriksa status akun pendaftar (`PENDING`/`APPROVED`/`REJECTED`) tanpa autentikasi sesi dan tanpa membocorkan `PasswordHash`. Klien di layar pending menjalankan polling berkala (8s) dan langsung memunculkan banner notifikasi persetujuan + tombol Masuk ke Akun (Sign In) begitu akun di-ACC oleh atasan. Klien yang sudah masuk menjalankan heartbeat (25s) serta event `visibilitychange`/`focus` untuk memperbarui badge notifikasi, reminder strip, dan antrean approval secara otomatis tanpa reload halaman.
- **Catatan Masalah Terbuka (Persetujuan Pendaftar Staf oleh Superadmin — Sebelum Fase 15)**: Terdapat ketidakselarasan pada `auth_decideApproval` di mana Superadmin ditolak saat memutuskan permohonan Staf (`q['RoutedTo'] === 'KADIV'`), mengakibatkan permohonan yang di-ACC Superadmin tidak ter-update di sheet `Users`. Aturan RBAC akan diselaraskan agar Superadmin memiliki hak veto penuh pada seluruh antrean registrasi sebelum implementasi Fase 15.

## 12. Arsitektur Live-Sync Systemwide Tanpa Refresh (No-Refresh Architecture)

Nautika mengadopsi arsitektur SPA yang responsif secara real-time tanpa memaksa user me-refresh peramban (F5). Karena Google Apps Script (GAS) tidak mendukung persistent connection seperti WebSocket/SSE, live-sync dibangun menggunakan pola **Cache-Driven Lightweight Versioning**.

### 12.1 Mekanisme Cache Versioning Server-Side
- Setiap operasi tulis data transaksi (submit, revisi, anulir) di seluruh sheet `TX_*` memicu `bumpTxVersion()` di `data/SheetAccess.js`.
- Fungsi `bumpTxVersion()` menaikkan integer `DASH_TX_VERSION` di `CacheService.getScriptCache()`.
- Server menyediakan endpoint hemat-sumberdaya: `app_getSyncState(token)`:
  - **Zero-Sheet-Read**: Endpoint ini **tidak membaca sheet sama sekali**; hanya membaca integer `DASH_TX_VERSION`, jumlah unread notifikasi user, dan jumlah approval queue (jika approver) dari cache RAM.
  - Waktu eksekusi: < 50ms, konsumsi kuota kueri Google Sheets: 0.

### 12.2 Siklus Heartbeat Client-Side
- Client menjalankan heartbeat rutin setiap **35 detik** menggunakan fungsi pembungkus `_silentRun(fn)` (agar tidak memicu animasi busy spinner `#filter-busy`).
- **Tab Visibility Guard**: Jika tab browser berstatus `hidden` (diminimize atau pindah tab), heartbeat di-pause untuk mencegah zombie polling dan pengurasan kuota. Begitu tab kembali `visible` (`visibilitychange`/`focus`), client langsung melakukan 1 kali sinkronisasi instan (*sync-on-focus*).
- Jika `serverTxVersion > clientLastTxVersion`:
  - Terjadi mutasi data oleh pengguna lain.
  - Client memicu *silent reload* pada modul yang sedang aktif dibuka.
  - `clientLastTxVersion` disinkronkan ke nilai terbaru.

### 12.3 Form Modal Guard (Anti-Interupsi Input)
- Sebelum silent reload modul dijalankan, client memeriksa apakah ada modal form atau drawer interaktif yang sedang terbuka (`document.querySelector('.n-modal:not(.n-hidden)')` atau flag form input aktif).
- **Aturan Tegas**: Jika ada form yang sedang terbuka atau user sedang mengetik, silent reload modul **wajib ditunda (deferred)** sampai form selesai disimpan atau ditutup secara manual oleh user. Tidak ada ketikan pengguna yang boleh hilang atau ter-reset akibat auto-refresh.

### 12.4 Modular Silent Reloaders
Setiap modul memiliki fungsi reloader non-destruktif yang terdaftar di registry `_SYNC_RELOADERS`:
- `overview`: me-reload data agregasi `_ovLoadData()`.
- Modul divisi (Tata Usaha, Operasi Laut, Operasi Udara, Intelijen, Pemantauan, Perawatan, Logistik, Pengawakan, Kegiatan, Riwayat): me-reload KPI card dan tabel riwayat tanpa me-reset filter periode global dan tanpa merusak state peta Leaflet.
- Peta Leaflet (Operasi & Ikhtisar): tidak mengunduh ulang GeoJSON 10MB; hanya memperbarui layer data intensitas/choropleth dan memanggil `invalidateSize()`.

