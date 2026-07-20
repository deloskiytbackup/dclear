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

// Szybki rozmiar folderu - równoległy skan
async function fastDirSize(dirPath: string): Promise<number> {
  const processDir = async (currentPath: string): Promise<number> => {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    } catch {
      return 0;
    }

    const tasks: Promise<number>[] = [];

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        tasks.push(processDir(fullPath));
      } else {
        tasks.push(
          fs.promises.lstat(fullPath)
            .then(s => s.size)
            .catch(() => 0)
        );
      }
    }

    const results = await Promise.all(tasks);
    let size = 0;
    for (const r of results) size += r;
    return size;
  };

  return processDir(dirPath);
}

export async function scanDirectory(targetDir: string, onProgress?: (fullPath: string) => void): Promise<DiskItem[]> {
  const entries = await fs.promises.readdir(targetDir, { withFileTypes: true }).catch(() => []);

  const tasks = entries.map(async (entry): Promise<DiskItem> => {
    const fullPath = path.join(targetDir, entry.name);

    if (onProgress) onProgress(fullPath);

    if (entry.isSymbolicLink()) {
      return { path: fullPath, name: entry.name, size: 0, isDir: false };
    }

    if (entry.isDirectory()) {
      const size = await fastDirSize(fullPath);
      return { path: fullPath, name: entry.name, size, isDir: true };
    } else {
      const stat = await fs.promises.lstat(fullPath).catch(() => null);
      return { path: fullPath, name: entry.name, size: stat?.size ?? 0, isDir: false };
    }
  });

  const items = await Promise.all(tasks);
  return items.sort((a, b) => b.size - a.size);
}

export async function findNodeModulesFolders(rootDir: string, found: DiskItem[] = [], onProgress?: (path: string) => void): Promise<DiskItem[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
  } catch {
    return found;
  }

  const tasks: Promise<void>[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const fullPath = path.join(rootDir, entry.name);

    if (entry.name === 'node_modules') {
      tasks.push(
        fastDirSize(fullPath).then(size => {
          if (onProgress) onProgress(fullPath);
          found.push({ path: fullPath, name: fullPath, size, isDir: true });
        })
      );
    } else if (entry.name !== '.git' && entry.name !== '.dpn' && entry.name !== 'dist') {
      tasks.push(findNodeModulesFolders(fullPath, found, onProgress).then(() => {}));
    }
  }

  await Promise.all(tasks);
  return found.sort((a, b) => b.size - a.size);
}

// Szukanie duplikatów plików (po rozmiarze + hash pierwszych 4KB)
export async function findDuplicates(
  rootDir: string,
  minSizeMB: number = 1,
  onProgress?: (path: string) => void
): Promise<DuplicateGroup[]> {
  const minBytes = minSizeMB * 1024 * 1024;
  const sizeMap = new Map<number, string[]>();

  // Faza 1: Zbierz pliki pogrupowane po rozmiarze
  const collectFiles = async (dir: string): Promise<void> => {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const tasks: Promise<void>[] = [];

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          tasks.push(collectFiles(fullPath));
        }
      } else {
        tasks.push(
          fs.promises.lstat(fullPath).then(stat => {
            if (stat.size >= minBytes) {
              if (onProgress) onProgress(fullPath);
              const existing = sizeMap.get(stat.size);
              if (existing) {
                existing.push(fullPath);
              } else {
                sizeMap.set(stat.size, [fullPath]);
              }
            }
          }).catch(() => {})
        );
      }
    }

    await Promise.all(tasks);
  };

  await collectFiles(rootDir);

  // Faza 2: Dla plików o tym samym rozmiarze, porównaj hash
  const duplicates: DuplicateGroup[] = [];

  for (const [size, files] of sizeMap) {
    if (files.length < 2) continue;

    const hashMap = new Map<string, string[]>();

    const hashTasks = files.map(async (file) => {
      try {
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
