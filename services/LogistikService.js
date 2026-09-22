/**
 * services/LogistikService.js
 * Modul Logistik (Fase 10) — DIV-LOG. Tiga sub-modul independen:
 *   Amunisi  → TX_Logistik_Amunisi  (StokAwal + Penggunaan_Minggu)
 *   BBM      → TX_Logistik_BBM      (Pagu + Realisasi_Minggu + HargaAcuan + Tunggakan_Status)
 *   Personil → TX_Logistik_Personil (Komponen + Nilai_Minggu)
 *
 * Fungsi publik (google.script.run):
 *   logistik_getOptions, logistik_getKPI, logistik_getAmunisi/BBM/Personil,
 *   logistik_submitAmunisi/BBM/Personil, logistik_revisiAmunisi/BBM/Personil,
 *   logistik_anulir, logistik_getTren
 *
 * Keputusan pemodelan (konfirmasi user, tercatat di CHANGELOG):
 *   - Baseline (StokAwal amunisi / Pagu BBM) = 1 baris ACTIVE per jenis per
 *     tahun, dibuat saat inisialisasi (mulai bulan Januari atau kapan pun).
 *     Nilai baseline = baris ACTIVE terbaru berisi StokAwal/Pagu pada tahun
 *     referensi filter.
 *   - Akumulasi penggunaan/realisasi = Σ baris ACTIVE jenis tsb dengan
 *     Timestamp antara 1 Januari tahun referensi s.d akhir rentang filter
 *     (konsisten DATA_SCHEMA "periode berjalan s.d saat ini").
 *   - Sisa = StokAwal − Σ penggunaan ; Pagu = Realisasi + Sisa (dihitung
 *     sistem). Validasi stok negatif / realisasi > Pagu bersifat WARNING
 *     (non-blocking, sesuai PRD §5.8).
 */

// ── PEMETAAN JENIS ────────────────────────────────────────

function _logDivisiId() { return DIVISI_ID.LOG; }

function _logJenisMeta(jenis) {
  var j = String(jenis || '').toUpperCase();
  if (j === 'AMUNISI')  return { sheet: SHEET_TX.LOGISTIK_AMUNISI,  prefix: 'LGKA', label: 'Amunisi' };
  if (j === 'BBM')      return { sheet: SHEET_TX.LOGISTIK_BBM,      prefix: 'LGKB', label: 'BBM' };
  if (j === 'PERSONIL') return { sheet: SHEET_TX.LOGISTIK_PERSONIL, prefix: 'LGKP', label: 'Logistik Personil' };
  throw new Error('Jenis Logistik tidak dikenal: ' + jenis);
}

// ── RBAC ──────────────────────────────────────────────────

function _logRequireSession(token) {
  var session = _getSession(token);
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau belum disetujui.');
  }
  return session;
}

function _logAssertRead(session) {
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Akun belum aktif.');
  }
}

function _logAssertWrite(session) {
  assertScope(session, [ROLE.SUPERADMIN, ROLE.KADIV, ROLE.STAF], _logDivisiId());
}

function _logAssertAnulir(session) {
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Akun belum aktif.');
  }
  if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) return;
  if (session.role === ROLE.KADIV && session.divisiId === _logDivisiId()) return;
  throw new Error('FORBIDDEN: Hanya SUPERADMIN, DIREKTUR, atau KADIV DIV-LOG yang dapat menganulir.');
}

// ── OPTIONS ───────────────────────────────────────────────

