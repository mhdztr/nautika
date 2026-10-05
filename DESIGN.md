# DESIGN.md — Nautika Design System

Menggantikan `design.md` versi lama sepenuhnya. Arah: **SaaS pastel modern, tapi dibersihkan dari kecenderungan AI-slop.** Referensi visual yang disetujui: screenshot Executive Overview (sidebar putih, kartu abu-muda `#F4F7FE`, aksen indigo) — dipakai sebagai baseline, bukan hasil akhir. Keputusan user 22 Sep 2026 mengubah aksen (indigo `#4318FF`) menjadi navy yang sama dengan sidebar (`#2B3674`) — lihat §3.

Nama produk: **Nautika**. Tidak ada subtitle/tagline di bawah nama produk maupun di bawah judul halaman mana pun.

---

## 1. Negative Prompt — Wajib Dihindari

Ini daftar ciri "AI-slop" yang harus aktif dicegah, bukan hanya dihindari secara pasif:

1. **Tidak ada 1-warna-per-stat-card.** Pola lama: tiap kartu KPI punya ikon warna berbeda (pink, orange, cyan, ungu...) di kotak bulat kecil. Ini dihapus total. Ikon (jika dipakai) monokrom netral abu/navy, atau kartu tanpa ikon sama sekali — angka dan label yang jadi fokus.
2. **Tidak ada gradient blob/mesh dekoratif** di background card, header, atau elemen apa pun.
3. **Tidak ada badge/pill warna-warni tanpa makna status.** Badge hanya dipakai untuk status yang benar-benar berarti (mis. "Tidak Siap" merah, "Selesai" hijau) — bukan dekorasi.
4. **Tidak ada shadow berlapis/melayang berlebihan.** Satu level shadow tipis untuk elevasi kartu (lihat §4), titik.
5. **Tidak ada warna acak per kategori di chart.** Semua chart tunduk pada palet terbatas (§3).
6. **Tidak ada subtitle di bawah judul.** Judul halaman berdiri sendiri, langsung diikuti konten (garis pemisah tipis boleh).
7. **Tidak ada copywriting motivational/filler** di UI ("Selamat datang kembali!", dsb) — bahasa lugas, fungsional.
8. **Tidak ada ikon 3D/emoji** di dalam interface produksi.

## 2. Typography

Dipertahankan dari sistem lama (bagian ini sudah benar):
- **Primary (heading, judul, angka metrik utama)**: Plus Jakarta Sans — 600/700/800
- **Secondary (body, tabel, navigasi)**: Poppins — 400/500/600

Tidak memakai font monospace (arahan "Tactical" dari iterasi lama dibuang total).

## 3. Palet Warna — Dibatasi Ketat

### Netral (dominan — porsi terbesar UI)
| Token | Hex | Guna |
|---|---|---|
| `--n-bg-base` | `#F4F7FE` | Kanvas dasar |
| `--n-surface-1` | `#FFFFFF` | Kartu, panel |
| `--n-surface-2` | `#F9FAFB` | Permukaan sekunder |
| `--n-surface-hover` | `#F1F5F9` | Hover state |
| `--n-text-primary` | `#2B3674` | Teks utama |
| `--n-text-secondary` | `#4A5568` | Sub-teks |
| `--n-text-muted` | `#A3AED0` | Label, teks tersier |
| `--n-border-subtle` | `rgba(0,0,0,0.06)` | Garis pemisah tipis |

### Aksen — maksimal 2 warna aktif + 3 warna status semantik
> Keputusan user 22 Sep 2026: warna aksen = **navy yang sama dengan sidebar** agar matching. Semua variasi aksen lain (tints, seri chart) adalah **variasi hue biru itu** (via opacity/tint), bukan hue baru.
| Token | Hex | Guna |
|---|---|---|
| `--n-primary` | `#2B3674` | Aksen brand (navy sidebar) — elemen interaktif, aktif/selected, tombol utama. Dulu `#4318FF` (indigo), diganti atas keputusan user |
| `--n-primary-light` | `#E4E7F2` | Tint navy muda untuk background elemen primary (hover, badge, msg.info). Dulu `#E9E3FF` (lavender) |
| `--n-status-success` | `#10B981` | Tercapai/aman/naik positif |
| `--n-status-warning` | `#F59E0B` | Perlu perhatian/mendekati batas |
| `--n-status-critical` | `#EF4444` | Kritis/tidak siap/bahaya |

