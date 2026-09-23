/**
 * Setup.js
 * Skrip inisialisasi database Nautika.
 *
 * CARA PAKAI:
 *   1. Push kode ke GAS via clasp: `clasp push`
 *   2. Di GAS editor, jalankan fungsi `setup()` SATU KALI.
 *   3. Lihat log eksekusi — akan tercetak ID ketiga spreadsheet yang dibuat.
 *   4. Spreadsheet IDs disimpan otomatis ke Script Properties.
 *      Skrip-skrip lain membacanya via getSpreadsheetIds() di Constants.js.
 *
 * RESET: Jalankan setupForce() untuk hapus flag dan jalankan ulang dari nol.
 *        HATI-HATI: ini AKAN membuat spreadsheet baru dan menimpa ID yang tersimpan.
 *
 * Tidak ada UI yang dibangun di fase ini — fokus database saja (Fase 1 PRD).
 */

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

  var masterSS    = _setupMaster(props);
  var transaksiSS = _setupTransaksi(props);
  var logSS       = _setupLog(props);

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
    'KapalID', 'Nama', 'Kelas', 'Homebase_UPT', 'StatusAktif'
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
    'UserID', 'Nama', 'Email', 'PasswordHash',
    'DivisiID', 'Role', 'Status',
    'ApprovedBy', 'RegisteredAt', 'ApprovedAt'
  ]);

  _createSheetWithHeaders(ss, SHEET_MASTER.OPSI, [
    'Kode', 'Urutan', 'Label', 'Aktif', 'DibuatOleh', 'DibuatAt'
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

  // TX_Intelijen
  _createSheetWithHeaders(ss, SHEET_TX.INTELIJEN,
    STD_COLS.concat([
      'Jenis', 'Jumlah', 'KawasanID', 'Keterangan'
    ])
  );

  // TX_Pemantauan
  _createSheetWithHeaders(ss, SHEET_TX.PEMANTAUAN,
    STD_COLS.concat([
      'Jenis', 'Jumlah',
      'NamaPenyedia',
      'KapalID', 'KondisiDarurat', 'StatusPenanganan'
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

  var now          = new Date();
  var props        = PropertiesService.getScriptProperties();
  var seedPassword = props.getProperty(PROP_KEY.SEED_SUPERADMIN_PASSWORD);
  var generated    = false;

  if (!seedPassword) {
    seedPassword = _generateSeedPassword();
    props.setProperty(PROP_KEY.SEED_SUPERADMIN_PASSWORD, seedPassword);
    generated = true;
  }

  var passwordHash  = hashPassword(seedPassword);
  var userId        = 'USER-SUPERADMIN-001';

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
// SEED DATA — Opsi (daftar pilihan dinamis)
// Mencatat default setiap grup ke sheet `Opsi`. Baris yang sudah ada (match
// Kode+Label) dilewati agar hasil edit/penambahan user tidak tertimpa saat
// setupForce dijalankan ulang.
// ===========================================================================

function _seedOpsi(masterSS) {
  Logger.log('[Setup] Seeding daftar Opsi...');
  var sheet = masterSS.getSheetByName(SHEET_MASTER.OPSI);

  var existing = sheetToObjects(sheet);
  var seen = {};
  existing.forEach(function (r) {
    seen[String(r['Kode']) + '|' + String(r['Label'])] = true;
  });

  var rows = [];
  var kodeList = [OPSI_KODE.AMUNISI, OPSI_KODE.BBM, OPSI_KODE.KOM_PERSONIL, OPSI_KODE.AWAK_KATEGORI];
  for (var k = 0; k < kodeList.length; k++) {
    var kode = kodeList[k];
    var labels = OPSI_DEFAULT[kode] || [];
    for (var i = 0; i < labels.length; i++) {
      if (seen[kode + '|' + labels[i]]) continue;
      rows.push([kode, i + 1, labels[i], true, 'SYSTEM', new Date()]);
    }
  }

  if (rows.length > 0) {
    sheet.getRange(2 + existing.length, 1, rows.length, rows[0].length).setValues(rows);
  }
  Logger.log('[Setup] Opsi selesai di-seed (' + (existing.length + rows.length) + ' baris).');
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
  var rand  = Utilities.getUuid().replace(/-/g, '');
  var out   = '';
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

  var masterSS    = SpreadsheetApp.openById(ids.masterId);
  var transaksiSS = SpreadsheetApp.openById(ids.transaksiId);
  var logSS       = SpreadsheetApp.openById(ids.logId);

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
  sheets.forEach(function(sheet) {
    var lastCol = sheet.getLastColumn();
    var headers = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].join(', ')
      : '(kosong)';
    Logger.log('  [' + sheet.getName() + '] ' + lastCol + ' kolom: ' + headers);
  });
}
