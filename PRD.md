# PRD — Nautika
**Sistem Monitoring & Pelaporan Direktorat Pengendalian Operasi Armada (POA)**
Kementerian Kelautan dan Perikanan Republik Indonesia

Status: **Aktif — dokumen acuan tunggal.** Semua dokumen lain (`ARCHITECTURE.md`, `DATA_SCHEMA.md`, `DESIGN.md`, `AGENTS.md`) tunduk pada dokumen ini. Jika ada konflik, PRD ini yang menang.

Versi: 1.0
Menggantikan seluruh scope lama di `context.md` / `progress.md` versi sebelumnya (dianggap usang, lihat `CHANGELOG.md`).

Catatan platform: sistem ini dibangun murni di atas Google Apps Script, dengan Google Spreadsheet sebagai database dan Google Drive sebagai storage file. Ini bukan keputusan sembarang — ini batasan platform yang mengikat seluruh requirement di bawah (mis. mekanisme versioning berbasis baris sheet, bukan transaksi database relasional; upload lewat Drive API, bukan object storage eksternal). Detail teknis lengkap ada di ARCHITECTURE.md, tapi requirement di dokumen ini disusun dengan platform ini sebagai asumsi dasar, bukan sesuatu yang bisa diganti tanpa menulis ulang PRD. Semua pakai clasp.

---

## 1. Latar Belakang & Tujuan

Direktorat POA memiliki 7 unit kerja yang saat ini melaporkan kinerja bulanan lewat satu spreadsheet manual yang tidak terstruktur (lihat lampiran sumber data infografis Agustus 2026). Tujuan Nautika:

1. Mengganti pelaporan manual dengan sistem input **mingguan terstruktur** yang otomatis terakumulasi jadi bulanan/YTD.
2. Memberi Direktur **satu dashboard** untuk mengawasi seluruh unit kerja, dengan drill-down ke tiap divisi.
3. Menjadi **satu sumber kebenaran (single source of truth)** untuk data kinerja, anggaran, kesiapan armada, dan SDM direktorat.
4. Menyediakan jejak audit penuh: siapa input apa, kapan, revisi keberapa, dan siapa yang membatalkan (anulir) data apa.

## 2. Non-Tujuan (Out of Scope)

- Bukan sistem akuntansi/keuangan resmi negara (tidak menggantikan SAKTI/aplikasi keuangan pemerintah) — ini alat monitoring internal.
- Bukan sistem pelacakan kapal real-time (AIS/VMS) — data operasi diinput manual berdasarkan laporan lapangan, bukan live tracking.
- Tidak menangani autentikasi SSO instansi (pakai sistem login sendiri berbasis Apps Script + tabel user).

## 3. Definisi Peran (RBAC)

| Role | Cakupan Akses | Approval Power |
|---|---|---|
| **Superadmin** | Teknis penuh: kelola user, master data, audit log, approve registrasi Kepala Divisi | Approve pendaftar role Kepala Divisi; fallback approve Staf jika divisi belum punya Kadiv aktif |
| **Direktur** | Baca & CRUD semua divisi (ringkas di Overview, detail penuh di tiap modul) | Anulir data di divisi mana pun |
| **Kepala Divisi** (7 unit) | CRUD penuh data divisinya; baca ringkas (KPI) divisi lain via Overview | Approve pendaftar role Staf di divisinya sendiri; anulir data divisinya sendiri |
| **Staf/Pegawai** | CRUD data di divisinya sendiri (input, edit, hapus/anulir data yang ia atau rekan divisinya input) | Tidak punya hak approval registrasi/anulir lintas orang lain di luar aksi normal CRUD |

**Prinsip kunci**: akun **per pegawai** (bukan per divisi/shared account). Satu divisi bisa punya banyak Staf + satu atau lebih Kadiv. Semua yang berada dalam satu divisi saling melihat dan bisa CRUD data divisi tersebut — scope dibatasi oleh `DivisiID`, bukan oleh role individual dalam divisi itu.

### 3.1 Alur Registrasi & Approval

> **Revisi 30 Sep 2026 (disetujui user): verifikasi OTP email + NIP sebagai field wajib.**
> `Email` dan `NIP` adalah dua identitas terpisah, keduanya wajib. Akun **tidak** lagi dibuat di langkah pertama: kode OTP harus dibuktikan dulu.

