import path from 'node:path';
import fs from 'node:fs';
import { scanDirectory, findNodeModulesFolders, findDuplicates, getTopSubItems } from './analyzer.js';
import { formatBytes, colorizeSize, formatDuration, formatNumber } from './formatter.js';
import { removeTarget } from './cleaner.js';

const VERSION = '1.4.0';

async function handleScan(targetDir: string, skipNodeModules: boolean = false, limit: number = 20) {
  const absoluteDir = path.resolve(targetDir);
  const startTime = Date.now();

  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frame = 0;
  let currentPath = absoluteDir;
  let currentFileCount = 0;

  const spinner = setInterval(() => {
    if (process.stdout.isTTY) {
      const s = spinnerFrames[frame++ % spinnerFrames.length];
      const elapsedSec = (Date.now() - startTime) / 1000;
      const formattedTime = formatDuration(elapsedSec);
      const cols = process.stdout.columns || 80;
      const filesStr = currentFileCount > 0 ? `(${formatNumber(currentFileCount)} plik.) ` : '';
      const prefix = `${s} [dclear] ${filesStr}`;
      const suffix = ` (${formattedTime})`;
      const maxPathLen = cols - prefix.length - suffix.length - 5;
      
      let displayPath = currentPath;
      if (displayPath.length > maxPathLen && maxPathLen > 10) {
        displayPath = '...' + displayPath.slice(displayPath.length - maxPathLen + 3);
      }
      process.stdout.write(`\r\x1b[K\x1b[36m${s}\x1b[0m [dclear] \x1b[90m${filesStr}\x1b[0m\x1b[33m${displayPath}\x1b[0m \x1b[90m(${formattedTime})\x1b[0m`);
    }
  }, 80);

  const items = await scanDirectory(absoluteDir, (fullPath, fileCount) => {
    currentPath = fullPath;
    currentFileCount = fileCount;
  }, skipNodeModules);

  clearInterval(spinner);
  if (process.stdout.isTTY) process.stdout.write('\r\x1b[K');

  const durationSec = (Date.now() - startTime) / 1000;
  const formattedDuration = formatDuration(durationSec);
  const topItems = items.slice(0, limit);

  if (topItems.length === 0) {
    console.log('Katalog jest pusty.');
    return;
  }

  const totalSize = items.reduce((sum, i) => sum + i.size, 0);

  console.log(`\n🔍 Wyniki skanowania: \x1b[1m${absoluteDir}\x1b[0m (${formattedDuration})\n`);
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

    if (item.isDir) {
      const subItems = await getTopSubItems(item.path, 2, skipNodeModules);
      if (subItems.length > 0) {
        for (const sub of subItems) {
          const subIcon = sub.isDir ? '📂' : '📄';
          const subSizeStr = formatBytes(sub.size);
          console.log(`         \x1b[90m└─ ${subIcon} ${sub.name} (${subSizeStr})\x1b[0m`);
        }
      }
    }
  }

  console.log('\n   💡 Aby usunąć: \x1b[1mdclear rm <ścieżka>\x1b[0m');
  console.log(`   💡 Szukaj node_modules: \x1b[1mdclear clean-nm [ścieżka]\x1b[0m`);
  console.log(`   💡 Szukaj duplikatów: \x1b[1mdclear dup [ścieżka]\x1b[0m\n`);
}

