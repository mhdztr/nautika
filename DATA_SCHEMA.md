# DATA_SCHEMA.md — Nautika

Skema kolom lengkap tiap sheet. Ini turunan teknis dari `ARCHITECTURE.md` §3-4. Kolom relasional (`RowID`, `DivisiID`, `Periode`, `SubmittedBy`, `Timestamp`, `Status`, `SupersedesRowID`, `VoidReason`, `VoidedBy`, `VoidedAt`) **selalu ada di setiap sheet TX_*** — di bawah ini hanya ditulis kolom **tambahan spesifik modul** untuk menghindari pengulangan. Kolom wajib itu disebut "kolom standar" saja.

Tipe data ditulis ringkas: `text`, `number`, `date`, `bool`, `enum(...)`, `ref(Sheet)`.

---

## Nautika_Master

### `Kapal`
| Kolom | Tipe |
|---|---|
| KapalID | text (PK) |
| Nama | text |
| Kelas | text |
| Homebase_UPT | text |
| StatusAktif | bool |
| JenisKapal | enum dari `Opsi` grup `KAPAL_JENIS` (`KAPAL_PUSAT`, `SPEEDBOAT`), nullable |
| KelasKapal | enum(`BESAR_GT100`, `SEDANG`, `KECIL`), nullable — penanda 34 Kapal Pengawas Ukuran Besar |
| PanjangMeter | number, nullable |
| WPPDefault | ref(WPP), nullable |
| PangkalanHomebase | text, nullable |

> `Kapal.JenisKapal` (Fase 14 Item 6) menentukan kapal mana yang boleh dipilih untuk
> tiap `HariOperasi_Kategori` di `TX_OperasiLaut`. **Kolom kosong = tidak dibatasi**:
> kapal yang dibuat sebelum kolom ini ada dianggap cocok dengan kategori apa pun,
> supaya data lama tidak terkunci dari form. Kapal baru wajib mengisinya.
> DB terlanjur dibuat akan menambah kolom ini sendiri lewat self-heal
> (`ensureKapalJenisColumn()`) plus seed enum `KAPAL_JENIS` — tanpa perlu `setupForce`.

### `Kawasan_Konservasi`
| Kolom | Tipe |
|---|---|
| KawasanID | text (PK) |
| Nama | text |
| Provinsi | text |
| Latitude | number (nullable) |
| Longitude | number (nullable) |

### `WPP`
| Kolom | Tipe |
|---|---|
| WPPCode | text (PK) |
| NamaWilayah | text |

*Sinkron manual dari `wpp_final.geojson` (Superadmin): `WPPCode` = properti `wppnri` (huruf kecil, value seperti `"571"`), `NamaWilayah` = properti `name` (mis. `"WPP 571"`). Ini kunci match dengan `TX_OperasiLaut.WPPCode` dan layer peta choropleth.*

### `Divisi`
| Kolom | Tipe |
|---|---|
| DivisiID | text (PK) |
| NamaResmi | text |
| NamaDashboard | text |
| Kode | text |

### `Master_Paket`
Daftar paket pekerjaan per divisi (barang, jasa, fisik, pemeliharaan).
| Kolom | Tipe |
|---|---|
| PaketID | text (PK, mis. `PKT-TU-2026-001`) |
| DivisiID | ref(Divisi) |
| TahunAnggaran | number (mis. `2026`) |
| NamaPaket | text |
| KategoriPaket | enum(`BARANG`, `JASA_KONSULTASI`, `JASA_LAINNYA`, `KONSTRUKSI`) |
| SumberDana | enum(`REGULER`, `ABT`) |
| PaguAnggaran | number |
| KodeAkunMak | text |
| PICTimja | text |
| StatusAktif | bool |

### `Users`
| Kolom | Tipe |
|---|---|
| UserID | text (PK) |
| Nama | text |
| Email | text — identitas login utama; unik per akun aktif |
| NIP | text — **wajib** (registrasi), **unik**. Disimpan sebagai digit saja (spasi/tanda hubung dibuang saat penulisan). Nullable/dikosongkan **hanya** untuk akun lama yang sudah ada sebelum kolom ini ada, dan untuk akun seed/teknis yang dibuat lewat `Setup.js` |
| PasswordHash | text |
| DivisiID | ref(Divisi), **nullable** untuk role SUPERADMIN dan DIREKTUR (disimpan sebagai string kosong) |
| Role | enum(SUPERADMIN, DIREKTUR, KADIV, STAF) |
| Status | enum(PENDING, APPROVED, REJECTED, NONAKTIF) |
| ApprovedBy | ref(Users), nullable |
| RegisteredAt | date |
| ApprovedAt | date, nullable |

