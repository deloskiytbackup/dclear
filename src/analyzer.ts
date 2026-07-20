import fs from 'node:fs';
import path from 'node:path';

export interface DiskItem {
  path: string;
  name: string;
  size: number;
  isDir: boolean;
}

// Szybki rozmiar folderu - równoległy skan z ograniczeniem głębokości
async function fastDirSize(dirPath: string): Promise<number> {
  let totalSize = 0;

  const processDir = async (currentPath: string): Promise<number> => {
    let size = 0;
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
    for (const r of results) size += r;
    return size;
  };

  totalSize = await processDir(dirPath);
  return totalSize;
}

export async function scanDirectory(targetDir: string, onProgress?: (name: string) => void): Promise<DiskItem[]> {
  const entries = await fs.promises.readdir(targetDir, { withFileTypes: true }).catch(() => []);

  // Faza 1: Zbieramy podstawowe info o wpisach
  const tasks = entries.map(async (entry): Promise<DiskItem> => {
    const fullPath = path.join(targetDir, entry.name);

    if (onProgress) onProgress(entry.name);

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

  // Równoległy skan wszystkich wpisów jednocześnie
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
