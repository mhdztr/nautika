/**
 * services/RiwayatService.js
 * Service backend halaman Riwayat Laporan — PRD §7.5.
 *
 * Agregasi seluruh baris transaksi lintas modul (semua sheet TX_*) menjadi satu
 * feed kronologis yang mencakup ACTIVE, SUPERSEDED, dan VOID, dengan status
 * jelas (siapa melakukan apa), dan data siap-tampil (ringkasan 1 baris +
 * pasangan label/nilai untuk modal detail) supaya client cukup merender tanpa
 * perlu tahu skema tiap sheet.
 *
 * RBAC (PRD §3): semua akun APPROVED boleh buka halaman; data dibatasi divisi —
 *   SUPERADMIN / DIREKTUR → seluruh entri lintas divisi.
 *   KADIV → baris divisinya sendiri + seluruh TX_KegiatanDirektorat (modul
 *           lintas-divisi yang memang bisa ia CRUD — PRD §5.10).
 *   STAF  → baris divisinya sendiri.
 * Filter global (bulanan/rentang) menyaring kolom Timestamp.
 */

// ===========================================================================
// KONFIGURASI PER SHEET — label modul & pembangun ringkasan/detail.
// Semua fungsi dibaca di dalam pemanggilan (bukan saat load file — urutan load
// GAS belum menjamin utils/* termuat duluan).
// ===========================================================================

function _riwModules() {
  return [
    { sheet: SHEET_TX.TATA_USAHA,        label: 'Tata Usaha',        ringkas: _riwRingkasTU,        detail: _riwDetailTU },
    { sheet: SHEET_TX.OPERASI_LAUT,      label: 'Operasi Laut',      ringkas: _riwRingkasOpsLaut,   detail: _riwDetailOpsLaut },
    { sheet: SHEET_TX.OPERASI_UDARA,     label: 'Operasi Udara',     ringkas: _riwRingkasOpsUdara,  detail: _riwDetailOpsUdara },
    { sheet: SHEET_TX.INTELIJEN,         label: 'Intelijen',         ringkas: _riwRingkasIntel,     detail: _riwDetailIntel },
    { sheet: SHEET_TX.PEMANTAUAN,        label: 'Pemantauan',        ringkas: _riwRingkasPantau,    detail: _riwDetailPantau },
    { sheet: SHEET_TX.PERAWATAN_KESIAPAN,label: 'Perawatan — Kesiapan', ringkas: _riwRingkasRawKep,  detail: _riwDetailRawKep },
    { sheet: SHEET_TX.PERAWATAN_DOCKING, label: 'Perawatan — Docking',  ringkas: _riwRingkasRawDok,  detail: _riwDetailRawDok },
    { sheet: SHEET_TX.PERAWATAN_ITEM,    label: 'Perawatan — Item',  ringkas: _riwRingkasRawItem,   detail: _riwDetailRawItem },
    { sheet: SHEET_TX.LOGISTIK_AMUNISI,  label: 'Logistik — Amunisi',  ringkas: _riwRingkasLogAmm,   detail: _riwDetailLogAmm },
    { sheet: SHEET_TX.LOGISTIK_BBM,      label: 'Logistik — BBM',    ringkas: _riwRingkasLogBbm,    detail: _riwDetailLogBbm },
    { sheet: SHEET_TX.LOGISTIK_PERSONIL, label: 'Logistik — Personil', ringkas: _riwRingkasLogPer,   detail: _riwDetailLogPer },
    { sheet: SHEET_TX.PENGAWAKAN_AKN,    label: 'Pengawakan — Komposisi AKN', ringkas: _riwRingkasAwkAkn, detail: _riwDetailAwkAkn },
    { sheet: SHEET_TX.PENGAWAKAN_KEGIATAN,label: 'Pengawakan — Kegiatan Personel', ringkas: _riwRingkasAwkKeg, detail: _riwDetailAwkKeg },
    { sheet: SHEET_TX.KEGIATAN_DIREKTORAT, label: 'Kegiatan Direktorat', ringkas: _riwRingkasKgd,    detail: _riwDetailKgd }
  ];
}

// ===========================================================================
// SESSION & LOOKUP
// ===========================================================================

function _riwSession(token) {
  var session = _getSession(token);
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau belum disetujui.');
  }
  return session;
}

