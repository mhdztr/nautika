/**
 * services/OperasiLautService.js
 * Service backend untuk modul Operasi Laut.
 */

// ===========================================================================
// HELPER & CONSTANTS
// ===========================================================================

function _opsLautRequireSession(token) {
  var session = _getSession(token);
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau belum disetujui.');
  }
  return session;
}

function _opsLautAssertRead(session) {
  // Semua role approved boleh baca, tetapi KADIV/STAF non-OPS ditolak
  if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) return;
  if (session.divisiId !== 'DIV-OPS') {
    throw new Error('FORBIDDEN: Akses data Operasi Laut hanya untuk divisi terkait atau pimpinan.');
  }
}

function _opsLautAssertWrite(session) {
  // Hanya SUPERADMIN, KADIV-OPS, STAF-OPS
  if (session.role === ROLE.SUPERADMIN) return;
  if (session.divisiId !== 'DIV-OPS') {
    throw new Error('FORBIDDEN: Hanya anggota divisi Operasi Laut yang dapat mengubah data.');
  }
  if (session.role !== ROLE.KADIV && session.role !== ROLE.STAF) {
    throw new Error('FORBIDDEN: Role ' + session.role + ' tidak diizinkan mengubah data Operasi Laut.');
  }
}

function _opsLautAssertAnulir(session) {
  // Hanya SUPERADMIN, DIREKTUR, KADIV-OPS
  if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) return;
  if (session.role === ROLE.KADIV && session.divisiId === 'DIV-OPS') return;
  throw new Error('FORBIDDEN: Hanya pimpinan yang dapat melakukan anulir data.');
}

// ===========================================================================
// READ ENDPOINTS
// ===========================================================================

/**
 * Get WPP list for dropdown.
 *
 * Fase 6: auto-seed darurat dihapus — daftar WPP ditarik dari Master Data
 * (master_getWppList). Bila sheet master WPP masih kosong, MasterDataService
 * mengembalikan referensi statis WPP_NRI sebagai fallback READ-ONLY (tidak
 * menulis apa pun ke sheet). Penulisan resmi ke sheet dilakukan lewat
 * halaman Master Data → WPP → "Sinkronkan" (master_syncWpp, Superadmin).
 */
