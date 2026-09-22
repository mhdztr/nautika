/**
 * services/MasterDataService.js
 * Master Data — Kapal, Kawasan Konservasi, WPP (PRD §5.11).
 *
 * Fungsi publik (google.script.run):
 *   master_getKapalList(token)
 *   master_createKapal(token, params)
 *   master_updateKapal(token, params)
 *   master_getKawasanList(token)
 *   master_createKawasan(token, params)
 *   master_updateKawasan(token, params)
 *   master_deleteKawasan(token, params)
 *   master_getWppList(token)
 *   master_syncWpp(token)
 *
 * RBAC (PRD §5.11):
 *   CRUD Kapal & Kawasan : SUPERADMIN + DIREKTUR
 *   Master WPP           : read-only (semua APPROVED); sinkron manual hanya SUPERADMIN
 *   Baca master (umum)   : semua APPROVED — master adalah referensi lintas modul (PRD §6)
 *
 * Catatan penghapusan:
 *   - Kapal: soft-delete (StatusAktif = false). KapalID dipakai sebagai referensi
 *     lintas modul (TX_Pemantauan, TX_Perawatan_*), jadi tidak dihapus fisik.
 *   - Kawasan: delete fisik (sheet Kawasan_Konservasi tidak punya kolom StatusAktif).
 *     Risiko referensi yatim (TX_Intelijen.KawasanID) dicatat sebagai item terbuka.
 *   - Audit (create/update/delete/sync) selalu dicatat ke Audit_Log.
 */

// CATATAN: JANGAN membaca konstanta global (SHEET_MASTER, WPP_NRI, dll) di
// level top-file. GAS memuat file urut abjad (data/ → services/ → utils/),
// jadi utils/Constants.js belum dievaluasi saat services/*.js di-load.
// Referensi konstanta hanya boleh dilakukan DI DALAM fungsi (runtime).

// ===========================================================================
// RBAC
// ===========================================================================

function _mdRequireSession(token) {
  var session = _getSession(token);
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau belum disetujui.');
  }
  return session;
}

/** Baca master: semua APPROVED boleh (referensi lintas modul, PRD §6). */
function _mdAssertRead(session) {
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Akun belum aktif.');
  }
}

/** Tulis master Kapal & Kawasan: SUPERADMIN + DIREKTUR (PRD §5.11). */
function _mdAssertWrite(session) {
  assertScope(session, [ROLE.SUPERADMIN, ROLE.DIREKTUR], null);
}

/** Sinkron WPP: SUPERADMIN saja (PRD §5.11 — Master WPP read-only, sinkron oleh Superadmin). */
function _mdAssertSuperadmin(session) {
  assertScope(session, [ROLE.SUPERADMIN], null);
}

// ===========================================================================
// MASTER KAPAL
// ===========================================================================

/**
 * Daftar seluruh kapal (semua status), diurutkan berdasarkan Nama.
 * @param {string} token
 */
