/**
 * data/SheetAccess.js
 * Layer akses data generik + assertScope RBAC + hashPassword.
 *
 * ATURAN:
 * - Service layer TIDAK memanggil SpreadsheetApp secara langsung — semua melalui fungsi di sini.
 * - assertScope() WAJIB dipanggil di awal setiap service function yang baca/tulis data sensitif.
 * - hashPassword() adalah satu-satunya implementasi hashing di seluruh proyek — jangan duplikasi.
 */

// ===========================================================================
// RBAC
// ===========================================================================

/**
 * Validasi bahwa session memiliki scope yang dibutuhkan.
 * Melempar Error jika tidak memenuhi syarat — error akan ditangkap di caller
 * dan dikembalikan ke client sebagai {success: false, error: "..."}.
 *
 * @param {Object} session       - {userId, role, divisiId, status, nama}
 * @param {string[]|null} allowedRoles    - null = semua role APPROVED boleh; array = hanya role tsb
 * @param {string|null} requiredDivisiId  - null = lintas-divisi OK; string = harus match divisi ini
 *                                          (dikecualikan untuk SUPERADMIN dan DIREKTUR)
 */
function assertScope(session, allowedRoles, requiredDivisiId) {
  if (!session || !session.userId) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau sudah berakhir. Silakan login ulang.');
  }
  if (session.status !== USER_STATUS.APPROVED) {
    throw new Error('FORBIDDEN: Akun belum disetujui atau sudah tidak aktif.');
  }
  if (allowedRoles && allowedRoles.length > 0) {
    if (allowedRoles.indexOf(session.role) === -1) {
      throw new Error('FORBIDDEN: Role ' + session.role + ' tidak memiliki akses ke operasi ini.');
    }
  }
  if (requiredDivisiId) {
    // SUPERADMIN dan DIREKTUR bypass pembatasan divisi
    if (session.role !== ROLE.SUPERADMIN && session.role !== ROLE.DIREKTUR) {
      if (session.divisiId !== requiredDivisiId) {
        throw new Error(
          'FORBIDDEN: Akses terbatas ke divisi ' + requiredDivisiId +
          '. Akun Anda terdaftar di divisi ' + session.divisiId + '.'
        );
      }
    }
  }
}

// ===========================================================================
// HASHING — satu implementasi kanonik untuk seluruh proyek
// ===========================================================================

/**
 * Hash password menggunakan SHA-256 (built-in GAS, tanpa library eksternal).
 * Output: hex string 64 karakter.
 *
 * CATATAN: SHA-256 tanpa salt — dipertahankan untuk simplisitas internal GAS.
 * Ditinjau ulang di Fase 12 (QA & Polish) sebelum go-live.
 *
 * @param {string} plaintext
 * @returns {string} hex SHA-256 hash
 */
function hashPassword(plaintext) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    plaintext,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (b) {
    var hex = (b < 0 ? b + 256 : b).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// ===========================================================================
// SHEET OPENERS
// ===========================================================================

function openMasterSheet(sheetName) {
  var ids = getSpreadsheetIds();
  return SpreadsheetApp.openById(ids.masterId).getSheetByName(sheetName);
}

function openTransaksiSheet(sheetName) {
  var ids = getSpreadsheetIds();
  return SpreadsheetApp.openById(ids.transaksiId).getSheetByName(sheetName);
}

function openLogSheet(sheetName) {
  var ids = getSpreadsheetIds();
  return SpreadsheetApp.openById(ids.logId).getSheetByName(sheetName);
}

/**
 * Pastikan sebuah kolom ada pada sheet transaksi (self-heal). Berguna saat
 * skema bertambah setelah sheet dibuat (mis. kolom KapalID — Fase 12):
 * `_createSheetWithHeaders` di Setup.js meng-skip sheet yang sudah ada, jadi
 * kolom baru tidak otomatis muncul di DB terlanjur dibuat. Fungsi ini men-
 * append header jika belum ada. Idempoten & aman dipanggil berulang.
 *
 * @param {string} sheetName  - nama sheet transaksi
 * @param {string} colName    - nama kolom yang dipastikan ada
 */
function ensureTxColumn(sheetName, colName) {
  var sheet = openTransaksiSheet(sheetName);
  if (!sheet) return;
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf(colName) !== -1) return;
  var newCol = lastCol + 1;
  var cell = sheet.getRange(1, newCol);
  cell.setValue(colName);
  cell.setFontWeight('bold');
  cell.setBackground('#E8EAF6');
  Logger.log('[ensureTxColumn] Kolom ' + colName + ' ditambahkan ke ' + sheetName + ' (kolom ' + newCol + ').');
}

