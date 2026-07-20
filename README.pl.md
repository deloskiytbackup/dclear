# 🧹 dclear (Disk Clear)

🇬🇧 [English](README.md) | 🇵🇱 **Polski**

[![Licencja: MIT](https://img.shields.io/badge/Licencja-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

**dclear** to szybki, równoległy analizator i menedżer czyszczenia dysku zbudowany w Node.js/TypeScript. Skanuje katalogi, wyszukuje najcięższe pliki i foldery, lokalizuje „osierocone" foldery `node_modules` i umożliwia ich bezpieczne usuwanie w celu odzyskania miejsca na dysku.

---

## ✨ Kluczowe Cechy

- 👯 **Wykrywanie Duplikatów**: Wyszukuj zduplikowane pliki (>1MB) za pomocą hashowania MD5 i wyliczaj oszczędność miejsca.
- 📊 **Informacje o Dysku**: Sprawdzaj całkowity i wolny rozmiar partycji dyskowej.
- 🤖 **Automatyczne Czyszczenie node_modules**: Użyj `--auto` aby usunąć wszystkie znalezione foldery `node_modules` jednym poleceniem.
- ⚡ **Równoległy Skan**: W fully współbieżna analiza katalogów (`Promise.all`) — skanowanie 6+ GB w niecałe 18 sekund.
- 🎨 **Kolorowy Output**: Koloryfikacja ANSI rozmiarów (czerwony = GB, żółty = 100MB+, cyjan = 10MB+, zielony = małe pliki).
- 🔄 **Animowany Spinner**: Spinner z przelicznikiem sekund w czasie rzeczywistym.
- 📦 **Detektor node_modules**: Rekurencyjne wyszukiwanie wszystkich folderów `node_modules` w Twoich projektach.
- 🗑️ **Bezpieczne Usuwanie**: Usuwaj ciężkie pliki i foldery bezpośrednio z wiersza poleceń.

---

## 🚀 Instalacja

```bash
git clone https://github.com/deloskiytbackup/dclear.git
cd dclear
npm install
npm run build
npm link
```

Komenda `dclear` będzie dostępna globalnie!

---

## 🛠️ Dostępne Komendy

```bash
# Skanuj bieżący katalog — wyświetla TOP 20 najcięższych elementów
dclear scan

# Skanuj wskazany katalog
dclear scan C:\Users\mojeKonto\Projekty

# Znajdź wszystkie foldery node_modules
dclear clean-nm C:\Users\mojeKonto

# Automatycznie usuń wszystkie znalezione foldery node_modules
dclear clean-nm C:\Users\mojeKonto --auto

# Znajdź zduplikowane pliki większe niż 1MB
dclear dup C:\Users\mojeKonto\Projekty

# Wyświetl statystyki partycji dysku
dclear info C:\Users\mojeKonto

# Usuń wybrane pliki lub foldery
dclear rm ./ciężki-plik.apk ./stary-projekt/node_modules

# Pomoc i wersja
dclear --help
dclear --version
```

---

## 📄 Licencja

Udostępniane na licencji [MIT](LICENSE).
