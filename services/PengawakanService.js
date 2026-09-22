/**
 * services/PengawakanService.js
 * Modul Pengawakan (Fase 10) — DIV-AWAK. Dua sub-modul independen:
 *   AKN      → TX_Pengawakan_AKN      (Scope + Kategori + Jumlah)
 *   Kegiatan → TX_Pengawakan_Kegiatan (Judul, tanggal mulai-selesai, wilayah,
 *              jumlah peserta, deskripsi)
 *
 * Fungsi publik (google.script.run):
 *   awak_getOptions, awak_getKPI, awak_getAKN, awak_getKegiatan,
 *   awak_submitAKN, awak_submitKegiatan, awak_revisiAKN, awak_revisiKegiatan,
 *   awak_anulir, awak_getTren
 *
 * Keputusan pemodelan (konfirmasi user, tercatat di CHANGELOG):
 *   - `Jumlah` AKN = SNAPSHOT TOTAL komposisi (bukan delta). Saat ada
 *     mutasi/rekrutmen, pengguna menginput total terbaru per (Scope, Kategori).
 *   - Komposisi AKN tahun = baris ACTIVE terbaru per (Scope, Kategori) pada
 *     tahun referensi filter (di-reset tiap tahun).
 *   - Tren AKN per bulan memakai carry-forward: nilai terakhir pada bulan itu
 *     (row ber-Periode ≤ bulan tsb), menggambarkan komposisi berjalan.
 */

// ── PEMETAAN JENIS ────────────────────────────────────────

function _awakDivisiId() { return DIVISI_ID.AWAK; }

function _awakJenisMeta(jenis) {
  var j = String(jenis || '').toUpperCase();
  if (j === 'AKN')      return { sheet: SHEET_TX.PENGAWAKAN_AKN,      prefix: 'AWKA', label: 'Komposisi AKN' };
  if (j === 'KEGIATAN') return { sheet: SHEET_TX.PENGAWAKAN_KEGIATAN, prefix: 'AWKK', label: 'Kegiatan Personel' };
  throw new Error('Jenis Pengawakan tidak dikenal: ' + jenis);
}

// ── RBAC ──────────────────────────────────────────────────

function _awakRequireSession(token) {
  var session = _getSession(token);
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau belum disetujui.');
  }
  return session;
}

function _awakAssertRead(session) {
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Akun belum aktif.');
  }
}

function _awakAssertWrite(session) {
  assertScope(session, [ROLE.SUPERADMIN, ROLE.KADIV, ROLE.STAF], _awakDivisiId());
}

function _awakAssertAnulir(session) {
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Akun belum aktif.');
  }
  if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) return;
  if (session.role === ROLE.KADIV && session.divisiId === _awakDivisiId()) return;
  throw new Error('FORBIDDEN: Hanya SUPERADMIN, DIREKTUR, atau KADIV DIV-AWAK yang dapat menganulir.');
}

// ── OPTIONS ───────────────────────────────────────────────

