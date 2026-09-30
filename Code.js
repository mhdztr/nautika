/**
 * Code.js — Entry point Google Apps Script (Nautika)
 *
 * doGet()  : serve SPA frontend (diimplementasi Fase 3)
 * doPost() : tidak dipakai — semua komunikasi client-server lewat google.script.run
 *
 * Struktur kode mengikuti ARCHITECTURE.md §7:
 *   /utils        — Constants.js, DateUtil.js, Lock.js
 *   /services     — AuthService.js, TataUsahaService.js, dst.
 *   /data         — SheetAccess.js, ValidationRules.js
 *   /html         — Index.html, Style.html, Script_Main.html, /views
 *   Setup.js      — inisialisasi database (jalankan sekali, lihat petunjuk di file itu)
 *   Router.js     — mapping aksi frontend → service function
 */

/**
 * Serve SPA frontend.
 * Fase 3+: serve html/Index (shell SPA penuh, auth terintegrasi).
 *
 * @param {GoogleAppsScript.Events.DoGet} e
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('html/Index')
    .evaluate()
    .setTitle('Nautika — Direktorat POA, KKP RI')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper untuk include file HTML lain di dalam template GAS.
 * Dipakai di Fase 3+ saat SPA shell membutuhkan partial templates.
 * Contoh penggunaan di template: <?!= html_include('html/Style'); ?>
 *
 * @param {string} filename - nama file tanpa ekstensi
 * @returns {string} konten HTML
 */
function html_include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * DEBUG ONLY — akan dihapus setelah blocker Fase 7 selesai.
 * Dipanggil via `clasp run` (bukan doGet), mengembalikan temuan ringkas
 * tentang byte persis hasil evaluasi template Index (identik dgn yg di-serve ke browser /dev).
 */
function doExportAudit() {
  var out = {};
  try {
    var served = HtmlService.createTemplateFromFile('html/Index').evaluate().getContent();
    out.len = served.length;
    out.lineCount = served.split('\n').length;
    var sha = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, served, Utilities.Charset.UTF_8);
    out.sha256 = sha.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
    var lines = served.split('\n');
    out.line3517 = lines[3516] || '(OOB)';
    out.line3517Col22 = (lines[3516] || '').charAt(21) || '(OOB)';
    out.hasLiteralCloseScript = /<\/script/i.test(served.replace(/<\/script>/gi, '').replace(/<script/gi, ''));
    out.hasScriptletNonInclude = /<\?(?!!= html_include)/.test(served);
    return JSON.stringify(out);
  } catch (err) {
    return 'ERR:' + err.message;
  }
}

/**
 * DEBUG ONLY. Fungsi minimal untuk isolasi error storage GAS.
 */
function debug_ping() {
  var res = { ping: 'pong', ts: new Date().toISOString(), steps: [] };
  try {
    res.steps.push('properties');
    var props = PropertiesService.getScriptProperties();
    var mId = props.getProperty('NAUTIKA_MASTER_SS_ID');
    res.masterId = mId;

    res.steps.push('spreadsheet');
    if (mId) {
      var ss = SpreadsheetApp.openById(mId);
      res.ssName = ss.getName();
    }
  } catch (e) {
    res.error = e.message;
  }
  return res;
}

/**
 * DEBUG ONLY. Membaca html/Index via jalur yang sama dengan doGet, tapi
 * mengembalikan ringkasan singkat (bukan doc penuh) agar bisa diverifikasi
 * melalui clasp run tanpa kanal stdout yang rawan.
 */
function debug_readIndex() {
  try {
    var served = HtmlService.createTemplateFromFile('html/Index').evaluate().getContent();
    var json = {
      len: served.length,
      lineCount: served.split('\n').length,
      line3517: (served.split('\n')[3516] || '(OOB)'),
      line3516: (served.split('\n')[3515] || '(OOB)'),
      line3518: (served.split('\n')[3517] || '(OOB)')
    };
    return json;
  } catch (err) {
    return { caughtError: String(err), stack_first_line: (err && err.stack ? String(err.stack).split('\n')[0] : '(no stack)') };
  }
}

/**
 * DEBUG ONLY — Diagnosa admin_getUsers tanpa token.
 * Jalankan dari editor GAS: pilih fungsi ini di dropdown lalu klik "Run".
 * Lihat hasil di panel "Execution log" atau "Executions".
 * Hapus setelah masalah teridentifikasi.
 */
function debug_adminCheck() {
  var results = { step: '', error: null };
  try {
    results.step = '1_getIds';
    var ids = getSpreadsheetIds();
    results.masterId_prefix = (ids.masterId || '').substring(0, 8) + '...';

    results.step = '2_openUsers';
    var usersSheet = openMasterSheet(SHEET_MASTER.USERS);
    results.usersSheetExists = !!usersSheet;

    results.step = '3_readUsers';
    var rows = sheetToObjects(usersSheet);
    results.rowCount = rows.length;

    results.step = '4_openDivisi';
    var divisiSheet = openMasterSheet(SHEET_MASTER.DIVISI);
    results.divisiSheetExists = !!divisiSheet;

    results.step = '5_mapValues';
    // Cek apakah ada Date object yang berpotensi bermasalah saat serialisasi
    var sample = rows.slice(0, 3).map(function (u) {
      return {
        userId: String(u['UserID'] || ''),
        nama: String(u['Nama'] || ''),
        registeredAt_type: typeof u['RegisteredAt'],
        registeredAt_isDate: u['RegisteredAt'] instanceof Date,
        approvedAt_type: typeof u['ApprovedAt'],
        approvedAt_isDate: u['ApprovedAt'] instanceof Date
      };
    });
    results.sample = sample;
    results.step = 'DONE';
    Logger.log('[debug_adminCheck] ' + JSON.stringify(results));
    return results;
  } catch (e) {
    results.error = e.message;
    results.stack = e.stack || '';
    Logger.log('[debug_adminCheck] FAIL at ' + results.step + ': ' + e.message);
    return results;
  }
}
