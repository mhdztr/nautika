/**
 * utils/Lock.js
 * Wrapper LockService — wajib dipakai di semua endpoint tulis (ARCHITECTURE.md §11).
 *
 * Semua service yang melakukan create/update/void wajib membungkus logika tulis
 * dengan withLock() untuk mencegah race condition saat banyak user submit bersamaan.
 */

/**
 * Eksekusi function di dalam script lock.
 * Menunggu maksimal 10 detik; jika tidak berhasil acquire lock, lempar error user-friendly.
 *
 * @param {Function} fn - fungsi yang akan dieksekusi dalam lock
 * @returns {*} return value dari fn
 */
function withLock(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    return fn();
  } catch (e) {
    // Bedakan timeout lock vs error dari fn()
    if (e.message && e.message.indexOf('Could not obtain lock') !== -1) {
      throw new Error('Sistem sedang memproses permintaan lain. Silakan coba beberapa saat lagi.');
    }
    throw e;
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}