// Map referensi dari master, untuk menerjemahkan ID → nama pada ringkasan/detail.
function _riwLookups() {
  var kapal = {}, kawasan = {}, wpp = {}, user = {}, divisi = {};
  try {
    sheetToObjects(openMasterSheet(SHEET_MASTER.KAPAL)).forEach(function (r) {
      kapal[String(r['KapalID'])] = String(r['Nama'] || '');
    });
  } catch (e) {}
  try {
    sheetToObjects(openMasterSheet(SHEET_MASTER.KAWASAN_KONSERVASI)).forEach(function (r) {
      kawasan[String(r['KawasanID'])] = String(r['Nama'] || '');
    });
  } catch (e) {}
  try {
    sheetToObjects(openMasterSheet(SHEET_MASTER.WPP)).forEach(function (r) {
      wpp[String(r['WPPCode'])] = String(r['NamaWilayah'] || '');
    });
  } catch (e) {}
  try {
    sheetToObjects(openMasterSheet(SHEET_MASTER.USERS)).forEach(function (r) {
      user[String(r['UserID'])] = String(r['Nama'] || '');
    });
  } catch (e) {}
  try {
    sheetToObjects(openMasterSheet(SHEET_MASTER.DIVISI)).forEach(function (r) {
      divisi[String(r['DivisiID'])] = String(r['NamaDashboard'] || r['NamaResmi'] || '');
    });
  } catch (e) {}
  return { kapal: kapal, kawasan: kawasan, wpp: wpp, user: user, divisi: divisi };
}

// ===========================================================================
// UTIL TAMPIL
// ===========================================================================

function _riwNum(v) {
  var n = Number(v);
  if (isNaN(n)) return 0;
  return n;
}

