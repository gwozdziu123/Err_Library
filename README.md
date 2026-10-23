# Err_Library

PWA do przeglądania alarmów i adresów urządzeń. Działa offline, bez zewnętrznych bibliotek.

## Uruchomienie

- Na komputerze: otwórz `index.html` (działa także z dysku, bez trybu offline i instalacji).
- Jako PWA (instalacja na telefonie, praca offline): wystaw folder przez HTTPS, np. GitHub Pages, Netlify, serwer w sieci zakładowej. Lokalny test: `python -m http.server 8000` w tym folderze → `http://localhost:8000`.
- Po zmianie danych podbij `VERSION` w `sw.js`, żeby zainstalowane aplikacje pobrały nowe pliki.

## Struktura

```
index.html, manifest.webmanifest, sw.js
css/      tokens.css (kolory, odstępy), components.css (komponenty), app.css
js/       app.js (ekrany), formula.js (silnik formuł Devicelist), registry.js, icons.js
icons/    ikony PWA
data/
  catalog.js                 ← lista marek, rodzajów urządzeń i zestawów
  mitsubishi/
    mr-j4.js                 ← alarmy i ostrzeżenia MR-J4 (PL/EN)
    fr-e800.js               ← błędy falowników FR-E800 (PL/EN)
    fr-e800-param.js         ← parametry podstawowe FR-E800 (PL/EN)
    qd77-devicelist.js       ← adresy bufora QD77 (formuły z arkusza) + opisy PA08–PB11
  sanyu/
    sx1000.js                ← błędy falownika Sanyu SX1000
    sx1000-param.js          ← parametry falownika Sanyu SX1000 (z instrukcji sanyu.eu)
doc/      dokumenty źródłowe
```

Folder = marka, plik = seria urządzeń, a rodzaj urządzenia (`type`) jest polem w `catalog.js`. Dzięki temu ekran katalogu grupuje te same pliki raz według marki, raz według rodzaju.

## Dodanie nowego urządzenia

1. Utwórz plik `data/<marka>/<seria>.js`:

```js
ErrLib.addSet({
  id: 'fr-a800',
  cats:   { fault: { pl: 'Błędy', en: 'Faults', tone: 'danger' } },   // tone: danger | warn | muted
  labels: { desc: { pl: 'Opis', en: 'Description' }, remedy: { pl: 'Rozwiązanie', en: 'Remedy' } },
  source: 'doc/FR-A800_Manual.pdf',
  items: [
    { id: 'EOC1', code: 'E.OC1', alt: '', cat: 'fault', cls: null,
      name: { pl: 'Wyłączenie nadprądowe', en: 'Overcurrent trip' },
      secs: [ { k: 'desc', t: { pl: '…', en: '…' } }, { k: 'remedy', t: { pl: '…' } } ],
      info: [ ['data', '16 (H10)'] ] }
  ]
});
```

2. Dopisz zestaw w `data/catalog.js` (`sets`), a nową markę lub rodzaj w `brands` / `types`.
3. Dodaj ścieżkę pliku do listy `FILES` w `sw.js` i podbij `VERSION`.

Ulubione, ustawienia i notatki zapisują się w przeglądarce (localStorage) na danym urządzeniu. Notatki można przenieść między urządzeniami: Ustawienia → Notatki → „Zapisz kopię do pliku” / „Wczytaj kopię z pliku” (plik JSON).