> **Penambahan kolom `NIP` (30 Sep 2026, disetujui user).** Kolom disisipkan setelah `Email` pada sheet yang baru diinisialisasi. Spreadsheet yang sudah ada **tidak** diubah urutannya: `ensureUsersNipColumn()` (`data/SheetAccess.js`) menambahkan kolom di ujung bila belum ada, dan semua operasi baca/tulis memakai pemetaan nama-header (`getHeaderIndex`) sehingga urutan tidak berpengaruh. Akun lama = NIP kosong; nilainya tidak ditebak/diisi otomatis, hanya diisi bila pemegangnya mendaftar ulang atau Superadmin mengisinya di Admin Panel. Pengecualian keunikan NIP: NIP milik akun `REJECTED` dengan **email yang sama** boleh dipakai ulang saat mendaftar ulang (lihat `PRD.md` §3.1).

### `Opsi` (daftar pilihan dinamis — sumber tunggal seluruh enum domain)
Menampung **seluruh** nilai enum domain yang **bisa ditambah/diubah** Superadmin (PRD §5.11: Master Data). Satu sheet multi-grup; `Kode` memisahkan jenis daftar. Nilai yang tersimpan di kolom transaksi = `Label` baris ini (token), sedangkan yang dilihat user di dropdown = `LabelTampil`.

| Kolom | Tipe |
|---|---|
| Kode | enum(AMUNISI, BBM, KOM_PERSONIL, AWAK_KATEGORI, AWAK_SCOPE, RAWAT_LOKASI, RAWAT_TAHAP, RAWAT_KATEGORI, OPS_RIKSA_KATEGORI, OPS_HARI_KATEGORI, KAPAL_JENIS, TU_PEGAWAI_KATEGORI, BMN_KONDISI, BMN_PENCATATAN, BMN_ALASAN_HAPUS, BMN_SUMBER_LOKASI, LOKASI_JENIS) — grup daftar |
| Urutan | number (urutan tampil; = urutan seed mula-mula) |
| Label | text (token nilai yang disimpan ke sheet transaksi, mis. `PISTOL_P3A`) |
| LabelTampil | text (teks yang tampil di dropdown/tabel/riwayat; maks. 80 karakter. Kosong → memakai `Label`) |
| Aktif | bool (baris non-aktif disembunyikan dari dropdown & ditolak validasi baru, tetapi `LabelTampil`-nya tetap dipakai untuk membaca baris riwayat lama) |
| DibuatOleh | ref(Users) |
| DibuatAt | date |

**Sumber tunggal, tanpa fallback hardcoded.** Pembacaan hanya lewat `getOpsiList()` (token aktif), `getOpsiLabelMap()` (peta token→`LabelTampil` untuk seluruh baris), `getOpsiItems()` (`{value,label}` untuk combobox) dan `getOpsiDetail()` — semuanya di `data/SheetAccess.js`, dengan cache 10 menit yang diinvalidasi `clearOpsiCache()` setiap kali opsi diubah. Isi awal di-seed oleh `OPSI_SEED` (`Setup.js`) lewat `setup()` atau `setupSeedOpsi()`; seed bersifat idempoten (tidak menimpa baris yang sudah ada) dan dapat dijalankan ulang setiap kali grup/token baru ditambahkan.

**Pemetaan grup → kolom transaksi:**

| Kode grup | Dipakai oleh (kolom → sheet) |
|---|---|
| `AMUNISI` | `JenisAmunisi` (TX_Logistik_Amunisi) |
| `BBM` | `Jenis` (TX_Logistik_BBM) |
| `KOM_PERSONIL` | `Komponen` (TX_Logistik_Personil) |
| `AWAK_KATEGORI` | `Kategori` (TX_Pengawakan_AKN) |
| `AWAK_SCOPE` | `Scope` (TX_Pengawakan_AKN) |
| `RAWAT_LOKASI` | `Lokasi` (TX_Perawatan_Docking) |
| `RAWAT_TAHAP` | `Tahap` (TX_Perawatan_Docking) |
| `RAWAT_KATEGORI` | `Kategori` (TX_Perawatan_Item) |
| `OPS_RIKSA_KATEGORI` | `HasilRiksa_Kategori` (TX_OperasiLaut) |
| `OPS_HARI_KATEGORI` | `HariOperasi_Kategori` (TX_OperasiLaut) |
| `KAPAL_JENIS` | `JenisKapal` (Master `Kapal`) — pencocokan dengan `HariOperasi_Kategori` di TX_OperasiLaut |
| `TU_PEGAWAI_KATEGORI` | `Kategori` (TX_TU_Pegawai di Nautika_TU) — PNS, P3K, P3K_PARUH_WAKTU, PJLP, MAGANG |
| `BMN_KONDISI` | `Kondisi` (TX_BMN_Aset di Nautika_TU) — BAIK, RUSAK_RINGAN, RUSAK_BERAT |
| `BMN_PENCATATAN` | `KategoriPencatatan` (TX_BMN_Aset di Nautika_TU) — BUKU (Intrakomptabel), REGULER (Ekstrakomptabel) |
| `BMN_ALASAN_HAPUS` | `AlasanPenghapusan` (TX_BMN_Penghapusan di Nautika_TU) — RUSAK_BERAT, KADALUWARSA, HILANG, HIBAH, PENJUALAN_LELANG, LAINNYA |
| `BMN_SUMBER_LOKASI` | `SumberLokasi` (TX_BMN_Aset di Nautika_TU) — EXIF_GPS, GPS_PENGUNGGAH, PROFIL_PENGUNGGAH, MANUAL, IMPOR_SAKTI |
| `LOKASI_JENIS` | `JenisLokasi` (Master_Lokasi_UPT di Nautika_TU) — PUSAT, PANGKALAN, STASIUN, POS_PENGAWASAN |