/**
 * Pastikan kolom KapalID ada di keempat sheet transaksi yang dihubungkan ke
 * Profil Kapal (Fase 12): OperasiLaut, OperasiUdara, Logistik_Amunisi,
 * Logistik_BBM. Dipanggil di titik tulis service terkait supaya DB lama
 * ter-heal otomatis tanpa setupForce.
 */
function ensureKapalColumns() {
  ensureTxColumn(SHEET_TX.OPERASI_LAUT,        'KapalID');
  ensureTxColumn(SHEET_TX.OPERASI_UDARA,       'KapalID');
  ensureTxColumn(SHEET_TX.LOGISTIK_AMUNISI,    'KapalID');
  ensureTxColumn(SHEET_TX.LOGISTIK_BBM,        'KapalID');
}

/**
 * Pastikan kolom NamaKapal & JenisKapal ada di TX_Pemantauan (kapal
 * marabahaya = kapal eksternal, bukan ref Master Data). Dipanggil di titik
 * tulis service supaya DB lama ter-heal otomatis tanpa setupForce.
 */
function ensurePemantauanKapalKolom() {
  ensureTxColumn(SHEET_TX.PEMANTAUAN, 'NamaKapal');
  ensureTxColumn(SHEET_TX.PEMANTAUAN, 'JenisKapal');
}

/**
 * Ambil sheet detail transaksi, buat otomatis bila belum ada (self-heal,
 * idempoten). Dipakai untuk sheet rincian per-item (TX_*_Detail — revisi
 * rincian audit) supaya DB lama ter-heal tanpa `setupForce`.
 * Header dibuat sesuai definisi Setup.js (urutan kolom wajib sama).
 *
 * @param {string} sheetName - nama sheet transaksi
 * @param {Array<string>} headers - header kolom (STD_COLS + kolom rinci)
 * @returns {Sheet}
 */
function ensureDetailTxSheet(sheetName, headers) {
  var sheet = openTransaksiSheet(sheetName);
  if (sheet) return sheet;
  var ss = SpreadsheetApp.openById(getSpreadsheetIds().transaksiId);
  var created = ss.insertSheet(sheetName);
  created.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#E8EAF6');
  created.setFrozenRows(1);
  Logger.log('[ensureDetailTxSheet] Sheet ' + sheetName + ' dibuat otomatis.');
  return created;
}

/**
 * Pastikan sheet master `Opsi` ada (self-heal). Jika belum ada (mis. Master
 * dibuat sebelum revisi Opsi Fase 9/10), buat dengan header sesuai
 * DATA_SCHEMA.md `Opsi`. Aman dipanggil berulang (idempoten).
 * @returns {Sheet}
 */
function ensureOpsiSheet() {
  var existing = openMasterSheet(SHEET_MASTER.OPSI);
  if (existing) { ensureOpsiColumns(existing); return existing; }
  var ss = SpreadsheetApp.openById(getSpreadsheetIds().masterId);
  var sheet = ss.insertSheet(SHEET_MASTER.OPSI);
  sheet.getRange(1, 1, 1, 7)
    .setValues([['Kode', 'Urutan', 'Label', 'LabelTampil', 'Aktif', 'DibuatOleh', 'DibuatAt']])
    .setFontWeight('bold')
    .setBackground('#E8EAF6');
  sheet.setFrozenRows(1);
  Logger.log('[ensureOpsiSheet] Sheet ' + SHEET_MASTER.OPSI + ' dibuat otomatis.');
  return sheet;
}

