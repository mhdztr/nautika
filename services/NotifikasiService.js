/**
 * services/NotifikasiService.js
 * Pusat notifikasi in-app (sheet Notifications) + reminder mingguan (email).
 * PRD §5.8 (notifikasi approval & data void) + Fase 13: halaman Notifikasi,
 * badge unread, dan pengingat "belum melapor" otomatis akhir minggu (Jumat).
 *
 * Fungsi publik (dipanggil via google.script.run dari frontend):
 *   notifikasi_getList(token)
 *   notifikasi_getRingkasan(token)
 *   notifikasi_markRead(token, notifId)
 *   notifikasi_markAllRead(token)
 *   notifikasi_generateReminderMingguan(token)   — Superadmin (tombol "Kirim Sekarang")
 *   notifikasi_getReminderSettings(token)        — Superadmin
 *   notifikasi_setReminderAktif(token, aktif)    — Superadmin
 *   notifikasi_kirimReminderMingguan()           — tanpa argumen, dipanggil time trigger Jumat
 *
 * Semua fungsi publik mengembalikan {success: true, data: ...} atau {success: false, error: "..."}.
 *
 * Catatan keputusan (Fase 13):
 * - Pemetaan "belum melapor" memakai _dashMelaporDetail() (7 divisi, basis
 *   divisi sesuai PRD §4) dari DashboardService — satu definisi yang sama
 *   dengan KPI "Divisi Melapor" di Ikhtisar.
 * - Aksi admin (aktivasi trigger) dicatat audit dengan Aksi UPDATE (enum
 *   Audit_Log tidak diperluas) — lihat CHANGELOG.
 */

// ===========================================================================
// FUNGSI PUBLIK
// ===========================================================================

/**
 * Daftar notifikasi milik user yang login, terbaru di atas.
 * @param {string} token
 */
