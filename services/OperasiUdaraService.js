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

// Validasi rincian Operasi Udara (hasil pemantauan udara: KII/KIA/objek SDK).
// Asal negara opsional untuk pemantauan udara (tidak seperti penangkapan laut).
var _OPS_UDARA_RINCIAN_RULES = {
  typeField: 'ItemType',
  types: ['KII', 'KIA', 'OBJEK_SDK'],
  required: ['NamaItem'],
  requiredIf: {}
};

function _opsUdaraValidateRincian(items) {
  return _detailValidateItemized(items, _OPS_UDARA_RINCIAN_RULES);
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

    // Lampirkan rincian per-item pemantauan udara untuk modal detail & prefill revisi.
    _detailAttach(history, SHEET_TX.OPERASI_UDARA);

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
      ensureKapalColumns(); // self-heal: pastikan kolom KapalID ada (Fase 12)
      // KapalID WAJIB (Fase 14 Item 6) — sumber bar "Kapal Pengawas Teraktif"
      // di Overview & agregasi Profil Kapal. Kosong = tidak ada yang bisa
      // dihitung, jadi ditolak di server (bukan hanya disembunyikan di UI).
      // Tidak ada pencocokan `JenisKapal` di modul ini: TX_OperasiUdara tidak
      // punya kolom `HariOperasi_Kategori` (lihat DATA_SCHEMA.md), jadi tidak
      // ada kategori yang perlu dicocokkan.
      var kapalIdSubmit = String(p.KapalID || '').trim();
      if (!kapalIdSubmit) {
        return { success: false, error: 'Kapal Pengawas wajib dipilih.' };
      }
      if (!master_kapalExists(kapalIdSubmit)) {
        return { success: false, error: 'KapalID tidak terdaftar di master kapal.' };
      }
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
        KapalID: kapalIdSubmit,
        KII: p.KII || 0,
        KIA: p.KIA || 0,
        ObjekSDK: p.ObjekSDK || 0,
        RumponLokalTeridentifikasi: p.RumponLokalTeridentifikasi || 0,
        CakupanWilayah_NM2: p.CakupanWilayah_NM2 || 0,
        HariOperasi_Jumlah: p.HariOperasi_Jumlah || 0,
        HariOperasi_Target: p.HariOperasi_Target || 180
      };

      // Rincian per-item (opsional): jumlah pemantauan dihitung sistem dari daftar.
      if (p.rincian !== undefined) {
        var detailItems = _opsUdaraValidateRincian(p.rincian);
        if (detailItems.error) return { success: false, error: detailItems.error };
        var counts = _detailCountByType(detailItems.items, 'ItemType', ['KII', 'KIA', 'OBJEK_SDK']);
        newRow.KII = counts.KII;
        newRow.KIA = counts.KIA;
        newRow.ObjekSDK = counts.OBJEK_SDK;
      }

      appendRowData(sheet, newRow);

      if (p.rincian !== undefined) {
        _detailWriteChildren('OPERASI_UDARA', rowId, detailItems.items, {
          DivisiID: session.divisiId, Periode: p.Periode, SubmittedBy: session.userId, Timestamp: newRow.Timestamp
        });
      }

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
      ensureKapalColumns(); // self-heal (Fase 12)
      var oldRowData = findRowByField(sheet, 'RowID', targetRowId);
      if (!oldRowData || String(oldRowData.obj['Status']) !== ROW_STATUS.ACTIVE) {
        return { success: false, error: 'Baris tidak ditemukan atau bukan status ACTIVE.' };
      }

      var oldObj = oldRowData.obj;

      // Semua validasi WAJIB selesai sebelum baris lama ditandai SUPERSEDED —
      // kalau tidak, revisi yang gagal akan menghilangkan data aktif.
      //
      // KapalID wajib (Fase 14 Item 6). Diisi dari form revisi (modal punya
      // pemilih kapal, di-prefill nilai baris lama) atau — ketika client tidak
      // mengirim — diwarisi dari baris lama. Baris lama tanpa KapalID tidak
      // punya sumber nilai, jadi revisi wajib memilih kapal: inilah jalur
      // mengisi kolom kosong pada data lama lewat UI.
      var kapalIdRevisi = String(
        p.KapalID !== undefined ? p.KapalID : (oldObj.KapalID || '')
      ).trim();
      if (!kapalIdRevisi) {
        return { success: false, error: 'Kapal Pengawas wajib dipilih. Laporan lama belum punya kapal — pilih kapal untuk merevisi.' };
      }
      if (!master_kapalExists(kapalIdRevisi)) {
        return { success: false, error: 'KapalID tidak terdaftar di master kapal.' };
      }

      // Validasi rincian per-item HARUS sebelum baris lama ditandai SUPERSEDED
      // (pola data-loss yang sudah diperbaiki di Pemantauan/Intelijen Fase 12).
      var rincianRevisi = null;
      if (p.rincian !== undefined) {
        var detailItems = _opsUdaraValidateRincian(p.rincian);
        if (detailItems.error) return { success: false, error: detailItems.error };
        rincianRevisi = detailItems.items;
      }

      // Tandai lama sebagai SUPERSEDED
      updateRowCells(sheet, oldRowData.rowIndex, {
        Status: ROW_STATUS.SUPERSEDED,
        VoidReason: alasanRevisi,
        VoidedBy: session.userId,
        VoidedAt: new Date().toISOString()
      });

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
        KapalID: kapalIdRevisi,
        KII: p.KII !== undefined ? p.KII : oldObj.KII,
        KIA: p.KIA !== undefined ? p.KIA : oldObj.KIA,
        ObjekSDK: p.ObjekSDK !== undefined ? p.ObjekSDK : oldObj.ObjekSDK,
        RumponLokalTeridentifikasi: p.RumponLokalTeridentifikasi !== undefined ? p.RumponLokalTeridentifikasi : oldObj.RumponLokalTeridentifikasi,
        CakupanWilayah_NM2: p.CakupanWilayah_NM2 !== undefined ? p.CakupanWilayah_NM2 : oldObj.CakupanWilayah_NM2,
        HariOperasi_Jumlah: p.HariOperasi_Jumlah !== undefined ? p.HariOperasi_Jumlah : oldObj.HariOperasi_Jumlah,
        HariOperasi_Target: p.HariOperasi_Target !== undefined ? p.HariOperasi_Target : oldObj.HariOperasi_Target
      };

      // Validasi rincian sudah dijalankan di atas (sebelum SUPERSEDED); di sini
      // hanya menerapkan hitungan turunan.
      if (rincianRevisi !== null) {
        var counts = _detailCountByType(rincianRevisi, 'ItemType', ['KII', 'KIA', 'OBJEK_SDK']);
        newRow.KII = counts.KII;
        newRow.KIA = counts.KIA;
        newRow.ObjekSDK = counts.OBJEK_SDK;
      }

      appendRowData(sheet, newRow);

      if (rincianRevisi !== null) {
        var oldChildren = _detailActiveChildren(SHEET_TX.OPERASI_UDARA, targetRowId);
        _detailSetChildrenStatus(SHEET_TX.OPERASI_UDARA, targetRowId, ROW_STATUS.SUPERSEDED,
          alasanRevisi, session.userId, newRow.Timestamp);
        _detailWriteChildren('OPERASI_UDARA', newRowId, rincianRevisi, {
          DivisiID: session.divisiId,
          Periode: oldObj.Periode,
          SubmittedBy: session.userId,
          Timestamp: newRow.Timestamp,
          supersedes: oldChildren.map(function (c) { return String(c.RowID); })
        });
      }

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

      // Rincian per-item ikut batal (subordinat header).
      _detailSetChildrenStatus(SHEET_TX.OPERASI_UDARA, targetRowId, ROW_STATUS.VOID,
        String(alasan).trim(), session.userId, new Date().toISOString());

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