1. Pegawai baru membuka halaman Register: isi nama, **email**, **NIP**, pilih **Divisi**, pilih **Role yang dilamar** (Kepala Divisi / Staf).
2. **Verifikasi email (OTP)** — klik "Kirim Kode Verifikasi". Server memvalidasi **seluruh** field dulu; baru ia mengirim kode 6 digit ke email tersebut.
   - Kode berlaku 10 menit, hanya bisa dipakai sekali, maksimal 5 percobaan salah.
   - Permintaan ulang minimal jarak 60 detik.
   - **Belum ada** baris `Users`/`Approval_Queue` pada tahap ini — kode OTP hanya hidup di cache.
   - Gagal kirim email (scope/kuota) → kode dibuang sekalian, user diberi tahu penyebabnya (tidak "kode terkirim" palsu).
3. User memasukkan kode di halaman yang sama. Bila benar, server menerbitkan `pendingToken` sekali pakai yang **terikat ke email tersebut** — token milik email A tidak bisa dipakai mendaftar email B.
4. Barulah server menerima pendaftaran: `pendingToken` valid → baris `Users` (`PENDING`) + `Approval_Queue` dibuat dalam satu operasi ber-`Lock`.
   - `NIP` disimpan sebagai **digit saja** dan harus **unik** — satu NIP tidak boleh dipakai dua akun, walau email berbeda.
   - Pengecualian: NIP milik akun `REJECTED` **dengan email yang sama** boleh dipakai ulang (orang yang sama mendaftar ulang).
5. Status akun awal: `PENDING`. User `PENDING` hanya bisa melihat halaman "Menunggu Persetujuan", tidak bisa akses modul apa pun.
6. Routing approval:
   - Role dilamar = **Kepala Divisi** → notifikasi masuk ke **Superadmin**.
   - Role dilamar = **Staf** → notifikasi masuk ke **Kadiv aktif di divisi tersebut**. Jika divisi belum punya Kadiv approved (`APPROVED`) sama sekali → fallback ke Superadmin.
7. Approver menekan Approve/Reject. Approve → status `APPROVED`, akun aktif, role & divisi terkunci (perubahan role/divisi berikutnya hanya lewat Superadmin di Admin Panel).
8. Reject → status `REJECTED` dengan alasan wajib diisi, user diberi tahu, bisa register ulang.

> **Konsekuensi yang disengaja**: sheet `Users` tidak pernah berisi akun yang email-nya belum dibuktikan benar. Pendaftaran yang gagal di tengah (mis. NIP sudah dipakai) **tidak** meninggalkan baris yatim — `pendingToken` masih hidup 15 menit sehingga user bisa memperbaiki data dan melanjutkan tanpa mengulang OTP.

## 4. Struktur Divisi

Nama resmi (untuk data/dokumen) vs nama tampilan (dashboard):

| Nama Resmi | Nama di Dashboard | Kode | Jabatan Kadiv |
|---|---|---|---|
| Suku Bagian Tata Usaha | Tata Usaha | `TU` | Kepala Suku Bagian |
| Sub Direktorat Operasi Kapal Pengawasan dan Pesawat | Operasi Laut & Udara | `OPS` | Kepala Sub Direktorat |
| Tim Kerja Pengelolaan Sistem Informasi Intelijen KP | Intelijen | `INTEL` | Ketua Tim Kerja |
| Tim Kerja Pelayanan Sistem Pemantauan Kapal Perikanan | Pemantauan | `PANTAU` | Ketua Tim Kerja |
| Tim Kerja Perawatan Armada Pengawasan | Perawatan | `RAWAT` | Ketua Tim Kerja |
| Tim Kerja Penyediaan Logistik Armada Pengawasan | Logistik | `LOG` | Ketua Tim Kerja |
| Tim Kerja Pengawakan Armada Pengawasan | Pengawakan | `AWAK` | Ketua Tim Kerja |

Catatan: Operasi Laut dan Operasi Udara secara organisasi berada di bawah Sub Direktorat yang sama. **Keputusan implementasi (dikonfirmasi sesi 14 Sep 2026)**: keduanya digabung dalam satu `DivisiID = OPS` di tabel `Divisi` — Kepala Sub Direktorat dan seluruh stafnya memakai `DivisiID = OPS`. Dashboard dipisah jadi dua modul (Operasi Laut & Operasi Udara) hanya untuk kemudahan baca, bukan karena berbeda scope RBAC. Nama jabatan Kadiv per tipe unit: **Kepala Suku Bagian** (Suku Bagian), **Kepala Sub Direktorat** (Sub Direktorat), **Ketua Tim Kerja** (Tim Kerja).

