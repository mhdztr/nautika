/**
 * Setup.js
 * Skrip inisialisasi database Nautika.
 *
 * CARA PAKAI:
 *   1. Push kode ke GAS via clasp: `clasp push`
 *   2. Di GAS editor, jalankan fungsi `setup()` SATU KALI.
 *   3. Jalankan `debug_forceAuthEmail()` SATU KALI untuk mengizinkan MailApp
 *      (scope script.send_mail) — wajib sebelum OTP/reminder bisa terkirim.
 *   4. Lihat log eksekusi — akan tercetak ID ketiga spreadsheet yang dibuat.
 *   5. Spreadsheet IDs disimpan otomatis ke Script Properties.
 *      Skrip-skrip lain membacanya via getSpreadsheetIds() di Constants.js.
 *
 * RESET: Jalankan setupForce() untuk hapus flag dan jalankan ulang dari nol.
 *        HATI-HATI: ini AKAN membuat spreadsheet baru dan menimpa ID yang tersimpan.
 *
 * Tidak ada UI yang dibangun di fase ini — fokus database saja (Fase 1 PRD).
 */

/**
 * FUNGSI BANTUAN UNTUK MEMANCING POP-UP IZIN (AUTHORIZATION)
 * Jalankan fungsi ini dari Google Apps Script Editor untuk mengizinkan pembuatan trigger.
 */
function debug_forceAuthTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log("Jumlah trigger saat ini: " + triggers.length);
  Logger.log("Izin trigger berhasil diberikan!");
}

/**
 * FUNGSI BANTUAN UNTUK MEMANCING POP-UP IZIN (AUTHORIZATION)
 *
 * Jalankan SATU KALI dari Google Apps Script Editor (dropdown → Run).
 * Fungsi ini meminta seluruh scope yang ada di manifest appsscript.json —
 * termasuk script.send_mail yang dipakai OTP registrasi dan reminder mingguan.
 * Setelah diotorisasi, grant berlaku untuk seluruh project dan tidak perlu
 * diulang per pengguna.
 *
 * Mengapa harus manual:
 *   - Web app di-deploy `ANYONE_ANONYMOUS` (lihat appsscript.json), jadi
 *     pemanggilnya anonim dan tidak punya akun Google yang bisa ditanya —
 *     consent screen tidak akan pernah muncul dari sisi web app.
 *   - Otorisasi hanya bisa dipancing dari IDE, yang mendukung granular consent.
 *   - Fungsi berparameter (mis. auth_requestOtp) tidak bisa dijalankan lewat
 *     tombol Run, sehingga fungsi noll-argument inilah satu-satunya jalurnya.
 *
 * SYARAT: `clasp push` sudah dijalankan lebih dulu (scope harus ada di manifest).
 *
 * CATATAN: `ScriptApp.requireAllScopes` akan MENGHENTIKAN eksekusi ini saat
 * consent belum diberikan — itu normal, itu memang cara Google menampilkan
 * halaman persetujuan. Setelah Anda menyetujuinya, Run sekali lagi: eksekusi
 * lanjut ke pengiriman email uji sebagai bukti mail benar-benar berfungsi.
 */
function debug_forceAuthEmail() {
  var to = Session.getActiveUser().getEmail();
  if (!to) to = Session.getEffectiveUser().getEmail();
  Logger.log('[debug_forceAuthEmail] Akun pengirim: ' + to);

  try {
    if (typeof ScriptApp.requireAllScopes === 'function') {
      // Berhenti di sini + tampilkan halaman izin bila ada scope yang belum
      // diotorisasi. Bila semua sudah di-grant, baris ini langsung lolos.
      ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
      Logger.log('[debug_forceAuthEmail] Semua scope manifest sudah diotorisasi.');
    } else {
      Logger.log('[debug_forceAuthEmail] requireAllScopes tidak tersedia di runtime ini — mengandalkan MailApp.');
    }
  } catch (e) {
    Logger.log('[debug_forceAuthEmail] requireAllScopes gagal: ' + e.message);
    return;
  }

  try {
    MailApp.sendEmail({
      to: to,
      subject: 'Nautika — uji otorisasi email',
      body: 'Email ini bukti bahwa script.send_mail sudah diotorisasi.\n' +
        'Waktu: ' + new Date().toISOString()
    });
    Logger.log('[debug_forceAuthEmail] Otorisasi OK — email uji terkirim ke ' + to);
  } catch (e) {
    Logger.log('[debug_forceAuthEmail] Gagal: ' + e.message);
  }
}

