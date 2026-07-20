import fs from 'node:fs';

export async function removeTarget(targetPath: string): Promise<number> {
  try {
    const stats = await fs.promises.lstat(targetPath);
    let freedBytes = stats.size;

    await fs.promises.rm(targetPath, { recursive: true, force: true });
    return freedBytes;
  } catch (err: any) {
    throw new Error(`Nie udało się usunąć ${targetPath}: ${err.message}`);
  }
}