**Pencocokan `KAPAL_JENIS` ↔ `OPS_HARI_KATEGORI`** (Fase 14 Item 6): saat submit/revisi
`TX_OperasiLaut`, kapal yang dipilih harus cocok dengan `HariOperasi_Kategori` — kecuali
kategori kosong atau `SEMUA_KAPAL` (agregat semua kapal, jadi tidak dibatasi). Kapal
dengan `JenisKapal` kosong dianggap cocok dengan kategori apa pun. Lazy filtering
dilakukan juga di UI (dropdown kapal disaring saat kategori berubah), tapi yang
menentukan sah/tidaknya adalah validasi server.

Kolom enum yang disebut `enum(...)` di bawah tetap ditulis demikian untuk menyederhanakan pembacaan, tetapi sumber otoritatifnya adalah sheet `Opsi`.

**Yang TIDAK ada di sheet ini** (tetap sebagai konstanta struktural di `utils/Constants.js`, bukan data referensi): `ROLE`, `ROW_STATUS`, `DIVISI`, nama sheet (`SHEET_TX`/`SHEET_MASTER`), `LOG_MODE_*`, dan daftar wilayah WPP_NRI (dimuat dari GeoJSON eksternal `assets/wilayah_nri.geojson`).

---

## Nautika_TU (Dedicated Database Tata Usaha)

Spreadsheet mandiri untuk seluruh operasional dan tata kelola manajerial Suku Bagian Tata Usaha (Keuangan, Pengadaan Paket, Kepegawaian, dan Manajemen Inventaris BMN Ekstensif). Dipisahkan dari `Nautika_Transaksi` guna mengisolasi batas kuota sel Google Sheets dan LockService impor massal SAKTI.

### `Master_Lokasi_UPT`
Daftar seluruh UPT, Pangkalan, Stasiun, Pos Pengawasan SDKP, dan Kantor Pusat POA untuk acuan resolusi geotagging Haversine.
| Kolom | Tipe |
|---|---|
| LokasiID | text (PK, mis. `UPT-BATAM`, `UPT-PUSAT-POA`) |
| NamaLokasi | text |
| JenisLokasi | enum dari `Opsi` grup `LOKASI_JENIS` (`PUSAT`, `PANGKALAN`, `STASIUN`, `POS_PENGAWASAN`) |
| Latitude | number |
| Longitude | number |
| RadiusVerifikasiKm | number (default: 25) |
| StatusAktif | bool |

### `Master_BMN_Kategori`
Katalog kodefikasi kategori BMN SAKTI & standar masa manfaat Kementerian Keuangan.
| Kolom | Tipe |
|---|---|
| KodeKategori | text (PK, misal `3.05.01` Kendaraan Bermotor) |
| NamaKategori | text |
| Golongan | number (1 s.d. 8) |
| MasaManfaatTahun | number |

### `TX_TU_Pegawai`
Snapshot berkala jumlah headcount pegawai per kategori (snapshot carry-forward).
Kolom standar +
| Kolom | Tipe |
|---|---|
| Kategori | enum dari `Opsi` grup `TU_PEGAWAI_KATEGORI` (`PNS`, `P3K`, `P3K_PARUH_WAKTU`, `PJLP`, `MAGANG`) |
| Jumlah | number ($\ge 0$) |
| Keterangan | text (catatan mutasi pegawai) |

### `TX_BMN_Aset`
Register fisik inventaris BMN per-item (**Anti-Jebret**: 1 baris = 1 unit fisik tunggal).
Kolom standar +
| Kolom | Tipe |
|---|---|
| AsetID | text (UUID stabil entitas aset lintas revisi) |
| KodeBarang | text (kodefikasi barang 10 digit Kemenkeu) |
| NUP | text (Nomor Urut Pendaftaran barang) |
| NamaBarang | text |
| MerekTipe | text, nullable |
| KategoriPencatatan | enum dari `Opsi` grup `BMN_PENCATATAN` (`BUKU`, `REGULER`) |
| KodeKategori | ref(Master_BMN_Kategori) |
| TanggalPerolehan | date |
| NilaiPerolehan | number (Nilai Reguler / Beli Kotor Rp) |
| NilaiBuku | number (Nilai Buku Terkini dari SAKTI Rp) |
| Kondisi | enum dari `Opsi` grup `BMN_KONDISI` (`BAIK`, `RUSAK_RINGAN`, `RUSAK_BERAT`) |
| LokasiID | ref(Master_Lokasi_UPT) |
| LokasiDetailRuangan | text, nullable |
| Latitude | number, nullable |
| Longitude | number, nullable |
| SumberLokasi | enum dari `Opsi` grup `BMN_SUMBER_LOKASI` (`EXIF_GPS`, `GPS_PENGUNGGAH`, `PROFIL_PENGUNGGAH`, `MANUAL`, `IMPOR_SAKTI`) |
| JarakKeUPT_Km | number, nullable (kalkulasi jarak Haversine ke UPT) |
| TanggalVerifikasi | date |
| FotoEvidenceID | text, nullable (ID file foto di Google Drive / ref TX_Evidence) |
| StatusAset | enum(`AKTIF`, `DALAM_PENGHAPUSAN`, `DIHAPUS`) |
| PenghapusanID | ref(TX_BMN_Penghapusan), nullable |
| KapalID | ref(Kapal), nullable (tautan jika barang inventaris kapal) |
| ImportBatchID | text, nullable (ID batch impor SAKTI) |
| Keterangan | text, nullable |