async function handleCleanNm(targetDir: string, autoRemove: boolean = false) {
  const absoluteDir = path.resolve(targetDir);
  const startTime = Date.now();

  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frame = 0;
  let currentPath = absoluteDir;
  let currentFileCount = 0;

  const spinner = setInterval(() => {
    if (process.stdout.isTTY) {
      const s = spinnerFrames[frame++ % spinnerFrames.length];
      const elapsedSec = (Date.now() - startTime) / 1000;
      const formattedTime = formatDuration(elapsedSec);
      const cols = process.stdout.columns || 80;
      const filesStr = currentFileCount > 0 ? `(${formatNumber(currentFileCount)} plik.) ` : '';
      const prefix = `${s} [dclear] ${filesStr}`;
      const suffix = ` (${formattedTime})`;
      const maxPathLen = cols - prefix.length - suffix.length - 5;

      let displayPath = currentPath;
      if (displayPath.length > maxPathLen && maxPathLen > 10) {
        displayPath = '...' + displayPath.slice(displayPath.length - maxPathLen + 3);
      }
      process.stdout.write(`\r\x1b[K\x1b[36m${s}\x1b[0m [dclear] \x1b[90m${filesStr}\x1b[0m\x1b[33m${displayPath}\x1b[0m \x1b[90m(${formattedTime})\x1b[0m`);
    }
  }, 80);

  const nmFolders = await findNodeModulesFolders(absoluteDir, [], (p, count) => {
    currentPath = p;
    currentFileCount = count;
  });

  clearInterval(spinner);
  if (process.stdout.isTTY) process.stdout.write('\r\x1b[K');

  const durationSec = (Date.now() - startTime) / 1000;
  const formattedDuration = formatDuration(durationSec);

  if (nmFolders.length === 0) {
    console.log('\n✅ Nie znaleziono żadnych folderów node_modules.');
    return;
  }

  let totalSize = 0;
  console.log(`\n📦 Znaleziono ${nmFolders.length} folderów node_modules (${formattedDuration}):\n`);

  for (const nm of nmFolders) {
    totalSize += nm.size;
    const formatted = formatBytes(nm.size);
    console.log(`   ${colorizeSize(nm.size, formatted.padEnd(12))} ${nm.path}`);
  }

  console.log(`\n   💾 Łączny rozmiar: \x1b[31;1m${formatBytes(totalSize)}\x1b[0m`);

  if (autoRemove) {
    console.log(`\n🚀 Rozpoczynam automatyczne usuwanie ${nmFolders.length} folderów node_modules...`);
    for (const nm of nmFolders) {
      process.stdout.write(`🗑️  Usuwanie ${nm.path} ... `);
      await removeTarget(nm.path);
      console.log(`\x1b[32mOK\x1b[0m`);
    }
    console.log(`\n✅ Pomyślnie usunięto wszystkie foldery node_modules! Odzyskano \x1b[32;1m${formatBytes(totalSize)}\x1b[0m.`);
  } else {
    console.log('   💡 Aby usunąć wybrane: \x1b[1mdclear rm <ścieżka>\x1b[0m');
    console.log('   💡 Aby usunąć wszystkie automatycznie: \x1b[1mdclear clean-nm [ścieżka] --auto\x1b[0m\n');
  }
}

async function handleDuplicates(targetDir: string, minSizeMB: number = 1) {
  const absoluteDir = path.resolve(targetDir);
  const startTime = Date.now();

  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frame = 0;
  let currentPath = absoluteDir;
  let currentFileCount = 0;

  const spinner = setInterval(() => {
    if (process.stdout.isTTY) {
      const s = spinnerFrames[frame++ % spinnerFrames.length];
      const elapsedSec = (Date.now() - startTime) / 1000;
      const formattedTime = formatDuration(elapsedSec);
      const cols = process.stdout.columns || 80;
      const filesStr = currentFileCount > 0 ? `(${formatNumber(currentFileCount)} plik.) ` : '';
      const prefix = `${s} [dclear] ${filesStr}`;
      const suffix = ` (${formattedTime})`;
      const maxPathLen = cols - prefix.length - suffix.length - 5;

      let displayPath = currentPath;
      if (displayPath.length > maxPathLen && maxPathLen > 10) {
        displayPath = '...' + displayPath.slice(displayPath.length - maxPathLen + 3);
      }
      process.stdout.write(`\r\x1b[K\x1b[36m${s}\x1b[0m [dclear] \x1b[90m${filesStr}\x1b[0m\x1b[33m${displayPath}\x1b[0m \x1b[90m(${formattedTime})\x1b[0m`);
    }
  }, 80);

  const duplicates = await findDuplicates(absoluteDir, minSizeMB, (p, count) => {
    currentPath = p;
    currentFileCount = count;
  });

  clearInterval(spinner);
  if (process.stdout.isTTY) process.stdout.write('\r\x1b[K');

  const durationSec = (Date.now() - startTime) / 1000;
  const formattedDuration = formatDuration(durationSec);

  if (duplicates.length === 0) {
    console.log(`\n✅ Nie znaleziono duplikatów plików większych niż ${minSizeMB} MB.`);
    return;
  }

  let totalWasted = 0;
  console.log(`\n👯 Znaleziono ${duplicates.length} grup duplikatów (${formattedDuration}):\n`);

  for (let i = 0; i < duplicates.length; i++) {
    const group = duplicates[i];
    const wasted = group.size * (group.files.length - 1);
    totalWasted += wasted;
    const formattedSize = formatBytes(group.size);
    const formattedWasted = formatBytes(wasted);

    console.log(`   ${i + 1}. Rozmiar pliku: ${colorizeSize(group.size, formattedSize)} | Marnowane miejsce: \x1b[31;1m${formattedWasted}\x1b[0m (${group.files.length} kopie)`);
    for (const f of group.files) {
      console.log(`      └─ \x1b[90m${f}\x1b[0m`);
    }
    console.log('');
  }

  console.log(`   💾 Łączne potencjalnie oszczędzone miejsce: \x1b[32;1m${formatBytes(totalWasted)}\x1b[0m`);
  console.log('   💡 Aby usunąć plik: \x1b[1mdclear rm <ścieżka>\x1b[0m\n');
}

