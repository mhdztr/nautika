/**
 * services/AuthService.js
 * Autentikasi, manajemen sesi, alur registrasi & approval.
 *
 * Fungsi publik (dipanggil via google.script.run dari frontend):
 *   auth_getDivisiList()
 *   auth_requestOtp(params)   -> tahap 1: validasi penuh + kirim kode OTP
 *   auth_verifyOtp(params)    -> tahap 2: kode benar -> pendingToken sekali pakai
 *   auth_register(params)     -> tahap 3: WAJIB pendingToken, baru tulis akun
 *   auth_login(params)
 *   auth_logout(token)
 *   auth_getSessionInfo(token)
 *   auth_getPendingApprovals(token)
 *   auth_decideApproval(params)
 *
 * Registrasi sengaja dipecah tiga tahap: tidak ada baris `Users` maupun
 * `Approval_Queue` yang tercipta sebelum kepemilikan email terbukti. Rincian
 * di `PRD.md` §3.1 dan `ARCHITECTURE.md` §11.
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

// Marker pencabutan sesi. ScriptCache tidak bisa di-enumerate, jadi saat Admin
// mengubah akun (status/role/divisi) kita tandai userId-nya; setiap permintaan
// berikutnya dengan token lama ditolak. TTL > TTL sesi agar tidak ada celah.
var _REVOKED_PREFIX = 'revoked_';
var _REVOKED_TTL_SEC = 43200; // 12 jam (> _SESSION_TTL_SEC)

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
 * Registrasi akun baru. HANYA dipanggil setelah OTP terverifikasi lewat
 * auth_verifyOtp — token OTP (pendingToken) wajib menyertai params dan masih
 * valid, jadi tidak bisa melewati tahap verifikasi email.
 *
 * @param {Object} params
 * @param {string} params.nama
 * @param {string} params.email
 * @param {string} params.nip
 * @param {string} params.password     - plaintext, di-hash server-side
 * @param {string} params.divisiId     - ref(Divisi)
 * @param {string} params.roleDilamar  - enum('KADIV', 'STAF')
 * @param {string} params.pendingToken - token dari auth_verifyOtp
 */