function debug_forceAuthSemua() {
  // 1. Memancing pop-up izin Trigger
  var triggers = ScriptApp.getProjectTriggers();

  // 2. Memancing pop-up izin Email (send_mail)
  // Kita cukup memanggil getRemainingDailyQuota() agar tidak perlu mengirim email sungguhan
  var sisaQuota = MailApp.getRemainingDailyQuota();

  Logger.log("Jumlah trigger: " + triggers.length);
  Logger.log("Sisa kuota email harian: " + sisaQuota);
  Logger.log("SEMUA IZIN BERHASIL DIBERIKAN!");
}


// ===========================================================================
// ENTRY POINT UTAMA
// ===========================================================================

/**
 * Jalankan fungsi ini SATU KALI untuk inisialisasi seluruh database Nautika.
 */
function setup() {
  var props = PropertiesService.getScriptProperties();

  if (props.getProperty(PROP_KEY.SETUP_COMPLETED) === 'true') {
    Logger.log(
      '[Setup] Setup sudah selesai sebelumnya. ' +
      'Gunakan setupForce() jika ingin menjalankan ulang (akan membuat spreadsheet baru).'
    );
    Logger.log('[Setup] ID saat ini:');
    Logger.log('  MASTER_SS_ID    : ' + props.getProperty(PROP_KEY.MASTER_SS_ID));
    Logger.log('  TRANSAKSI_SS_ID : ' + props.getProperty(PROP_KEY.TRANSAKSI_SS_ID));
    Logger.log('  LOG_SS_ID       : ' + props.getProperty(PROP_KEY.LOG_SS_ID));
    return;
  }

  Logger.log('=== NAUTIKA SETUP MULAI ===');

  var masterSS = _setupMaster(props);
  var transaksiSS = _setupTransaksi(props);
  var logSS = _setupLog(props);

  _seedDivisi(masterSS);
  _seedSuperadmin(masterSS);
  _seedOpsi(masterSS);

  props.setProperty(PROP_KEY.SETUP_COMPLETED, 'true');

  Logger.log('');
  Logger.log('=== NAUTIKA SETUP SELESAI ===');
  Logger.log('ID Spreadsheet (tersimpan di Script Properties):');
  Logger.log('  MASTER_SS_ID    : ' + props.getProperty(PROP_KEY.MASTER_SS_ID));
  Logger.log('  TRANSAKSI_SS_ID : ' + props.getProperty(PROP_KEY.TRANSAKSI_SS_ID));
  Logger.log('  LOG_SS_ID       : ' + props.getProperty(PROP_KEY.LOG_SS_ID));
  Logger.log('');
  Logger.log('Langkah selanjutnya:');
  Logger.log('  - Buka ketiga spreadsheet di Google Drive untuk verifikasi struktur sheet.');
  Logger.log('  - Login pertama: email=superadmin@nautika.id (password seed tercetak di log di atas, wajib diganti).');
  Logger.log('  - Set CARTO API key: panggil setupSetCartoKey("<key>") di editor GAS (lihat ARCHITECTURE §9).');
}

/**
 * Jalankan untuk reset total — membuat spreadsheet BARU dan menimpa ID lama.
 * HATI-HATI: data di spreadsheet lama tidak dihapus otomatis, hanya ID-nya yang diperbarui.
 */
function setupForce() {
  var props = PropertiesService.getScriptProperties();
  props.deleteAllProperties();
  Logger.log('[setupForce] Semua Script Properties dihapus. Menjalankan setup ulang...');
  setup();
}

// ===========================================================================
// INISIALISASI SPREADSHEET MASTER
// ===========================================================================

function _setupMaster(props) {
  Logger.log('[Setup] Membuat Nautika_Master...');
  var ss = SpreadsheetApp.create(SS_NAME.MASTER);
  props.setProperty(PROP_KEY.MASTER_SS_ID, ss.getId());

  // Hapus sheet default "Sheet1" setelah semua sheet lain dibuat
  var defaultSheet = ss.getSheets()[0];

  _createSheetWithHeaders(ss, SHEET_MASTER.KAPAL, [
    'KapalID', 'Nama', 'Kelas', 'Homebase_UPT', 'StatusAktif', 'JenisKapal'
  ]);

  _createSheetWithHeaders(ss, SHEET_MASTER.KAWASAN_KONSERVASI, [
    'KawasanID', 'Nama', 'Provinsi', 'Latitude', 'Longitude'
  ]);

  _createSheetWithHeaders(ss, SHEET_MASTER.WPP, [
    'WPPCode', 'NamaWilayah'
  ]);

  _createSheetWithHeaders(ss, SHEET_MASTER.DIVISI, [
    'DivisiID', 'NamaResmi', 'NamaDashboard', 'Kode'
  ]);

  _createSheetWithHeaders(ss, SHEET_MASTER.USERS, [
    'UserID', 'Nama', 'Email', 'NIP', 'PasswordHash',
    'DivisiID', 'Role', 'Status',
    'ApprovedBy', 'RegisteredAt', 'ApprovedAt'
  ]);

  _createSheetWithHeaders(ss, SHEET_MASTER.OPSI, [
    'Kode', 'Urutan', 'Label', 'LabelTampil', 'Aktif', 'DibuatOleh', 'DibuatAt'
  ]);

  // Hapus sheet default bawaan GAS
  ss.deleteSheet(defaultSheet);

  Logger.log('[Setup] Nautika_Master selesai: ' + ss.getUrl());
  return ss;
}

