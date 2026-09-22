/**
 * services/OperasiUdaraService.js
 * Service backend untuk modul Operasi Udara (pesawat).
 *
 * Fase 7: menu Operasi Laut & Operasi Udara digabung jadi satu menu "Operasi"
 * (tab Kapal / Pesawat di frontend). RBAC kedua sub-modul berbagi divisi
 * DIV-OPS dan pola helper yang sama dengan OperasiLautService.
 */

// ===========================================================================
// HELPER & CONSTANTS
// ===========================================================================

// RBAC disamakan dengan Operasi Laut — keduanya satu divisi (DIV-OPS).
function _opsUdaraRequireSession(token) {
  var session = _getSession(token);
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau belum disetujui.');
  }
  return session;
}

function _opsUdaraAssertRead(session) {
  // Semua role approved boleh baca, tetapi KADIV/STAF non-OPS ditolak
  if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) return;
  if (session.divisiId !== 'DIV-OPS') {
    throw new Error('FORBIDDEN: Akses data Operasi hanya untuk divisi terkait atau pimpinan.');
  }
}

function _opsUdaraAssertWrite(session) {
  // Hanya SUPERADMIN, KADIV-OPS, STAF-OPS
  if (session.role === ROLE.SUPERADMIN) return;
  if (session.divisiId !== 'DIV-OPS') {
    throw new Error('FORBIDDEN: Hanya anggota divisi Operasi yang dapat mengubah data.');
  }
  if (session.role !== ROLE.KADIV && session.role !== ROLE.STAF) {
    throw new Error('FORBIDDEN: Role ' + session.role + ' tidak diizinkan mengubah data Operasi.');
  }
}

function _opsUdaraAssertAnulir(session) {
  // Hanya SUPERADMIN, DIREKTUR, KADIV-OPS
  if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) return;
  if (session.role === ROLE.KADIV && session.divisiId === 'DIV-OPS') return;
  throw new Error('FORBIDDEN: Hanya pimpinan yang dapat melakukan anulir data.');
}

// ===========================================================================
// READ ENDPOINTS
// ===========================================================================

/**
 * Get WPP list for dropdown. Ditarik dari Master Data via master_getWppList
 * (fallback read-only WPP_NRI bila sheet master kosong).
 */