function _riwRupiah(v) {
  var n = _riwNum(v);
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function _riwTgl(v) {
  if (!v) return '';
  var d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _riwTglWaktu(v) {
  if (!v) return '';
  var d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString('id-ID');
}

function _riwYaTidak(v) {
  return v === true || v === 'TRUE' || v === 1 || v === 'true' ? 'Ya' : 'Tidak';
}

// ===========================================================================
// PEMBANGUN RINGKASAN / DETAIL PER MODUL
// Setiap modul: ringkas(r, L) → string; detail(r, L) → Array<[label, value]>.
// ===========================================================================

function _riwRingkasTU(r, L) {
  return 'SP2D ' + _riwRupiah(r['RealisasiSP2D_Minggu']) + ' · Akrual ' + _riwRupiah(r['RealisasiAkrual_Minggu']);
}
function _riwDetailTU(r, L) {
  return [
    ['Pagu Reguler', _riwRupiah(r['PaguReguler'])],
    ['Pagu ABT', _riwRupiah(r['PaguABT'])],
    ['Realisasi SP2D (minggu ini)', _riwRupiah(r['RealisasiSP2D_Minggu'])],
    ['Realisasi Akrual (minggu ini)', _riwRupiah(r['RealisasiAkrual_Minggu'])],
    ['Catatan Revisi Pagu', r['CatatanRevisiPagu'] || '—']
  ];
}

function _riwRingkasOpsLaut(r, L) {
  var wpp = L.wpp[String(r['WPPCode'] || '')] || r['WPPCode'] || '—';
  return 'WPP ' + wpp + ' · KII ' + _riwNum(r['KII_Ditangkap']) + ' · KIA ' + _riwNum(r['KIA_Ditangkap']);
}
function _riwDetailOpsLaut(r, L) {
  var wpp = L.wpp[String(r['WPPCode'] || '')] || r['WPPCode'] || '—';
  return [
    ['WPP', wpp],
    ['KII Ditangkap', _riwNum(r['KII_Ditangkap'])],
    ['KIA Ditangkap', _riwNum(r['KIA_Ditangkap'])],
    ['Asal Negara Asing', r['AsalNegaraAsing'] || '—'],
    ['Valuasi Illegal Fishing', _riwRupiah(r['ValuasiIllegalFishing'])],
    ['Rumpon Ditertibkan', _riwNum(r['RumponDitertibkan'])],
    ['Valuasi Rumpon', _riwRupiah(r['ValuasiRumpon'])],
    ['Hasil Riksa — Kategori', r['HasilRiksa_Kategori'] || '—'],
    ['Hasil Riksa — KII', _riwNum(r['HasilRiksa_KII'])],
    ['Hasil Riksa — KIA', _riwNum(r['HasilRiksa_KIA'])],
    ['Hasil Riksa — Objek SDK', _riwNum(r['HasilRiksa_ObjekSDK'])],
    ['Hari Operasi — Kategori', r['HariOperasi_Kategori'] || '—'],
    ['Hari Operasi — Jumlah', _riwNum(r['HariOperasi_Jumlah'])],
    ['Hari Operasi — Target', _riwNum(r['HariOperasi_Target'])]
  ];
}

function _riwRingkasOpsUdara(r, L) {
  var wpp = L.wpp[String(r['WPPCode'] || '')] || r['WPPCode'] || '—';
  return 'WPP ' + wpp + ' · KII ' + _riwNum(r['KII']) + ' · KIA ' + _riwNum(r['KIA']);
}
function _riwDetailOpsUdara(r, L) {
  var wpp = L.wpp[String(r['WPPCode'] || '')] || r['WPPCode'] || '—';
  return [
    ['WPP', wpp],
    ['KII', _riwNum(r['KII'])],
    ['KIA', _riwNum(r['KIA'])],
    ['Objek SDK', _riwNum(r['ObjekSDK'])],
    ['Rumpon Lokal Teridentifikasi', _riwNum(r['RumponLokalTeridentifikasi'])],
    ['Cakupan Wilayah (NM²)', _riwNum(r['CakupanWilayah_NM2'])],
    ['Hari Operasi — Jumlah', _riwNum(r['HariOperasi_Jumlah'])],
    ['Hari Operasi — Target', _riwNum(r['HariOperasi_Target'])]
  ];
}

function _riwIntelLabel() {
  return {
    DREDGING:                  'Dredging / Underwater Ops',
    PELANGGARAN_PERIZINAN:     'Pelanggaran Perizinan Berusaha',
    PELANGGARAN_TRANSMITTER:   'Pelanggaran Mematikan Transmitter',
    NOTA_DINAS:                'Nota Dinas Data Intelijen',
    KAWASAN_KONSERVASI:        'Pelanggaran Kawasan Konservasi',
    KAPAL_PENGANGKUT_IKAN_HIDUP:'Kapal Pengangkut Ikan Hidup'
  };
}
function _riwRingkasIntel(r, L) {
  var lbl = (_riwIntelLabel()[r['Jenis']] || r['Jenis'] || '—');
  return lbl + ' · ' + _riwNum(r['Jumlah']);
}
function _riwDetailIntel(r, L) {
  return [
    ['Jenis', _riwIntelLabel()[r['Jenis']] || r['Jenis'] || '—'],
    ['Jumlah', _riwNum(r['Jumlah'])],
    ['Kawasan', r['KawasanID'] ? (L.kawasan[String(r['KawasanID'])] || r['KawasanID']) : '—'],
    ['Keterangan', r['Keterangan'] || '—']
  ];
}

function _riwPantauLabel() {
  return {
    PERSETUJUAN_PENYEDIA: 'Persetujuan Penyedia SPKP',
    USERNAME:             'Penerbitan Username',
    SKAT:                 'Penerbitan SKAT',
    PEMASANGAN_MIGRASI:   'Pemasangan SPKP Kapal Migrasi',
    MARABAHAYA:           'Kapal Kondisi Marabahaya'
  };
}
function _riwRingkasPantau(r, L) {
  var lbl = (_riwPantauLabel()[r['Jenis']] || r['Jenis'] || '—');
  var ada = r['NamaPenyedia'] || (r['KapalID'] ? (L.kapal[String(r['KapalID'])] || r['KapalID']) : '');
  return lbl + (ada ? ' — ' + ada : '') + (r['Jumlah'] !== '' && r['Jumlah'] != null ? ' · ' + _riwNum(r['Jumlah']) : '');
}
function _riwDetailPantau(r, L) {
  return [
    ['Jenis', _riwPantauLabel()[r['Jenis']] || r['Jenis'] || '—'],
    ['Jumlah', (r['Jumlah'] !== '' && r['Jumlah'] != null) ? _riwNum(r['Jumlah']) : '—'],
    ['Nama Penyedia', r['NamaPenyedia'] || '—'],
    ['Kapal', r['KapalID'] ? (L.kapal[String(r['KapalID'])] || r['KapalID']) : '—'],
    ['Kondisi Darurat', r['KondisiDarurat'] || '—'],
    ['Status Penanganan', r['StatusPenanganan'] || '—']
  ];
}

function _riwRingkasRawKep(r, L) {
  var kapal = L.kapal[String(r['KapalID'] || '')] || r['KapalID'] || '—';
  return kapal + ' — ' + (_riwYaTidak(r['StatusSiap']) === 'Ya' ? 'Siap Operasi' : 'Tidak Siap');
}
function _riwDetailRawKep(r, L) {
  return [
    ['Kapal', L.kapal[String(r['KapalID'] || '')] || r['KapalID'] || '—'],
    ['Status Siap', _riwYaTidak(r['StatusSiap'])],
    ['Penyebab', r['Penyebab'] || '—']
  ];
}

var _RIW_LOKASI = { PUSAT: 'Pusat', UPT: 'UPT' };
var _RIW_TAHAP = {
  PROSES_PENGADAAN:     'Proses Pengadaan',
  TANDATANGAN_KONTRAK:  'Tandatangan Kontrak',
  PROSES_DOCKING:       'Proses Docking',
  SELESAI:              'Selesai'
};
function _riwRingkasRawDok(r, L) {
  var kapal = L.kapal[String(r['KapalID'] || '')] || r['KapalID'] || '—';
  return kapal + ' — ' + (_RIW_LOKASI[r['Lokasi']] || r['Lokasi'] || '—') + ' / ' + (_RIW_TAHAP[r['Tahap']] || r['Tahap'] || '—');
}
function _riwDetailRawDok(r, L) {
  return [
    ['Kapal', L.kapal[String(r['KapalID'] || '')] || r['KapalID'] || '—'],
    ['Lokasi', _RIW_LOKASI[r['Lokasi']] || r['Lokasi'] || '—'],
    ['Tahap', _RIW_TAHAP[r['Tahap']] || r['Tahap'] || '—'],
    ['Nilai Kontrak', (r['NilaiKontrak'] !== '' && r['NilaiKontrak'] != null) ? _riwRupiah(r['NilaiKontrak']) : '—'],
    ['Kontraktor', r['Kontraktor'] || '—']
  ];
}

function _riwRingkasRawItem(r, L) {
  return (r['NamaPekerjaan'] || '—') + ' · ' + _riwRupiah(r['Nilai']);
}
function _riwDetailRawItem(r, L) {
  return [
    ['Nama Pekerjaan', r['NamaPekerjaan'] || '—'],
    ['Kategori', r['Kategori'] || '—'],
    ['Nilai', _riwRupiah(r['Nilai'])],
    ['Terkait Docking', r['DockingRowID'] ? 'Ya (' + r['DockingRowID'] + ')' : '—']
  ];
}

function _riwRingkasLogAmm(r, L) {
  var basis = (String(r['StokAwal']) !== '' && r['StokAwal'] != null);
  return (r['JenisAmunisi'] || '—') + (basis ? ' · Stok Awal ' + _riwNum(r['StokAwal']) : ' · Penggunaan ' + _riwNum(r['Penggunaan_Minggu']));
}
function _riwDetailLogAmm(r, L) {
  var basis = (String(r['StokAwal']) !== '' && r['StokAwal'] != null);
  return [
    ['Jenis Amunisi', r['JenisAmunisi'] || '—'],
    ['Jenis Baris', basis ? 'Baseline (Stok Awal)' : 'Penggunaan Mingguan'],
    ['Stok Awal', basis ? _riwNum(r['StokAwal']) : '—'],
    ['Penggunaan (Minggu Ini)', basis ? '—' : _riwNum(r['Penggunaan_Minggu'])]
  ];
}

function _riwRingkasLogBbm(r, L) {
  var basis = (String(r['Pagu']) !== '' && r['Pagu'] != null);
  return (r['Jenis'] || '—') + (basis ? ' · Pagu ' + _riwRupiah(r['Pagu']) : ' · Realisasi ' + _riwRupiah(r['Realisasi_Minggu']));
}
function _riwDetailLogBbm(r, L) {
  var basis = (String(r['Pagu']) !== '' && r['Pagu'] != null);
  return [
    ['Jenis', r['Jenis'] || '—'],
    ['Jenis Baris', basis ? 'Baseline (Pagu)' : 'Realisasi Mingguan'],
    ['Pagu', basis ? _riwRupiah(r['Pagu']) : '—'],
    ['Realisasi (Minggu Ini)', basis ? '—' : _riwRupiah(r['Realisasi_Minggu'])],
    ['Harga Acuan', _riwRupiah(r['HargaAcuan'])],
    ['Status Tunggakan', r['Tunggakan_Status'] || '—']
  ];
}

function _riwRingkasLogPer(r, L) {
  return (r['Komponen'] || '—') + ' · ' + _riwRupiah(r['Nilai_Minggu']);
}
function _riwDetailLogPer(r, L) {
  return [
    ['Komponen', r['Komponen'] || '—'],
    ['Nilai (Minggu Ini)', _riwRupiah(r['Nilai_Minggu'])]
  ];
}

function _riwRingkasAwkAkn(r, L) {
  return (r['Scope'] || '—') + ' / ' + (r['Kategori'] || '—') + ' · ' + _riwNum(r['Jumlah']);
}
function _riwDetailAwkAkn(r, L) {
  return [
    ['Scope', r['Scope'] || '—'],
    ['Kategori', r['Kategori'] || '—'],
    ['Jumlah', _riwNum(r['Jumlah'])]
  ];
}

function _riwRingkasAwkKeg(r, L) {
  return (r['JudulKegiatan'] || '—') + ' · ' + _riwTgl(r['TanggalMulai']);
}
function _riwDetailAwkKeg(r, L) {
  return [
    ['Judul', r['JudulKegiatan'] || '—'],
    ['Tanggal Mulai', _riwTgl(r['TanggalMulai'])],
    ['Tanggal Selesai', _riwTgl(r['TanggalSelesai'])],
    ['Wilayah', r['Wilayah'] || '—'],
    ['Jumlah Peserta', (r['JumlahPeserta'] !== '' && r['JumlahPeserta'] != null) ? _riwNum(r['JumlahPeserta']) : '—'],
    ['Deskripsi', r['Deskripsi'] || '—']
  ];
}

function _riwRingkasKgd(r, L) {
  return (r['JudulKegiatan'] || '—') + ' · ' + _riwTgl(r['Tanggal']);
}
function _riwDetailKgd(r, L) {
  return [
    ['Judul', r['JudulKegiatan'] || '—'],
    ['Tanggal', _riwTgl(r['Tanggal'])],
    ['Deskripsi', r['Deskripsi'] || '—'],
    ['Pihak Hadir', r['PihakHadir'] || '—']
  ];
}

// ===========================================================================
// ENDPOINT
// ===========================================================================

/**
 * Seluruh entri lintas modul dalam rentang filter (oleh Timestamp),
 * urut Timestamp menurun, dengan ringkasan + pasangan label/nilai siap-tampil.
 */
function riwayat_getAll(token, filter) {
  try {
    var session = _riwSession(token);
    var allowAll = (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR);
    var isKadiv = (session.role === ROLE.KADIV);
    var isStaf = (session.role === ROLE.STAF);

    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    var L = _riwLookups();
    var modules = _riwModules();

    var out = [];
    for (var m = 0; m < modules.length; m++) {
      var mod = modules[m];
      var sheet;
      try {
        sheet = openTransaksiSheet(mod.sheet);
      } catch (e) { continue; }
      var rows = sheetToObjects(sheet);

      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];

        // RBAC pembacaan lintas divisi
        if (!allowAll) {
          if (mod.sheet === SHEET_TX.KEGIATAN_DIREKTORAT) {
            if (isStaf) continue; // Staf tidak punya akses modul Kegiatan (§5.10)
            // KADIV → boleh lihat semua entri kegiatan
          } else if (String(r['DivisiID'] || '') !== String(session.divisiId || '')) {
            continue;
          }
        }

        var t = new Date(r['Timestamp']);
        if (isNaN(t.getTime())) continue;
        if (t < range.startDate || t > range.endDate) continue;

        out.push({
          rowId: String(r['RowID'] || ''),
          sheet: mod.sheet,
          sheetLabel: mod.label,
          periode: String(r['Periode'] || ''),
          divisiId: String(r['DivisiID'] || ''),
          divisiNama: L.divisi[String(r['DivisiID'] || '')] || String(r['DivisiID'] || ''),
          submittedBy: String(r['SubmittedBy'] || ''),
          submittedByName: L.user[String(r['SubmittedBy'] || '')] || String(r['SubmittedBy'] || ''),
          timestamp: t.toISOString(),
          status: String(r['Status'] || ''),
          supersedesRowID: String(r['SupersedesRowID'] || ''),
          voidReason: String(r['VoidReason'] || ''),
          voidedBy: String(r['VoidedBy'] || ''),
          voidedByName: L.user[String(r['VoidedBy'] || '')] || String(r['VoidedBy'] || ''),
          voidedAt: r['VoidedAt'] || '',
          ringkasan: mod.ringkas(r, L),
          detail: mod.detail(r, L)
        });
      }
    }

    out.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });

    return { success: true, data: out };
  } catch (e) {
    return { success: false, error: e.message };
  }
}