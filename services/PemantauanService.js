/**
 * services/PemantauanService.js
 * Service backend modul Pemantauan (DIV-PANTAU) — PRD §5.6.
 *
 * Data: TX_Pemantauan (DATA_SCHEMA.md) — kolom standar +
 *   Jenis            enum(PERSETUJUAN_PENYEDIA, USERNAME, SKAT, PEMASANGAN_MIGRASI, MARABAHAYA)
 *   Jumlah           number, nullable (untuk jenis kuantitatif)
 *   NamaPenyedia     text, nullable (untuk PERSETUJUAN_PENYEDIA)
 *   KapalID          ref(Kapal), nullable (untuk MARABAHAYA)
 *   KondisiDarurat   text, nullable (untuk MARABAHAYA)
 *   StatusPenanganan enum(DALAM_PENANGANAN, SELESAI), nullable
 *
 * Satu laporan mingguan berupa set baris: USERNAME/SKAT/PEMASANGAN_MIGRASI satu
 * baris per jenis (kuantitatif, YTD dihitung sistem); PERSETUJUAN_PENYEDIA dan
 * MARABAHAYA satu baris per entitas (event log). Submit menerima array items.
 */

// ===========================================================================
// HELPER & CONSTANTS
// ===========================================================================

var PANTAU_JENIS_LABEL = {
  PERSETUJUAN_PENYEDIA: 'Persetujuan Penyedia SPKP',
  USERNAME:             'Penerbitan Username',
  SKAT:                 'Penerbitan SKAT',
  PEMASANGAN_MIGRASI:   'Pemasangan SPKP Kapal Migrasi',
  MARABAHAYA:           'Kapal Kondisi Marabahaya'
};

function _pantaRequireSession(token) {
  var session = _getSession(token);
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau belum disetujui.');
  }
  return session;
}

function _pantaAssertRead(session) {
  if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) return;
  if (session.divisiId !== DIVISI_ID.PANTAU) {
    throw new Error('FORBIDDEN: Akses data Pemantauan hanya untuk divisi terkait atau pimpinan.');
  }
}

function _pantaAssertWrite(session) {
  if (session.role === ROLE.SUPERADMIN) return;
  if (session.divisiId !== DIVISI_ID.PANTAU) {
    throw new Error('FORBIDDEN: Hanya anggota divisi Pemantauan yang dapat mengubah data.');
  }
  if (session.role !== ROLE.KADIV && session.role !== ROLE.STAF) {
    throw new Error('FORBIDDEN: Role ' + session.role + ' tidak diizinkan mengubah data Pemantauan.');
  }
}

function _pantaAssertAnulir(session) {
  if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) return;
  if (session.role === ROLE.KADIV && session.divisiId === DIVISI_ID.PANTAU) return;
  throw new Error('FORBIDDEN: Hanya pimpinan yang dapat melakukan anulir data Pemantauan.');
}

function _pantaValidJenis(j) {
  return Object.prototype.hasOwnProperty.call(PANTAU_JENIS_LABEL, j);
}

function _pantaAuditLog(userId, aksi, rowIdTarget, alasan) {
  try {
    appendRowData(openLogSheet(SHEET_LOG.AUDIT_LOG), {
      'LogID':       'LOG-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
      'UserID':      userId,
      'Aksi':        aksi,
      'SheetTarget': SHEET_TX.PEMANTAUAN,
      'RowIDTarget': rowIdTarget,
      'Alasan':      alasan,
      'Timestamp':   new Date()
    });
  } catch (e) { /* audit tidak boleh membatalkan aksi utama */ }
}

// Peta KapalID → {nama, kelas} dari master, untuk lookup di KPI & riwayat.
function _pantaKapalMap() {
  var map = {};
  try {
    var sheet = openMasterSheet(SHEET_MASTER.KAPAL);
    sheetToObjects(sheet).forEach(function (row) {
      map[String(row['KapalID'])] = {
        nama:  String(row['Nama']),
        kelas: String(row['Kelas'])
      };
    });
  } catch (e) { /* master tak terbaca → lookup kosong */ }
  return map;
}

// ===========================================================================
// READ ENDPOINTS
// ===========================================================================

/**
 * KPI Pemantauan: penerbitan (periode + YTD), event log penyedia, daftar marabahaya.
 */
