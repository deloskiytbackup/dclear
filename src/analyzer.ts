import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface DiskItem {
  path: string;
  name: string;
  size: number;
  isDir: boolean;
}

export interface DuplicateGroup {
  hash: string;
  size: number;
  files: string[];
}

class ConcurrencyPool {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private limit: number = 128) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }
}

const pool = new ConcurrencyPool(128);

// Iteracyjny skaner z opcjonalnym pomijaniem node_modules dla błyskawicznego skanowania
async function fastDirSize(
  dirPath: string,
  onProgress?: (fullPath: string, totalFiles: { count: number }) => void,
  fileCounter: { count: number } = { count: 0 },
  skipNodeModules: boolean = false
): Promise<number> {
  let totalSize = 0;
  const dirQueue: string[] = [dirPath];
  const visited = new Set<string>();

  const processNextDir = async (): Promise<number> => {
    let localSize = 0;

    while (dirQueue.length > 0) {
      const currentDir = dirQueue.pop();
      if (!currentDir || visited.has(currentDir)) continue;
      visited.add(currentDir);

      let entries: fs.Dirent[];
      try {
        entries = await pool.run(() => fs.promises.readdir(currentDir, { withFileTypes: true }));
      } catch {
        continue;
      }

      const tasks: Promise<number>[] = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === '$RECYCLE.BIN' || entry.name === 'System Volume Information') continue;
          if (skipNodeModules && entry.name === 'node_modules') continue;

          tasks.push(
            pool.run(async () => {
              try {
                const stat = await fs.promises.lstat(fullPath);
                if (!stat.isSymbolicLink()) {
                  dirQueue.push(fullPath);
                }
              } catch {}
              return 0;
            })
          );
        } else if (entry.isFile()) {
          fileCounter.count++;
          if (onProgress && fileCounter.count % 500 === 0) {
            onProgress(fullPath, fileCounter);
          }

          tasks.push(
            pool.run(async () => {
              try {
                const stat = await fs.promises.lstat(fullPath);
                return stat.isSymbolicLink() ? 0 : stat.size;
              } catch {
                return 0;
              }
            })
          );
        }
      }

      if (tasks.length > 0) {
        const sizes = await Promise.all(tasks);
        for (let j = 0; j < sizes.length; j++) {
          localSize += sizes[j];
        }
      }
    }

    return localSize;
  };

  const workerCount = 16;
  const workers: Promise<number>[] = [];
  for (let w = 0; w < workerCount; w++) {
    workers.push(processNextDir());
  }

  const results = await Promise.all(workers);
  for (let r = 0; r < results.length; r++) {
    totalSize += results[r];
  }

  return totalSize;
}

export async function scanDirectory(
  targetDir: string,
  onProgress?: (fullPath: string, fileCount: number) => void,
  skipNodeModules: boolean = false
): Promise<DiskItem[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(targetDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const fileCounter = { count: 0 };

  const tasks = entries.map(async (entry): Promise<DiskItem> => {
    const fullPath = path.join(targetDir, entry.name);

    if (onProgress) onProgress(fullPath, fileCounter.count);

    if (entry.isDirectory()) {
      const stat = await fs.promises.lstat(fullPath).catch(() => null);
      if (stat?.isSymbolicLink()) {
        return { path: fullPath, name: entry.name, size: 0, isDir: false };
      }

      const size = await fastDirSize(fullPath, (curPath, counter) => {
        if (onProgress) onProgress(curPath, counter.count);
      }, fileCounter, skipNodeModules);
      return { path: fullPath, name: entry.name, size, isDir: true };
    } else {
      fileCounter.count++;
      const stat = await fs.promises.lstat(fullPath).catch(() => null);
      if (stat?.isSymbolicLink()) {
        return { path: fullPath, name: entry.name, size: 0, isDir: false };
      }
      return { path: fullPath, name: entry.name, size: stat?.size ?? 0, isDir: false };
    }
  });

  const items = await Promise.all(tasks);
  return items.sort((a, b) => b.size - a.size);
}

export async function findNodeModulesFolders(
  rootDir: string,
  found: DiskItem[] = [],
  onProgress?: (path: string, fileCount: number) => void
): Promise<DiskItem[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
  } catch {
    return found;
  }

  const tasks: Promise<void>[] = [];
  const fileCounter = { count: 0 };

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(rootDir, entry.name);

    const stat = await fs.promises.lstat(fullPath).catch(() => null);
    if (stat?.isSymbolicLink()) continue;

    if (entry.name === 'node_modules') {
      tasks.push(
        fastDirSize(fullPath, (p, counter) => {
          if (onProgress) onProgress(p, counter.count);
        }, fileCounter, false).then(size => {
          found.push({ path: fullPath, name: fullPath, size, isDir: true });
        })
      );
    } else if (entry.name !== '.git' && entry.name !== '.dpn' && entry.name !== 'dist' && entry.name !== '$RECYCLE.BIN') {
      tasks.push(findNodeModulesFolders(fullPath, found, onProgress).then(() => {}));
    }
  }

  await Promise.all(tasks);
  return found.sort((a, b) => b.size - a.size);
}

export async function findDuplicates(
  rootDir: string,
  minSizeMB: number = 1,
  onProgress?: (path: string, count: number) => void
): Promise<DuplicateGroup[]> {
  const minBytes = minSizeMB * 1024 * 1024;
  const sizeMap = new Map<number, string[]>();
  let fileCount = 0;

  const collectFiles = async (dir: string): Promise<void> => {
    let entries: fs.Dirent[];
    try {
      entries = await pool.run(() => fs.promises.readdir(dir, { withFileTypes: true }));
    } catch {
      return;
    }

    const tasks: Promise<void>[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== '$RECYCLE.BIN') {
          tasks.push(
            pool.run(async () => {
              try {
                const stat = await fs.promises.lstat(fullPath);
                if (!stat.isSymbolicLink()) {
                  await collectFiles(fullPath);
                }
              } catch {}
            })
          );
        }
      } else if (entry.isFile()) {
        fileCount++;
        if (onProgress && fileCount % 100 === 0) onProgress(fullPath, fileCount);

        tasks.push(
          pool.run(async () => {
            try {
              const stat = await fs.promises.lstat(fullPath);
              if (stat.size >= minBytes && !stat.isSymbolicLink()) {
                const existing = sizeMap.get(stat.size);
                if (existing) {
                  existing.push(fullPath);
                } else {
                  sizeMap.set(stat.size, [fullPath]);
                }
              }
            } catch {}
          })
        );
      }
    }

    await Promise.all(tasks);
  };

  await collectFiles(rootDir);

  const duplicates: DuplicateGroup[] = [];

  for (const [size, files] of sizeMap) {
    if (files.length < 2) continue;

    const hashMap = new Map<string, string[]>();

    const hashTasks = files.map(async (file) => {
      try {
        await pool.run(async () => {
          const handle = await fs.promises.open(file, 'r');
          const buf = Buffer.alloc(4096);
          await handle.read(buf, 0, 4096, 0);
          await handle.close();
          const hash = crypto.createHash('md5').update(buf).digest('hex');
          const existing = hashMap.get(hash);
          if (existing) {
            existing.push(file);
          } else {
            hashMap.set(hash, [file]);
          }
        });
      } catch {}
    });

    await Promise.all(hashTasks);

    for (const [hash, hashFiles] of hashMap) {
      if (hashFiles.length >= 2) {
        duplicates.push({ hash, size, files: hashFiles });
      }
    }
  }

  return duplicates.sort((a, b) => (b.size * b.files.length) - (a.size * a.files.length));
}