**Aturan pemakaian**: warna aksen selain nilai di atas **tidak dipakai** di komponen produksi. Chart multi-series memakai **gradasi/opacity dari navy `#2B3674`** (`rgba(43,54,116,…)`), bukan hue berbeda; status tetap 3 warna semantik. Warna brand masuk tunjangan logo/branding yang menyatu dengan sidebar.

## 4. Shape & Elevation

- Radius: `--n-radius-sm: 12px` (input, ikon kecil), `--n-radius-lg: 16px` (kartu, kontainer chart), `--n-radius-pill: 99px` (badge, avatar)
- Shadow: **satu level saja** — `--n-shadow-card: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)`. Tidak ada shadow kedua untuk hover — hover cukup ganti `--n-surface-hover` atau border, tanpa elevasi tambahan yang berlebihan.
- Border: garis pemisah pakai `--n-border-subtle` tipis, bukan shadow tebal, untuk memisahkan section.

## 5. Negative Space (dipertahankan dari sistem lama — ini sudah benar)

- Padding kartu: `24px`. Padding kontainer layout utama: `32px`.
- Gap antar elemen grid/list: `16px`–`24px`, bukan garis pemisah padat.
- Header halaman: margin-bottom lapang (`28px`) memisahkan judul dari konten data — **tanpa subtitle** (lihat §1 poin 6).

## 5b. Sidebar — Spek Navy Tua (disetujui 22 Sep 2026; aktif sejak Fase 10.5)

> Status dokumen: keputusan user final dan sudah diimplementasikan (Fase 10.5). Setelah revisi 22 Sep 2026, `--n-primary` = `#2B3674` (navy) — sama persis dengan warna rel, sehingga **indikator aktif memakai putih** (navy di atas navy tidak terlihat).

- **Background rel**: `--n-text-primary` (`#2B3674`, navy). Ini netral lama yang dialih-fungsikan sebagai latar rel — bukan warna aksen baru.
- **Brand "Nautika"**: putih `#FFFFFF` (berat 800).
- **Label section**: `rgba(255,255,255,0.45)`.
- **Item nav idle**: teks `rgba(255,255,255,0.78)`; **hover**: putih + background `rgba(255,255,255,0.08)`.
- **Item nav aktif**: **flat full-width** — background `rgba(255,255,255,0.12)` + teks putih + **indikator kiri solid putih (3px)**; berat 600. BUKAN pill (user menolak bentuk pill pada 22 Sep 2026) dan indikator bukan `--n-primary` lagi (kini = warna rel, tak terlihat).
- **Footer**: nama user putih; role `rgba(255,255,255,0.6)`; tombol Keluar border `rgba(255,255,255,0.10)` + teks putih, hover `rgba(255,255,255,0.08)`.
- **Garis pemisah** antar elemen rel: `rgba(255,255,255,0.10)`; scrollbar rel mengikuti.
- **Larangan (§1 tetap berlaku)**: tanpa gradient; tanpa shadow tambahan; tanpa ikon berwarna/emoji; tanpa badge warna-warni; aksen aktif = putih (di atas rel navy). Kontras teks-putih-di-atas-navy ≈ ≥9:1 (aks.-aman).

## 6. Chart Style Guide

Selaras dengan PRD §10 — profesional, bukan dekoratif. Ukuran kualitas utama sebuah dashboard **bukan penampilannya**, tapi seberapa cepat user menemukan ikhtisar datanya: angka kunci, status, dan arah tren. Setiap chart/halaman wajib lulus **five-second rule** — user mampu menyebut *"berapa angkanya, baik/buruk, perlu tindakan atau tidak"* dalam ≤5 detik tanpa penjelasan.

