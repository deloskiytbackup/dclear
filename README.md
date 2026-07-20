# 🧹 dclear (Disk Clear)

🇬🇧 **English** | 🇵🇱 [Polski](README.pl.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

**dclear** is a fast, parallel disk usage analyzer and cleaner built in Node.js/TypeScript. It scans directories, finds the heaviest files and folders, locates orphan `node_modules` directories, and lets you safely delete them to reclaim disk space.

---

## ✨ Key Features

- ⚡ **Parallel Scanning**: Fully concurrent directory analysis using `Promise.all` — scans 6 GB+ directories in under 18 seconds.
- 🎨 **Color-Coded Output**: ANSI-colored size display (red for GB, yellow for 100MB+, cyan for 10MB+, green for small files).
- 🔄 **Animated Spinner**: Real-time animated spinner during scanning so you always know it's working.
- 📦 **node_modules Hunter**: Recursively finds all `node_modules` folders across your projects for easy cleanup.
- 🗑️ **Safe Deletion**: Remove heavy files and directories directly from the CLI.

---

## 🚀 Installation

```bash
git clone https://github.com/deloskiytbackup/dclear.git
cd dclear
npm install
npm run build
npm link
```

The `dclear` command will be available globally!

---

## 🛠️ CLI Commands

```bash
# Scan current directory — shows TOP 20 heaviest items
dclear scan

# Scan a specific directory
dclear scan C:\Users\myuser\Projects

# Find all node_modules folders recursively
dclear clean-nm C:\Users\myuser

# Remove specific files or directories
dclear rm ./heavy-file.apk ./old-project/node_modules

# Help and version
dclear --help
dclear --version
```

---

## 📊 Example Output

```
🔍 Scan results: C:\Users\shaza\.gemini\antigravity\scratch (17.59s)

   💾 Total size: 6.47 GB | Items: 322

   #    Size           Type     Name
   ────────────────────────────────────────────────────────────
   1.   813.2 MB      [DIR]   tendio
   2.   689.95 MB     [DIR]   startest
   3.   662.25 MB     [DIR]   startools
   4.   654.62 MB     [DIR]   dizowskyy-archive
   5.   643.84 MB     [DIR]   decoded_base
   ...
```

---

## 🏗️ Architecture

```
dclear/
├── bin/
│   └── dclear.js        # CLI entrypoint
├── src/
│   ├── cli.ts           # Command routing, spinner, colored output
│   ├── analyzer.ts      # Parallel recursive directory scanner
│   ├── formatter.ts     # Byte formatting (B/KB/MB/GB) and ANSI coloring
│   └── cleaner.ts       # Safe file/directory removal
├── package.json
├── tsconfig.json
└── LICENSE
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).