*Dihitung sistem (on-read):* UmurAsetTahun, UmurAsetBulan, SisaMasaManfaatTahun, StatusKadaluwarsa (bool).

### `TX_BMN_Penghapusan`
Berkas usulan penghapusan BMN berjenjang sesuai tata kelola Kemenkeu.
Kolom standar +
| Kolom | Tipe |
|---|---|
| PenghapusanID | text (PK) |
| Tahap | enum(`DRAFT_USULAN`, `SURAT_USULAN`, `PERSETUJUAN_KEMENKEU`, `SK_PENGHAPUSAN`, `BAST_SELESAI`, `DITOLAK`) |
| AlasanPenghapusan | enum dari `Opsi` grup `BMN_ALASAN_HAPUS` (`RUSAK_BERAT`, `KADALUWARSA`, `HILANG`, `HIBAH`, `PENJUALAN_LELANG`, `LAINNYA`) |
| KeteranganAlasan | text |
| NomorSuratUsulan | text, nullable |
| TanggalSuratUsulan | date, nullable |
| EvidenceSuratUsulan | text, nullable (file ID PDF surat usulan Satker) |
| NomorSuratPersetujuan | text, nullable |
| TanggalSuratPersetujuan | date, nullable |
| InstansiKemenkeu | text, nullable (DJKN / KPKNL penerbit izin) |
| EvidenceSuratPersetujuan | text, nullable (file ID PDF persetujuan Kemenkeu) |
| NomorSK | text, nullable |
| TanggalSK | date, nullable |
| EvidenceSK | text, nullable (file ID PDF SK Penghapusan KKP) |
| EvidenceBAST | text, nullable (file ID PDF BAST Pemusnahan / Risalah Lelang) |
| TotalUnit | number (dihitung sistem dari detail) |
| TotalNilaiPerolehan | number (dihitung sistem dari detail) |
| TotalNilaiBuku | number (dihitung sistem dari detail) |

### `TX_BMN_Penghapusan_Detail`
Rincian aset individual yang masuk ke dalam berkas usulan penghapusan.
Kolom standar +
| Kolom | Tipe |
|---|---|
| ParentRowID | ref(TX_BMN_Penghapusan.RowID) |
| PenghapusanID | ref(TX_BMN_Penghapusan) |
| AsetID | ref(TX_BMN_Aset) |
| KondisiSaatUsul | enum(`RUSAK_BERAT`, `RUSAK_RINGAN`, `BAIK`) |
| NilaiBukuSaatUsul | number |

### `TX_TataUsaha`
*(Dikelola di spreadsheet `Nautika_TU`, dengan fallback kompatibilitas ke `Nautika_Transaksi`)*  
Kolom standar + PaguReguler, PaguABT, RealisasiSP2D_Minggu, RealisasiAkrual_Minggu, RealisasiSP2D_Reguler_Minggu, RealisasiSP2D_ABT_Minggu, RealisasiAkrual_Reguler_Minggu, RealisasiAkrual_ABT_Minggu, CatatanRevisiPagu.

### `TX_Paket_Progres`
*(Dikelola di spreadsheet `Nautika_TU`)*  
Kolom standar + PaketID, TahapPekerjaan, NilaiKontrak, RekananPenyedia, NomorKontrak, ProgresFisikPct, RealisasiKeuangan, KendalaKeterangan, EvidenceUrl.

---

## Nautika_Transaksi (Operasional Armada Teknis)

### `TX_TataUsaha`
Kolom standar +
| Kolom | Tipe |
|---|---|
| PaguReguler | number |
| PaguABT | number |
| RealisasiSP2D_Minggu | number (legacy/gabungan) |
| RealisasiAkrual_Minggu | number (legacy/gabungan) |
| RealisasiSP2D_Reguler_Minggu | number |
| RealisasiSP2D_ABT_Minggu | number |
| RealisasiAkrual_Reguler_Minggu | number |
| RealisasiAkrual_ABT_Minggu | number |
| CatatanRevisiPagu | text, nullable (wajib diisi jika Pagu berubah dari versi sebelumnya) |