function pemantauan_getKPI(token, filter) {
  try {
    var session = _pantaRequireSession(token);
    _pantaAssertRead(session);

    var sheet = openTransaksiSheet(SHEET_TX.PEMANTAUAN);
    var rows = sheetToObjects(sheet);
    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth()+1, year: new Date().getFullYear() });

    var res = {
      usernamePeriode: 0,
      skatPeriode:     0,
      pemasanganPeriode: 0,
      usernameYTD: 0,
      skatYTD:     0,
      pemasanganYTD: 0,
      penyediaPesan: 0,
      penyedia: [],          // event log {nama, jumlah, periode, timestamp, status, rowId}
      marabahaya: [],        // {kapalId, namaKapal, kondisiDarurat, statusPenanganan, periode, ...}
      mingguTerakhirSubmit: null
    };

    var yearStart = new Date(range.startDate.getFullYear(), 0, 1);
    var latestPeriodeStart = null;
    var kapalMap = _pantaKapalMap();

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.Status !== ROW_STATUS.ACTIVE) continue;
      var pRange = periodeToDateRange(row.Periode);
      if (!pRange) continue;
      var jenis = String(row.Jenis || '');

      // YTD
      if (pRange.endDate <= range.endDate && pRange.startDate >= yearStart) {
        if (jenis === 'USERNAME')           res.usernameYTD += (Number(row.Jumlah) || 0);
        else if (jenis === 'SKAT')          res.skatYTD += (Number(row.Jumlah) || 0);
        else if (jenis === 'PEMASANGAN_MIGRASI') res.pemasanganYTD += (Number(row.Jumlah) || 0);
      }

      // Dalam rentang filter
      if (pRange.endDate >= range.startDate && pRange.startDate <= range.endDate) {
        if (jenis === 'USERNAME') {
          res.usernamePeriode += (Number(row.Jumlah) || 0);
        } else if (jenis === 'SKAT') {
          res.skatPeriode += (Number(row.Jumlah) || 0);
        } else if (jenis === 'PEMASANGAN_MIGRASI') {
          res.pemasanganPeriode += (Number(row.Jumlah) || 0);
        } else if (jenis === 'PERSETUJUAN_PENYEDIA') {
          var jmlP = Number(row.Jumlah) || 1;
          res.penyediaPesan += jmlP;
          res.penyedia.push({
            rowId:  String(row.RowID || ''),
            nama:   String(row.NamaPenyedia || ''),
            jumlah: jmlP,
            periode: String(row.Periode || ''),
            timestamp: row.Timestamp,
            status: String(row.Status || '')
          });
        } else if (jenis === 'MARABAHAYA') {
          var kid = String(row.KapalID || '');
          res.marabahaya.push({
            rowId:  String(row.RowID || ''),
            kapalId: kid,
            namaKapal: kapalMap[kid] ? kapalMap[kid].nama : (kid || '(tanpa kapal)'),
            kondisiDarurat: String(row.KondisiDarurat || ''),
            statusPenanganan: String(row.StatusPenanganan || ''),
            periode: String(row.Periode || ''),
            timestamp: row.Timestamp,
            status: String(row.Status || '')
          });
        }

        if (!latestPeriodeStart || pRange.startDate > latestPeriodeStart) {
          latestPeriodeStart = pRange.startDate;
          res.mingguTerakhirSubmit = row.Periode;
        }
      }
    }

    res.penyedia.sort(function (a, b) {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    res.marabahaya.sort(function (a, b) {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return { success: true, data: res };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Riwayat baris Pemantauan dalam rentang filter (termasuk SUPERSEDED & VOID),
 * urut timestamp menurun, dengan lookup nama kapal.
 */
function pemantauan_getHistory(token, filter) {
  try {
    var session = _pantaRequireSession(token);
    _pantaAssertRead(session);

    var sheet = openTransaksiSheet(SHEET_TX.PEMANTAUAN);
    var rows = sheetToObjects(sheet);
    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth()+1, year: new Date().getFullYear() });
    var kapalMap = _pantaKapalMap();

    var history = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var t = new Date(row.Timestamp);
      if (t >= range.startDate && t <= range.endDate) {
        row.kapalNama = kapalMap[String(row.KapalID || '')] ? kapalMap[String(row.KapalID || '')].nama : '';
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
 * Submit laporan mingguan — array items, 1 baris per entitas/jenis.
 * @param {string} token
 * @param {{periode:string, items:Array<{jenis:string,jumlah:number,namaPenyedia:string,kapalId:string,kondisiDarurat:string,statusPenanganan:string}>}} params
 */
function pemantauan_submitMingguan(token, params) {
  return withLock(function () {
    try {
      var session = _pantaRequireSession(token);
      _pantaAssertWrite(session);

      var p = params || {};
      var periode = p.periode || '';
      if (!/^\d{4}-\d{2}-W0[1-5]$/.test(periode)) {
        return { success: false, error: 'Format Periode tidak valid. Gunakan YYYY-MM-W0X (contoh: 2026-09-W02).' };
      }
      var items = (p.items || []).filter(function (it) { return it; });
      if (items.length === 0) {
        return { success: false, error: 'Minimal satu item data Pemantauan wajib diisi.' };
      }

      // Validasi + normalisasi item
      var rowsOut = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!_pantaValidJenis(it.jenis)) {
          return { success: false, error: 'Jenis data Pemantauan tidak valid: ' + it.jenis };
        }

        var jumlah = Number(it.jumlah) || 0;
        if (jumlah < 0) return { success: false, error: 'Jumlah tidak boleh negatif.' };

        var namaPenyedia = '';
        var kapalId = '';
        var kondisi = '';
        var status = '';

        if (it.jenis === 'USERNAME' || it.jenis === 'SKAT' || it.jenis === 'PEMASANGAN_MIGRASI') {
          // kuantitatif — jumlah wajib eksplisit
          if (it.jumlah === undefined || it.jumlah === null || it.jumlah === '') {
            return { success: false, error: 'Jumlah untuk ' + (PANTAU_JENIS_LABEL[it.jenis] || it.jenis) + ' wajib diisi.' };
          }
        } else if (it.jenis === 'PERSETUJUAN_PENYEDIA') {
          namaPenyedia = String(it.namaPenyedia || '').trim();
          if (!namaPenyedia) {
            return { success: false, error: 'Nama penyedia SPKP wajib diisi.' };
          }
        } else if (it.jenis === 'MARABAHAYA') {
          kapalId = String(it.kapalId || '').trim();
          kondisi = String(it.kondisiDarurat || '').trim();
          status = String(it.statusPenanganan || '');
          if (!kapalId) return { success: false, error: 'Untuk kapal marabahaya, pilih kapal dari Master Data.' };
          if (!kondisi) return { success: false, error: 'Jenis kondisi darurat wajib diisi.' };
          if (status !== 'DALAM_PENANGANAN' && status !== 'SELESAI') {
            return { success: false, error: 'Status penanganan harus DALAM_PENANGANAN atau SELESAI.' };
          }
        }

        rowsOut.push({
          jenis: String(it.jenis),
          jumlah: it.jenis === 'MARABAHAYA' ? (jumlah || 1) : jumlah,
          namaPenyedia: namaPenyedia,
          kapalId: kapalId,
          kondisiDarurat: kondisi,
          statusPenanganan: status
        });
      }

      var sheet = openTransaksiSheet(SHEET_TX.PEMANTAUAN);
      var existing = sheetToObjects(sheet);

      // Dublikat: jenis kuantitatif 1x per periode; penyedia 1x (periode, nama);
      // marabahaya 1x (periode, kapal).
      for (var r = 0; r < rowsOut.length; r++) {
        var ro = rowsOut[r];
        for (var e = 0; e < existing.length; e++) {
          var ex = existing[e];
          if (ex.Status !== ROW_STATUS.ACTIVE) continue;
          if (String(ex.Periode) !== periode) continue;
          if (ro.jenis === 'USERNAME' || ro.jenis === 'SKAT' || ro.jenis === 'PEMASANGAN_MIGRASI') {
            if (String(ex.Jenis) === ro.jenis) {
              return { success: false, error: 'Laporan "' + (PANTAU_JENIS_LABEL[ro.jenis] || ro.jenis) + '" periode ' + periode + ' sudah ada. Gunakan Revisi.' };
            }
          } else if (ro.jenis === 'PERSETUJUAN_PENYEDIA') {
            if (String(ex.Jenis) === 'PERSETUJUAN_PENYEDIA' && String(ex.NamaPenyedia) === ro.namaPenyedia) {
              return { success: false, error: 'Penyedia "' + ro.namaPenyedia + '" pada periode ' + periode + ' sudah ada.' };
            }
          } else if (ro.jenis === 'MARABAHAYA') {
            if (String(ex.Jenis) === 'MARABAHAYA' && String(ex.KapalID) === ro.kapalId) {
              return { success: false, error: 'Kapal ' + ro.kapalId + ' sudah dilaporkan marabahaya pada periode ' + periode + '.' };
            }
          }
        }
      }

      var ts = new Date().toISOString();
      var rowIds = [];
      for (var w = 0; w < rowsOut.length; w++) {
        var rowId = 'PNT-' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
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
          NamaPenyedia: rowsOut[w].namaPenyedia,
          KapalID: rowsOut[w].kapalId,
          KondisiDarurat: rowsOut[w].kondisiDarurat,
          StatusPenanganan: rowsOut[w].statusPenanganan
        });
        _pantaAuditLog(session.userId, 'CREATE', rowId, 'Submit Pemantauan periode ' + periode + ' (' + rowsOut[w].jenis + ')');
      }

      return { success: true, data: { rowIds: rowIds, message: 'Laporan Pemantauan periode ' + periode + ' berhasil disimpan (' + rowIds.length + ' baris).' } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

/**
 * Revisi satu baris Pemantauan (nilai & detail — Jenis/entitas terkunci).
 */
function pemantauan_revisi(token, params) {
  return withLock(function () {
    try {
      var session = _pantaRequireSession(token);
      _pantaAssertWrite(session);

      var p = params || {};
      var targetRowId = p.targetRowId;
      var alasanRevisi = p.alasanRevisi;
      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!alasanRevisi) return { success: false, error: 'Alasan revisi wajib diisi.' };

      var sheet = openTransaksiSheet(SHEET_TX.PEMANTAUAN);
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
      var newRowId = 'PNT-' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();

      var newJumlah = (p.jumlah !== undefined && p.jumlah !== null && p.jumlah !== '') ? Number(p.jumlah) : (Number(oldObj.Jumlah) || 0);
      if (newJumlah < 0) return { success: false, error: 'Jumlah tidak boleh negatif.' };

      var newKondisi = p.kondisiDarurat !== undefined ? String(p.kondisiDarurat).trim() : String(oldObj.KondisiDarurat || '');
      var newStatus  = p.statusPenanganan !== undefined ? String(p.statusPenanganan) : String(oldObj.StatusPenanganan || '');
      if (String(oldObj.Jenis) === 'MARABAHAYA') {
        if (!newKondisi) return { success: false, error: 'Kondisi darurat wajib diisi.' };
        if (newStatus !== 'DALAM_PENANGANAN' && newStatus !== 'SELESAI') {
          return { success: false, error: 'Status penanganan harus DALAM_PENANGANAN atau SELESAI.' };
        }
      }

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
        NamaPenyedia: oldObj.NamaPenyedia || '',
        KapalID: oldObj.KapalID || '',
        KondisiDarurat: newKondisi,
        StatusPenanganan: newStatus
      });

      _pantaAuditLog(session.userId, 'UPDATE', newRowId, 'Revisi baris ' + targetRowId + ': ' + alasanRevisi);
      return { success: true, data: { rowId: newRowId, message: 'Revisi berhasil disimpan.' } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

/**
 * Anulir satu baris Pemantauan — komentar wajib, notifikasi ke publisher.
 */
function pemantauan_anulir(token, params) {
  return withLock(function () {
    try {
      var session = _pantaRequireSession(token);
      _pantaAssertAnulir(session);

      var p = params || {};
      var targetRowId = p.targetRowId;
      var alasan = p.alasan;
      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!alasan || String(alasan).trim() === '') return { success: false, error: 'Komentar anulir wajib diisi.' };

      var sheet = openTransaksiSheet(SHEET_TX.PEMANTAUAN);
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

      _pantaAuditLog(session.userId, 'VOID', targetRowId, String(alasan).trim());

      var publisherId = String(target.obj['SubmittedBy']);
      if (publisherId !== session.userId) {
        try {
          appendRowData(openLogSheet(SHEET_LOG.NOTIFICATIONS), {
            NotifID: Utilities.getUuid(),
            UserID: publisherId,
            Jenis: 'DATA_VOIDED',
            Pesan: 'Data Pemantauan (' + (PANTAU_JENIS_LABEL[String(target.obj['Jenis'])] || target.obj['Jenis']) +
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

// ── TREN BULANAN (FASE 8 — chart konteks pemantauan) ───────

function pemantauan_getTren(token, filter) {
  try {
    var session = _pantaRequireSession(token);
    _pantaAssertRead(session);

    var sheet = openTransaksiSheet(SHEET_TX.PEMANTAUAN);
    var rows  = sheetToObjects(sheet);
    var months = utils_getTrendMonths(filter);

    var username = [], skat = [], migrasi = [];
    for (var i = 0; i < months.length; i++) { username.push(0); skat.push(0); migrasi.push(0); }
    var idx = {};
    months.forEach(function (m, mi) { idx[m] = mi; });

    for (var j = 0; j < rows.length; j++) {
      var r = rows[j];
      if (r.Status !== ROW_STATUS.ACTIVE) continue;
      var mm = String(r.Periode || '').substring(0, 7);
      if (idx[mm] === undefined) continue;
      var v = Number(r.Jumlah) || 0;
      if (r.Jenis === 'USERNAME')             username[idx[mm]] += v;
      else if (r.Jenis === 'SKAT')            skat[idx[mm]] += v;
      else if (r.Jenis === 'PEMASANGAN_MIGRASI') migrasi[idx[mm]] += v;
    }

    return { success: true, data: { months: months, username: username, skat: skat, migrasi: migrasi } };
  } catch (e) {
    Logger.log('[pemantauan_getTren] ' + e.message);
    return { success: false, error: e.message };
  }
}