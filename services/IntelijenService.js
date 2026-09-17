/**
 * services/IntelijenService.js
 * Service backend modul Intelijen (DIV-INTEL) — PRD §5.5, §8.2.
 *
 * Data: TX_Intelijen (DATA_SCHEMA.md) — kolom standar +
 *   Jenis       enum(DREDGING, PELANGGARAN_PERIZINAN, PELANGGARAN_TRANSMITTER,
 *                     NOTA_DINAS, KAWASAN_KONSERVASI, KAPAL_PENGANGKUT_IKAN_HIDUP)
 *   Jumlah      number
 *   KawasanID   ref(Kawasan_Konservasi), terisi hanya jika Jenis = KAWASAN_KONSERVASI
 *   Keterangan  text, nullable
 *
 * Satu laporan mingguan adalah satu set baris (umumnya 1 baris per Jenis;
 * untuk KAWASAN_KONSERVASI bisa 1 baris per kawasan). Submit menerima array items.
 */

// ===========================================================================
// HELPER & CONSTANTS
// ===========================================================================

var INTEL_JENIS_LABEL = {
  DREDGING:                     'Kapal Dredging / Underwater Ops',
  PELANGGARAN_PERIZINAN:        'Pelanggaran Perizinan Berusaha',
  PELANGGARAN_TRANSMITTER:      'Pelanggaran Mematikan Transmitter',
  NOTA_DINAS:                   'Nota Dinas Data Intelijen',
  KAWASAN_KONSERVASI:           'Pelanggaran Kawasan Konservasi',
  KAPAL_PENGANGKUT_IKAN_HIDUP:  'Kapal Pengangkut Ikan Hidup'
};

function _intelRequireSession(token) {
  var session = _getSession(token);
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau belum disetujui.');
  }
  return session;
}

function _intelAssertRead(session) {
  if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) return;
  if (session.divisiId !== DIVISI_ID.INTEL) {
    throw new Error('FORBIDDEN: Akses data Intelijen hanya untuk divisi terkait atau pimpinan.');
  }
}

function _intelAssertWrite(session) {
  if (session.role === ROLE.SUPERADMIN) return;
  if (session.divisiId !== DIVISI_ID.INTEL) {
    throw new Error('FORBIDDEN: Hanya anggota divisi Intelijen yang dapat mengubah data.');
  }
  if (session.role !== ROLE.KADIV && session.role !== ROLE.STAF) {
    throw new Error('FORBIDDEN: Role ' + session.role + ' tidak diizinkan mengubah data Intelijen.');
  }
}

function _intelAssertAnulir(session) {
  if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) return;
  if (session.role === ROLE.KADIV && session.divisiId === DIVISI_ID.INTEL) return;
  throw new Error('FORBIDDEN: Hanya pimpinan yang dapat melakukan anulir data Intelijen.');
}

function _intelValidJenis(j) {
  return Object.prototype.hasOwnProperty.call(INTEL_JENIS_LABEL, j);
}

function _intelAuditLog(userId, aksi, rowIdTarget, alasan) {
  try {
    appendRowData(openLogSheet(SHEET_LOG.AUDIT_LOG), {
      'LogID':       'LOG-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
      'UserID':      userId,
      'Aksi':        aksi,
      'SheetTarget': SHEET_TX.INTELIJEN,
      'RowIDTarget': rowIdTarget,
      'Alasan':      alasan,
      'Timestamp':   new Date()
    });
  } catch (e) { /* audit tidak boleh membatalkan aksi utama */ }
}

// Peta KawasanID → {nama, provinsi} dari master, untuk lookup di KPI & riwayat.
function _intelKawasanMap() {
  var map = {};
  try {
    var sheet = openMasterSheet(SHEET_MASTER.KAWASAN_KONSERVASI);
    sheetToObjects(sheet).forEach(function (row) {
      map[String(row['KawasanID'])] = {
        nama:     String(row['Nama']),
        provinsi: String(row['Provinsi'])
      };
    });
  } catch (e) { /* master tak terbaca → lookup kosong, UI tampil ID mentah */ }
  return map;
}

// ===========================================================================
// READ ENDPOINTS
// ===========================================================================

/**
 * KPI Intelijen untuk rentang filter: sum per Jenis (ACTIVE) + tabel kawasan (§8.2).
 */