### 6.1 Pilih Chart dari Pertanyaan Data, Bukan dari Kecantikan

Sebelum memilih tipe chart, jawab dulu: *"pertanyaan data apa yang dijawab?"* Lalu pilih encoding yang paling tepat (panjang/posisi 2D diproses preattentively — baca paling akurat; area/luas tidak).

| Kebutuhan Data / Pertanyaan User | Chart Type | Catatan |
|---|---|---|
| Realisasi vs target | Bar / grouped bar | Warna: `--n-primary` untuk realisasi, abu netral untuk target (bukan 2 warna cerah berbeda) |
| Perbandingan antar kategori (ranking) | Bar — horizontal untuk banyak kategori, diurutkan dari nilai terbesar | Sumbu mulai dari 0; jangan pie untuk ini |
| Komposisi dalam total (mis. Reguler vs ABT) | Stacked bar | Gradasi dari `--n-primary` (pekat→pudar), maksimal label jelas per segmen |
| Tren waktu (mingguan/bulanan/YTD) | Line / area chart | Satu series = `--n-primary`; multi-series pembanding pakai opacity berbeda, bukan hue berbeda |
| Pencapaian % terhadap target | Horizontal progress bar | **Bukan gauge melingkar** — dilarang eksplisit |
| Nilai tunggal yang penting | Kartu angka besar + label + konteks (delta, satuan) | Jangan dipaksa jadi chart; gauge menambah noise |
| Proporsi kategori sedikit (≤4) sebagai poin utama | Donut | Hanya jika proporsi memang poin utama, mis. status kesiapan armada |
| Daftar (kapal tidak siap, item pekerjaan, kegiatan) | Tabel | Teks rata kiri, angka rata kanan, total di atas, unit di header. Chart tidak dipaksakan untuk data yang berbentuk daftar |
| Data geospasial WPP | Choropleth (Leaflet) | Gradasi 1 hue dari `--n-primary`, legenda interval wajib tampil |

**Dilarang eksplisit**: gauge/speedometer; radar chart (kecuali justifikasi kuat & disetujui eksplisit oleh product owner); pie/donut untuk kategori >4; **chart 3D** (mendistorsi persepsi nilai); treemap/bubble untuk perbandingan presisi (area bukan encoding preattentive); dual-axis dengan satuan berbeda; scatter tanpa kebutuhan nyata; palet rainbow di satu chart.

### 6.2 Varietas Chart — Boleh Berulang, Tapi Tidak Monoton

- Memakai jenis chart yang sama di banyak kartu **diperbolehkan dan dianjurkan** (satu library, satu bahasa visual — konsistensi lebih penting daripada "bisa macam-macam").
- **Wajib: satu halaman dashboard menampilkan minimal 2 jenis representasi berbeda** (contoh: KPI strip + line/area + bar + tabel). Jangan jadikan seluruh halaman "dinding bar chart" atau "dinding line chart" padahal sebagian data lebih pas memakai representasi lain.
- Variasi bukan tujuan dekoratif — ia muncul konsekuensi alami dari tiap kartu menjawab pertanyaan data yang berbeda. Jika semua data memang satu jenis pertanyaan (mis. semuanya komparasi), satu jenis pun boleh, tapi **wajib ada hierarki besar-kecil**: satu chart utama berukuran besar + pendukung kecil, bukan semua kartu setara.
- Kepadatan: ideal 5–9 visualisasi/chart per halaman dashboard. Jika butuh lebih, pisahkan ke drill-down (progressive disclosure) — jangan ditumpuk semua di satu layar.

### 6.3 Warna Chart — Ikut Kriteria, Bukan Dekorasi

- Hanya token palet `DESIGN.md` §3. Multi-series = gradasi/opacity dari `--n-primary`. Realisasi vs target = `--n-primary` vs abu netral. Status = 3 warna semantik (success/warning/critical).
- **Setiap warna wajib punya makna, dan makna itu konsisten di seluruh platform**: hijau = "tercapai/aman" di satu view tidak boleh jadi "risiko" di view lain. Warna tanpa makna = dilarang.
- **Warna bukan satu-satunya penanda informasi**: series yang diwarnai harus punya direct-label atau bentuk/pattern pendamping (keterbacaan + aksesibilitas WCAG). Jangan hanya andalkan beda hue untuk membedakan series.

