const DB_NAME = 'chess_trainer_fs';
const STORE = 'handles';
const KEY = 'dataFile';

let fileHandle = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(handle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(handle, KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Returns 'connected' | 'needs-permission' | 'disconnected'
export async function initStorage() {
  try {
    const stored = await dbGet();
    if (!stored) return 'disconnected';
    fileHandle = stored;
    const perm = await stored.queryPermission({ mode: 'readwrite' });
    return perm === 'granted' ? 'connected' : 'needs-permission';
  } catch {
    return 'disconnected';
  }
}

export async function reconnect() {
  if (!fileHandle) return false;
  const perm = await fileHandle.requestPermission({ mode: 'readwrite' });
  return perm === 'granted';
}

export async function createNewFile() {
  try {
    fileHandle = await window.showSaveFilePicker({
      suggestedName: 'chess-trainer-data.json',
      types: [{ description: 'Chess Trainer Data', accept: { 'application/json': ['.json'] } }],
    });
    await dbPut(fileHandle);
    return true;
  } catch {
    return false;
  }
}

export async function openExistingFile() {
  try {
    [fileHandle] = await window.showOpenFilePicker({
      types: [{ description: 'Chess Trainer Data', accept: { 'application/json': ['.json'] } }],
      excludeAcceptAllOption: true,
    });
    await dbPut(fileHandle);
    return true;
  } catch {
    return false;
  }
}

export async function readFile() {
  if (!fileHandle) return null;
  try {
    const file = await fileHandle.getFile();
    const text = await file.text();
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeFile(snapshot) {
  if (!fileHandle) return;
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(snapshot, null, 2));
    await writable.close();
    window.dispatchEvent(new CustomEvent('file-write-ok'));
  } catch (e) {
    console.error('File write failed:', e);
    window.dispatchEvent(new CustomEvent('file-write-error'));
  }
}

export function getFileName() {
  return fileHandle?.name ?? null;
}
