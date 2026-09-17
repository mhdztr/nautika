/**
 * utils/Constants.js
 * Konstanta global Nautika — nama spreadsheet, sheet, enum role/status/divisi.
 * ID spreadsheet disimpan di PropertiesService oleh Setup.js dan dibaca via getSpreadsheetIds().
 *
 * JANGAN ubah nilai-nilai di sini tanpa sinkronisasi ke DATA_SCHEMA.md dan ARCHITECTURE.md.
 */

// ===========================================================================
// NAMA SPREADSHEET
// ===========================================================================
var SS_NAME = {
  MASTER:    'Nautika_Master',
  TRANSAKSI: 'Nautika_Transaksi',
  LOG:       'Nautika_Log'
};

// ===========================================================================
// NAMA SHEET — Nautika_Master
// ===========================================================================
var SHEET_MASTER = {
  KAPAL:              'Kapal',
  KAWASAN_KONSERVASI: 'Kawasan_Konservasi',
  WPP:                'WPP',
  DIVISI:             'Divisi',
  USERS:              'Users'
};

// ===========================================================================
// NAMA SHEET — Nautika_Transaksi
// ===========================================================================
var SHEET_TX = {
  TATA_USAHA:          'TX_TataUsaha',
  OPERASI_LAUT:        'TX_OperasiLaut',
  OPERASI_UDARA:       'TX_OperasiUdara',
  INTELIJEN:           'TX_Intelijen',
  PEMANTAUAN:          'TX_Pemantauan',
  PERAWATAN_KESIAPAN:  'TX_Perawatan_Kesiapan',
  PERAWATAN_DOCKING:   'TX_Perawatan_Docking',
  PERAWATAN_ITEM:      'TX_Perawatan_Item',
  LOGISTIK_AMUNISI:    'TX_Logistik_Amunisi',
  LOGISTIK_BBM:        'TX_Logistik_BBM',
  LOGISTIK_PERSONIL:   'TX_Logistik_Personil',
  PENGAWAKAN_AKN:      'TX_Pengawakan_AKN',
  PENGAWAKAN_KEGIATAN: 'TX_Pengawakan_Kegiatan',
  KEGIATAN_DIREKTORAT: 'TX_KegiatanDirektorat',
  EVIDENCE:            'TX_Evidence'
};

// ===========================================================================
// NAMA SHEET — Nautika_Log
// ===========================================================================
var SHEET_LOG = {
  APPROVAL_QUEUE: 'Approval_Queue',
  AUDIT_LOG:      'Audit_Log',
  NOTIFICATIONS:  'Notifications'
};

// ===========================================================================
// KOLOM STANDAR — wajib ada di setiap sheet TX_*
// (urutan sesuai ARCHITECTURE.md §4)
// ===========================================================================
var STD_COLS = [
  'RowID',
  'DivisiID',
  'Periode',
  'SubmittedBy',
  'Timestamp',
  'Status',
  'SupersedesRowID',
  'VoidReason',
  'VoidedBy',
  'VoidedAt'
];

// ===========================================================================
// ENUM — Role
// ===========================================================================
var ROLE = {
  SUPERADMIN: 'SUPERADMIN',
  DIREKTUR:   'DIREKTUR',
  KADIV:      'KADIV',
  STAF:       'STAF'
};