/**
 * Self-heal kolom `LabelTampil` pada sheet `Opsi` yang dibuat sebelum kolom ini
 * ada (versi lama 6 kolom). Kolom baru disisipkan tepat setelah `Label` supaya
 * urutan kolom tetap sama dengan header kanonik di `DATA_SCHEMA.md` — seluruh
 * penulisan baris Opsi memakai urutan header tersebut, sehingga bila kolom baru
 * hanya ditambahkan di posisi terakhir, baris baru akan masuk ke kolom keliru.
 * Aman dipanggil berulang (idempoten).
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function ensureOpsiColumns(sheet) {
  if (!sheet) return;
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf('LabelTampil') !== -1) return;

  // Sisipkan sesudah kolom `Label`; bila header tidak wajar, sisipkan di akhir.
  var labelCol = headers.indexOf('Label') + 1; // 1-based
  if (labelCol < 1) labelCol = lastCol;
  sheet.insertColumnAfter(labelCol);
  var newCol = labelCol + 1;

  var cell = sheet.getRange(1, newCol);
  cell.setValue('LabelTampil');
  cell.setFontWeight('bold');
  cell.setBackground('#E8EAF6');

  // Baris lama yang LabelTampil-nya kosong diisi dengan nilai Label agar UI
  // tidak menampilkan token mentah untuk data yang sudah ada.
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, newCol, lastRow - 1, 1)
      .setValues(sheet.getRange(2, labelCol, lastRow - 1, 1).getValues());
  }
  Logger.log('[ensureOpsiColumns] Kolom LabelTampil disisipkan di ' + SHEET_MASTER.OPSI +
    ' (kolom ' + newCol + '), diisi dari kolom Label.');
}

/**
 * Baca isi sheet, aman terhadap sheet null (mis. belum dibuat) → [].
 */
function readOpsiRows() {
  var sheet = ensureOpsiSheet();
  return sheetToObjects(sheet);
}

// ===========================================================================
// ROW READING
// ===========================================================================

/**
 * Konversi seluruh data sheet ke array of plain objects, header row sebagai key.
 * Row 1 = header, row 2+ = data.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Object[]}
 */
function sheetToObjects(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

/**
 * Cari satu baris berdasarkan nilai di kolom tertentu (string match, case-insensitive tidak dipakai).
 *
 * @param {Sheet} sheet
 * @param {string} colName   - nama kolom header
 * @param {*}     value      - nilai yang dicari
 * @returns {{obj: Object, rowIndex: number}|null} rowIndex = 1-based (termasuk baris header)
 */
function findRowByField(sheet, colName, value) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  var headers = data[0];
  var colIdx = headers.indexOf(colName);
  if (colIdx === -1) return null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(value)) {
      var obj = {};
      headers.forEach(function (h, j) { obj[h] = data[i][j]; });
      return { obj: obj, rowIndex: i + 1 };
    }
  }
  return null;
}

/**
 * Cari baris berdasarkan RowID (shorthand untuk findRowByField(..., 'RowID', ...)).
 */
function findRowById(sheet, rowId) {
  return findRowByField(sheet, 'RowID', rowId);
}

/**
 * Baca seluruh baris detail (sheet rincian, mis. TX_OperasiLaut_Detail) dan
 * kelompokkan berdasarkan ParentRowID. Baris dengan ParentRowID kosong/tidak
 * diinput diabaikan.
 *
 * @param {string} sheetName - nama sheet detail
 * @returns {Object} peta { ParentRowID_String: [rowObj, ...] } tanpa kolom
 *                   dinamis pandas; nilai string dikembalikan apa adanya.
 */
