/**
 * services/PerawatanService.js
 * Modul Perawatan Armada Pengawasan (Fase 9) — 3 sub-struktur independen:
 *   KESIAPAN  → TX_Perawatan_Kesiapan  (status siap/tidak siap per kapal)
 *   DOCKING   → TX_Perawatan_Docking   (progres docking per kapal)
 *   ITEM      → TX_Perawatan_Item      (item pekerjaan pemeliharaan, many-to-one opsional ke Docking)
 *
 * Fungsi publik (google.script.run):
 *   perawatan_getOptions(token)
 *   perawatan_getKPI(token, filter)
 *   perawatan_getKesiapan(token, filter) / perawatan_getDocking / perawatan_getItem
 *   perawatan_submitKesiapan(token, params) / perawatan_submitDocking / perawatan_submitItem
 *   perawatan_revisiKesiapan(token, params) / perawatan_revisiDocking / perawatan_revisiItem
 *   perawatan_anulir(token, {jenis, targetRowId, voidReason})
 *   perawatan_getTren(token, filter)
 *
 * RBAC:
 *   Baca   : semua APPROVED (pimpinan cross-divisi; KADIV/STAF lihat modulnya sendiri)
 *   Tulis  : SUPERADMIN + KADIV(DIV-RAWAT) + STAF(DIV-RAWAT)
 *   Anulir : SUPERADMIN + DIREKTUR + KADIV(DIV-RAWAT)
 *
 * Model submission (keputusan user, Fase 9): TIGA form/tab independen.
 * Satu submit = satu baris di sheet-nya; tidak ada sheet header submission.
 * Agregasi dashboard menggabungkan ketiga sheet lewat `Periode`.
 *
 * Validasi blocking (keputusan user): total kapal siap + tidak siap tidak boleh
 * melebihi total armada aktif di Master Kapal (PRD §5.7).
 */

var _RAWAT_DIVISI_ID = 'DIV-RAWAT';

// ── META JENIS (runtime — Constants.js dimuat setelah services/) ──

function _rawatJenisMeta(jenis) {
  var map = {
    KESIAPAN: { sheet: SHEET_TX.PERAWATAN_KESIAPAN, prefix: 'RKS', label: 'Kesiapan Kapal' },
    DOCKING:  { sheet: SHEET_TX.PERAWATAN_DOCKING,  prefix: 'RDK', label: 'Docking' },
    ITEM:     { sheet: SHEET_TX.PERAWATAN_ITEM,     prefix: 'RIT', label: 'Item Pekerjaan' }
  };
  var m = map[jenis];
  if (!m) throw new Error('Jenis Perawatan tidak dikenal: ' + jenis);
  return m;
}

// ── RBAC ──────────────────────────────────────────────────

function _rawatRequireSession(token) {
  var session = _getSession(token);
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau belum disetujui.');
  }
  return session;
}

function _rawatAssertRead(session) {
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Akun belum aktif.');
  }
}

function _rawatAssertWrite(session) {
  assertScope(session, [ROLE.SUPERADMIN, ROLE.KADIV, ROLE.STAF], _RAWAT_DIVISI_ID);
}

function _rawatAssertAnulir(session) {
  if (!session || session.status !== USER_STATUS.APPROVED) {
    throw new Error('UNAUTHORIZED: Akun belum aktif.');
  }
  if (session.role === ROLE.SUPERADMIN || session.role === ROLE.DIREKTUR) return;
  if (session.role === ROLE.KADIV && session.divisiId === _RAWAT_DIVISI_ID) return;
  throw new Error('FORBIDDEN: Anda tidak memiliki izin menganulir laporan Perawatan.');
}

// ── OPTIONS (dropdown relasional) ─────────────────────────