function awak_getOptions(token) {
  try {
    var session = _awakRequireSession(token);
    _awakAssertRead(session);
    return { success: true, data: { scopes: AWAK_SCOPE, kategori: getOpsiList(OPSI_KODE.AWAK_KATEGORI) } };
  } catch (e) {
    Logger.log('[awak_getOptions] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── KPI ───────────────────────────────────────────────────

/** Komposisi AKN per (Scope, Kategori) = baris ACTIVE terbaru per tahun. */
function _awakKomposisiTahun(tahunRef) {
  var latest = {}; // 'scope|kategori' → row
  var all = sheetToObjects(openTransaksiSheet(SHEET_TX.PENGAWAKAN_AKN)).filter(function (r) {
    if (String(r['Status']) !== ROW_STATUS.ACTIVE) return false;
    var p = parsePeriode(String(r['Periode'] || ''));
    return p && p.year === tahunRef;
  });
  all.forEach(function (r) {
    var key = String(r['Scope'] || '') + '|' + String(r['Kategori'] || '');
    var prev = latest[key];
    if (!prev || new Date(r['Timestamp']) > new Date(prev['Timestamp'])) latest[key] = r;
  });
  return latest;
}

function awak_getKPI(token, filter) {
  try {
    var session = _awakRequireSession(token);
    _awakAssertRead(session);

    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    var f = filter || {};
    var tahunRef = (f.mode === 'range' && f.dateTo)
      ? new Date(f.dateTo).getFullYear()
      : (f.year || new Date().getFullYear());

    // ── AKN (komposisi tahun berjalan) ──
    var latest = _awakKomposisiTahun(tahunRef);
    var perKategori = {};
    getOpsiList(OPSI_KODE.AWAK_KATEGORI).forEach(function (k) { perKategori[k] = { keseluruhan: 0, poa: 0 }; });
    var rows = [];
    AWAK_SCOPE.forEach(function (scope) {
      getOpsiList(OPSI_KODE.AWAK_KATEGORI).forEach(function (kat) {
        var r = latest[scope + '|' + kat];
        var jml = r ? _awakNum(r['Jumlah']) : 0;
        if (scope === 'KESELURUHAN') perKategori[kat].keseluruhan = jml;
        else perKategori[kat].poa = jml;
        if (r) {
          rows.push({
            rowId:      String(r['RowID'] || ''),
            scope:      scope,
            kategori:   kat,
            jumlah:     jml,
            periode:    String(r['Periode'] || ''),
            timestamp:  r['Timestamp'] ? new Date(r['Timestamp']).toISOString() : null
          });
        }
      });
    });
    var totalKeseluruhan = getOpsiList(OPSI_KODE.AWAK_KATEGORI).reduce(function (s, k) { return s + perKategori[k].keseluruhan; }, 0);
    var totalPoa = getOpsiList(OPSI_KODE.AWAK_KATEGORI).reduce(function (s, k) { return s + perKategori[k].poa; }, 0);

    // ── Kegiatan (dalam rentang filter) ──
    var kegiatanCount = 0, kegiatanPeserta = 0;
    sheetToObjects(openTransaksiSheet(SHEET_TX.PENGAWAKAN_KEGIATAN)).forEach(function (r) {
      if (String(r['Status']) !== ROW_STATUS.ACTIVE) return;
      if (!isInRange(new Date(r['Timestamp']), range)) return;
      kegiatanCount++;
      kegiatanPeserta += _awakNum(r['JumlahPeserta']);
    });

    return {
      success: true,
      data: {
        akn: {
          totalKeseluruhan: totalKeseluruhan,
          totalPoa:         totalPoa,
          total:            totalKeseluruhan + totalPoa,
          perKategori:      perKategori,
          rows:             rows
        },
        kegiatan: { count: kegiatanCount, totalPeserta: kegiatanPeserta }
      }
    };
  } catch (e) {
    Logger.log('[awak_getKPI] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── HISTORY ───────────────────────────────────────────────

function awak_getAKN(token, filter)      { return _awakHistory('AKN',      token, filter); }
function awak_getKegiatan(token, filter) { return _awakHistory('KEGIATAN', token, filter); }

function _awakHistory(jenis, token, filter) {
  try {
    var session = _awakRequireSession(token);
    _awakAssertRead(session);
    var meta = _awakJenisMeta(jenis);

    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    var rows = sheetToObjects(openTransaksiSheet(meta.sheet))
      .filter(function (r) { return isInRange(new Date(r['Timestamp']), range); });

    var data = rows.map(function (r) {
      var base = _awakStd(r);
      if (jenis === 'AKN') {
        base.scope     = String(r['Scope'] || '');
        base.kategori  = String(r['Kategori'] || '');
        base.jumlah    = _awakNum(r['Jumlah']);
      } else {
        base.judul        = String(r['JudulKegiatan'] || '');
        base.tanggalMulai   = r['TanggalMulai']   ? new Date(r['TanggalMulai']).toISOString()  : null;
        base.tanggalSelesai  = r['TanggalSelesai']  ? new Date(r['TanggalSelesai']).toISOString() : null;
        base.wilayah        = String(r['Wilayah'] || '');
        base.jumlahPeserta  = _awakNum(r['JumlahPeserta']);
        base.deskripsi      = String(r['Deskripsi'] || '');
      }
      return base;
    });

    if (jenis === 'KEGIATAN') {
      data.sort(function (a, b) {
        var ta = a.tanggalMulai ? new Date(a.tanggalMulai).getTime() : 0;
        var tb = b.tanggalMulai ? new Date(b.tanggalMulai).getTime() : 0;
        return tb - ta;
      });
    } else {
      data.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
    }

    return { success: true, data: data };
  } catch (e) {
    Logger.log('[_awakHistory:' + jenis + '] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── SUBMIT ────────────────────────────────────────────────

function awak_submitAKN(token, params)      { return _awakSubmit('AKN',      token, params); }
function awak_submitKegiatan(token, params) { return _awakSubmit('KEGIATAN', token, params); }

function _awakSubmit(jenis, token, params) {
  try {
    return withLock(function () {
      var session = _awakRequireSession(token);
      _awakAssertWrite(session);
      var meta = _awakJenisMeta(jenis);
      var p = params || {};

      var periode = String(p.periode || getCurrentPeriode()).trim();
      if (!parsePeriode(periode)) return { success: false, error: 'Periode tidak valid.' };

      var built = _awakBuildPayload(jenis, p, periode, null);
      if (built.error) return { success: false, error: built.error };

      var sheet = openTransaksiSheet(meta.sheet);
      if (built.dupCheck) {
        var dup = sheetToObjects(sheet).some(built.dupCheck);
        if (dup) return { success: false, error: built.dupMessage };
      }

      var rowId = meta.prefix + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
      var row = _awakStdRow(periode, session.userId);
      row['RowID'] = rowId;
      Object.keys(built.payload).forEach(function (k) { row[k] = built.payload[k]; });
      appendRowData(sheet, row);
      _awakAuditLog(session.userId, 'CREATE', meta.sheet, rowId, 'Submit ' + meta.label + '(' + periode + ')');

      return { success: true, data: { rowId: rowId, message: 'Laporan ' + meta.label + ' tersimpan.' } };
    });
  } catch (e) {
    Logger.log('[_awakSubmit:' + jenis + '] ' + e.message);
    return { success: false, error: e.message };
  }
}

function _awakBuildPayload(jenis, p, periode, oldRow) {
  var isRevision = !!oldRow;

  if (jenis === 'AKN') {
    var scope = String(p.scope || '').toUpperCase();
    var kategori = String(p.kategori || '').toUpperCase();
    if (AWAK_SCOPE.indexOf(scope) === -1) return { error: 'Scope AKN tidak valid.' };
    if (getOpsiList(OPSI_KODE.AWAK_KATEGORI).indexOf(kategori) === -1) return { error: 'Kategori personil tidak valid.' };
    var jumlah = (isRevision ? _awakProvided(p.jumlah, oldRow['Jumlah']) : _awakNum(p.jumlah));
    if (isNaN(jumlah) || jumlah < 0) return { error: 'Jumlah wajib berupa angka ≥ 0.' };
    return {
      dupCheck: function (r) {
        if (String(r['Status']) !== ROW_STATUS.ACTIVE) return false;
        return String(r['Scope'] || '') === scope &&
               String(r['Kategori'] || '') === kategori &&
               String(r['Periode'] || '') === periode;
      },
      dupMessage: 'Komposisi ' + scope + ' / ' + kategori + ' periode ' + periode + ' sudah ada. Gunakan Revisi.',
      payload: { 'Scope': scope, 'Kategori': kategori, 'Jumlah': jumlah }
    };
  }

  // KEGIATAN
  var judul = String(p.judul || '').trim();
  if (!judul) return { error: 'Judul kegiatan wajib diisi.' };

  var tglMulai;
  if (isRevision) {
    tglMulai = String(p.tanggalMulai || '').trim() ||
               (oldRow['TanggalMulai'] ? _awakDateStr(oldRow['TanggalMulai']) : '');
  } else {
    tglMulai = String(p.tanggalMulai || '').trim();
  }
  if (!tglMulai) return { error: 'Tanggal mulai wajib diisi.' };
  var mDate = new Date(tglMulai);
  if (isNaN(mDate.getTime())) return { error: 'Tanggal mulai tidak valid.' };

  var tglSelesai = String(p.tanggalSelesai || '').trim();
  var sDate = tglSelesai ? new Date(tglSelesai) : mDate;
  if (isNaN(sDate.getTime())) return { error: 'Tanggal selesai tidak valid.' };
  if (sDate < mDate) return { error: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' };

  var peserta = (isRevision ? _awakProvided(p.jumlahPeserta, oldRow['JumlahPeserta']) : _awakNum(p.jumlahPeserta));
  if (isNaN(peserta) || peserta < 0) return { error: 'Jumlah peserta wajib berupa angka ≥ 0 (boleh kosong).' };

  return {
    payload: {
      'JudulKegiatan': judul,
      'TanggalMulai':  mDate,
      'TanggalSelesai': sDate,
      'Wilayah':       String(p.wilayah || '').trim(),
      'JumlahPeserta': peserta,
      'Deskripsi':     String(p.deskripsi || '').trim()
    }
  };
}

// ── REVISI ────────────────────────────────────────────────

function awak_revisiAKN(token, params)      { return _awakRevisi('AKN',      token, params); }
function awak_revisiKegiatan(token, params) { return _awakRevisi('KEGIATAN', token, params); }

function _awakRevisi(jenis, token, params) {
  try {
    return withLock(function () {
      var session = _awakRequireSession(token);
      _awakAssertWrite(session);
      var meta = _awakJenisMeta(jenis);
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
      var built = _awakBuildPayload(jenis, p, periode, old.obj);
      if (built.error) return { success: false, error: built.error };

      var rowId = meta.prefix + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
      var row = _awakStdRow(periode, session.userId);
      row['RowID'] = rowId;
      row['SupersedesRowID'] = targetRowId;
      Object.keys(built.payload).forEach(function (k) { row[k] = built.payload[k]; });

      appendRowData(sheet, row);
      updateRowCells(sheet, old.rowIndex, { 'Status': ROW_STATUS.SUPERSEDED });
      _awakAuditLog(session.userId, 'UPDATE', meta.sheet, rowId, 'Revisi dari ' + targetRowId + ': ' + alasanRevisi);

      return { success: true, data: { rowId: rowId, message: 'Revisi ' + meta.label + ' berhasil disimpan.' } };
    });
  } catch (e) {
    Logger.log('[_awakRevisi:' + jenis + '] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── ANULIR ────────────────────────────────────────────────

function awak_anulir(token, params) {
  try {
    return withLock(function () {
      var session = _awakRequireSession(token);
      _awakAssertAnulir(session);
      var p = params || {};

      var jenis       = String(p.jenis || '').toUpperCase();
      var meta        = _awakJenisMeta(jenis);
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
      _awakAuditLog(session.userId, 'VOID', meta.sheet, targetRowId, voidReason);

      var publisherId = String(target.obj['SubmittedBy'] || '');
      if (publisherId && publisherId !== session.userId) {
        _awakNotifyVoid(publisherId, meta.label, String(target.obj['Periode'] || ''), voidReason);
      }

      return { success: true, data: { message: 'Laporan ' + meta.label + ' berhasil dianulir. Komentar terlihat oleh seluruh anggota divisi.' } };
    });
  } catch (e) {
    Logger.log('[awak_anulir] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── TREN ──────────────────────────────────────────────────

function awak_getTren(token, filter) {
  try {
    var session = _awakRequireSession(token);
    _awakAssertRead(session);

    var months = utils_getTrendMonths(filter);
    var idx = {};
    months.forEach(function (m, i) { idx[m] = i; });
    var trendYear = parseInt(months[0], 10);

    // AKN — carry-forward per bulan (row ber-Periode <= bulan)
    var rows = sheetToObjects(openTransaksiSheet(SHEET_TX.PENGAWAKAN_AKN)).filter(function (r) {
      if (String(r['Status']) !== ROW_STATUS.ACTIVE) return false;
      var p = parsePeriode(String(r['Periode'] || ''));
      return p && p.year === trendYear;
    });
    function aknSeries(scope) {
      var out = [];
      for (var i = 0; i < months.length; i++) out.push(0);
      getOpsiList(OPSI_KODE.AWAK_KATEGORI).forEach(function (kat) {
        var prev = null;
        rows.forEach(function (r) {
          if (String(r['Scope']) !== scope) return;
          if (String(r['Kategori']) !== kat) return;
          var p = parsePeriode(String(r['Periode']));
          prev = (prev && new Date(prev['Timestamp']) > new Date(r['Timestamp'])) ? prev : r;
        });
        // prev = latest ACTIVE row utk (scope, kategori) — pakai nilainya mulai bulan Periode-nya s.d akhir
        if (prev) {
          var pp = parsePeriode(String(prev['Periode']));
          var startIdx = idx[pp.year + '-' + ('0' + pp.month).slice(-2)];
          if (startIdx === undefined) startIdx = 0;
          var val = _awakNum(prev['Jumlah']);
          for (var j = startIdx; j < months.length; j++) out[j] += val;
        }
      });
      return out;
    }

    var keseluruhan = aknSeries('KESELURUHAN');
    var poa = aknSeries('POA');

    // Kegiatan — count & peserta per bulan
    var kegiatanCount = [], kegiatanPeserta = [];
    for (var i = 0; i < months.length; i++) { kegiatanCount.push(0); kegiatanPeserta.push(0); }
    sheetToObjects(openTransaksiSheet(SHEET_TX.PENGAWAKAN_KEGIATAN)).forEach(function (r) {
      if (String(r['Status']) !== ROW_STATUS.ACTIVE) return;
      var mm = String(r['Periode'] || '').substring(0, 7);
      if (idx[mm] === undefined) return;
      kegiatanCount[idx[mm]]++;
      kegiatanPeserta[idx[mm]] += _awakNum(r['JumlahPeserta']);
    });

    return {
      success: true,
      data: {
        months: months,
        aknKeseluruhan: keseluruhan,
        aknPoa: poa,
        kegiatanCount: kegiatanCount,
        kegiatanPeserta: kegiatanPeserta
      }
    };
  } catch (e) {
    Logger.log('[awak_getTren] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── HELPERS ───────────────────────────────────────────────

function _awakStdRow(periode, userId) {
  return {
    'RowID':           '',
    'DivisiID':        _awakDivisiId(),
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

function _awakStd(r) {
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

function _awakNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  var n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function _awakProvided(v, oldVal) {
  if (v === null || v === undefined || String(v).trim() === '') {
    return (oldVal === '' || oldVal === null || oldVal === undefined) ? NaN : _awakNum(oldVal);
  }
  return _awakNum(v);
}

function _awakDateStr(d) {
  var dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  var m = ('0' + (dt.getMonth() + 1)).slice(-2);
  var day = ('0' + dt.getDate()).slice(-2);
  return dt.getFullYear() + '-' + m + '-' + day;
}

function _awakAuditLog(userId, aksi, sheetTarget, rowId, alasan) {
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
  } catch (e) { Logger.log('[_awakAuditLog] ' + e.message); }
}

function _awakNotifyVoid(toUserId, label, periode, voidReason) {
  try {
    appendRowData(openLogSheet(SHEET_LOG.NOTIFICATIONS), {
      'NotifID':  'NTF-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
      'UserID':   toUserId,
      'Jenis':    'DATA_VOIDED',
      'Pesan':    'Laporan Pengawakan (' + label + ') periode ' + periode + ' telah dianulir. ' +
                  'Alasan: ' + voidReason + ' — Segera buat laporan baru setelah perbaikan.',
      'IsRead':   false,
      'CreatedAt': new Date()
    });
  } catch (e) { Logger.log('[_awakNotifyVoid] ' + e.message); }
}