### 6.4 Kebersihan Chart (Data-Ink / Anti-Chartjunk)

- Hapus yang tidak membawa data: border chart default, gridline tebal/berat (pakai grid halus atau tanpa grid), efek 3D, latar gradient dekoratif, bingkai ganda.
- Bar selalu mulai dari sumbu 0 — jangan memotong sumbu hanya agar selisih tampak lebih besar.
- **Label langsung pada data lebih utama daripada legenda** (legenda memaksa mata berpindah). Pakai legenda hanya jika series pembanding >2.
- Angka penting tampil sebagai **teks di kartu/summary**, bukan hanya tersembunyi di tooltip. Tooltip cukup untuk detail.
- Sumbu diberi label satuan & periode (mis. "Jumlah kapal", "Periode (mingguan)"). Konsisten satuan dan format angka dalam satu halaman (jangan mencampur Rp / ribu / satuan tanpa alasan).
- Satu series = satu garis tebal (±2px); maksimal 5 series per chart agar tetap terbaca.

### 6.5 Komposisi Halaman Dashboard — Ikhtisar Dulu (Inverted Pyramid)

Susunan wajib setiap halaman dashboard, dari atas ke bawah (memetakan urutan pertanyaan user):
1. **Status (zona atas)**: 3–6 kartu KPI utama — angka terpenting paling besar, kontras tertinggi, di kiri-atas. Setiap angka membawa konteks: delta vs periode lalu, atau label satuan/periode.
2. **Konteks (zona tengah)**: 1–3 chart utama (tren / perbandingan / pencapaian) yang menjelaskan *mengapa* angka di atas seperti itu.
3. **Detail (zona bawah)**: tabel/daftar breakdown yang bisa digali (drill-down) — disembunyikan sampai user memintanya (progressive disclosure).

Filter periode global (PRD §9) wajib memengaruhi ketiga zona sekaligus (angka, chart, tabel). Jangan tampilkan detail granular di atas ikhtisar.

### 6.6 Review Checklist Chart

Sebelum satu dashboard dianggap selesai, cek:
- [ ] Five-second rule: user bisa menyebut angka kunci & arah tren dalam 5 detik?
- [ ] Setiap chart menjawab satu pertanyaan data dengan tipe chart yang tepat?
- [ ] Ada minimal 2 jenis representasi berbeda di halaman (kecuali memang satu jenis paling tepat)?
- [ ] Semua warna bermakna, konsisten lintas view, dan dari palet DESIGN §3?
- [ ] Tidak ada gauge/3D/chartjunk/grid berat/legend yang seharusnya direct-label?
- [ ] Bar mulai dari 0; sumbu berlabel satuan; format angka konsisten?
- [ ] Tabel: teks rata kiri, angka rata kanan, total di atas, unit di header?
- [ ] Warna bukan satu-satunya cara membedakan informasi (ada label/bentuk)?

## 7. Komponen Kunci