async function handleInfo(targetDir: string) {
  const absoluteDir = path.resolve(targetDir);

  try {
    const stat = await fs.promises.statfs(absoluteDir).catch(() => null);
    if (stat) {
      const total = stat.blocks * stat.bsize;
      const free = stat.bfree * stat.bsize;
      const available = stat.bavail * stat.bsize;
      const used = total - free;
      const usedPercent = ((used / total) * 100).toFixed(1);

      console.log(`\n📊 Informacje o partycji dyskowej dla: \x1b[1m${absoluteDir}\x1b[0m\n`);
      console.log(`   Całkowity rozmiar: \x1b[1m${formatBytes(total)}\x1b[0m`);
      console.log(`   Zajęte miejsce:    \x1b[31;1m${formatBytes(used)}\x1b[0m (${usedPercent}%)`);
      console.log(`   Wolne miejsce:     \x1b[32;1m${formatBytes(available)}\x1b[0m`);
      console.log('');
    } else {
      console.log(`ℹ️ Katalog: ${absoluteDir}`);
    }
  } catch (err: any) {
    console.error(`Nie udało się pobrać statystyk dysku: ${err.message}`);
  }
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
Szybki menedżer dysku w Node.js — skanuj, analizuj duplikaty, czyść!

\x1b[1mUżycie:\x1b[0m
  dclear <command> [options]

\x1b[1mDostępne komendy:\x1b[0m
  scan [path]           Skanuje katalog i pokazuje TOP najcięższych plików/folderów
  scan [path] --fast    Super-szybkie skanowanie bez zagłębiania się w node_modules (-s, --fast)
  clean-nm [path]       Wyszukuje wszystkie foldery node_modules
  clean-nm [path] --auto Automatycznie usuwa wszystkie znalezione foldery node_modules
  dup, duplicates [path] Wyszukuje zduplikowane pliki (>1MB) i wylicza marnowane miejsce
  info [path]           Pokazuje całkowity i wolny rozmiar dysku dla danej ścieżki
  rm <path...>          Usuwa wskazane pliki lub foldery z dysku
  -v, --version         Wyświetla wersję dclear
  -h, --help            Wyświetla tę pomoc
`);
}

export async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const cwd = process.cwd();

  try {
    switch (command) {
      case 'scan':
        const fast = args.includes('--fast') || args.includes('-s') || args.includes('--skip-nm');
        const scanPath = args.find(a => !a.startsWith('-') && a !== 'scan') || cwd;
        await handleScan(scanPath, fast);
        break;
      case 'clean-nm':
        const auto = args.includes('--auto') || args.includes('-a');
        const nmPath = args.find(a => !a.startsWith('-') && a !== 'clean-nm') || cwd;
        await handleCleanNm(nmPath, auto);
        break;
      case 'dup':
      case 'duplicates':
        await handleDuplicates(args[1] || cwd);
        break;
      case 'info':
        await handleInfo(args[1] || cwd);
        break;
      case 'rm':
      case 'remove':
        await handleRemove(args.filter(a => a !== 'rm' && a !== 'remove'));
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
