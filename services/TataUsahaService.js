/**
 * services/TataUsahaService.js
 * Modul Tata Usaha — anggaran SP2D dan Akrual.
 *
 * Fungsi publik (google.script.run):
 *   tataUsaha_getKPI(token, filter)
 *   tataUsaha_getHistory(token, filter)
 *   tataUsaha_submitMingguan(token, params)
 *   tataUsaha_revisi(token, params)
 *   tataUsaha_anulir(token, params)
 *
 * RBAC (sesuai PRD §7 + konfirmasi 15 Sep 2026):
 *   Baca    : semua APPROVED (SUPERADMIN/DIREKTUR cross-divisi; KADIV/STAF hanya DIV-TU)
 *   Submit  : SUPERADMIN + KADIV(DIV-TU) + STAF(DIV-TU)
 *   Revisi  : SUPERADMIN + KADIV(DIV-TU) + STAF(DIV-TU)
 *   Anulir  : SUPERADMIN + DIREKTUR + KADIV(DIV-TU)  [Staf tidak bisa anulir]
 *
 * Kalkulasi on-read (tidak disimpan ke sheet, sesuai DATA_SCHEMA.md):
 *   PaguTotal, RealisasiAkumulatif SP2D & Akrual, Sisa SP2D & Akrual, %SP2D, %Akrual.
 *
 * Void (anulir) — PRD §7 aturan:
 *   - VoidReason wajib, tidak bisa kosong.
 *   - Setelah void, periode tersebut terbuka kembali untuk submit baru.
 *   - Duplikat-cek hanya memblokir jika ada baris ACTIVE; baris VOID tidak menghalangi.
 */

var _TU_DIVISI_ID = 'DIV-TU';

/**
 * Berapa kali Pagu sudah direvisi.
 *
 * Definisi: jumlah TRANSISI nilai (PaguReguler, PaguABT) pada baris ACTIVE
 * yang berbeda dari baris ACTIVE sebelumnya, dibaca kronologis. Baris
 * pertama tidak dihitung — itu pagu awal, bukan revisi.
 *
 * Menghitung seluruh riwayat, bukan hanya rantai Supersedes satu periode,
 * karena Pagu bersifat kumulatif: nilainya diwarisi laporan minggu
 * sebelumnya, jadi revisi bisa terjadi di periode mana pun.
 *
 * Dihitung dari perubahan NILAI, bukan dari `CatatanRevisiPagu` yang terisi:
 * `tataUsaha_revisi` mewajibkan alasan revisi tapi tidak memaksa Catatan
 * Revisi Pagu walau Pagu berubah, jadi menghitung dari kolom catatan akan
 * understated.
 *
 * @param {Array<Object>} activeRows Baris TX_TataUsaha berstatus ACTIVE.
 * @returns {number} jumlah revisi pagu yang sudah terjadi.
 */
function _tuHitungRevisiPagu(activeRows) {
  var urut = activeRows.slice().sort(function (a, b) {
    return new Date(a['Timestamp']) - new Date(b['Timestamp']);
  });
  var jumlah = 0;
  var prev = null;
  for (var i = 0; i < urut.length; i++) {
    var cur = { r: _num(urut[i]['PaguReguler']), a: _num(urut[i]['PaguABT']) };
    if (prev && (cur.r !== prev.r || cur.a !== prev.a)) jumlah++;
    prev = cur;
  }
  return jumlah;
}

// ── BACA KPI ─────────────────────────────────────────────

/**
 * KPI aggregate Tata Usaha untuk periode yang dipilih.
 *
 * @param {string} token
 * @param {{mode:string, month:number, year:number, dateFrom:string, dateTo:string}} filter
 * @returns {{success:boolean, data:{
 *   paguReguler: number, paguABT: number, paguTotal: number,
 *   revisiPagu: number,   // berapa kali pagu sudah direvisi (seluruh riwayat)
 *   realisasiSP2D: number, realisasiAkrual: number,
 *   sisaSP2D: number, sisaAkrual: number,
 *   pctSP2D: number, pctAkrual: number,
 *   mingguTerakhirSubmit: string, periodeAktif: string
 * }}}
 */