function intelijen_getKPI(token, filter) {
  try {
    var session = _intelRequireSession(token);
    _intelAssertRead(session);

    var sheet = openTransaksiSheet(SHEET_TX.INTELIJEN);
    var rows = sheetToObjects(sheet);
    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth()+1, year: new Date().getFullYear() });

    var res = {
      dredging:                0,
      pelanggaranPerizinan:    0,
      pelanggaranTransmitter:  0,
      notaDinas:               0,
      kapalPengangkutIkanHidup:0,
      kawasanPeriode:  {},          // KawasanID → sum dalam rentang filter
      kawasanYTD:      {},          // KawasanID → sum YTD (awal tahun s.d. akhir range)
      mingguTerakhirSubmit: null
    };

    var yearStart = new Date(range.startDate.getFullYear(), 0, 1);
    var latestPeriodeStart = null;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.Status !== ROW_STATUS.ACTIVE) continue;

      var pRange = periodeToDateRange(row.Periode);
      if (!pRange) continue;

      var jumlah = Number(row.Jumlah) || 0;
      var jenis = String(row.Jenis || '');

      // YTD — peta per kawasan (angka non-kawasan hanya dilaporkan per periode filter)
      if (pRange.endDate <= range.endDate && pRange.startDate >= yearStart) {
        if (jenis === 'KAWASAN_KONSERVASI') {
          var kidYtd = String(row.KawasanID || '');
          if (kidYtd) res.kawasanYTD[kidYtd] = (res.kawasanYTD[kidYtd] || 0) + jumlah;
        }
      }

      // Dalam rentang filter (overlap)
      var inRange = pRange.endDate >= range.startDate && pRange.startDate <= range.endDate;
      if (inRange) {
        if (jenis === 'KAWASAN_KONSERVASI') {
          var kid = String(row.KawasanID || '');
          if (kid) res.kawasanPeriode[kid] = (res.kawasanPeriode[kid] || 0) + jumlah;
        } else {
          _intelAddKpi(res, jenis, jumlah);
        }
        if (!latestPeriodeStart || pRange.startDate > latestPeriodeStart) {
          latestPeriodeStart = pRange.startDate;
          res.mingguTerakhirSubmit = row.Periode;
        }
      }
    }

    // Tabel kawasan (PRD §8.2) — semua kawasan di master, lengkapi dengan agregat
    res.kawasan = _intelBuildKawasanTable(filter, rows);

    return { success: true, data: res };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function _intelAddKpi(res, jenis, jumlah) {
  if (jenis === 'DREDGING')                    res.dredging += jumlah;
  else if (jenis === 'PELANGGARAN_PERIZINAN')  res.pelanggaranPerizinan += jumlah;
  else if (jenis === 'PELANGGARAN_TRANSMITTER')res.pelanggaranTransmitter += jumlah;
  else if (jenis === 'NOTA_DINAS')             res.notaDinas += jumlah;
  else if (jenis === 'KAPAL_PENGANGKUT_IKAN_HIDUP') res.kapalPengangkutIkanHidup += jumlah;
}

// Bangun tabel kawasan untuk list/table: periode ini, YTD, tren vs periode lalu.
function _intelBuildKawasanTable(filter, rows) {
  var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth()+1, year: new Date().getFullYear() });
  var yearStart = new Date(range.startDate.getFullYear(), 0, 1);

  // Rentang pembanding (periode lalu) = panjang sama tepat sebelum range filter.
  var prev = _intelPrevRange(range, filter);

  var cur = {}, ytd = {}, prevSum = {};
  rows.forEach(function (row) {
    if (row.Status !== ROW_STATUS.ACTIVE || String(row.Jenis || '') !== 'KAWASAN_KONSERVASI') return;
    var pRange = periodeToDateRange(row.Periode);
    if (!pRange) return;
    var kid = String(row.KawasanID || '');
    if (!kid) return;
    var jumlah = Number(row.Jumlah) || 0;

    if (pRange.endDate >= range.startDate && pRange.startDate <= range.endDate) {
      cur[kid] = (cur[kid] || 0) + jumlah;
    }
    if (pRange.endDate <= range.endDate && pRange.startDate >= yearStart) {
      ytd[kid] = (ytd[kid] || 0) + jumlah;
    }
    if (prev && pRange.endDate >= prev.startDate && pRange.startDate <= prev.endDate) {
      prevSum[kid] = (prevSum[kid] || 0) + jumlah;
    }
  });

  var kMap = _intelKawasanMap();
  var out = [];
  Object.keys(kMap).forEach(function (kid) {
    var c = cur[kid] || 0;
    var y = ytd[kid] || 0;
    var p = prevSum[kid] || 0;
    var tren = '-';
    if (c > p) tren = 'NAIK';
    else if (c < p) tren = 'TURUN';
    out.push({
      kawasanId:   kid,
      nama:        kMap[kid].nama || kid,
      provinsi:    kMap[kid].provinsi || '-',
      pelanggaranPeriode: c,
      pelanggaranYTD:     y,
      tren:        tren
    });
  });

  out.sort(function (a, b) {
    return b.pelanggaranPeriode - a.pelanggaranPeriode ||
           (a.nama || '').localeCompare(b.nama || '');
  });
  return out;
}