- **Kartu KPI**: label kecil huruf kapital `--n-text-muted`, angka besar Plus Jakarta Sans 700/800 `--n-text-primary`, keterangan tambahan kecil di bawah `--n-text-secondary`. Tanpa ikon warna-warni (§1).
- **Badge status**: pill kecil, warna dari 3 status semantik saja, dipakai hanya jika benar-benar merepresentasikan status data (Aktif/Void/Superseded, Siap/Tidak Siap, dsb).
- **Tabel riwayat modul (keputusan 30 Sep 2026)**: satu pola untuk **semua** modul divisi + halaman Riwayat Laporan — dibangun oleh satu renderer (`_histRender`), bukan per-modul. Bentuk kolom: `Periode | …kolom spesifik modul… | Dikirim | Status | Aksi`. Kolom waktu selalu `Dikirim` (bukan "Tanggal") karena di Kegiatan `Tanggal` sudah berarti tanggal kejadian. Baris `SUPERSEDED` diredupkan + badge `DITIMPA`, baris `VOID` diredupkan + badge `DIANULIR` dengan **baris catatan alasan anulir** tepat di bawahnya. Aksi berurutan `Lihat` → `Revisi` → `Anulir`, dalam `.hist-actions`; `Revisi`/`Anulir` hanya saat status `ACTIVE` dan role lolos RBAC, `Anulir` memakai `.btn-danger`. Badge status memakai kelas token (`.aktif`, `.ditimpa`, `.dianulir`, `.siap`, `.tidak-siap`, `.baseline`), bukan hex inline. **Tidak ada tombol lampiran di baris** — lampiran hanya lewat modal `Lihat`. Mini-table ringkasan di halaman Profil Kapal bukan tabel riwayat modul dan tetap read-only.
- **Filter periode (kanan atas)**: satu control kohesif (`.filter-box`) — segmented Bulanan/Rentang + pemisah vertikal + input. Select memakai chevron kustom; date input memakai ikon kalender native (jangan `appearance:none` di keduanya). Konsisten posisinya di semua halaman modul. **Indikator loading**: spinner kecil ring `--n-primary` selalu tampil di samping box filter selama ada `google.script.run` in-flight (sheet apa pun).
- **Pemilihan "jenis"/referensi (keputusan 28 Sep 2026 — Backlog B typeahead DIBATALKAN)**: `Backlog B — Combobox Typeahead` dicabut (dilihat "aneh"). Aturan selektor:
  - Enum daftar pendek (Jenis Amunisi/BBM/Komponen, Kategori AKN, Lokasi/Tahap/Kategori Perawatan, kategori OperasiLaut): **`<select>` biasa** (bukan typeahead), opsi diisi runtime dari sheet `Opsi`, placeholder "(Pilih …)" kosong disediakan, validasi server tetap berjalan.
  - Relasi daftar panjang (Kapal): **search dropdown `.kdl-*`** — tampil sebagai dropdown (field `readonly` + chevron kanan sama dgn `<select>`), klik/buka menampilkan panel kotak cari + daftar scroll, tombol hapus (×) menghapus pilihan dan **me-reset filter** ke daftar penuh. Token disimpan hidden id lama (`_v` tetap dipakai).
