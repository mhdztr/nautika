/**
 * services/BMNService.js
 * Modul Tata Usaha: Manajemen Inventaris Barang Milik Negara (BMN) & Siklus Penghapusan Kemenkeu.
 *
 * Mengelola data di spreadsheet dedicated Nautika_TU:
 * - TX_BMN_Aset: Register fisik inventaris BMN per-item (Anti-Jebret: 1 baris = 1 unit fisik).
 * - TX_BMN_Penghapusan: Berkas usulan penghapusan bertingkat (Kemenkeu / DJKN / KPKNL).
 * - TX_BMN_Penghapusan_Detail: Item aset dalam berkas usulan.
 * - Master_Lokasi_UPT: 15 Pangkalan / Stasiun / Satwas / Kantor Pusat KKP.
 * - Master_BMN_Kategori: Klasifikasi SIMAK/SAKTI & masa manfaat aset.
 */

var _BMN_DIVISI_ID = 'DIV-TU';

// ── RBAC HELPERS ──────────────────────────────────────────

function _bmnRequireSession(token) {
  var session = _getSession(token);
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau belum disetujui.');
  }
  return session;
}

function _bmnAssertRead(session) {
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Akun belum aktif.');
  }
  // Semua akun approved diizinkan membaca inventaris BMN untuk visibilitas aset nasional
}

function _bmnAssertWrite(session) {
  assertScope(session, [ROLE.SUPERADMIN, ROLE.KADIV, ROLE.STAF], _BMN_DIVISI_ID);
}

function _bmnAssertVoid(session) {
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Akun belum aktif.');
  }
  if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) return;
  if (session.role === ROLE.KADIV && session.divisiId === _BMN_DIVISI_ID) return;
  throw new Error('UNAUTHORIZED: Anda tidak memiliki wewenang untuk menganulir aset BMN.');
}

// ── HAVERSINE & GEOLOCATION HELPERS ───────────────────────

/**
 * Menghitung jarak lingkaran besar (great-circle distance) dua koordinat GPS dalam kilometer.
 */
function _bmnHaversineKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius bumi dalam km
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Mencari UPT terdekat berdasarkan koordinat latitude & longitude.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {Array<Object>} masterUpts
 * @returns {{ lokasiId: string, namaLokasi: string, distanceKm: number }}
 */
function _bmnMatchNearestUpt(lat, lon, masterUpts) {
  if (!lat || !lon || isNaN(lat) || isNaN(lon) || !masterUpts || masterUpts.length === 0) {
    return { lokasiId: 'UPT-PUSAT-POA', namaLokasi: 'Pusat (POA)', distanceKm: null };
  }

  var nearest = null;
  var minDistance = Infinity;

  for (var i = 0; i < masterUpts.length; i++) {
    var u = masterUpts[i];
    var uLat = parseFloat(u['Latitude']);
    var uLon = parseFloat(u['Longitude']);
    if (isNaN(uLat) || isNaN(uLon)) continue;

    var dist = _bmnHaversineKm(lat, lon, uLat, uLon);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = {
        lokasiId: String(u['LokasiID']),
        namaLokasi: String(u['NamaLokasi']),
        distanceKm: dist
      };
    }
  }

  return nearest || { lokasiId: 'UPT-PUSAT-POA', namaLokasi: 'Pusat (POA)', distanceKm: null };
}

// ── AGE & USEFUL LIFE HELPER ──────────────────────────────

/**
 * Menghitung umur aset dan sisa masa manfaat berdasarkan TanggalPerolehan & MasaManfaatTahun.
 */
function _bmnComputeAge(tglPerolehanStr, masaManfaatTahun) {
  if (!tglPerolehanStr) {
    return { umurTahun: 0, umurBulan: 0, sisaManfaatTahun: 0, isExpired: false };
  }

  var tgl = new Date(tglPerolehanStr);
  if (isNaN(tgl.getTime())) {
    return { umurTahun: 0, umurBulan: 0, sisaManfaatTahun: 0, isExpired: false };
  }

  var now = new Date();
  var diffMonths = (now.getFullYear() - tgl.getFullYear()) * 12 + (now.getMonth() - tgl.getMonth());
  if (diffMonths < 0) diffMonths = 0;

  var umurTahun = Math.floor(diffMonths / 12);
  var umurBulan = diffMonths % 12;

  var masaTahun = parseFloat(masaManfaatTahun) || 0;
  var sisaManfaatTahun = 0;
  var isExpired = false;

  if (masaTahun > 0) {
    var totalMasaBulan = masaTahun * 12;
    var sisaBulan = totalMasaBulan - diffMonths;
    if (sisaBulan <= 0) {
      sisaManfaatTahun = 0;
      isExpired = true;
    } else {
      sisaManfaatTahun = Math.round((sisaBulan / 12) * 10) / 10;
      isExpired = false;
    }
  }

  return {
    umurTahun: umurTahun,
    umurBulan: umurBulan,
    sisaManfaatTahun: sisaManfaatTahun,
    isExpired: isExpired
  };
}

// ── PUBLIC API: MASTER DATA BMN ───────────────────────────

/**
 * Mengambil master UPT dan Kategori BMN dari Nautika_TU.
 */