// ===========================================================================
// INISIALISASI SPREADSHEET TRANSAKSI
// ===========================================================================

function _setupTransaksi(props) {
  Logger.log('[Setup] Membuat Nautika_Transaksi...');
  var ss = SpreadsheetApp.create(SS_NAME.TRANSAKSI);
  props.setProperty(PROP_KEY.TRANSAKSI_SS_ID, ss.getId());

  var defaultSheet = ss.getSheets()[0];

  // TX_TataUsaha
  _createSheetWithHeaders(ss, SHEET_TX.TATA_USAHA,
    STD_COLS.concat([
      'PaguReguler', 'PaguABT',
      'RealisasiSP2D_Minggu', 'RealisasiAkrual_Minggu',
      'CatatanRevisiPagu'
    ])
  );

  // TX_OperasiLaut
  _createSheetWithHeaders(ss, SHEET_TX.OPERASI_LAUT,
    STD_COLS.concat([
      'WPPCode', 'KapalID',
      'KII_Ditangkap', 'KIA_Ditangkap', 'AsalNegaraAsing',
      'ValuasiIllegalFishing',
      'RumponDitertibkan', 'ValuasiRumpon',
      'HasilRiksa_Kategori', 'HasilRiksa_KII', 'HasilRiksa_KIA', 'HasilRiksa_ObjekSDK',
      'HariOperasi_Kategori', 'HariOperasi_Jumlah', 'HariOperasi_Target'
    ])
  );

  // TX_OperasiLaut_Detail — rincian per-item (kapal ditangkap & rumpon ditertibkan).
  // ParentRowID merujuk TX_OperasiLaut.RowID; ItemType enum(KII|KIA|RUMPON).
  _createSheetWithHeaders(ss, SHEET_TX.OPERASI_LAUT_DETAIL,
    STD_COLS.concat([
      'ParentRowID', 'ItemType', 'NamaItem', 'AsalNegara', 'WPPCode', 'Lokasi'
    ])
  );

  // TX_OperasiUdara
  _createSheetWithHeaders(ss, SHEET_TX.OPERASI_UDARA,
    STD_COLS.concat([
      'WPPCode', 'KapalID',
      'KII', 'KIA', 'ObjekSDK',
      'RumponLokalTeridentifikasi',
      'CakupanWilayah_NM2',
      'HariOperasi_Jumlah', 'HariOperasi_Target'
    ])
  );

  // TX_OperasiUdara_Detail — rincian per-item pemantauan udara.
  // ParentRowID merujuk TX_OperasiUdara.RowID; ItemType enum(KII|KIA|OBJEK_SDK).
  _createSheetWithHeaders(ss, SHEET_TX.OPERASI_UDARA_DETAIL,
    STD_COLS.concat([
      'ParentRowID', 'ItemType', 'NamaItem', 'AsalNegara'
    ])
  );

  // TX_Intelijen
  _createSheetWithHeaders(ss, SHEET_TX.INTELIJEN,
    STD_COLS.concat([
      'Jenis', 'Jumlah', 'KawasanID', 'Keterangan'
    ])
  );

  // TX_Intelijen_Detail — rincian per-kejadian untuk kategori non-kawasan.
  // ParentRowID merujuk TX_Intelijen.RowID (1 baris Intelijen = 1 kategori).
  _createSheetWithHeaders(ss, SHEET_TX.INTELIJEN_DETAIL,
    STD_COLS.concat([
      'ParentRowID', 'Deskripsi'
    ])
  );

  // TX_Pemantauan
  _createSheetWithHeaders(ss, SHEET_TX.PEMANTAUAN,
    STD_COLS.concat([
      'Jenis', 'Jumlah',
      'NamaPenyedia',
      'KapalID', 'NamaKapal', 'JenisKapal', 'KondisiDarurat', 'StatusPenanganan'
    ])
  );

  // TX_Perawatan_Kesiapan
  _createSheetWithHeaders(ss, SHEET_TX.PERAWATAN_KESIAPAN,
    STD_COLS.concat([
      'KapalID', 'StatusSiap', 'Penyebab'
    ])
  );

  // TX_Perawatan_Docking
  _createSheetWithHeaders(ss, SHEET_TX.PERAWATAN_DOCKING,
    STD_COLS.concat([
      'KapalID', 'Lokasi', 'Tahap', 'NilaiKontrak', 'Kontraktor'
    ])
  );

  // TX_Perawatan_Item
  _createSheetWithHeaders(ss, SHEET_TX.PERAWATAN_ITEM,
    STD_COLS.concat([
      'DockingRowID', 'NamaPekerjaan', 'Kategori', 'Nilai'
    ])
  );

  // TX_Logistik_Amunisi
  _createSheetWithHeaders(ss, SHEET_TX.LOGISTIK_AMUNISI,
    STD_COLS.concat([
      'KapalID', 'JenisAmunisi', 'StokAwal', 'Penggunaan_Minggu'
    ])
  );

  // TX_Logistik_BBM
  _createSheetWithHeaders(ss, SHEET_TX.LOGISTIK_BBM,
    STD_COLS.concat([
      'KapalID', 'Jenis', 'Pagu', 'Realisasi_Minggu', 'HargaAcuan', 'Tunggakan_Status'
    ])
  );

  // TX_Logistik_Personil — sheet terpisah (lihat CHANGELOG.md Fase 1 untuk alasan)
  _createSheetWithHeaders(ss, SHEET_TX.LOGISTIK_PERSONIL,
    STD_COLS.concat([
      'Komponen', 'Nilai_Minggu'
    ])
  );

  // TX_Pengawakan_AKN
  _createSheetWithHeaders(ss, SHEET_TX.PENGAWAKAN_AKN,
    STD_COLS.concat([
      'Scope', 'Kategori', 'Jumlah'
    ])
  );

  // TX_Pengawakan_Kegiatan
  _createSheetWithHeaders(ss, SHEET_TX.PENGAWAKAN_KEGIATAN,
    STD_COLS.concat([
      'JudulKegiatan', 'TanggalMulai', 'TanggalSelesai',
      'Wilayah', 'JumlahPeserta', 'Deskripsi'
    ])
  );

  // TX_KegiatanDirektorat
  _createSheetWithHeaders(ss, SHEET_TX.KEGIATAN_DIREKTORAT,
    STD_COLS.concat([
      'JudulKegiatan', 'Tanggal', 'Deskripsi', 'PihakHadir'
    ])
  );

  // TX_Evidence — tidak pakai STD_COLS, punya skema sendiri
  _createSheetWithHeaders(ss, SHEET_TX.EVIDENCE, [
    'EvidenceID', 'RefSheet', 'RefRowID',
    'DriveFileID', 'FileName', 'FileType',
    'SourceMode', 'UploadedBy', 'UploadedAt'
  ]);

  ss.deleteSheet(defaultSheet);

  Logger.log('[Setup] Nautika_Transaksi selesai: ' + ss.getUrl());
  return ss;
}

