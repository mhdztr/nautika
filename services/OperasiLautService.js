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

// Validasi rincian Operasi Laut (kapal KII/KIA + rumpon). KII = Indonesia,
// KIA = Asing (asal negara wajib), RUMPON = wajib pilih WPP terkait (PRD §5.3).
var _OPS_LAUT_RINCIAN_RULES = {
  typeField: 'ItemType',
  types: ['KII', 'KIA', 'RUMPON'],
  required: ['NamaItem'],
  requiredIf: { AsalNegara: ['KIA'], WPPCode: ['RUMPON'] }
};

function _opsLautValidateRincian(items) {
  return _detailValidateItemized(items, _OPS_LAUT_RINCIAN_RULES);
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
      }),
      // Enum referensi diambil dari sheet `Opsi`.
      opsi: {
        riksa: getOpsiItems(OPSI_KODE.OPS_RIKSA_KATEGORI),
        hari:  getOpsiItems(OPSI_KODE.OPS_HARI_KATEGORI)
      }
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

    // Lampirkan rincian per-item (kapal/rumpon) untuk modal detail & prefill revisi.
    _detailAttach(history, SHEET_TX.OPERASI_LAUT);

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
      ensureKapalColumns(); // self-heal: pastikan kolom KapalID ada (Fase 12)
      // KapalID WAJIB (Fase 14 Item 6) — sumber bar "Kapal Pengawas Teraktif"
      // di Overview & agregasi Profil Kapal. Kosong = tidak ada yang bisa
      // dihitung, jadi ditolak di server (bukan hanya disembunyikan di UI).
      var kapalIdSubmit = String(p.KapalID || '').trim();
      if (!kapalIdSubmit) {
        return { success: false, error: 'Kapal Pengawas wajib dipilih.' };
      }
      if (!master_kapalExists(kapalIdSubmit)) {
        return { success: false, error: 'KapalID tidak terdaftar di master kapal.' };
      }
      // Kategori Riksa & Hari Operasi = enum referensi dari sheet `Opsi`.
      var riksaKat = String(p.HasilRiksa_Kategori || '').trim().toUpperCase();
      if (riksaKat && getOpsiList(OPSI_KODE.OPS_RIKSA_KATEGORI).indexOf(riksaKat) === -1) {
        return { success: false, error: 'Kategori Riksa tidak valid.' };
      }
      var hariKat = String(p.HariOperasi_Kategori || '').trim().toUpperCase();
      if (hariKat && getOpsiList(OPSI_KODE.OPS_HARI_KATEGORI).indexOf(hariKat) === -1) {
        return { success: false, error: 'Kategori Hari Operasi tidak valid.' };
      }
      // Kapal harus cocok dengan kategori hari operasi yang dipilih. Kapal lama
      // tanpa `JenisKapal` (kolom baru) tidak dibatasi — lihat
      // `master_kapalCocokKategori`.
      if (!master_kapalCocokKategori(kapalIdSubmit, hariKat)) {
        return { success: false, error: 'Kapal yang dipilih jenisnya (' +
          getOpsiLabel(OPSI_KODE.KAPAL_JENIS, master_kapalJenis(kapalIdSubmit)) +
          ') tidak cocok dengan kategori hari operasi. Pilih kapal lain atau ubah kategori.' };
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
        KII_Ditangkap: p.KII_Ditangkap || 0,
        KIA_Ditangkap: p.KIA_Ditangkap || 0,
        AsalNegaraAsing: p.AsalNegaraAsing || '',
        ValuasiIllegalFishing: p.ValuasiIllegalFishing || 0,
        RumponDitertibkan: p.RumponDitertibkan || 0,
        ValuasiRumpon: p.ValuasiRumpon || 0,
        HasilRiksa_Kategori: riksaKat,
        HasilRiksa_KII: p.HasilRiksa_KII || 0,
        HasilRiksa_KIA: p.HasilRiksa_KIA || 0,
        HasilRiksa_ObjekSDK: p.HasilRiksa_ObjekSDK || 0,
        HariOperasi_Kategori: hariKat,
        HariOperasi_Jumlah: p.HariOperasi_Jumlah || 0,
        HariOperasi_Target: p.HariOperasi_Target || 180
      };

      // Rincian per-item (opsional): jumlah kapal/rumpon dihitung sistem dari
      // rincian, bukan diinput manual — lihat DATA_SCHEMA.md (kolom dihitung).
      if (p.rincian !== undefined) {
        var detailItems = _opsLautValidateRincian(p.rincian);
        if (detailItems.error) return { success: false, error: detailItems.error };
        var counts = _detailCountByType(detailItems.items, 'ItemType', ['KII', 'KIA', 'RUMPON']);
        newRow.KII_Ditangkap = counts.KII;
        newRow.KIA_Ditangkap = counts.KIA;
        newRow.RumponDitertibkan = counts.RUMPON;
        newRow.AsalNegaraAsing = _detailUniqueJoin(detailItems.items, 'ItemType', 'KIA', 'AsalNegara');
      }

      appendRowData(sheet, newRow);

      if (p.rincian !== undefined) {
        _detailWriteChildren('OPERASI_LAUT', rowId, detailItems.items, {
          DivisiID: session.divisiId, Periode: p.Periode, SubmittedBy: session.userId, Timestamp: newRow.Timestamp
        });
      }

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
      ensureKapalColumns(); // self-heal (Fase 12)
      var oldRowData = findRowByField(sheet, 'RowID', targetRowId);
      if (!oldRowData || String(oldRowData.obj['Status']) !== ROW_STATUS.ACTIVE) {
        return { success: false, error: 'Baris tidak ditemukan atau bukan status ACTIVE.' };
      }

      var oldObj = oldRowData.obj;
      // Validasi enum referensi (sumber: sheet `Opsi`) bila dikirim.
      var riksaKat = String(p.HasilRiksa_Kategori || '').trim().toUpperCase();
      if (riksaKat && getOpsiList(OPSI_KODE.OPS_RIKSA_KATEGORI).indexOf(riksaKat) === -1) {
        return { success: false, error: 'Kategori Riksa tidak valid.' };
      }
      // Kategori EFEKTIF = yang dikirim, atau nilai lama bila tidak dikirim.
      // `hariKat` ini juga yang ditulis ke baris baru. Kalau kita hanya melihat
      // nilai `p`, revisi yang tidak mengirim kategori akan lolos validasi kapal
      // untuk kategori kosong — padahal baris hasilnya memakai kategori lama,
      // jadi kapal yang tidak cocok pun bisa masuk.
      var hariKat = String(
        p.HariOperasi_Kategori ? p.HariOperasi_Kategori : (oldObj.HariOperasi_Kategori || '')
      ).trim().toUpperCase();
      if (hariKat && getOpsiList(OPSI_KODE.OPS_HARI_KATEGORI).indexOf(hariKat) === -1) {
        return { success: false, error: 'Kategori Hari Operasi tidak valid.' };
      }

      // Semua validasi WAJIB selesai sebelum baris lama ditandai SUPERSEDED —
      // kalau tidak, revisi yang gagal akan menghilangkan data aktif (bug yang
      // pernah terjadi dan sudah diperbaiki).
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
      if (!master_kapalCocokKategori(kapalIdRevisi, hariKat)) {
        return { success: false, error: 'Kapal yang dipilih jenisnya (' +
          getOpsiLabel(OPSI_KODE.KAPAL_JENIS, master_kapalJenis(kapalIdRevisi)) +
          ') tidak cocok dengan kategori hari operasi. Pilih kapal lain atau ubah kategori.' };
      }

      // Validasi rincian per-item HARUS sebelum baris lama ditandai SUPERSEDED.
      // Kalau tidak, revisi yang gagal (mis. nama kapal kosong) meninggalkan data
      // aktif hilang tanpa bar pengganti — pola yang sudah diperbaiki di
      // Pemantauan/Intelijen (Fase 12) tapi belum ikut diterapkan di modul ini.
      var rincianRevisi = null;
      if (p.rincian !== undefined) {
        var detailItems = _opsLautValidateRincian(p.rincian);
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
        KII_Ditangkap: p.KII_Ditangkap !== undefined ? p.KII_Ditangkap : oldObj.KII_Ditangkap,
        KIA_Ditangkap: p.KIA_Ditangkap !== undefined ? p.KIA_Ditangkap : oldObj.KIA_Ditangkap,
        AsalNegaraAsing: p.AsalNegaraAsing !== undefined ? p.AsalNegaraAsing : oldObj.AsalNegaraAsing,
        ValuasiIllegalFishing: p.ValuasiIllegalFishing !== undefined ? p.ValuasiIllegalFishing : oldObj.ValuasiIllegalFishing,
        RumponDitertibkan: p.RumponDitertibkan !== undefined ? p.RumponDitertibkan : oldObj.RumponDitertibkan,
        ValuasiRumpon: p.ValuasiRumpon !== undefined ? p.ValuasiRumpon : oldObj.ValuasiRumpon,
        HasilRiksa_Kategori: riksaKat !== undefined && riksaKat !== '' ? riksaKat : String(oldObj.HasilRiksa_Kategori || ''),
        HasilRiksa_KII: p.HasilRiksa_KII !== undefined ? p.HasilRiksa_KII : oldObj.HasilRiksa_KII,
        HasilRiksa_KIA: p.HasilRiksa_KIA !== undefined ? p.HasilRiksa_KIA : oldObj.HasilRiksa_KIA,
        HasilRiksa_ObjekSDK: p.HasilRiksa_ObjekSDK !== undefined ? p.HasilRiksa_ObjekSDK : oldObj.HasilRiksa_ObjekSDK,
        // `hariKat` sudah nilai efektif (p, atau warisan baris lama).
        HariOperasi_Kategori: hariKat,
        HariOperasi_Jumlah: p.HariOperasi_Jumlah !== undefined ? p.HariOperasi_Jumlah : oldObj.HariOperasi_Jumlah,
        HariOperasi_Target: p.HariOperasi_Target !== undefined ? p.HariOperasi_Target : oldObj.HariOperasi_Target
      };

      // Validasi rincian per-item sudah dijalankan di atas (sebelum SUPERSEDED);
      // di sini hanya menerapkan hitungan turunan.
      // Bila `rincian` tidak dikirim → nilai header lama dipertahankan (tanpa rebase).
      if (rincianRevisi !== null) {
        var counts = _detailCountByType(rincianRevisi, 'ItemType', ['KII', 'KIA', 'RUMPON']);
        newRow.KII_Ditangkap = counts.KII;
        newRow.KIA_Ditangkap = counts.KIA;
        newRow.RumponDitertibkan = counts.RUMPON;
        newRow.AsalNegaraAsing = _detailUniqueJoin(rincianRevisi, 'ItemType', 'KIA', 'AsalNegara');
      }

      appendRowData(sheet, newRow);

      if (rincianRevisi !== null) {
        // SupersedesRowID rincian baru = RowID rincian lama pada urutan yang sama.
        var oldChildren = _detailActiveChildren(SHEET_TX.OPERASI_LAUT, targetRowId);
        _detailSetChildrenStatus(SHEET_TX.OPERASI_LAUT, targetRowId, ROW_STATUS.SUPERSEDED,
          alasanRevisi, session.userId, newRow.Timestamp);
        _detailWriteChildren('OPERASI_LAUT', newRowId, rincianRevisi, {
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

      // Rincian per-item ikut batal (subordinat header).
      _detailSetChildrenStatus(SHEET_TX.OPERASI_LAUT, targetRowId, ROW_STATUS.VOID,
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
