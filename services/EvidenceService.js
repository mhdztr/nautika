/**
 * services/EvidenceService.js
 * Modul lampiran (evidence) generik — dipakai pertama oleh modul Perawatan (Fase 9).
 *
 * Fungsi publik (google.script.run):
 *   evidence_upload(token, params)         — upload file langsung (base64)
 *   evidence_uploadFromLink(token, params) — salin file dari link Google Drive
 *   evidence_list(token, refSheet, refRowId)
 *   evidence_listBatch(token, refSheet, refRowIds)
 *
 * Aturan (PRD §11 + ARCHITECTURE §6):
 *   - Lampiran per-item: satu baris tujuan bisa punya banyak lampiran.
 *   - Dua mode: UPLOAD (base64 via Apps Script) & DRIVE_LINK_COPY (makeCopy).
 *   - Batas ukuran: file umum 15MB; video maksimal 50MB (di atas itu ditolak).
 *   - Struktur folder Drive: [Divisi] / [YYYY-MM] / [JenisKonteks-Label] / [file].
 *   - Setiap file dicatat sebagai baris di TX_Evidence (bukan link di sheet lain).
 *   - RBAC: scope mengikuti baris tujuan (DivisiID-nya). SUPERADMIN/DIREKTUR bypass.
 */

// ── RBAC ──────────────────────────────────────────────────

function _evRequireSession(token) {
  var session = _getSession(token);
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau belum disetujui.');
  }
  return session;
}

function _evIsPrivileged(session) {
  return session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR;
}

function _evAssertRowScope(session, divisiId) {
  if (_evIsPrivileged(session)) return;
  if (String(session.divisiId || '') !== String(divisiId || '')) {
    throw new Error('FORBIDDEN: Anda hanya dapat mengakses lampiran milik divisi Anda.');
  }
}

// ── KONTEKS BARIS TUJUAN ──────────────────────────────────

/**
 * Resolusi baris tujuan → info folder & scope.
 * @returns {{divisiId:string, divisiName:string, ym:string, periode:string, konteks:string}}
 */
function _evResolveContext(refSheet, refRowId, session) {
  var sheet = openTransaksiSheet(refSheet);
  if (!sheet) throw new Error('Sheet tujuan "' + refSheet + '" tidak ditemukan.');

  var found = findRowById(sheet, refRowId);
  if (!found) throw new Error('Baris tujuan tidak ditemukan (RowID: ' + refRowId + ').');

  var row = found.obj;
  var divisiId = String(row['DivisiID'] || '');
  _evAssertRowScope(session, divisiId);

  var periode = String(row['Periode'] || '');
  var ym = periode.length >= 7 ? periode.substring(0, 7) : '';

  return {
    divisiId:   divisiId,
    divisiName: _evDivisiFolderName(divisiId),
    ym:         ym,
    periode:    periode,
    konteks:    _evKonteks(refSheet, row)
  };
}

/** Nama folder divisi = NamaDashboard dari master Divisi (fallback DivisiID). */
function _evDivisiFolderName(divisiId) {
  try {
    var rows = sheetToObjects(openMasterSheet(SHEET_MASTER.DIVISI));
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i]['DivisiID']) === String(divisiId)) {
        var nm = String(rows[i]['NamaDashboard'] || '').trim();
        if (nm) return _evSanitize(nm);
      }
    }
  } catch (e) { /* fallback di bawah */ }
  return _evSanitize(divisiId || 'Lainnya');
}

/** Nama konteks folder: `Jenis-Label` (keputusan Fase 9, lihat CHANGELOG). */
function _evKonteks(refSheet, row) {
  if (refSheet === SHEET_TX.PERAWATAN_KESIAPAN) {
    return 'Kesiapan-' + _evKapalLabel(row['KapalID']);
  }
  if (refSheet === SHEET_TX.PERAWATAN_DOCKING) {
    return 'Docking-' + _evKapalLabel(row['KapalID']);
  }
  if (refSheet === SHEET_TX.PERAWATAN_ITEM) {
    return 'Item-' + _evSlug(String(row['NamaPekerjaan'] || row['RowID'] || 'item'), 40);
  }
  return _evSlug(String(refSheet), 40);
}