// ===========================================================================
// INISIALISASI SPREADSHEET LOG
// ===========================================================================

function _setupLog(props) {
  Logger.log('[Setup] Membuat Nautika_Log...');
  var ss = SpreadsheetApp.create(SS_NAME.LOG);
  props.setProperty(PROP_KEY.LOG_SS_ID, ss.getId());

  var defaultSheet = ss.getSheets()[0];

  // Approval_Queue
  _createSheetWithHeaders(ss, SHEET_LOG.APPROVAL_QUEUE, [
    'QueueID', 'UserID', 'RoleDilamar', 'DivisiID',
    'RoutedTo', 'Status', 'DecidedBy', 'DecidedAt', 'AlasanReject'
  ]);

  // Audit_Log
  _createSheetWithHeaders(ss, SHEET_LOG.AUDIT_LOG, [
    'LogID', 'UserID', 'Aksi', 'SheetTarget', 'RowIDTarget', 'Alasan', 'Timestamp'
  ]);

  // Notifications
  _createSheetWithHeaders(ss, SHEET_LOG.NOTIFICATIONS, [
    'NotifID', 'UserID', 'Jenis', 'Pesan', 'IsRead', 'CreatedAt'
  ]);

  ss.deleteSheet(defaultSheet);

  Logger.log('[Setup] Nautika_Log selesai: ' + ss.getUrl());
  return ss;
}