// ===========================================================================
// ENUM — Status Akun (Users)
// ===========================================================================
var USER_STATUS = {
  PENDING:  'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

// ===========================================================================
// ENUM — Status Baris Transaksi
// ===========================================================================
var ROW_STATUS = {
  ACTIVE:     'ACTIVE',
  SUPERSEDED: 'SUPERSEDED',
  VOID:       'VOID'
};

// ===========================================================================
// ENUM — Divisi ID (sesuai seed di Setup.js)
// ===========================================================================
var DIVISI_ID = {
  TU:     'DIV-TU',
  OPS:    'DIV-OPS',
  INTEL:  'DIV-INTEL',
  PANTAU: 'DIV-PANTAU',
  RAWAT:  'DIV-RAWAT',
  LOG:    'DIV-LOG',
  AWAK:   'DIV-AWAK'
};

// ===========================================================================
// ENUM — Modul Perawatan (Fase 9)
// Nilai enum harus persis sama dengan DATA_SCHEMA.md.
// ===========================================================================
var RAWAT_LOKASI = ['PUSAT', 'UPT'];

var RAWAT_TAHAP = [
  'PROSES_PENGADAAN',
  'TANDATANGAN_KONTRAK',
  'PROSES_DOCKING',
  'SELESAI'
];

var RAWAT_KATEGORI = [
  'PROSES_PEMBAYARAN',
  'SELESAI',
  'PERENCANAAN'
];

// ===========================================================================
// EVIDENCE — struktur folder & batas ukuran (PRD §11, ARCHITECTURE §6)
// ===========================================================================
var EVIDENCE_ROOT_FOLDER = 'Nautika_Evidence';
var EVIDENCE_LIMIT_BYTES = {
  FILE:  15 * 1024 * 1024,   // file umum 15MB
  VIDEO: 50 * 1024 * 1024    // video maksimal 50MB, di atas ini ditolak
};

// ===========================================================================
// WPP NRI — referensi dari wpp_final.geojson (source of truth geospasial)
// Daftar ini MENGIKUTI properti `wppnri`/`name` pada file geojson WPP-NRI.
// Dipakai untuk: (1) auto-seed sheet master `WPP` bila masih kosong,
// (2) fallback dropdown WPP. Jika batas WPP diperbarui di geojson, daftar ini
// harus disinkronkan manual oleh Superadmin (lihat ARCHITECTURE §3.1).
// ===========================================================================
var WPP_NRI = [
  { WPPCode: '571', NamaWilayah: 'WPP 571' },
  { WPPCode: '572', NamaWilayah: 'WPP 572' },
  { WPPCode: '573', NamaWilayah: 'WPP 573' },
  { WPPCode: '711', NamaWilayah: 'WPP 711' },
  { WPPCode: '712', NamaWilayah: 'WPP 712' },
  { WPPCode: '713', NamaWilayah: 'WPP 713' },
  { WPPCode: '714', NamaWilayah: 'WPP 714' },
  { WPPCode: '715', NamaWilayah: 'WPP 715' },
  { WPPCode: '716', NamaWilayah: 'WPP 716' },
  { WPPCode: '717', NamaWilayah: 'WPP 717' },
  { WPPCode: '718', NamaWilayah: 'WPP 718' }
];

// ===========================================================================
// PROPERTI KEY — PropertiesService
// ===========================================================================
var PROP_KEY = {
  MASTER_SS_ID:    'MASTER_SS_ID',
  TRANSAKSI_SS_ID: 'TRANSAKSI_SS_ID',
  LOG_SS_ID:       'LOG_SS_ID',
  SETUP_COMPLETED: 'SETUP_COMPLETED',
  CARTO_API_KEY:   'CARTO_API_KEY',
  SEED_SUPERADMIN_PASSWORD: 'SEED_SUPERADMIN_PASSWORD'
};

// ===========================================================================
// HELPER — Ambil ID spreadsheet dari PropertiesService
// ===========================================================================
/**
 * Mengembalikan CARTO API key dari PropertiesService.
 * Tidak ada kunci hardcoded di source; key diisi oleh Superadmin
 * melalui fungsi setupSetCartoKey() di Setup.js (lihat ARCHITECTURE §9).
 * Mengembalikan string kosong jika belum diisi.
 */
function getCartoApiKey() {
  return PropertiesService.getScriptProperties()
    .getProperty(PROP_KEY.CARTO_API_KEY) || '';
}

/**
 * Alias publik untuk frontend (google.script.run.utils_getCartoKey).
 * Mengembalikan key ke client agar tile CARTO dapat dimuat; key tidak
 * pernah ditulis hardcoded di source (lihat ARCHITECTURE §9).
 */
function utils_getCartoKey() {
  return getCartoApiKey();
}

/**
 * Mengembalikan objek {masterId, transaksiId, logId}.
 * Melempar Error jika setup belum dijalankan.
 */
function getSpreadsheetIds() {
  var props       = PropertiesService.getScriptProperties();
  var masterId    = props.getProperty(PROP_KEY.MASTER_SS_ID);
  var transaksiId = props.getProperty(PROP_KEY.TRANSAKSI_SS_ID);
  var logId       = props.getProperty(PROP_KEY.LOG_SS_ID);

  if (!masterId || !transaksiId || !logId) {
    throw new Error(
      '[Nautika] Spreadsheet ID belum tersimpan. ' +
      'Jalankan fungsi setup() di Setup.js terlebih dahulu.'
    );
  }
  return {
    masterId:    masterId,
    transaksiId: transaksiId,
    logId:       logId
  };
}