function auth_register(params) {
  try {
    return withLock(function () {
      var email = (params && params.email || '').trim().toLowerCase();
      var pendingToken = (params && params.pendingToken) || '';

      // Gerbang verifikasi: tanpa OTP valid, tidak boleh ada akun tercipta.
      var gate = _otpConsumePending(pendingToken, email);
      if (!gate.ok) return { success: false, error: gate.error };

      var v = _otpValidasiPendaftaran(params);
      if (v.error) return { success: false, error: v.error };
      var nama = v.nama, nip = v.nip, password = v.password;
      var divisiId = v.divisiId, roleDilamar = v.roleDilamar;

      ensureUsersNipColumn();

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
        if (existStatus === USER_STATUS.NONAKTIF) {
          return { success: false, error: 'Email ini terdaftar pada akun yang dinonaktifkan. Hubungi Superadmin.' };
        }
        // REJECTED: izinkan mendaftar ulang → lanjut
      }

      // Cek NIP unik. NIP adalah identitas pegawai terpisah dari email, jadi
      // dua akun tidak boleh memakai NIP yang sama walau email berbeda.
      // Pengecualian: NIP milik akun REJECTED dengan email yang sama — itu orang
      // yang sama yang sedang mencoba mendaftar ulang, sesuai aturan PRD.
      var existingNip = findRowByField(usersSheet, 'NIP', nip);
      if (existingNip) {
        var nipOwnerEmail = String(existingNip.obj['Email'] || '').trim().toLowerCase();
        var nipOwnerStatus = existingNip.obj['Status'];
        var sameRejected = (nipOwnerEmail === email && nipOwnerStatus === USER_STATUS.REJECTED);
        if (!sameRejected) {
          return { success: false, error: 'NIP ini sudah terdaftar pada akun lain. Gunakan NIP Anda sendiri.' };
        }
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
        'NIP':          nip,
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

      // Token OTP sudah dipakai → jangan bisa dipakai ulang untuk daftar kedua.
      _otpDropPending(gate.token);

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

// ===========================================================================
// VERIFIKASI OTP (EMAIL WAJIB)
// ===========================================================================
//
// Alur: auth_requestOtp (kirim kode) → auth_verifyOtp (cek kode, terima
// pendingToken) → auth_register (butuh pendingToken).
//
// Keputusan desain: OTP diverifikasi SEBELUM akun dibuat, jadi tidak ada baris
// PENDING maupun entri Approval_Queue untuk email yang belum dibuktikan benar.
// Konsekuensinya, pendaftaran yang gagal di tahap OTP tidak meninggalkan jejak
// di sheet — hanya di Logger. Ini disengaja: sheet Users tidak boleh jadi
// tempat menampung akun yang belum terverifikasi.
//
// Kode OTP & pendingToken disimpan di CacheService dengan TTL, bukan sheet
// baru: inherently sementara, tidak perlu persist, dan tidak menambah skema.

var _OTP_PREFIX        = 'otp_';
var _OTP_PENDING_PREFIX = 'otppend_';
var _OTP_SEND_PREFIX    = 'otpsent_';

var _OTP_TTL_SEC        = 600;  // 10 menit untuk mengetik kode
var _OTP_PENDING_TTL_SEC = 900; // 15 menit untuk menyelesaikan registrasi
var _OTP_RESEND_TTL_SEC = 60;   // jeda minimal antar permintaan kode
var _OTP_MAX_ATTEMPTS   = 5;    // batas tebakan kode sebelum dihapus

/**
 * Validasi format NIP. Digit dengan tanda hubung/spasi diperbolehkan, dan
 * panjang tidak dikunci ke satu angka tertentu supaya NIP legacy 9/10 digit
 * yang sah tetap diterima.
 *
 * @param {string} nip
 * @return {string} pesan error, atau '' bila valid
 */
function _otpValidateNip(nip) {
  var v = String(nip || '').trim();
  if (!v) return 'NIP wajib diisi.';
  if (!/^[0-9][0-9\s.\-]{7,25}$/.test(v)) {
    return 'NIP tidak valid. Isi dengan angka (tanda hubung/spasi diperbolehkan).';
  }
  return '';
}

/**
 * Normalisasi NIP untuk disimpan & dibandingkan: hanya digit. Jadi
 * "1234 5678 9012 3456 78" dan "123456789012345678" dianggap NIP sama.
 */
function _otpNormalizeNip(nip) {
  return String(nip || '').replace(/[^0-9]/g, '');
}

/**
 * Validasi SELURUH field formulir registrasi. Dipakai dua tempat:
 * auth_requestOtp (sebelum kode dikirim, supaya user tidak menunggu email
 * hanya untuk ditolak) dan auth_register (jaring pengaman kedua).
 * Satu sumber aturan = pesan error konsisten dan tidak bisa berbeda antar tahap.
 *
 * @param {Object} params
 * @return {{error: string}|{error: '', nama, email, nip, password, divisiId, roleDilamar}}
 */
function _otpValidasiPendaftaran(params) {
  var nama        = (params && params.nama  || '').trim();
  var email       = (params && params.email || '').trim().toLowerCase();
  var nipRaw      = (params && params.nip   || '').trim();
  var password    = (params && params.password) || '';
  var divisiId    = (params && params.divisiId) || '';
  var roleDilamar = (params && params.roleDilamar) || '';

  if (!nama || !email || !nipRaw || !password || !divisiId || !roleDilamar) {
    return { error: 'Semua field wajib diisi.' };
  }
  if ([ROLE.KADIV, ROLE.STAF].indexOf(roleDilamar) === -1) {
    return { error: 'Role tidak valid. Pilih Kepala Divisi/Ketua Tim Kerja atau Staf.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Format email tidak valid.' };
  }
  var nipErr = _otpValidateNip(nipRaw);
  if (nipErr) return { error: nipErr };

  // Simpan & bandingkan dalam bentuk digit saja, supaya "1985 1212 ..." dan
  // "19851212..." tidak lolos sebagai dua NIP berbeda.
  var nip = _otpNormalizeNip(nipRaw);
  if (nip.length < 8) {
    return { error: 'NIP tidak valid. Isi dengan angka (tanda hubung/spasi diperbolehkan).' };
  }
  if (password.length < 8) {
    return { error: 'Password minimal 8 karakter.' };
  }

  return {
    error: '', nama: nama, email: email, nip: nip,
    password: password, divisiId: divisiId, roleDilamar: roleDilamar
  };
}

/**
 * Generate kode OTP 6 digit (cryptographically-ish: pakai UUID sebagai sumber
 * lalu modulo, bukan Math.random). Menghindari kode yang mudah ditebak.
 */
function _otpGenerateCode() {
  // Ambil digit heksadesimal dari UUID (UUID GAS berisi '-' yang dibuang),
  // lalu pakai 48 bit terakhir agar tetap 6 digit tanpa bias_modulo berarti.
  var hex = (Utilities.getUuid() || '').toLowerCase().replace(/[^0-9a-f]/g, '');
  while (hex.length < 12) hex += '0';
  var n = parseInt(hex.substring(0, 12), 16);
  if (isNaN(n)) n = 0;
  var code = String(n % 1000000);
  while (code.length < 6) code = '0' + code;
  return code;
}

/**
 * Tahap 1 — kirim kode OTP ke email. Tidak membuat akun apa pun, tidak
 * menyentuh sheet. Rate-limited per email agar tidak bisa dipakai membanjiri
 * inbox. Semua field formulir divalidasi lebih dulu: tidak ada gunanya
 * mengirim kode ke email orang yang datanya memang akan ditolak.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.nama
 * @param {string} params.nip
 * @param {string} params.password
 * @param {string} params.divisiId
 * @param {string} params.roleDilamar
 */
function auth_requestOtp(params) {
  try {
    var v = _otpValidasiPendaftaran(params);
    if (v.error) return { success: false, error: v.error };

    var email = v.email;
    var nama  = v.nama;

    var sendKey = _OTP_SEND_PREFIX + email;
    var lastSent = Number(CacheService.getScriptCache().get(sendKey) || 0);
    var waitSec = Math.ceil((_OTP_RESEND_TTL_SEC - (Date.now() - lastSent)) / 1000);
    if (lastSent && waitSec > 0) {
      return { success: false, error: 'Tunggu ' + waitSec + ' detik sebelum meminta kode lagi.' };
    }

    var code = _otpGenerateCode();
    var payload = { code: code, email: email, attempts: 0 };

    CacheService.getScriptCache().put(_OTP_PREFIX + email, JSON.stringify(payload), _OTP_TTL_SEC);
    CacheService.getScriptCache().put(sendKey, String(Date.now()), _OTP_RESEND_TTL_SEC + _OTP_TTL_SEC);

    var res = _ntfKirimEmail(email, 'Kode Verifikasi Registrasi Nautika',
      'Halo ' + (nama || 'Calon Pengguna') + ',\n\n' +
      'Kode verifikasi untuk pendaftaran akun Nautika:\n\n' +
      '    ' + code + '\n\n' +
      'Kode berlaku ' + Math.round(_OTP_TTL_SEC / 60) + ' menit dan hanya dapat dipakai sekali.\n' +
      'Jika Anda tidak meminta kode ini, abaikan email ini.\n\n' +
      '— Sistem Nautika, Direktorat Pengendalian Operasi Armada');

    if (!res.ok) {
      // Jangan simpan kode kalau email gagal terkirim — user tidak akan pernah
      // menerima kodenya, dan sisa TTL hanya membingungkan.
      CacheService.getScriptCache().remove(_OTP_PREFIX + email);
      CacheService.getScriptCache().remove(sendKey);
      Logger.log('[auth_requestOtp] Gagal kirim OTP ke ' + email + ': ' + res.reason);
      return { success: false, error: 'Gagal mengirim email verifikasi. ' + res.reason };
    }

    return {
      success: true,
      data: { email: email, expiresInSec: _OTP_TTL_SEC, resendAfterSec: _OTP_RESEND_TTL_SEC }
    };
  } catch (e) {
    Logger.log('[auth_requestOtp] ' + e.message);
    return { success: false, error: 'Gagal mengirim email verifikasi: ' + e.message };
  }
}

/**
 * Tahap 2 — cek kode OTP. Bila benar, terbitkan `pendingToken` yang
 * auth_register mewajibkan sebagai bukti verifikasi.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.code
 */
function auth_verifyOtp(params) {
  try {
    var email = (params && params.email || '').trim().toLowerCase();
    var code  = String(params && params.code || '').trim();

    if (!email || !code) {
      return { success: false, error: 'Email dan kode verifikasi wajib diisi.' };
    }

    var cache = CacheService.getScriptCache();
    var key = _OTP_PREFIX + email;
    var raw = cache.get(key);
    if (!raw) {
      return { success: false, error: 'Kode verifikasi sudah kedaluwarsa atau belum diminta. Silakan minta kode baru.' };
    }

    var rec = JSON.parse(raw);
    if (String(rec.code) !== code) {
      rec.attempts = (rec.attempts || 0) + 1;
      if (rec.attempts >= _OTP_MAX_ATTEMPTS) {
        cache.remove(key);
        cache.remove(_OTP_SEND_PREFIX + email);
        Logger.log('[auth_verifyOtp] ' + email + ' kehabisan percobaan (' +
          _OTP_MAX_ATTEMPTS + '). Kode dihapus.');
        return { success: false, error: 'Terlalu banyak percobaan salah. Silakan minta kode baru.' };
      }
      cache.put(key, JSON.stringify(rec), _OTP_TTL_SEC);
      return {
        success: false,
        error: 'Kode verifikasi salah. Sisa percobaan: ' + (_OTP_MAX_ATTEMPTS - rec.attempts) + '.',
        attemptsLeft: _OTP_MAX_ATTEMPTS - rec.attempts
      };
    }

    // Kode benar → tukar menjadi pendingToken sekali pakai.
    var pendingToken = 'PND-' + Utilities.getUuid().replace(/-/g, '');
    cache.put(_OTP_PENDING_PREFIX + pendingToken,
      JSON.stringify({ email: email, verifiedAt: Date.now() }), _OTP_PENDING_TTL_SEC);
    cache.remove(key);

    return {
      success: true,
      data: { pendingToken: pendingToken, email: email, expiresInSec: _OTP_PENDING_TTL_SEC }
    };
  } catch (e) {
    Logger.log('[auth_verifyOtp] ' + e.message);
    return { success: false, error: 'Gagal memverifikasi kode: ' + e.message };
  }
}

/**
 * Cek & ambil pendingToken milik auth_verifyOtp. Dipanggil auth_register.
 * Token TIDAK dihapus di sini (auth_register baru memakainya di akhir, agar
 * registrasi yang gagal di tengah tidak memaksa user mengulang OTP);
 * penghapusan dilakukan terpisah lewat _otpDropPending.
 *
 * `params.email` diverifikasi agar token milik satu email tidak bisa dipakai
 * untuk mendaftar email lain.
 *
 * @param {string} pendingToken
 * @param {string} email - email yang sedang didaftarkan
 * @return {{ok: boolean, error?: string, token?: string}}
 */
function _otpConsumePending(pendingToken, email) {
  if (!pendingToken) {
    return { ok: false, error: 'Verifikasi email belum dilakukan. Silakan masukkan kode OTP terlebih dahulu.' };
  }
  var raw = CacheService.getScriptCache().get(_OTP_PENDING_PREFIX + pendingToken);
  if (!raw) {
    return { ok: false, error: 'Sesi verifikasi email sudah kedaluwarsa. Silakan minta kode OTP baru.' };
  }
  var rec;
  try {
    rec = JSON.parse(raw);
  } catch (e) {
    CacheService.getScriptCache().remove(_OTP_PENDING_PREFIX + pendingToken);
    return { ok: false, error: 'Sesi verifikasi email rusak. Silakan minta kode OTP baru.' };
  }
  if (String(rec.email || '').toLowerCase() !== String(email || '').toLowerCase()) {
    return { ok: false, error: 'Kode OTP tidak cocok dengan email yang sedang didaftarkan. Verifikasi ulang email tersebut.' };
  }
  return { ok: true, token: pendingToken };
}

function _otpDropPending(pendingToken) {
  if (pendingToken) CacheService.getScriptCache().remove(_OTP_PENDING_PREFIX + pendingToken);
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
    if (user['Status'] === USER_STATUS.NONAKTIF) {
      return { success: false, error: 'Akun telah dinonaktifkan oleh Superadmin. Silakan hubungi pengelola.' };
    }
    if (user['Status'] === USER_STATUS.REJECTED) {
      return { success: false, error: 'Akun telah ditolak. Silakan daftarkan akun baru.' };
    }

    // Buat session (untuk PENDING maupun APPROVED)
    _clearRevokedUser(user['UserID']);
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
      
      function _cellStr(v) {
        if (v === null || v === undefined || v === '') return '';
        if (v instanceof Date) return v.toISOString();
        return String(v);
      }

      return {
        queueId:     _cellStr(q['QueueID']),
        userId:      _cellStr(q['UserID']),
        nama:        userRow  ? _cellStr(userRow.obj['Nama'])          : '?',
        email:       userRow  ? _cellStr(userRow.obj['Email'])         : '?',
        roleDilamar: _cellStr(q['RoleDilamar']),
        divisiId:    _cellStr(q['DivisiID']),
        namaDivisi:  divisiRow ? _cellStr(divisiRow.obj['NamaDashboard']) : '?',
        registeredAt:userRow  ? _cellStr(userRow.obj['RegisteredAt'])  : ''
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
  if (CacheService.getScriptCache().get(_REVOKED_PREFIX + session.userId)) {
    // Akun diubah Superadmin (status/role/divisi) → paksa login ulang agar
    // sesi lama tidak lagi memakai hak akses yang sudah usang.
    CacheService.getScriptCache().remove(_SESSION_PREFIX + token);
    throw new Error('UNAUTHORIZED: Akun Anda baru saja diperbarui. Silakan login ulang.');
  }
  return session;
}

/**
 * Cabut seluruh sesi aktif seorang user (best-effort, tanpa enumerasi token).
 * Dipanggil AdminService setiap kali akun diubah.
 */
function _revokeUserSessions(userId) {
  if (!userId) return;
  CacheService.getScriptCache().put(_REVOKED_PREFIX + userId, String(new Date().getTime()), _REVOKED_TTL_SEC);
}

/** Bersihkan marker pencabutan — dipanggil saat login berhasil (idents freshly proved). */
function _clearRevokedUser(userId) {
  if (!userId) return;
  CacheService.getScriptCache().remove(_REVOKED_PREFIX + userId);
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