## 5. Modul & Ruang Lingkup Data

Sumber kebenaran struktur data ada di `DATA_SCHEMA.md`. Bagian ini mendefinisikan **apa yang ditampilkan dan apa yang diinput** per modul, berbasis analisis infografis Agustus 2026.

### 5.1 Executive Overview
- Ringkasan KPI seluruh divisi (bukan seluruh data) — target: Direktur bisa scan kondisi direktorat dalam <30 detik.
- Kartu ringkas per divisi: 2-4 metrik paling kritikal (mis. Tata Usaha: %realisasi; Perawatan: rasio kapal siap; Operasi: realisasi hari operasi).
- Filter periode global (lihat §9) memengaruhi seluruh kartu.
- Tidak ada input di halaman ini — read-only aggregation.
- **Peta sebaran wilayah (choropleth WPP)** sebagai elemen paling luas di halaman, berisi:
  - pengalih metrik: Aktivitas (KII+KIA+rumpon) / KII / KIA / Rumpon / Cakupan (NM²),
  - panel **Top 5 WPP** untuk metrik aktif (synced dengan peta: hover menyorot WPP, klik memfokuskan kamera),
  - legenda interval dengan satuan metrik.
  Peta memakai data yang sama dengan §8.1 (Laut + Udara) agar angka di peta dan angka di modul asal tidak mungkin berbeda. Modul Pemantauan **tidak** dipetakan karena `TX_Pemantauan` tidak punya kolom `WPPCode` (lihat §8.3).
- **Urutan halaman Ikhtisar**: KPI Utama → Peta (full-width) + ranking → chart tren/konteks → kartu divisi → tabel. KPI tetap di paling atas agar "_condition direktorat" terbaca dalam satu sapuan; peta menyusul sebagai konteks geografis.

### 5.2 Tata Usaha
**Ditampilkan**: Pagu (Reguler + ABT), Realisasi SP2D, Realisasi Akrual, Sisa SP2D, Sisa Akrual, %SP2D, %Akrual — kumulatif YTD dan breakdown mingguan yang membentuknya.
Di bawah baris input Pagu juga tampil **jumlah revisi pagu yang sudah terjadi** (`Belum pernah direvisi` / `Revisi pagu: sudah N kali`), dihitung dari seluruh riwayat `ACTIVE`. Saat pagu dibuka lewat `Ubah Pagu` dan angkanya benar-benar diubah, baris yang sama menampilkan prediksi `Jika disimpan, menjadi revisi ke-(N+1)` — membuka form tanpa mengubah angka **tidak** menampilkan prediksi karena itu bukan revisi.
**Diinput per minggu**: nilai Pagu Reguler, Pagu ABT (bisa direvisi jika ada perubahan struktural — wajib alasan), Realisasi SP2D minggu ini (incremental), Realisasi Akrual minggu ini (incremental).
**Dihitung sistem** (tidak diinput manual): Sisa SP2D, Sisa Akrual, %SP2D, %Akrual, akumulasi bulanan & YTD.
**Validasi**: `Pagu = Realisasi Akumulatif + Sisa` per jenis (SP2D, Akrual) — warning jika tidak konsisten, submit tetap bisa dipaksa dengan catatan.

### 5.3 Operasi Laut
**Ditampilkan**: kapal ditangkap (KII/KIA + asal negara asing), valuasi kerugian illegal fishing dicegah, rumpon ditertibkan (+lokasi WPP), valuasi rumpon, hasil riksa (per kategori: Pusat, UPT, Speedboat — tiga struktur beda), realisasi hari operasi (Kapal Pusat, Semua Kapal, Speedboat) vs target masing-masing.
**Diinput per minggu**: jumlah kapal ditangkap per kategori (dropdown: Indonesia/Asing + asal negara jika asing), valuasi kerugian, rumpon ditertibkan + **pilih WPP terkait** (dropdown atau klik peta, lihat §8), hasil riksa per kategori, hari operasi per kategori (Kapal, Speedboat, Pusat/UPT) minggu ini.
**Peta**: choropleth WPP dengan gradasi intensitas kapal terpantau/dioperasikan per wilayah (lihat §8).

### 5.4 Operasi Udara
**Ditampilkan**: pemantauan kapal perikanan (KII/KIA/objek SDK) dari udara, identifikasi rumpon lokal, cakupan wilayah operasi (NM²), realisasi hari operasi vs target 180 hari, daftar WPP yang dipantau.
**Diinput per minggu**: hasil pemantauan (KII/KIA/objek SDK), rumpon lokal teridentifikasi, cakupan wilayah (NM²) minggu ini, hari operasi minggu ini, **pilih WPP yang dipantau** (multi-select, dropdown/peta).
**Peta**: sama seperti Operasi Laut, layer terpisah (toggle Laut/Udara).