*Dihitung sistem (bukan kolom disimpan, dihitung on-read):* PaguTotal, Realisasi Akumulatif SP2D/Akrual per Sumber Dana (Reguler & ABT), Sisa SP2D/Akrual, %SP2D Reguler/ABT, %Serapan Konsolidasi Nasional.

### `TX_Paket_Progres`
Progres pelaksanaan paket pekerjaan berkala.
Kolom standar +
| Kolom | Tipe |
|---|---|
| PaketID | ref(Master_Paket) |
| TahapPekerjaan | enum(`PERSIAPAN`, `PEMILIHAN`, `KONTRAK`, `PELAKSANAAN`, `BAST`, `SELESAI`) |
| NilaiKontrak | number |
| RekananPenyedia | text |
| NomorKontrak | text, nullable |
| ProgresFisikPct | number (0-100) |
| RealisasiKeuangan | number |
| KendalaKeterangan | text, nullable |
| EvidenceUrl | text, nullable |

**`revisiPagu` (output KPI, on-read, tanpa kolom baru)** — berapa kali Pagu sudah direvisi, tampil di bawah baris Pagu pada form TU dan modal revisi.
Definisi: jumlah transisi nilai `(PaguReguler, PaguABT)` pada baris `ACTIVE` yang berbeda dari baris `ACTIVE` sebelumnya, dibaca kronologis. Baris pertama = pagu awal, bukan revisi.
Menghitung seluruh riwayat, bukan hanya rantai `SupersedesRowID` satu periode, karena Pagu diwarisi lintas minggu sehingga revisi bisa terjadi di periode mana pun.
Dihitung dari perubahan **nilai**, bukan dari `CatatanRevisiPagu` yang terisi: `tataUsaha_revisi` mewajibkan alasan revisi tetapi tidak memaksa Catatan Revisi Pagu walau Pagu berubah (lihat `CatatanRevisiPagu` di atas), jadi menghitung dari kolom catatan akan understated.
Implementasi: `_tuHitungRevisiPagu()` di `services/TataUsahaService.js`, dipakai `tataUsaha_getKPI()`.

### `TX_OperasiLaut`
Kolom standar +
| Kolom | Tipe |
|---|---|
| WPPCode | ref(WPP) |
| KapalID | ref(Kapal), nullable di skema — **wajib diisi saat submit/revisi baru** (Fase 14 Item 6). Baris lama yang kosong tetap valid & terbaca, dan menjadi jalur pengisiannya lewat revisi. |
| KII_Ditangkap | number — **dihitung sistem** (count item `ItemType=KII` di `TX_OperasiLaut_Detail`). Nilai manual baris lama tanpa detail tetap valid. |
| KIA_Ditangkap | number — **dihitung sistem** (count item `ItemType=KIA` di `TX_OperasiLaut_Detail`). Nilai manual baris lama tanpa detail tetap valid. |
| AsalNegaraAsing | text, nullable — **dihitung sistem** saat submit/revisi: gabungan unik `AsalNegara` item KIA (dipisah koma) |
| ValuasiIllegalFishing | number |
| RumponDitertibkan | number — **dihitung sistem** (count item `ItemType=RUMPON` di `TX_OperasiLaut_Detail`). Nilai manual baris lama tanpa detail tetap valid. |
| ValuasiRumpon | number |
| HasilRiksa_Kategori | enum dari `Opsi` grup `OPS_RIKSA_KATEGORI` |
| HasilRiksa_KII | number |
| HasilRiksa_KIA | number |
| HasilRiksa_ObjekSDK | number |
| HariOperasi_Kategori | enum dari `Opsi` grup `OPS_HARI_KATEGORI` |
| HariOperasi_Jumlah | number |
| HariOperasi_Target | number |

### `TX_OperasiLaut_Detail`
Rincian per-item Operasi Laut: kapal ditangkap (KII/KIA) dan rumpon ditertibkan.
Relasi: `ParentRowID` → `TX_OperasiLaut.RowID` (subordinat; ikut SUPERSEDED/VOID saat header direvisi/dianulir).
Kolom standar +
| Kolom | Tipe |
|---|---|
| ParentRowID | ref(TX_OperasiLaut.RowID), wajib |
| ItemType | enum(KII, KIA, RUMPON), wajib |
| NamaItem | text, wajib (kapal: nama kapal; rumpon: identitas/deskripsi rumpon) |
| AsalNegara | text, nullable (wajib jika ItemType=KIA pada Operasi Laut) |
| WPPCode | ref(WPP), nullable (wajib jika ItemType=RUMPON — lokasi WPP ditertibkan, lihat PRD §5.3) |
| Lokasi | text, nullable (opsional — koordinat/deskripsi lokasi, khusus RUMPON) |