- **Input periode form (keputusan 30 Sep 2026)**: di **semua** form pelaporan, periode dipilih lewat **tiga dropdown** `Tahun` / `Bulan` / `Minggu Ke-` dalam grid `1fr 1fr 1fr` — **tidak ada** input teks periode manual di modul mana pun (Tata Usaha terakhir yang masih ketik manual, kini sudah diperbaiki). Opsi diisi client oleh `_opsInitPeriodeUi(prefix)` (tahun ±1, bulan `MONTHS`, minggu 1–5 memakai konvensi `DateUtil`: tanggal 1–7 = W01) dan dirakit jadi `YYYY-MM-WW` oleh `_composePeriode(prefix)` sehingga format tidak mungkin salah ketik. Helper yang sama dipakai seluruh modul (prefix `tu-`, `ops-`, `oud-`, `int-`, `pem-`, `rawk-`, `rawd-`, `rawi-`, `lga-`, `lgb-`, `lgp-`, `akn-`, `akk-`). Hint `*.periode-hint` memakai `.n-form-hint` dan di-update tiap `onchange`. Dropdown belum lengkap → `Periode wajib dipilih.` (submit ditolak client, sama seperti modul lain).
- **Peta**: kontrol legenda di pojok (collapsible), toggle layer (Laut/Udara) sebagai switch sederhana, bukan tombol besar mencolok.
- **Form (kolom sejajar — keputusan 29 Sep 2026)**: setiap kolom input dibungkus `.form-grp` yang menjadi sel grid (baris form = `display:grid` dengan sel `.form-grp`, `align-items` default `stretch` agar semua sel setara tingginya). Agar kotak input **selalu sejajar horizontal** walau label lalu membungkus (1 vs 2 baris) atau sebagian sel memakai catatan di bawah kontrol: `.form-grp` adalah kolom flex ber-anchor-bawah (`justify-content:flex-end`) dengan band `padding-bottom`. Catatan pendek di bawah kontrol (mis. `*-periode-hint`) memakai kelas **`.n-form-hint`** (absolut di dalam band) sehingga tinggi label maupun ada/tidaknya catatan TIDAK menggeser posisi kotak input. Catatan penjelas panjang di sel satu-kolom boleh tetap in-flow.
- **Angka turunan "dihitung sistem" (keputusan 29 Sep 2026)**: rekap jumlah yang dihitung sistem dari daftar per-item (KII/KIA, rumpon, objek SDK, jenis kejadian Intelijen) **tampil sebagai readout stat** — label kecil + angka `--n-primary` tebal **tanpa kotak/border** (`n-derive-val`), TIDAK menyerupai field input. Tidak memakai teks "(dari daftar)" — penjelasan cukup satu baris keterangan di atas daftar. Tetap dalam sel `.form-grp` agar sejajar-bawah dengan input di baris yang sama.
- **Ikon aksi (keputusan 30 Sep 2026)**: ikon untuk **aksi yang berulang dan sering diklik** — hapus baris, hapus lampiran, ubah label opsi, aktif/nonaktif, tambah baris/entri, muat ulang, lihat riwayat, simpan/batal aksi sekunder. Ikon = inline SVG 24×24, `stroke="currentColor"` 1.75 (atau `fill` untuk ikon `play`), `aria-hidden="true" focusable="false"`; satu sumber `_ICO()` + peta label `_ICO_LABEL` di `html/Script_Main.html`, dipasang lewat `_icoDecorate()`. **Wajib** `title` + `aria-label` bahasa Indonesia karena tombolnya icon-only. Ikon TIDAK boleh berwarna-warni, 3D, bergradien, atau emoji (§1).
  - **Ikon + teks (bukan icon-only) untuk tombol berlabel**: dekorator menyisipkan ikon di awal tombol dan **tidak pernah mengganti/membungkus ulang teks**, jadi nama aksi tetap terbaca. Ikon disisipkan sebagai `inline-block` berukuran `em` (bukan mengubah `display` tombol menjadi flex) sehingga **tinggi tombol tidak bergeser**; `.n-has-ico` memakai `white-space:nowrap` agar ikon+teks tidak wrap.
  - **Tetap teks-only**: tab, status badge, segmented filter, badge angka, dan `kdl-clear` (sudah punya SVG background sendiri) — di sana ikon tidak menambah informasi.
  - Varian: `.n-list-del` (baris daftar dinamis — tinggi **ikut** kotak input via `align-self:stretch`, bukan angka px), `.n-iconbtn` (baris form, kotak 45px, dasar sejajar dengan kotak input), `.n-iconbtn-sm` (sel aksi tabel, radius + padding `.btn-sm` supaya tinggi sama dengan tombol teks), `.n-chip-x` (tombol hapus pada chip lampiran, 20px).
  - **Lebar tombol boleh bertambah** — alignment dan keterbacaan lebih penting daripada mempadatkan baris.
  - **Tombol ikon-saja (keputusan 1 Okt 2026 — "coba lagi kok nggak pakai icon")**: kelas `.n-iconbtn-x`, kotak **persegi 28×28px** (`flex:0 0 auto`, `padding:0`, ghost tanpa border, `color:var(--n-text-muted)`, hover → `var(--n-crit)`). Digunakan **hanya** di konteks sempit tempat teks tidak menambah informasi: (a) tombol tutup di header modal & drawer, (b) tombol `Coba lagi` di dalam pesan error yang teksnya sudah menjelaskan kegagalan. **Wajib** `title` + `aria-label`; `aria-label` **dilarang** pada tombol ikon+teks karena akan menimpa label yang terlihat.
  - **Mekanisme dua jalur (penting, karena urutan muat)**: `Script_Main.html` dimuat **setelah** markup statis, sehingga tombol ikon-saja di `Index.html`/`html/views/*.html` **tidak bisa** memanggil `_ico()` langsung (element belum ada saat template dibaca). Karena itu markup statis memakai atribut `data-ico="<nama>"` (+ opsional `data-ico-size`), yang disuntikkan `_icoDecorate()`; tombol yang dirakit dari JS (retry, chip, tombol daftar) boleh tetap memanggil `_ico()` langsung. Kedua jalur itu tetap memakai **satu sumber ikon** (`_ICO`), tidak ada SVG yang disalin-tempel.
  - **Jangan mencongversi tombol berlabel jadi ikon-saja hanya agar ramping** — `Coba lagi` berubah jadi ikon-saja karena teksnya berulang dengan kalimat error; `Muat Ulang`, `Ulangi upload lampiran`, dan `Tutup` di footer modal bukti **tetap ikon + teks** karena teksnya menunjuk konteks. Ikon tidak boleh jadi satu-satunya makna aksi.

