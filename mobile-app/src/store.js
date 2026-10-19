const DB_NAME = 'guide-voyager-local';
const DB_VERSION = 1;
const STORES = ['settings', 'favorites', 'itineraries', 'feedback', 'events', 'content'];
let nativeConnection;

async function openNativeDatabase() {
  if (!window.Capacitor?.isNativePlatform?.()) return null;
  if (!nativeConnection) {
    nativeConnection = (async () => {
      const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
      const sqlite = new SQLiteConnection(CapacitorSQLite);
      const dbName = 'guide_voyager';
      const existing = await sqlite.isConnection(dbName, false);
      const db = existing.result
        ? await sqlite.retrieveConnection(dbName, false)
        : await sqlite.createConnection(dbName, false, 'no-encryption', 1, false);
      await db.open();
      for (const table of STORES) await db.execute(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
      return db;
    })().catch(error => { nativeConnection = null; console.warn('SQLite unavailable; using browser storage:', error); return null; });
  }
  return nativeConnection;
}
function openBrowserDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('Local storage is unavailable'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => { const db = request.result; for (const name of STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function assertStore(store) { if (!STORES.includes(store)) throw new Error('Unknown local store'); }
export async function all(store) {
  assertStore(store); const native = await openNativeDatabase();
  if (native) { const result = await native.query(`SELECT data FROM ${store}`); return (result.values || []).map(row => JSON.parse(row.data)); }
  const db = await openBrowserDatabase();
  return new Promise((resolve, reject) => { const request = db.transaction(store, 'readonly').objectStore(store).getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error); });
}
export async function put(store, value) {
  assertStore(store); const native = await openNativeDatabase();
  if (native) { await native.run(`INSERT OR REPLACE INTO ${store} (id,data) VALUES (?,?)`, [String(value.id), JSON.stringify(value)]); return value; }
  const db = await openBrowserDatabase();
  return new Promise((resolve, reject) => { const request = db.transaction(store, 'readwrite').objectStore(store).put(value); request.onsuccess = () => resolve(value); request.onerror = () => reject(request.error); });
}
export async function remove(store, id) {
  assertStore(store); const native = await openNativeDatabase();
  if (native) { await native.run(`DELETE FROM ${store} WHERE id=?`, [String(id)]); return; }
  const db = await openBrowserDatabase();
  return new Promise((resolve, reject) => { const request = db.transaction(store, 'readwrite').objectStore(store).delete(id); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
}
export async function get(store, id) {
  assertStore(store); const native = await openNativeDatabase();
  if (native) { const result = await native.query(`SELECT data FROM ${store} WHERE id=?`, [String(id)]); return result.values?.[0] ? JSON.parse(result.values[0].data) : null; }
  const db = await openBrowserDatabase();
  return new Promise((resolve, reject) => { const request = db.transaction(store, 'readonly').objectStore(store).get(id); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); });
}