function perawatan_getOptions(token) {
  try {
    var session = _rawatRequireSession(token);
    _rawatAssertRead(session);

    var kmap = _rawatKapalMap();
    var kapal = Object.keys(kmap).map(function (id) {
      return {
        kapalId:     id,
        nama:        kmap[id].nama,
        kelas:       kmap[id].kelas,
        homebaseUpt: kmap[id].homebaseUpt,
        aktif:       kmap[id].aktif
      };
    }).sort(function (a, b) { return (a.nama || '').localeCompare(b.nama || ''); });

    // Opsi docking = progres docking ACTIVE terbaru per kapal
    var dRows = sheetToObjects(openTransaksiSheet(SHEET_TX.PERAWATAN_DOCKING));
    var latest = _rawatLatestPerKapal(dRows);
    var docking = Object.keys(latest).map(function (kapalId) {
      var r = latest[kapalId];
      return {
        rowId: String(r['RowID']),
        label: (kmap[kapalId] ? kmap[kapalId].nama : kapalId) + ' — ' + String(r['Tahap'] || '')
      };
    });

    return { success: true, data: { kapal: kapal, docking: docking } };
  } catch (e) {
    Logger.log('[perawatan_getOptions] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── KPI ───────────────────────────────────────────────────

function perawatan_getKPI(token, filter) {
  try {
    var session = _rawatRequireSession(token);
    _rawatAssertRead(session);

    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    var kmap  = _rawatKapalMap();
    var totalArmada = _rawatTotalArmadaAktif();
    var dmap  = _rawatDockingMap();

    // ── Kesiapan ──
    var kRows = _rawatActiveInRange(SHEET_TX.PERAWATAN_KESIAPAN, range);
    var kLatest = _rawatLatestPerKapal(kRows);
    var siap = 0, tidakSiap = 0, tidakSiapList = [];
    Object.keys(kLatest).forEach(function (kapalId) {
      var r = kLatest[kapalId];
      if (_rawatBool(r['StatusSiap'])) {
        siap++;
      } else {
        tidakSiap++;
        tidakSiapList.push({
          kapalId:  kapalId,
          kapalNama: _rawatKapalNama(kmap, kapalId),
          penyebab:  String(r['Penyebab'] || ''),
          periode:   String(r['Periode'] || '')
        });
      }
    });
    var pctSiap = totalArmada > 0 ? Math.round((siap / totalArmada) * 1000) / 10 : 0;

    // ── Docking ──
    var dRows = _rawatActiveInRange(SHEET_TX.PERAWATAN_DOCKING, range);
    var dLatest = _rawatLatestPerKapal(dRows);
    var byTahap = {}; RAWAT_TAHAP.forEach(function (t) { byTahap[t] = 0; });
    var dockingList = [], totalNilaiKontrak = 0;
    Object.keys(dLatest).forEach(function (kapalId) {
      var r = dLatest[kapalId];
      var t = String(r['Tahap'] || '');
      if (byTahap[t] === undefined) byTahap[t] = 0;
      byTahap[t]++;
      var nilai = _rawatNum(r['NilaiKontrak']);
      totalNilaiKontrak += nilai;
      dockingList.push({
        kapalId:      kapalId,
        kapalNama:    _rawatKapalNama(kmap, kapalId),
        lokasi:       String(r['Lokasi'] || ''),
        tahap:        t,
        nilaiKontrak: nilai,
        kontraktor:   String(r['Kontraktor'] || ''),
        periode:      String(r['Periode'] || '')
      });
    });

    // ── Item Pekerjaan ──
    var iRows = _rawatActiveInRange(SHEET_TX.PERAWATAN_ITEM, range);
    var byKategori = {}; RAWAT_KATEGORI.forEach(function (k) { byKategori[k] = { count: 0, nilai: 0 }; });
    var itemList = [], totalItemNilai = 0;
    iRows.forEach(function (r) {
      var kat = String(r['Kategori'] || '');
      if (!byKategori[kat]) byKategori[kat] = { count: 0, nilai: 0 };
      var nilai = _rawatNum(r['Nilai']);
      byKategori[kat].count++;
      byKategori[kat].nilai += nilai;
      totalItemNilai += nilai;
      var dock = String(r['DockingRowID'] || '');
      itemList.push({
        rowId:         String(r['RowID']),
        namaPekerjaan: String(r['NamaPekerjaan'] || ''),
        kategori:      kat,
        nilai:         nilai,
        dockingRowId:  dock,
        dockingLabel:  dock && dmap[dock] ? dmap[dock] : '',
        periode:       String(r['Periode'] || '')
      });
    });

    return {
      success: true,
      data: {
        kesiapan: {
          totalArmada: totalArmada,
          siap:        siap,
          tidakSiap:   tidakSiap,
          pctSiap:     pctSiap,
          tidakSiapList: tidakSiapList
        },
        docking: {
          total:         Object.keys(dLatest).length,
          byTahap:       byTahap,
          totalNilaiKontrak: totalNilaiKontrak,
          list:          dockingList
        },
        item: {
          total:        iRows.length,
          byKategori:   byKategori,
          totalNilai:   totalItemNilai,
          list:         itemList
        }
      }
    };
  } catch (e) {
    Logger.log('[perawatan_getKPI] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── HISTORY ───────────────────────────────────────────────

function perawatan_getKesiapan(token, filter) { return _rawatHistory('KESIAPAN', token, filter); }
function perawatan_getDocking(token, filter)  { return _rawatHistory('DOCKING',  token, filter); }
function perawatan_getItem(token, filter)     { return _rawatHistory('ITEM',     token, filter); }

function _rawatHistory(jenis, token, filter) {
  try {
    var session = _rawatRequireSession(token);
    _rawatAssertRead(session);
    var meta = _rawatJenisMeta(jenis);

    var range = filterToDateRange(filter || { mode: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    var rows  = sheetToObjects(openTransaksiSheet(meta.sheet));
    var kmap  = _rawatKapalMap();
    var dmap  = (jenis === 'ITEM') ? _rawatDockingMap() : null;

    var filtered = rows.filter(function (r) { return isInRange(new Date(r['Timestamp']), range); });
    filtered.sort(function (a, b) { return new Date(b['Timestamp']) - new Date(a['Timestamp']); });

    var data = filtered.map(function (r) {
      var base = _rawatStd(r);
      if (jenis === 'KESIAPAN') {
        base.kapalId   = String(r['KapalID'] || '');
        base.kapalNama = _rawatKapalNama(kmap, r['KapalID']);
        base.statusSiap = _rawatBool(r['StatusSiap']);
        base.penyebab   = String(r['Penyebab'] || '');
      } else if (jenis === 'DOCKING') {
        base.kapalId      = String(r['KapalID'] || '');
        base.kapalNama    = _rawatKapalNama(kmap, r['KapalID']);
        base.lokasi       = String(r['Lokasi'] || '');
        base.tahap        = String(r['Tahap'] || '');
        base.nilaiKontrak = _rawatNum(r['NilaiKontrak']);
        base.kontraktor   = String(r['Kontraktor'] || '');
      } else {
        var dock = String(r['DockingRowID'] || '');
        base.dockingRowId  = dock;
        base.dockingLabel  = dock && dmap[dock] ? dmap[dock] : '';
        base.namaPekerjaan = String(r['NamaPekerjaan'] || '');
        base.kategori      = String(r['Kategori'] || '');
        base.nilai         = _rawatNum(r['Nilai']);
      }
      return base;
    });

    return { success: true, data: data };
  } catch (e) {
    Logger.log('[_rawatHistory:' + jenis + '] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── SUBMIT ────────────────────────────────────────────────

function perawatan_submitKesiapan(token, params) { return _rawatSubmit('KESIAPAN', token, params); }
function perawatan_submitDocking(token, params)  { return _rawatSubmit('DOCKING',  token, params); }
function perawatan_submitItem(token, params)     { return _rawatSubmit('ITEM',     token, params); }

function _rawatSubmit(jenis, token, params) {
  try {
    return withLock(function () {
      var session = _rawatRequireSession(token);
      _rawatAssertWrite(session);
      var meta = _rawatJenisMeta(jenis);
      var p = params || {};

      var periode = String(p.periode || getCurrentPeriode()).trim();
      if (!parsePeriode(periode)) {
        return { success: false, error: 'Format Periode tidak valid. Gunakan YYYY-MM-WW.' };
      }

      var sheet = openTransaksiSheet(meta.sheet);
      var rows  = sheetToObjects(sheet);
      var built = _rawatBuildPayload(jenis, p, rows, periode, null);
      if (built.error) return { success: false, error: built.error };

      var rowId = meta.prefix + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
      var row = {};
      row['RowID']           = rowId;
      row['DivisiID']        = _RAWAT_DIVISI_ID;
      row['Periode']         = periode;
      row['SubmittedBy']     = session.userId;
      row['Timestamp']       = new Date();
      row['Status']          = ROW_STATUS.ACTIVE;
      row['SupersedesRowID'] = '';
      row['VoidReason']      = '';
      row['VoidedBy']        = '';
      row['VoidedAt']        = '';
      Object.keys(built.payload).forEach(function (k) { row[k] = built.payload[k]; });

      appendRowData(sheet, row);
      _rawatAuditLog(session.userId, 'CREATE', meta.sheet, rowId, 'Input ' + meta.label + ' periode ' + periode);

      return { success: true, data: { rowId: rowId, message: 'Laporan ' + meta.label + ' berhasil disimpan.' } };
    });
  } catch (e) {
    Logger.log('[_rawatSubmit:' + jenis + '] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── REVISI ────────────────────────────────────────────────

function perawatan_revisiKesiapan(token, params) { return _rawatRevisi('KESIAPAN', token, params); }
function perawatan_revisiDocking(token, params)  { return _rawatRevisi('DOCKING',  token, params); }
function perawatan_revisiItem(token, params)     { return _rawatRevisi('ITEM',     token, params); }

function _rawatRevisi(jenis, token, params) {
  try {
    return withLock(function () {
      var session = _rawatRequireSession(token);
      _rawatAssertWrite(session);
      var meta = _rawatJenisMeta(jenis);
      var p = params || {};

      var targetRowId  = String(p.targetRowId || '').trim();
      var alasanRevisi = String(p.alasanRevisi || '').trim();
      if (!targetRowId)  return { success: false, error: 'targetRowId wajib diisi.' };
      if (!alasanRevisi) return { success: false, error: 'Alasan revisi wajib diisi.' };

      var sheet = openTransaksiSheet(meta.sheet);
      var old   = findRowById(sheet, targetRowId);
      if (!old || String(old.obj['Status']) !== ROW_STATUS.ACTIVE) {
        return { success: false, error: 'Baris tidak ditemukan atau bukan status ACTIVE.' };
      }

      var periode = String(old.obj['Periode'] || '');
      var rows = sheetToObjects(sheet);
      var built = _rawatBuildPayload(jenis, p, rows, periode, old.obj);
      if (built.error) return { success: false, error: built.error };

      var rowId = meta.prefix + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
      var row = {};
      row['RowID']           = rowId;
      row['DivisiID']        = _RAWAT_DIVISI_ID;
      row['Periode']         = periode;
      row['SubmittedBy']     = session.userId;
      row['Timestamp']       = new Date();
      row['Status']          = ROW_STATUS.ACTIVE;
      row['SupersedesRowID'] = targetRowId;
      row['VoidReason']      = '';
      row['VoidedBy']        = '';
      row['VoidedAt']        = '';
      Object.keys(built.payload).forEach(function (k) { row[k] = built.payload[k]; });

      appendRowData(sheet, row);
      updateRowCells(sheet, old.rowIndex, { 'Status': ROW_STATUS.SUPERSEDED });
      _rawatAuditLog(session.userId, 'UPDATE', meta.sheet, rowId, 'Revisi dari ' + targetRowId + ': ' + alasanRevisi);

      return { success: true, data: { rowId: rowId, message: 'Revisi ' + meta.label + ' berhasil disimpan.' } };
    });
  } catch (e) {
    Logger.log('[_rawatRevisi:' + jenis + '] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── ANULIR ────────────────────────────────────────────────

function perawatan_anulir(token, params) {
  try {
    return withLock(function () {
      var session = _rawatRequireSession(token);
      _rawatAssertAnulir(session);
      var p = params || {};

      var jenis       = String(p.jenis || '').toUpperCase();
      var meta        = _rawatJenisMeta(jenis); // melempar jika jenis invalid
      var targetRowId = String(p.targetRowId || '').trim();
      var voidReason  = String(p.voidReason || '').trim();
      if (!targetRowId) return { success: false, error: 'targetRowId wajib diisi.' };
      if (!voidReason) {
        return {
          success: false,
          error: 'Komentar anulir wajib diisi. Staf perlu mengetahui apa yang perlu diperbaiki sebelum mengunggah laporan baru.'
        };
      }

      var sheet  = openTransaksiSheet(meta.sheet);
      var target = findRowById(sheet, targetRowId);
      if (!target) return { success: false, error: 'Baris tidak ditemukan.' };
      if (String(target.obj['Status']) === ROW_STATUS.VOID) {
        return { success: false, error: 'Baris sudah dalam status VOID.' };
      }
      if (String(target.obj['Status']) === ROW_STATUS.SUPERSEDED) {
        return { success: false, error: 'Baris berstatus SUPERSEDED tidak dapat dianulir langsung — anulir baris ACTIVE-nya.' };
      }

      updateRowCells(sheet, target.rowIndex, {
        'Status':     ROW_STATUS.VOID,
        'VoidReason': voidReason,
        'VoidedBy':   session.userId,
        'VoidedAt':   new Date()
      });
      _rawatAuditLog(session.userId, 'VOID', meta.sheet, targetRowId, voidReason);

      var publisherId = String(target.obj['SubmittedBy'] || '');
      if (publisherId && publisherId !== session.userId) {
        _rawatNotifyVoid(publisherId, meta.label, String(target.obj['Periode'] || ''), voidReason);
      }

      return {
        success: true,
        data: { message: 'Laporan ' + meta.label + ' berhasil dianulir. Komentar terlihat oleh seluruh anggota divisi.', periode: String(target.obj['Periode'] || '') }
      };
    });
  } catch (e) {
    Logger.log('[perawatan_anulir] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── TREN BULANAN (chart) ──────────────────────────────────

function perawatan_getTren(token, filter) {
  try {
    var session = _rawatRequireSession(token);
    _rawatAssertRead(session);

    var months = utils_getTrendMonths(filter);
    var idx = {};
    months.forEach(function (m, i) { idx[m] = i; });

    var siap      = _rawatZeroArr(months.length);
    var tidakSiap = _rawatZeroArr(months.length);
    var dockingSelesai = _rawatZeroArr(months.length);
    var itemNilai = _rawatZeroArr(months.length);

    // Kesiapan: latest per kapal per bulan → hitung siap/tidak siap
    var kRows = sheetToObjects(openTransaksiSheet(SHEET_TX.PERAWATAN_KESIAPAN))
      .filter(function (r) { return String(r['Status']) === ROW_STATUS.ACTIVE; });
    var kByMonth = {};
    kRows.forEach(function (r) {
      var mm = String(r['Periode'] || '').substring(0, 7);
      if (idx[mm] === undefined) return;
      if (!kByMonth[mm]) kByMonth[mm] = {};
      var kid = String(r['KapalID'] || '');
      var prev = kByMonth[mm][kid];
      if (!prev || new Date(r['Timestamp']) > new Date(prev['Timestamp'])) kByMonth[mm][kid] = r;
    });
    Object.keys(kByMonth).forEach(function (mm) {
      var i = idx[mm];
      Object.keys(kByMonth[mm]).forEach(function (kid) {
        if (_rawatBool(kByMonth[mm][kid]['StatusSiap'])) siap[i]++; else tidakSiap[i]++;
      });
    });

    // Docking selesai per bulan (jumlah baris ACTIVE ber-Tahap SELESAI)
    sheetToObjects(openTransaksiSheet(SHEET_TX.PERAWATAN_DOCKING)).forEach(function (r) {
      if (String(r['Status']) !== ROW_STATUS.ACTIVE) return;
      if (String(r['Tahap']) !== 'SELESAI') return;
      var mm = String(r['Periode'] || '').substring(0, 7);
      if (idx[mm] === undefined) return;
      dockingSelesai[idx[mm]]++;
    });

    // Nilai item pekerjaan per bulan
    sheetToObjects(openTransaksiSheet(SHEET_TX.PERAWATAN_ITEM)).forEach(function (r) {
      if (String(r['Status']) !== ROW_STATUS.ACTIVE) return;
      var mm = String(r['Periode'] || '').substring(0, 7);
      if (idx[mm] === undefined) return;
      itemNilai[idx[mm]] += _rawatNum(r['Nilai']);
    });

    return {
      success: true,
      data: {
        months:         months,
        siap:           siap,
        tidakSiap:      tidakSiap,
        dockingSelesai: dockingSelesai,
        itemNilai:      itemNilai
      }
    };
  } catch (e) {
    Logger.log('[perawatan_getTren] ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── BUILD PAYLOAD + VALIDASI (dipakai submit & revisi) ────

function _rawatBuildPayload(jenis, p, rows, periode, oldRow) {
  var kmap = _rawatKapalMap();
  var isRevision = !!oldRow;

  if (jenis === 'KESIAPAN') {
    var kapalId = isRevision ? String(oldRow['KapalID'] || '') : String(p.kapalId || '').trim();
    if (!kapalId) return { error: 'Kapal wajib dipilih.' };
    if (!kmap[kapalId]) return { error: 'Kapal tidak terdaftar di Master Data.' };

    var statusSiap = _rawatBool(p.statusSiap);
    var penyebab   = String(p.penyebab || '').trim();
    if (!statusSiap && !penyebab) return { error: 'Penyebab wajib diisi untuk kapal berstatus tidak siap.' };

    if (!isRevision) {
      var dup = rows.some(function (r) {
        return String(r['Status']) === ROW_STATUS.ACTIVE &&
               String(r['Periode']) === periode &&
               String(r['KapalID']) === kapalId;
      });
      if (dup) return { error: 'Status kesiapan kapal ini sudah ada untuk periode ' + periode + '. Gunakan Revisi.' };

      // Validasi blocking: total kapal dilaporkan tidak boleh melebihi armada aktif
      var activeKapal = {};
      rows.forEach(function (r) {
        if (String(r['Status']) === ROW_STATUS.ACTIVE && String(r['Periode']) === periode) {
          activeKapal[String(r['KapalID'])] = true;
        }
      });
      activeKapal[kapalId] = true;
      var totalArmada = _rawatTotalArmadaAktif();
      var jml = Object.keys(activeKapal).length;
      if (jml > totalArmada) {
        return { error: 'Total kapal siap + tidak siap (' + jml + ') melebihi total armada aktif (' + totalArmada + '). Periksa Master Kapal atau pilih periode lain.' };
      }
    }

    return { payload: { 'KapalID': kapalId, 'StatusSiap': statusSiap, 'Penyebab': statusSiap ? '' : penyebab } };
  }

  if (jenis === 'DOCKING') {
    var dKapalId = isRevision ? String(oldRow['KapalID'] || '') : String(p.kapalId || '').trim();
    if (!dKapalId) return { error: 'Kapal wajib dipilih.' };
    if (!kmap[dKapalId]) return { error: 'Kapal tidak terdaftar di Master Data.' };

    var lokasi = String(p.lokasi || '').toUpperCase();
    if (RAWAT_LOKASI.indexOf(lokasi) === -1) return { error: 'Lokasi docking tidak valid (PUSAT/UPT).' };
    var tahap = String(p.tahap || '').toUpperCase();
    if (RAWAT_TAHAP.indexOf(tahap) === -1) return { error: 'Tahap docking tidak valid.' };
    var nilaiKontrak = _rawatNum(p.nilaiKontrak);
    if (nilaiKontrak < 0) return { error: 'Nilai kontrak tidak boleh negatif.' };
    var kontraktor = String(p.kontraktor || '').trim();

    if (!isRevision) {
      var dupD = rows.some(function (r) {
        return String(r['Status']) === ROW_STATUS.ACTIVE &&
               String(r['Periode']) === periode &&
               String(r['KapalID']) === dKapalId;
      });
      if (dupD) return { error: 'Progres docking kapal ini sudah ada untuk periode ' + periode + '. Gunakan Revisi.' };
    }

    return { payload: { 'KapalID': dKapalId, 'Lokasi': lokasi, 'Tahap': tahap, 'NilaiKontrak': nilaiKontrak, 'Kontraktor': kontraktor } };
  }

  if (jenis === 'ITEM') {
    var nama = String(p.namaPekerjaan || '').trim();
    if (!nama) return { error: 'Nama pekerjaan wajib diisi.' };
    var kategori = String(p.kategori || '').toUpperCase();
    if (RAWAT_KATEGORI.indexOf(kategori) === -1) return { error: 'Kategori pekerjaan tidak valid.' };
    var nilai = _rawatNum(p.nilai);
    if (nilai < 0) return { error: 'Nilai pekerjaan tidak boleh negatif.' };

    var dockingRowId = String(p.dockingRowId || '').trim();
    if (dockingRowId) {
      var dSheet = openTransaksiSheet(SHEET_TX.PERAWATAN_DOCKING);
      var dFound = findRowById(dSheet, dockingRowId);
      if (!dFound || String(dFound.obj['Status']) === ROW_STATUS.VOID) {
        return { error: 'Baris docking terkait tidak ditemukan.' };
      }
    }

    return { payload: { 'DockingRowID': dockingRowId, 'NamaPekerjaan': nama, 'Kategori': kategori, 'Nilai': nilai } };
  }

  return { error: 'Jenis Perawatan tidak dikenal.' };
}

// ── HELPERS ───────────────────────────────────────────────

function _rawatStd(r) {
  return {
    rowId:           String(r['RowID'] || ''),
    periode:         String(r['Periode'] || ''),
    submittedBy:     String(r['SubmittedBy'] || ''),
    timestamp:       r['Timestamp'] ? new Date(r['Timestamp']).toISOString() : null,
    status:          String(r['Status'] || ''),
    supersedesRowId: String(r['SupersedesRowID'] || ''),
    voidReason:      String(r['VoidReason'] || ''),
    voidedBy:        String(r['VoidedBy'] || ''),
    voidedAt:        r['VoidedAt'] ? new Date(r['VoidedAt']).toISOString() : null
  };
}

function _rawatKapalMap() {
  var map = {};
  sheetToObjects(openMasterSheet(SHEET_MASTER.KAPAL)).forEach(function (r) {
    var id = String(r['KapalID'] || '');
    if (!id) return;
    map[id] = {
      nama:        String(r['Nama'] || ''),
      kelas:       String(r['Kelas'] || ''),
      homebaseUpt: String(r['Homebase_UPT'] || ''),
      aktif:       _rawatBool(r['StatusAktif'])
    };
  });
  return map;
}

function _rawatTotalArmadaAktif() {
  var n = 0;
  var kmap = _rawatKapalMap();
  Object.keys(kmap).forEach(function (id) { if (kmap[id].aktif) n++; });
  return n;
}

function _rawatKapalNama(kmap, kapalId) {
  var id = String(kapalId || '');
  return kmap[id] ? (kmap[id].nama || id) : id;
}

/** Map RowID docking → label kapal (untuk kolom item). */
function _rawatDockingMap() {
  var map = {};
  var kmap = _rawatKapalMap();
  sheetToObjects(openTransaksiSheet(SHEET_TX.PERAWATAN_DOCKING)).forEach(function (r) {
    var rid = String(r['RowID'] || '');
    if (!rid) return;
    map[rid] = _rawatKapalNama(kmap, r['KapalID']);
  });
  return map;
}

function _rawatActiveInRange(sheetName, range) {
  return sheetToObjects(openTransaksiSheet(sheetName)).filter(function (r) {
    return String(r['Status']) === ROW_STATUS.ACTIVE && isInRange(new Date(r['Timestamp']), range);
  });
}

/** Baris ACTIVE terbaru per KapalID (by Timestamp). */
function _rawatLatestPerKapal(rows) {
  var latest = {};
  rows.forEach(function (r) {
    if (String(r['Status']) !== ROW_STATUS.ACTIVE) return;
    var id = String(r['KapalID'] || '');
    if (!id) return;
    var prev = latest[id];
    if (!prev || new Date(r['Timestamp']) > new Date(prev['Timestamp'])) latest[id] = r;
  });
  return latest;
}

function _rawatZeroArr(n) {
  var a = [];
  for (var i = 0; i < n; i++) a.push(0);
  return a;
}

function _rawatNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  var n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function _rawatBool(v) {
  return v === true || v === 1 ||
         String(v) === 'true' || String(v) === 'TRUE' || String(v) === '1';
}

function _rawatAuditLog(userId, aksi, sheetTarget, rowId, alasan) {
  try {
    appendRowData(openLogSheet(SHEET_LOG.AUDIT_LOG), {
      'LogID':       'LOG-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
      'UserID':      userId,
      'Aksi':        aksi,
      'SheetTarget': sheetTarget,
      'RowIDTarget': rowId,
      'Alasan':      alasan,
      'Timestamp':   new Date()
    });
  } catch (e) { Logger.log('[_rawatAuditLog] ' + e.message); }
}

function _rawatNotifyVoid(toUserId, label, periode, voidReason) {
  try {
    appendRowData(openLogSheet(SHEET_LOG.NOTIFICATIONS), {
      'NotifID':  'NTF-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(),
      'UserID':   toUserId,
      'Jenis':    'DATA_VOIDED',
      'Pesan':    'Laporan Perawatan (' + label + ') periode ' + periode + ' telah dianulir. ' +
                  'Alasan: ' + voidReason + ' — Segera buat laporan baru setelah perbaikan.',
      'IsRead':   false,
      'CreatedAt': new Date()
    });
  } catch (e) { Logger.log('[_rawatNotifyVoid] ' + e.message); }
}