function master_getKapalList(token) {
  try {
    var session = _mdRequireSession(token);
    _mdAssertRead(session);

    var sheet = openMasterSheet(SHEET_MASTER.KAPAL);
    var rows = sheetToObjects(sheet);

    var data = rows.map(_normalizeKapal);
    data.sort(function (a, b) { return (a.nama || '').localeCompare(b.nama || ''); });

    return { success: true, data: data };
  } catch (e) {
    Logger.log('[master_getKapalList] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Tambah kapal baru.
 * @param {string} token
 * @param {{kapalId:string, nama:string, kelas:string, homebaseUpt:string, statusAktif:boolean}} params
 */
function master_createKapal(token, params) {
  try {
    return withLock(function () {
      var session = _mdRequireSession(token);
      _mdAssertWrite(session);

      var p = params || {};
      var kapalId     = _reqText(p.kapalId,     'KapalID');
      var nama        = _reqText(p.nama,        'Nama kapal');
      var kelas       = _optText(p.kelas);
      var homebaseUpt = _optText(p.homebaseUpt);
      var statusAktif = _optBool(p.statusAktif, true);

      var sheet = openMasterSheet(SHEET_MASTER.KAPAL);
      if (findRowByField(sheet, 'KapalID', kapalId)) {
        return { success: false, error: 'Kapal dengan ID ' + kapalId + ' sudah terdaftar.' };
      }

      appendRowData(sheet, {
        KapalID: kapalId, Nama: nama, Kelas: kelas,
        Homebase_UPT: homebaseUpt, StatusAktif: statusAktif
      });

      _mdAuditLog(session.userId, 'CREATE', SHEET_MASTER.KAPAL, kapalId, 'Tambah kapal: ' + nama);
      return { success: true, message: 'Kapal ' + nama + ' berhasil ditambahkan.' };
    });
  } catch (e) {
    Logger.log('[master_createKapal] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Update kapal (field opsional — diisi yang berubah saja).
 * @param {string} token
 * @param {{kapalId:string, nama:string, kelas:string, homebaseUpt:string, statusAktif:boolean}} params
 */
function master_updateKapal(token, params) {
  try {
    return withLock(function () {
      var session = _mdRequireSession(token);
      _mdAssertWrite(session);

      var p = params || {};
      var kapalId = _reqText(p.kapalId, 'KapalID');

      var sheet = openMasterSheet(SHEET_MASTER.KAPAL);
      var found = findRowByField(sheet, 'KapalID', kapalId);
      if (!found) return { success: false, error: 'Kapal ' + kapalId + ' tidak ditemukan.' };

      var updates = {};
      if (p.nama !== undefined)        updates.Nama        = _reqText(p.nama, 'Nama kapal');
      if (p.kelas !== undefined)       updates.Kelas       = _optText(p.kelas);
      if (p.homebaseUpt !== undefined) updates.Homebase_UPT = _optText(p.homebaseUpt);
      if (p.statusAktif !== undefined) updates.StatusAktif = _optBool(p.statusAktif, true);

      if (Object.keys(updates).length > 0) {
        updateRowCells(sheet, found.rowIndex, updates);
      }

      _mdAuditLog(session.userId, 'UPDATE', SHEET_MASTER.KAPAL, kapalId,
        'Perbarui kapal: ' + Object.keys(updates).join(', '));
      return { success: true, message: 'Data kapal ' + kapalId + ' diperbarui.' };
    });
  } catch (e) {
    Logger.log('[master_updateKapal] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===========================================================================
// MASTER KAWASAN KONSERVASI
// ===========================================================================

/**
 * Daftar seluruh kawasan konservasi.
 * @param {string} token
 */
function master_getKawasanList(token) {
  try {
    var session = _mdRequireSession(token);
    _mdAssertRead(session);

    var sheet = openMasterSheet(SHEET_MASTER.KAWASAN_KONSERVASI);
    var rows = sheetToObjects(sheet);

    var data = rows.map(_normalizeKawasan);
    data.sort(function (a, b) { return (a.nama || '').localeCompare(b.nama || ''); });

    return { success: true, data: data };
  } catch (e) {
    Logger.log('[master_getKawasanList] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Tambah kawasan konservasi baru.
 * @param {string} token
 * @param {{kawasanId:string, nama:string, provinsi:string, latitude:number|null, longitude:number|null}} params
 */
function master_createKawasan(token, params) {
  try {
    return withLock(function () {
      var session = _mdRequireSession(token);
      _mdAssertWrite(session);

      var p = params || {};
      var kawasanId = _reqText(p.kawasanId, 'KawasanID');
      var nama      = _reqText(p.nama,      'Nama kawasan');
      var provinsi  = _reqText(p.provinsi,  'Provinsi');
      var lat       = _optNumber(p.latitude);
      var lng       = _optNumber(p.longitude);

      var sheet = openMasterSheet(SHEET_MASTER.KAWASAN_KONSERVASI);
      if (findRowByField(sheet, 'KawasanID', kawasanId)) {
        return { success: false, error: 'Kawasan dengan ID ' + kawasanId + ' sudah terdaftar.' };
      }

      appendRowData(sheet, {
        KawasanID: kawasanId, Nama: nama, Provinsi: provinsi,
        Latitude: lat, Longitude: lng
      });

      _mdAuditLog(session.userId, 'CREATE', SHEET_MASTER.KAWASAN_KONSERVASI, kawasanId, 'Tambah kawasan: ' + nama);
      return { success: true, message: 'Kawasan ' + nama + ' berhasil ditambahkan.' };
    });
  } catch (e) {
    Logger.log('[master_createKawasan] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Update kawasan (field opsional — diisi yang berubah saja).
 * @param {string} token
 * @param {{kawasanId:string, nama:string, provinsi:string, latitude:number|null, longitude:number|null}} params
 */
function master_updateKawasan(token, params) {
  try {
    return withLock(function () {
      var session = _mdRequireSession(token);
      _mdAssertWrite(session);

      var p = params || {};
      var kawasanId = _reqText(p.kawasanId, 'KawasanID');

      var sheet = openMasterSheet(SHEET_MASTER.KAWASAN_KONSERVASI);
      var found = findRowByField(sheet, 'KawasanID', kawasanId);
      if (!found) return { success: false, error: 'Kawasan ' + kawasanId + ' tidak ditemukan.' };

      var updates = {};
      if (p.nama !== undefined)      updates.Nama       = _reqText(p.nama, 'Nama kawasan');
      if (p.provinsi !== undefined)  updates.Provinsi   = _reqText(p.provinsi, 'Provinsi');
      if (p.latitude !== undefined)  updates.Latitude   = _optNumber(p.latitude);
      if (p.longitude !== undefined) updates.Longitude  = _optNumber(p.longitude);

      if (Object.keys(updates).length > 0) {
        updateRowCells(sheet, found.rowIndex, updates);
      }

      _mdAuditLog(session.userId, 'UPDATE', SHEET_MASTER.KAWASAN_KONSERVASI, kawasanId,
        'Perbarui kawasan: ' + Object.keys(updates).join(', '));
      return { success: true, message: 'Data kawasan ' + kawasanId + ' diperbarui.' };
    });
  } catch (e) {
    Logger.log('[master_updateKawasan] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Hapus kawasan (fisik — sheet tidak punya kolom StatusAktif).
 * @param {string} token
 * @param {{kawasanId:string}} params
 */
function master_deleteKawasan(token, params) {
  try {
    return withLock(function () {
      var session = _mdRequireSession(token);
      _mdAssertWrite(session);

      var kawasanId = _reqText((params || {}).kawasanId, 'KawasanID');

      var sheet = openMasterSheet(SHEET_MASTER.KAWASAN_KONSERVASI);
      var found = findRowByField(sheet, 'KawasanID', kawasanId);
      if (!found) return { success: false, error: 'Kawasan ' + kawasanId + ' tidak ditemukan.' };

      sheet.deleteRow(found.rowIndex);

      _mdAuditLog(session.userId, 'DELETE', SHEET_MASTER.KAWASAN_KONSERVASI, kawasanId, 'Hapus kawasan konservasi.');
      return { success: true, message: 'Kawasan ' + kawasanId + ' dihapus.' };
    });
  } catch (e) {
    Logger.log('[master_deleteKawasan] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===========================================================================
// MASTER WPP
// ===========================================================================

/**
 * Daftar WPP (read-only). Jika sheet master WPP belum diisi, mengembalikan
 * referensi statis WPP_NRI (dari wpp_final.geojson) sebagai fallback read-only —
 * tanpa menulis apa pun ke sheet. Tanda `fromFallback` di-set true supaya
 * frontend bisa menampilkan catatan "belum disinkronkan".
 *
 * @param {string} token
 * @returns {{success:boolean, data:Array, fromFallback:boolean}}
 */
function master_getWppList(token) {
  try {
    var session = _mdRequireSession(token);
    _mdAssertRead(session);

    var sheet = openMasterSheet(SHEET_MASTER.WPP);
    var rows = sheetToObjects(sheet);

    var fromFallback = rows.length === 0;
    if (fromFallback) rows = WPP_NRI.slice();

    var data = rows.map(function (row) {
      return { WPPCode: String(row.WPPCode), NamaWilayah: String(row.NamaWilayah) };
    });

    return { success: true, data: data, fromFallback: fromFallback };
  } catch (e) {
    Logger.log('[master_getWppList] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Sinkronisi resmi sheet master WPP dari referensi geospasial WPP_NRI.
 * Idempotent: hanya menambah WPP yang belum ada, tidak menimpa baris yang
 * sudah ada (nama wilayah yang diedit manual tetap dipertahankan).
 *
 * @param {string} token
 * @returns {{success:boolean, added:number, total:number}}
 */
function master_syncWpp(token) {
  try {
    return withLock(function () {
      var session = _mdRequireSession(token);
      _mdAssertSuperadmin(session);

      var sheet = openMasterSheet(SHEET_MASTER.WPP);
      var added = 0;

      WPP_NRI.forEach(function (w) {
        if (!findRowByField(sheet, 'WPPCode', w.WPPCode)) {
          appendRowData(sheet, { WPPCode: w.WPPCode, NamaWilayah: w.NamaWilayah });
          added++;
        }
      });

      _mdAuditLog(session.userId, 'SYNC', SHEET_MASTER.WPP, '',
        'Sinkronisasi master WPP dari referensi geospasial: ' + added + ' baris baru.');

      var total = sheetToObjects(sheet).length;
      return {
        success: true,
        message: added > 0
          ? 'WPP disinkronkan: ' + added + ' ditambahkan (total ' + total + ').'
          : 'Master WPP sudah lengkap (total ' + total + '). Tidak ada yang ditambahkan.',
        added: added,
        total: total
      };
    });
  } catch (e) {
    Logger.log('[master_syncWpp] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===========================================================================
// OPSI (daftar pilihan dinamis) — PRD §5.11 Master Data
// Kelola nilai enum yang bisa ditambah: Amunisi, BBM, Komponen Personil,
// Kategori Pengawakan (DATA_SCHEMA `Opsi`). Preview & add disediakan ke
// SUPERADMIN + DIREKTUR (sama dengan CRUD Kapal/Kawasan master).
// ===========================================================================

/**
 * Seluruh daftar opsi per grup (detail: label, aktif, urutan) untuk halaman
 * Master Data. Read: semua APPROVED — dropdown modul memakainya juga.
 * @param {string} token
 */
function master_getOpsiJenis(token) {
  try {
    var session = _mdRequireSession(token);
    _mdAssertRead(session);

    var groups = {};
    Object.keys(OPSI_KODE).forEach(function (k) {
      groups[OPSI_KODE[k]] = getOpsiDetail(OPSI_KODE[k]);
    });

    var labels = {};
    labels[OPSI_KODE.AMUNISI]       = 'Jenis Amunisi';
    labels[OPSI_KODE.BBM]           = 'Jenis BBM';
    labels[OPSI_KODE.KOM_PERSONIL]  = 'Komponen Logistik Personil';
    labels[OPSI_KODE.AWAK_KATEGORI] = 'Kategori Personil Pengawakan';

    return { success: true, data: { groups: groups, labels: labels, kodeList: Object.keys(OPSI_KODE) } };
  } catch (e) {
    Logger.log('[master_getOpsiJenis] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Tambah satu nilai baru ke sebuah grup opsi.
 * @param {string} token
 * @param {{kode:string, label:string}} params
 */
function master_addOpsiJenis(token, params) {
  try {
    return withLock(function () {
      var session = _mdRequireSession(token);
      _mdAssertWrite(session);

      var p = params || {};
      var kode  = _reqText(p.kode, 'Kode opsi');
      var label = _reqText(p.label, 'Nama opsi').toUpperCase();
      if (!OPSI_DEFAULT[kode]) {
        return { success: false, error: 'Kode opsi tidak dikenal.' };
      }
      if (label.length > 40) {
        return { success: false, error: 'Nama opsi maksimal 40 karakter.' };
      }

      var sheet = ensureOpsiSheet();
      var rows  = sheetToObjects(sheet);
      var maxUrutan = 0;
      var exists = false;
      rows.forEach(function (r) {
        if (String(r['Kode']) === kode) {
          var u = Number(r['Urutan']) || 0;
          if (u > maxUrutan) maxUrutan = u;
          if (String(r['Label']) === label) exists = true;
        }
      });
      if (exists) {
        return { success: false, error: 'Nilai "' + label + '" sudah ada di grup ini.' };
      }
      if ((OPSI_DEFAULT[kode] || []).indexOf(label) !== -1) {
        return { success: false, error: 'Nilai "' + label + '" adalah bawaan sistem.' };
      }

      appendRowData(sheet, {
        'Kode':       kode,
        'Urutan':     maxUrutan + 1,
        'Label':      label,
        'Aktif':      true,
        'DibuatOleh': session.userId,
        'DibuatAt':   new Date()
      });
      _mdAuditLog(session.userId, 'CREATE', SHEET_MASTER.OPSI, kode,
        'Tambah opsi ' + kode + ' = ' + label);

      return { success: true, message: 'Opsi "' + label + '" ditambahkan ke ' + kode + '.' };
    });
  } catch (e) {
    Logger.log('[master_addOpsiJenis] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Aktif/nonaktifkan satu nilai (non-aktif = tersembunyi dari dropdown baru;
 * data historis tetap aman).
 * @param {string} token
 * @param {{kode:string, label:string, aktif:boolean}} params
 */
function master_setOpsiJenisAktif(token, params) {
  try {
    return withLock(function () {
      var session = _mdRequireSession(token);
      _mdAssertWrite(session);

      var p = params || {};
      var kode  = _reqText(p.kode, 'Kode opsi');
      var label = _reqText(p.label, 'Nama opsi').toUpperCase();
      var aktif = p.aktif === true || p.aktif === 'true';
      if (!OPSI_DEFAULT[kode]) {
        return { success: false, error: 'Kode opsi tidak dikenal.' };
      }

      var sheet = ensureOpsiSheet();
      var rows  = sheetToObjects(sheet);
      var found = null;
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i]['Kode']) === kode && String(rows[i]['Label']) === label) {
          found = i + 2; // baris data (header = 1)
          break;
        }
      }
      if (!found) {
        return { success: false, error: 'Nilai "' + label + '" tidak ditemukan di ' + kode + '.' };
      }
      updateRowCells(sheet, found, { 'Aktif': aktif });
      _mdAuditLog(session.userId, 'UPDATE', SHEET_MASTER.OPSI, kode,
        'Ubah status opsi ' + kode + ' = ' + label + ' → ' + (aktif ? 'aktif' : 'non-aktif'));

      return { success: true, message: 'Opsi "' + label + '" kini ' + (aktif ? 'aktif' : 'non-aktif') + '.' };
    });
  } catch (e) {
    Logger.log('[master_setOpsiJenisAktif] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===========================================================================
// HELPER NORMALISASI & VALIDASI
// ===========================================================================

function _normalizeKapal(row) {
  return {
    kapalId:    String(row['KapalID']   === undefined || row['KapalID'] === null ? '' : row['KapalID']),
    nama:       String(row['Nama']      === undefined || row['Nama'] === null ? '' : row['Nama']),
    kelas:      String(row['Kelas']     === undefined || row['Kelas'] === null ? '' : row['Kelas']),
    homebaseUpt:String(row['Homebase_UPT'] === undefined || row['Homebase_UPT'] === null ? '' : row['Homebase_UPT']),
    statusAktif: row['StatusAktif'] === true || String(row['StatusAktif']) === 'true' ||
                 String(row['StatusAktif']) === 'TRUE' || row['StatusAktif'] === 1
  };
}

function _normalizeKawasan(row) {
  return {
    kawasanId: String(row['KawasanID'] === undefined || row['KawasanID'] === null ? '' : row['KawasanID']),
    nama:      String(row['Nama']      === undefined || row['Nama'] === null ? '' : row['Nama']),
    provinsi:  String(row['Provinsi']  === undefined || row['Provinsi'] === null ? '' : row['Provinsi']),
    latitude:  _cleanNullableNumber(row['Latitude']),
    longitude: _cleanNullableNumber(row['Longitude'])
  };
}

function _cleanNullableNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function _reqText(val, label) {
  var s = String(val === undefined || val === null ? '' : val).trim();
  if (!s) throw new Error(label + ' wajib diisi.');
  return s;
}

function _optText(val) {
  return String(val === undefined || val === null ? '' : val).trim();
}

function _optBool(val, defaultVal) {
  if (val === undefined || val === null) return defaultVal;
  return val === true || String(val).toLowerCase() === 'true' || val === 1;
}

function _optNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  var n = parseFloat(val);
  if (isNaN(n)) throw new Error('Latitude/Longitude harus berupa angka.');
  return n;
}

// ===========================================================================
// LOG & NOTIFIKASI
// ===========================================================================

function _mdAuditLog(userId, aksi, sheetTarget, rowIdTarget, alasan) {
  try {
    appendRowData(openLogSheet(SHEET_LOG.AUDIT_LOG), {
      'LogID':       'LOG-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
      'UserID':      userId,
      'Aksi':        aksi,
      'SheetTarget': sheetTarget,
      'RowIDTarget': rowIdTarget,
      'Alasan':      alasan,
      'Timestamp':   new Date()
    });
  } catch (e) {
    Logger.log('[_mdAuditLog] ' + e.message);
  }
}