function logistik_getOptions(token) {
  try {
    var session = _logRequireSession(token);
    _logAssertRead(session);
    return {
      success: true,
      data: {
        amunisi:  getOpsiList(OPSI_KODE.AMUNISI),
        bbm:      getOpsiList(OPSI_KODE.BBM),
        personil: getOpsiList(OPSI_KODE.KOM_PERSONIL)
      }
    };
  } catch (e) {
    Logger.log('[logistik_getOptions] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── KPI ───────────────────────────────────────────────────

/** Baris ACTIVE milik baris baseline (memiliki nilai StokAwal/Pagu terisi). */
function _logIsBaselineRow(meta, row) {
  if (meta.jenis === 'AMUNISI') {
    var sa = row['StokAwal'];
    return sa !== '' && sa !== null && sa !== undefined;
  }
  if (meta.jenis === 'BBM') {
    var pg = row['Pagu'];
    return pg !== '' && pg !== null && pg !== undefined;
  }
  return false;
}

/** Map jenis → baris ACTIVE terbaru bertipe baseline pada tahun tahunRef. */
function _logBaselines(meta, tahunRef) {
  var out = {};
  sheetToObjects(openTransaksiSheet(meta.sheet)).forEach(function (r) {
    if (String(r['Status']) !== ROW_STATUS.ACTIVE) return;
    if (!_logIsBaselineRow(meta, r)) return;
    var p = parsePeriode(String(r['Periode'] || ''));
    if (!p || p.year !== tahunRef) return;
    var key = _logKeyValue(meta, r);
    var prev = out[key];
    if (!prev || new Date(r['Timestamp']) > new Date(prev['Timestamp'])) out[key] = r;
  });
  return out;
}

/** Nilai kolom "jenis" pada baris (JenisAmunisi / Jenis / Komponen). */
function _logKeyValue(meta, row) {
  if (meta.jenis === 'AMUNISI') return String(row['JenisAmunisi'] || '');
  if (meta.jenis === 'BBM')     return String(row['Jenis'] || '');
  return String(row['Komponen'] || '');
}

/** Akumulasi kolom nilai (Penggunaan/Realisasi/Nilai) ACTIVE, mulai 1 Jan tahun s.d endDate. */
function _logCumulative(meta, key, tahunRef, endDate) {
  var col = (meta.jenis === 'AMUNISI') ? 'Penggunaan_Minggu'
          : (meta.jenis === 'BBM')     ? 'Realisasi_Minggu'
          : 'Nilai_Minggu';
  var start = new Date(tahunRef, 0, 1);
  var total = 0;
  sheetToObjects(openTransaksiSheet(meta.sheet)).forEach(function (r) {
    if (String(r['Status']) !== ROW_STATUS.ACTIVE) return;
    if (_logKeyValue(meta, r) !== key) return;
    var ts = new Date(r['Timestamp']);
    if (ts < start || ts > endDate) return;
    total += _logNum(r[col]);
  });
  return total;
}

/** Nilai "berlaku terakhir" (HargaAcuan / Tunggakan_Status) BBM: baris ACTIVE terbaru jenis tsb dalam [1 Jan, endDate]. */
function _logLatestBBMInfo(jenis, tahunRef, endDate) {
  var start = new Date(tahunRef, 0, 1);
  var harga = '', tunggakan = '', latest = null;
  sheetToObjects(openTransaksiSheet(SHEET_TX.LOGISTIK_BBM)).forEach(function (r) {
    if (String(r['Status']) !== ROW_STATUS.ACTIVE) return;
    if (String(r['Jenis'] || '') !== jenis) return;
    var ts = new Date(r['Timestamp']);
    if (ts < start || ts > endDate) return;
    if (!latest || ts > new Date(latest['Timestamp'])) {
      latest = r;
      harga = String(r['HargaAcuan'] || '');
      tunggakan = String(r['Tunggakan_Status'] || '');
    }
  });
  return { hargaAcuan: harga, tunggakan: tunggakan };
}

function _logCurrentBaseline(meta, key, tahunRef) {
  var b = _logBaselines(meta, tahunRef);
  return b[key] ? b[key] : null;
}

function logistik_getKPI(token, filter) {
  try {
    var session = _logRequireSession(token);
    _logAssertRead(session);

    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    var f = filter || {};
    var tahunRef = (f.mode === 'range' && f.dateTo)
      ? new Date(f.dateTo).getFullYear()
      : (f.year || new Date().getFullYear());

    // ── Amunisi ──
    var amMeta = { jenis: 'AMUNISI', sheet: SHEET_TX.LOGISTIK_AMUNISI };
    var amBaselines = _logBaselines(amMeta, tahunRef);
    var amunisi = getOpsiList(OPSI_KODE.AMUNISI).map(function (j) {
      var baseRow = amBaselines[j];
      var stokAwal = baseRow ? _logNum(baseRow['StokAwal']) : 0;
      var penggunaan = _logCumulative(amMeta, j, tahunRef, range.endDate);
      var stokAkhir = stokAwal - penggunaan;
      var warning = '';
      if (!baseRow) warning = 'StokAwal ' + j + ' belum diinisialisasi untuk tahun ' + tahunRef + '.';
      else if (stokAkhir < 0) warning = 'Stok akhir negatif (−' + Math.abs(stokAkhir) + ').';
      return {
        jenis:      j,
        stokAwal:   stokAwal,
        penggunaan: penggunaan,
        stokAkhir:  stokAkhir,
        pctTersisa: stokAwal > 0 ? Math.round((stokAkhir / stokAwal) * 1000) / 10 : 0,
        hasBaseline: !!baseRow,
        baselinePeriode: baseRow ? String(baseRow['Periode'] || '') : '',
        warning:    warning
      };
    });

    // ── BBM ──
    var bbMeta = { jenis: 'BBM', sheet: SHEET_TX.LOGISTIK_BBM };
    var bbBaselines = _logBaselines(bbMeta, tahunRef);
    var bbm = getOpsiList(OPSI_KODE.BBM).map(function (j) {
      var baseRow = bbBaselines[j];
      var pagu = baseRow ? _logNum(baseRow['Pagu']) : 0;
      var realisasi = _logCumulative(bbMeta, j, tahunRef, range.endDate);
      var sisa = pagu - realisasi;
      var info = _logLatestBBMInfo(j, tahunRef, range.endDate);
      var warning = '';
      if (!baseRow) warning = 'Pagu ' + j + ' belum diinisialisasi untuk tahun ' + tahunRef + '.';
      else if (realisasi > pagu) warning = 'Realisasi melebihi Pagu (Sisa negatif).';
      return {
        jenis:      j,
        pagu:       pagu,
        realisasi:  realisasi,
        sisa:       sisa,
        pct:        pagu > 0 ? Math.round((realisasi / pagu) * 1000) / 10 : 0,
        hasBaseline: !!baseRow,
        baselinePeriode: baseRow ? String(baseRow['Periode'] || '') : '',
        hargaAcuan: info.hargaAcuan,
        tunggakan:  info.tunggakan,
        warning:    warning
      };
    });

    // ── Personil (sum dalam rentang filter — bukan akumulasi tahunan) ──
    var psMeta = { jenis: 'PERSONIL', sheet: SHEET_TX.LOGISTIK_PERSONIL };
    var personil = getOpsiList(OPSI_KODE.KOM_PERSONIL).map(function (k) {
      var total = 0;
      sheetToObjects(openTransaksiSheet(psMeta.sheet)).forEach(function (r) {
        if (String(r['Status']) !== ROW_STATUS.ACTIVE) return;
        if (String(r['Komponen'] || '') !== k) return;
        if (!isInRange(new Date(r['Timestamp']), range)) return;
        total += _logNum(r['Nilai_Minggu']);
      });
      return { komponen: k, total: total };
    });
    var totalPersonil = personil.reduce(function (s, x) { return s + x.total; }, 0);

    return {
      success: true,
      data: {
        amunisi:  amunisi,
        bbm:      bbm,
        personil: personil,
        totalStokAkhir:   amunisi.reduce(function (s, x) { return s + x.stokAkhir; }, 0),
        totalBBMRealisasi: bbm.reduce(function (s, x) { return s + x.realisasi; }, 0),
        totalBBMSisa:      bbm.reduce(function (s, x) { return s + x.sisa; }, 0),
        totalPersonil:     totalPersonil
      }
    };
  } catch (e) {
    Logger.log('[logistik_getKPI] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── HISTORY ───────────────────────────────────────────────

function logistik_getAmunisi(token, filter)  { return _logHistory('AMUNISI',  token, filter); }
function logistik_getBBM(token, filter)      { return _logHistory('BBM',      token, filter); }
function logistik_getPersonil(token, filter) { return _logHistory('PERSONIL', token, filter); }

function _logHistory(jenis, token, filter) {
  try {
    var session = _logRequireSession(token);
    _logAssertRead(session);
    var meta = _logJenisMeta(jenis);

    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    var rows = sheetToObjects(openTransaksiSheet(meta.sheet));
    var data = rows
      .filter(function (r) { return isInRange(new Date(r['Timestamp']), range); })
      .sort(function (a, b) { return new Date(b['Timestamp']) - new Date(a['Timestamp']); })
      .map(function (r) {
        var base = _logStd(r);
        var mode = _logIsBaselineRow(meta, r) ? LOG_MODE_BASELINE : LOG_MODE_USAGE;
        if (jenis === 'AMUNISI') {
          base.jenis       = String(r['JenisAmunisi'] || '');
          base.mode        = mode;
          base.stokAwal    = mode === LOG_MODE_BASELINE ? _logNum(r['StokAwal']) : '';
          base.penggunaan  = mode === LOG_MODE_USAGE ? _logNum(r['Penggunaan_Minggu']) : '';
        } else if (jenis === 'BBM') {
          base.jenis       = String(r['Jenis'] || '');
          base.mode        = mode;
          base.pagu        = mode === LOG_MODE_BASELINE ? _logNum(r['Pagu']) : '';
          base.realisasi   = mode === LOG_MODE_USAGE ? _logNum(r['Realisasi_Minggu']) : '';
          base.hargaAcuan  = String(r['HargaAcuan'] || '');
          base.tunggakan   = String(r['Tunggakan_Status'] || '');
        } else {
          base.komponen    = String(r['Komponen'] || '');
          base.nilai       = _logNum(r['Nilai_Minggu']);
        }
        return base;
      });

    return { success: true, data: data };
  } catch (e) {
    Logger.log('[_logHistory:' + jenis + '] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── SUBMIT ────────────────────────────────────────────────

function logistik_submitAmunisi(token, params)  { return _logSubmit('AMUNISI',  token, params); }
function logistik_submitBBM(token, params)      { return _logSubmit('BBM',      token, params); }
function logistik_submitPersonil(token, params) { return _logSubmit('PERSONIL', token, params); }

function _logSubmit(jenis, token, params) {
  try {
    return withLock(function () {
      var session = _logRequireSession(token);
      _logAssertWrite(session);
      var meta = _logJenisMeta(jenis);
      var p = params || {};

      var periode = String(p.periode || getCurrentPeriode()).trim();
      if (!parsePeriode(periode)) return { success: false, error: 'Periode tidak valid.' };
      var pr = parsePeriode(periode);

      var built = _logBuildPayload(jenis, p, periode, pr, null);
      if (built.error) return { success: false, error: built.error };

      var sheet = openTransaksiSheet(meta.sheet);
      if (built.dupCheck) {
        var dup = sheetToObjects(sheet).some(built.dupCheck);
        if (dup) return { success: false, error: built.dupMessage };
      }

      var rowId = meta.prefix + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
      var row = _logStdRow(periode, session.userId);
      row['RowID'] = rowId;
      Object.keys(built.payload).forEach(function (k) { row[k] = built.payload[k]; });
      appendRowData(sheet, row);
      _logAuditLog(session.userId, 'CREATE', meta.sheet, rowId, 'Submit ' + meta.label + '(' + periode + ')');

      var res = { success: true, data: { rowId: rowId, message: 'Laporan ' + meta.label + ' tersimpan.', warnings: built.warnings || [] } };
      return res;
    });
  } catch (e) {
    Logger.log('[_logSubmit:' + jenis + '] ' + e.message);
    return { success: false, error: e.message };
  }
}

/** Racik isi baris + aturan duplikasi untuk submit & revisi. */
function _logBuildPayload(jenis, p, periode, pr, oldRow) {
  var isRevision = !!oldRow;
  var warnings = [];

  if (jenis === 'AMUNISI') {
    var jenisAm = String(p.jenis || '').toUpperCase();
    if (getOpsiList(OPSI_KODE.AMUNISI).indexOf(jenisAm) === -1) return { error: 'Jenis amunisi tidak valid.' };
    var mode = isRevision
      ? (_logIsBaselineRow({ jenis: 'AMUNISI' }, oldRow) ? LOG_MODE_BASELINE : LOG_MODE_USAGE)
      : (p.mode === LOG_MODE_BASELINE ? LOG_MODE_BASELINE : LOG_MODE_USAGE);

    if (mode === LOG_MODE_BASELINE) {
      var stokAwal = (isRevision ? _logProvided(p.stokAwal, oldRow['StokAwal']) : _logNum(p.stokAwal));
      if (isNaN(stokAwal) || stokAwal < 0) return { error: 'StokAwal wajib berupa angka ≥ 0.' };
      return {
        dupCheck: function (r) {
          if (String(r['Status']) !== ROW_STATUS.ACTIVE) return false;
          if (String(r['JenisAmunisi'] || '') !== jenisAm) return false;
          if (!_logIsBaselineRow({ jenis: 'AMUNISI' }, r)) return false;
          var pp = parsePeriode(String(r['Periode'] || ''));
          return pp && pp.year === pr.year;
        },
        dupMessage: 'Baseline ' + jenisAm + ' tahun ' + pr.year + ' sudah ada. Gunakan Revisi untuk mengubah StokAwal.',
        payload: { 'JenisAmunisi': jenisAm, 'StokAwal': stokAwal, 'Penggunaan_Minggu': 0 }
      };
    }

    var penggunaan = (isRevision ? _logProvided(p.penggunaan, oldRow['Penggunaan_Minggu']) : _logNum(p.penggunaan));
    if (isNaN(penggunaan) || penggunaan < 0) return { error: 'Penggunaan wajib berupa angka ≥ 0.' };

    var base = _logCurrentBaseline({ jenis: 'AMUNISI' }, jenisAm, pr.year);
    var baseStok = base ? _logNum(base['StokAwal']) : 0;
    if (!base) warnings.push('StokAwal ' + jenisAm + ' tahun ' + pr.year + ' belum diinisialisasi.');
    var cum = _logCumulative({ jenis: 'AMUNISI' }, jenisAm, pr.year, new Date());
    var predicted = baseStok - cum - penggunaan;
    if (predicted < 0) warnings.push('Stok akhir diperkirakan negatif (−' + Math.abs(predicted) + '). Periksa kembali angka penggunaan.');

    return {
      dupCheck: function (r) {
        if (String(r['Status']) !== ROW_STATUS.ACTIVE) return false;
        if (String(r['JenisAmunisi'] || '') !== jenisAm) return false;
        if (_logIsBaselineRow({ jenis: 'AMUNISI' }, r)) return false;
        return String(r['Periode'] || '') === periode;
      },
      dupMessage: 'Penggunaan amunisi ' + jenisAm + ' periode ' + periode + ' sudah ada. Gunakan Revisi.',
      payload: { 'JenisAmunisi': jenisAm, 'StokAwal': '', 'Penggunaan_Minggu': penggunaan },
      warnings: warnings
    };
  }

  if (jenis === 'BBM') {
    var jenisBb = String(p.jenis || '').toUpperCase();
    if (getOpsiList(OPSI_KODE.BBM).indexOf(jenisBb) === -1) return { error: 'Jenis BBM tidak valid.' };
    var modeB = isRevision
      ? (_logIsBaselineRow({ jenis: 'BBM' }, oldRow) ? LOG_MODE_BASELINE : LOG_MODE_USAGE)
      : (p.mode === LOG_MODE_BASELINE ? LOG_MODE_BASELINE : LOG_MODE_USAGE);

    if (modeB === LOG_MODE_BASELINE) {
      var pagu = (isRevision ? _logProvided(p.pagu, oldRow['Pagu']) : _logNum(p.pagu));
      if (isNaN(pagu) || pagu < 0) return { error: 'Pagu wajib berupa angka ≥ 0.' };
      return {
        dupCheck: function (r) {
          if (String(r['Status']) !== ROW_STATUS.ACTIVE) return false;
          if (String(r['Jenis'] || '') !== jenisBb) return false;
          if (!_logIsBaselineRow({ jenis: 'BBM' }, r)) return false;
          var pp = parsePeriode(String(r['Periode'] || ''));
          return pp && pp.year === pr.year;
        },
        dupMessage: 'Baseline ' + jenisBb + ' tahun ' + pr.year + ' sudah ada. Gunakan Revisi untuk mengubah Pagu.',
        payload: { 'Jenis': jenisBb, 'Pagu': pagu, 'Realisasi_Minggu': 0, 'HargaAcuan': '', 'Tunggakan_Status': '' }
      };
    }

    var realisasi = (isRevision ? _logProvided(p.realisasi, oldRow['Realisasi_Minggu']) : _logNum(p.realisasi));
    if (isNaN(realisasi) || realisasi < 0) return { error: 'Realisasi wajib berupa angka ≥ 0.' };
    var harga = String(p.hargaAcuan || '').trim();
    var tunggakan = String(p.tunggakanStatus || '').trim();

    var baseBb = _logCurrentBaseline({ jenis: 'BBM' }, jenisBb, pr.year);
    if (!baseBb) warnings.push('Pagu ' + jenisBb + ' tahun ' + pr.year + ' belum diinisialisasi.');
    else if (realisasi > _logNum(baseBb['Pagu'])) warnings.push('Realisasi melebihi Pagu (Sisa negatif). Permintaan tetap disimpan.');

    return {
      dupCheck: function (r) {
        if (String(r['Status']) !== ROW_STATUS.ACTIVE) return false;
        if (String(r['Jenis'] || '') !== jenisBb) return false;
        if (_logIsBaselineRow({ jenis: 'BBM' }, r)) return false;
        return String(r['Periode'] || '') === periode;
      },
      dupMessage: 'Realisasi ' + jenisBb + ' periode ' + periode + ' sudah ada. Gunakan Revisi.',
      payload: { 'Jenis': jenisBb, 'Pagu': '', 'Realisasi_Minggu': realisasi, 'HargaAcuan': harga, 'Tunggakan_Status': tunggakan },
      warnings: warnings
    };
  }

  // PERSONIL
  var komponen = String(p.komponen || '').toUpperCase();
  if (getOpsiList(OPSI_KODE.KOM_PERSONIL).indexOf(komponen) === -1) return { error: 'Komponen logistik personil tidak valid.' };
  var nilai = (isRevision ? _logProvided(p.nilai, oldRow['Nilai_Minggu']) : _logNum(p.nilai));
  if (isNaN(nilai) || nilai < 0) return { error: 'Nilai wajib berupa angka ≥ 0.' };
  return {
    dupCheck: function (r) {
      if (String(r['Status']) !== ROW_STATUS.ACTIVE) return false;
      if (String(r['Komponen'] || '') !== komponen) return false;
      return String(r['Periode'] || '') === periode;
    },
    dupMessage: 'Komponen ' + komponen + ' periode ' + periode + ' sudah ada. Gunakan Revisi.',
    payload: { 'Komponen': komponen, 'Nilai_Minggu': nilai }
  };
}

// ── REVISI ────────────────────────────────────────────────

function logistik_revisiAmunisi(token, params)  { return _logRevisi('AMUNISI',  token, params); }
function logistik_revisiBBM(token, params)      { return _logRevisi('BBM',      token, params); }
function logistik_revisiPersonil(token, params) { return _logRevisi('PERSONIL', token, params); }

function _logRevisi(jenis, token, params) {
  try {
    return withLock(function () {
      var session = _logRequireSession(token);
      _logAssertWrite(session);
      var meta = _logJenisMeta(jenis);
      var p = params || {};

      var targetRowId  = String(p.targetRowId || '').trim();
      var alasanRevisi = String(p.alasanRevisi || '').trim();
      if (!targetRowId)  return { success: false, error: 'targetRowId wajib diisi.' };
      if (!alasanRevisi) return { success: false, error: 'Alasan revisi wajib diisi.' };

      var sheet = openTransaksiSheet(meta.sheet);
      var old = findRowById(sheet, targetRowId);
      if (!old || String(old.obj['Status']) !== ROW_STATUS.ACTIVE) {
        return { success: false, error: 'Baris tidak ditemukan atau bukan status ACTIVE.' };
      }

      var periode = String(old.obj['Periode'] || '');
      var pr = parsePeriode(periode);
      var built = _logBuildPayload(jenis, p, periode, pr, old.obj);
      if (built.error) return { success: false, error: built.error };

      var rowId = meta.prefix + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
      var row = _logStdRow(periode, session.userId);
      row['RowID'] = rowId;
      row['SupersedesRowID'] = targetRowId;
      Object.keys(built.payload).forEach(function (k) { row[k] = built.payload[k]; });

      appendRowData(sheet, row);
      updateRowCells(sheet, old.rowIndex, { 'Status': ROW_STATUS.SUPERSEDED });
      _logAuditLog(session.userId, 'UPDATE', meta.sheet, rowId, 'Revisi dari ' + targetRowId + ': ' + alasanRevisi);

      return { success: true, data: { rowId: rowId, message: 'Revisi ' + meta.label + ' berhasil disimpan.', warnings: built.warnings || [] } };
    });
  } catch (e) {
    Logger.log('[_logRevisi:' + jenis + '] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── ANULIR ────────────────────────────────────────────────

function logistik_anulir(token, params) {
  try {
    return withLock(function () {
      var session = _logRequireSession(token);
      _logAssertAnulir(session);
      var p = params || {};

      var jenis       = String(p.jenis || '').toUpperCase();
      var meta        = _logJenisMeta(jenis);
      var targetRowId = String(p.targetRowId || '').trim();
      var voidReason  = String(p.voidReason || '').trim();
      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!voidReason) {
        return {
          success: false,
          error: 'Komentar anulir wajib diisi. Pengunggah perlu tahu apa yang perlu diperbaiki sebelum mengunggah laporan baru.'
        };
      }

      var sheet  = openTransaksiSheet(meta.sheet);
      var target = findRowById(sheet, targetRowId);
      if (!target) return { success: false, error: 'Baris tidak ditemukan.' };
      if (String(target.obj['Status']) === ROW_STATUS.VOID) return { success: false, error: 'Baris sudah dalam status VOID.' };
      if (String(target.obj['Status']) === ROW_STATUS.SUPERSEDED) {
        return { success: false, error: 'Baris SUPERSEDED tidak dapat dianulir langsung — anulir baris ACTIVE-nya.' };
      }

      updateRowCells(sheet, target.rowIndex, {
        'Status':     ROW_STATUS.VOID,
        'VoidReason': voidReason,
        'VoidedBy':   session.userId,
        'VoidedAt':   new Date()
      });
      _logAuditLog(session.userId, 'VOID', meta.sheet, targetRowId, voidReason);

      var publisherId = String(target.obj['SubmittedBy'] || '');
      if (publisherId && publisherId !== session.userId) {
        _logNotifyVoid(publisherId, meta.label, String(target.obj['Periode'] || ''), voidReason);
      }

      return { success: true, data: { message: 'Laporan ' + meta.label + ' berhasil dianulir. Komentar terlihat oleh seluruh anggota divisi.' } };
    });
  } catch (e) {
    Logger.log('[logistik_anulir] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── TREN ──────────────────────────────────────────────────

function logistik_getTren(token, filter) {
  try {
    var session = _logRequireSession(token);
    _logAssertRead(session);

    var months = utils_getTrendMonths(filter);
    var idx = {};
    months.forEach(function (m, i) { idx[m] = i; });

    function sumByMonth(sheetName, jenisCol, jenisVal, valCol) {
      var arr = [];
      for (var i = 0; i < months.length; i++) arr.push(0);
      sheetToObjects(openTransaksiSheet(sheetName)).forEach(function (r) {
        if (String(r['Status']) !== ROW_STATUS.ACTIVE) return;
        if (jenisCol && String(r[jenisCol] || '') !== jenisVal) return;
        var mm = String(r['Periode'] || '').substring(0, 7);
        if (idx[mm] === undefined) return;
        arr[idx[mm]] += _logNum(r[valCol]);
      });
      return arr;
    }

    var amunisi = {};
    getOpsiList(OPSI_KODE.AMUNISI).forEach(function (j) {
      amunisi[j] = sumByMonth(SHEET_TX.LOGISTIK_AMUNISI, 'JenisAmunisi', j, 'Penggunaan_Minggu');
    });
    var bbm = {};
    getOpsiList(OPSI_KODE.BBM).forEach(function (j) {
      bbm[j] = sumByMonth(SHEET_TX.LOGISTIK_BBM, 'Jenis', j, 'Realisasi_Minggu');
    });
    var personil = {};
    getOpsiList(OPSI_KODE.KOM_PERSONIL).forEach(function (k) {
      personil[k] = sumByMonth(SHEET_TX.LOGISTIK_PERSONIL, 'Komponen', k, 'Nilai_Minggu');
    });

    return { success: true, data: { months: months, amunisi: amunisi, bbm: bbm, personil: personil } };
  } catch (e) {
    Logger.log('[logistik_getTren] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── HELPERS ───────────────────────────────────────────────

function _logStdRow(periode, userId) {
  return {
    'RowID':           '',
    'DivisiID':        _logDivisiId(),
    'Periode':         periode,
    'SubmittedBy':     userId,
    'Timestamp':       new Date(),
    'Status':          ROW_STATUS.ACTIVE,
    'SupersedesRowID': '',
    'VoidReason':      '',
    'VoidedBy':        '',
    'VoidedAt':        ''
  };
}

function _logStd(r) {
  return {
    rowId:           String(r['RowID'] || ''),
    periode:         String(r['Periode'] || ''),
    submittedBy:     String(r['SubmittedBy'] || ''),
    timestamp:       r['Timestamp'] ? new Date(r['Timestamp']).toISOString() : null,
    status:          String(r['Status'] || ''),
    supersedesRowId: String(r['SupersedesRowID'] || ''),
    voidReason:      String(r['VoidReason'] || ''),
    voidedBy:        String(r['VoidedBy'] || ''),
    voidedAt:        r['VoidedAt'] ? new Date(r['VoidedAt']).toISOString() : null
  };
}

function _logNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  var n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/** Pada revisi: ambil nilai dari request jika terisi, else nilai baris lama. */
function _logProvided(v, oldVal) {
  if (v === null || v === undefined || String(v).trim() === '') {
    return oldVal === '' || oldVal === null || oldVal === undefined ? NaN : _logNum(oldVal);
  }
  return _logNum(v);
}

function _logAuditLog(userId, aksi, sheetTarget, rowId, alasan) {
  try {
    appendRowData(openLogSheet(SHEET_LOG.AUDIT_LOG), {
      'LogID':       'LOG-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
      'UserID':      userId,
      'Aksi':        aksi,
      'SheetTarget': sheetTarget,
      'RowIDTarget': rowId,
      'Alasan':      alasan,
      'Timestamp':   new Date()
    });
  } catch (e) { Logger.log('[_logAuditLog] ' + e.message); }
}

function _logNotifyVoid(toUserId, label, periode, voidReason) {
  try {
    appendRowData(openLogSheet(SHEET_LOG.NOTIFICATIONS), {
      'NotifID':  'NTF-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
      'UserID':   toUserId,
      'Jenis':    'DATA_VOIDED',
      'Pesan':    'Laporan Logistik (' + label + ') periode ' + periode + ' telah dianulir. ' +
                  'Alasan: ' + voidReason + ' — Segera buat laporan baru setelah perbaikan.',
      'IsRead':   false,
      'CreatedAt': new Date()
    });
  } catch (e) { Logger.log('[_logNotifyVoid] ' + e.message); }
}