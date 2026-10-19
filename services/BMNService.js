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
    return { lokasiId: 'UPT-PUSAT', namaLokasi: 'Pusat (POA)', distanceKm: null };
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

  return nearest || { lokasiId: 'UPT-PUSAT', namaLokasi: 'Pusat (POA)', distanceKm: null };
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
      var lokId = String(r['LokasiID'] || 'UPT-PUSAT');

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
    }

    var pctKelaikanFisik = totalUnit > 0
      ? Math.round(((kondisiCounts.BAIK + (kondisiCounts.RUSAK_RINGAN * 0.5)) / totalUnit) * 1000) / 10
      : 100;

    var pctBaik = totalUnit > 0 ? Math.round((kondisiCounts.BAIK / totalUnit) * 1000) / 10 : 0;
    var pctRusakRingan = totalUnit > 0 ? Math.round((kondisiCounts.RUSAK_RINGAN / totalUnit) * 1000) / 10 : 0;
    var pctRusakBerat = totalUnit > 0 ? Math.round((kondisiCounts.RUSAK_BERAT / totalUnit) * 1000) / 10 : 0;

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
      var lokasiId = params.lokasiId || 'UPT-PUSAT';
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
        params.fotoEvidenceId || '',
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