function operasiLaut_getOptions(token) {
  try {
    var session = _opsLautRequireSession(token);
    _opsLautAssertRead(session);

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
 * Mengambil KPI Operasi Laut
 */
function operasiLaut_getKPI(token, filter) {
  try {
    var session = _opsLautRequireSession(token);
    _opsLautAssertRead(session);

    var sheet = openTransaksiSheet(SHEET_TX.OPERASI_LAUT);
    var rows = sheetToObjects(sheet);
    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth()+1, year: new Date().getFullYear() });

    var res = {
      kii: 0,
      kia: 0,
      valuasi_ikan: 0,
      rumpon: 0,
      valuasi_rumpon: 0,
      riksa_kii: 0,
      riksa_kia: 0,
      riksa_sdk: 0,
      hari_operasi_realisasi: 0,
      hari_operasi_target: 180, // Default baseline, but usually calculated per category if needed
      mingguTerakhirSubmit: null,
      wppIntensitas: {} // WPPCode -> jumlah kapal + rumpon (untuk choropleth)
    };

    var latestPeriodeStart = null;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.Status !== ROW_STATUS.ACTIVE) continue;
      
      var isInRange = false;
      var pRange = periodeToDateRange(row.Periode);
      if (pRange) {
        // Cek overlap antara rentang minggu laporan dan rentang filter
        isInRange = pRange.endDate >= range.startDate && pRange.startDate <= range.endDate;
      }

      if (!isInRange) continue;

      // Aggregates
      var kii = Number(row.KII_Ditangkap) || 0;
      var kia = Number(row.KIA_Ditangkap) || 0;
      var rump = Number(row.RumponDitertibkan) || 0;

      res.kii += kii;
      res.kia += kia;
      res.valuasi_ikan += (Number(row.ValuasiIllegalFishing) || 0);
      res.rumpon += rump;
      res.valuasi_rumpon += (Number(row.ValuasiRumpon) || 0);
      res.riksa_kii += (Number(row.HasilRiksa_KII) || 0);
      res.riksa_kia += (Number(row.HasilRiksa_KIA) || 0);
      res.riksa_sdk += (Number(row.HasilRiksa_ObjekSDK) || 0);
      res.hari_operasi_realisasi += (Number(row.HariOperasi_Jumlah) || 0);

      // Intensitas per WPP
      var wpp = row.WPPCode || 'UNKNOWN';
      if (!res.wppIntensitas[wpp]) res.wppIntensitas[wpp] = 0;
      res.wppIntensitas[wpp] += (kii + kia + rump);

      // Latest periode tracking
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
 * Mengambil riwayat laporan
 */
function operasiLaut_getHistory(token, filter) {
  try {
    var session = _opsLautRequireSession(token);
    _opsLautAssertRead(session);

    var sheet = openTransaksiSheet(SHEET_TX.OPERASI_LAUT);
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

function operasiLaut_submit(token, params) {
  return withLock(function() {
    try {
      var session = _opsLautRequireSession(token);
      _opsLautAssertWrite(session);

      var p = params || {};
      if (!p.Periode || !p.WPPCode) {
        return { success: false, error: 'Periode dan WPPCode wajib diisi.' };
      }
      if (!/^\d{4}-\d{2}-W0[1-5]$/.test(p.Periode)) {
        return { success: false, error: 'Format Periode tidak valid. Gunakan YYYY-MM-W0X (contoh: 2026-09-W02).' };
      }

      var sheet = openTransaksiSheet(SHEET_TX.OPERASI_LAUT);
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
        KII_Ditangkap: p.KII_Ditangkap || 0,
        KIA_Ditangkap: p.KIA_Ditangkap || 0,
        AsalNegaraAsing: p.AsalNegaraAsing || '',
        ValuasiIllegalFishing: p.ValuasiIllegalFishing || 0,
        RumponDitertibkan: p.RumponDitertibkan || 0,
        ValuasiRumpon: p.ValuasiRumpon || 0,
        HasilRiksa_Kategori: p.HasilRiksa_Kategori || '',
        HasilRiksa_KII: p.HasilRiksa_KII || 0,
        HasilRiksa_KIA: p.HasilRiksa_KIA || 0,
        HasilRiksa_ObjekSDK: p.HasilRiksa_ObjekSDK || 0,
        HariOperasi_Kategori: p.HariOperasi_Kategori || '',
        HariOperasi_Jumlah: p.HariOperasi_Jumlah || 0,
        HariOperasi_Target: p.HariOperasi_Target || 180
      };

      appendRowData(sheet, newRow);
      return { success: true, data: { rowId: rowId, message: 'Laporan Operasi Laut berhasil disimpan.' } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

function operasiLaut_revisi(token, params) {
  return withLock(function() {
    try {
      var session = _opsLautRequireSession(token);
      _opsLautAssertWrite(session);

      var p = params || {};
      var targetRowId = p.targetRowId;
      var alasanRevisi = p.alasanRevisi;
      
      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!alasanRevisi) return { success: false, error: 'Alasan revisi wajib diisi.' };

      var sheet = openTransaksiSheet(SHEET_TX.OPERASI_LAUT);
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
        KII_Ditangkap: p.KII_Ditangkap !== undefined ? p.KII_Ditangkap : oldObj.KII_Ditangkap,
        KIA_Ditangkap: p.KIA_Ditangkap !== undefined ? p.KIA_Ditangkap : oldObj.KIA_Ditangkap,
        AsalNegaraAsing: p.AsalNegaraAsing !== undefined ? p.AsalNegaraAsing : oldObj.AsalNegaraAsing,
        ValuasiIllegalFishing: p.ValuasiIllegalFishing !== undefined ? p.ValuasiIllegalFishing : oldObj.ValuasiIllegalFishing,
        RumponDitertibkan: p.RumponDitertibkan !== undefined ? p.RumponDitertibkan : oldObj.RumponDitertibkan,
        ValuasiRumpon: p.ValuasiRumpon !== undefined ? p.ValuasiRumpon : oldObj.ValuasiRumpon,
        HasilRiksa_Kategori: p.HasilRiksa_Kategori !== undefined ? p.HasilRiksa_Kategori : oldObj.HasilRiksa_Kategori,
        HasilRiksa_KII: p.HasilRiksa_KII !== undefined ? p.HasilRiksa_KII : oldObj.HasilRiksa_KII,
        HasilRiksa_KIA: p.HasilRiksa_KIA !== undefined ? p.HasilRiksa_KIA : oldObj.HasilRiksa_KIA,
        HasilRiksa_ObjekSDK: p.HasilRiksa_ObjekSDK !== undefined ? p.HasilRiksa_ObjekSDK : oldObj.HasilRiksa_ObjekSDK,
        HariOperasi_Kategori: p.HariOperasi_Kategori !== undefined ? p.HariOperasi_Kategori : oldObj.HariOperasi_Kategori,
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

function operasiLaut_anulir(token, params) {
  return withLock(function() {
    try {
      var session = _opsLautRequireSession(token);
      _opsLautAssertAnulir(session);

      var p = params || {};
      var targetRowId = p.targetRowId;
      var alasan = p.alasan;

      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!alasan || String(alasan).trim() === '') return { success: false, error: 'Alasan/Komentar anulir wajib diisi.' };

      var sheet = openTransaksiSheet(SHEET_TX.OPERASI_LAUT);
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
            Pesan: 'Laporan Operasi Laut (WPP ' + target.obj['WPPCode'] + ', ' + target.obj['Periode'] + ') telah dianulir oleh ' + session.role + '. Komentar: ' + String(alasan).trim(),
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

// ── TREN BULANAN (FASE 8 — chart konteks operasi laut) ──────

function operasiLaut_getTren(token, filter) {
  try {
    var session = _opsLautRequireSession(token);
    _opsLautAssertRead(session);

    var sheet = openTransaksiSheet(SHEET_TX.OPERASI_LAUT);
    var rows  = sheetToObjects(sheet);
    var months = utils_getTrendMonths(filter);

    var kapal = [], rumpon = [], hari = [];
    for (var i = 0; i < months.length; i++) { kapal.push(0); rumpon.push(0); hari.push(0); }
    var idx = {};
    months.forEach(function (m, mi) { idx[m] = mi; });

    for (var j = 0; j < rows.length; j++) {
      var r = rows[j];
      if (r.Status !== ROW_STATUS.ACTIVE) continue;
      var mm = String(r.Periode || '').substring(0, 7);
      if (idx[mm] === undefined) continue;
      kapal[idx[mm]] += (Number(r.KII_Ditangkap) || 0) + (Number(r.KIA_Ditangkap) || 0);
      rumpon[idx[mm]] += (Number(r.RumponDitertibkan) || 0);
      hari[idx[mm]]   += (Number(r.HariOperasi_Jumlah) || 0);
    }

    return { success: true, data: { months: months, kapal: kapal, rumpon: rumpon, hari: hari } };
  } catch (e) {
    Logger.log('[operasiLaut_getTren] ' + e.message);
    return { success: false, error: e.message };
  }
}