// ===========================================================================
// SEED DATA — Divisi
// ===========================================================================

function _seedDivisi(masterSS) {
  Logger.log('[Setup] Seeding data Divisi...');
  var sheet = masterSS.getSheetByName(SHEET_MASTER.DIVISI);

  // [DivisiID, NamaResmi, NamaDashboard, Kode]
  var rows = [
    [
      DIVISI_ID.TU,
      'Suku Bagian Tata Usaha',
      'Tata Usaha',
      'TU'
    ],
    [
      DIVISI_ID.OPS,
      'Sub Direktorat Operasi Kapal Pengawasan dan Pesawat',
      'Operasi Laut & Udara',
      'OPS'
    ],
    [
      DIVISI_ID.INTEL,
      'Tim Kerja Pengelolaan Sistem Informasi Intelijen KP',
      'Intelijen',
      'INTEL'
    ],
    [
      DIVISI_ID.PANTAU,
      'Tim Kerja Pelayanan Sistem Pemantauan Kapal Perikanan',
      'Pemantauan',
      'PANTAU'
    ],
    [
      DIVISI_ID.RAWAT,
      'Tim Kerja Perawatan Armada Pengawasan',
      'Perawatan',
      'RAWAT'
    ],
    [
      DIVISI_ID.LOG,
      'Tim Kerja Penyediaan Logistik Armada Pengawasan',
      'Logistik',
      'LOG'
    ],
    [
      DIVISI_ID.AWAK,
      'Tim Kerja Pengawakan Armada Pengawasan',
      'Pengawakan',
      'AWAK'
    ]
  ];

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  Logger.log('[Setup] ' + rows.length + ' divisi berhasil di-seed.');
}

// ===========================================================================
// SEED DATA — Superadmin
// ===========================================================================

function _seedSuperadmin(masterSS) {
  Logger.log('[Setup] Seeding akun Superadmin...');
  var sheet = masterSS.getSheetByName(SHEET_MASTER.USERS);

  var now = new Date();
  var props = PropertiesService.getScriptProperties();
  var seedPassword = props.getProperty(PROP_KEY.SEED_SUPERADMIN_PASSWORD);
  var generated = false;

  if (!seedPassword) {
    seedPassword = _generateSeedPassword();
    props.setProperty(PROP_KEY.SEED_SUPERADMIN_PASSWORD, seedPassword);
    generated = true;
  }

  var passwordHash = hashPassword(seedPassword);
  var userId = 'USER-SUPERADMIN-001';

  // [UserID, Nama, Email, PasswordHash, DivisiID, Role, Status,
  //  ApprovedBy, RegisteredAt, ApprovedAt]
  var row = [[
    userId,
    'Super Administrator',
    'superadmin@nautika.id',
    passwordHash,
    '',                        // DivisiID kosong — SUPERADMIN tidak terikat divisi
    ROLE.SUPERADMIN,
    USER_STATUS.APPROVED,
    userId,                    // ApprovedBy diri sendiri (bootstrap)
    now,
    now
  ]];

  sheet.getRange(2, 1, 1, row[0].length).setValues(row);
  Logger.log('[Setup] Superadmin selesai di-seed.');
  Logger.log('[Setup] Email login: superadmin@nautika.id');
  Logger.log('[Setup] !! Password seed: ' + seedPassword + ' (WAJIB diganti setelah login pertama).');
  if (generated) {
    Logger.log('[Setup] Password di-generate otomatis dan disimpan di Script Property "' +
      PROP_KEY.SEED_SUPERADMIN_PASSWORD + '". Untuk menentukan password sendiri sebelum setup, ' +
      'set property itu lebih dulu atau panggil setupSetSuperadminPassword("<password>") lalu setupForce().');
  }
}