function bmn_getMasters(token) {
  try {
    var session = _bmnRequireSession(token);
    _bmnAssertRead(session);

    var uptSheet = openTuSheet(SHEET_TU.MASTER_LOKASI_UPT);
    var katSheet = openTuSheet(SHEET_TU.MASTER_BMN_KATEGORI);

    var uptRows = sheetToObjects(uptSheet).filter(function (r) {
      return String(r['Status'] || 'AKTIF').toUpperCase() === 'AKTIF';
    });

    var katRows = sheetToObjects(katSheet).filter(function (r) {
      return String(r['Status'] || 'AKTIF').toUpperCase() === 'AKTIF';
    });

    return {
      success: true,
      data: {
        uptList: uptRows.map(function (u) {
          return {
            lokasiId:   String(u['LokasiID']),
            namaLokasi: String(u['NamaLokasi']),
            jenis:      String(u['Jenis']),
            wilayah:    String(u['Wilayah']),
            latitude:   parseFloat(u['Latitude']) || null,
            longitude:  parseFloat(u['Longitude']) || null,
            alamat:     String(u['Alamat'] || '')
          };
        }),
        kategoriList: katRows.map(function (k) {
          return {
            kodeKategori:     String(k['KodeKategori']),
            namaKategori:     String(k['NamaKategori']),
            masaManfaatTahun: parseFloat(k['MasaManfaatTahun']) || 0,
            akunModal:        String(k['AkunBelanjaModal'] || ''),
            akunBarang:       String(k['AkunBelanjaBarang'] || '')
          };
        })
      }
    };
  } catch (e) {
    Logger.log('[bmn_getMasters] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── PUBLIC API: REGISTER INVENTARIS ASET BMN ──────────────

/**
 * Mengambil daftar aset BMN dengan paginasi, pencarian, filter, dan perhitungan umur di server.
 *
 * @param {string} token
 * @param {{
 *   page?: number,
 *   pageSize?: number,
 *   pencatatan?: string,  // 'ALL' | 'BUKU' | 'REGULER'
 *   kondisi?: string,     // 'ALL' | 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT'
 *   statusAset?: string,  // 'ALL' | 'AKTIF' | 'DALAM_PENGHAPUSAN' | 'DIHAPUS'
 *   lokasiId?: string,
 *   kategori?: string,
 *   q?: string,
 *   sortBy?: string,
 *   sortDir?: string
 * }} params
 */
function bmn_getAsetList(token, params) {
  try {
    var session = _bmnRequireSession(token);
    _bmnAssertRead(session);

    params = params || {};
    var page = parseInt(params.page, 10) || 1;
    var pageSize = parseInt(params.pageSize, 10) || 25;
    if (page < 1) page = 1;
    if (pageSize < 5) pageSize = 5;
    if (pageSize > 200) pageSize = 200;

    var filterPencatatan = (params.pencatatan || 'ALL').toUpperCase();
    var filterKondisi    = (params.kondisi || 'ALL').toUpperCase();
    var filterStatusAset = (params.statusAset || 'ALL').toUpperCase();
    var filterLokasiId   = (params.lokasiId || 'ALL').toUpperCase();
    var filterKategori   = (params.kategori || 'ALL').toUpperCase();
    var query            = (params.q || '').trim().toLowerCase();

    var sheet = openTuSheet(SHEET_TU.BMN_ASET);
    var rows  = sheetToObjects(sheet);

    // Filter baris ACTIVE (bukan SUPERSEDED atau VOID)
    var activeRows = rows.filter(function (r) {
      return String(r['Status']) === ROW_STATUS.ACTIVE;
    });

    // Ambil master kategori untuk masa manfaat
    var katSheet = openTuSheet(SHEET_TU.MASTER_BMN_KATEGORI);
    var katRows = sheetToObjects(katSheet);
    var masaManfaatMap = {};
    katRows.forEach(function (k) {
      masaManfaatMap[String(k['KodeKategori'])] = parseFloat(k['MasaManfaatTahun']) || 0;
    });

    // Filter berdasarkan kriteria
    var filtered = activeRows.filter(function (r) {
      // Filter status aset internal BMN (AKTIF / DALAM_PENGHAPUSAN / DIHAPUS)
      var stAset = String(r['StatusAset'] || 'AKTIF').toUpperCase();
      if (filterStatusAset !== 'ALL' && stAset !== filterStatusAset) return false;

      // Filter Pencatatan (BUKU vs REGULER)
      var penc = String(r['KategoriPencatatan'] || '').toUpperCase();
      if (filterPencatatan !== 'ALL' && penc !== filterPencatatan) return false;

      // Filter Kondisi
      var kond = String(r['Kondisi'] || '').toUpperCase();
      if (filterKondisi !== 'ALL' && kond !== filterKondisi) return false;

      // Filter Lokasi UPT
      var lok = String(r['LokasiID'] || '').toUpperCase();
      if (filterLokasiId !== 'ALL' && lok !== filterLokasiId) return false;

      // Filter Kategori
      var kat = String(r['KodeKategori'] || '').toUpperCase();
      if (filterKategori !== 'ALL' && kat !== filterKategori) return false;

      // Pencarian kata kunci (KodeBarang, NUP, NamaBarang, MerekTipe, Ruangan)
      if (query) {
        var strSearch = (
          String(r['KodeBarang'] || '') + ' ' +
          String(r['NUP'] || '') + ' ' +
          String(r['NamaBarang'] || '') + ' ' +
          String(r['MerekTipe'] || '') + ' ' +
          String(r['LokasiDetailRuangan'] || '')
        ).toLowerCase();
        if (strSearch.indexOf(query) === -1) return false;
      }

      return true;
    });

    // Sorting
    var sortBy = params.sortBy || 'TanggalPerolehan';
    var sortDir = (params.sortDir || 'desc').toLowerCase();
    filtered.sort(function (a, b) {
      var valA = a[sortBy];
      var valB = b[sortBy];
      if (sortBy === 'NilaiPerolehan' || sortBy === 'NilaiBuku') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      } else if (sortBy === 'TanggalPerolehan' || sortBy === 'Timestamp') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    var totalCount = filtered.length;
    var totalPages = Math.ceil(totalCount / pageSize) || 1;
    var startIndex = (page - 1) * pageSize;
    var pagedRows = filtered.slice(startIndex, startIndex + pageSize);

    var items = pagedRows.map(function (r) {
      var katCode = String(r['KodeKategori'] || '');
      var masaManfaat = masaManfaatMap[katCode] || 0;
      var ageInfo = _bmnComputeAge(r['TanggalPerolehan'], masaManfaat);

      return {
        rowId:               String(r['RowID']),
        asetId:              String(r['AsetID']),
        kodeBarang:          String(r['KodeBarang'] || ''),
        nup:                 String(r['NUP'] || ''),
        namaBarang:          String(r['NamaBarang'] || ''),
        merekTipe:           String(r['MerekTipe'] || ''),
        kategoriPencatatan:  String(r['KategoriPencatatan'] || 'BUKU'),
        kodeKategori:        katCode,
        tanggalPerolehan:    r['TanggalPerolehan'] ? new Date(r['TanggalPerolehan']).toISOString().substring(0, 10) : null,
        nilaiPerolehan:      parseFloat(r['NilaiPerolehan']) || 0,
        nilaiBuku:           parseFloat(r['NilaiBuku']) || 0,
        kondisi:             String(r['Kondisi'] || 'BAIK'),
        lokasiId:            String(r['LokasiID'] || ''),
        lokasiDetailRuangan: String(r['LokasiDetailRuangan'] || ''),
        latitude:            parseFloat(r['Latitude']) || null,
        longitude:           parseFloat(r['Longitude']) || null,
        sumberLokasi:        String(r['SumberLokasi'] || 'MANUAL'),
        jarakKeUptKm:        parseFloat(r['JarakKeUPT_Km']) || null,
        tanggalVerifikasi:   r['TanggalVerifikasi'] ? new Date(r['TanggalVerifikasi']).toISOString().substring(0, 10) : null,
        fotoEvidenceId:      String(r['FotoEvidenceID'] || ''),
        statusAset:          String(r['StatusAset'] || 'AKTIF'),
        penghapusanId:       String(r['PenghapusanID'] || ''),
        kapalId:             String(r['KapalID'] || ''),
        umurTahun:           ageInfo.umurTahun,
        umurBulan:           ageInfo.umurBulan,
        sisaManfaatTahun:    ageInfo.sisaManfaatTahun,
        isExpired:           ageInfo.isExpired,
        keterangan:          String(r['Keterangan'] || '')
      };
    });

    return {
      success: true,
      data: {
        items: items,
        totalCount: totalCount,
        page: page,
        pageSize: pageSize,
        totalPages: totalPages
      }
    };
  } catch (e) {
    Logger.log('[bmn_getAsetList] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── PUBLIC API: SUMMARY & ACTIONABLE ALERTS ───────────────

/**
 * Ringkasan metrik BMN (Gross, Net, Kondisi, Pencatatan, Antrean Hapus, dan Alert Banner).
 */
function bmn_getSummary(token, filter) {
  try {
    var session = _bmnRequireSession(token);
    _bmnAssertRead(session);

    var sheet = openTuSheet(SHEET_TU.BMN_ASET);
    var rows  = sheetToObjects(sheet);

    var activeRows = rows.filter(function (r) {
      return String(r['Status']) === ROW_STATUS.ACTIVE;
    });

    var uptSheet = openTuSheet(SHEET_TU.MASTER_LOKASI_UPT);
    var masterUpts = sheetToObjects(uptSheet).filter(function (u) {
      return String(u['Status'] || 'AKTIF').toUpperCase() === 'AKTIF';
    });

    var uptMap = {};
    for (var m = 0; m < masterUpts.length; m++) {
      var mu = masterUpts[m];
      var muId = String(mu['LokasiID']);
      uptMap[muId] = {
        lokasiId:   muId,
        namaLokasi: String(mu['NamaLokasi']),
        jenis:      String(mu['Jenis'] || 'UPT'),
        wilayah:    String(mu['Wilayah'] || ''),
        latitude:   parseFloat(mu['Latitude']) || null,
        longitude:  parseFloat(mu['Longitude']) || null,
        total:      0,
        baik:       0,
        rusakRingan:0,
        rusakBerat: 0,
        nilaiGross: 0,
        nilaiBuku:  0,
        antreanHapus: 0
      };
    }

    var totalAsetGross = 0;
    var totalNilaiBuku  = 0;
    var totalUnit       = activeRows.length;

    var countBuku     = 0;
    var nilaiBukuSum  = 0;
    var countReguler  = 0;
    var nilaiRegSum   = 0;

    var kondisiCounts = {
      BAIK: 0,
      RUSAK_RINGAN: 0,
      RUSAK_BERAT: 0
    };

    var antreanHapusCount = 0;
    var rusakBeratKandidatHapus = 0;
    var uptCounts = {};

    for (var i = 0; i < activeRows.length; i++) {
      var r = activeRows[i];
      var np = parseFloat(r['NilaiPerolehan']) || 0;
      var nb = parseFloat(r['NilaiBuku']) || 0;
      var kond = String(r['Kondisi'] || 'BAIK').toUpperCase();
      var penc = String(r['KategoriPencatatan'] || 'BUKU').toUpperCase();
      var stAset = String(r['StatusAset'] || 'AKTIF').toUpperCase();
      var lokId = String(r['LokasiID'] || 'UPT-PUSAT-POA');

      totalAsetGross += np;
      totalNilaiBuku += nb;

      if (penc === 'REGULER') {
        countReguler++;
        nilaiRegSum += np;
      } else {
        countBuku++;
        nilaiBukuSum += nb;
      }

      if (kondisiCounts.hasOwnProperty(kond)) {
        kondisiCounts[kond]++;
      } else {
        kondisiCounts.BAIK++;
      }

      if (stAset === 'DALAM_PENGHAPUSAN') {
        antreanHapusCount++;
      }

      if (kond === 'RUSAK_BERAT' && stAset === 'AKTIF') {
        rusakBeratKandidatHapus++;
      }

      uptCounts[lokId] = (uptCounts[lokId] || 0) + 1;

      if (!uptMap[lokId]) {
        uptMap[lokId] = {
          lokasiId:   lokId,
          namaLokasi: lokId,
          jenis:      'UPT',
          wilayah:    '',
          latitude:   null,
          longitude:  null,
          total:      0,
          baik:       0,
          rusakRingan:0,
          rusakBerat: 0,
          nilaiGross: 0,
          nilaiBuku:  0,
          antreanHapus: 0
        };
      }
      var targetUpt = uptMap[lokId];
      targetUpt.total++;
      targetUpt.nilaiGross += np;
      targetUpt.nilaiBuku += nb;
      if (kond === 'RUSAK_BERAT') targetUpt.rusakBerat++;
      else if (kond === 'RUSAK_RINGAN') targetUpt.rusakRingan++;
      else targetUpt.baik++;
      if (stAset === 'DALAM_PENGHAPUSAN') targetUpt.antreanHapus++;
    }

    var pctKelaikanFisik = totalUnit > 0
      ? Math.round(((kondisiCounts.BAIK + (kondisiCounts.RUSAK_RINGAN * 0.5)) / totalUnit) * 1000) / 10
      : 100;

    var pctBaik = totalUnit > 0 ? Math.round((kondisiCounts.BAIK / totalUnit) * 1000) / 10 : 0;
    var pctRusakRingan = totalUnit > 0 ? Math.round((kondisiCounts.RUSAK_RINGAN / totalUnit) * 1000) / 10 : 0;
    var pctRusakBerat = totalUnit > 0 ? Math.round((kondisiCounts.RUSAK_BERAT / totalUnit) * 1000) / 10 : 0;

    var uptArray = [];
    for (var kId in uptMap) {
      if (uptMap.hasOwnProperty(kId)) {
        uptArray.push(uptMap[kId]);
      }
    }

    return {
      success: true,
      data: {
        totalUnit: totalUnit,
        totalAsetGross: totalAsetGross,
        totalNilaiBuku: totalNilaiBuku,
        pctKelaikanFisik: pctKelaikanFisik,
        antreanHapusCount: antreanHapusCount,
        rusakBeratKandidatHapus: rusakBeratKandidatHapus,
        pencatatan: {
          buku: { count: countBuku, nilaiBuku: nilaiBukuSum },
          reguler: { count: countReguler, nilaiPerolehan: nilaiRegSum }
        },
        kondisi: {
          baik: { count: kondisiCounts.BAIK, pct: pctBaik },
          rusakRingan: { count: kondisiCounts.RUSAK_RINGAN, pct: pctRusakRingan },
          rusakBerat: { count: kondisiCounts.RUSAK_BERAT, pct: pctRusakBerat }
        },
        uptCounts: uptCounts,
        uptList: uptArray,
        notificationAlert: {
          hasRusakBeratAlert: rusakBeratKandidatHapus > 0,
          kandidatCount: rusakBeratKandidatHapus,
          text: 'Terdapat ' + kondisiCounts.BAIK + ' unit (' + pctBaik + '%) aset Baik, ' +
                kondisiCounts.RUSAK_RINGAN + ' unit (' + pctRusakRingan + '%) Rusak Ringan, dan ' +
                kondisiCounts.RUSAK_BERAT + ' unit (' + pctRusakBerat + '%) Rusak Berat.' +
                (rusakBeratKandidatHapus > 0
                  ? ' \u2014 ' + rusakBeratKandidatHapus + ' unit Rusak Berat aktif direkomendasikan segera diusulkan Penghapusan BMN Kemenkeu.'
                  : '')
        }
      }
    };
  } catch (e) {
    Logger.log('[bmn_getSummary] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── PUBLIC API: SUBMIT & UPDATE SINGLE ASET (ANTI-JEBRET) ─

/**
 * Menyimpan entri baru atau revisi aset individual BMN.
 *
 * @param {string} token
 * @param {{
 *   asetId?: string,
 *   kodeBarang: string,
 *   nup: string,
 *   namaBarang: string,
 *   merekTipe?: string,
 *   kategoriPencatatan: string, // 'BUKU' | 'REGULER'
 *   kodeKategori: string,
 *   tanggalPerolehan: string,
 *   nilaiPerolehan: number,
 *   nilaiBuku: number,
 *   kondisi: string,            // 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT'
 *   lokasiId?: string,
 *   lokasiDetailRuangan?: string,
 *   latitude?: number,
 *   longitude?: number,
 *   sumberLokasi?: string,
 *   fotoEvidenceId?: string,
 *   kapalId?: string,
 *   keterangan?: string
 * }} params
 */
function bmn_submitAset(token, params) {
  try {
    var session = _bmnRequireSession(token);
    _bmnAssertWrite(session);

    if (!params) throw new Error('Data aset tidak boleh kosong.');
    if (!params.kodeBarang || !params.nup || !params.namaBarang) {
      throw new Error('Kode Barang, NUP, dan Nama Barang wajib diisi.');
    }
    if (!params.kondisi) {
      throw new Error('Kondisi aset (Baik / Rusak Ringan / Rusak Berat) wajib ditentukan.');
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      var sheet = openTuSheet(SHEET_TU.BMN_ASET);
      var rows  = sheetToObjects(sheet);

      // Hitung koordinat dan matching UPT terdekat jika ada koordinat GPS
      var lat = parseFloat(params.latitude) || null;
      var lon = parseFloat(params.longitude) || null;
      var lokasiId = params.lokasiId || 'UPT-PUSAT-POA';
      var jarakKm = null;
      var sumberLokasi = params.sumberLokasi || 'MANUAL';

      if (lat !== null && lon !== null) {
        var uptSheet = openTuSheet(SHEET_TU.MASTER_LOKASI_UPT);
        var uptRows = sheetToObjects(uptSheet);
        var match = _bmnMatchNearestUpt(lat, lon, uptRows);
        if (!params.lokasiId) {
          lokasiId = match.lokasiId;
        }
        jarakKm = match.distanceKm;
      }

      var now = new Date();
      var asetId = params.asetId || ('BMN-' + Utilities.getUuid().substring(0, 12).toUpperCase());
      var supersedesRowId = '';

      // Cek apakah revisi baris eksisting
      if (params.asetId) {
        for (var i = 0; i < rows.length; i++) {
          if (rows[i]['AsetID'] === params.asetId && String(rows[i]['Status']) === ROW_STATUS.ACTIVE) {
            var targetIdx = i + 2;
            var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
            var colStatus = headers.indexOf('Status') + 1;
            sheet.getRange(targetIdx, colStatus).setValue(ROW_STATUS.SUPERSEDED);
            supersedesRowId = rows[i]['RowID'];
            break;
          }
        }
      }

      var newRowId = Utilities.getUuid();
      var periode = getCurrentPeriode();

      // Penanganan foto bukti fisik (base64) jika dikirimkan
      var fotoEvidenceId = params.fotoEvidenceId || '';
      if (params.photoPayload && params.photoPayload.dataBase64) {
        try {
          var pB64 = String(params.photoPayload.dataBase64).replace(/^data:[^;]+;base64,/, '').trim();
          var pMime = params.photoPayload.mimeType || 'image/jpeg';
          var pName = params.photoPayload.fileName || ('BMN_' + asetId + '.jpg');
          var pBlob = Utilities.newBlob(Utilities.base64Decode(pB64), pMime, pName);

          var rootFolder = _evGetOrCreateRoot();
          var fTu = _evGetOrCreateSub(rootFolder, 'Tata Usaha');
          var fYm = _evGetOrCreateSub(fTu, (periode && periode.length >= 7) ? periode.substring(0, 7) : 'Umum');
          var fAset = _evGetOrCreateSub(fYm, 'BMN-' + asetId);
          var driveFile = fAset.createFile(pBlob);
          fotoEvidenceId = _evAppendEvidence(SHEET_TU.BMN_ASET, newRowId, driveFile.getId(), pName, pMime, 'UPLOAD', session.userId);
        } catch (evErr) {
          Logger.log('[bmn_submitAset photo error] ' + evErr.message);
        }
      }

      var newRow = [
        newRowId,
        _BMN_DIVISI_ID,
        periode,
        session.userId,
        now,
        ROW_STATUS.ACTIVE,
        supersedesRowId,
        '', // VoidReason
        '', // VoidedBy
        '', // VoidedAt
        asetId,
        String(params.kodeBarang).trim(),
        String(params.nup).trim(),
        String(params.namaBarang).trim(),
        params.merekTipe ? String(params.merekTipe).trim() : '',
        params.kategoriPencatatan || 'BUKU',
        params.kodeKategori || 'KAT-ALAT_KANTOR',
        params.tanggalPerolehan ? new Date(params.tanggalPerolehan) : now,
        parseFloat(params.nilaiPerolehan) || 0,
        parseFloat(params.nilaiBuku) || 0,
        params.kondisi || 'BAIK',
        lokasiId,
        params.lokasiDetailRuangan ? String(params.lokasiDetailRuangan).trim() : '',
        lat,
        lon,
        sumberLokasi,
        jarakKm,
        now, // TanggalVerifikasi
        fotoEvidenceId,
        'AKTIF', // StatusAset
        '',      // PenghapusanID
        params.kapalId || '',
        '',      // ImportBatchID
        params.keterangan ? String(params.keterangan).trim() : ''
      ];

      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, 1, newRow.length).setValues([newRow]);

      logAudit(session.userId, params.asetId ? 'REVISI_BMN' : 'CREATE_BMN', 'TX_BMN_Aset', newRowId, {
        asetId: asetId,
        kodeBarang: params.kodeBarang,
        nup: params.nup,
        kondisi: params.kondisi
      });

      return {
        success: true,
        data: {
          asetId: asetId,
          rowId: newRowId,
          lokasiId: lokasiId,
          jarakKeUptKm: jarakKm
        },
        message: 'Aset BMN berhasil disimpan ke register inventaris.'
      };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    Logger.log('[bmn_submitAset] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── PUBLIC API: SMART BULK IMPORT BMN (SAKTI / SIMAK) ─────

/**
 * Menyimpan data impor massal BMN dari hasil parsing SAKTI/SIMAK.
 * 1 baris = 1 unit fisik tunggal (Anti-Jebret).
 *
 * @param {string} token
 * @param {{
 *   items: Array<Object>,
 *   batchId?: string
 * }} payload
 */
function bmn_importBatchAset(token, payload) {
  try {
    var session = _bmnRequireSession(token);
    _bmnAssertWrite(session);

    if (!payload || !payload.items || !payload.items.length) {
      throw new Error('Tidak ada data aset yang dikirim untuk diimpor.');
    }

    var items = payload.items;
    var batchId = payload.batchId || ('BATCH-BMN-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().substring(0, 6).toUpperCase());
    var now = new Date();
    var periode = getCurrentPeriode();

    var lock = LockService.getScriptLock();
    lock.waitLock(15000);

    try {
      var sheet = openTuSheet(SHEET_TU.BMN_ASET);
      var lastRow = sheet.getLastRow();

      var uptSheet = openTuSheet(SHEET_TU.MASTER_LOKASI_UPT);
      var uptRows = sheetToObjects(uptSheet);

      var rowsToAdd = [];
      var totalNilaiPerolehan = 0;
      var totalNilaiBuku = 0;

      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it.kodeBarang || !it.nup || !it.namaBarang) {
          continue; // Lewati baris yang tidak memenuhi field kunci
        }

        var newRowId = Utilities.getUuid();
        var asetId = 'BMN-' + Utilities.getUuid().substring(0, 12).toUpperCase();

        var lat = parseFloat(it.latitude) || null;
        var lon = parseFloat(it.longitude) || null;
        var lokasiId = it.lokasiId || 'UPT-PUSAT';
        var jarakKm = null;

        if (lat !== null && lon !== null) {
          var match = _bmnMatchNearestUpt(lat, lon, uptRows);
          if (!it.lokasiId) lokasiId = match.lokasiId;
          jarakKm = match.distanceKm;
        }

        var np = parseFloat(it.nilaiPerolehan) || 0;
        var nb = parseFloat(it.nilaiBuku) || 0;
        totalNilaiPerolehan += np;
        totalNilaiBuku += nb;

        var tglPerolehan = it.tanggalPerolehan ? new Date(it.tanggalPerolehan) : now;
        if (isNaN(tglPerolehan.getTime())) tglPerolehan = now;

        var row = [
          newRowId,
          _BMN_DIVISI_ID,
          periode,
          session.userId,
          now,
          ROW_STATUS.ACTIVE,
          '', // SupersedesRowID
          '', // VoidReason
          '', // VoidedBy
          '', // VoidedAt
          asetId,
          String(it.kodeBarang).trim(),
          String(it.nup).trim(),
          String(it.namaBarang).trim(),
          it.merekTipe ? String(it.merekTipe).trim() : '',
          it.kategoriPencatatan === 'REGULER' ? 'REGULER' : 'BUKU',
          it.kodeKategori || 'KAT-ALAT_KANTOR',
          tglPerolehan,
          np,
          nb,
          it.kondisi || 'BAIK',
          lokasiId,
          it.lokasiDetailRuangan ? String(it.lokasiDetailRuangan).trim() : '',
          lat,
          lon,
          'IMPOR_SAKTI',
          jarakKm,
          now, // TanggalVerifikasi
          it.fotoEvidenceId || '',
          'AKTIF',
          '', // PenghapusanID
          it.kapalId || '',
          batchId,
          it.keterangan ? String(it.keterangan).trim() : ''
        ];

        rowsToAdd.push(row);
      }

      if (rowsToAdd.length > 0) {
        sheet.getRange(lastRow + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
      }

      logAudit(session.userId, 'IMPORT_BMN_BATCH', 'TX_BMN_Aset', batchId, {
        totalUnit: rowsToAdd.length,
        totalNilaiPerolehan: totalNilaiPerolehan,
        totalNilaiBuku: totalNilaiBuku
      });

      return {
        success: true,
        data: {
          batchId: batchId,
          insertedCount: rowsToAdd.length,
          totalNilaiPerolehan: totalNilaiPerolehan,
          totalNilaiBuku: totalNilaiBuku
        },
        message: 'Berhasil mengimpor ' + rowsToAdd.length + ' unit aset BMN ke register inventaris.'
      };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    Logger.log('[bmn_importBatchAset] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── PUBLIC API: ANULIR ASET BMN ───────────────────────────

/**
 * Menganulir baris inventaris BMN.
 */
function bmn_anulirAset(token, params) {
  try {
    var session = _bmnRequireSession(token);
    _bmnAssertVoid(session);

    if (!params || !params.rowId || !params.alasan) {
      throw new Error('RowID dan Alasan Anulir wajib diisi.');
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      var sheet = openTuSheet(SHEET_TU.BMN_ASET);
      var rows  = sheetToObjects(sheet);
      var targetIdx = -1;
      var targetAsetId = '';

      for (var i = 0; i < rows.length; i++) {
        if (rows[i]['RowID'] === params.rowId && String(rows[i]['Status']) === ROW_STATUS.ACTIVE) {
          targetIdx = i + 2;
          targetAsetId = rows[i]['AsetID'];
          break;
        }
      }

      if (targetIdx === -1) {
        throw new Error('Data aset tidak ditemukan atau sudah tidak aktif.');
      }

      var headers   = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var colStatus = headers.indexOf('Status') + 1;
      var colReason = headers.indexOf('VoidReason') + 1;
      var colBy     = headers.indexOf('VoidedBy') + 1;
      var colAt     = headers.indexOf('VoidedAt') + 1;

      sheet.getRange(targetIdx, colStatus).setValue(ROW_STATUS.VOID);
      sheet.getRange(targetIdx, colReason).setValue(params.alasan);
      sheet.getRange(targetIdx, colBy).setValue(session.userId);
      sheet.getRange(targetIdx, colAt).setValue(new Date());

      logAudit(session.userId, 'ANULIR_BMN', 'TX_BMN_Aset', params.rowId, {
        asetId: targetAsetId,
        alasan: params.alasan
      });

      return { success: true, message: 'Entri aset BMN berhasil dianulir.' };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    Logger.log('[bmn_anulirAset] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================
// SIKLUS PENGHAPUSAN LEGAL BMN KEMENKEU (SUB-FASE 18B.6)
// State Machine: DRAFT_USULAN -> SURAT_USULAN -> PERSETUJUAN_KEMENKEU -> SK_PENGHAPUSAN -> BAST_SELESAI (atau DITOLAK)
// ============================================================

/**
 * Mengambil daftar aset yang berstatus AKTIF dan siap diusulkan untuk penghapusan.
 */
function bmn_getAsetEligibleHapus(token) {
  try {
    var session = _bmnRequireSession(token);
    _bmnAssertRead(session);

    var sheet = openTuSheet(SHEET_TU.BMN_ASET);
    var rows  = sheetToObjects(sheet);

    var eligible = rows.filter(function (r) {
      return String(r['Status']) === ROW_STATUS.ACTIVE &&
             String(r['StatusAset'] || 'AKTIF').toUpperCase() === 'AKTIF';
    }).map(function (r) {
      var tglPeroleh = r['TanggalPerolehan'] ? String(r['TanggalPerolehan']).split('T')[0] : '';
      var masaManfaat = parseFloat(r['MasaManfaatTahun']) || 5;
      var age = _bmnComputeAge(tglPeroleh, masaManfaat);

      return {
        asetId:              String(r['AsetID']),
        kodeBarang:          String(r['KodeBarang']),
        nup:                 String(r['NUP']),
        namaBarang:          String(r['NamaBarang']),
        merekTipe:           String(r['MerekTipe'] || ''),
        kondisi:             String(r['Kondisi'] || 'BAIK').toUpperCase(),
        kategoriPencatatan:  String(r['KategoriPencatatan'] || 'BUKU').toUpperCase(),
        lokasiId:            String(r['LokasiID'] || ''),
        namaLokasi:          String(r['NamaLokasi'] || ''),
        nilaiPerolehan:      parseFloat(r['NilaiPerolehan']) || 0,
        nilaiBuku:           parseFloat(r['NilaiBuku']) || 0,
        umurAsetTahun:       age.umurTahun,
        sisaManfaatTahun:    age.sisaTahun,
        isKadaluwarsa:       age.isKadaluwarsa
      };
    });

    // Urutkan: Rusak Berat dan Kadaluwarsa di atas
    eligible.sort(function (a, b) {
      if (a.kondisi === 'RUSAK_BERAT' && b.kondisi !== 'RUSAK_BERAT') return -1;
      if (b.kondisi === 'RUSAK_BERAT' && a.kondisi !== 'RUSAK_BERAT') return 1;
      if (a.isKadaluwarsa && !b.isKadaluwarsa) return -1;
      if (!a.isKadaluwarsa && b.isKadaluwarsa) return 1;
      return a.namaBarang.localeCompare(b.namaBarang);
    });

    return { success: true, data: eligible };
  } catch (e) {
    Logger.log('[bmn_getAsetEligibleHapus] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Membuat berkas usulan penghapusan BMN baru (Tahap: DRAFT_USULAN).
 * Mengkarantina aset terpilih menjadi StatusAset = 'DALAM_PENGHAPUSAN'.
 */
function bmn_createPenghapusan(token, payload) {
  try {
    var session = _bmnRequireSession(token);
    _bmnAssertWrite(session);

    if (!payload || !payload.alasan) {
      throw new Error('Alasan Penghapusan wajib dipilih.');
    }
    if (!payload.asetIds || !Array.isArray(payload.asetIds) || payload.asetIds.length === 0) {
      throw new Error('Pilih minimal 1 unit aset untuk diusulkan penghapusan.');
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(15000);

    try {
      var asetSheet = openTuSheet(SHEET_TU.BMN_ASET);
      var asetRows  = sheetToObjects(asetSheet);
      var asetHeaders = asetSheet.getRange(1, 1, 1, asetSheet.getLastColumn()).getValues()[0];

      var colAsetRowId       = asetHeaders.indexOf('RowID') + 1;
      var colAsetStatusAset  = asetHeaders.indexOf('StatusAset') + 1;
      var colAsetPenghapusan = asetHeaders.indexOf('PenghapusanID') + 1;

      // Cari dan validasi aset
      var targetAssets = [];
      var targetRowIndices = [];

      for (var i = 0; i < asetRows.length; i++) {
        var ar = asetRows[i];
        if (payload.asetIds.indexOf(ar['AsetID']) !== -1 && String(ar['Status']) === ROW_STATUS.ACTIVE) {
          if (String(ar['StatusAset'] || 'AKTIF').toUpperCase() !== 'AKTIF') {
            throw new Error('Aset ' + ar['NamaBarang'] + ' (NUP ' + ar['NUP'] + ') sedang dalam status ' + ar['StatusAset'] + ' dan tidak dapat diajukan kembali.');
          }
          targetAssets.push(ar);
          targetRowIndices.push(i + 2);
        }
      }

      if (targetAssets.length !== payload.asetIds.length) {
        throw new Error('Sebagian aset yang dipilih tidak ditemukan atau sudah tidak aktif.');
      }

      var hpsSheet = openTuSheet(SHEET_TU.BMN_PENGHAPUSAN);
      var hpsRows  = sheetToObjects(hpsSheet);

      var tahun = new Date().getFullYear();
      var counter = 1;
      for (var h = 0; h < hpsRows.length; h++) {
        var existId = String(hpsRows[h]['PenghapusanID'] || '');
        if (existId.indexOf('HPS-' + tahun) === 0) {
          var num = parseInt(existId.split('-')[2], 10);
          if (!isNaN(num) && num >= counter) counter = num + 1;
        }
      }
      var penghapusanId = 'HPS-' + tahun + '-' + ('0000' + counter).slice(-4);
      var parentRowId   = generateRowId('TX_BMN_Penghapusan');
      var now = new Date();
      var periode = now.getFullYear() + '-W' + ('0' + Math.ceil(now.getDate() / 7)).slice(-2);

      var totalNilaiPerolehan = 0;
      var totalNilaiBuku = 0;

      targetAssets.forEach(function (ta) {
        totalNilaiPerolehan += parseFloat(ta['NilaiPerolehan']) || 0;
        totalNilaiBuku += parseFloat(ta['NilaiBuku']) || 0;
      });

      // 1. Tulis Berkas Induk TX_BMN_Penghapusan
      var hpsRowData = [
        parentRowId, _BMN_DIVISI_ID, periode, session.userId, now, ROW_STATUS.ACTIVE, '', '', '', '',
        penghapusanId,
        'DRAFT_USULAN',
        payload.alasan,
        payload.keterangan || '',
        payload.nomorSuratUsulan || '',
        payload.tanggalSuratUsulan || '',
        payload.evidenceSuratUsulan || '',
        '', '', '', '', // Surat Persetujuan Kemenkeu
        '', '', '',    // SK Penghapusan
        '',            // Evidence BAST
        targetAssets.length,
        totalNilaiPerolehan,
        totalNilaiBuku
      ];
      hpsSheet.appendRow(hpsRowData);

      // 2. Tulis Item Detail TX_BMN_Penghapusan_Detail
      var detailSheet = openTuSheet(SHEET_TU.BMN_PENGHAPUSAN_DETAIL);
      var detailRowsToAdd = [];

      for (var d = 0; d < targetAssets.length; d++) {
        var da = targetAssets[d];
        var dRowId = generateRowId('TX_BMN_Penghapusan_Detail');
        detailRowsToAdd.push([
          dRowId, _BMN_DIVISI_ID, periode, session.userId, now, ROW_STATUS.ACTIVE, '', '', '', '',
          parentRowId,
          penghapusanId,
          da['AsetID'],
          da['Kondisi'] || 'RUSAK_BERAT',
          parseFloat(da['NilaiBuku']) || 0
        ]);
      }

      if (detailRowsToAdd.length > 0) {
        detailSheet.getRange(
          detailSheet.getLastRow() + 1,
          1,
          detailRowsToAdd.length,
          detailRowsToAdd[0].length
        ).setValues(detailRowsToAdd);
      }

      // 3. Karantina Aset di TX_BMN_Aset
      for (var k = 0; k < targetRowIndices.length; k++) {
        var rIdx = targetRowIndices[k];
        asetSheet.getRange(rIdx, colAsetStatusAset).setValue('DALAM_PENGHAPUSAN');
        asetSheet.getRange(rIdx, colAsetPenghapusan).setValue(penghapusanId);
      }

      logAudit(session.userId, 'CREATE_BMN_PENGHAPUSAN', 'TX_BMN_Penghapusan', parentRowId, {
        penghapusanId: penghapusanId,
        totalUnit: targetAssets.length,
        totalNilaiBuku: totalNilaiBuku,
        alasan: payload.alasan
      });

      return {
        success: true,
        data: {
          penghapusanId: penghapusanId,
          totalUnit: targetAssets.length,
          totalNilaiBuku: totalNilaiBuku
        },
        message: 'Berkas usulan penghapusan ' + penghapusanId + ' berhasil dibuat dengan ' + targetAssets.length + ' unit aset dikarantina.'
      };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    Logger.log('[bmn_createPenghapusan] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Mengambil daftar berkas usulan penghapusan BMN.
 */
function bmn_getPenghapusanList(token, params) {
  try {
    var session = _bmnRequireSession(token);
    _bmnAssertRead(session);

    params = params || {};
    var sheet = openTuSheet(SHEET_TU.BMN_PENGHAPUSAN);
    var rows  = sheetToObjects(sheet);

    var activeRows = rows.filter(function (r) {
      return String(r['Status']) === ROW_STATUS.ACTIVE;
    });

    var tahapFilter = String(params.tahap || 'ALL').toUpperCase();
    if (tahapFilter !== 'ALL') {
      activeRows = activeRows.filter(function (r) {
        return String(r['Tahap'] || '').toUpperCase() === tahapFilter;
      });
    }

    var q = String(params.q || '').trim().toLowerCase();
    if (q) {
      activeRows = activeRows.filter(function (r) {
        return String(r['PenghapusanID'] || '').toLowerCase().indexOf(q) !== -1 ||
               String(r['NomorSuratUsulan'] || '').toLowerCase().indexOf(q) !== -1 ||
               String(r['NomorSuratPersetujuan'] || '').toLowerCase().indexOf(q) !== -1 ||
               String(r['NomorSK'] || '').toLowerCase().indexOf(q) !== -1 ||
               String(r['KeteranganAlasan'] || '').toLowerCase().indexOf(q) !== -1;
      });
    }

    // Urutkan terbaru di atas
    activeRows.sort(function (a, b) {
      return new Date(b['Timestamp']).getTime() - new Date(a['Timestamp']).getTime();
    });

    var result = activeRows.map(function (r) {
      return {
        rowId:                   String(r['RowID']),
        penghapusanId:           String(r['PenghapusanID']),
        tahap:                   String(r['Tahap'] || 'DRAFT_USULAN'),
        alasanPenghapusan:       String(r['AlasanPenghapusan'] || ''),
        keteranganAlasan:         String(r['KeteranganAlasan'] || ''),
        nomorSuratUsulan:        String(r['NomorSuratUsulan'] || ''),
        tanggalSuratUsulan:      r['TanggalSuratUsulan'] ? String(r['TanggalSuratUsulan']).split('T')[0] : '',
        evidenceSuratUsulan:     String(r['EvidenceSuratUsulan'] || ''),
        nomorSuratPersetujuan:   String(r['NomorSuratPersetujuan'] || ''),
        tanggalSuratPersetujuan: r['TanggalSuratPersetujuan'] ? String(r['TanggalSuratPersetujuan']).split('T')[0] : '',
        instansiKemenkeu:        String(r['InstansiKemenkeu'] || ''),
        evidenceSuratPersetujuan:String(r['EvidenceSuratPersetujuan'] || ''),
        nomorSK:                 String(r['NomorSK'] || ''),
        tanggalSK:               r['TanggalSK'] ? String(r['TanggalSK']).split('T')[0] : '',
        evidenceSK:              String(r['EvidenceSK'] || ''),
        evidenceBAST:            String(r['EvidenceBAST'] || ''),
        totalUnit:               parseInt(r['TotalUnit'], 10) || 0,
        totalNilaiPerolehan:     parseFloat(r['TotalNilaiPerolehan']) || 0,
        totalNilaiBuku:          parseFloat(r['TotalNilaiBuku']) || 0,
        submittedBy:             String(r['SubmittedBy'] || ''),
        timestamp:               r['Timestamp']
      };
    });

    return { success: true, data: result };
  } catch (e) {
    Logger.log('[bmn_getPenghapusanList] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Mengambil detail berkas usulan penghapusan beserta rincian item aset di dalamnya.
 */
function bmn_getPenghapusanDetail(token, penghapusanId) {
  try {
    var session = _bmnRequireSession(token);
    _bmnAssertRead(session);

    if (!penghapusanId) throw new Error('PenghapusanID wajib diberikan.');

    var hpsSheet = openTuSheet(SHEET_TU.BMN_PENGHAPUSAN);
    var hpsRows  = sheetToObjects(hpsSheet);

    var usulanRow = null;
    for (var i = 0; i < hpsRows.length; i++) {
      if (hpsRows[i]['PenghapusanID'] === penghapusanId && String(hpsRows[i]['Status']) === ROW_STATUS.ACTIVE) {
        usulanRow = hpsRows[i];
        break;
      }
    }

    if (!usulanRow) throw new Error('Berkas usulan penghapusan tidak ditemukan atau sudah tidak aktif.');

    // Ambil detail items
    var detailSheet = openTuSheet(SHEET_TU.BMN_PENGHAPUSAN_DETAIL);
    var detailRows  = sheetToObjects(detailSheet);

    var itemRefs = detailRows.filter(function (d) {
      return d['PenghapusanID'] === penghapusanId && String(d['Status']) === ROW_STATUS.ACTIVE;
    });

    // Ambil informasi master aset
    var asetSheet = openTuSheet(SHEET_TU.BMN_ASET);
    var asetRows  = sheetToObjects(asetSheet);
    var asetMap = {};
    asetRows.forEach(function (ar) {
      asetMap[ar['AsetID']] = ar;
    });

    var items = itemRefs.map(function (ir) {
      var a = asetMap[ir['AsetID']] || {};
      return {
        detailRowId:        String(ir['RowID']),
        asetId:             String(ir['AsetID']),
        kondisiSaatUsul:    String(ir['KondisiSaatUsul'] || 'RUSAK_BERAT'),
        nilaiBukuSaatUsul:  parseFloat(ir['NilaiBukuSaatUsul']) || 0,
        kodeBarang:         String(a['KodeBarang'] || ''),
        nup:                String(a['NUP'] || ''),
        namaBarang:         String(a['NamaBarang'] || ''),
        merekTipe:          String(a['MerekTipe'] || ''),
        lokasiId:           String(a['LokasiID'] || ''),
        namaLokasi:         String(a['NamaLokasi'] || ''),
        statusAset:         String(a['StatusAset'] || 'DALAM_PENGHAPUSAN')
      };
    });

    return {
      success: true,
      data: {
        usulan: {
          rowId:                   String(usulanRow['RowID']),
          penghapusanId:           String(usulanRow['PenghapusanID']),
          tahap:                   String(usulanRow['Tahap'] || 'DRAFT_USULAN'),
          alasanPenghapusan:       String(usulanRow['AlasanPenghapusan'] || ''),
          keteranganAlasan:         String(usulanRow['KeteranganAlasan'] || ''),
          nomorSuratUsulan:        String(usulanRow['NomorSuratUsulan'] || ''),
          tanggalSuratUsulan:      usulanRow['TanggalSuratUsulan'] ? String(usulanRow['TanggalSuratUsulan']).split('T')[0] : '',
          evidenceSuratUsulan:     String(usulanRow['EvidenceSuratUsulan'] || ''),
          nomorSuratPersetujuan:   String(usulanRow['NomorSuratPersetujuan'] || ''),
          tanggalSuratPersetujuan: usulanRow['TanggalSuratPersetujuan'] ? String(usulanRow['TanggalSuratPersetujuan']).split('T')[0] : '',
          instansiKemenkeu:        String(usulanRow['InstansiKemenkeu'] || ''),
          evidenceSuratPersetujuan:String(usulanRow['EvidenceSuratPersetujuan'] || ''),
          nomorSK:                 String(usulanRow['NomorSK'] || ''),
          tanggalSK:               usulanRow['TanggalSK'] ? String(usulanRow['TanggalSK']).split('T')[0] : '',
          evidenceSK:              String(usulanRow['EvidenceSK'] || ''),
          evidenceBAST:            String(usulanRow['EvidenceBAST'] || ''),
          totalUnit:               parseInt(usulanRow['TotalUnit'], 10) || 0,
          totalNilaiPerolehan:     parseFloat(usulanRow['TotalNilaiPerolehan']) || 0,
          totalNilaiBuku:          parseFloat(usulanRow['TotalNilaiBuku']) || 0,
          submittedBy:             String(usulanRow['SubmittedBy'] || ''),
          timestamp:               usulanRow['Timestamp']
        },
        items: items
      }
    };
  } catch (e) {
    Logger.log('[bmn_getPenghapusanDetail] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Memajukan tahapan berkas usulan penghapusan BMN sesuai State Machine legal Kemenkeu.
 *
 * Transisi:
 * - DRAFT_USULAN -> SURAT_USULAN (wajib NomorSuratUsulan, TanggalSuratUsulan, EvidenceSuratUsulan)
 * - SURAT_USULAN -> PERSETUJUAN_KEMENKEU (wajib NomorSuratPersetujuan, TanggalSuratPersetujuan, InstansiKemenkeu, EvidenceSuratPersetujuan)
 * - PERSETUJUAN_KEMENKEU -> SK_PENGHAPUSAN (wajib NomorSK, TanggalSK, EvidenceSK)
 * - SK_PENGHAPUSAN -> BAST_SELESAI (wajib EvidenceBAST) -> Eksekusi StatusAset = 'DIHAPUS'
 * - Any -> DITOLAK -> Lepaskan aset kembali ke StatusAset = 'AKTIF'
 */
function bmn_advancePenghapusan(token, payload) {
  try {
    var session = _bmnRequireSession(token);
    _bmnAssertWrite(session);

    if (!payload || !payload.penghapusanId || !payload.tahapTarget) {
      throw new Error('PenghapusanID dan Tahap Target wajib diisi.');
    }

    var validTahap = ['SURAT_USULAN', 'PERSETUJUAN_KEMENKEU', 'SK_PENGHAPUSAN', 'BAST_SELESAI', 'DITOLAK'];
    if (validTahap.indexOf(payload.tahapTarget) === -1) {
      throw new Error('Tahap target tidak valid: ' + payload.tahapTarget);
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(15000);

    try {
      var hpsSheet = openTuSheet(SHEET_TU.BMN_PENGHAPUSAN);
      var hpsRows  = sheetToObjects(hpsSheet);
      var hpsHeaders = hpsSheet.getRange(1, 1, 1, hpsSheet.getLastColumn()).getValues()[0];

      var targetRowIdx = -1;
      var currentHps = null;

      for (var i = 0; i < hpsRows.length; i++) {
        if (hpsRows[i]['PenghapusanID'] === payload.penghapusanId && String(hpsRows[i]['Status']) === ROW_STATUS.ACTIVE) {
          targetRowIdx = i + 2;
          currentHps = hpsRows[i];
          break;
        }
      }

      if (targetRowIdx === -1 || !currentHps) {
        throw new Error('Berkas usulan penghapusan tidak ditemukan atau sudah tidak aktif.');
      }

      var currentTahap = String(currentHps['Tahap'] || 'DRAFT_USULAN');
      if (currentTahap === 'BAST_SELESAI' || currentTahap === 'DITOLAK') {
        throw new Error('Berkas usulan ini sudah berada pada status final (' + currentTahap + ') dan tidak dapat diubah lagi.');
      }

      var colMap = {};
      hpsHeaders.forEach(function (h, idx) { colMap[h] = idx + 1; });

      // Validasi per tahap
      if (payload.tahapTarget === 'SURAT_USULAN') {
        if (!payload.nomorSuratUsulan) throw new Error('Nomor Surat Usulan Satker wajib diisi.');
        if (!payload.tanggalSuratUsulan) throw new Error('Tanggal Surat Usulan wajib diisi.');
        if (!payload.evidenceSuratUsulan) throw new Error('Bukti dukung berkas Surat Usulan (PDF / Drive) wajib dilampirkan.');

        hpsSheet.getRange(targetRowIdx, colMap['Tahap']).setValue('SURAT_USULAN');
        hpsSheet.getRange(targetRowIdx, colMap['NomorSuratUsulan']).setValue(payload.nomorSuratUsulan);
        hpsSheet.getRange(targetRowIdx, colMap['TanggalSuratUsulan']).setValue(payload.tanggalSuratUsulan);
        hpsSheet.getRange(targetRowIdx, colMap['EvidenceSuratUsulan']).setValue(payload.evidenceSuratUsulan);

      } else if (payload.tahapTarget === 'PERSETUJUAN_KEMENKEU') {
        if (!payload.nomorSuratPersetujuan) throw new Error('Nomor Surat Persetujuan Kemenkeu wajib diisi.');
        if (!payload.tanggalSuratPersetujuan) throw new Error('Tanggal Surat Persetujuan Kemenkeu wajib diisi.');
        if (!payload.instansiKemenkeu) throw new Error('Instansi Kemenkeu penerbit izin (DJKN/KPKNL) wajib diisi.');
        if (!payload.evidenceSuratPersetujuan) throw new Error('Bukti dukung izin persetujuan Kemenkeu (PDF / Drive) wajib dilampirkan.');

        hpsSheet.getRange(targetRowIdx, colMap['Tahap']).setValue('PERSETUJUAN_KEMENKEU');
        hpsSheet.getRange(targetRowIdx, colMap['NomorSuratPersetujuan']).setValue(payload.nomorSuratPersetujuan);
        hpsSheet.getRange(targetRowIdx, colMap['TanggalSuratPersetujuan']).setValue(payload.tanggalSuratPersetujuan);
        hpsSheet.getRange(targetRowIdx, colMap['InstansiKemenkeu']).setValue(payload.instansiKemenkeu);
        hpsSheet.getRange(targetRowIdx, colMap['EvidenceSuratPersetujuan']).setValue(payload.evidenceSuratPersetujuan);

      } else if (payload.tahapTarget === 'SK_PENGHAPUSAN') {
        if (!payload.nomorSK) throw new Error('Nomor SK Penghapusan KKP wajib diisi.');
        if (!payload.tanggalSK) throw new Error('Tanggal SK Penghapusan wajib diisi.');
        if (!payload.evidenceSK) throw new Error('Salinan berkas SK Penghapusan (PDF / Drive) wajib dilampirkan.');

        hpsSheet.getRange(targetRowIdx, colMap['Tahap']).setValue('SK_PENGHAPUSAN');
        hpsSheet.getRange(targetRowIdx, colMap['NomorSK']).setValue(payload.nomorSK);
        hpsSheet.getRange(targetRowIdx, colMap['TanggalSK']).setValue(payload.tanggalSK);
        hpsSheet.getRange(targetRowIdx, colMap['EvidenceSK']).setValue(payload.evidenceSK);

      } else if (payload.tahapTarget === 'BAST_SELESAI') {
        if (!payload.evidenceBAST) throw new Error('Bukti BAST Pemusnahan / Risalah Lelang wajib dilampirkan.');

        hpsSheet.getRange(targetRowIdx, colMap['Tahap']).setValue('BAST_SELESAI');
        hpsSheet.getRange(targetRowIdx, colMap['EvidenceBAST']).setValue(payload.evidenceBAST);

        // Eksekusi pemutakhiran status aset menjadi DIHAPUS
        var asetSheet = openTuSheet(SHEET_TU.BMN_ASET);
        var asetRows  = sheetToObjects(asetSheet);
        var asetHeaders = asetSheet.getRange(1, 1, 1, asetSheet.getLastColumn()).getValues()[0];
        var colStatusAset = asetHeaders.indexOf('StatusAset') + 1;

        for (var a = 0; a < asetRows.length; a++) {
          if (asetRows[a]['PenghapusanID'] === payload.penghapusanId && String(asetRows[a]['Status']) === ROW_STATUS.ACTIVE) {
            asetSheet.getRange(a + 2, colStatusAset).setValue('DIHAPUS');
          }
        }

      } else if (payload.tahapTarget === 'DITOLAK') {
        hpsSheet.getRange(targetRowIdx, colMap['Tahap']).setValue('DITOLAK');
        if (payload.alasanTolak) {
          var currKet = String(currentHps['KeteranganAlasan'] || '');
          hpsSheet.getRange(targetRowIdx, colMap['KeteranganAlasan']).setValue(currKet + ' [Ditolak: ' + payload.alasanTolak + ']');
        }

        // Kembalikan aset ke status AKTIF dan kosongkan PenghapusanID
        var asetSheetTolak = openTuSheet(SHEET_TU.BMN_ASET);
        var asetRowsTolak  = sheetToObjects(asetSheetTolak);
        var asetHeadersTolak = asetSheetTolak.getRange(1, 1, 1, asetSheetTolak.getLastColumn()).getValues()[0];
        var colStAset = asetHeadersTolak.indexOf('StatusAset') + 1;
        var colHpsId  = asetHeadersTolak.indexOf('PenghapusanID') + 1;

        for (var at = 0; at < asetRowsTolak.length; at++) {
          if (asetRowsTolak[at]['PenghapusanID'] === payload.penghapusanId && String(asetRowsTolak[at]['Status']) === ROW_STATUS.ACTIVE) {
            asetSheetTolak.getRange(at + 2, colStAset).setValue('AKTIF');
            asetSheetTolak.getRange(at + 2, colHpsId).setValue('');
          }
        }
      }

      logAudit(session.userId, 'ADVANCE_BMN_PENGHAPUSAN', 'TX_BMN_Penghapusan', currentHps['RowID'], {
        penghapusanId: payload.penghapusanId,
        tahapLama: currentTahap,
        tahapBaru: payload.tahapTarget
      });

      return {
        success: true,
        data: { penghapusanId: payload.penghapusanId, tahap: payload.tahapTarget },
        message: 'Tahapan berkas usulan ' + payload.penghapusanId + ' berhasil diperbarui ke ' + payload.tahapTarget + '.'
      };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    Logger.log('[bmn_advancePenghapusan] ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Menganulir berkas usulan penghapusan BMN.
 * Seluruh aset yang dikarantina otomatis dibebaskan kembali ke StatusAset = 'AKTIF'.
 */
function bmn_voidPenghapusan(token, params) {
  try {
    var session = _bmnRequireSession(token);
    _bmnAssertVoid(session);

    if (!params || !params.penghapusanId || !params.alasan) {
      throw new Error('PenghapusanID dan Alasan Anulir wajib diisi.');
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(15000);

    try {
      var hpsSheet = openTuSheet(SHEET_TU.BMN_PENGHAPUSAN);
      var hpsRows  = sheetToObjects(hpsSheet);
      var targetIdx = -1;
      var targetRowId = '';

      for (var i = 0; i < hpsRows.length; i++) {
        if (hpsRows[i]['PenghapusanID'] === params.penghapusanId && String(hpsRows[i]['Status']) === ROW_STATUS.ACTIVE) {
          targetIdx = i + 2;
          targetRowId = hpsRows[i]['RowID'];
          break;
        }
      }

      if (targetIdx === -1) {
        throw new Error('Berkas usulan penghapusan tidak ditemukan atau sudah tidak aktif.');
      }

      var hpsHeaders = hpsSheet.getRange(1, 1, 1, hpsSheet.getLastColumn()).getValues()[0];
      hpsSheet.getRange(targetIdx, hpsHeaders.indexOf('Status') + 1).setValue(ROW_STATUS.VOID);
      hpsSheet.getRange(targetIdx, hpsHeaders.indexOf('VoidReason') + 1).setValue(params.alasan);
      hpsSheet.getRange(targetIdx, hpsHeaders.indexOf('VoidedBy') + 1).setValue(session.userId);
      hpsSheet.getRange(targetIdx, hpsHeaders.indexOf('VoidedAt') + 1).setValue(new Date());

      // Anulir juga di detail
      var detailSheet = openTuSheet(SHEET_TU.BMN_PENGHAPUSAN_DETAIL);
      var detailRows  = sheetToObjects(detailSheet);
      var detailHeaders = detailSheet.getRange(1, 1, 1, detailSheet.getLastColumn()).getValues()[0];
      var colDStatus = detailHeaders.indexOf('Status') + 1;
      var colDReason = detailHeaders.indexOf('VoidReason') + 1;
      var colDBy     = detailHeaders.indexOf('VoidedBy') + 1;
      var colDAt     = detailHeaders.indexOf('VoidedAt') + 1;

      for (var d = 0; d < detailRows.length; d++) {
        if (detailRows[d]['PenghapusanID'] === params.penghapusanId && String(detailRows[d]['Status']) === ROW_STATUS.ACTIVE) {
          detailSheet.getRange(d + 2, colDStatus).setValue(ROW_STATUS.VOID);
          detailSheet.getRange(d + 2, colDReason).setValue(params.alasan);
          detailSheet.getRange(d + 2, colDBy).setValue(session.userId);
          detailSheet.getRange(d + 2, colDAt).setValue(new Date());
        }
      }

      // Bebaskan aset yang dikarantina kembali ke StatusAset = 'AKTIF'
      var asetSheet = openTuSheet(SHEET_TU.BMN_ASET);
      var asetRows  = sheetToObjects(asetSheet);
      var asetHeaders = asetSheet.getRange(1, 1, 1, asetSheet.getLastColumn()).getValues()[0];
      var colAsetSt = asetHeaders.indexOf('StatusAset') + 1;
      var colAsetHp = asetHeaders.indexOf('PenghapusanID') + 1;

      for (var a = 0; a < asetRows.length; a++) {
        if (asetRows[a]['PenghapusanID'] === params.penghapusanId && String(asetRows[a]['Status']) === ROW_STATUS.ACTIVE) {
          asetSheet.getRange(a + 2, colAsetSt).setValue('AKTIF');
          asetSheet.getRange(a + 2, colAsetHp).setValue('');
        }
      }

      logAudit(session.userId, 'VOID_BMN_PENGHAPUSAN', 'TX_BMN_Penghapusan', targetRowId, {
        penghapusanId: params.penghapusanId,
        alasan: params.alasan
      });

      return { success: true, message: 'Berkas usulan penghapusan berhasil dianulir dan aset dibebaskan kembali ke status aktif.' };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    Logger.log('[bmn_voidPenghapusan] ' + e.message);
    return { success: false, error: e.message };
  }
}