function operasiUdara_getOptions(token) {
  try {
    var session = _opsUdaraRequireSession(token);
    _opsUdaraAssertRead(session);

    var wpp = master_getWppList(token);
    if (!wpp.success) return { success: false, error: wpp.error };

    return {
      success: true,
      data: wpp.data.map(function(row) {
        return { value: row.WPPCode, text: row.WPPCode + ' - ' + row.NamaWilayah };
      })
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * KPI Operasi Udara (pesawat) — aggregasi baris ACTIVE dalam rentang filter.
 */
function operasiUdara_getKPI(token, filter) {
  try {
    var session = _opsUdaraRequireSession(token);
    _opsUdaraAssertRead(session);

    var sheet = openTransaksiSheet(SHEET_TX.OPERASI_UDARA);
    var rows = sheetToObjects(sheet);
    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth()+1, year: new Date().getFullYear() });

    var res = {
      kii: 0,
      kia: 0,
      objek_sdk: 0,
      rumpon_lokal: 0,
      cakupan_nm2: 0,
      hari_operasi_realisasi: 0,
      hari_operasi_target: 180, // default baseline (DATA_SCHEMA.md)
      mingguTerakhirSubmit: null,
      wppIntensitas: {} // WPPCode -> intensitas pemantauan (untuk choropleth)
    };

    var latestPeriodeStart = null;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.Status !== ROW_STATUS.ACTIVE) continue;

      var isInRange = false;
      var pRange = periodeToDateRange(row.Periode);
      if (pRange) {
        isInRange = pRange.endDate >= range.startDate && pRange.startDate <= range.endDate;
      }
      if (!isInRange) continue;

      var kii = Number(row.KII) || 0;
      var kia = Number(row.KIA) || 0;

      res.kii += kii;
      res.kia += kia;
      res.objek_sdk += (Number(row.ObjekSDK) || 0);
      res.rumpon_lokal += (Number(row.RumponLokalTeridentifikasi) || 0);
      res.cakupan_nm2 += (Number(row.CakupanWilayah_NM2) || 0);
      res.hari_operasi_realisasi += (Number(row.HariOperasi_Jumlah) || 0);

      // Intensitas per WPP untuk choropleth
      var wpp = row.WPPCode || 'UNKNOWN';
      if (!res.wppIntensitas[wpp]) res.wppIntensitas[wpp] = 0;
      res.wppIntensitas[wpp] += (kii + kia + (Number(row.ObjekSDK) || 0) + (Number(row.RumponLokalTeridentifikasi) || 0));

      if (!latestPeriodeStart || pRange.startDate > latestPeriodeStart) {
        latestPeriodeStart = pRange.startDate;
        res.mingguTerakhirSubmit = row.Periode;
      }
    }

    return { success: true, data: res };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Riwayat laporan Operasi Udara (termasuk SUPERSEDED & VOID).
 */
function operasiUdara_getHistory(token, filter) {
  try {
    var session = _opsUdaraRequireSession(token);
    _opsUdaraAssertRead(session);

    var sheet = openTransaksiSheet(SHEET_TX.OPERASI_UDARA);
    var rows = sheetToObjects(sheet);
    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth()+1, year: new Date().getFullYear() });

    var history = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var t = new Date(row.Timestamp);
      if (t >= range.startDate && t <= range.endDate) {
        history.push(row);
      }
    }

    history.sort(function(a, b) {
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

function operasiUdara_submit(token, params) {
  return withLock(function() {
    try {
      var session = _opsUdaraRequireSession(token);
      _opsUdaraAssertWrite(session);

      var p = params || {};
      if (!p.Periode || !p.WPPCode) {
        return { success: false, error: 'Periode dan WPPCode wajib diisi.' };
      }
      if (!/^\d{4}-\d{2}-W0[1-5]$/.test(p.Periode)) {
        return { success: false, error: 'Format Periode tidak valid. Gunakan YYYY-MM-W0X (contoh: 2026-09-W02).' };
      }

      var sheet = openTransaksiSheet(SHEET_TX.OPERASI_UDARA);
      var rows = sheetToObjects(sheet);

      // Cek duplikat ACTIVE untuk kombinasi Periode + WPP
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].Status === ROW_STATUS.ACTIVE &&
            rows[i].Periode === p.Periode &&
            rows[i].WPPCode === p.WPPCode) {
          return { success: false, error: 'Laporan untuk WPP ' + p.WPPCode + ' pada periode ' + p.Periode + ' sudah ada. Silakan gunakan fitur Revisi.' };
        }
      }

      var rowId = Utilities.getUuid();
      var newRow = {
        RowID: rowId,
        DivisiID: session.divisiId,
        Periode: p.Periode,
        SubmittedBy: session.userId,
        Timestamp: new Date().toISOString(),
        Status: ROW_STATUS.ACTIVE,
        SupersedesRowID: '',
        VoidReason: '',
        VoidedBy: '',
        VoidedAt: '',

        WPPCode: p.WPPCode,
        KII: p.KII || 0,
        KIA: p.KIA || 0,
        ObjekSDK: p.ObjekSDK || 0,
        RumponLokalTeridentifikasi: p.RumponLokalTeridentifikasi || 0,
        CakupanWilayah_NM2: p.CakupanWilayah_NM2 || 0,
        HariOperasi_Jumlah: p.HariOperasi_Jumlah || 0,
        HariOperasi_Target: p.HariOperasi_Target || 180
      };

      appendRowData(sheet, newRow);
      return { success: true, data: { rowId: rowId, message: 'Laporan Operasi (Pesawat) berhasil disimpan.' } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

function operasiUdara_revisi(token, params) {
  return withLock(function() {
    try {
      var session = _opsUdaraRequireSession(token);
      _opsUdaraAssertWrite(session);

      var p = params || {};
      var targetRowId = p.targetRowId;
      var alasanRevisi = p.alasanRevisi;

      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!alasanRevisi) return { success: false, error: 'Alasan revisi wajib diisi.' };

      var sheet = openTransaksiSheet(SHEET_TX.OPERASI_UDARA);
      var oldRowData = findRowByField(sheet, 'RowID', targetRowId);
      if (!oldRowData || String(oldRowData.obj['Status']) !== ROW_STATUS.ACTIVE) {
        return { success: false, error: 'Baris tidak ditemukan atau bukan status ACTIVE.' };
      }

      // Tandai lama sebagai SUPERSEDED
      updateRowCells(sheet, oldRowData.rowIndex, {
        Status: ROW_STATUS.SUPERSEDED,
        VoidReason: alasanRevisi,
        VoidedBy: session.userId,
        VoidedAt: new Date().toISOString()
      });

      var oldObj = oldRowData.obj;
      var newRowId = Utilities.getUuid();

      var newRow = {
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

        WPPCode: oldObj.WPPCode, // Tidak bisa ubah WPPCode di revisi
        KII: p.KII !== undefined ? p.KII : oldObj.KII,
        KIA: p.KIA !== undefined ? p.KIA : oldObj.KIA,
        ObjekSDK: p.ObjekSDK !== undefined ? p.ObjekSDK : oldObj.ObjekSDK,
        RumponLokalTeridentifikasi: p.RumponLokalTeridentifikasi !== undefined ? p.RumponLokalTeridentifikasi : oldObj.RumponLokalTeridentifikasi,
        CakupanWilayah_NM2: p.CakupanWilayah_NM2 !== undefined ? p.CakupanWilayah_NM2 : oldObj.CakupanWilayah_NM2,
        HariOperasi_Jumlah: p.HariOperasi_Jumlah !== undefined ? p.HariOperasi_Jumlah : oldObj.HariOperasi_Jumlah,
        HariOperasi_Target: p.HariOperasi_Target !== undefined ? p.HariOperasi_Target : oldObj.HariOperasi_Target
      };

      appendRowData(sheet, newRow);
      return { success: true, data: { rowId: newRowId, message: 'Revisi berhasil disimpan.' } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

function operasiUdara_anulir(token, params) {
  return withLock(function() {
    try {
      var session = _opsUdaraRequireSession(token);
      _opsUdaraAssertAnulir(session);

      var p = params || {};
      var targetRowId = p.targetRowId;
      var alasan = p.alasan;

      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!alasan || String(alasan).trim() === '') return { success: false, error: 'Alasan/Komentar anulir wajib diisi.' };

      var sheet = openTransaksiSheet(SHEET_TX.OPERASI_UDARA);
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

      // Notifikasi ke publisher jika anulator beda
      var publisherId = String(target.obj['SubmittedBy']);
      if (publisherId !== session.userId) {
        try {
          var notifSheet = openLogSheet(SHEET_LOG.NOTIFICATIONS);
          appendRowData(notifSheet, {
            NotifID: Utilities.getUuid(),
            UserID: publisherId,
            Jenis: 'DATA_VOIDED',
            Pesan: 'Laporan Operasi Pesawat (WPP ' + target.obj['WPPCode'] + ', ' + target.obj['Periode'] + ') telah dianulir oleh ' + session.role + '. Komentar: ' + String(alasan).trim(),
            IsRead: false,
            CreatedAt: new Date().toISOString()
          });
        } catch(ignored) {}
      }

      return { success: true, message: 'Laporan berhasil dianulir.' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

// ── TREN BULANAN (FASE 8 — chart konteks operasi pesawat) ───

function operasiUdara_getTren(token, filter) {
  try {
    var session = _opsUdaraRequireSession(token);
    _opsUdaraAssertRead(session);

    var sheet = openTransaksiSheet(SHEET_TX.OPERASI_UDARA);
    var rows  = sheetToObjects(sheet);
    var months = utils_getTrendMonths(filter);

    var kapal = [], hari = [], cakupan = [];
    for (var i = 0; i < months.length; i++) { kapal.push(0); hari.push(0); cakupan.push(0); }
    var idx = {};
    months.forEach(function (m, mi) { idx[m] = mi; });

    for (var j = 0; j < rows.length; j++) {
      var r = rows[j];
      if (r.Status !== ROW_STATUS.ACTIVE) continue;
      var mm = String(r.Periode || '').substring(0, 7);
      if (idx[mm] === undefined) continue;
      kapal[idx[mm]]   += (Number(r.KII) || 0) + (Number(r.KIA) || 0);
      hari[idx[mm]]    += (Number(r.HariOperasi_Jumlah) || 0);
      cakupan[idx[mm]] += (Number(r.CakupanWilayah_NM2) || 0);
    }

    return { success: true, data: { months: months, kapal: kapal, hari: hari, cakupan: cakupan } };
  } catch (e) {
    Logger.log('[operasiUdara_getTren] ' + e.message);
    return { success: false, error: e.message };
  }
}