### `TX_OperasiLaut_Tangkapan`
Pencatatan spesifik per kapal tangkapan (mendukung smart bulk import Excel).
Kolom standar +
| Kolom | Tipe |
|---|---|
| TanggalTangkapan | date |
| KapalPenangkapID | ref(Kapal) |
| NamaKapalIlegal | text |
| KebangsaanBendera | text |
| TonaseGT | number |
| Latitude | number |
| Longitude | number |
| MuatanIkanKg | number |
| JenisPelanggaran | text |
| EstimasiValuasi | number |
| PangkalanAdhoc | text |
| StatusKasus | enum(`PROSES_PEMERIKSAAN`, `PENYIDIKAN`, `P21`, `INKRACHT`) |

### `TX_Kapal_Posisi`
Snapshot telemetri posisi terakhir kapal untuk peta taktis.
Kolom standar +
| Kolom | Tipe |
|---|---|
| KapalID | ref(Kapal) |
| TanggalUpdate | date |
| Latitude | number |
| Longitude | number |
| StatusKondisi | enum(`OPERASIONAL`, `SIAP_OPS`, `TIDAK_SIAP`) |
| WPPCode | ref(WPP), nullable |
| LokasiPelabuhan | text, nullable |
| HariOperasiYTD | number |

### `TX_OperasiUdara`
Kolom standar +
| Kolom | Tipe |
|---|---|
| WPPCode | ref(WPP) |
| KapalID | ref(Kapal), nullable di skema — **wajib diisi saat submit/revisi baru** (Fase 14 Item 6). Baris lama yang kosong tetap valid & terbaca, dan menjadi jalur pengisiannya lewat revisi. |
| KII | number — **dihitung sistem** (count item `ItemType=KII` di `TX_OperasiUdara_Detail`). Nilai manual baris lama tanpa detail tetap valid. |
| KIA | number — **dihitung sistem** (count item `ItemType=KIA` di `TX_OperasiUdara_Detail`). Nilai manual baris lama tanpa detail tetap valid. |
| ObjekSDK | number — **dihitung sistem** (count item `ItemType=OBJEK_SDK` di `TX_OperasiUdara_Detail`). Nilai manual baris lama tanpa detail tetap valid. |
| RumponLokalTeridentifikasi | number |
| CakupanWilayah_NM2 | number — sumber metrik "Cakupan" di peta Ikhtisar (PRD §8.3). Kolom ini hanya ada di sheet **ini**, bukan di `TX_Pemantauan`. |
| HariOperasi_Jumlah | number |
| HariOperasi_Target | number (default 180) |

### `TX_OperasiUdara_Detail`
Rincian per-item pemantauan udara (PRD §5.4: kapal perikanan KII/KIA dan objek SDK).
Relasi: `ParentRowID` → `TX_OperasiUdara.RowID` (subordinat; ikut SUPERSEDED/VOID).
Kolom standar +
| Kolom | Tipe |
|---|---|
| ParentRowID | ref(TX_OperasiUdara.RowID), wajib |
| ItemType | enum(KII, KIA, OBJEK_SDK), wajib |
| NamaItem | text, wajib (nama kapal / deskripsi objek SDK) |
| AsalNegara | text, nullable (opsional untuk pemantauan udara) |

### `TX_Intelijen`
Kolom standar +
| Kolom | Tipe |
|---|---|
| Jenis | enum(DREDGING, PELANGGARAN_PERIZINAN, PELANGGARAN_TRANSMITTER, NOTA_DINAS, KAWASAN_KONSERVASI, KAPAL_PENGANGKUT_IKAN_HIDUP) |
| Jumlah | number — untuk Jenis non-kawasan: **dihitung sistem** (count detail di `TX_Intelijen_Detail`). Jenis `KAWASAN_KONSERVASI` dan baris lama tanpa detail: nilai manual tetap valid. |
| KawasanID | ref(Kawasan_Konservasi), nullable (terisi hanya jika Jenis = KAWASAN_KONSERVASI) |
| Keterangan | text, nullable |

### `TX_Intelijen_Detail`
Rincian per-kejadian untuk kategori intelijen non-kawasan (PRD §5.5). Setiap Artikel
`TX_Intelijen` Jenis=non-kawasan punya N baris detail; `Jumlah` di header ikut derive.
Relasi: `ParentRowID` → `TX_Intelijen.RowID` (subordinat; ikut SUPERSEDED/VOID).
Kolom standar +
| Kolom | Tipe |
|---|---|
| ParentRowID | ref(TX_Intelijen.RowID), wajib |
| Deskripsi | text, wajib (deskripsi kejadian/sumber temuan) |

### `TX_Pemantauan`
Kolom standar +
| Kolom | Tipe |
|---|---|
| Jenis | enum(PERSETUJUAN_PENYEDIA, USERNAME, SKAT, PEMASANGAN_MIGRASI, MARABAHAYA) |
| Jumlah | number, nullable (untuk jenis kuantitatif) |
| NamaPenyedia | text, nullable (untuk PERSETUJUAN_PENYEDIA) |
| KapalID | ref(Kapal), nullable (legacy — sebelum revisi kapal eksternal 29 Sep 2026) |
| NamaKapal | text, nullable (untuk MARABAHAYA — kapal EKSTERNAL, bukan ref Master Data) |
| JenisKapal | enum(KAPAL_PERIKANAN, KAPAL_NIAGA, KAPAL_PENUMPANG, KAPAL_WISATA, LAINNYA), nullable (untuk MARABAHAYA) |
| KondisiDarurat | text, nullable (untuk MARABAHAYA) |
| StatusPenanganan | enum(DALAM_PENANGANAN, SELESAI), nullable |

