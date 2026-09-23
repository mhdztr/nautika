/**
 * services/KegiatanDirektoratService.js
 * Service backend modul Kegiatan Pendukung — PRD §5.10.
 *
 * Bukan milik satu divisi: log kegiatan lintas-direktorat (pre-award meeting,
 * monitoring ABT, serah terima, dst). CRUD oleh Direktur + semua Kepala Divisi
 * (lintas divisi, tidak dibatasi scope). Staf tidak memiliki akses modul ini.
 *
 * Data: TX_KegiatanDirektorat (DATA_SCHEMA.md) — kolom standar +
 *   JudulKegiatan  text
 *   Tanggal        date   (tanggal pelaksanaan — basis filter & Periode)
 *   Deskripsi      text
 *   PihakHadir     text, nullable
 *
 * Periode diturunkan dari Tanggal kegiatan (dateToPeriode), bukan minggu
 * berjalan — karena entri adalah feed kronologis, bukan laporan mingguan.
 * Filter global (bulanan/rentang) menyaring kolom Tanggal.
 */

// ===========================================================================
// RBAC — PRD §5.10: Direktur + semua Kepala Divisi, lintas divisi.
// (Konstanta dibaca di dalam fungsi, bukan saat load file — urutan load file
// di GAS belum menjamin utils/* termuat lebih dulu.)
// ===========================================================================

function _kgdRoles() {
  return [ROLE.SUPERADMIN, ROLE.DIREKTUR, ROLE.KADIV];
}

function _kgdSession(token) {
  var session = _getSession(token);
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau belum disetujui.');
  }
  return session;
}

function _kgdAssert(session) {
  assertScope(session, _kgdRoles(), null);
}

function _kgdAuditLog(userId, aksi, rowIdTarget, alasan) {
  try {
    appendRowData(openLogSheet(SHEET_LOG.AUDIT_LOG), {
      'LogID':       'LOG-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
      'UserID':      userId,
      'Aksi':        aksi,
      'SheetTarget': SHEET_TX.KEGIATAN_DIREKTORAT,
      'RowIDTarget': rowIdTarget,
      'Alasan':      alasan,
      'Timestamp':   new Date()
    });
  } catch (e) { /* audit tidak boleh membatalkan aksi utama */ }
}

// Map DivisiID → NamaDivisi, untuk menampilkan asal pengunggah di feed.
function _kgdDivisiMap() {
  var map = {};
  try {
    sheetToObjects(openMasterSheet(SHEET_MASTER.DIVISI)).forEach(function (row) {
      map[String(row['DivisiID'])] = String(row['NamaDashboard'] || row['NamaResmi'] || '');
    });
  } catch (e) { /* master tak terbaca → lookup kosong */ }
  return map;
}

// ===========================================================================
// READ ENDPOINTS
// ===========================================================================

/**
 * KPI Kegiatan Pendukung untuk rentang filter.
 * Kegiatan Periode Ini: entri ACTIVE dengan Tanggal tumpang-tindih range filter.
 * Kegiatan YTD: entri ACTIVE dari awal tahun s.d. akhir range.
 * Terakhir Dicatat: Timestamp entri ACTIVE terbaru dalam range.
 */
