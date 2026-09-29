/**
 * utils/DetailService.js
 * Helper bersama untuk rincian per-item (sheet TX_*_Detail) — dipakai
 * OperasiLautService, OperasiUdaraService, dan IntelijenService.
 *
 * Prinsip (keputusan desain, lihat DATA_SCHEMA.md):
 *  - Header menyimpan JUMLAH DERIVED dari rincian, supaya KPI/agregasi lama
 *    tetap berjalan tanpa perubahan.
 *  - Kirim param `rincian` (array item) → jumlah dihitung sistem; bila param
 *    tidak dikirim (klien lama / revisi nilai saja) → nilai jumlah manual
 *    pada header dipertahankan (tidak ditimpa).
 *  - Rincian subordinat header: ikut SUPERSEDED saat revisi, ikut VOID saat
 *    anulir. Baris rincian baru merekam SupersedesRowID ke rincian lama.
 */

// Nilai dianggap kosong ('' | null | undefined | spasi saja).
function _detailBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

/**
 * Buang baris rincian yang semua field isinya kosong (baris kosong yang
 * ditinggalkan pengguna tidak dihitung maupun divalidasi).
 */
function _detailCleanItems(items) {
  return (items || []).filter(function (it) {
    if (!it || typeof it !== 'object') return false;
    return Object.keys(it).some(function (k) {
      var v = it[k];
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
  });
}

/**
 * Validasi rincian itemized (Operasi Laut & Udara).
 *
 * @param {Array} items   - [{ItemType|itemType, NamaItem|namaItem, ...}]
 * @param {Object} rules
 *   { typeField: string,           // 'ItemType'
 *     types:    Array<string>,     // ['KII','KIA','RUMPON']
 *     required: Array<string>,     // ['NamaItem']
 *     requiredIf: Object,          // { AsalNegara: ['KIA'], WPPCode: ['RUMPON'] }
 *     trim: Array<string> | null   // kolom yang di-trim (default: semua string) }
 * @returns {{error: string}|{items: Array}}
 */
function _detailValidateItemized(items, rules) {
  var cleaned = _detailCleanItems(items);
  var out = [];
  for (var i = 0; i < cleaned.length; i++) {
    var it = cleaned[i];
    var prefix = 'Baris rincian ke-' + (i + 1) + ': ';
    var type = String(it[rules.typeField] || '').trim().toUpperCase();
    if (!rules.types || rules.types.indexOf(type) === -1) {
      return { error: prefix + 'pilih kategori item yang valid.' };
    }

    for (var r = 0; r < (rules.required || []).length; r++) {
      if (_detailBlank(it[rules.required[r]])) {
        return { error: prefix + 'kolom "' + rules.required[r] + '" wajib diisi.' };
      }
    }

    var rif = rules.requiredIf || {};
    for (var col in rif) {
      if (rif[col].indexOf(type) !== -1 && _detailBlank(it[col])) {
        return { error: prefix + 'kolom "' + col + '" wajib diisi untuk kategori ini.' };
      }
    }

    var norm = { ItemType: type };
    Object.keys(it).forEach(function (k) {
      if (k === rules.typeField) return;
      var v = it[k];
      norm[k] = (typeof v === 'string') ? String(v).trim() : v;
    });
    out.push(norm);
  }
  return { items: out };
}

/**
 * Count rincian per kategori. Urutan key mengikuti array `types`.
 */
function _detailCountByType(items, typeField, types) {
  var counts = {};
  (types || []).forEach(function (t) { counts[t] = 0; });
  (items || []).forEach(function (it) {
    var t = String(it[typeField] || '');
    if (counts[t] !== undefined) counts[t]++;
  });
  return counts;
}

/**
 * Gabungan nilai unik kolom dari item dengan kategori tertentu (mis. daftar
 * unik AsalNegara untuk KIA → kolom AsalNegaraAsing di header).
 */
function _detailUniqueJoin(items, typeField, type, col) {
  var seen = {};
  (items || []).forEach(function (it) {
    if (String(it[typeField]) !== type) return;
    if (!_detailBlank(it[col])) seen[String(it[col]).trim()] = true;
  });
  return Object.keys(seen).join(', ');
}

/**
 * Paksa sheet detail tersedia (self-heal idempoten). key = salah satu key
 * DETAIL_HEADERS di Constants.js ('OPERASI_LAUT' | 'OPERASI_UDARA' | 'INTELIJEN').
 */
function _detailEnsureSheet(key) {
  var sheetName = SHEET_TX_DETAIL[key];
  return ensureDetailTxSheet(sheetName, DETAIL_HEADERS[key]);
}

/**
 * Tulis baris rincian baru di bawah header.
 *
 * @param {string} key          - key DETAIL_HEADERS / SHEET_TX_DETAIL
 * @param {string} parentRowId  - RowID header
 * @param {Array}  items        - [{ItemType,NamaItem,...}]
 * @param {Object} meta         - {DivisiID, Periode, SubmittedBy, Timestamp, supersedes:Array<RowID>}
 *                                supersedes[i] = RowID rincian lama yang diganti (opsional).
 * @returns {Array<Object>} rincian yang ditulis (lengkap dgn RowID dll.)
 */
function _detailWriteChildren(key, parentRowId, items, meta) {
  var sheet = _detailEnsureSheet(key);
  var ts = meta.Timestamp || new Date().toISOString();
  var written = [];
  for (var i = 0; i < items.length; i++) {
    var rowId = 'DTL-' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
    var row = {
      RowID: rowId,
      DivisiID: meta.DivisiID,
      Periode: meta.Periode,
      SubmittedBy: meta.SubmittedBy,
      Timestamp: ts,
      Status: ROW_STATUS.ACTIVE,
      SupersedesRowID: (meta.supersedes && meta.supersedes[i]) ? meta.supersedes[i] : '',
      VoidReason: '',
      VoidedBy: '',
      VoidedAt: '',
      ParentRowID: parentRowId
    };
    Object.keys(items[i]).forEach(function (k) {
      row[k] = items[i][k];
    });
    appendRowData(sheet, row);
    written.push(row);
  }
  return written;
}

/**
 * Ambil child ACTIVE (urutan baris) milik parent tertentu — untuk mapping
 * SupersedesRowID pada revisi.
 */
function _detailActiveChildren(sheetName, parentRowId) {
  var map = readDetailByParent(sheetName);
  return (map[String(parentRowId)] || []).filter(function (r) {
    return String(r.Status) === ROW_STATUS.ACTIVE;
  });
}

/**
 * Ubah status seluruh child ACTIVE milik parent (dipakai revisi → SUPERSEDED,
 * anulir → VOID).
 */
function _detailSetChildrenStatus(sheetName, parentRowId, status, alasan, userId, ts) {
  var map = readDetailByParent(sheetName);
  var list = map[String(parentRowId)] || [];
  var sheet = openTransaksiSheet(sheetName);
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (String(r.Status) !== ROW_STATUS.ACTIVE) continue;
    var found = findRowByField(sheet, 'RowID', String(r.RowID));
    if (!found) continue;
    updateRowCells(sheet, found.rowIndex, {
      Status: status,
      VoidReason: alasan || '',
      VoidedBy: userId || '',
      VoidedAt: ts || new Date().toISOString()
    });
  }
}

/**
 * Lampirkan `rincian` (array child mentah + kolom meta) ke setiap baris
 * history header untuk keperluan modal detail & prefill revisi.
 */
function _detailAttach(history, sheetName) {
  if (!history || history.length === 0) return history;
  var map = readDetailByParent(sheetName);
  history.forEach(function (row) {
    row.rincian = map[String(row.RowID)] || [];
  });
  return history;
}