// Rentang "periode lalu": monthly → bulan sebelumnya; range → rentang sama panjang sblm start.
function _intelPrevRange(range, filter) {
  var f = filter || {};
  if (f.mode === 'range') {
    var dur = range.endDate.getTime() - range.startDate.getTime();
    if (!(dur > 0)) return null;
    return {
      startDate: new Date(range.startDate.getTime() - dur),
      endDate:   new Date(range.startDate.getTime() - 1)
    };
  }
  // monthly — geser satu bulan ke belakang
  var y = range.startDate.getFullYear();
  var m = range.startDate.getMonth(); // 0-based
  if (m === 0) { m = 11; y--; } else { m--; }
  return {
    startDate: new Date(y, m, 1),
    endDate:   new Date(y, m + 1, 0, 23, 59, 59, 999)
  };
}

/**
 * Riwayat baris Intelijen dalam rentang filter (termasuk SUPERSEDED & VOID),
 * urut timestamp menurun, dengan lookup nama kawasan.
 */
function intelijen_getHistory(token, filter) {
  try {
    var session = _intelRequireSession(token);
    _intelAssertRead(session);

    var sheet = openTransaksiSheet(SHEET_TX.INTELIJEN);
    var rows = sheetToObjects(sheet);
    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth()+1, year: new Date().getFullYear() });
    var kMap = _intelKawasanMap();

    var history = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var t = new Date(row.Timestamp);
      if (t >= range.startDate && t <= range.endDate) {
        row.kawasanNama = kMap[String(row.KawasanID || '')] ? kMap[String(row.KawasanID || '')].nama : '';
        history.push(row);
      }
    }

    history.sort(function (a, b) {
      return new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime();
    });

    return { success: true, data: history };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ===========================================================================
// WRITE ENDPOINTS (WITH LOCK)
// ===========================================================================

/**
 * Submit laporan mingguan — menerima array items (1 baris per Jenis / per kawasan).
 * @param {string} token
 * @param {{periode:string, items:Array<{jenis:string,jumlah:number,kawasanId:string,keterangan:string}>}} params
 */