// ===========================================================================
// SEED DATA — Opsi (daftar pilihan dinamis) — sumber OTORITATIF enum domain
//
// Ini satu-satunya tempat nilai enum domain ditulis sebagai kode. Setelah
// sheet `Opsi` ter-seed, SELURUH aplikasi membacanya lewat getOpsiList() /
// getOpsiLabelMap() — tidak ada lagi daftar hardcoded di Constants.js atau
// di service mana pun.
//
// `label`  = token yang disimpan ke kolom enum di sheet transaksi ( immutable
//            pada kode ini; yang boleh ditambah Superadmin lewat Master Data).
// `tampil` = teks yang dilihat user. Disalin persis dari peta label yang
//            sebelumnya hardcoded di frontend — tidak ada arti domain baru
//            yang dikarang di sini.
//
// CATATAN: kelompok AMUNISI sengaja memakai `tampil` = `label` (token mentah).
// Nilai-nilai itu sebelumnya tampil apa adanya di UI dan tidak punya teks
// tampilan resmi di dokumen mana pun (mis. sufiks "HAMPA" tidak dijelaskan),
// jadi tidak ditebak. Superadmin dapat mengisinya lewat Master Data →
// kolom "Tampil sebagai".
// ===========================================================================
var OPSI_SEED = {
  AMUNISI: [
    { label: 'PISTOL_P3A', tampil: 'PISTOL_P3A' },
    { label: 'PM1_A2', tampil: 'PM1_A2' },
    { label: 'SS1V5_SS2', tampil: 'SS1V5_SS2' },
    { label: 'SM5', tampil: 'SM5' },
    { label: 'SS1V5_SS2_HAMPA', tampil: 'SS1V5_SS2_HAMPA' }
  ],
  BBM: [
    { label: 'REGULER', tampil: 'Reguler' },
    { label: 'ABT', tampil: 'ABT' }
  ],
  KOM_PERSONIL: [
    { label: 'NATURA', tampil: 'Natura' },
    { label: 'BPDT', tampil: 'BPDT' },
    { label: 'AIR_BERSIH', tampil: 'Air Bersih' },
    { label: 'DELEGASI', tampil: 'Delegasi' },
    { label: 'JAGA_SANDAR', tampil: 'Jaga Sandar' }
  ],
  AWAK_KATEGORI: [
    { label: 'PNS', tampil: 'PNS' },
    { label: 'PPPK_FUNGSIONAL', tampil: 'PPPK Fungsional' },
    { label: 'PPPK_PELAKSANA', tampil: 'PPPK Pelaksana' },
    { label: 'PPPK_PARUH_WAKTU', tampil: 'PPPK Paruh Waktu' },
    { label: 'PJLP', tampil: 'PJLP' }
  ],
  AWAK_SCOPE: [
    { label: 'KESELURUHAN', tampil: 'Keseluruhan' },
    { label: 'POA', tampil: 'POA' }
  ],
  RAWAT_LOKASI: [
    { label: 'PUSAT', tampil: 'Pusat' },
    { label: 'UPT', tampil: 'UPT' }
  ],
  RAWAT_TAHAP: [
    { label: 'PROSES_PENGADAAN', tampil: 'Proses Pengadaan' },
    { label: 'TANDATANGAN_KONTRAK', tampil: 'Tanda Tangan Kontrak' },
    { label: 'PROSES_DOCKING', tampil: 'Proses Docking' },
    { label: 'SELESAI', tampil: 'Selesai' }
  ],
  RAWAT_KATEGORI: [
    { label: 'PERENCANAAN', tampil: 'Perencanaan' },
    { label: 'PROSES_PEMBAYARAN', tampil: 'Proses Pembayaran' },
    { label: 'SELESAI', tampil: 'Selesai' }
  ],
  OPS_RIKSA_KATEGORI: [
    { label: 'PUSAT', tampil: 'Pusat' },
    { label: 'UPT', tampil: 'UPT' },
    { label: 'SPEEDBOAT', tampil: 'Speedboat' }
  ],
  OPS_HARI_KATEGORI: [
    { label: 'KAPAL_PUSAT', tampil: 'Kapal Pusat' },
    { label: 'SEMUA_KAPAL', tampil: 'Semua Kapal' },
    { label: 'SPEEDBOAT', tampil: 'Speedboat' }
  ],
  // Jenis kapal armada. Memakai token yang sama dengan `OPS_HARI_KATEGORI`
  // supaya KapalID pada laporan bisa dicocokkan dengan kategori hari operasi
  // tanpa kosakata enum baru. `SEMUA_KAPAL` sengaja TIDAK ada di sini — itu
  // kategori pelaporan (agregat semua kapal), bukan jenis sebuah kapal.
  KAPAL_JENIS: [
    { label: 'KAPAL_PUSAT', tampil: 'Kapal Pusat' },
    { label: 'SPEEDBOAT', tampil: 'Speedboat' }
  ]
};

