/**
 * services/AuthService.js
 * Autentikasi, manajemen sesi, alur registrasi & approval.
 *
 * Fungsi publik (dipanggil via google.script.run dari frontend):
 *   auth_getDivisiList()
 *   auth_register(params)
 *   auth_login(params)
 *   auth_logout(token)
 *   auth_getSessionInfo(token)
 *   auth_getPendingApprovals(token)
 *   auth_decideApproval(params)
 *
 * Semua fungsi publik mengembalikan {success: true, data: ...} atau {success: false, error: "..."}.
 *
 * RBAC: setiap fungsi tulis wajib assertScope() + withLock().
 * Session: token UUID tersimpan di ScriptCache, TTL 6 jam.
 */

// ===========================================================================
// KONSTANTA INTERNAL
// ===========================================================================

var _SESSION_PREFIX = 'sess_';
var _SESSION_TTL_SEC = 21600; // 6 jam

// ===========================================================================
// FUNGSI PUBLIK
// ===========================================================================

/**
 * Daftar divisi untuk dropdown registrasi.
 * Tidak membutuhkan autentikasi.
 */
function auth_getDivisiList() {
  try {
    var sheet = openMasterSheet(SHEET_MASTER.DIVISI);
    var rows = sheetToObjects(sheet);
    // Kembalikan hanya field yang dibutuhkan frontend
    var data = rows.map(function (r) {
      return {
        divisiId: r['DivisiID'],
        namaDashboard: r['NamaDashboard'],
        namaResmi: r['NamaResmi'],
        kode: r['Kode']
      };
    });
    return { success: true, data: data };
  } catch (e) {
    Logger.log('[auth_getDivisiList] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Registrasi akun baru.
 *
 * @param {Object} params
 * @param {string} params.nama
 * @param {string} params.email
 * @param {string} params.password     - plaintext, di-hash server-side
 * @param {string} params.divisiId     - ref(Divisi)
 * @param {string} params.roleDilamar  - enum('KADIV', 'STAF')
 */
function auth_register(params) {
  try {
    return withLock(function () {
      var nama       = (params.nama  || '').trim();
      var email      = (params.email || '').trim().toLowerCase();
      var password   = params.password   || '';
      var divisiId   = params.divisiId   || '';
      var roleDilamar = params.roleDilamar || '';

      // Validasi field wajib
      if (!nama || !email || !password || !divisiId || !roleDilamar) {
        return { success: false, error: 'Semua field wajib diisi.' };
      }
      if ([ROLE.KADIV, ROLE.STAF].indexOf(roleDilamar) === -1) {
        return { success: false, error: 'Role tidak valid. Pilih Kepala Divisi/Ketua Tim Kerja atau Staf.' };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, error: 'Format email tidak valid.' };
      }
      if (password.length < 8) {
        return { success: false, error: 'Password minimal 8 karakter.' };
      }

      // Cek email unik (PENDING atau APPROVED tidak bisa daftar ulang — REJECTED bisa)
      var usersSheet = openMasterSheet(SHEET_MASTER.USERS);
      var existing = findRowByField(usersSheet, 'Email', email);
      if (existing) {
        var existStatus = existing.obj['Status'];
        if (existStatus === USER_STATUS.APPROVED) {
          return { success: false, error: 'Email ini sudah terdaftar dan aktif.' };
        }
        if (existStatus === USER_STATUS.PENDING) {
          return { success: false, error: 'Email ini sudah terdaftar dan sedang menunggu persetujuan.' };
        }
        // REJECTED: izinkan mendaftar ulang → lanjut
      }

      // Validasi divisiId ada di master
      var divisiSheet = openMasterSheet(SHEET_MASTER.DIVISI);
      var divisiRow = findRowByField(divisiSheet, 'DivisiID', divisiId);
      if (!divisiRow) {
        return { success: false, error: 'Divisi tidak ditemukan.' };
      }

      var now    = new Date();
      var userId = 'USR-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();

      // Simpan user baru dengan status PENDING
      appendRowData(usersSheet, {
        'UserID':       userId,
        'Nama':         nama,
        'Email':        email,
        'PasswordHash': hashPassword(password),
        'DivisiID':     divisiId,
        'Role':         roleDilamar,
        'Status':       USER_STATUS.PENDING,
        'ApprovedBy':   '',
        'RegisteredAt': now,
        'ApprovedAt':   ''
      });

      // Routing approval
      var routing = _routeApproval(roleDilamar, divisiId);

      // Buat entri Approval_Queue
      var queueId = 'QUE-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
      appendRowData(openLogSheet(SHEET_LOG.APPROVAL_QUEUE), {
        'QueueID':     queueId,
        'UserID':      userId,
        'RoleDilamar': roleDilamar,
        'DivisiID':    divisiId,
        'RoutedTo':    routing.routedTo,
        'Status':      USER_STATUS.PENDING,
        'DecidedBy':   '',
        'DecidedAt':   '',
        'AlasanReject':''
      });

      // Audit log
      _auditLog('SYSTEM', 'CREATE', SHEET_MASTER.USERS, userId,
        'Registrasi: ' + email + ' → ' + roleDilamar + ' @ ' + divisiId);

      // Notifikasi ke approver
      routing.targetUserIds.forEach(function (approverId) {
        _notify(approverId, 'APPROVAL_REQUEST',
          'Permintaan registrasi baru dari ' + nama +
          ' (' + divisiRow.obj['NamaDashboard'] + ' — ' + roleDilamar + ').');
      });

      return {
        success: true,
        data: {
          userId: userId,
          message: 'Registrasi berhasil. Akun Anda sedang menunggu persetujuan.'
        }
      };
    });
  } catch (e) {
    Logger.log('[auth_register] ' + e.message);
    return { success: false, error: 'Terjadi kesalahan saat registrasi: ' + e.message };
  }
}

/**
 * Login.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.password  - plaintext
 */
function auth_login(params) {
  try {
    var email    = (params.email    || '').trim().toLowerCase();
    var password = params.password  || '';

    if (!email || !password) {
      return { success: false, error: 'Email dan password wajib diisi.' };
    }

    var usersSheet = openMasterSheet(SHEET_MASTER.USERS);
    var found = findRowByField(usersSheet, 'Email', email);

    if (!found) {
      return { success: false, error: 'Email atau password salah.' };
    }

    var user = found.obj;

    if (user['PasswordHash'] !== hashPassword(password)) {
      return { success: false, error: 'Email atau password salah.' };
    }
    if (user['Status'] === USER_STATUS.REJECTED) {
      return { success: false, error: 'Akun telah ditolak. Silakan daftarkan akun baru.' };
    }

    // Buat session (untuk PENDING maupun APPROVED)
    var token = _createSession(user);

    // Audit login hanya untuk akun aktif
    if (user['Status'] === USER_STATUS.APPROVED) {
      _auditLog(user['UserID'], 'LOGIN', SHEET_MASTER.USERS, user['UserID'], '');
    }

    return {
      success: true,
      data: {
        token: token,
        user: _sanitizeUser(user)
      }
    };
  } catch (e) {
    Logger.log('[auth_login] ' + e.message);
    return { success: false, error: 'Terjadi kesalahan saat login: ' + e.message };
  }
}

/**
 * Logout — invalidate token dari cache.
 * @param {string} token
 */
function auth_logout(token) {
  try {
    _destroySession(token);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Ambil info sesi dari token — dipanggil saat page load untuk restore state.
 * @param {string} token
 */
function auth_getSessionInfo(token) {
  try {
    var session = _getSession(token);
    if (!session) {
      return { success: false, error: 'Sesi tidak ditemukan atau sudah berakhir.' };
    }
    return { success: true, data: session };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Ambil daftar permintaan registrasi yang menunggu keputusan approver yang sedang login.
 * Hanya bisa diakses oleh SUPERADMIN, DIREKTUR, dan KADIV.
 *
 * @param {string} token
 */
function auth_getPendingApprovals(token) {
  try {
    var session = _requireSession(token);
    assertScope(session, [ROLE.SUPERADMIN, ROLE.DIREKTUR, ROLE.KADIV], null);

    var queueRows  = sheetToObjects(openLogSheet(SHEET_LOG.APPROVAL_QUEUE));
    var usersSheet = openMasterSheet(SHEET_MASTER.USERS);
    var divisiSheet= openMasterSheet(SHEET_MASTER.DIVISI);

    var pending = queueRows.filter(function (q) {
      if (String(q['Status']) !== USER_STATUS.PENDING) return false;
      if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) {
        return String(q['RoutedTo']) === ROLE.SUPERADMIN;
      }
      if (session.role === ROLE.KADIV) {
        return String(q['RoutedTo']) === ROLE.KADIV &&
               String(q['DivisiID']) === String(session.divisiId);
      }
      return false;
    });

    var enriched = pending.map(function (q) {
      var userRow   = findRowByField(usersSheet, 'UserID', q['UserID']);
      var divisiRow = findRowByField(divisiSheet, 'DivisiID', q['DivisiID']);
      return {
        queueId:     q['QueueID'],
        userId:      q['UserID'],
        nama:        userRow  ? userRow.obj['Nama']          : '?',
        email:       userRow  ? userRow.obj['Email']         : '?',
        roleDilamar: q['RoleDilamar'],
        divisiId:    q['DivisiID'],
        namaDivisi:  divisiRow ? divisiRow.obj['NamaDashboard'] : '?',
        registeredAt:userRow  ? userRow.obj['RegisteredAt']  : ''
      };
    });

    return { success: true, data: enriched };
  } catch (e) {
    Logger.log('[auth_getPendingApprovals] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Putuskan (approve/reject) satu entri approval queue.
 *
 * @param {Object} params
 * @param {string}  params.token
 * @param {string}  params.queueId
 * @param {boolean} params.approve    - true = setujui, false = tolak
 * @param {string}  params.alasan     - wajib jika approve=false
 */
function auth_decideApproval(params) {
  try {
    return withLock(function () {
      var token   = params.token;
      var queueId = params.queueId;
      var approve = params.approve === true;
      var alasan  = (params.alasan || '').trim();

      if (!approve && !alasan) {
        return { success: false, error: 'Alasan penolakan wajib diisi.' };
      }

      var session = _requireSession(token);
      assertScope(session, [ROLE.SUPERADMIN, ROLE.DIREKTUR, ROLE.KADIV], null);

      // Ambil entri antrian
      var queueSheet = openLogSheet(SHEET_LOG.APPROVAL_QUEUE);
      var queueEntry = findRowByField(queueSheet, 'QueueID', queueId);
      if (!queueEntry || String(queueEntry.obj['Status']) !== USER_STATUS.PENDING) {
        return { success: false, error: 'Entri tidak ditemukan atau sudah diproses sebelumnya.' };
      }
      var q = queueEntry.obj;

      // Validasi kewenangan approver ini atas entri ini
      if (session.role === ROLE.KADIV) {
        if (String(q['RoutedTo']) !== ROLE.KADIV || String(q['DivisiID']) !== session.divisiId) {
          return { success: false, error: 'Anda tidak berwenang memutuskan permintaan ini.' };
        }
      } else if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) {
        if (String(q['RoutedTo']) !== ROLE.SUPERADMIN) {
          return { success: false, error: 'Anda tidak berwenang memutuskan permintaan ini.' };
        }
      }

      var now       = new Date();
      var newStatus = approve ? USER_STATUS.APPROVED : USER_STATUS.REJECTED;

      // Update Users sheet
      var usersSheet = openMasterSheet(SHEET_MASTER.USERS);
      var userRow    = findRowByField(usersSheet, 'UserID', q['UserID']);
      if (!userRow) {
        return { success: false, error: 'Data pengguna tidak ditemukan.' };
      }
      updateRowCells(usersSheet, userRow.rowIndex, {
        'Status':     newStatus,
        'ApprovedBy': approve ? session.userId : '',
        'ApprovedAt': approve ? now : ''
      });

      // Update Approval_Queue
      updateRowCells(queueSheet, queueEntry.rowIndex, {
        'Status':      newStatus,
        'DecidedBy':   session.userId,
        'DecidedAt':   now,
        'AlasanReject': approve ? '' : alasan
      });

      // Audit log
      _auditLog(session.userId,
        approve ? 'APPROVE' : 'REJECT',
        SHEET_LOG.APPROVAL_QUEUE, queueId,
        approve ? 'Disetujui' : 'Ditolak: ' + alasan);

      // Notifikasi ke registrant
      var pesanNotif = approve
        ? 'Registrasi Anda telah disetujui. Silakan login kembali untuk mengakses sistem.'
        : 'Registrasi Anda ditolak. Alasan: ' + alasan + '. Anda dapat mendaftar akun baru.';
      _notify(q['UserID'], 'APPROVAL_REQUEST', pesanNotif);

      return { success: true, data: { message: 'Keputusan berhasil disimpan.' } };
    });
  } catch (e) {
    Logger.log('[auth_decideApproval] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===========================================================================
// HELPER INTERNAL — SESSION
// ===========================================================================

function _createSession(userObj) {
  var token = Utilities.getUuid();
  var sessionData = {
    userId:  userObj['UserID'],
    nama:    userObj['Nama'],
    email:   userObj['Email'],
    role:    userObj['Role'],
    divisiId:userObj['DivisiID'],
    status:  userObj['Status']
  };
  CacheService.getScriptCache().put(
    _SESSION_PREFIX + token,
    JSON.stringify(sessionData),
    _SESSION_TTL_SEC
  );
  return token;
}

function _destroySession(token) {
  if (token) {
    CacheService.getScriptCache().remove(_SESSION_PREFIX + token);
  }
}

function _getSession(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get(_SESSION_PREFIX + token);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/** Ambil session dan lempar error jika tidak ditemukan. */
function _requireSession(token) {
  var session = _getSession(token);
  if (!session) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau sudah berakhir. Silakan login ulang.');
  }
  return session;
}

// ===========================================================================
// HELPER INTERNAL — ROUTING APPROVAL
// ===========================================================================

/**
 * Tentukan ke siapa permintaan registrasi dirouting.
 *
 * @param {string} roleDilamar - 'KADIV' atau 'STAF'
 * @param {string} divisiId
 * @returns {{routedTo: string, targetUserIds: string[]}}
 */
function _routeApproval(roleDilamar, divisiId) {
  if (roleDilamar === ROLE.KADIV) {
    // Pendaftar Kadiv selalu ke Superadmin
    return { routedTo: ROLE.SUPERADMIN, targetUserIds: _getSuperadminIds() };
  }
  // Pendaftar Staf → ke Kadiv aktif di divisi tsb; fallback ke Superadmin
  var kadivIds = _getActiveKadivIds(divisiId);
  if (kadivIds.length > 0) {
    return { routedTo: ROLE.KADIV, targetUserIds: kadivIds };
  }
  return { routedTo: ROLE.SUPERADMIN, targetUserIds: _getSuperadminIds() };
}

function _getSuperadminIds() {
  return sheetToObjects(openMasterSheet(SHEET_MASTER.USERS))
    .filter(function (u) {
      return u['Role'] === ROLE.SUPERADMIN && u['Status'] === USER_STATUS.APPROVED;
    })
    .map(function (u) { return u['UserID']; });
}

function _getActiveKadivIds(divisiId) {
  return sheetToObjects(openMasterSheet(SHEET_MASTER.USERS))
    .filter(function (u) {
      return u['Role'] === ROLE.KADIV &&
             u['Status'] === USER_STATUS.APPROVED &&
             String(u['DivisiID']) === String(divisiId);
    })
    .map(function (u) { return u['UserID']; });
}

// ===========================================================================
// HELPER INTERNAL — LOG & NOTIFIKASI
// ===========================================================================

function _auditLog(userId, aksi, sheetTarget, rowIdTarget, alasan) {
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
    Logger.log('[_auditLog] Gagal catat audit: ' + e.message);
  }
}

function _notify(toUserId, jenis, pesan) {
  try {
    appendRowData(openLogSheet(SHEET_LOG.NOTIFICATIONS), {
      'NotifID':  'NTF-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
      'UserID':   toUserId,
      'Jenis':    jenis,
      'Pesan':    pesan,
      'IsRead':   false,
      'CreatedAt':new Date()
    });
  } catch (e) {
    Logger.log('[_notify] Gagal buat notifikasi: ' + e.message);
  }
}

// ===========================================================================
// HELPER INTERNAL — SANITIZE
// ===========================================================================

/** Kembalikan data user tanpa PasswordHash. */
function _sanitizeUser(userObj) {
  return {
    userId:  userObj['UserID'],
    nama:    userObj['Nama'],
    email:   userObj['Email'],
    role:    userObj['Role'],
    divisiId:userObj['DivisiID'],
    status:  userObj['Status']
  };
}