### 5.5 Intelijen
**Ditampilkan**: analisis kapal dredging/underwater ops, pelanggaran perizinan berusaha, pelanggaran mematikan transmitter, jumlah nota dinas data intelijen, **daftar kawasan konservasi + jumlah pelanggaran per kawasan**, pemantauan kapal pengangkut ikan hidup.
**Diinput per minggu**: masing-masing angka di atas, dan untuk kawasan konservasi — pilih kawasan dari Master Data Kawasan Konservasi (dropdown, bukan free text) + jumlah pelanggaran minggu ini.
**Tampilan kawasan konservasi**: halaman List/Table (bukan peta — tidak ada data koordinat), kolom: nama kawasan, provinsi, pelanggaran periode ini, YTD, tren (naik/turun vs periode lalu), tautan ke laporan terkait.

### 5.6 Pemantauan
**Ditampilkan**: persetujuan penyedia SPKP (event log), penerbitan username (periode + YTD), penerbitan SKAT (periode + YTD), pemasangan SPKP kapal migrasi (periode + YTD), **daftar kapal kondisi marabahaya** (nama kapal eksternal + jenis kapal + jenis kondisi darurat + status penanganan).
**Diinput per minggu**: angka penerbitan minggu ini (username, SKAT, pemasangan migrasi — YTD dihitung sistem), event persetujuan penyedia baru (nama penyedia, tipe, tanggal), entri kapal marabahaya baru (**kapal eksternal, bukan armada KKP** — nama kapal teks bebas + jenis + jenis kondisi darurat + status penanganan). Contoh: kapal perikanan yang kehabisan BBM di tengah laut.

### 5.7 Perawatan
**Ditampilkan**: jumlah kapal siap/tidak siap (+ daftar kapal tidak siap dengan penyebab), progres docking per kapal (Pusat vs UPT, status: proses pengadaan/tandatangan kontrak/proses docking/selesai), 3 kategori pekerjaan pemeliharaan (proses pembayaran / selesai / perencanaan) masing-masing daftar item pekerjaan + nilai Rp.
**Diinput per minggu**: update status kesiapan per kapal (dari Master Kapal, pilih siap/tidak siap + penyebab jika tidak siap), update status docking per kapal + tahap, item pekerjaan pemeliharaan baru/update (nama pekerjaan, kategori, nilai Rp, **lampiran per item** — lihat §7).
**Validasi**: total kapal siap + tidak siap tidak boleh melebihi total armada aktif di Master Kapal.

### 5.8 Logistik
**Ditampilkan**: jenis & jumlah senjata api (5 tipe), stok amunisi (awal/penggunaan/akhir per 5 tipe), Pagu/Realisasi/Sisa/% BBM (Reguler vs ABT terpisah), harga acuan BBM, rincian logistik personil (Natura/BPDT/Air Bersih/Delegasi/Jaga Sandar), tunggakan BBM.
**Diinput per minggu**: penggunaan amunisi minggu ini per tipe, realisasi BBM minggu ini (Reguler & ABT terpisah), harga acuan BBM berlaku, komponen logistik personil yang cair minggu ini, update status tunggakan.
**Dihitung sistem**: stok akhir amunisi (`awal − akumulasi penggunaan`), sisa BBM, %realisasi BBM.
**Validasi**: `Stok Akhir = Stok Awal − Σ Penggunaan` per jenis amunisi — warning jika stok minus atau tidak sinkron. `Pagu BBM = Realisasi + Sisa`.

### 5.9 Pengawakan
**Ditampilkan**: komposisi AKN Keseluruhan vs AKN POA (breakdown PNS/PPPK Fungsional/PPPK Pelaksana/PPPK Paruh Waktu/PJLP), log kegiatan personel bertanggal (penyegaran menembak, penyiapan operasi, assessment, dll), kontrak harwat (jumlah paket + nilai).
**Diinput per minggu**: perubahan komposisi AKN (jika ada mutasi/rekrutmen), kegiatan personel baru (judul, tanggal mulai-selesai, wilayah, jumlah peserta, deskripsi), update kontrak harwat.