/**
 * Seed sheet `Opsi` dari `OPSI_SEED`. Idempoten: baris yang Kode+Label-nya
 * sudah ada DILEWATI (hasil tambah/ubah user tidak tertimpa), dan baris yang
 * sudah ada tapi `LabelTampil`-nya kosong akan diisi dari seed.
 *
 * Aman dijalankan berulang — dipakai oleh `setup()` dan `setupSeedOpsi()`.
 * @param {GoogleAppsScript.Spreadsheet} masterSS
 * @returns {number} jumlah baris baru yang ditambahkan
 */
function _seedOpsi(masterSS) {
  Logger.log('[Setup] Seeding daftar Opsi...');
  var sheet = masterSS.getSheetByName(SHEET_MASTER.OPSI);
  if (!sheet) {
    Logger.log('[Setup] Sheet Opsi tidak ada — dilewati.');
    return 0;
  }
  ensureOpsiColumns(sheet); // self-heal kolom LabelTampil

  var existing = sheetToObjects(sheet);
  var seen = {};
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // Perbaiki `LabelTampil` pada baris lama. Aturannya:
  //  - token di luar seed        -> jangan disentuh sama sekali
  //  - LabelTampil sudah dikustom-> jangan ditimpa (harga_user_mahal)
  //  - LabelTampil = Label       -> ini hasil isi-otomatis `ensureOpsiColumns`,
  //                                  boleh dinaikkan ke teks seed yang lebih rapi
  var colTampil = headers.indexOf('LabelTampil') + 1;
  var fixes = [];
  existing.forEach(function (r, i) {
    var kode = String(r['Kode']);
    var label = String(r['Label']);
    seen[kode + '|' + label] = true;
    var seedTampil = _opsiSeedTampil(kode, label);
    if (!seedTampil) return;
    var tampil = String(r['LabelTampil'] || '').trim();
    if (tampil === seedTampil) return;   // sudah benar
    if (tampil && tampil !== label) return; // sudah dikustom user -> hormati
    fixes.push({ rowIndex: i + 2, col: colTampil, value: seedTampil });
  });
  fixes.forEach(function (f) {
    if (f.col > 0) sheet.getRange(f.rowIndex, f.col).setValue(f.value);
  });

  var rows = [];
  Object.keys(OPSI_SEED).forEach(function (kode) {
    OPSI_SEED[kode].forEach(function (item, i) {
      if (seen[kode + '|' + item.label]) return;
      rows.push([kode, i + 1, item.label, item.tampil, true, 'SYSTEM', new Date()]);
    });
  });

  if (rows.length > 0) {
    var start = 2 + existing.length;
    sheet.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
  }
  var total = existing.length + rows.length;
  Logger.log('[Setup] Opsi selesai di-seed (' + total + ' baris total; ' + rows.length +
    ' baris baru, ' + fixes.length + ' LabelTampil diperbaiki).');
  return rows.length;
}

/** Teks tampilan seed untuk satu token, atau '' bila token bukan milik seed. */
function _opsiSeedTampil(kode, label) {
  var list = OPSI_SEED[kode];
  if (!list) return '';
  for (var i = 0; i < list.length; i++) {
    if (list[i].label === label) return list[i].tampil;
  }
  return '';
}

/**
 * Jalankan seed Opsi SAJA, tanpa mengulang setup spreadsheet. Dipakai saat
 * kode baru menambah grup Opsi atau menambah kolom `LabelTampil` — sheet
 * yang sudah ada akan melengkapi dirinya sendiri.
 *
 * Cara pakai: jalankan fungsi ini sekali di editor Apps Script setelah
 * `clasp push`, lalu muat ulang aplikasinya.
 */
function setupSeedOpsi() {
  var masterSS = SpreadsheetApp.openById(getSpreadsheetIds().masterId);
  var added = _seedOpsi(masterSS);
  SpreadsheetApp.flush();
  clearOpsiCache();
  Logger.log('[setupSeedOpsi] Selesai. ' + added + ' baris baru ditambahkan.');
  return { ok: true, barisBaru: added };
}

/**
 * Helper untuk Superadmin menetapkan password seed superadmin SEBELUM setup()
 * dijalankan. Tidak ada password hardcoded di source.
 */
function setupSetSuperadminPassword(password) {
  if (!password || String(password).length < 8) {
    Logger.log('[Setup] Password minimal 8 karakter.');
    return;
  }
  PropertiesService.getScriptProperties()
    .setProperty(PROP_KEY.SEED_SUPERADMIN_PASSWORD, String(password));
  Logger.log('[Setup] Password seed superadmin tersimpan di Script Properties.');
}