function kegiatanDirektorat_getKPI(token, filter) {
  try {
    var session = _kgdSession(token);
    _kgdAssert(session);

    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    var yearStart = new Date(range.startDate.getFullYear(), 0, 1);

    var rows = sheetToObjects(openTransaksiSheet(SHEET_TX.KEGIATAN_DIREKTORAT));

    var periode = 0, ytd = 0, lastTs = null;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.Status !== ROW_STATUS.ACTIVE) continue;
      var t = _kgdNormDate(row.Tanggal);
      if (!t) continue;
      if (t >= range.startDate && t <= range.endDate) periode++;
      if (t >= yearStart && t <= range.endDate) ytd++;
      var ts = new Date(row.Timestamp);
      if (!isNaN(ts.getTime()) && (!lastTs || ts > lastTs)) lastTs = ts;
    }

    return {
      success: true,
      data: {
        kegiatanPeriode: periode,
        kegiatanYtd:     ytd,
        terakhirDicatat: lastTs ? lastTs.toISOString() : null
      }
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Feed kronologis lengkap (ACTIVE, SUPERSEDED, VOID) di mana Tanggal kegiatan
 * tumpang-tindih range filter. Urut Tanggal menurun, lalu Timestamp menurun.
 */
function kegiatanDirektorat_getHistory(token, filter) {
  try {
    var session = _kgdSession(token);
    _kgdAssert(session);

    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    var divMap = _kgdDivisiMap();

    var rows = sheetToObjects(openTransaksiSheet(SHEET_TX.KEGIATAN_DIREKTORAT));
    var history = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var t = _kgdNormDate(row.Tanggal);
      if (!t) continue;
      if (t >= range.startDate && t <= range.endDate) {
        row.divisiNama = divMap[String(row.DivisiID || '')] || String(row.DivisiID || '');
        history.push(row);
      }
    }

    history.sort(function (a, b) {
      var ta = _kgdNormDate(a.Tanggal);
      var tb = _kgdNormDate(b.Tanggal);
      var d = tb.getTime() - ta.getTime();
      if (d !== 0) return d;
      return new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime();
    });

    return { success: true, data: history };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function _kgdNormDate(v) {
  if (!v) return null;
  var d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d;
}

// ===========================================================================
// WRITE ENDPOINTS (WITH LOCK)
// ===========================================================================

/**
 * Tambah entri kegiatan baru.
 * @param {string} token
 * @param {{judul:string, tanggal:string, deskripsi:string, pihakHadir:string}} params
 */
function kegiatanDirektorat_submit(token, params) {
  return withLock(function () {
    try {
      var session = _kgdSession(token);
      _kgdAssert(session);

      var p = params || {};
      var judul = String(p.judul || '').trim();
      var deskripsi = String(p.deskripsi || '').trim();
      var pihakHadir = String(p.pihakHadir || '').trim();
      if (!judul) return { success: false, error: 'Judul kegiatan wajib diisi.' };
      if (!deskripsi) return { success: false, error: 'Deskripsi kegiatan wajib diisi.' };

      var tanggal = _kgdNormDate(p.tanggal);
      if (!tanggal) return { success: false, error: 'Tanggal kegiatan tidak valid.' };

      var rowId = 'KGD-' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
      appendRowData(openTransaksiSheet(SHEET_TX.KEGIATAN_DIREKTORAT), {
        RowID: rowId,
        DivisiID: session.divisiId,
        Periode: dateToPeriode(tanggal),
        SubmittedBy: session.userId,
        Timestamp: new Date().toISOString(),
        Status: ROW_STATUS.ACTIVE,
        SupersedesRowID: '',
        VoidReason: '',
        VoidedBy: '',
        VoidedAt: '',
        JudulKegiatan: judul,
        Tanggal: tanggal,
        Deskripsi: deskripsi,
        PihakHadir: pihakHadir
      });

      _kgdAuditLog(session.userId, 'CREATE', rowId, 'Tambah kegiatan: ' + judul);

      return { success: true, data: { rowIds: [rowId], message: 'Kegiatan berhasil dicatat.' } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

/**
 * Revisi satu entri kegiatan (versioning: lama → SUPERSEDED, salin dengan RowID baru).
 */
function kegiatanDirektorat_revisi(token, params) {
  return withLock(function () {
    try {
      var session = _kgdSession(token);
      _kgdAssert(session);

      var p = params || {};
      var targetRowId = p.targetRowId;
      var alasanRevisi = String(p.alasanRevisi || '').trim();
      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!alasanRevisi) return { success: false, error: 'Alasan revisi wajib diisi.' };

      var judul = String(p.judul || '').trim();
      var deskripsi = String(p.deskripsi || '').trim();
      var pihakHadir = String(p.pihakHadir || '').trim();
      if (!judul) return { success: false, error: 'Judul kegiatan wajib diisi.' };
      if (!deskripsi) return { success: false, error: 'Deskripsi kegiatan wajib diisi.' };

      var tanggal = _kgdNormDate(p.tanggal);
      if (!tanggal) return { success: false, error: 'Tanggal kegiatan tidak valid.' };

      var sheet = openTransaksiSheet(SHEET_TX.KEGIATAN_DIREKTORAT);
      var oldRowData = findRowByField(sheet, 'RowID', targetRowId);
      if (!oldRowData || String(oldRowData.obj['Status']) !== ROW_STATUS.ACTIVE) {
        return { success: false, error: 'Baris tidak ditemukan atau bukan status ACTIVE.' };
      }

      updateRowCells(sheet, oldRowData.rowIndex, {
        Status: ROW_STATUS.SUPERSEDED,
        VoidReason: alasanRevisi,
        VoidedBy: session.userId,
        VoidedAt: new Date().toISOString()
      });

      var newRowId = 'KGD-' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
      appendRowData(sheet, {
        RowID: newRowId,
        DivisiID: session.divisiId,
        Periode: dateToPeriode(tanggal),
        SubmittedBy: session.userId,
        Timestamp: new Date().toISOString(),
        Status: ROW_STATUS.ACTIVE,
        SupersedesRowID: targetRowId,
        VoidReason: '',
        VoidedBy: '',
        VoidedAt: '',
        JudulKegiatan: judul,
        Tanggal: tanggal,
        Deskripsi: deskripsi,
        PihakHadir: pihakHadir
      });

      _kgdAuditLog(session.userId, 'UPDATE', newRowId, 'Revisi kegiatan ' + targetRowId + ': ' + alasanRevisi);

      return { success: true, data: { rowId: newRowId, message: 'Revisi berhasil disimpan.' } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

/**
 * Anulir satu entri kegiatan (lintas divisi — semua _KGD_ROLES boleh VOID).
 */
function kegiatanDirektorat_anulir(token, params) {
  return withLock(function () {
    try {
      var session = _kgdSession(token);
      _kgdAssert(session);

      var p = params || {};
      var targetRowId = p.targetRowId;
      var alasan = String(p.alasan || '').trim();
      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!alasan) return { success: false, error: 'Komentar anulir wajib diisi.' };

      var sheet = openTransaksiSheet(SHEET_TX.KEGIATAN_DIREKTORAT);
      var target = findRowByField(sheet, 'RowID', targetRowId);
      if (!target) return { success: false, error: 'Baris tidak ditemukan.' };
      if (String(target.obj['Status']) !== ROW_STATUS.ACTIVE) {
        return { success: false, error: 'Hanya entri ACTIVE yang dapat dianulir.' };
      }

      updateRowCells(sheet, target.rowIndex, {
        Status: ROW_STATUS.VOID,
        VoidReason: alasan,
        VoidedBy: session.userId,
        VoidedAt: new Date().toISOString()
      });

      _kgdAuditLog(session.userId, 'VOID', targetRowId, alasan);

      // Notifikasi ke pengunggah asli (PRD §7.4)
      var publisherId = String(target.obj['SubmittedBy']);
      if (publisherId && publisherId !== session.userId) {
        try {
          appendRowData(openLogSheet(SHEET_LOG.NOTIFICATIONS), {
            NotifID: Utilities.getUuid(),
            UserID: publisherId,
            Jenis: 'DATA_VOIDED',
            Pesan: 'Kegiatan Pendukung (' + String(target.obj['JudulKegiatan'] || '-') +
                   ', ' + (target.obj['Tanggal'] ? _kgdNormDate(target.obj['Tanggal']).toISOString().substring(0, 10) : '-') +
                   ') telah dianulir oleh ' + session.role + '. Komentar: ' + alasan,
            IsRead: false,
            CreatedAt: new Date().toISOString()
          });
        } catch (ignored) {}
      }

      return { success: true, message: 'Kegiatan berhasil dianulir.' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}