### 5.10 Kegiatan Pendukung
Pengganti nama untuk item "Pendukung Lainnya" di sumber data — bukan milik satu divisi, tapi log kegiatan lintas-direktorat (pre-award meeting, monitoring ABT, serah terima, dsb).
**CRUD**: Direktur + semua Kepala Divisi (lintas divisi, tidak dibatasi scope).
**Field**: judul kegiatan, tanggal, deskripsi, pihak yang hadir (opsional), **lampiran foto/dokumen multi-file**.
**Ditampilkan**: sebagai feed kronologis, bisa difilter per tanggal.

### 5.11 Master Data
- **Data Kapal**: nama, kelas/tipe, homebase/UPT, status aktif. Dipakai sebagai referensi dropdown di Operasi, Perawatan, Logistik(BBM per kapal jika relevan), Pemantauan(marabahaya).
- **Profil Kapal** (turunan, read-only): klik 1 kapal → gabungan histori lintas divisi (riwayat kesiapan, riwayat operasi, riwayat docking) — lihat §6 cross-division.
- **Data Kawasan Konservasi**: nama, provinsi, (opsional lat/long untuk future map upgrade).
- **Data WPP**: kode WPP, nama wilayah — referensi dari `wpp_finals.geojson`, dipakai dropdown & peta.
- **Data User**: dikelola Superadmin — role, divisi, status akun.
CRUD Master Kapal & Kawasan Konservasi: Superadmin + Direktur. Master WPP: read-only (sumber dari file geojson, sinkron manual oleh Superadmin bila ada update batas wilayah).

## 6. Cross-Division Data

Beberapa entitas dipakai lintas modul dan harus relasional (pakai ID, bukan teks bebas):
- **Kapal** → Operasi Laut (kapal ditangkap tidak relevan tapi kapal pengawas yg dipakai iya), Perawatan (kesiapan, docking), Logistik (konsumsi BBM bila dicatat per kapal), Pemantauan (marabahaya).
- **WPP Code** → Operasi Laut, Operasi Udara, berpotensi Intelijen (kawasan konservasi berada di WPP tertentu — opsional field referensi).
- **Periode** (Tahun-Bulan-Minggu) → seluruh modul, jadi kunci utama filter global.

Halaman **Profil Kapal** menampilkan gabungan histori 1 kapal dari 3 sheet transaksi berbeda (Perawatan, Operasi, Logistik) — query lintas-sheet berbasis `KapalID`.

Pada **Operasi Laut dan Operasi Udara, kapal pengawas yang dipakai wajib dipilih** (keputusan user, Fase 14 Item 6) — tanpa itu, hari operasi tidak bisa diatribusikan ke kapal mana pun sehingga bar "Kapal Pengawas Teraktif" di Ikhtisar dan histori Profil Kapal kosong. Konsekuensi turunannya:

- Form submit maupun revisi Operations Laut/Udara punya pemilih kapal; kosong = ditolak.
- Modal revisi jadi jalur pengisian untuk baris lama yang belum punya kapal (tidak ada migrasi/backfill).
- Master Kapal punya `JenisKapal` (enum: Kapal Pusat, Speedboat) supaya kapal yang muncul di form bisa disaring sesuai `Kategori Hari Operasi`; kapal yang belum diisi jenisnya tetap dapat dipakai di semua kategori. Kapal baru wajib mengisi jenis.
- `TX_Logistik_*` tetap memperlakukan `KapalID` sebagai opsional — tidak ada perubahan scope di sana.

## 7. Data Lifecycle: Mingguan → Bulanan → YTD

1. Setiap entri disimpan sebagai baris transaksi mingguan dengan `Periode` (format `YYYY-MM-WW` atau tanggal minggu berjalan), `DivisiID`, `SubmittedBy`, `Timestamp`, `Status` (`ACTIVE`/`VOID`), `VersionOf` (referensi ke entri sebelumnya jika ini revisi).
2. Nilai bulanan & YTD **selalu dihitung ulang dari sheet transaksi** (sum semua entri `ACTIVE` dalam rentang), bukan disimpan sebagai angka statis — supaya konsisten dengan revisi/anulir.
3. **Revisi**: entri yang sudah ada bisa diedit. Sistem tidak menimpa baris lama — menyimpan sebagai versi baru dengan referensi ke versi lama, dan versi lama ditandai `SUPERSEDED`. Alasan revisi wajib diisi.
4. **Anulir**: entri ditandai `VOID` dengan alasan wajib + siapa yang menganulir + timestamp. Data tetap ada di sheet (tidak dihapus fisik), tidak lagi dihitung ke agregat dashboard.
   - **Komentar anulir (`VoidReason`) wajib** — tidak ada pengecualian, berlaku untuk semua role termasuk Direktur.
   - **Komentar visible ke seluruh anggota divisi** yang sama di tabel Riwayat — bukan hanya si pengunggah, supaya staf/Kadiv tahu alasan dan dapat mengunggah laporan perbaikan.
   - **Re-submit setelah anulir diizinkan**: setelah periode X di-void, staf/Kadiv divisi tersebut dapat mengirim laporan baru untuk periode X (sistem hanya memblokir duplikat jika masih ada baris `ACTIVE`, bukan `VOID`).
   - Kewenangan anulir: SUPERADMIN (semua divisi), DIREKTUR (semua divisi), KADIV (divisinya sendiri). Staf tidak bisa anulir — hanya bisa mengusulkan revisi ke Kadiv.
