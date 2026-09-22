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
 * Pastikan sheet master `Opsi` ada (self-heal). Jika belum ada (mis. Master
 * dibuat sebelum revisi Opsi Fase 9/10), buat dengan header sesuai
 * DATA_SCHEMA.md `Opsi`. Aman dipanggil berulang (idempoten).
 * @returns {Sheet}
 */
function ensureOpsiSheet() {
  var existing = openMasterSheet(SHEET_MASTER.OPSI);
  if (existing) return existing;
  var ss = SpreadsheetApp.openById(getSpreadsheetIds().masterId);
  var sheet = ss.insertSheet(SHEET_MASTER.OPSI);
  sheet.getRange(1, 1, 1, 6)
    .setValues([['Kode', 'Urutan', 'Label', 'Aktif', 'DibuatOleh', 'DibuatAt']])
    .setFontWeight('bold')
    .setBackground('#E8EAF6');
  sheet.setFrozenRows(1);
  Logger.log('[ensureOpsiSheet] Sheet ' + SHEET_MASTER.OPSI + ' dibuat otomatis.');
  return sheet;
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

// ===========================================================================
// ROW WRITING
// ===========================================================================

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
}

// ===========================================================================
// OPSI (daftar pilihan dinamis)
// ===========================================================================

/**
 * Ambil daftar label aktif untuk sebuah grup Opsi (DATA_SCHEMA.md `Opsi`).
 * Sumber = sheet master `Opsi` + semua default (fallback). Baris NON-aktif
 * hanya berguna untuk riwayat — tidak dimasukkan. Hasil di-cache ke
 * CacheService (TTL 10 menit) supaya getOptions/KPI/tren tidak scan ulang
 * tiap kali.
 *
 * @param {string} kode - OPSI_KODE.AMUNISI / BBM / KOM_PERSONIL / AWAK_KATEGORI
 * @returns {string[]} label terurut (Urutan)
 */
function getOpsiList(kode) {
  var key = 'OPSI_LIST_' + String(kode || '');
  var cache = CacheService.getScriptCache();
  var cached = cache.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* fall through */ }
  }

  var orderMap = {};
  var num = 0;
  (OPSI_DEFAULT[kode] || []).forEach(function (label) {
    num += 10;
    orderMap[label] = (orderMap[label] === undefined) ? num : orderMap[label];
  });

  try {
    readOpsiRows().forEach(function (r) {
      if (String(r['Kode']) !== String(kode)) return;
      var label = String(r['Label'] || '').trim();
      if (!label) return;
      var aktif = String(r['Aktif']).toLowerCase() !== 'false';
      if (!aktif) return;
      var urutan = Number(r['Urutan']) || 0;
      // Baris dari sheet (seed & tambahan user) menang atas order default;
      // urutan seed (1..N) & tambahan (max+1) dipetakan ke rentang 1000+ supaya
      // urutan antar-baris sheet tetap, dan selalu tampil urut.
      orderMap[label] = urutan + 1000;
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
 * Detail baris opsi satu grup (untuk halaman Master Data): semua baris
 * termasuk non-aktif, berikut urutan.
 * @param {string} kode
 * @returns {Array<{label:string, aktif:boolean, urutan:number}>}
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
        out.push({
          label: label,
          aktif: String(r['Aktif']).toLowerCase() !== 'false',
          urutan: Number(r['Urutan']) || 0
        });
      });
  } catch (e) {
    Logger.log('[getOpsiDetail] ' + e.message);
  }
  (OPSI_DEFAULT[kode] || []).forEach(function (label) {
    if (!seen[label]) {
      out.push({ label: label, aktif: true, urutan: 0 });
    }
  });
  out.sort(function (a, b) { return a.urutan - b.urutan || a.label.localeCompare(b.label); });
  return out;
}
