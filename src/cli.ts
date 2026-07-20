import path from 'node:path';
import { scanDirectory, findNodeModulesFolders } from './analyzer.js';
import { formatBytes, colorizeSize } from './formatter.js';
import { removeTarget } from './cleaner.js';

const VERSION = '1.0.0';

async function handleScan(targetDir: string, limit: number = 20) {
  const absoluteDir = path.resolve(targetDir);
  const startTime = Date.now();

  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frame = 0;

  const spinner = setInterval(() => {
    if (process.stdout.isTTY) {
      const s = spinnerFrames[frame++ % spinnerFrames.length];
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r\x1b[K\x1b[36m${s}\x1b[0m [dclear] Skanowanie ${absoluteDir} ... \x1b[90m(${elapsed}s)\x1b[0m`);
    }
  }, 80);

  const items = await scanDirectory(absoluteDir, (name) => {
    if (process.stdout.isTTY) {
      const s = spinnerFrames[frame++ % spinnerFrames.length];
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r\x1b[K\x1b[36m${s}\x1b[0m [dclear] Analizuję: ${name.slice(0, 35)} \x1b[90m(${elapsed}s)\x1b[0m`);
    }
  });

  clearInterval(spinner);
  if (process.stdout.isTTY) process.stdout.write('\r\x1b[K');

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const topItems = items.slice(0, limit);

  if (topItems.length === 0) {
    console.log('Katalog jest pusty.');
    return;
  }

  const totalSize = items.reduce((sum, i) => sum + i.size, 0);

  console.log(`\n🔍 Wyniki skanowania: \x1b[1m${absoluteDir}\x1b[0m (${duration}s)\n`);
  console.log(`   💾 Łączny rozmiar: \x1b[1m${formatBytes(totalSize)}\x1b[0m | Elementów: ${items.length}\n`);
  console.log(`   ${'#'.padEnd(4)} ${'Rozmiar'.padEnd(14)} ${'Typ'.padEnd(8)} Nazwa`);
  console.log('   ' + '─'.repeat(60));

  for (let i = 0; i < topItems.length; i++) {
    const item = topItems[i];
    const formatted = formatBytes(item.size);
    const coloredSize = colorizeSize(item.size, formatted.padEnd(12));
    const typeStr = item.isDir ? '\x1b[34m[DIR]\x1b[0m ' : '\x1b[90m[FILE]\x1b[0m';
    const rank = `${i + 1}.`.padEnd(4);
    console.log(`   ${rank} ${coloredSize}  ${typeStr}  ${item.name}`);
  }

  console.log('\n   💡 Aby usunąć: \x1b[1mdclear rm <ścieżka>\x1b[0m');
  console.log(`   💡 Szukaj node_modules: \x1b[1mdclear clean-nm [ścieżka]\x1b[0m\n`);
}

async function handleCleanNm(targetDir: string) {
  const absoluteDir = path.resolve(targetDir);
  const startTime = Date.now();

  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frame = 0;

  const spinner = setInterval(() => {
    if (process.stdout.isTTY) {
      const s = spinnerFrames[frame++ % spinnerFrames.length];
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r\x1b[K\x1b[36m${s}\x1b[0m [dclear] Szukam folderów node_modules ... \x1b[90m(${elapsed}s)\x1b[0m`);
    }
  }, 80);

  const nmFolders = await findNodeModulesFolders(absoluteDir, [], (p) => {
    if (process.stdout.isTTY) {
      const s = spinnerFrames[frame++ % spinnerFrames.length];
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r\x1b[K\x1b[36m${s}\x1b[0m [dclear] Znaleziono: ${p.slice(0, 45)} \x1b[90m(${elapsed}s)\x1b[0m`);
    }
  });

  clearInterval(spinner);
  if (process.stdout.isTTY) process.stdout.write('\r\x1b[K');

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (nmFolders.length === 0) {
    console.log('\n✅ Nie znaleziono żadnych folderów node_modules.');
    return;
  }

  let totalSize = 0;
  console.log(`\n📦 Znaleziono ${nmFolders.length} folderów node_modules (${duration}s):\n`);

  for (const nm of nmFolders) {
    totalSize += nm.size;
    const formatted = formatBytes(nm.size);
    console.log(`   ${colorizeSize(nm.size, formatted.padEnd(12))} ${nm.path}`);
  }

  console.log(`\n   💾 Łączny rozmiar: \x1b[31;1m${formatBytes(totalSize)}\x1b[0m`);
  console.log('   💡 Aby usunąć: \x1b[1mdclear rm <ścieżka>\x1b[0m\n');
}

async function handleRemove(targetPaths: string[]) {
  if (targetPaths.length === 0) {
    console.error('Błąd: Podaj ścieżkę (np. dclear rm ./heavy-file.apk)');
    process.exit(1);
  }

  for (const targetPath of targetPaths) {
    const absPath = path.resolve(targetPath);
    console.log(`🗑️  [dclear] Usuwanie \x1b[33m${absPath}\x1b[0m ...`);
    await removeTarget(absPath);
    console.log(`✅ Pomyślnie usunięto!`);
  }
}

function showHelp() {
  console.log(`
\x1b[1m🧹 dclear (Disk Clear) v${VERSION}\x1b[0m
Szybki menedżer dysku w Node.js — skanuj, analizuj, czyść!

\x1b[1mUżycie:\x1b[0m
  dclear <command> [options]

\x1b[1mDostępne komendy:\x1b[0m
  scan [path]        Skanuje katalog i pokazuje TOP najcięższych plików/folderów
  clean-nm [path]    Wyszukuje wszystkie foldery node_modules
  rm <path...>       Usuwa wskazane pliki lub foldery z dysku
  -v, --version      Wyświetla wersję dclear
  -h, --help         Wyświetla tę pomoc
`);
}

export async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const cwd = process.cwd();

  try {
    switch (command) {
      case 'scan':
        await handleScan(args[1] || cwd);
        break;
      case 'clean-nm':
        await handleCleanNm(args[1] || cwd);
        break;
      case 'rm':
      case 'remove':
        await handleRemove(args.slice(1));
        break;
      case '-v':
      case '--version':
        console.log(`dclear v${VERSION}`);
        break;
      case '-h':
      case '--help':
      case undefined:
        showHelp();
        break;
      default:
        console.error(`Nieznana komenda: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err: any) {
    console.error(`\n❌ [dclear błąd]: ${err.message}`);
    process.exit(1);
  }
}
