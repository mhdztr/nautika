/**
 * utils/DateUtil.js
 * Helper konversi tanggal ↔ Periode (format YYYY-MM-WW).
 *
 * Format Periode: "YYYY-MM-WW"
 *   YYYY = tahun (4 digit)
 *   MM   = bulan (01-12)
 *   WW   = urutan minggu dalam bulan tersebut (01-05)
 *          Minggu dihitung dari tanggal 1: tgl 1-7 = W01, 8-14 = W02, dst.
 *
 * Dipakai oleh semua service modul (TataUsaha, OperasiLaut, dsb.)
 * untuk meng-key baris transaksi mingguan dan memfilter query.
 */

// ── FORMAT PERIODE ────────────────────────────────────────

/**
 * Konversi Date → string Periode "YYYY-MM-WW".
 * @param {Date} date
 * @returns {string}
 */
function dateToPeriode(date) {
  var d     = date || new Date();
  var year  = d.getFullYear();
  var month = d.getMonth() + 1;                   // 1-12
  var day   = d.getDate();                         // 1-31
  var week  = Math.ceil(day / 7);                  // 1-5
  return year + '-' +
    _pad(month) + '-W' +
    _pad(week);
}

/**
 * Periode minggu berjalan.
 * @returns {string}
 */
function getCurrentPeriode() {
  return dateToPeriode(new Date());
}

/**
 * Periode minggu berjalan — versi publik untuk frontend (`google.script.run`).
 * Dipakai di html/Script_Main.html (`_renderOperasiLaut`) untuk menampilkan
 * hint "Periode saat ini" di form Operasi Laut.
 * @returns {string}
 */
function utils_getCurrentPeriode() {
  return getCurrentPeriode();
}

/**
 * Parse string Periode → {year, month, week}.
 * @param {string} periodeStr
 * @returns {{year:number, month:number, week:number}|null}
 */
function parsePeriode(periodeStr) {
  if (!periodeStr) return null;
  var m = String(periodeStr).match(/^(\d{4})-(\d{2})-W(\d{2})$/);
  if (!m) return null;
  return {
    year:  parseInt(m[1], 10),
    month: parseInt(m[2], 10),
    week:  parseInt(m[3], 10)
  };
}

// ── RANGE UNTUK FILTER QUERY ──────────────────────────────

/**
 * Ubah APP.filter (dari frontend) → {startDate, endDate} untuk
 * memfilter baris transaksi.
 *
 * @param {{mode:string, month:number, year:number, dateFrom:string, dateTo:string}} filter
 * @returns {{startDate:Date, endDate:Date}}
 */
function filterToDateRange(filter) {
  if (filter.mode === 'range') {
    var from = filter.dateFrom ? new Date(filter.dateFrom) : new Date(filter.year, 0, 1);
    var to   = filter.dateTo   ? new Date(filter.dateTo)   : new Date();
    to.setHours(23, 59, 59, 999);
    return { startDate: from, endDate: to };
  }
  // mode monthly
  var year  = filter.year  || new Date().getFullYear();
  var month = filter.month || (new Date().getMonth() + 1);
  var start = new Date(year, month - 1, 1);
  var end   = new Date(year, month, 0, 23, 59, 59, 999); // hari terakhir bulan
  return { startDate: start, endDate: end };
}

/**
 * Konversi Periode string ke range Date (Senin–Minggu minggu bersangkutan).
 * Dipakai untuk cek apakah suatu baris termasuk dalam rentang filter.
 *
 * @param {string} periodeStr  e.g. "2026-09-W02"
 * @returns {{startDate:Date, endDate:Date}|null}
 */
function periodeToDateRange(periodeStr) {
  var p = parsePeriode(periodeStr);
  if (!p) return null;
  // Tanggal pertama minggu tsb: (week-1)*7 + 1
  var dayStart = (p.week - 1) * 7 + 1;
  var dayEnd   = Math.min(dayStart + 6, new Date(p.year, p.month, 0).getDate());
  var start    = new Date(p.year, p.month - 1, dayStart);
  var end      = new Date(p.year, p.month - 1, dayEnd, 23, 59, 59, 999);
  return { startDate: start, endDate: end };
}

/**
 * Cek apakah timestamp Date berada dalam range filter.
 * Dipakai di service untuk filter baris transaksi.
 *
 * @param {Date} timestamp
 * @param {{startDate:Date, endDate:Date}} range
 * @returns {boolean}
 */
function isInRange(timestamp, range) {
  var ts = new Date(timestamp);
  return ts >= range.startDate && ts <= range.endDate;
}

/**
 * Daftar bulan "YYYY-MM" dari Januari s/d akhir rentang filter.
 * Dipakai endpoint *_getTren (Fase 8) untuk label & slot array seri chart.
 *
 * - mode monthly → Jan..(filter.year, filter.month)
 * - mode range   → Jan..bulan dari filter.dateTo (tahun dari dateTo)
 *
 * @param {{mode:string, month:number, year:number, dateFrom:string, dateTo:string}} filter
 * @returns {string[]} e.g. ['2026-01','2026-02', ... ]
 */
function utils_getTrendMonths(filter) {
  var f = filter || {};
  var year, lastMonth;
  if (f.mode === 'range' && f.dateTo) {
    var end = new Date(f.dateTo);
    year = end.getFullYear();
    lastMonth = end.getMonth() + 1;
  } else {
    year = f.year || new Date().getFullYear();
    lastMonth = f.month || (new Date().getMonth() + 1);
  }
  var out = [];
  for (var m = 1; m <= lastMonth; m++) {
    out.push(year + '-' + _pad(m));
  }
  return out;
}

// ── HELPER INTERNAL ───────────────────────────────────────

function _pad(n) {
  return n < 10 ? '0' + n : String(n);
}