> **Tidak ada `WPPCode` di `TX_Pemantauan` — dan itu disengaja.** Sheet ini menyimpan proses pelaporan (persetujuan, username, SKAT, migrasi, marabahaya), bukan hasil pengamatan lapangan per wilayah, jadi tidak ada dimensi geografinya. Konsekuensi yang sudah disepakati: **Pemantauan tidak muncul di peta Ikhtisar** (PRD §8.3) — peta itu diagregasi hanya dari `TX_OperasiLaut` + `TX_OperasiUdara`, dua sheet yang satu-satunya punya `WPPCode`. Pemantauan tetap masuk Ikhtisar lewat kartu divisi.
>
> Kalau suatu saat modul Pemantauan perlu dipetakan, itu **perubahan skema** (tambah kolom `WPPCode ref(WPP)` + isi dropdown WPP di form), bukan penyesuaian tampilan — lihat `AGENTS.md` §4. Jangan tambahkan kolom itu tanpa persetujuan user.

### `TX_Perawatan_Kesiapan`
Kolom standar +
| Kolom | Tipe |
|---|---|
| KapalID | ref(Kapal) |
| StatusSiap | bool |
| Penyebab | text, nullable (wajib jika StatusSiap=false) |

### `TX_Perawatan_Docking`
Kolom standar +
| Kolom | Tipe |
|---|---|
| KapalID | ref(Kapal) |
| Lokasi | enum dari `Opsi` grup `RAWAT_LOKASI` |
| Tahap | enum dari `Opsi` grup `RAWAT_TAHAP` |
| NilaiKontrak | number, nullable |
| Kontraktor | text, nullable |

### `TX_Perawatan_Item`
Kolom standar +
| Kolom | Tipe |
|---|---|
| DockingRowID | ref(TX_Perawatan_Docking), nullable (jika terkait 1 kapal docking spesifik) |
| NamaPekerjaan | text |
| Kategori | enum dari `Opsi` grup `RAWAT_KATEGORI` |
| Nilai | number |

### `TX_Logistik_Amunisi`
Kolom standar +
| Kolom | Tipe |
|---|---|
| KapalID | ref(Kapal), nullable (opsional — agregasi Profil Kapal lintas-divisi; baris lama tanpa nilai tetap valid) |
| JenisAmunisi | opsi(`Opsi` Kode=AMUNISI) — token awal di-seed `Setup.js` (lihat `OPSI_SEED`) |
| StokAwal | number (diisi sekali per siklus, biasanya awal tahun/saat inisialisasi) |
| Penggunaan_Minggu | number |

*Dihitung sistem:* StokAkhir = StokAwal − Σ Penggunaan_Minggu (ACTIVE, periode berjalan s.d saat ini).
*Pemodelan (Fase 10):* `StokAwal` tidak diulang di tiap baris penggunaan — tersimpan sebagai **baris baseline tersendiri** di sheet yang sama (1 baris ACTIVE per `JenisAmunisi` per tahun; `StokAwal` terisi, `Penggunaan_Minggu` = 0). Mode BASELINE/PENGGUNAAN **tidak disimpan sebagai kolom**, terdeteksi dari terisi/tidaknya `StokAwal`. Perubahan baseline = Revisi (supersede). Duplikasi dicek per (jenis, tahun) untuk baseline dan per (jenis, periode) untuk penggunaan.
*Peringatan non-blocking:* stok akhir negatif → `data.warnings` (PRD §5.8).

### `TX_Logistik_BBM`
Kolom standar +
| Kolom | Tipe |
|---|---|
| KapalID | ref(Kapal), nullable (opsional — agregasi Profil Kapal lintas-divisi; baris lama tanpa nilai tetap valid) |
| Jenis | opsi(`Opsi` Kode=BBM) — token awal di-seed `Setup.js` (lihat `OPSI_SEED`) |
| Pagu | number |
| Realisasi_Minggu | number |
| HargaAcuan | number |
| Tunggakan_Status | text, nullable |

*Pemodelan (Fase 10):* sama dengan Amunisi — `Pagu` disimpan sebagai **baris baseline** (1 baris ACTIVE per `Jenis` per tahun; `Realisasi_Minggu` = 0), realisasi mingguan sebagai baris terpisah. Sisa = Pagu − Σ Realisasi; % = realisasi/pagu; keduanya dihitung sistem. Realisasi > Pagu → `data.warnings` (non-blocking).

### `TX_Logistik_Personil` (sheet terpisah — keputusan Fase 1)
Dipisah dari `TX_Logistik_BBM` karena struktur kolomnya berbeda total. Lihat CHANGELOG.md Fase 1 untuk alasan lengkap.

