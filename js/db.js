// Local storage for catches and photos, using IndexedDB in the browser.
// Everything stays on this phone. Nothing is uploaded anywhere.

const DB_NAME = "creeked-up";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("catches")) db.createObjectStore("catches", { keyPath: "id" });
      if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result && "result" in result ? result.result : result);
    t.onerror = () => reject(t.error);
  });
}

const Store = {
  allCatches: () => tx("catches", "readonly", (s) => s.getAll()),
  putCatch: (c) => tx("catches", "readwrite", (s) => s.put(c)),
  deleteCatch: async (id) => {
    await tx("catches", "readwrite", (s) => s.delete(id));
    await tx("photos", "readwrite", (s) => s.delete(id));
  },
  getPhoto: (id) => tx("photos", "readonly", (s) => s.get(id)),
  putPhoto: (id, blob) => tx("photos", "readwrite", (s) => s.put(blob, id)),
  clearAll: async () => {
    await tx("catches", "readwrite", (s) => s.clear());
    await tx("photos", "readwrite", (s) => s.clear());
  },
};