5. Halaman **Riwayat Laporan** menampilkan seluruh entri (termasuk `SUPERSEDED` dan `VOID`) dengan status jelas, siapa melakukan apa, dan komentar anulir tampil inline di baris yang berstatus VOID.

## 8. Peta / Geospasial

### 8.1 Peta WPPNRI (Operasi Laut & Operasi Udara)
- Sumber: `wpp_final.geojson` (sudah tersedia, ±10 MB, di-host di GitHub raw — bukan GAS, karena Apps Script tidak bisa menyajikan berkas statik besar tanpa biaya; lihat `ARCHITECTURE.md` §Peta).
- **Wajib**: geometry di-load sekali per sesi (client-side cache — `sessionStorage`/in-memory), tidak boleh re-fetch/re-render ulang geometrinya setiap ganti filter periode atau pindah tab. Hanya layer data (warna/status per WPP) yang di-update saat filter berubah.
- **Wajib — kegagalan tidak boleh senyap**: pemuatan geometri punya batas waktu, percobaan ulang otomatis, dan status terlihat di atas peta (memuat / gagal + tombol coba lagi). Kotak peta kosong tanpa pesan apa pun dianggap bug — user harus selalu bisa membedakan "belum termuat" dari "memang tidak ada data".
- **Pewarnaan**: choropleth gradasi intensitas 1 hue (bukan multi-warna traffic-light) berdasarkan jumlah kapal/aktivitas terpantau di WPP itu pada periode terpilih. WPP dengan 0 aktivitas tetap tampil (warna paling pucat), tidak disembunyikan.
- **Legenda**: skala interval (mis. 0 / 1-5 / 6-15 / >15 kapal) dengan keterangan warna, ditampilkan di pojok peta.
- **Hover**: kode WPP, jumlah kapal terpantau periode ini, status konfirmasi pengawasan, tanggal update terakhir.
- **Form input**: memilih WPP terkait via dropdown **dan** klik langsung di peta mini pada form — keduanya sinkron dua arah (klik peta → isi dropdown; pilih dropdown → highlight+zoom peta).
- Layer Laut dan Udara terpisah (toggle), karena cakupan/wilayah pemantauan bisa berbeda.

### 8.2 Kawasan Konservasi (Intelijen)
- **Tidak ada data koordinat** — jadi halaman **List/Table**, bukan peta.
- Kolom: nama kawasan, provinsi, pelanggaran periode ini, YTD, tren, link laporan.
- Struktur data disiapkan dengan field `Latitude`/`Longitude` opsional supaya bisa di-upgrade jadi peta nanti tanpa migrasi skema.

### 8.3 Peta Sebaran di Ikhtisar (Executive Overview)
Peta read-only di §5.1 memakai sumber yang **sama persis** dengan §8.1 — ini keputusan sadar, bukan pengulangan:

- **Sumber data**: hanya dua sheet yang punya kolom `WPPCode` — `TX_OperasiLaut` dan `TX_OperasiUdara`. Keduanya diagregasi YTD sampai bulan yang dipilih filter global, lalu digabung per kode WPP.
  - `TX_Pemantauan` **sengaja tidak disertakan**: skema `TX_Pemantauan` tidak punya kolom `WPPCode` maupun koordinat, jadi mengisinya ke peta berarti mengarang lokasi. Pemantauan masuk Ikhtisar lewat kartu divisi, bukan lewat peta. Kalau nanti Pemantauan perlu dipetakan, itu **perubahan skema** (lihat `AGENTS.md` §4) — bukan penyesuaian tampilan.