function tataUsaha_getKPI(token, filter) {
  try {
    var session = _tuRequireSession(token);
    _tuAssertRead(session);

    var sheet  = openTransaksiSheet(SHEET_TX.TATA_USAHA);
    var rows   = sheetToObjects(sheet);
    var range  = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth()+1, year: new Date().getFullYear() });

    // Baris ACTIVE dalam range filter
    var activeInRange = rows.filter(function (r) {
      return String(r['Status']) === ROW_STATUS.ACTIVE &&
             isInRange(new Date(r['Timestamp']), range);
    });

    // Pagu: ambil dari baris ACTIVE terbaru (bisa di luar range — pagu bersifat kumulatif)
    var activeAll = rows.filter(function (r) { return String(r['Status']) === ROW_STATUS.ACTIVE; });
    activeAll.sort(function (a, b) { return new Date(b['Timestamp']) - new Date(a['Timestamp']); });
    var latestActive = activeAll[0] || null;

    var paguReguler = latestActive ? _num(latestActive['PaguReguler']) : 0;
    var paguABT     = latestActive ? _num(latestActive['PaguABT'])     : 0;
    var paguTotal   = paguReguler + paguABT;

    // Realisasi akumulatif = SUM dari baris ACTIVE secara YTD (1 Jan s.d. batas akhir filter)
    var tahunRef = range.startDate.getFullYear();
    var ytdStart = new Date(tahunRef, 0, 1);

    var realisasiSP2D_Reguler   = 0;
    var realisasiSP2D_ABT       = 0;
    var realisasiAkrual_Reguler = 0;
    var realisasiAkrual_ABT     = 0;

    rows.forEach(function (r) {
      if (String(r['Status']) !== ROW_STATUS.ACTIVE) return;
      var ts = new Date(r['Timestamp']);
      if (ts >= ytdStart && ts <= range.endDate) {
        var sp2dReg = _num(r['RealisasiSP2D_Reguler_Minggu']);
        var sp2dAbt = _num(r['RealisasiSP2D_ABT_Minggu']);
        var akruReg = _num(r['RealisasiAkrual_Reguler_Minggu']);
        var akruAbt = _num(r['RealisasiAkrual_ABT_Minggu']);
        var legSP2D = _num(r['RealisasiSP2D_Minggu']);
        var legAkru = _num(r['RealisasiAkrual_Minggu']);

        if (sp2dReg > 0 || sp2dAbt > 0) {
          realisasiSP2D_Reguler += sp2dReg;
          realisasiSP2D_ABT     += sp2dAbt;
        } else {
          // Fallback legacy row
          realisasiSP2D_Reguler += legSP2D;
        }

        if (akruReg > 0 || akruAbt > 0) {
          realisasiAkrual_Reguler += akruReg;
          realisasiAkrual_ABT     += akruAbt;
        } else {
          // Fallback legacy row
          realisasiAkrual_Reguler += legAkru;
        }
      }
    });

    var realisasiSP2D_Total   = realisasiSP2D_Reguler + realisasiSP2D_ABT;
    var realisasiAkrual_Total = realisasiAkrual_Reguler + realisasiAkrual_ABT;

    // Sisa Pagu (Pagu - Realisasi SP2D)
    var sisaSP2D_Reguler = paguReguler - realisasiSP2D_Reguler;
    var sisaSP2D_ABT     = paguABT     - realisasiSP2D_ABT;
    var sisaSP2D_Total   = paguTotal   - realisasiSP2D_Total;

    var sisaAkrual_Reguler = paguReguler - realisasiAkrual_Reguler;
    var sisaAkrual_ABT     = paguABT     - realisasiAkrual_ABT;
    var sisaAkrual_Total   = paguTotal   - realisasiAkrual_Total;

    // Persentase Serapan Konsolidasi Nasional yang sah: (Total SP2D Reguler + ABT) / (Total Pagu) * 100
    var pctSP2D_Reguler    = paguReguler > 0 ? _round((realisasiSP2D_Reguler / paguReguler) * 100, 2) : 0;
    var pctSP2D_ABT        = paguABT     > 0 ? _round((realisasiSP2D_ABT     / paguABT)     * 100, 2) : 0;
    var pctSerapanNasional = paguTotal   > 0 ? _round((realisasiSP2D_Total   / paguTotal)   * 100, 2) : 0;

    var pctAkrual_Reguler = paguReguler > 0 ? _round((realisasiAkrual_Reguler / paguReguler) * 100, 2) : 0;
    var pctAkrual_ABT     = paguABT     > 0 ? _round((realisasiAkrual_ABT     / paguABT)     * 100, 2) : 0;
    var pctAkrual_Total   = paguTotal   > 0 ? _round((realisasiAkrual_Total   / paguTotal)   * 100, 2) : 0;

    // Minggu terakhir submit (ACTIVE terbaru dalam range)
    var latest = activeInRange.slice().sort(function (a, b) {
      return new Date(b['Timestamp']) - new Date(a['Timestamp']);
    })[0];

    return {
      success: true,
      data: {
        paguReguler:             paguReguler,
        paguABT:                 paguABT,
        paguTotal:               paguTotal,
        revisiPagu:              _tuHitungRevisiPagu(activeAll),
        realisasiSP2D:           realisasiSP2D_Total,
        realisasiSP2D_Reguler:   realisasiSP2D_Reguler,
        realisasiSP2D_ABT:       realisasiSP2D_ABT,
        realisasiAkrual:         realisasiAkrual_Total,
        realisasiAkrual_Reguler: realisasiAkrual_Reguler,
        realisasiAkrual_ABT:     realisasiAkrual_ABT,
        sisaSP2D:                sisaSP2D_Total,
        sisaSP2D_Reguler:        sisaSP2D_Reguler,
        sisaSP2D_ABT:            sisaSP2D_ABT,
        sisaAkrual:              sisaAkrual_Total,
        sisaAkrual_Reguler:      sisaAkrual_Reguler,
        sisaAkrual_ABT:          sisaAkrual_ABT,
        pctSP2D:                 pctSerapanNasional,
        pctSP2D_Reguler:         pctSP2D_Reguler,
        pctSP2D_ABT:             pctSP2D_ABT,
        pctSerapanNasional:      pctSerapanNasional,
        pctAkrual:               pctAkrual_Total,
        pctAkrual_Reguler:       pctAkrual_Reguler,
        pctAkrual_ABT:           pctAkrual_ABT,
        mingguTerakhirSubmit:    latest ? String(latest['Periode']) : null,
        periodeAktif:            getCurrentPeriode()
      }
    };
  } catch (e) {
    Logger.log('[tataUsaha_getKPI] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── RIWAYAT ───────────────────────────────────────────────

/**
 * Riwayat baris transaksi (semua status) dalam range filter.
 * Termasuk VoidReason — visible ke seluruh divisi (PRD §7).
 *
 * @param {string} token
 * @param {Object} filter
 */
function tataUsaha_getHistory(token, filter) {
  try {
    var session = _tuRequireSession(token);
    _tuAssertRead(session);

    var sheet = openTransaksiSheet(SHEET_TX.TATA_USAHA);
    var rows  = sheetToObjects(sheet);
    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth()+1, year: new Date().getFullYear() });

    var filtered = rows.filter(function (r) {
      return isInRange(new Date(r['Timestamp']), range);
    });

    // Urutkan terbaru di atas
    filtered.sort(function (a, b) { return new Date(b['Timestamp']) - new Date(a['Timestamp']); });

    var data = filtered.map(function (r) {
      var paguReguler = _num(r['PaguReguler']);
      var paguABT     = _num(r['PaguABT']);
      var paguReguler = _num(r['PaguReguler']);
      var paguABT     = _num(r['PaguABT']);
      var sp2dReg     = _num(r['RealisasiSP2D_Reguler_Minggu']);
      var sp2dAbt     = _num(r['RealisasiSP2D_ABT_Minggu']);
      var akruReg     = _num(r['RealisasiAkrual_Reguler_Minggu']);
      var akruAbt     = _num(r['RealisasiAkrual_ABT_Minggu']);
      var sp2dTot     = (sp2dReg + sp2dAbt) || _num(r['RealisasiSP2D_Minggu']);
      var akruTot     = (akruReg + akruAbt) || _num(r['RealisasiAkrual_Minggu']);

      return {
        rowId:                   String(r['RowID']),
        periode:                 String(r['Periode']),
        submittedBy:             String(r['SubmittedBy']),
        timestamp:               r['Timestamp'] ? new Date(r['Timestamp']).toISOString() : null,
        status:                  String(r['Status']),
        paguReguler:             paguReguler,
        paguABT:                 paguABT,
        paguTotal:               paguReguler + paguABT,
        realisasiSP2D:           sp2dTot,
        realisasiSP2D_Reguler:   sp2dReg,
        realisasiSP2D_ABT:       sp2dAbt,
        realisasiAkrual:         akruTot,
        realisasiAkrual_Reguler: akruReg,
        realisasiAkrual_ABT:     akruAbt,
        catatanRevisiPagu:       String(r['CatatanRevisiPagu'] || ''),
        supersedesRowId:         String(r['SupersedesRowID'] || ''),
        // Komentar anulir — visible ke seluruh divisi (PRD §7)
        voidReason:              String(r['VoidReason']  || ''),
        voidedBy:                String(r['VoidedBy']    || ''),
        voidedAt:                r['VoidedAt'] ? new Date(r['VoidedAt']).toISOString() : null
      };
    });

    return { success: true, data: data };
  } catch (e) {
    Logger.log('[tataUsaha_getHistory] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── SUBMIT MINGGUAN ───────────────────────────────────────

/**
 * Submit laporan mingguan baru.
 *
 * @param {string} token
 * @param {{
 *   periode: string,          // "YYYY-MM-WW"; opsional, default: getCurrentPeriode()
 *   paguReguler: number,
 *   paguABT: number,
 *   realisasiSP2D: number,
 *   realisasiAkrual: number,
 *   realisasiSP2D_Reguler?: number,
 *   realisasiSP2D_ABT?: number,
 *   realisasiAkrual_Reguler?: number,
 *   realisasiAkrual_ABT?: number,
 *   catatanRevisiPagu: string  // opsional; wajib jika Pagu berubah dari sebelumnya
 * }} params
 */
function tataUsaha_submitMingguan(token, params) {
  try {
    return withLock(function () {
      var session = _tuRequireSession(token);
      _tuAssertWrite(session);

      var periode         = (params.periode || getCurrentPeriode()).trim();
      var paguReguler     = _numParam(params.paguReguler,    'Pagu Reguler');
      var paguABT         = _numParam(params.paguABT,        'Pagu ABT');

      // Matriks 2x2 Realisasi: Reguler & ABT
      var sp2dReg = params.realisasiSP2D_Reguler !== undefined && params.realisasiSP2D_Reguler !== '' ? _num(params.realisasiSP2D_Reguler) : null;
      var sp2dAbt = params.realisasiSP2D_ABT !== undefined && params.realisasiSP2D_ABT !== '' ? _num(params.realisasiSP2D_ABT) : null;
      var akruReg = params.realisasiAkrual_Reguler !== undefined && params.realisasiAkrual_Reguler !== '' ? _num(params.realisasiAkrual_Reguler) : null;
      var akruAbt = params.realisasiAkrual_ABT !== undefined && params.realisasiAkrual_ABT !== '' ? _num(params.realisasiAkrual_ABT) : null;

      var realisasiSP2D, realisasiAkrual;
      if (sp2dReg !== null || sp2dAbt !== null) {
        sp2dReg = sp2dReg || 0;
        sp2dAbt = sp2dAbt || 0;
        realisasiSP2D = sp2dReg + sp2dAbt;
      } else {
        realisasiSP2D = _numParam(params.realisasiSP2D, 'Realisasi SP2D');
        sp2dReg = realisasiSP2D;
        sp2dAbt = 0;
      }

      if (akruReg !== null || akruAbt !== null) {
        akruReg = akruReg || 0;
        akruAbt = akruAbt || 0;
        realisasiAkrual = akruReg + akruAbt;
      } else {
        realisasiAkrual = _numParam(params.realisasiAkrual, 'Realisasi Akrual');
        akruReg = realisasiAkrual;
        akruAbt = 0;
      }

      var catatanRevisi   = (params.catatanRevisiPagu || '').trim();

      // Validasi format periode
      if (!parsePeriode(periode)) {
        return { success: false, error: 'Format Periode tidak valid. Gunakan YYYY-MM-WW.' };
      }

      var sheet = openTransaksiSheet(SHEET_TX.TATA_USAHA);
      var rows  = sheetToObjects(sheet);

      // Cek duplikat: blokir hanya jika ada ACTIVE untuk periode yang sama
      var existingActive = rows.filter(function (r) {
        return String(r['Status'])  === ROW_STATUS.ACTIVE &&
               String(r['Periode']) === periode;
      });
      if (existingActive.length > 0) {
        return {
          success: false,
          error: 'Laporan untuk periode ' + periode + ' sudah ada. Gunakan fitur Revisi untuk memperbarui data.'
        };
      }

      // Ambil Pagu terbaru (untuk cek perubahan)
      var activeAll = rows.filter(function (r) { return String(r['Status']) === ROW_STATUS.ACTIVE; });
      activeAll.sort(function (a, b) { return new Date(b['Timestamp']) - new Date(a['Timestamp']); });
      var prevActive = activeAll[0] || null;

      // Validasi: jika Pagu berubah dari sebelumnya, wajib isi catatan
      if (prevActive) {
        var prevReguler = _num(prevActive['PaguReguler']);
        var prevABT     = _num(prevActive['PaguABT']);
        if ((paguReguler !== prevReguler || paguABT !== prevABT) && !catatanRevisi) {
          return {
            success: false,
            error: 'Pagu berbeda dari laporan sebelumnya. Wajib isi Catatan Revisi Pagu.'
          };
        }
      }

      var now   = new Date();
      var rowId = 'TU-' + Utilities.getUuid().replace(/-/g, '').substring(0, 14).toUpperCase();

      appendRowData(sheet, {
        'RowID':                          rowId,
        'DivisiID':                       _TU_DIVISI_ID,
        'Periode':                        periode,
        'SubmittedBy':                    session.userId,
        'Timestamp':                      now,
        'Status':                         ROW_STATUS.ACTIVE,
        'SupersedesRowID':                '',
        'VoidReason':                     '',
        'VoidedBy':                       '',
        'VoidedAt':                       '',
        'PaguReguler':                    paguReguler,
        'PaguABT':                        paguABT,
        'RealisasiSP2D_Minggu':           realisasiSP2D,
        'RealisasiAkrual_Minggu':         realisasiAkrual,
        'RealisasiSP2D_Reguler_Minggu':   sp2dReg,
        'RealisasiSP2D_ABT_Minggu':       sp2dAbt,
        'RealisasiAkrual_Reguler_Minggu': akruReg,
        'RealisasiAkrual_ABT_Minggu':     akruAbt,
        'CatatanRevisiPagu':              catatanRevisi
      });

      _tuAuditLog(session.userId, 'CREATE', rowId, '');

      return {
        success: true,
        data: { rowId: rowId, message: 'Laporan berhasil disimpan.' }
      };
    });
  } catch (e) {
    Logger.log('[tataUsaha_submitMingguan] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── REVISI ────────────────────────────────────────────────

/**
 * Revisi laporan: insert baris baru, mark baris lama SUPERSEDED.
 *
 * @param {string} token
 * @param {{
 *   targetRowId: string,       // RowID baris ACTIVE yang akan direvisi
 *   paguReguler: number,
 *   paguABT: number,
 *   realisasiSP2D: number,
 *   realisasiAkrual: number,
 *   realisasiSP2D_Reguler?: number,
 *   realisasiSP2D_ABT?: number,
 *   realisasiAkrual_Reguler?: number,
 *   realisasiAkrual_ABT?: number,
 *   alasanRevisi: string,       // wajib
 *   catatanRevisiPagu: string   // opsional
 * }} params
 */
function tataUsaha_revisi(token, params) {
  try {
    return withLock(function () {
      var session = _tuRequireSession(token);
      _tuAssertWrite(session);

      var targetRowId     = (params.targetRowId || '').trim();
      var alasanRevisi    = (params.alasanRevisi || '').trim();
      var paguReguler     = _numParam(params.paguReguler,    'Pagu Reguler');
      var paguABT         = _numParam(params.paguABT,        'Pagu ABT');

      // Matriks 2x2 Realisasi: Reguler & ABT
      var sp2dReg = params.realisasiSP2D_Reguler !== undefined && params.realisasiSP2D_Reguler !== '' ? _num(params.realisasiSP2D_Reguler) : null;
      var sp2dAbt = params.realisasiSP2D_ABT !== undefined && params.realisasiSP2D_ABT !== '' ? _num(params.realisasiSP2D_ABT) : null;
      var akruReg = params.realisasiAkrual_Reguler !== undefined && params.realisasiAkrual_Reguler !== '' ? _num(params.realisasiAkrual_Reguler) : null;
      var akruAbt = params.realisasiAkrual_ABT !== undefined && params.realisasiAkrual_ABT !== '' ? _num(params.realisasiAkrual_ABT) : null;

      var realisasiSP2D, realisasiAkrual;
      if (sp2dReg !== null || sp2dAbt !== null) {
        sp2dReg = sp2dReg || 0;
        sp2dAbt = sp2dAbt || 0;
        realisasiSP2D = sp2dReg + sp2dAbt;
      } else {
        realisasiSP2D = _numParam(params.realisasiSP2D, 'Realisasi SP2D');
        sp2dReg = realisasiSP2D;
        sp2dAbt = 0;
      }

      if (akruReg !== null || akruAbt !== null) {
        akruReg = akruReg || 0;
        akruAbt = akruAbt || 0;
        realisasiAkrual = akruReg + akruAbt;
      } else {
        realisasiAkrual = _numParam(params.realisasiAkrual, 'Realisasi Akrual');
        akruReg = realisasiAkrual;
        akruAbt = 0;
      }

      var catatanRevisi   = (params.catatanRevisiPagu || '').trim();

      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!alasanRevisi) return { success: false, error: 'Alasan revisi wajib diisi.' };

      var sheet   = openTransaksiSheet(SHEET_TX.TATA_USAHA);
      var oldRow  = findRowByField(sheet, 'RowID', targetRowId);
      if (!oldRow || String(oldRow.obj['Status']) !== ROW_STATUS.ACTIVE) {
        return { success: false, error: 'Baris tidak ditemukan atau bukan status ACTIVE.' };
      }

      var now      = new Date();
      var newRowId = 'TU-' + Utilities.getUuid().replace(/-/g, '').substring(0, 14).toUpperCase();

      // Insert baris baru
      appendRowData(sheet, {
        'RowID':                          newRowId,
        'DivisiID':                       _TU_DIVISI_ID,
        'Periode':                        String(oldRow.obj['Periode']),
        'SubmittedBy':                    session.userId,
        'Timestamp':                      now,
        'Status':                         ROW_STATUS.ACTIVE,
        'SupersedesRowID':                targetRowId,
        'VoidReason':                     '',
        'VoidedBy':                       '',
        'VoidedAt':                       '',
        'PaguReguler':                    paguReguler,
        'PaguABT':                        paguABT,
        'RealisasiSP2D_Minggu':           realisasiSP2D,
        'RealisasiAkrual_Minggu':         realisasiAkrual,
        'RealisasiSP2D_Reguler_Minggu':   sp2dReg,
        'RealisasiSP2D_ABT_Minggu':       sp2dAbt,
        'RealisasiAkrual_Reguler_Minggu': akruReg,
        'RealisasiAkrual_ABT_Minggu':     akruAbt,
        'CatatanRevisiPagu':              catatanRevisi
      });

      // Tandai baris lama SUPERSEDED
      updateRowCells(sheet, oldRow.rowIndex, { 'Status': ROW_STATUS.SUPERSEDED });

      _tuAuditLog(session.userId, 'UPDATE', newRowId, 'Revisi dari ' + targetRowId + ': ' + alasanRevisi);

      return {
        success: true,
        data: { rowId: newRowId, message: 'Revisi berhasil disimpan.' }
      };
    });
  } catch (e) {
    Logger.log('[tataUsaha_revisi] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── ANULIR ────────────────────────────────────────────────

/**
 * Anulir laporan: tandai baris VOID + simpan komentar.
 *
 * Aturan (PRD §7, dikonfirmasi 15 Sep 2026):
 * - VoidReason WAJIB — tidak ada pengecualian.
 * - VoidReason VISIBLE ke seluruh anggota divisi di tabel riwayat.
 * - Setelah void, periode terbuka kembali untuk submit baru.
 * - Kewenangan: SUPERADMIN + DIREKTUR (cross-divisi) + KADIV (divisinya).
 *
 * @param {string} token
 * @param {{
 *   targetRowId: string,
 *   voidReason: string    // komentar wajib, tampil ke semua anggota divisi
 * }} params
 */
function tataUsaha_anulir(token, params) {
  try {
    return withLock(function () {
      var session     = _tuRequireSession(token);
      _tuAssertAnulir(session);

      var targetRowId = (params.targetRowId || '').trim();
      var voidReason  = (params.voidReason  || '').trim();

      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!voidReason) {
        return {
          success: false,
          error: 'Komentar anulir wajib diisi. Staf perlu mengetahui apa yang perlu diperbaiki sebelum dapat mengunggah laporan baru.'
        };
      }

      var sheet  = openTransaksiSheet(SHEET_TX.TATA_USAHA);
      var target = findRowByField(sheet, 'RowID', targetRowId);
      if (!target) {
        return { success: false, error: 'Baris tidak ditemukan.' };
      }
      if (String(target.obj['Status']) === ROW_STATUS.VOID) {
        return { success: false, error: 'Baris sudah dalam status VOID.' };
      }
      if (String(target.obj['Status']) === ROW_STATUS.SUPERSEDED) {
        return { success: false, error: 'Baris berstatus SUPERSEDED tidak dapat dianulir langsung — anulir baris ACTIVE-nya.' };
      }

      var now = new Date();
      updateRowCells(sheet, target.rowIndex, {
        'Status':    ROW_STATUS.VOID,
        'VoidReason': voidReason,
        'VoidedBy':   session.userId,
        'VoidedAt':   now
      });

      _tuAuditLog(session.userId, 'VOID', targetRowId, voidReason);

      // Notifikasi ke publisher (SubmittedBy) jika bukan self-void
      var publisherId = String(target.obj['SubmittedBy']);
      if (publisherId && publisherId !== session.userId) {
        _tuNotifyVoid(publisherId, targetRowId, String(target.obj['Periode']), voidReason, session.userId);
      }

      return {
        success: true,
        data: {
          message: 'Laporan berhasil dianulir. Komentar Anda akan terlihat oleh seluruh anggota divisi.',
          periode: String(target.obj['Periode'])
        }
      };
    });
  } catch (e) {
    Logger.log('[tataUsaha_anulir] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── RBAC HELPER ───────────────────────────────────────────

function _tuRequireSession(token) {
  var raw = CacheService.getScriptCache().get('sess_' + token);
  if (!raw) throw new Error('UNAUTHORIZED: Sesi tidak valid atau sudah berakhir.');
  try { return JSON.parse(raw); } catch (e) { throw new Error('UNAUTHORIZED: Sesi tidak dapat dibaca.'); }
}

/** Baca: semua APPROVED. KADIV/STAF dibatasi hanya bisa lihat DIV-TU (server-side; cross-divisi untuk Superadmin/Direktur). */
function _tuAssertRead(session) {
  if (!session || session.status !== 'APPROVED') {
    throw new Error('UNAUTHORIZED: Akun belum aktif.');
  }
  // SUPERADMIN dan DIREKTUR boleh baca cross-divisi — tidak perlu pembatasan.
  // Untuk KADIV/STAF dari divisi lain: service sudah hanya query DivisiID=DIV-TU,
  // jadi data yang dikembalikan tetap aman meski mereka bisa memanggil fungsi ini.
  // assertScope akan memblokir aksi write.
}

/** Write (submit/revisi): SUPERADMIN + KADIV(DIV-TU) + STAF(DIV-TU). */
function _tuAssertWrite(session) {
  assertScope(session, [ROLE.SUPERADMIN, ROLE.KADIV, ROLE.STAF], _TU_DIVISI_ID);
}

/**
 * Anulir: SUPERADMIN + DIREKTUR + KADIV(DIV-TU).
 * DIREKTUR diizinkan cross-divisi; Staf tidak bisa anulir.
 */
function _tuAssertAnulir(session) {
  if (!session || session.status !== 'APPROVED') {
    throw new Error('UNAUTHORIZED: Akun belum aktif.');
  }
  if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) return;
  if (session.role === ROLE.KADIV && session.divisiId === _TU_DIVISI_ID) return;
  throw new Error('UNAUTHORIZED: Anda tidak memiliki izin untuk menganulir laporan ini.');
}

// ── LOG & NOTIFIKASI ──────────────────────────────────────

function _tuAuditLog(userId, aksi, rowId, alasan) {
  try {
    appendRowData(openLogSheet(SHEET_LOG.AUDIT_LOG), {
      'LogID':       'LOG-' + Utilities.getUuid().replace(/-/g,'').substring(0,12).toUpperCase(),
      'UserID':      userId,
      'Aksi':        aksi,
      'SheetTarget': SHEET_TX.TATA_USAHA,
      'RowIDTarget': rowId,
      'Alasan':      alasan,
      'Timestamp':   new Date()
    });
  } catch (e) { Logger.log('[_tuAuditLog] ' + e.message); }
}

/** Notifikasi ke publisher bahwa laporannya dianulir + alasan. */
function _tuNotifyVoid(toUserId, rowId, periode, voidReason, voidedByUserId) {
  try {
    appendRowData(openLogSheet(SHEET_LOG.NOTIFICATIONS), {
      'NotifID':  'NTF-' + Utilities.getUuid().replace(/-/g,'').substring(0,12).toUpperCase(),
      'UserID':   toUserId,
      'Jenis':    'DATA_VOIDED',
      'Pesan':    'Laporan Tata Usaha periode ' + periode + ' (ID: ' + rowId + ') telah dianulir. ' +
                  'Alasan: ' + voidReason + ' — Segera buat laporan baru setelah perbaikan.',
      'IsRead':   false,
      'CreatedAt': new Date()
    });
  } catch (e) { Logger.log('[_tuNotifyVoid] ' + e.message); }
}

// ── NUMERIK HELPER ────────────────────────────────────────

function _num(v)  { return parseFloat(v) || 0; }
function _round(v, d) { var m = Math.pow(10, d); return Math.round(v * m) / m; }

function _numParam(val, label) {
  var n = parseFloat(val);
  if (isNaN(n) || n < 0) throw new Error(label + ' harus berupa angka non-negatif.');
  return n;
}

// ── TREN BULANAN (FASE 8 — chart konteks anggaran) ─────────
// Semua kalkulasi server-side (prinsip ARCHITECTURE.md). Baris dikelompokkan
// per bulan lewat prefix "YYYY-MM" dari kolom Periode. Siklus YTD mengikuti
// rentang filter (Jan s/d bulan/dateTo terpilih).

function tataUsaha_getTren(token, filter) {
  try {
    var session = _tuRequireSession(token);
    _tuAssertRead(session);

    var sheet = openTransaksiSheet(SHEET_TX.TATA_USAHA);
    var rows  = sheetToObjects(sheet);
    var months = utils_getTrendMonths(filter);

    var sp2dBulanan = [], akrualBulanan = [];
    for (var i = 0; i < months.length; i++) { sp2dBulanan.push(0); akrualBulanan.push(0); }
    var idx = {};
    months.forEach(function (m, mi) { idx[m] = mi; });

    for (var j = 0; j < rows.length; j++) {
      var r = rows[j];
      if (String(r['Status']) !== ROW_STATUS.ACTIVE) continue;
      var mm = String(r['Periode'] || '').substring(0, 7);
      if (idx[mm] === undefined) continue;
      var sp2dReg = _num(r['RealisasiSP2D_Reguler_Minggu']);
      var sp2dAbt = _num(r['RealisasiSP2D_ABT_Minggu']);
      var akruReg = _num(r['RealisasiAkrual_Reguler_Minggu']);
      var akruAbt = _num(r['RealisasiAkrual_ABT_Minggu']);
      var sp2dRow = (sp2dReg + sp2dAbt) || _num(r['RealisasiSP2D_Minggu']);
      var akruRow = (akruReg + akruAbt) || _num(r['RealisasiAkrual_Minggu']);

      sp2dBulanan[idx[mm]] += sp2dRow;
      akrualBulanan[idx[mm]] += akruRow;
    }

    var sp2dYtd = [], akrualYtd = [], cs = 0, ca = 0;
    for (var k = 0; k < months.length; k++) {
      cs += sp2dBulanan[k];
      ca += akrualBulanan[k];
      sp2dYtd.push(cs);
      akrualYtd.push(ca);
    }

    // Pagu terbaru dari laporan ACTIVE terakhir
    var lat = null;
    for (var l = 0; l < rows.length; l++) {
      if (String(rows[l]['Status']) !== ROW_STATUS.ACTIVE) continue;
      if (!lat || new Date(rows[l]['Timestamp']) > new Date(lat['Timestamp'])) lat = rows[l];
    }

    return { success: true, data: {
      months:        months,
      sp2dBulanan:   sp2dBulanan,
      akrualBulanan: akrualBulanan,
      sp2dYtd:       sp2dYtd,
      akrualYtd:     akrualYtd,
      paguReguler:   lat ? _num(lat['PaguReguler']) : 0,
      paguABT:       lat ? _num(lat['PaguABT']) : 0
    } };
  } catch (e) {
    Logger.log('[tataUsaha_getTren] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===========================================================================
// SUB-MODUL KEPEGAWAIAN TATA USAHA (5 KATEGORI)
// ===========================================================================

var _TU_KATEGORI_PEGAWAI = ['PNS', 'P3K', 'P3K_PARUH_WAKTU', 'PJLP', 'MAGANG'];

/**
 * Mengambil data ringkasan kepegawaian (headcount 5 kategori, persentase, dan riwayat).
 *
 * @param {string} token - session token
 * @param {Object} filter - opsional
 * @returns {{success:boolean, data:{
 *   totalPegawai: number,
 *   breakdown: Object,
 *   counts: Object,
 *   lastUpdated: string,
 *   latestKeterangan: string,
 *   history: Array
 * }}}
 */
function tataUsaha_getPegawai(token, filter) {
  try {
    var session = _tuRequireSession(token);
    _tuAssertRead(session);

    var sheet = openTuSheet(SHEET_TU.PEGAWAI);
    var rows  = sheetToObjects(sheet);

    // Ambil baris ACTIVE
    var activeRows = rows.filter(function (r) {
      return String(r['Status']) === ROW_STATUS.ACTIVE;
    });

    // Urutkan kronologis ascending untuk proses snapshot carry-forward
    activeRows.sort(function (a, b) {
      return new Date(a['Timestamp']) - new Date(b['Timestamp']);
    });

    // Cari nilai headcount terkini per kategori
    var latestCounts = {
      PNS: 0,
      P3K: 0,
      P3K_PARUH_WAKTU: 0,
      PJLP: 0,
      MAGANG: 0
    };

    var latestTimestamp = null;
    var latestKeterangan = '';

    for (var i = 0; i < activeRows.length; i++) {
      var r = activeRows[i];
      var kat = String(r['Kategori'] || '').toUpperCase();
      if (latestCounts.hasOwnProperty(kat)) {
        latestCounts[kat] = _num(r['Jumlah']);
        latestTimestamp = r['Timestamp'];
        if (r['Keterangan']) latestKeterangan = String(r['Keterangan']);
      }
    }

    var totalPegawai = 0;
    _TU_KATEGORI_PEGAWAI.forEach(function (k) {
      totalPegawai += latestCounts[k];
    });

    var breakdown = {};
    _TU_KATEGORI_PEGAWAI.forEach(function (k) {
      var count = latestCounts[k];
      var pct   = totalPegawai > 0 ? Math.round((count / totalPegawai) * 1000) / 10 : 0;
      breakdown[k] = {
        count: count,
        percentage: pct
      };
    });

    // Riwayat log perubahan (diurutkan desc)
    var history = rows.slice().sort(function (a, b) {
      return new Date(b['Timestamp']) - new Date(a['Timestamp']);
    }).map(function (r) {
      return {
        rowId:       String(r['RowID'] || ''),
        periode:     String(r['Periode'] || ''),
        timestamp:   r['Timestamp'] ? new Date(r['Timestamp']).toISOString() : null,
        kategori:    String(r['Kategori'] || ''),
        jumlah:      _num(r['Jumlah']),
        keterangan:  String(r['Keterangan'] || ''),
        status:      String(r['Status'] || ''),
        submittedBy: String(r['SubmittedBy'] || ''),
        voidReason:  String(r['VoidReason'] || '')
      };
    });

    return {
      success: true,
      data: {
        totalPegawai: totalPegawai,
        breakdown: breakdown,
        counts: latestCounts,
        lastUpdated: latestTimestamp ? new Date(latestTimestamp).toISOString() : null,
        latestKeterangan: latestKeterangan,
        history: history
      }
    };
  } catch (e) {
    Logger.log('[tataUsaha_getPegawai] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Submit pembaruan headcount kepegawaian TU.
 *
 * @param {string} token
 * @param {{
 *   counts: { PNS: number, P3K: number, P3K_PARUH_WAKTU: number, PJLP: number, MAGANG: number },
 *   keterangan: string,
 *   periode: string
 * }} params
 */
function tataUsaha_submitPegawai(token, params) {
  try {
    var session = _tuRequireSession(token);
    _tuAssertWrite(session);

    if (!params || !params.counts) {
      throw new Error('Data jumlah pegawai tidak valid.');
    }

    var periode = params.periode || getCurrentPeriode();
    var keterangan = (params.keterangan || '').trim();
    var counts = params.counts;

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      var sheet = openTuSheet(SHEET_TU.PEGAWAI);
      var now = new Date();
      var newRows = [];

      _TU_KATEGORI_PEGAWAI.forEach(function (kat) {
        var val = counts[kat] !== undefined && counts[kat] !== '' ? _num(counts[kat]) : null;
        if (val !== null && val >= 0) {
          var rowId = Utilities.getUuid();
          newRows.push([
            rowId,
            _TU_DIVISI_ID,
            periode,
            session.userId,
            now,
            ROW_STATUS.ACTIVE,
            '', // SupersedesRowID
            '', // VoidReason
            '', // VoidedBy
            '', // VoidedAt
            kat,
            val,
            keterangan
          ]);
        }
      });

      if (newRows.length === 0) {
        throw new Error('Minimal satu kategori pegawai harus diisi dengan angka non-negatif.');
      }

      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, newRows.length, newRows[0].length).setValues(newRows);

      logAudit(session.userId, 'SUBMIT_PEGAWAI', 'TU_Pegawai', newRows[0][0], {
        kategoriUpdated: _TU_KATEGORI_PEGAWAI.filter(function(k){ return counts[k] !== undefined; }),
        periode: periode,
        keterangan: keterangan
      });

      return { success: true, message: 'Data kepegawaian berhasil diperbarui.' };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    Logger.log('[tataUsaha_submitPegawai] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Anulir entri mutasi pegawai.
 */
function tataUsaha_anulirPegawai(token, params) {
  try {
    var session = _tuRequireSession(token);
    _tuAssertAnulir(session);

    if (!params || !params.rowId || !params.alasan) {
      throw new Error('RowID dan Alasan Anulir wajib diisi.');
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      var sheet = openTuSheet(SHEET_TU.PEGAWAI);
      var rows  = sheetToObjects(sheet);
      var targetIdx = -1;

      for (var i = 0; i < rows.length; i++) {
        if (rows[i]['RowID'] === params.rowId && String(rows[i]['Status']) === ROW_STATUS.ACTIVE) {
          targetIdx = i + 2; // +2 for header row & 1-based index
          break;
        }
      }

      if (targetIdx === -1) {
        throw new Error('Data tidak ditemukan atau sudah tidak aktif.');
      }

      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var colStatus = headers.indexOf('Status') + 1;
      var colReason = headers.indexOf('VoidReason') + 1;
      var colBy     = headers.indexOf('VoidedBy') + 1;
      var colAt     = headers.indexOf('VoidedAt') + 1;

      sheet.getRange(targetIdx, colStatus).setValue(ROW_STATUS.VOID);
      sheet.getRange(targetIdx, colReason).setValue(params.alasan);
      sheet.getRange(targetIdx, colBy).setValue(session.userId);
      sheet.getRange(targetIdx, colAt).setValue(new Date());

      logAudit(session.userId, 'ANULIR_PEGAWAI', 'TU_Pegawai', params.rowId, {
        alasan: params.alasan
      });

      return { success: true, message: 'Entri berhasil dianulir.' };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    Logger.log('[tataUsaha_anulirPegawai] ' + e.message);
    return { success: false, error: e.message };
  }
}
