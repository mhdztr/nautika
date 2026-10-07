/**
 * services/DashboardService.js — Executive Overview & Profil Kapal (Fase 12)
 *
 * Dua endpoint agregasi lintas-divisi, read-only untuk seluruh akun APPROVED
 * (PRD §5.1 — Ringkasan sebagai bacaan bersama; DETAIL gali data per modul
 * tetap ter-scope per divisi di service masing-masing).
 *
 *   dashboard_getOverview(token, filter)  → KPI headline (4) + kartu per divisi (9)
 *                                           + data charts (tren realisasi, tren hari
 *                                           operasi, donut kesiapan armada).
 *   dashboard_profilKapal(token, params)  → profil satu kapal dari 9 sumber data:
 *                                           info master + kesiapan + docking +
 *                                           operasi laut/udara + logistik + marabahaya.
 *
 * Perhitungan dilakukan LANGSUNG dari sheet transaksi (pola RiwayatService),
 * TIDAK memanggil kpi service per modul. Filter global (*) dihormati; untuk
 * semantik mingguan (Operasi Laut/Udara) dipakai pencocokan Periode utk
 * konsistensi dengan KPI modul terkait.
 */

/**
 * Versi data transaksi saat ini — dimasukkan ke cache key agregat ikhtisar
 * supaya hasil tidak kedaluwarsa (stale) setelah submit/revisi/anulir.
 * Penanda dinaikkan otomatis oleh `bumpTxVersion()` (data/SheetAccess.js)
 * di setiap `appendRowData`/`updateRowCells`. Cache key berubah → agregat
 * dihitung ulang (cache 300s lama dengan key lama otomatis tak terpakai).
 */
function _dashVersion() {
  try {
    return String(CacheService.getScriptCache().get('DASH_TX_VERSION') || '0');
  } catch (e) {
    return '0';
  }
}

/**
 * Agregat sebaran per Wilayah Management (WPP) untuk peta choropleth Ikhtisar.
 *
 * Sumber data (hanya yang punya kolom `WPPCode`):
 *   - TX_OperasiLaut  → KII_Ditangkap, KIA_Ditangkap, RumponDitertibkan
 *   - TX_OperasiUdara → KII, KIA, CakupanWilayah_NM2
 * `TX_Pemantauan` TIDAK punya kolom WPPCode (lihat DATA_SCHEMA.md), jadi jenis
 * Pemantauan tidak bisa dipetakan — tidak dihitung di sini.
 *
 * Nama wilayah memakai konstanta `WPP_NRI` (bukan sheet master `WPP`) supaya
 * label di panel ranking identik dengan properti `name` pada geometri
 * wpp_final.geojson yang dipakai layer peta.
 *
 * @param {Array} lautYtd  baris TX_OperasiLaut dalam rentang YTD
 * @param {Array} udaraYtd baris TX_OperasiUdara dalam rentang YTD
 * @return {{metrics: Array, rows: Object, tanpaWpp: number}}
 */
function _dashWppMap(lautYtd, udaraYtd) {
  var rows = {};
  var tanpaWpp = 0;

  function bucket(code) {
    var k = String(code == null ? '' : code).trim();
    if (!k) return null;
    if (!rows[k]) rows[k] = { kode: k, nama: '', kii: 0, kia: 0, rump: 0, cakupan: 0, laporan: 0 };
    return rows[k];
  }

  (lautYtd || []).forEach(function (r) {
    var b = bucket(r['WPPCode']);
    if (!b) { tanpaWpp++; return; }
    b.kii     += Number(r['KII_Ditangkap']) || 0;
    b.kia     += Number(r['KIA_Ditangkap']) || 0;
    b.rump    += Number(r['RumponDitertibkan']) || 0;
    b.laporan += 1;
  });

  (udaraYtd || []).forEach(function (r) {
    var b = bucket(r['WPPCode']);
    if (!b) { tanpaWpp++; return; }
    b.kii     += Number(r['KII']) || 0;
    b.kia     += Number(r['KIA']) || 0;
    b.cakupan += Number(r['CakupanWilayah_NM2']) || 0;
    b.laporan += 1;
  });

  var nama = {};
  try {
    WPP_NRI.forEach(function (w) { nama[String(w.WPPCode)] = String(w.NamaWilayah); });
  } catch (e) { /* konstanta tak terbaca -> pakai kode saja */ }

  Object.keys(rows).forEach(function (k) {
    var b = rows[k];
    b.nama = nama[k] || ('WPP ' + k);
    // Aktivitas = KII + KIA + rumpon (satu angka pembanding antar-WPP).
    b.aktivitas = b.kii + b.kia + b.rump;
  });

  return {
    metrics: [
      { key: 'aktivitas', label: 'Aktivitas', unit: 'unit' },
      { key: 'kii',        label: 'KII',      unit: 'unit' },
      { key: 'kia',        label: 'KIA',      unit: 'unit' },
      { key: 'rump',       label: 'Rumpon',   unit: 'unit' },
      { key: 'cakupan',    label: 'Cakupan',  unit: 'NM\u00B2' }
    ],
    rows: rows,
    tanpaWpp: tanpaWpp
  };
}