- **Popup sukses + loading submit (keputusan 1 Okt 2026)**: setelah form pelaporan atau Master Data tersimpan, isi popup **tidak** langsung hilang kosong — diganti panel konfirmasi sebentar, baru menutup sendiri. Berlaku seragam di 16 popup (14 form laporan + `modal-md-kapal` + `modal-md-kawasan`).
  - **State sukses**: judul `<h2>` popup asli dipertahankan, lalu ikon centang 46px berlatar **solid** `#ECFDF5` (bukan gradient), teks "Berhasil", satu kalimat konfirmasi **khusus per form** (bukan satu teks generik untuk semua popup), dan baris "Menutup otomatis…". Keseluruhan dibungkus `role="status" aria-live="polite"` supaya terbaca screen reader. Judul popup tidak diubah jadi "Berhasil" — judul itu menjelaskan form mana yang sedang diisi, jadi tetap perlu sebagai konteks.
  - **Markup asli dipulihkan**: `innerHTML` popup di-snapshot sebelum diganti (`_FORM_SUCCESS`), dipulihkan saat popup ditutup (`_formRestore()` dipanggil dari `closeModal()`), sehingga form selalu utuh saat dibuka lagi. Timer auto-close dibatalkan saat restore — kalau tidak, popup yang ditutup manual lalu langsung dibuka lagi akan ikut tertutup timer lama.
  - **Upload gagal tidak boleh menampilkan sukses**: `ok === false` (lampiran gagal terunggah) tetap memakai perilaku lama — popup ditutup + pesan inline "Baris sudah tersimpan; lampiran yang belum ter-upload akan dicoba lagi". Tidak ada panel "Berhasil" pada kasus ini.
  - **Popup revisi/anulir dikecualikan** — keduanya bukan form pelaporan (satu field / konfirmasi) dan sudah punya pesan inline + tombol "Memproses…".
  - **Loading dua tahap, keduanya terlihat**: teks "Memproses…" di dalam tombol **tidak cukup** (font 13px di dalam popup 400px nyaris tak terlihat). `_setLoading()` menampilkan `.form-loading-overlay` (spinner 22px + teks status, `rgba(255,255,255,0.72)` + blur 1px) di atas area form, dengan status berbeda per tahap: **"Menyimpan…"** saat simpan ke server, **"Mengunggah lampiran…"** selama unggah lampiran. Popup tanpa area scroll form jatuh ke fallback `.n-modal` (karena itu `.n-modal` punya `position:relative`).
  - **Spinner**: satu keyframe `_spin` dipakai bersama oleh `n-spin-sm`, `n-spin-lg`, dan `filter-busy` — jangan menambah keyframe kedua dengan nama lain untuk spinner yang sama.

## 8. Nada Bahasa UI

Lugas, fungsional, bahasa Indonesia formal-teknis (sesuai konteks kedinasan) — tanpa jargon marketing, tanpa emoji, tanpa basa-basi motivational.