function readDetailByParent(sheetName) {
  var map = {};
  var rows = sheetToObjects(openTransaksiSheet(sheetName));
  rows.forEach(function (r) {
    var parent = (r.ParentRowID === undefined || r.ParentRowID === null) ? '' : String(r.ParentRowID);
    if (!parent) return;
    if (!map[parent]) map[parent] = [];
    map[parent].push(r);
  });
  return map;
}

// ===========================================================================
// ROW WRITING
// ===========================================================================

/**
 * Naikkan penanda versi data transaksi — kunci invalidasi cache agregat
 * DashboardService. `appendRowData()` dan `updateRowCells()` di bawah
 * memanggilnya otomatis setiap ada tulis baris transaksi.
 *
 * Latar belakang: `dashboard_getOverview` & `dashboard_profilKapal` memakai
 * CacheService (TTL 300 detik) per user. Tanpa penanda ini, agregat Ikhtisar
 * kedaluwarsa hingga 5 menit setelah submit/revisi/anulir — contoh kasus:
 * anulir laporan mingguan Tata Usaha tidak mengubah kartu "Realisasi
 * SP2D/Akrual (YTD)". Penanda ikut masuk ke cache key, sehingga setelah ada
 * tulis, cache lama tidak terpakai lagi dan agregat dihitung ulang.
 */
function bumpTxVersion() {
  try {
    var cache = CacheService.getScriptCache();
    var n = Number(cache.get('DASH_TX_VERSION')) || 0;
    // TTL 6 jam — jauh melebihi TTL cache agregat (300s) agar penanda tidak
    // lebih dulu kedaluwarsa daripada entri yang dijaganya.
    cache.put('DASH_TX_VERSION', String(n + 1), 21600);
  } catch (ignore) { /* tidak pernah mengganggu alur tulis */ }
}

/**
 * Append satu baris baru ke sheet, mengikuti urutan kolom di header row.
 * Kolom yang tidak ada di dataObj diisi string kosong.
 *
 * @param {Sheet}  sheet
 * @param {Object} dataObj - {namaKolom: nilai}
 */
function appendRowData(sheet, dataObj) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function (h) {
    var val = dataObj[h];
    return (val === undefined || val === null) ? '' : val;
  });
  sheet.appendRow(row);
  bumpTxVersion();
}

/**
 * Update satu atau lebih sel di baris tertentu (1-based rowIndex).
 *
 * @param {Sheet}  sheet
 * @param {number} rowIndex  - baris yang diupdate (1-based; baris header = 1, data mulai dari 2)
 * @param {Object} updates   - {namaKolom: nilaiBaru}
 */
function updateRowCells(sheet, rowIndex, updates) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Object.keys(updates).forEach(function (colName) {
    var colIndex = headers.indexOf(colName) + 1; // 1-based
    if (colIndex > 0) {
      sheet.getRange(rowIndex, colIndex).setValue(updates[colName]);
    }
  });
  bumpTxVersion();
}

// ===========================================================================
// OPSI (daftar pilihan dinamis)
// ===========================================================================

/**
 * Ambil daftar label aktif untuk sebuah grup Opsi (DATA_SCHEMA.md `Opsi`).
 * Sumber TUNGGAL = sheet master `Opsi` (tidak ada daftar hardcoded lagi; isi
 * awal di-seed oleh `Setup.js`). Baris NON-aktif hanya berguna untuk riwayat —
 * tidak dimasukkan. Hasil di-cache ke CacheService (TTL 10 menit) supaya
 * getOptions/KPI/tren tidak scan ulang tiap kali.
 *
 * @param {string} kode - kunci dari OPSI_KODE
 * @returns {string[]} token label terurut (Urutan)
 */