function _evKapalLabel(kapalId) {
  var id = String(kapalId || '').trim();
  if (!id) return 'Tanpa-Kapal';
  try {
    var rows = sheetToObjects(openMasterSheet(SHEET_MASTER.KAPAL));
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i]['KapalID']) === id) {
        var nm = String(rows[i]['Nama'] || '').trim();
        return _evSlug(nm || id, 40);
      }
    }
  } catch (e) { /* fallback */ }
  return _evSlug(id, 40);
}

/** Bersihkan nama folder/file dari karakter tak aman; spasi → '-'. */
function _evSanitize(s) {
  return String(s || '')
    .replace(/[\\\/:*?"<>|#%{}~&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Slug ringkas: tanpa spasi/karakter khusus. */
function _evSlug(s, maxLen) {
  var out = _evSanitize(s).replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (maxLen && out.length > maxLen) out = out.substring(0, maxLen).replace(/-$/, '');
  return out || 'item';
}

// ── VALIDASI FILE ─────────────────────────────────────────

function _evIsVideo(mimeType) {
  return /^video\//i.test(String(mimeType || ''));
}

function _evValidateSize(mimeType, bytes) {
  var isVideo = _evIsVideo(mimeType);
  var limit   = isVideo ? EVIDENCE_LIMIT_BYTES.VIDEO : EVIDENCE_LIMIT_BYTES.FILE;
  if (bytes > limit) {
    var mb = Math.round(limit / 1048576);
    throw new Error(
      isVideo
        ? 'Ukuran video melebihi ' + mb + 'MB. Silakan kompres video terlebih dahulu sebelum mengunggah.'
        : 'Ukuran file melebihi ' + mb + 'MB. Silakan pilih file yang lebih kecil.'
    );
  }
}

/** Hitung panjang byte dari string base64 tanpa decode penuh (pre-check ukuran). */
function _evBase64ByteLength(b64) {
  var len = String(b64 || '').length;
  if (!len) return 0;
  var pad = 0;
  if (b64.charAt(len - 1) === '=') pad++;
  if (b64.charAt(len - 2) === '=') pad++;
  return Math.floor(len * 3 / 4) - pad;
}

/** Ekstrak File ID dari URL Google Drive (atau ID mentah). */
function _evExtractDriveId(urlOrId) {
  var s = String(urlOrId || '').trim();
  if (!s) return '';
  var m = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return '';
}

// ── FOLDER DRIVE ──────────────────────────────────────────

function _evGetOrCreateRoot() {
  var it = DriveApp.getFoldersByName(EVIDENCE_ROOT_FOLDER);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(EVIDENCE_ROOT_FOLDER);
}

function _evGetOrCreateSub(parent, name) {
  var safe = _evSanitize(name) || 'Umum';
  var it = parent.getFoldersByName(safe);
  if (it.hasNext()) return it.next();
  return parent.createFolder(safe);
}

function _evTargetFolder(ctx) {
  var root = _evGetOrCreateRoot();
  var fDiv = _evGetOrCreateSub(root, ctx.divisiName);
  var fYm  = _evGetOrCreateSub(fDiv, ctx.ym || 'Tanpa-Periode');
  return _evGetOrCreateSub(fYm, ctx.konteks);
}

// ── PUBLIC: UPLOAD FILE (base64) ──────────────────────────

/**
 * @param {string} token
 * @param {{refSheet:string, refRowId:string, fileName:string, mimeType:string, dataBase64:string}} params
 */
function evidence_upload(token, params) {
  try {
    var session = _evRequireSession(token);
    var p = params || {};

    var refSheet   = _evReqText(p.refSheet, 'RefSheet');
    var refRowId   = _evReqText(p.refRowId, 'RefRowID');
    var fileName   = _evReqText(p.fileName, 'Nama file');
    var mimeType   = _evReqText(p.mimeType, 'Tipe file');
    var dataBase64 = String(p.dataBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
    if (!dataBase64) return { success: false, error: 'Data file kosong atau gagal dibaca.' };

    // Validasi ukuran SEBELUM decode/copy (ARCHITECTURE §6)
    _evValidateSize(mimeType, _evBase64ByteLength(dataBase64));

    var ctx = _evResolveContext(refSheet, refRowId, session);

    return withLock(function () {
      var folder = _evTargetFolder(ctx);
      var blob   = Utilities.newBlob(Utilities.base64Decode(dataBase64), mimeType, fileName);
      var file   = folder.createFile(blob);

      var evidenceId = _evAppendEvidence(
        refSheet, refRowId, file.getId(), fileName, mimeType, 'UPLOAD', session.userId
      );
      _evAuditLog(session.userId, 'CREATE', evidenceId, 'Upload lampiran: ' + fileName + ' → ' + ctx.konteks);

      return {
        success: true,
        data: { evidenceId: evidenceId, driveFileId: file.getId(), fileName: fileName, message: 'Lampiran berhasil diunggah.' }
      };
    });
  } catch (e) {
    Logger.log('[evidence_upload] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── PUBLIC: SALIN DARI LINK DRIVE ─────────────────────────

/**
 * @param {string} token
 * @param {{refSheet:string, refRowId:string, url:string, fileName:string}} params
 */
function evidence_uploadFromLink(token, params) {
  try {
    var session = _evRequireSession(token);
    var p = params || {};

    var refSheet = _evReqText(p.refSheet, 'RefSheet');
    var refRowId = _evReqText(p.refRowId, 'RefRowID');
    var url      = _evReqText(p.url, 'Link Google Drive');
    var fileId   = _evExtractDriveId(url);
    if (!fileId) {
      return { success: false, error: 'Link Google Drive tidak valid. Tempel link file (bukan folder) yang dapat diakses.' };
    }

    var ctx = _evResolveContext(refSheet, refRowId, session);

    var src;
    try {
      src = DriveApp.getFileById(fileId);
    } catch (e) {
      return { success: false, error: 'File sumber tidak dapat diakses. Pastikan file dibagikan (minimal viewer) ke akun sistem.' };
    }

    var mimeType = src.getMimeType();
    var size     = 0;
    try { size = src.getSize() || 0; } catch (eSize) { size = 0; }
    if (size > 0) _evValidateSize(mimeType, size);

    return withLock(function () {
      var folder   = _evTargetFolder(ctx);
      var fileName = String(p.fileName || '').trim() || src.getName();
      var copy     = src.makeCopy(fileName, folder);

      var evidenceId = _evAppendEvidence(
        refSheet, refRowId, copy.getId(), fileName, mimeType, 'DRIVE_LINK_COPY', session.userId
      );
      _evAuditLog(session.userId, 'CREATE', evidenceId, 'Salin lampiran dari Drive: ' + fileName + ' → ' + ctx.konteks);

      return {
        success: true,
        data: { evidenceId: evidenceId, driveFileId: copy.getId(), fileName: fileName, message: 'Lampiran berhasil disalin.' }
      };
    });
  } catch (e) {
    Logger.log('[evidence_uploadFromLink] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── PUBLIC: BATCH (satu file → banyak baris tujuan) ──────
// Dipakai form yang submit beberapa baris sekaligus (Intelijen & Pemantauan):
// file di-copy SATU KALI ke Drive, lalu dicatat sebagai baris TX_Evidence untuk
// setiap RowID hasil submit (DriveFileID sama — tanpa duplikasi penyimpanan).

/**
 * @param {string} token
 * @param {{refSheet:string, refRowIds:Array<string>, fileName:string, mimeType:string, dataBase64:string}} params
 */
function evidence_uploadBatch(token, params) {
  try {
    var session = _evRequireSession(token);
    var p = params || {};

    var refSheet  = _evReqText(p.refSheet, 'RefSheet');
    var refRowIds = _evReqRows(p.refRowIds, 'RefRowID');
    var fileName  = _evReqText(p.fileName, 'Nama file');
    var mimeType  = _evReqText(p.mimeType, 'Tipe file');
    var dataBase64 = String(p.dataBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
    if (!dataBase64) return { success: false, error: 'Data file kosong atau gagal dibaca.' };

    _evValidateSize(mimeType, _evBase64ByteLength(dataBase64));

    var ctx = _evResolveContextByRows(refSheet, refRowIds, session);
    if (!ctx) return { success: false, error: 'Baris tujuan tidak ditemukan.' };

    return withLock(function () {
      var folder = _evTargetFolder(ctx);
      var blob   = Utilities.newBlob(Utilities.base64Decode(dataBase64), mimeType, fileName);
      var file   = folder.createFile(blob);
      _evAppendForRows(refSheet, refRowIds, file.getId(), fileName, mimeType, 'UPLOAD', session.userId);
      _evAuditLog(session.userId, 'CREATE', refRowIds.join(','),
        'Upload lampiran batch: ' + fileName + ' → ' + ctx.konteks + ' (' + refRowIds.length + ' baris)');
      return { success: true, data: { fileName: fileName, driveFileId: file.getId(), rows: refRowIds.length, message: 'Lampiran berhasil diunggah (' + refRowIds.length + ' baris).' } };
    });
  } catch (e) {
    Logger.log('[evidence_uploadBatch] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * @param {string} token
 * @param {{refSheet:string, refRowIds:Array<string>, url:string, fileName:string}} params
 */
function evidence_uploadFromLinkBatch(token, params) {
  try {
    var session = _evRequireSession(token);
    var p = params || {};

    var refSheet  = _evReqText(p.refSheet, 'RefSheet');
    var refRowIds = _evReqRows(p.refRowIds, 'RefRowID');
    var url       = _evReqText(p.url, 'Link Google Drive');
    var fileId    = _evExtractDriveId(url);
    if (!fileId) {
      return { success: false, error: 'Link Google Drive tidak valid. Tempel link file (bukan folder) yang dapat diakses.' };
    }

    var ctx = _evResolveContextByRows(refSheet, refRowIds, session);
    if (!ctx) return { success: false, error: 'Baris tujuan tidak ditemukan.' };

    var src;
    try {
      src = DriveApp.getFileById(fileId);
    } catch (e) {
      return { success: false, error: 'File sumber tidak dapat diakses. Pastikan file dibagikan (minimal viewer) ke akun sistem.' };
    }

    var mimeType = src.getMimeType();
    var size = 0;
    try { size = src.getSize() || 0; } catch (eSize) { size = 0; }
    if (size > 0) _evValidateSize(mimeType, size);

    return withLock(function () {
      var folder = _evTargetFolder(ctx);
      var fileName = String(p.fileName || '').trim() || src.getName();
      var copy = src.makeCopy(fileName, folder);
      _evAppendForRows(refSheet, refRowIds, copy.getId(), fileName, mimeType, 'DRIVE_LINK_COPY', session.userId);
      _evAuditLog(session.userId, 'CREATE', refRowIds.join(','),
        'Salin lampiran batch dari Drive: ' + fileName + ' → ' + ctx.konteks + ' (' + refRowIds.length + ' baris)');
      return { success: true, data: { fileName: fileName, driveFileId: copy.getId(), rows: refRowIds.length, message: 'Lampiran berhasil disalin (' + refRowIds.length + ' baris).' } };
    });
  } catch (e) {
    Logger.log('[evidence_uploadFromLinkBatch] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── PUBLIC: CARRY (bawa lampiran lama ke baris revisi baru) ─

/**
 * Setelah revisi membuat baris baru (lama → SUPERSEDED), lampiran baris lama
 * dibawa ke baris baru agar tidak tampak "hilang". File tidak di-copy ulang —
 * hanya baris TX_Evidence baru yang mereferensikan DriveFileID sama.
 * @param {string} token
 * @param {{refSheet:string, fromRowId:string, toRowId:string}} params
 */
function evidence_carry(token, params) {
  try {
    var session = _evRequireSession(token);
    var p = params || {};
    var refSheet   = _evReqText(p.refSheet, 'RefSheet');
    var fromRowId  = _evReqText(p.fromRowId, 'fromRowId');
    var toRowId    = _evReqText(p.toRowId, 'toRowId');

    _evAssertRowScope(session, _evRowDivisi(refSheet, fromRowId));
    _evAssertRowScope(session, _evRowDivisi(refSheet, toRowId));

    var evRows = sheetToObjects(openTransaksiSheet(SHEET_TX.EVIDENCE));
    var copied = 0;
    evRows.forEach(function (r) {
      if (String(r['RefSheet']) !== String(refSheet)) return;
      if (String(r['RefRowID']) !== String(fromRowId)) return;
      _evAppendEvidence(refSheet, toRowId, String(r['DriveFileID'] || ''),
        String(r['FileName'] || ''), String(r['FileType'] || ''), String(r['SourceMode'] || ''), session.userId);
      copied++;
    });
    if (copied > 0) {
      _evAuditLog(session.userId, 'CREATE', toRowId,
        'Bawa lampiran dari revisi baris ' + fromRowId + ' (' + copied + ' item).');
    }
    return { success: true, data: { copied: copied, message: copied + ' lampiran dibawa ke baris baru.' } };
  } catch (e) {
    Logger.log('[evidence_carry] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── PUBLIC: LIST ──────────────────────────────────────────

function evidence_list(token, refSheet, refRowId) {
  try {
    var session = _evRequireSession(token);
    _evResolveContext(refSheet, refRowId, session);

    var rows = sheetToObjects(openTransaksiSheet(SHEET_TX.EVIDENCE));
    var data = rows
      .filter(function (r) {
        return String(r['RefSheet']) === String(refSheet) &&
               String(r['RefRowID']) === String(refRowId);
      })
      .map(_evNormalize);

    return { success: true, data: data };
  } catch (e) {
    Logger.log('[evidence_list] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Ambil lampiran untuk banyak baris sekaligus (dipakai tabel riwayat).
 * @returns {{success:boolean, data:Object<string, Array>}} map RefRowID → daftar lampiran
 */
function evidence_listBatch(token, refSheet, refRowIds) {
  try {
    var session = _evRequireSession(token);
    var ids = refRowIds || [];
    if (!ids.length) return { success: true, data: {} };

    var idSet = {};
    ids.forEach(function (id) { idSet[String(id)] = true; });

    // Scope: hanya baris milik divisi session (kecuali privileged)
    var allowed = {};
    if (_evIsPrivileged(session)) {
      ids.forEach(function (id) { allowed[String(id)] = true; });
    } else {
      var targetRows = sheetToObjects(openTransaksiSheet(refSheet));
      targetRows.forEach(function (r) {
        var rid = String(r['RowID']);
        if (idSet[rid] && String(r['DivisiID']) === String(session.divisiId || '')) {
          allowed[rid] = true;
        }
      });
    }

    var evRows = sheetToObjects(openTransaksiSheet(SHEET_TX.EVIDENCE));
    var out = {};
    evRows.forEach(function (r) {
      if (String(r['RefSheet']) !== String(refSheet)) return;
      var rid = String(r['RefRowID']);
      if (!allowed[rid]) return;
      if (!out[rid]) out[rid] = [];
      out[rid].push(_evNormalize(r));
    });

    return { success: true, data: out };
  } catch (e) {
    Logger.log('[evidence_listBatch] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── HELPER ────────────────────────────────────────────────

function _evAppendEvidence(refSheet, refRowId, driveFileId, fileName, fileType, sourceMode, userId) {
  var evidenceId = 'EV-' + Utilities.getUuid().replace(/-/g, '').substring(0, 14).toUpperCase();
  appendRowData(openTransaksiSheet(SHEET_TX.EVIDENCE), {
    'EvidenceID':  evidenceId,
    'RefSheet':    refSheet,
    'RefRowID':    refRowId,
    'DriveFileID': driveFileId,
    'FileName':    fileName,
    'FileType':    fileType,
    'SourceMode':  sourceMode,
    'UploadedBy':  userId,
    'UploadedAt':  new Date()
  });
  return evidenceId;
}

function _evNormalize(r) {
  var fileId = String(r['DriveFileID'] || '');
  return {
    evidenceId:  String(r['EvidenceID'] || ''),
    fileName:    String(r['FileName'] || ''),
    fileType:    String(r['FileType'] || ''),
    driveFileId: fileId,
    viewUrl:     fileId ? ('https://drive.google.com/file/d/' + fileId + '/view') : '',
    sourceMode:  String(r['SourceMode'] || ''),
    uploadedBy:  String(r['UploadedBy'] || ''),
    uploadedAt:  r['UploadedAt'] ? new Date(r['UploadedAt']).toISOString() : null
  };
}

function _evAuditLog(userId, aksi, rowId, alasan) {
  try {
    appendRowData(openLogSheet(SHEET_LOG.AUDIT_LOG), {
      'LogID':       'LOG-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
      'UserID':      userId,
      'Aksi':        aksi,
      'SheetTarget': SHEET_TX.EVIDENCE,
      'RowIDTarget': rowId,
      'Alasan':      alasan,
      'Timestamp':   new Date()
    });
  } catch (e) { Logger.log('[_evAuditLog] ' + e.message); }
}

function _evReqText(val, label) {
  var s = String(val === undefined || val === null ? '' : val).trim();
  if (!s) throw new Error(label + ' wajib diisi.');
  return s;
}

function _evReqRows(val, label) {
  var arr = (val || []);
  if (!Array.isArray(arr)) return [];
  return arr
    .map(function (x) { return String(x || '').trim(); })
    .filter(function (x) { return x; });
}

/** DivisiID sebuah baris tujuan (untuk scope check). */
function _evRowDivisi(refSheet, refRowId) {
  var found = findRowById(openTransaksiSheet(refSheet), refRowId);
  return found ? String(found.obj['DivisiID'] || '') : '';
}

/**
 * Resolusi konteks folder & scope untuk BANYAK baris tujuan sekaligus.
 * Semua baris harus berada di divisi yang sama (scope session) & sama periode
 * (folder). Folder memakai konteks baris pertama.
 */
function _evResolveContextByRows(refSheet, refRowIds, session) {
  if (!refRowIds.length) throw new Error('Minimal satu baris tujuan wajib diisi.');
  var base = null;
  for (var i = 0; i < refRowIds.length; i++) {
    var ctx = _evResolveContext(refSheet, refRowIds[i], session);
    if (!base) {
      base = ctx;
    } else if (ctx.divisiId !== base.divisiId || ctx.ym !== base.ym) {
      throw new Error('Baris tujuan tidak berada dalam periode/divisi yang sama.');
    }
  }
  return base;
}

function _evAppendForRows(refSheet, refRowIds, driveFileId, fileName, fileType, sourceMode, userId) {
  for (var i = 0; i < refRowIds.length; i++) {
    _evAppendEvidence(refSheet, refRowIds[i], driveFileId, fileName, fileType, sourceMode, userId);
  }
}