- **Definisi metrik** (server-side, `DashboardService._dashWppMap()`):
  - `aktivitas` = `KII_Ditangkap` + `KIA_Ditangkap` + `RumponDitertibkan` (Laut) + `KII` + `KIA` (Udara) — dipakai sebagai metrik default karena paling menjawab "berapa banyak yang kita kerjakan di wilayah itu".
  - `kii`, `kia`, `rump` — jumlah per jenis.
  - `cakupan` = penjumlahan `CakupanWilayah_NM2` dari `TX_OperasiUdara` (satuan NM²). Berada di sheet **Udara**, bukan Pemantauan.
  - "Aktivitas" adalah jumlah **peristiwa**, bukan kapal unik — satu kapal bisa menyumbang KII di sheet Laut dan KII di sheet Udara. Label memakai kata "Aktivitas" supaya tidak salah baca sebagai jumlah kapal.
- **Skala**: 4 bucket (`0` / `1–s1` / `s1+1–s2` / `≥ s2+1`) dihitung ulang dari nilai maksimum metrik aktif, memakai palet navy `DESIGN.md` §3. Jumlah bucket dan jumlah warna ramp harus sama — kalau tidak, nilai tertinggi jatuh ke indeks warna yang tidak ada dan satu WPP hilang dari legenda.
- **Nama WPP** diambil dari sheet `WPP_NRI` (sumber yang sama dengan geometri) supaya label tooltip dan panel ranking konsisten dengan batas poligon.
- **Baris tanpa `WPPCode`** dihitung sebagai `tanpaWpp` dan ditampilkan sebagai catatan di bawah ranking, bukan dibuang diam-diam — kalau KKP salah mengisi kolom WPP, itu kelihatan, bukan hilang.
- **Tidak ada toggle layer di sini** (berbeda dari §8.1): peta Ikhtisar menampilkan satu metrik terpilih lewat chip, bukan layer Laut/Udara terpisah, karena halaman ini read-only dan tidak punya konteks operasi.
- Geometri **tidak pernah diunduh dua kali**: peta Ikhtisar memakai cache geometri yang sama dengan §8.1 (lihat `ARCHITECTURE.md` §Peta).

## 9. Filter Periode Global

- Kontrol di **pojok kanan atas** setiap halaman modul & Overview.
- Dua mode: **Bulanan** (pilih bulan+tahun, default: bulan berjalan) atau **Rentang Tanggal** (date range picker custom).
- Memengaruhi seluruh angka, tabel, dan chart di halaman aktif — termasuk peta (filter layer data, bukan reload geometri).

## 10. Analitik & Visualisasi

Prinsip: **profesional, bukan dekoratif**. Dilarang: gauge melingkar, radar chart tanpa kebutuhan jelas, pie/donut untuk kategori >4, warna kategori acak-acakan.

Detail aturan operasional (pemilihan chart, warna, komposisi halaman, checklist) mengikuti `DESIGN.md` §6 Chart Style Guide. Requirement tambahan di sini (sumber kebenaran):

1. **Ikhtisar dulu (progressive disclosure)** — setiap halaman dashboard wajib disusun piramida-terbalik: (a) zona atas: 3–6 kartu angka kunci (terpenting = terbesar & paling kiri-atas), (b) zona tengah: 1–3 chart konteks/tren, (c) zona bawah: tabel detail yang dapat digali. User harus menemukan ikhtisar (angka utama, status, arah tren) dalam **≤5 detik**. Ukuran kualitas utama dashboard adalah seberapa cepat user menemukan makna datanya — bukan penampilannya.
   - **Peta geospasial sebagai elemen terbesar diperbolehkan di zona atas**, asalkan KPI angka tetap mendahului peta. Untuk Ikhtisar, urutannya: KPI → peta full-width + ranking → chart → kartu divisi → tabel (lihat §5.1). Peta tidak menggantikan KPI, melainkan menambah dimensi "di mana".
   - **Kartu grid tidak boleh diregangkan** (`grid-auto-rows: 1fr` dilarang): memaksa semua kartu satu baris setinggi kartu terpanjang dan menghasilkan lubang whitespace besar di kartu berisi pendek. Kartu sebaiknya setinggi isinya (`align-items: start`).