Kolom standar +
| Kolom | Tipe |
|---|---|
| Komponen | opsi(`Opsi` Kode=KOM_PERSONIL) — token awal di-seed `Setup.js` (lihat `OPSI_SEED`) |
| Nilai_Minggu | number |

### `TX_Pengawakan_AKN`
Kolom standar +
| Kolom | Tipe |
|---|---|
| Scope | enum dari `Opsi` grup `AWAK_SCOPE` |
| Kategori | opsi(`Opsi` Kode=AWAK_KATEGORI) — token awal di-seed `Setup.js` (lihat `OPSI_SEED`) |
| Jumlah | number |

*Pemodelan (Fase 10):* `Jumlah` = **snapshot total** (bukan delta/penambahan). Komposisi komposisi = baris ACTIVE terbaru per (Scope, Kategori) pada tahun referensi filter; tren bulanan memakai **carry-forward** nilai terakhir. Duplikasi dicek per (scope, kategori, periode).

### `TX_Pengawakan_Kegiatan`
Kolom standar +
| Kolom | Tipe |
|---|---|
| JudulKegiatan | text |
| TanggalMulai | date |
| TanggalSelesai | date |
| Wilayah | text, nullable |
| JumlahPeserta | number, nullable |
| Deskripsi | text |

### `TX_KegiatanDirektorat`
Kolom standar (DivisiID tidak dipakai untuk scope-restrict, tapi tetap diisi = divisi pengunggah untuk info) +
| Kolom | Tipe |
|---|---|
| JudulKegiatan | text |
| Tanggal | date |
| Deskripsi | text |
| PihakHadir | text, nullable |

### `TX_Evidence`
| Kolom | Tipe |
|---|---|
| EvidenceID | text (PK) |
| RefSheet | text (nama sheet asal, mis. `TX_Perawatan_Item`) |
| RefRowID | text (RowID baris asal) |
| DriveFileID | text |
| FileName | text |
| FileType | text |
| SourceMode | enum(UPLOAD, DRIVE_LINK_COPY) |
| UploadedBy | ref(Users) |
| UploadedAt | date |

---

## Nautika_Log

### `Approval_Queue`
| Kolom | Tipe |
|---|---|
| QueueID | text (PK) |
| UserID | ref(Users) |
| RoleDilamar | enum(KADIV, STAF) |
| DivisiID | ref(Divisi) |
| RoutedTo | enum(SUPERADMIN, KADIV) |
| Status | enum(PENDING, APPROVED, REJECTED) |
| DecidedBy | ref(Users), nullable |
| DecidedAt | date, nullable |
| AlasanReject | text, nullable |

### `Audit_Log`
| Kolom | Tipe |
|---|---|
| LogID | text (PK) |
| UserID | ref(Users) |
| Aksi | enum(CREATE, UPDATE, VOID, APPROVE, REJECT, LOGIN) |
| SheetTarget | text |
| RowIDTarget | text |
| Alasan | text, nullable |
| Timestamp | date |

### `Notifications`
| Kolom | Tipe |
|---|---|
| NotifID | text (PK) |
| UserID | ref(Users) — penerima |
| Jenis | enum(APPROVAL_REQUEST, DATA_VOIDED, REMINDER_MINGGUAN) |
| Pesan | text |
| IsRead | bool |
| CreatedAt | date |

---

## Nautika_Reporting_Looker (Data Mart Reporting)

Spreadsheet pelaporan khusus yang diperbarui secara periodik (ETL trigger) untuk konsumsi Looker Studio, bebas dari baris `SUPERSEDED` dan `VOID`.

### `Mart_Ikhtisar_Nasional`
| Kolom | Tipe |
|---|---|
| Periode | text (YYYY-MM-WW) |
| BulanTahun | text (YYYY-MM) |
| TotalPagu_Reguler | number |
| TotalPagu_ABT | number |
| TotalRealisasi_SP2D_Reguler | number |
| TotalRealisasi_SP2D_ABT | number |
| PctSerapan_Nasional | number |
| TotalHariLayar_Nasional | number |
| TotalTangkapan_KIA | number |
| TotalTangkapan_KII | number |
| TotalRumpon_Ditertibkan | number |
| TotalValuasi_Penyelamatan | number |
| Armada_Siap_Pct | number |

### `Mart_Kinerja_Armada_34Kapal`
| Kolom | Tipe |
|---|---|
| Triwulan | text (YYYY-TW1..4) |
| KapalID | text |
| NamaKapal | text |
| KelasKapal | text |
| PangkalanHomebase | text |
| WPP_Penugasan | text |
| HariOperasi_Aktual | number |
| Target_HariOperasi | number |
| Jumlah_KIA_Ditangkap | number |
| Jumlah_KII_Ditindak | number |
| Jumlah_Rumpon_Tertib | number |
| Volume_Riksa_Kapal | number |
| Total_Valuasi_MiliarRp | number |
| Skor_Akhir_TW | number |
| Peringkat_TW | number |
