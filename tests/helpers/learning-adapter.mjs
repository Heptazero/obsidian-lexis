/** File-level sync fixture, never touches a real vault. */
export function memoryAdapter() {
  const dirs = new Set(), files = new Map(), writes = [], versions = new Map();
  const io = {
    files, dirs, writes,
    async exists(path) { return dirs.has(path) || files.has(path); },
    async mkdir(path) { dirs.add(path); },
    async write(path, text) { files.set(path, text); writes.push(path); versions.set(path, (versions.get(path) || 0) + 1); },
    async process(path, fn) { const text = fn(await io.read(path)); await io.write(path, text); return text; },
    async read(path) { if (!files.has(path)) throw Error(`Missing file: ${path}`); return files.get(path); },
    async stat(path) { return files.has(path) ? { type:"file",mtime:versions.get(path)||0,size:files.get(path).length,ctime:0 } : null; },
    async remove(path) { files.delete(path); versions.delete(path); },
    async rmdir(path) { dirs.delete(path); },
    async list(path) {
      const prefix = `${path}/`, direct = name => name.startsWith(prefix) && !name.slice(prefix.length).includes("/");
      return { files:[...files.keys()].filter(direct), folders:[...dirs].filter(direct) };
    },
  };
  return io;
}