2. **Chart sesuai pertanyaan data** — bar/grouped bar (perbandingan kategori, sumbu dari 0), line/area (tren waktu), stacked bar (komposisi), horizontal progress bar (pencapaian vs target, pengganti gauge), donut hanya ≤4 kategori dan proporsi sebagai poin utama, choropleth (geospasial WPP), tabel untuk data yang bersifat daftar.
3. **Varietas** — memakai tipe chart yang sama secara berulang **diperbolehkan** (satu library & bahasa visual konsisten), tetapi setiap halaman dashboard wajib menampilkan minimal 2 jenis representasi berbeda, kecuali seluruh data pada halaman tersebut memang satu jenis pertanyaan data (keputusan desain, dicatat).
4. **Warna mengikuti kriteria** — chart hanya memakai palet `DESIGN.md` §3; setiap warna wajib bermakna dan maknanya konsisten di semua halaman; warna bukan satu-satunya penanda informasi (perlu label/bentuk pendamping).

Jenis chart yang dipakai sesuai konteks data (detail per modul & tipe chart di `DESIGN.md` §6 Chart Style Guide):
- **Bar / grouped bar**: perbandingan realisasi vs target, komposisi kategori (mis. PNS vs PPPK).
- **Stacked bar**: breakdown dalam satu total (mis. Reguler vs ABT dalam Pagu).
- **Line/area chart**: tren mingguan/bulanan/YTD (baru terisi penuh setelah histori data terkumpul — di awal pemakaian akan tampak minim, ini disengaja bukan bug).
- **Horizontal progress bar**: pencapaian % terhadap target (pengganti gauge).
- **Tabel data**: tetap jadi elemen utama untuk data yang sifatnya daftar (kapal tidak siap, item pekerjaan, kegiatan personel) — tidak semua dipaksa jadi chart.
- **Choropleth**: khusus data geospasial WPP.
- **Donut/pie**: hanya untuk kategori ≤4 dengan proporsi sebagai poin utama (mis. status kesiapan armada: siap/tidak siap).

## 11. Upload & Evidence

- **Granularitas**: lampiran per-item (per pekerjaan, per kegiatan), bukan satu lampiran per submission — modul Perawatan dan Kegiatan Pendukung butuh banyak lampiran sekaligus.
- **Dua mode**: upload file langsung (base64 via Apps Script) atau tempel link Google Drive — sistem menyalin (copy) file dari link tersebut ke folder sistem sendiri (bukan sekadar simpan link, supaya tidak hilang jika sumber asli dihapus/izin dicabut).
- **Batas ukuran**: file umum 15MB. File video: jika >50MB, ditolak dengan pesan minta kompres dulu (tidak diproses, tidak disimpan).
- **Struktur folder Drive**: `[Divisi] / [Periode] / [Konteks-Form-atau-Item] / [file]` — contoh: `Perawatan/2026-08/Docking-KP-Orca04/repair-list.pdf`.
- Preview lampiran tersedia di halaman Riwayat Laporan & di halaman detail modul terkait.
- Akses lampiran lewat tombol **"Lihat"** pada baris riwayat (satu pola untuk semua modul divisi) — tidak ada tombol lampiran terpisah di baris tabel. Modul **Perawatan** punya tambahan tombol **"Kelola"** di bagian lampiran modal yang sama, karena di modul itu lampiran boleh ditambah setelah laporan terkirim; modul lain masih read-only.

## 12. Non-Functional Requirements

- **Performa peta**: lihat §8.1 — no re-render geometri.
- **Audit trail**: setiap create/update/void tercatat dengan user, timestamp, alasan (untuk update/void).
- **Concurrency**: pakai locking (`LockService`) saat menulis ke sheet transaksi supaya tidak ada race condition saat beberapa user submit bersamaan.
- **Validasi sisi server**: semua kalkulasi (persentase, sisa, akumulasi) dihitung di server (Apps Script), bukan di klien, supaya tidak bisa dimanipulasi dan konsisten lintas user.
- **Desain**: mengikuti `DESIGN.md` — SaaS pastel, palet warna terbatas, tanpa elemen dekoratif berlebih (anti AI-slop, lihat negative prompt di `DESIGN.md`).

## 13. Asumsi & Item Terbuka

- Beberapa nilai di sumber data infografis Agustus 2026 ambigu (contoh: target hari operasi "Kapal Pusat" kosong; kategori "34 Kapal" di Hasil Riksa Operasi tanpa label jelas). Ini akan diklarifikasi manual ke PIC masing-masing divisi saat desain form final — tidak menghambat pembangunan struktur data karena field-nya tetap didefinisikan generik.
- Data historis sebelum sistem ini berjalan **tidak dimigrasikan otomatis** — YTD dihitung dari titik sistem mulai dipakai, kecuali ada keputusan lain untuk input data backlog secara manual.