function dashboard_getOverview(token, filter) {
  var CACHE_TTL = 300; // detik
  try {
    var session = _dashAssertApproved(token);
    var f = filter || { mode: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() };
    var range = filterToDateRange(f);

    ensureKapalColumns(); // self-heal: kolom KapalID di 4 sheet (Fase 12)

    var cacheKey = 'DASH_OV_' + session.userId + '_' + _dashVersion() + '_' + _dashFilterKey(f);
    var cache = CacheService.getScriptCache();
    var cached = cache.get(cacheKey);
    if (cached) {
      var parsedCache = _dashTryParse(cached);
      if (parsedCache) return { success: true, data: parsedCache };
    }

    var year = _dashFilterYear(f, range.endDate);
    var ytdStart = new Date(year, 0, 1);
    var ytdRange = { startDate: ytdStart, endDate: range.endDate };

    // ── TU: pagu (latest ACTIVE) + realisasi (YTD) ──────────────
    var tuRows = _dashActiveRows(SHEET_TX.TATA_USAHA);
    var latestTu = _dashLatest(tuRows);
    var paguReguler = latestTu ? _num(latestTu['PaguReguler']) : 0;
    var paguABT     = latestTu ? _num(latestTu['PaguABT'])     : 0;
    var paguTotal   = paguReguler + paguABT;
    var realSP2D  = _dashSumIn(tuRows, ytdRange, 'RealisasiSP2D_Minggu');
    var realAkru  = _dashSumIn(tuRows, ytdRange, 'RealisasiAkrual_Minggu');
    var sp2dPct   = paguReguler > 0 ? _round(realSP2D / paguReguler * 100, 2) : 0;
    var akruPct   = paguABT     > 0 ? _round(realAkru / paguABT * 100, 2)     : 0;
    var sisaSP2D  = paguReguler - realSP2D;

    // ── OPERASI LAUT & UDARA ──────────────────────────────────────
    var lautRows  = _dashActiveRows(SHEET_TX.OPERASI_LAUT,  true);
    var udaraRows = _dashActiveRows(SHEET_TX.OPERASI_UDARA, true);

    var lautInRange = _dashRowsByPeriode(lautRows,  range);
    var udaraInRange = _dashRowsByPeriode(udaraRows, range);
    var lautYtd     = _dashRowsByPeriode(lautRows,  ytdRange);
    var udaraYtd    = _dashRowsByPeriode(udaraRows, ytdRange);

    var hariKapal   = _dashSumRows(lautInRange,  'HariOperasi_Jumlah');
    var hariPesawat = _dashSumRows(udaraInRange, 'HariOperasi_Jumlah');
    var kiiDitangkap   = _dashSumRows(lautYtd, 'KII_Ditangkap');
    var kiaDitangkap   = _dashSumRows(lautYtd, 'KIA_Ditangkap');
    var kapalDitangkap = kiiDitangkap + kiaDitangkap;
    var kiiDipantau    = _dashSumRows(udaraYtd, 'KII');
    var kiaDipantau    = _dashSumRows(udaraYtd, 'KIA');
    var kapalDipantau  = kiiDipantau + kiaDipantau;
    var cakupanWilayah = _dashSumRows(udaraYtd, 'CakupanWilayah_NM2');

    // ── INTELIJEN ────────────────────────────────────────────────
    var intRows  = _dashActiveRows(SHEET_TX.INTELIJEN);
    var intRange = _dashRowsIn(intRows, range);
    var notaDinas    = _dashJenisSum(intRange, 'NOTA_DINAS');
    var pelanggarTx  = _dashJenisSum(intRange, 'PELANGGARAN_TRANSMITTER');
    var kawasanAktif = _dashDistinctCount(intRange, 'KAWASAN_KONSERVASI', 'KawasanID');

    // ── PEMANTAUAN ───────────────────────────────────────────────
    var pemRows  = _dashActiveRows(SHEET_TX.PEMANTAUAN);
    var pemYtd   = _dashRowsIn(pemRows, ytdRange);
    var skatYtd   = _dashJenisSum(pemYtd, 'SKAT');
    var userYtd   = _dashJenisSum(pemYtd, 'USERNAME');
    var maraYtd   = _dashJenisCount(pemYtd, 'MARABAHAYA');

    // ── PERAWATAN ────────────────────────────────────────────────
    var rawatKesi  = _dashLatestPerKapal(_dashRowsIn(_dashActiveRows(SHEET_TX.PERAWATAN_KESIAPAN), range));
    var siap=0, tidakSiap=0;
    Object.keys(rawatKesi).forEach(function (id) {
      if (_dashBool(rawatKesi[id]['StatusSiap'])) siap++; else tidakSiap++;
    });
    var rawatDock  = _dashActiveRows(SHEET_TX.PERAWATAN_DOCKING);
    var dockInRange = _dashRowsIn(rawatDock, range);
    var dockingAktif = _dashSumRowsFilter(dockInRange, 'Tahap', 'SELESAI', true);

    // Total armada aktif (master Kapal)
    var totalArmada = _dashTotalArmadaAktif();
    var kesiapanPct = totalArmada > 0 ? Math.round(siap / totalArmada * 100)
      : (siap + tidakSiap > 0 ? Math.round(siap / (siap + tidakSiap) * 100) : 0);

    // ── LOGISTIK ─────────────────────────────────────────────────
    var amRows  = _dashActiveRows(SHEET_TX.LOGISTIK_AMUNISI);
    var bbmRows = _dashActiveRows(SHEET_TX.LOGISTIK_BBM);
    var amYtd   = _dashRowsIn(amRows,  ytdRange);
    var bbmYtd  = _dashRowsIn(bbmRows, ytdRange);
    var bbmRange = _dashRowsIn(bbmRows, range);

    var realBBM  = _dashSumRows(bbmYtd, 'Realisasi_Minggu');
    var paguBBM  = _dashLatestBaselineSum(bbmRows, 'Pagu');
    var bbmPct   = paguBBM > 0 ? _round(realBBM / paguBBM * 100, 2) : 0;
    var tunggak  = _dashCountNonEmpty(bbmRange, 'Tunggakan_Status');

    var amBasePerJenis = {};
    amRows.forEach(function (r) {
      if (_logIsBaselineRow({ jenis: 'AMUNISI' }, r)) {
        var j = String(r['JenisAmunisi'] || '');
        var cur = amBasePerJenis[j];
        if (!cur || new Date(r['Timestamp']) > new Date(cur['Timestamp'])) amBasePerJenis[j] = r;
      }
    });
    var stokTotal = 0;
    var amStok = [];
    Object.keys(amBasePerJenis).forEach(function (j) {
      var base = amBasePerJenis[j];
      var stok = Math.max(0, _num(base['StokAwal']) - _dashJenisUsage(amYtd, j));
      stokTotal += stok;
      if (stok > 0) amStok.push({ label: j, val: stok });
    });
    amStok.sort(function (a, b) { return b.val - a.val; });
    var amStok5 = amStok.slice(0, 5);

    // ── PENGAWAKAN ───────────────────────────────────────────────
    var awakRows = _dashActiveRows(SHEET_TX.PENGAWAKAN_AKN);
    // Satu total per scope; token & label dari sheet `Opsi`.
    var aknTotalPerScope = {};
    var aknLabelPerScope = {};
    var aknScopeMap = getOpsiLabelMap(OPSI_KODE.AWAK_SCOPE);
    getOpsiList(OPSI_KODE.AWAK_SCOPE).forEach(function (sc) {
      aknTotalPerScope[sc] = _dashLatestScopeSum(awakRows, sc, range);
      aknLabelPerScope[sc] = aknScopeMap[sc] || sc;
    });
    // Segmen flat untuk stacked bar komposisi AKN (urutan mengikuti sheet Opsi).
    var aknScopeOrder = getOpsiList(OPSI_KODE.AWAK_SCOPE);
    var aknStack = [];
    aknScopeOrder.forEach(function (sc, i) {
      aknStack.push({
        label: aknScopeMap[sc] || sc,
        val: aknTotalPerScope[sc],
        tone: (['deep', 'soft', 'light', 'lighter'])[i] || 'lighter'
      });
    });
    var awakKeg = _dashActiveRows(SHEET_TX.PENGAWAKAN_KEGIATAN);
    var awakKegYtd = _dashRowsIn(awakKeg, ytdRange);

    // ── KEGIATAN DIREKTORAT ───────────────────────────────────────
    var kegRows     = _dashActiveRows(SHEET_TX.KEGIATAN_DIREKTORAT);
    var kegYtd      = _dashRowsIn(kegRows, ytdRange);
    var kegRange    = _dashRowsIn(kegRows, range);
    var kegLast     = _dashLatest(kegRange);

    // ── Chart data ───────────────────────────────────────────────
    var months   = utils_getTrendMonths(f);
    var realis   = _dashMonthly(tuRows, f, 'RealisasiSP2D_Minggu');
    var akru     = _dashMonthly(tuRows, f, 'RealisasiAkrual_Minggu');
    var hbKapal  = _dashMonthlyByPeriode(lautRows, f, 'HariOperasi_Jumlah');
    var hbPesawat= _dashMonthlyByPeriode(udaraRows, f, 'HariOperasi_Jumlah');
    var hbTot    = months.map(function (m, i) { return (hbKapal[i] || 0) + (hbPesawat[i] || 0); });

    // Indikator tren KPI "Hari Operasi Kapal & Pesawat" — delta vs bulan
    // sebelumnya, hanya untuk mode bulanan (mode rentang tidak punya titik
    // pembanding yang sepadan).
    var trendHariOp = null;
    if (f.mode !== 'range' && months.length >= 2) {
      var curHOp  = hbTot[months.length - 1] || 0;
      var prevHOp = hbTot[months.length - 2] || 0;
      trendHariOp = { delta: curHOp - prevHOp, prev: months[months.length - 2] };
    }

    // Daftar 7 divisi yang sudah melapor minggu berjalan (dots di KPI).
    var melaporDetail = _dashMelaporDetail();
    var nMelapor = melaporDetail.filter(function (d) { return d.melapor; }).length;

    // Top 5 kapal pengawas teraktif (kapal + satuan udara digabung per KapalID).
    // Baris tanpa KapalID tidak bisa diatribusikan ke kapal mana pun, tapi hari
    // operasinya tetap masuk KPI. Jumlahnya dikembalikan terpisah supaya UI
    // bisa menjelaskan chart kosong alih-alih menampilkan "0" misterius.
    var kapalHari = {};
    var hariTanpaKapal = 0;
    lautInRange.concat(udaraInRange).forEach(function (r) {
      var hari = _num(r['HariOperasi_Jumlah']);
      var id = String(r['KapalID'] || '').trim();
      if (!id) { hariTanpaKapal += hari; return; }
      kapalHari[id] = (kapalHari[id] || 0) + hari;
    });
    var kapalTeraktif = Object.keys(kapalHari).map(function (id) {
      var info = _dashKapalInfo(id);
      return { label: info ? info.nama : id, val: kapalHari[id] };
    }).filter(function (k) { return k.val > 0; })
      .sort(function (a, b) { return b.val - a.val; })
      .slice(0, 5);

    var headline = [
      { label: 'Realisasi Anggaran (SP2D)',    value: sp2dPct,  unit: '%',   sub: 'YTD kumulatif', spark: realis },
      { label: 'Hari Operasi Kapal & Pesawat', value: hariKapal + hariPesawat, unit: 'hari', sub: 'Realisasi periode ini', trend: trendHariOp, minibars: hbTot },
      { label: 'Armada Siap Operasi',          value: siap, unit: 'kapal', sub: (siap + tidakSiap) + ' / ' + totalArmada + ' armada aktif',
        donut: { segs: [ { label: 'Siap', val: siap, tone: 'ok' }, { label: 'Tidak Siap', val: tidakSiap, tone: 'crit' } ], center: totalArmada } },
      { label: 'Divisi Melapor Minggu Ini',    value: nMelapor, unit: '/ 7',
        sub: 'Berdasarkan laporan masuk', dots: melaporDetail }
    ];

    var divisi = [
      {
        title: 'Tata Usaha',
        metrics: [
          { lbl: 'Realisasi SP2D (YTD)',    val: sp2dPct,  unit: '%',   prog: true  },
          { lbl: 'Realisasi Akrual (YTD)',  val: akruPct,  unit: '%',   prog: true  },
          { lbl: 'Sisa Pagu SP2D',          val: sisaSP2D, unit: 'Rp',  prog: false,
            badge: Math.max(0, 100 - sp2dPct) + '% Sisa', tone: 'info' }
        ],
        stack: {
          caption: 'Alokasi Pagu Anggaran (SP2D vs Sisa)',
          segments: [
            { label: 'Realisasi', val: sp2dPct, tone: 'deep' },
            { label: 'Sisa Pagu', val: Math.max(0, 100 - sp2dPct), tone: 'light' }
          ]
        }
      },
      {
        title: 'Operasi Kapal Pengawas dan Pesawat',
        metrics: [
          { lbl: 'Hari Operasi Armada',            val: hariKapal + hariPesawat, unit: 'hari', prog: false,
            badge: hariKapal + ' Kapal · ' + hariPesawat + ' Udara', tone: 'info' },
          { lbl: 'Kapal Ditangkap & Dipantau',     val: kapalDitangkap + kapalDipantau, unit: 'unit', prog: false,
            stack: [ { label: 'Ditangkap', val: kapalDitangkap, tone: 'deep' }, { label: 'Dipantau', val: kapalDipantau, tone: 'soft' } ] },
          { lbl: 'Cakupan Wilayah Patroli',        val: cakupanWilayah,  unit: 'NM\u00B2', prog: false }
        ],
        stack: {
          caption: 'Komposisi Penindakan (KII vs KIA)',
          segments: [
            { label: 'KII', val: kiiDitangkap + kiiDipantau, tone: 'deep' },
            { label: 'KIA', val: kiaDitangkap + kiaDipantau, tone: 'soft' }
          ]
        }
      },
      {
        title: 'Intelijen',
        metrics: [
          { lbl: 'Nota Dinas Data Intelijen',   val: notaDinas,   unit: 'dokumen', prog: false },
          { lbl: 'Pelanggaran Transmitter',     val: pelanggarTx, unit: 'kapal',   prog: false,
            badge: pelanggarTx === 0 ? 'Nihil / Aman' : 'Terdeteksi', tone: pelanggarTx === 0 ? 'ok' : 'warn' },
          { lbl: 'Kawasan Konservasi Terpantau', val: kawasanAktif, unit: 'lokasi',  prog: false }
        ],
        stack: {
          caption: 'Aktivitas Intelijen & Pengawasan',
          segments: [
            { label: 'Nota Dinas', val: notaDinas, tone: 'deep' },
            { label: 'Pelanggaran Tx', val: pelanggarTx, tone: pelanggarTx > 0 ? 'warn' : 'soft' },
            { label: 'Kawasan Aktif', val: kawasanAktif, tone: 'light' }
          ]
        }
      },
      {
        title: 'Pemantauan',
        metrics: [
          { lbl: 'SKAT Diterbitkan (YTD)',    val: skatYtd, unit: 'dokumen', prog: false },
          { lbl: 'Username Diterbitkan (YTD)',val: userYtd, unit: 'akun',    prog: false },
          { lbl: 'Kapal Kondisi Marabahaya',  val: maraYtd, unit: 'unit',    prog: false,
            badge: maraYtd === 0 ? 'Nihil / Aman' : 'Perlu Tindakan', tone: maraYtd === 0 ? 'ok' : 'crit' }
        ],
        stack: {
          caption: 'Layanan Pemantauan & Akses',
          segments: [
            { label: 'SKAT', val: skatYtd, tone: 'deep' },
            { label: 'Username', val: userYtd, tone: 'soft' }
          ]
        }
      },
      {
        title: 'Perawatan',
        metrics: [
          { lbl: 'Tingkat Kesiapan Armada', val: kesiapanPct, unit: '%', prog: true,
            badge: kesiapanPct >= 75 ? 'Optimal' : (kesiapanPct >= 50 ? 'Cukup' : 'Perlu Perhatian'), tone: kesiapanPct >= 75 ? 'ok' : 'warn' },
          { lbl: 'Armada Siap Operasi',     val: siap, unit: 'kapal', prog: false,
            badge: 'Siap', tone: 'ok' },
          { lbl: 'Tidak Siap & Docking',   val: tidakSiap + dockingAktif, unit: 'kapal', prog: false,
            badge: (tidakSiap + dockingAktif) === 0 ? 'Nihil' : (tidakSiap + ' TS · ' + dockingAktif + ' Dock'), tone: (tidakSiap + dockingAktif) === 0 ? 'ok' : 'crit' }
        ],
        stack: {
          caption: 'Rasio Kesiapan Armada (Siap vs Tidak Siap)',
          segments: [
            { label: 'Siap', val: siap, tone: 'ok' },
            { label: 'Tidak Siap', val: tidakSiap, tone: 'crit' }
          ]
        }
      },
      {
        title: 'Logistik',
        metrics: [
          { lbl: 'Realisasi BBM (YTD)',    val: bbmPct,    unit: '%',     prog: true  },
          { lbl: 'Tunggakan Tagihan BBM',  val: tunggak,   unit: 'item',  prog: false,
            badge: tunggak === 0 ? 'Lancar / Nihil' : 'Ada Tunggakan', tone: tunggak === 0 ? 'ok' : 'warn' },
          { lbl: 'Total Stok Amunisi',     val: stokTotal, unit: 'butir', prog: false }
        ],
        stack: amStok5 && amStok5.length ? {
          caption: 'Distribusi Stok Amunisi',
          segments: amStok5.map(function (s, idx) {
            return { label: s.label, val: s.val, tone: (['deep', 'soft', 'light', 'lighter'])[idx] || 'lighter' };
          })
        } : null
      },
      {
        title: 'Pengawakan',
        metrics: [
          { lbl: 'Total Personel AKN',      val: aknTotalPerScope['KESELURUHAN'] || (aknTotalPerScope['POA'] || 0), unit: 'orang', prog: false },
          { lbl: 'Awak Kapal (POA)',        val: aknTotalPerScope['POA'] || 0, unit: 'orang', prog: false,
            badge: (aknTotalPerScope['POA'] && aknTotalPerScope['KESELURUHAN'] ? Math.round(aknTotalPerScope['POA'] / aknTotalPerScope['KESELURUHAN'] * 100) + '% POA' : ''), tone: 'info' },
          { lbl: 'Kegiatan Personel (YTD)', val: awakKegYtd.length, unit: 'kegiatan', prog: false }
        ],
        stack: { caption: 'Komposisi Penempatan AKN', segments: aknStack }
      },
      {
        title: 'Kegiatan Pendukung',
        metrics: [
          { lbl: 'Kegiatan Terlaksana (YTD)', val: kegYtd.length, unit: 'kegiatan', prog: false },
          { lbl: 'Kegiatan Periode Ini',      val: kegRange.length, unit: 'kegiatan', prog: false },
          { lbl: 'Pencatatan Terakhir',       val: kegLast ? _dashFmtDate(kegLast['Timestamp']) : '\u2014', unit: '', prog: false }
        ],
        stack: {
          caption: 'Intensitas Kegiatan Direktorat',
          segments: [
            { label: 'YTD', val: kegYtd.length, tone: 'deep' },
            { label: 'Periode Ini', val: kegRange.length, tone: 'soft' }
          ]
        }
      },
      {
        title: 'Cakupan Laporan',
        metrics: [
          { lbl: 'Divisi Melapor Minggu Ini', val: nMelapor,            unit: '/ 7', prog: true, raw: Math.round(nMelapor / 7 * 100) },
          { lbl: 'Divisi Belum Melapor',      val: 7 - nMelapor,        unit: 'divisi', prog: false,
            badge: nMelapor === 7 ? 'Lengkap 100%' : (7 - nMelapor) + ' Belum Lapor', tone: nMelapor === 7 ? 'ok' : 'warn' },
          { lbl: 'Periode Laporan Aktif',     val: getCurrentPeriode(), unit: '',     prog: false }
        ],
        dots: melaporDetail
      }
    ];

    // ── Visual per kartu divisi + lebar grid (Fase 14, "dinamis, tidak kaku") ──
    // Tiap kartu mendapat bentuk visual yang menjawab pertanyaan datanya sendiri
    // (bukan progress bar semua). Palet hanya token tema via `tone`.
    var aknSegs = aknScopeOrder.filter(function (sc) { return sc !== 'KESELURUHAN'; })
      .map(function (sc, i) {
        return { label: aknScopeMap[sc] || sc, val: aknTotalPerScope[sc] || 0,
                 tone: (['deep', 'soft', 'light', 'lighter'])[i] || 'lighter' };
      });
    var vizByTitle = {
      'Tata Usaha': { type: 'cols', fmt: 'rp', caption: 'Realisasi per bulan (YTD)',
        series: [ { name: 'SP2D', tone: 'deep' }, { name: 'Akrual', tone: 'light' } ],
        groups: months.map(function (m, i) { return { label: m, vals: [realis[i] || 0, akru[i] || 0] }; }) },
      'Cakupan Laporan': { type: 'chips', caption: 'Status 7 divisi minggu ini', items: melaporDetail },
      'Operasi Kapal Pengawas dan Pesawat': { type: 'cols', caption: 'KII vs KIA (YTD)',
        series: [ { name: 'Ditangkap', tone: 'deep' }, { name: 'Dipantau', tone: 'light' } ],
        groups: [ { label: 'KII', vals: [kiiDitangkap, kiiDipantau] }, { label: 'KIA', vals: [kiaDitangkap, kiaDipantau] } ] },
      'Perawatan': { type: 'donut', caption: 'Kondisi armada', sub: 'KAPAL',
        segs: [ { label: 'Siap', val: siap, tone: 'ok' }, { label: 'Tidak Siap', val: tidakSiap, tone: 'crit' },
                { label: 'Docking', val: dockingAktif, tone: 'warn' } ] },
      'Intelijen': { type: 'hbars', caption: 'Aktivitas intelijen periode ini',
        items: [ { label: 'Nota Dinas', val: notaDinas, tone: 'deep' },
                 { label: 'Pelanggaran Tx', val: pelanggarTx, tone: pelanggarTx > 0 ? 'warn' : 'soft' },
                 { label: 'Kawasan Terpantau', val: kawasanAktif, tone: 'light' } ] },
      'Pemantauan': { type: 'line', caption: 'Penerbitan per bulan', labels: months,
        series: [ { name: 'SKAT', tone: 'deep', data: _dashMonthlyJenis(pemRows, f, 'SKAT') },
                  { name: 'Username', tone: 'light', data: _dashMonthlyJenis(pemRows, f, 'USERNAME') } ] },
      'Logistik': amStok5.length ? { type: 'cols', fmt: 'num', caption: 'Stok amunisi per jenis (butir)',
        series: [ { name: 'Stok', tone: 'deep' } ],
        groups: amStok5.map(function (s) { return { label: s.label, vals: [s.val] }; }) } : null,
      'Pengawakan': { type: 'waffle', caption: 'Komposisi personel AKN', segs: aknSegs },
      'Kegiatan Pendukung': { type: 'heat', caption: 'Kegiatan per bulan', labels: months,
        vals: _dashMonthlyCount(kegRows, f) }
    };
    // Urutan + lebar (grid 6 kolom) disusun supaya tiap baris penuh: 4+2, 2+2+2, 2+4, 3+3.
    var layoutByTitle = {
      'Tata Usaha': { order: 0, span: 4 }, 'Cakupan Laporan': { order: 1, span: 2 },
      'Operasi Kapal Pengawas dan Pesawat': { order: 2, span: 2 }, 'Perawatan': { order: 3, span: 2 },
      'Intelijen': { order: 4, span: 2 }, 'Pemantauan': { order: 5, span: 2 },
      'Logistik': { order: 6, span: 4 }, 'Pengawakan': { order: 7, span: 3 },
      'Kegiatan Pendukung': { order: 8, span: 3 }
    };
    divisi.forEach(function (dv) {
      var lay = layoutByTitle[dv.title] || { order: 99, span: 2 };
      dv.span = lay.span;
      dv.order = lay.order;
      dv.viz = vizByTitle[dv.title] || null;
    });
    divisi.sort(function (a, b) { return a.order - b.order; });

    var data = {
      periode: getCurrentPeriode(),
      headline: headline,
      divisi: divisi,
      paguTotal: paguTotal,
      wppMap: _dashWppMap(lautYtd, udaraYtd),
      charts: {
        trendMonths: months,
        realisasi: { sp2d: realis, akrual: akru },
        hariOperasi: { kapal: hbKapal, pesawat: hbPesawat },
        kesiapan: { siap: siap, tidakSiap: tidakSiap, totalArmada: totalArmada },
        penindakan: [
          { label: 'Ditangkap \u2013 KII',  val: kiiDitangkap, tone: 'deep' },
          { label: 'Ditangkap \u2013 KIA',  val: kiaDitangkap, tone: 'soft' },
          { label: 'Dipantau \u2013 KII',   val: kiiDipantau,  tone: 'light' },
          { label: 'Dipantau \u2013 KIA',   val: kiaDipantau,  tone: 'lighter' }
        ],
        kapalTeraktif: kapalTeraktif,
        hariTanpaKapal: hariTanpaKapal
      }
    };

    cache.put(cacheKey, JSON.stringify(data), CACHE_TTL);
    return { success: true, data: data };
  } catch (e) {
    Logger.log('[dashboard_getOverview] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===========================================================================
// PROFIL KAPAL
// ===========================================================================

/**
 * Profil satu kapal — gabungan 9 sumber data (Fase 12).
 * @param {string} token
 * @param {{kapalId:string}} params
 */
function dashboard_profilKapal(token, params) {
  var CACHE_TTL = 300;
  try {
    var session = _dashAssertApproved(token);
    var p = params || {};
    var kapalId = String(p.kapalId || '').trim();
    if (!kapalId) return { success: false, error: 'kapalId wajib diisi.' };

    ensureKapalColumns();

    var cacheKey = 'DASH_PK_' + session.userId + '_' + kapalId + '_' + _dashVersion();
    var cache = CacheService.getScriptCache();
    var cached = cache.get(cacheKey);
    if (cached) {
      var parsedCache = _dashTryParse(cached);
      if (parsedCache) return { success: true, data: parsedCache };
    }

    var kapalInfo = _dashKapalInfo(kapalId);
    if (!kapalInfo) {
      return { success: false, error: 'Kapal dengan ID ' + kapalId + ' tidak ditemukan di master.' };
    }

    var inKapal = function (r) { return String(r['KapalID'] || '').trim() === kapalId; };

    var kesiapan = _dashActiveRows(SHEET_TX.PERAWATAN_KESIAPAN).filter(inKapal);
    var docking  = _dashActiveRows(SHEET_TX.PERAWATAN_DOCKING).filter(inKapal);
    var laut     = _dashActiveRows(SHEET_TX.OPERASI_LAUT,  true).filter(inKapal);
    var udara    = _dashActiveRows(SHEET_TX.OPERASI_UDARA, true).filter(inKapal);
    var amunisi  = _dashActiveRows(SHEET_TX.LOGISTIK_AMUNISI).filter(inKapal);
    var bbm      = _dashActiveRows(SHEET_TX.LOGISTIK_BBM).filter(inKapal);
    var mara     = _dashActiveRows(SHEET_TX.PEMANTAUAN).filter(function (r) {
      return inKapal(r) && String(r['Jenis'] || '') === 'MARABAHAYA';
    });

    var latestKesi  = _dashLatest(kesiapan);
    var latestDock  = _dashLatest(docking);
    var totalHariLaut  = _dashSumRows(laut,  'HariOperasi_Jumlah');
    var totalHariUdara = _dashSumRows(udara, 'HariOperasi_Jumlah');
    var totalDatang    = _dashSumRows(laut,  'KII_Ditangkap') + _dashSumRows(laut, 'KIA_Ditangkap');
    var totalPantau    = _dashSumRows(udara, 'KII') + _dashSumRows(udara, 'KIA');

    // Stok amunisi terkini per jenis (baseline − penggunaan kumulatif)
    var amBase = {};
    amunisi.forEach(function (r) {
      if (_logIsBaselineRow({ jenis: 'AMUNISI' }, r)) {
        var j = String(r['JenisAmunisi'] || '');
        var cur = amBase[j];
        if (!cur || new Date(r['Timestamp']) > new Date(cur['Timestamp'])) amBase[j] = r;
      }
    });
    var stokAkhir = {};
    Object.keys(amBase).forEach(function (j) {
      var base = amBase[j];
      var usage = 0;
      amunisi.forEach(function (r) {
        if (!_logIsBaselineRow({ jenis: 'AMUNISI' }, r) && String(r['JenisAmunisi'] || '') === j) usage += _num(r['Penggunaan_Minggu']);
      });
      stokAkhir[j] = Math.max(0, _num(base['StokAwal']) - usage);
    });

    var bbmPagu = {}, bbmRealisasi = {};
    bbm.forEach(function (r) {
      var j = String(r['Jenis'] || '');
      if (_logIsBaselineRow({ jenis: 'BBM' }, r)) bbmPagu[j] = _num(r['Pagu']);
      else bbmRealisasi[j] = (bbmRealisasi[j] || 0) + _num(r['Realisasi_Minggu']);
    });

    var data = {
      kapal: kapalInfo,
      summary: {
        statusKesiapan: latestKesi ? _dashBool(latestKesi['StatusSiap']) : null,
        statusKesiapanPeriode: latestKesi ? String(latestKesi['Periode'] || '') : '',
        penyebabTidakSiap: latestKesi ? String(latestKesi['Penyebab'] || '') : '',
        dockingAktif: latestDock && String(latestDock['Tahap'] || '') !== 'SELESAI',
        tahapDocking: latestDock ? String(latestDock['Tahap'] || '') : '',
        lokasiDocking: latestDock ? String(latestDock['Lokasi'] || '') : '',
        totalHariOperasiLaut: totalHariLaut,
        totalHariOperasiUdara: totalHariUdara,
        totalKapalDitangkap: totalDatang,
        totalKapalDipantau: totalPantau,
        totalMarabahaya: mara.length,
        stokAmunisiAkhir: stokAkhir,
        paguBBM: bbmPagu,
        realisasiBBM: bbmRealisasi
      },
      riwayat: {
        kesiapan: kesiapan.sort(_dashDesc),
        docking:  docking.sort(_dashDesc),
        operasiLaut:  laut.sort(_dashDesc).map(_dashOpsLaut),
        operasiUdara: udara.sort(_dashDesc).map(_dashOpsUdara),
        amunisi:  amunisi.sort(_dashDesc).map(_dashAmunisi),
        bbm:      bbm.sort(_dashDesc).map(_dashBbm),
        marabahaya: mara.sort(_dashDesc).map(_dashMara)
      }
    };

    cache.put(cacheKey, JSON.stringify(data), CACHE_TTL);
    return { success: true, data: data };
  } catch (e) {
    Logger.log('[dashboard_profilKapal] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ===========================================================================
// RBAC & PEMETAAN DATA
// ===========================================================================

function _dashAssertApproved(token) {
  var session = _requireSession(token);
  if (session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Akun belum aktif.');
  }
  return session;
}

function _dashFilterKey(f) {
  var key;
  if (f.mode === 'range') {
    key = 'range_' + (f.dateFrom || '') + '_' + (f.dateTo || '');
  } else {
    key = 'monthly_' + (f.year || '') + '_' + (f.month || '');
  }
  return key;
}

function _dashFilterYear(f, endDate) {
  var y = f.mode === 'range' && f.dateTo ? new Date(f.dateTo).getFullYear() : (f.year || new Date().getFullYear());
  if (!y && endDate) y = endDate.getFullYear();
  return y || new Date().getFullYear();
}

function _dashTryParse(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

function _dashActiveRows(sheetName, byPeriode) {
  var rows = sheetToObjects(openTransaksiSheet(sheetName));
  return rows.filter(function (r) { return String(r['Status']) === ROW_STATUS.ACTIVE; });
}

/** Seleksi baris dengan timestamp dalam range (fallback utk sheet mingguan). */
function _dashRowsIn(rows, range) {
  return rows.filter(function (r) {
    return isInRange(new Date(r['Timestamp']), range);
  });
}

/** Seleksi baris Operasi Laut/Udara: overlap antara Periode baris & range. */
function _dashRowsByPeriode(rows, range) {
  return rows.filter(function (r) {
    var pr = periodeToDateRange(String(r['Periode'] || ''));
    if (!pr) return isInRange(new Date(r['Timestamp']), range);
    return pr.endDate >= range.startDate && pr.startDate <= range.endDate;
  });
}

function _dashLatest(rows) {
  var best = null;
  rows.forEach(function (r) {
    if (!best || new Date(r['Timestamp']) > new Date(best['Timestamp'])) best = r;
  });
  return best;
}

function _dashSumIn(rows, range, col) {
  var total = 0;
  rows.forEach(function (r) {
    if (isInRange(new Date(r['Timestamp']), range)) total += _num(r[col]);
  });
  return total;
}

function _dashSumRows(rows, col) {
  var total = 0;
  rows.forEach(function (r) { total += _num(r[col]); });
  return total;
}

function _dashSumRowsFilter(rows, filterCol, filterVal, excludeEqual) {
  var total = 0;
  rows.forEach(function (r) {
    var eq = String(r[filterCol] || '') === String(filterVal || '');
    if (excludeEqual ? !eq : eq) total++;
  });
  return total;
}

function _dashJenisSum(rows, jenis) {
  return rows.reduce(function (acc, r) {
    return acc + (String(r['Jenis'] || '') === jenis ? _num(r['Jumlah']) : 0);
  }, 0);
}

function _dashJenisCount(rows, jenis) {
  return rows.reduce(function (acc, r) {
    return acc + (String(r['Jenis'] || '') === jenis ? 1 : 0);
  }, 0);
}

function _dashDistinctCount(rows, jenis, col) {
  var seen = {};
  rows.forEach(function (r) {
    if (String(r['Jenis'] || '') === jenis) seen[String(r[col] || '')] = true;
  });
  return Object.keys(seen).length;
}

function _dashCountNonEmpty(rows, col) {
  return rows.reduce(function (acc, r) {
    return acc + (String(r[col] || '').trim() !== '' ? 1 : 0);
  }, 0);
}

/** Latest baseline per jenis → sum kolom (Pagu untuk BBM). */
function _dashLatestBaselineSum(rows, col) {
  var latest = {};
  rows.forEach(function (r) {
    if (_logIsBaselineRow({ jenis: 'BBM' }, r)) {
      var j = String(r['Jenis'] || '');
      var cur = latest[j];
      if (!cur || new Date(r['Timestamp']) > new Date(cur['Timestamp'])) latest[j] = r;
    }
  });
  return Object.keys(latest).reduce(function (acc, j) { return acc + _num(latest[j][col]); }, 0);
}

function _dashJenisUsage(rows, jenis) {
  return rows.reduce(function (acc, r) {
    return acc + (String(r['JenisAmunisi'] || '') === jenis && !_logIsBaselineRow({ jenis: 'AMUNISI' }, r) ? _num(r['Penggunaan_Minggu']) : 0);
  }, 0);
}

/** Latest (per kapal) dalam range. */
function _dashLatestPerKapal(rows) {
  var latest = {};
  rows.forEach(function (r) {
    var id = String(r['KapalID'] || '');
    if (!id) return;
    var prev = latest[id];
    if (!prev || new Date(r['Timestamp']) > new Date(prev['Timestamp'])) latest[id] = r;
  });
  return latest;
}

function _dashBool(v) {
  return v === true || v === 'true' || v === 1 || v === '1' || v === 'TRUE';
}

function _dashLatestScopeSum(rows, scope, range) {
  var inRange = _dashRowsIn(rows, range).filter(function (r) {
    return String(r['Scope'] || '') === scope;
  });
  if (!inRange.length) return 0;
  var latestTs = inRange.reduce(function (acc, r) {
    var t = new Date(r['Timestamp']).getTime();
    return t > acc ? t : acc;
  }, 0);
  return inRange.reduce(function (acc, r) {
    return acc + (new Date(r['Timestamp']).getTime() === latestTs ? _num(r['Jumlah']) : 0);
  }, 0);
}

function _dashTotalArmadaAktif() {
  try {
    var rows = sheetToObjects(openMasterSheet(SHEET_MASTER.KAPAL));
    return rows.reduce(function (acc, r) {
      return acc + (_dashBool(r['StatusAktif']) ? 1 : 0);
    }, 0);
  } catch (e) { return 0; }
}

// 7 divisi yang wajib melapor tiap minggu — dasar KPI "Divisi Melapor" dan
// reminder mingguan (NotifikasiService). Basis divisi (7: TU, OPS, INTEL,
// PANTAU, RAWAT, LOG, AWAK) sesuai PRD §4. Operasi Laut & Udara dikelompokkan
// dalam satu divisi OPS; Pengawakan (AKN) ikut divalidasi.
// Muat lazy (bukan konstanta top-level) karena SHEET_TX baru tersedia
// saat runtime, bukan saat file ini dievaluasi.
function _ovMelaporDivisiList() {
  return [
    { label: 'Tata Usaha', divisiId: DIVISI_ID.TU,     sheets: [SHEET_TX.TATA_USAHA] },
    { label: 'Operasi',    divisiId: DIVISI_ID.OPS,    sheets: [SHEET_TX.OPERASI_LAUT, SHEET_TX.OPERASI_UDARA] },
    { label: 'Intelijen',  divisiId: DIVISI_ID.INTEL,  sheets: [SHEET_TX.INTELIJEN] },
    { label: 'Pemantauan', divisiId: DIVISI_ID.PANTAU, sheets: [SHEET_TX.PEMANTAUAN] },
    { label: 'Perawatan',  divisiId: DIVISI_ID.RAWAT,  sheets: [SHEET_TX.PERAWATAN_KESIAPAN] },
    { label: 'Logistik',   divisiId: DIVISI_ID.LOG,    sheets: [SHEET_TX.LOGISTIK_BBM] },
    { label: 'Pengawakan', divisiId: DIVISI_ID.AWAK,   sheets: [SHEET_TX.PENGAWAKAN_AKN] }
  ];
}

/** Detail per-divisi: apakah sudah ada laporan pada minggu berjalan. */
function _dashMelaporDetail() {
  var weekRange = periodeToDateRange(getCurrentPeriode());
  return _ovMelaporDivisiList().map(function (d) {
    var melapor = false;
    if (weekRange) {
      for (var s = 0; s < d.sheets.length && !melapor; s++) {
        try {
          _dashActiveRows(d.sheets[s], true).forEach(function (r) {
            if (melapor) return;
            // Baris harus milik divisi ini. Semua service tulis TX meng-hardcode
            // DivisiID modul, jadi filter ini hanya menjaga baris legacy/salah.
            if (String(r['DivisiID'] || '').trim() &&
                String(r['DivisiID']) !== String(d.divisiId)) return;
            var pr = periodeToDateRange(String(r['Periode'] || ''));
            var inWeek = pr ? (pr.startDate <= weekRange.endDate && pr.endDate >= weekRange.startDate)
                            : isInRange(new Date(r['Timestamp']), weekRange);
            if (inWeek) melapor = true;
          });
        } catch (e) {}
      }
    }
    return { label: d.label, divisiId: d.divisiId, melapor: melapor };
  });
}

function _dashDivisiMelapor() {
  return _dashMelaporDetail().reduce(function (acc, d) {
    return acc + (d.melapor ? 1 : 0);
  }, 0);
}

// ── Tren bulanan (Jan → bulan terpilih) ─────────────────────
function _dashMonthKey(ts) {
  var t = new Date(ts);
  if (isNaN(t.getTime())) return '';
  return t.getFullYear() + '-' + (t.getMonth() < 9 ? '0' + (t.getMonth() + 1) : (t.getMonth() + 1));
}

/** Jumlah (kolom `Jumlah`) per bulan untuk satu `Jenis` (Pemantauan/Intelijen). */
function _dashMonthlyJenis(rows, f, jenis) {
  return utils_getTrendMonths(f).map(function (m) {
    return rows.reduce(function (acc, r) {
      return acc + ((String(r['Jenis'] || '') === jenis && _dashMonthKey(r['Timestamp']) === m) ? _num(r['Jumlah']) : 0);
    }, 0);
  });
}

/** Banyaknya baris per bulan (mis. Kegiatan Direktorat). */
function _dashMonthlyCount(rows, f) {
  return utils_getTrendMonths(f).map(function (m) {
    return rows.reduce(function (acc, r) { return acc + (_dashMonthKey(r['Timestamp']) === m ? 1 : 0); }, 0);
  });
}

function _dashMonthly(rows, f, col) {
  var months = utils_getTrendMonths(f);
  var out = [];
  months.forEach(function (m) {
    out.push(rows.reduce(function (acc, r) {
      var t = new Date(r['Timestamp']);
      var key = t.getFullYear() + '-' + (t.getMonth() < 9 ? '0' + (t.getMonth() + 1) : (t.getMonth() + 1));
      return acc + (key === m ? _num(r[col]) : 0);
    }, 0));
  });
  return out;
}

function _dashMonthlyByPeriode(rows, f, col) {
  var months = utils_getTrendMonths(f);
  var out = [];
  months.forEach(function (m) {
    out.push(rows.reduce(function (acc, r) {
      var pr = periodeToDateRange(String(r['Periode'] || ''));
      if (!pr) return acc;
      var key = pr.startDate.getFullYear() + '-' + (pr.startDate.getMonth() < 9 ? '0' + (pr.startDate.getMonth() + 1) : (pr.startDate.getMonth() + 1));
      return acc + (key === m ? _num(r[col]) : 0);
    }, 0));
  });
  return out;
}

// ── Formatters ──────────────────────────────────────────────
function _dashKP(kapalId) {
  return String(kapalId || '');
}

function _dashWPP(wppCode) {
  return String(wppCode || '');
}

function _dashOpsLaut(r) {
  return {
    periode: String(r['Periode'] || ''),
    wppCode: _dashWPP(r['WPPCode']),
    kapalId: _dashKP(r['KapalID']),
    kii: _num(r['KII_Ditangkap']),
    kia: _num(r['KIA_Ditangkap']),
    asalNegara: String(r['AsalNegaraAsing'] || ''),
    hariOperasi: _num(r['HariOperasi_Jumlah']),
    timestamp: r['Timestamp'] ? new Date(r['Timestamp']).toISOString() : null
  };
}

function _dashOpsUdara(r) {
  return {
    periode: String(r['Periode'] || ''),
    wppCode: _dashWPP(r['WPPCode']),
    kapalId: _dashKP(r['KapalID']),
    kii: _num(r['KII']),
    kia: _num(r['KIA']),
    objekSdk: _num(r['ObjekSDK']),
    cakupanNm2: _num(r['CakupanWilayah_NM2']),
    hariOperasi: _num(r['HariOperasi_Jumlah']),
    timestamp: r['Timestamp'] ? new Date(r['Timestamp']).toISOString() : null
  };
}

function _dashAmunisi(r) {
  var isBase = _logIsBaselineRow({ jenis: 'AMUNISI' }, r);
  return {
    periode: String(r['Periode'] || ''),
    kapalId: _dashKP(r['KapalID']),
    jenis: String(r['JenisAmunisi'] || ''),
    mode: isBase ? 'BASELINE' : 'PENGGUNAAN',
    stokAwal: isBase ? _num(r['StokAwal']) : '',
    penggunaan: isBase ? '' : _num(r['Penggunaan_Minggu']),
    timestamp: r['Timestamp'] ? new Date(r['Timestamp']).toISOString() : null
  };
}

function _dashBbm(r) {
  var isBase = _logIsBaselineRow({ jenis: 'BBM' }, r);
  return {
    periode: String(r['Periode'] || ''),
    kapalId: _dashKP(r['KapalID']),
    jenis: String(r['Jenis'] || ''),
    mode: isBase ? 'BASELINE' : 'PENGGUNAAN',
    pagu: isBase ? _num(r['Pagu']) : '',
    realisasi: isBase ? '' : _num(r['Realisasi_Minggu']),
    hargaAcuan: String(r['HargaAcuan'] || ''),
    tunggakan: String(r['Tunggakan_Status'] || ''),
    timestamp: r['Timestamp'] ? new Date(r['Timestamp']).toISOString() : null
  };
}

function _dashMara(r) {
  return {
    periode: String(r['Periode'] || ''),
    kapalId: _dashKP(r['KapalID']),
    kondisi: String(r['KondisiDarurat'] || ''),
    penanganan: String(r['StatusPenanganan'] || ''),
    timestamp: r['Timestamp'] ? new Date(r['Timestamp']).toISOString() : null
  };
}

function _dashDesc(a, b) {
  return new Date(b['Timestamp']) - new Date(a['Timestamp']);
}

function _dashFmtDate(v) {
  if (!v) return '';
  var d = new Date(v);
  if (isNaN(d)) return '';
  var dd = d.getDate(), mm = d.getMonth() + 1, yyyy = d.getFullYear();
  return (dd < 10 ? '0' + dd : dd) + '-' + (mm < 10 ? '0' + mm : mm) + '-' + yyyy;
}

function _dashKapalInfo(kapalId) {
  var rows = sheetToObjects(openMasterSheet(SHEET_MASTER.KAPAL));
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['KapalID'] || '').trim() === kapalId) {
      return {
        kapalId: String(rows[i]['KapalID']),
        nama: String(rows[i]['Nama'] || ''),
        kelas: String(rows[i]['Kelas'] || ''),
        homebaseUpt: String(rows[i]['Homebase_UPT'] || ''),
        statusAktif: _dashBool(rows[i]['StatusAktif'])
      };
    }
  }
  return null;
}