function getOpsiList(kode) {
  var key = 'OPSI_LIST_' + String(kode || '');
  var cache = CacheService.getScriptCache();
  var cached = cache.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* fall through */ }
  }

  var orderMap = {};

  try {
    readOpsiRows().forEach(function (r) {
      if (String(r['Kode']) !== String(kode)) return;
      var label = String(r['Label'] || '').trim();
      if (!label) return;
      var aktif = String(r['Aktif']).toLowerCase() !== 'false';
      if (!aktif) return;
      var urutan = Number(r['Urutan']) || 0;
      orderMap[label] = urutan;
    });
  } catch (e) {
    Logger.log('[getOpsiList] ' + e.message);
  }

  var labels = Object.keys(orderMap).sort(function (a, b) {
    return (orderMap[a] || 0) - (orderMap[b] || 0) || a.localeCompare(b);
  });
  try { cache.put(key, JSON.stringify(labels), 600); } catch (e) { /* ignore */ }
  return labels;
}

/**
 * Peta `token -> teks tampilan` untuk satu grup Opsi, untuk seluruh baris di
 * sheet — termasuk token yang sudah dinonaktifkan dan token yang tidak lagi
 * ada di `getOpsiList` — agar baris riwayat lama tetap tampil memakai nama
 * yang benar, bukan token mentah.
 *
 * @param {string} kode
 * @returns {Object.<string,string>}
 */
function getOpsiLabelMap(kode) {
  var key = 'OPSI_MAP_' + String(kode || '');
  var cache = CacheService.getScriptCache();
  var cached = cache.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* fall through */ }
  }

  var map = {};
  try {
    readOpsiRows().forEach(function (r) {
      if (String(r['Kode']) !== String(kode)) return;
      var label = String(r['Label'] || '').trim();
      if (!label) return;
      // `LabelTampil` tetap dipakai walau token sudah dinonaktifkan — status
      // `Aktif` hanya mengatur boleh/tidaknya token muncul di dropdown
      // (lihat getOpsiList), bukan menghapus nama yang tampil di riwayat.
      // Token tanpa `LabelTampil` (baris lama) memakai `Label` sebagai gantinya.
      var tampil = String(r['LabelTampil'] || '').trim() || label;
      map[label] = tampil;
    });
  } catch (e) {
    Logger.log('[getOpsiLabelMap] ' + e.message);
  }
  try { cache.put(key, JSON.stringify(map), 600); } catch (e) { /* ignore */ }
  return map;
}

/**
 * Item siap pakai untuk combobox typeahead: `value` = token yang disimpan ke
 * sheet transaksi, `label` = teks yang dilihat user.
 *
 * @param {string} kode
 * @returns {Array<{value:string,label:string}>}
 */
function getOpsiItems(kode) {
  var map = getOpsiLabelMap(kode);
  return getOpsiList(kode).map(function (token) {
    return { value: token, label: map[token] || token };
  });
}

/**
 * Detail baris opsi satu grup (untuk halaman Master Data): semua baris
 * termasuk non-aktif, berikut urutan & teks tampilan.
 * @param {string} kode
 * @returns {Array<{label:string, labelTampil:string, aktif:boolean, urutan:number}>}
 */
function getOpsiDetail(kode) {
  var out = [];
  var seen = {};
  try {
    readOpsiRows().forEach(function (r) {
        if (String(r['Kode']) !== String(kode)) return;
        var label = String(r['Label'] || '').trim();
        if (!label || seen[label]) return;
        seen[label] = true;
        var tampil = String(r['LabelTampil'] || '').trim();
        out.push({
          label: label,
          labelTampil: tampil || label,
          aktif: String(r['Aktif']).toLowerCase() !== 'false',
          urutan: Number(r['Urutan']) || 0
        });
      });
  } catch (e) {
    Logger.log('[getOpsiDetail] ' + e.message);
  }
  out.sort(function (a, b) { return a.urutan - b.urutan || a.label.localeCompare(b.label); });
  return out;
}

/** Buang cache daftar & peta label Opsi (dipanggil setelah Superadmin mengubah sheet). */
function clearOpsiCache() {
  var cache = CacheService.getScriptCache();
  Object.keys(OPSI_KODE).forEach(function (k) {
    var kode = OPSI_KODE[k];
    cache.remove('OPSI_LIST_' + kode);
    cache.remove('OPSI_MAP_' + kode);
  });
}