/**
 * Helper untuk Superadmin menetapkan CARTO API key (dipakai tile basemap
 * Operasi Laut & Udara). Key tidak boleh hardcoded di source; disimpan di
 * Script Properties dan dibaca runtime oleh utils_getCartoKey() (ARCHITECTURE §9).
 */
function setupSetCartoKey(key) {
  if (!key || String(key).length < 8) {
    Logger.log('[Setup] CARTO API key tidak valid (minimal 8 karakter).');
    return;
  }
  PropertiesService.getScriptProperties()
    .setProperty(PROP_KEY.CARTO_API_KEY, String(key));
  Logger.log('[Setup] CARTO API key tersimpan di Script Properties.');
}

/**
 * Generate password acak yang aman untuk seed superadmin.
 */
function _generateSeedPassword() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  var rand = Utilities.getUuid().replace(/-/g, '');
  var out = '';
  for (var i = 0; i < 12; i++) {
    var idx = parseInt(rand.charAt(i % rand.length), 16) % chars.length;
    out += chars.charAt(idx);
  }
  return out + '@' + (parseInt(rand.slice(0, 4), 16) % 100);
}

// ===========================================================================
// HELPER INTERNAL
// ===========================================================================

/**
 * Buat sheet baru di spreadsheet dengan baris header.
 * Jika sheet sudah ada (misal dari run sebelumnya), tidak ditimpa — di-skip.
 *
 * @param {SpreadsheetApp.Spreadsheet} ss - target spreadsheet
 * @param {string} sheetName
 * @param {string[]} headers - array nama kolom
 * @returns {SpreadsheetApp.Sheet}
 */
function _createSheetWithHeaders(ss, sheetName, headers) {
  var existing = ss.getSheetByName(sheetName);
  if (existing) {
    Logger.log('[Setup] Sheet sudah ada, di-skip: ' + sheetName);
    return existing;
  }

  var sheet = ss.insertSheet(sheetName);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);

  // Format baris header: bold, background abu muda, freeze row pertama
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#E8EAF6');
  sheet.setFrozenRows(1);

  Logger.log('[Setup] Sheet dibuat: ' + sheetName + ' (' + headers.length + ' kolom)');
  return sheet;
}

// Catatan: hashPassword() didefinisikan di data/SheetAccess.js (satu implementasi kanonik).
// Setup.js dapat memanggilnya langsung karena semua file GAS berbagi satu global scope.

// ===========================================================================
// FUNGSI UTILITAS UNTUK VERIFIKASI (bisa dijalankan setelah setup)
// ===========================================================================

/**
 * Cetak ringkasan struktur database ke log — berguna untuk verifikasi manual.
 * Jalankan setelah setup() selesai.
 */
function verifySetup() {
  var ids = getSpreadsheetIds();

  Logger.log('=== VERIFIKASI DATABASE NAUTIKA ===');

  var masterSS = SpreadsheetApp.openById(ids.masterId);
  var transaksiSS = SpreadsheetApp.openById(ids.transaksiId);
  var logSS = SpreadsheetApp.openById(ids.logId);

  Logger.log('');
  Logger.log('--- Nautika_Master (' + ids.masterId + ') ---');
  _printSheetSummary(masterSS);

  Logger.log('');
  Logger.log('--- Nautika_Transaksi (' + ids.transaksiId + ') ---');
  _printSheetSummary(transaksiSS);

  Logger.log('');
  Logger.log('--- Nautika_Log (' + ids.logId + ') ---');
  _printSheetSummary(logSS);

  Logger.log('');
  Logger.log('--- Verifikasi Seed Data ---');
  var divisiSheet = masterSS.getSheetByName(SHEET_MASTER.DIVISI);
  var lastRow = divisiSheet.getLastRow();
  Logger.log('Jumlah divisi ter-seed: ' + (lastRow - 1) + ' (baris ke-2 s.d. ' + lastRow + ')');

  var usersSheet = masterSS.getSheetByName(SHEET_MASTER.USERS);
  var usersLastRow = usersSheet.getLastRow();
  Logger.log('Jumlah user ter-seed  : ' + (usersLastRow - 1));

  Logger.log('');
  Logger.log('=== VERIFIKASI SELESAI ===');
}

/**
 * Print nama semua sheet di spreadsheet + jumlah kolom header-nya.
 */
function _printSheetSummary(ss) {
  var sheets = ss.getSheets();
  sheets.forEach(function (sheet) {
    var lastCol = sheet.getLastColumn();
    var headers = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].join(', ')
      : '(kosong)';
    Logger.log('  [' + sheet.getName() + '] ' + lastCol + ' kolom: ' + headers);
  });
}