function intelijen_submitMingguan(token, params) {
  return withLock(function () {
    try {
      var session = _intelRequireSession(token);
      _intelAssertWrite(session);

      var p = params || {};
      var periode = p.periode || '';
      if (!/^\d{4}-\d{2}-W0[1-5]$/.test(periode)) {
        return { success: false, error: 'Format Periode tidak valid. Gunakan YYYY-MM-W0X (contoh: 2026-09-W02).' };
      }
      var items = (p.items || []).filter(function (it) { return it; });
      if (items.length === 0) {
        return { success: false, error: 'Minimal satu item data intelijen wajib diisi.' };
      }

      // Validasi + normalisasi item
      var rowsOut = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!_intelValidJenis(it.jenis)) {
          return { success: false, error: 'Jenis data Intelijen tidak valid: ' + it.jenis };
        }
        var jumlah = Number(it.jumlah) || 0;
        if (jumlah < 0) return { success: false, error: 'Jumlah tidak boleh negatif.' };

        var kawasanId = '';
        if (it.jenis === 'KAWASAN_KONSERVASI') {
          kawasanId = String(it.kawasanId || '').trim();
          if (!kawasanId) {
            return { success: false, error: 'Untuk pelanggaran kawasan konservasi, pilih kawasan dari daftar.' };
          }
        }
        rowsOut.push({
          jenis: String(it.jenis),
          jumlah: jumlah,
          kawasanId: kawasanId,
          keterangan: String(it.keterangan || '').trim()
        });
      }

      var sheet = openTransaksiSheet(SHEET_TX.INTELIJEN);
      var existing = sheetToObjects(sheet);

      // Cek duplikat: non-kawasan 1x per periode; kawasan 1x per (periode, kawasan)
      for (var r = 0; r < rowsOut.length; r++) {
        var ro = rowsOut[r];
        for (var e = 0; e < existing.length; e++) {
          var ex = existing[e];
          if (ex.Status !== ROW_STATUS.ACTIVE) continue;
          if (String(ex.Periode) !== periode) continue;
          if (ro.jenis === 'KAWASAN_KONSERVASI') {
            if (String(ex.Jenis) === 'KAWASAN_KONSERVASI' && String(ex.KawasanID) === ro.kawasanId) {
              return { success: false, error: 'Laporan kawasan ' + ro.kawasanId + ' pada periode ' + periode + ' sudah ada. Gunakan Revisi.' };
            }
          } else if (String(ex.Jenis) === ro.jenis) {
            return { success: false, error: 'Laporan kategori "' + (INTEL_JENIS_LABEL[ro.jenis] || ro.jenis) + '" pada periode ' + periode + ' sudah ada. Gunakan Revisi.' };
          }
        }
      }

      var ts = new Date().toISOString();
      var rowIds = [];
      for (var w = 0; w < rowsOut.length; w++) {
        var rowId = 'INT-' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
        rowIds.push(rowId);
        appendRowData(sheet, {
          RowID: rowId,
          DivisiID: session.divisiId,
          Periode: periode,
          SubmittedBy: session.userId,
          Timestamp: ts,
          Status: ROW_STATUS.ACTIVE,
          SupersedesRowID: '',
          VoidReason: '',
          VoidedBy: '',
          VoidedAt: '',
          Jenis: rowsOut[w].jenis,
          Jumlah: rowsOut[w].jumlah,
          KawasanID: rowsOut[w].kawasanId,
          Keterangan: rowsOut[w].keterangan
        });
        _intelAuditLog(session.userId, 'CREATE', rowId, 'Submit Intelijen periode ' + periode + ' (' + rowsOut[w].jenis + ')');
      }

      return { success: true, message: 'Laporan Intelijen periode ' + periode + ' berhasil disimpan (' + rowIds.length + ' baris).' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

/**
 * Revisi satu baris Intelijen (hanya nilai & keterangan — Jenis/KawasanID tidak diubah).
 */
function intelijen_revisi(token, params) {
  return withLock(function () {
    try {
      var session = _intelRequireSession(token);
      _intelAssertWrite(session);

      var p = params || {};
      var targetRowId = p.targetRowId;
      var alasanRevisi = p.alasanRevisi;
      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!alasanRevisi) return { success: false, error: 'Alasan revisi wajib diisi.' };

      var sheet = openTransaksiSheet(SHEET_TX.INTELIJEN);
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

      var oldObj = oldRowData.obj;
      var newRowId = 'INT-' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();

      var newJumlah = (p.jumlah !== undefined && p.jumlah !== null && p.jumlah !== '') ? Number(p.jumlah) : (Number(oldObj.Jumlah) || 0);
      if (newJumlah < 0) return { success: false, error: 'Jumlah tidak boleh negatif.' };

      appendRowData(sheet, {
        RowID: newRowId,
        DivisiID: session.divisiId,
        Periode: oldObj.Periode,
        SubmittedBy: session.userId,
        Timestamp: new Date().toISOString(),
        Status: ROW_STATUS.ACTIVE,
        SupersedesRowID: targetRowId,
        VoidReason: '',
        VoidedBy: '',
        VoidedAt: '',
        Jenis: oldObj.Jenis,
        Jumlah: newJumlah,
        KawasanID: oldObj.KawasanID || '',
        Keterangan: p.keterangan !== undefined ? String(p.keterangan).trim() : String(oldObj.Keterangan || '')
      });

      _intelAuditLog(session.userId, 'UPDATE', newRowId, 'Revisi baris ' + targetRowId + ': ' + alasanRevisi);
      return { success: true, message: 'Revisi berhasil disimpan.' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

/**
 * Anulir satu baris Intelijen — komentar wajib, notifikasi ke publisher.
 */
function intelijen_anulir(token, params) {
  return withLock(function () {
    try {
      var session = _intelRequireSession(token);
      _intelAssertAnulir(session);

      var p = params || {};
      var targetRowId = p.targetRowId;
      var alasan = p.alasan;
      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!alasan || String(alasan).trim() === '') return { success: false, error: 'Komentar anulir wajib diisi.' };

      var sheet = openTransaksiSheet(SHEET_TX.INTELIJEN);
      var target = findRowByField(sheet, 'RowID', targetRowId);
      if (!target) return { success: false, error: 'Baris tidak ditemukan.' };
      if (String(target.obj['Status']) !== ROW_STATUS.ACTIVE) {
        return { success: false, error: 'Hanya laporan ACTIVE yang dapat dianulir.' };
      }

      updateRowCells(sheet, target.rowIndex, {
        Status: ROW_STATUS.VOID,
        VoidReason: String(alasan).trim(),
        VoidedBy: session.userId,
        VoidedAt: new Date().toISOString()
      });

      _intelAuditLog(session.userId, 'VOID', targetRowId, String(alasan).trim());

      var publisherId = String(target.obj['SubmittedBy']);
      if (publisherId !== session.userId) {
        try {
          appendRowData(openLogSheet(SHEET_LOG.NOTIFICATIONS), {
            NotifID: Utilities.getUuid(),
            UserID: publisherId,
            Jenis: 'DATA_VOIDED',
            Pesan: 'Data Intelijen (' + (INTEL_JENIS_LABEL[String(target.obj['Jenis'])] || target.obj['Jenis']) +
                   ', ' + target.obj['Periode'] + ') telah dianulir oleh ' + session.role + '. Komentar: ' + String(alasan).trim(),
            IsRead: false,
            CreatedAt: new Date().toISOString()
          });
        } catch (ignored) {}
      }

      return { success: true, message: 'Laporan berhasil dianulir.' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}