function notifikasi_getList(token) {
  try {
    var session = _requireSession(token);
    assertScope(session, null, null);

    var rows = sheetToObjects(openLogSheet(SHEET_LOG.NOTIFICATIONS))
      .filter(function (r) { return String(r['UserID']) === session.userId; })
      .sort(function (a, b) { return _ntfTS(b['CreatedAt']) - _ntfTS(a['CreatedAt']); });

    var items = rows.map(function (r) {
      return {
        notifId:   r['NotifID'],
        jenis:     r['Jenis'],
        pesan:     r['Pesan'],
        isRead:    _ntfIsRead(r['IsRead']),
        createdAt: r['CreatedAt']
      };
    });

    return { success: true, data: { unreadCount: _ntfUnread(rows), items: items } };
  } catch (e) {
    Logger.log('[notifikasi_getList] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Ringkasan ringan untuk shell (stripe "belum melapor" + badge unread).
 * Detail besar (isibelum) dikomputasi server-side agar client tidak perlu
 * tahu pemetaan divisi → sheet.
 *
 * @param {string} token
 * @returns {Object} { unreadCount, divisiBelumMelapor: {divisiId,label}|null }
 */
function notifikasi_getRingkasan(token) {
  try {
    var session = _requireSession(token);
    assertScope(session, null, null);

    var rows = sheetToObjects(openLogSheet(SHEET_LOG.NOTIFICATIONS))
      .filter(function (r) { return String(r['UserID']) === session.userId; });

    var divisiBelum = null;
    // Banner hanya relevan untuk akun dengan divisi non-kosong (Kadiv/Staf).
    // OPTIMASI: daripada panggil _dashMelaporDetail() (baca semua 7+ sheet TX,
    // mahal), cari hanya sheet divisi user yang bersangkutan.
    if (session.divisiId) {
      try {
        var divisiList = _ovMelaporDivisiList();
        var weekRange = periodeToDateRange(getCurrentPeriode());
        for (var i = 0; i < divisiList.length; i++) {
          var d = divisiList[i];
          if (String(d.divisiId) !== String(session.divisiId)) continue;
          // Hanya baca sheet divisi ini
          var melapor = false;
          if (weekRange) {
            for (var s = 0; s < d.sheets.length && !melapor; s++) {
              try {
                _dashActiveRows(d.sheets[s], true).forEach(function (r) {
                  if (melapor) return;
                  if (String(r['DivisiID'] || '').trim() &&
                      String(r['DivisiID']) !== String(session.divisiId)) return;
                  var pr = periodeToDateRange(String(r['Periode'] || ''));
                  var inWeek = pr
                    ? (pr.startDate <= weekRange.endDate && pr.endDate >= weekRange.startDate)
                    : isInRange(new Date(r['Timestamp']), weekRange);
                  if (inWeek) melapor = true;
                });
              } catch (eSheet) {}
            }
          }
          if (!melapor) {
            divisiBelum = { divisiId: d.divisiId, label: d.label };
          }
          break;
        }
      } catch (eDivisi) {
        Logger.log('[notifikasi_getRingkasan] Cek melapor gagal: ' + eDivisi.message);
        // Tidak kritis — banner tidak tampil, bukan crash
      }
    }

    return {
      success: true,
      data: {
        unreadCount: _ntfUnread(rows),
        divisiBelumMelapor: divisiBelum
      }
    };
  } catch (e) {
    Logger.log('[notifikasi_getRingkasan] ' + e.message);
    return { success: false, error: e.message };
  }
}


/**
 * Tandai satu notifikasi sebagai sudah dibaca.
 * @param {string} token
 * @param {string} notifId
 */
function notifikasi_markRead(token, notifId) {
  try {
    return withLock(function () {
      var session = _requireSession(token);
      assertScope(session, null, null);

      var sheet = openLogSheet(SHEET_LOG.NOTIFICATIONS);
      var found = findRowByField(sheet, 'NotifID', notifId);
      if (!found) {
        return { success: false, error: 'Notifikasi tidak ditemukan.' };
      }
      if (String(found.obj['UserID']) !== session.userId) {
        return { success: false, error: 'FORBIDDEN: Bukan notifikasi milik Anda.' };
      }
      if (!_ntfIsRead(found.obj['IsRead'])) {
        updateRowCells(sheet, found.rowIndex, { 'IsRead': true });
      }
      return { success: true, data: { notifId: notifId } };
    });
  } catch (e) {
    Logger.log('[notifikasi_markRead] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Tandai semua notifikasi user sebagai sudah dibaca.
 * @param {string} token
 */
function notifikasi_markAllRead(token) {
  try {
    return withLock(function () {
      var session = _requireSession(token);
      assertScope(session, null, null);

      var sheet = openLogSheet(SHEET_LOG.NOTIFICATIONS);
      // Single pass: baca data sekali lalu tulis per baris unread milik user ini.
      // (findRowByField per baris = N+1 getDataRange, terlalu mahal untuk sheet penuh)
      var unread = _ntfUnreadRows(sheet, session.userId);
      unread.forEach(function (u) {
        updateRowCells(sheet, u.rowIndex, { 'IsRead': true });
      });
      return { success: true, data: { marked: unread.length } };
    });
  } catch (e) {
    Logger.log('[notifikasi_markAllRead] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Kirim reminder mingguan SEKARANG (tombol "Kirim Sekarang" di Admin Panel).
 * Hanya SUPERADMIN. Memakai inti yang sama dengan trigger waktu.
 * @param {string} token
 */
function notifikasi_generateReminderMingguan(token) {
  try {
    var session = _requireSession(token);
    assertScope(session, [ROLE.SUPERADMIN], null);
    var result = _kirimReminderMingguan();
    return { success: true, data: result };
  } catch (e) {
    Logger.log('[notifikasi_generateReminderMingguan] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Status auto-reminder mingguan (apakah trigger waktu aktif). Hanya SUPERADMIN.
 * @param {string} token
 */
function notifikasi_getReminderSettings(token) {
  try {
    var session = _requireSession(token);
    assertScope(session, [ROLE.SUPERADMIN], null);
    return { success: true, data: _ntfReminderState() };
  } catch (e) {
    Logger.log('[notifikasi_getReminderSettings] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Nyalakan/matikan auto-reminder mingguan (buat/hapus time trigger Jumat).
 * Hanya SUPERADMIN. Dicatat di Audit_Log (Aksi UPDATE).
 *
 * @param {string} token
 * @param {boolean} aktif
 */
function notifikasi_setReminderAktif(token, aktif) {
  try {
    return withLock(function () {
      var session = _requireSession(token);
      assertScope(session, [ROLE.SUPERADMIN], null);

      if (aktif === true) {
        _ntfInstallTrigger();
      } else if (aktif === false) {
        _ntfRemoveTrigger();
      } else {
        return { success: false, error: 'Nilai aktif tidak valid.' };
      }

      _auditLog(session.userId, 'UPDATE', 'SYSTEM', 'SYSTEM_REMINDER_TRIGGER',
        'Auto-reminder laporan mingguan ' + (aktif ? 'diaktifkan' : 'dinonaktifkan') + ' oleh Superadmin.');

      return { success: true, data: _ntfReminderState() };
    });
  } catch (e) {
    Logger.log('[notifikasi_setReminderAktif] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Entry point time trigger (Jumat 16:00). TANPA argumen & TANPA token —
 * berjalan sebagai pemilik script; jangan dipanggil dari google.script.run.
 */
function notifikasi_kirimReminderMingguan() {
  try {
    var result = _kirimReminderMingguan();
    Logger.log('[notifikasi_kirimReminderMingguan] OK: ' + JSON.stringify(result));
  } catch (e) {
    Logger.log('[notifikasi_kirimReminderMingguan] GAGAL: ' + e.message);
  }
}

// ===========================================================================
// INTI REMINDER
// ===========================================================================

/**
 * Kirim pengingat ke Kadiv & Staf APPROVED di divisi yang BELUM melapor
 * pada minggu berjalan: tulis baris REMINDER_MINGGUAN (in-app) + email.
 * withLock() agar tumpang-tindih trigger & tombol manual tidak mengirim dobel.
 *
 * @returns {Object} ringkasan { periode, sentEmails, notified, divisions[] }
 */
function _kirimReminderMingguan() {
  return withLock(function () {
    var periode = getCurrentPeriode();
    var detail = _dashMelaporDetail();
    var belum = detail.filter(function (d) { return !d.melapor; });

    var usersSheet  = openMasterSheet(SHEET_MASTER.USERS);
    var divisiSheet = openMasterSheet(SHEET_MASTER.DIVISI);
    var users = sheetToObjects(usersSheet);

    var namaDivisi = {};
    sheetToObjects(divisiSheet).forEach(function (dv) {
      namaDivisi[String(dv['DivisiID'])] = dv['NamaDashboard'] || dv['NamaResmi'] || String(dv['DivisiID']);
    });

    var sentEmails = 0;
    var notified = 0;
    var divisions = belum.map(function (dv) {
      var label = namaDivisi[String(dv.divisiId)] || dv.label;
      var targets = users.filter(function (u) {
        return u['Status'] === USER_STATUS.APPROVED &&
               String(u['DivisiID']) === String(dv.divisiId) &&
               (u['Role'] === ROLE.KADIV || u['Role'] === ROLE.STAF);
      });
      var pesan = 'Divisi ' + label +
        ' belum mengirim laporan mingguan untuk periode ' + periode +
        '. Mohon lengkapi laporan sebelum akhir pekan.';

      targets.forEach(function (u) {
        _notify(u['UserID'], 'REMINDER_MINGGUAN', pesan);
        notified++;
        try {
          MailApp.sendEmail(u['Email'], 'Pengingat Laporan Mingguan — ' + periode, pesan);
          sentEmails++;
        } catch (e) {
          Logger.log('[reminder] Gagal kirim email ke ' + u['Email'] + ': ' + e.message);
        }
      });

      return { divisiId: dv.divisiId, label: label, targetCount: targets.length };
    });

    return {
      periode: periode,
      sentEmails: sentEmails,
      notified: notified,
      divisions: divisions
    };
  });
}

// ===========================================================================
// HELPER INTERNAL
// ===========================================================================

function _ntfTS(v) {
  var d = new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function _ntfIsRead(v) {
  return String(v).toUpperCase() === 'TRUE';
}

function _ntfUnread(rows) {
  var n = 0;
  for (var i = 0; i < rows.length; i++) {
    if (!_ntfIsRead(rows[i]['IsRead'])) n++;
  }
  return n;
}

/**
 * Baris unread milik seorang user, lengkap dengan rowIndex spreadsheet.
 * Satu kali baca range (bukan findRowByField per baris).
 * @returns {Array<{rowIndex:number, obj:Object}>}
 */
function _ntfUnreadRows(sheet, userId) {
  var out = [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return out;
  var headers = data[0];
  var iUser = headers.indexOf('UserID');
  var iRead = headers.indexOf('IsRead');
  if (iUser === -1 || iRead === -1) return out;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][iUser]) === String(userId) && !_ntfIsRead(data[i][iRead])) {
      var obj = {};
      headers.forEach(function (h, j) { obj[h] = data[i][j]; });
      out.push({ obj: obj, rowIndex: i + 1 });
    }
  }
  return out;
}

function _ntfReminderState() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_KEY.REMINDER_TRIGGER_ID);
  var aktif = false;
  if (id) {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getUniqueId() === id) { aktif = true; break; }
    }
    if (!aktif) props.deleteProperty(PROP_KEY.REMINDER_TRIGGER_ID);
  }
  return { aktif: aktif, jadwal: 'Jumat 16:00 (mingguan)' };
}

function _ntfInstallTrigger() {
  // Idempoten: matikan trigger lama lebih dulu supaya toggle berulang /
  // trigger yang hilang dari Properties tidak menghasilkan trigger ganda.
  _ntfRemoveTrigger();
  var trigger = ScriptApp.newTrigger('notifikasi_kirimReminderMingguan')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(16)
    .everyWeeks(1)
    .create();
  PropertiesService.getScriptProperties()
    .setProperty(PROP_KEY.REMINDER_TRIGGER_ID, trigger.getUniqueId());
}

function _ntfRemoveTrigger() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_KEY.REMINDER_TRIGGER_ID);
  if (!id) return;
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getUniqueId() === id) ScriptApp.deleteTrigger(triggers[i]);
    }
  } catch (e) {
    Logger.log('[_ntfRemoveTrigger] ' + e.message);
  }
  props.deleteProperty(PROP_KEY.REMINDER_TRIGGER_ID);
}