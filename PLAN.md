# Družina: plán

Česká náhrada D&D Beyond pro jednu konkrétní partu: kampaň **Lančák 2.0**, 6 hráčů + PJ, hraje se
u stolu a každý má postavu v telefonu. Pravidla D&D 2024 (SRD 5.2), postavy částečně z knih 2014.

## Co appka dělá a co ne

Dělá: karta postavy pro hru (hody, životy, pozice kouzel, zdroje povolání, stavy, odpočinky),
sdílený log hodů, obrazovka PJ s celou družinou, česky.

Nedělá: tvorbu postavy s automatikou pravidel, obchod s obsahem, mapy, účty a hesla.
Postavu jednou založí PJ (import z D&D Beyond nebo ruční formulář), pak se jen hraje.

## Postavy kampaně (D&D Beyond, 18. 11. 2026)

| Postava | Hráč | Druh | Povolání | Mimo SRD |
|---|---|---|---|---|
| Arés | robvsb | Hill Dwarf | Wizard 5, School of … | druh jen v SRD 5.1; škola neověřená |
| Dorrali | klecpetra | High Elf | Fighter 5, Rune Knight | druh jen v SRD 5.1; **Rune Knight není v SRD** |
| Kakoňfonix | jirkastajger | High Elf | Bard 5, College of … | druh jen v SRD 5.1; kolej neověřená |
| Oren (Zodi) | dpollec | Half-Orc | Barbarian 5, Path of the … | druh jen v SRD 5.1; stezka neověřená |
| Rakkar | dobiasma | Half-Elf | Cleric 5, Light Domain | druh jen v SRD 5.1; **Light Domain není v SRD** |
| Smerf | Hergersen | Gnome | úroveň 0, rozpracovaná | |

Z toho plyne: **import z D&D Beyond je jádro**, ne doplněk. Druhy jsou ze SRD 5.1 (CC-BY), pravidla
a kouzla ze SRD 5.2 (CC-BY), podtřídy mimo SRD se přeloží jen pro tyhle postavy a zůstanou
v databázi kampaně, nikdy v repozitáři.

## Fáze

| # | Co | Hotovo když |
|---|---|---|
| 1 | Kostra: kampaň, postavy, karta, hody, log, obrazovka PJ, živá synchronizace | jedna postava se dá ručně založit a odehrát na telefonu, PJ vidí hody |
| 2 | Slovník + český SRD (kouzla, schopnosti povolání, druhy, výsady, stavy) | klepnutí na kouzlo ukáže český text |
| 3 | Import z D&D Beyond (veřejná postava, JSON) + překlad textů mimo SRD | všech 6 postav převedeno, čísla sedí se screenshotem |
| 4 | PJ: iniciativa, nestvůry (anglicky stačí), skryté hody | jedno sezení odehrané souběžně s D&D Beyond |
| 5 | Pomocník pro postup na úroveň | jen pokud ruční úpravy začnou zdržovat |

**Stav 18. 11. 2026:** fáze 1 hotová (lokálně, nenasazeno). Fáze 2 první dávka: kouzla úrovně 0
až 3 (183), schopnosti všech povolání a SRD specializací do 5. úrovně (130), všechny druhy včetně
ras z 2014, výsady, původy a vlastnosti zbraní. Čeká na revizi rodilým hráčem. Zbývá: kouzla 4. až
9. úrovně, schopnosti od 6. úrovně. Známé díry ve zdroji (Open5e): seznam druidských kouzel je
useknutý, tabulka počtu divokých podob chybí.

Kontrolní bod po fázi 4: jedno sezení s oběma appkami vedle sebe, teprve pak D&D Beyond pustit.

## Architektura

Domácí šablona (stejně jako Deník obce Lukovany): React 19 + Vite + Tailwind 3 (`client/`),
Express 5 + Prisma + SQLite (`server/`), jeden image, GitHub Actions → GHCR → Watchtower,
sdílený Caddy v lankaparty stacku, `druzina.lankapp.cloud`.

- **Přístup bez účtů.** Kampaň má tři druhy odkazů: PJ (`/pj/<klíč>`, vše), družina
  (`/k/<klíč>`, jen čtení), postava (`/p/<klíč>`, hraní a úpravy jedné postavy). Klíč jde
  v hlavičce `X-Key`, ne v cookie, takže sdílená doména `*.lankapp.cloud` nevadí.
- **Živá data přes SSE** (`/api/events/<klíč>`): změna stavu postavy a nový hod se rozešlou
  všem v kampani. Sedm zařízení, žádná škálovací starost.
- **Postava = `sheet` + `state`.** `sheet` je statický popis (vlastnosti, zdatnosti, útoky,
  kouzla, schopnosti), mění se při postupu. `state` je hra (životy, pozice, zdroje, stavy).
  Oboje JSON v SQLite, schéma vlastní, nezávislé na D&D Beyond; importér do něj jen mapuje.
- **Kostky hází klient** (crypto.getRandomValues), server výsledek uloží a rozešle.
- **Offline:** karta se ukládá i do localStorage, změny se dorovnají po připojení.
- **Obsah SRD** se stáhne jednou (`scripts/fetch-srd.mjs`) do `data/srd-en/`, přeloží do
  `data/srd-cs/` a klient ho dostane jako statické JSON, které cachuje service worker.

## Překlad

1. `docs/slovnik.md`: pevné termíny, jednou dohodnuté. Zdroj: Jeskyně a draci (Mytago) tam,
   kde ho známe, jinak komunitní zvyklost. Termíny jdou do UI z jednoho souboru
   (`client/src/lib/cs.ts`), takže změna slova je jedna úprava.
2. Dávkový překlad SRD přes Claude API se slovníkem v promptu, výstup do `data/srd-cs/`.
3. Revize: jeden z hráčů, kteří umí jen česky, přečte stavy, kouzla úrovně 0 až 3 a schopnosti
   povolání do 5. úrovně. Tím je pokryto, co parta reálně použije.

## Licence

SRD 5.1 a SRD 5.2 © Wizards of the Coast, CC-BY-4.0, uvedeno v appce i v README. Bez jména
a loga D&D. Texty mimo SRD jen v databázi kampaně pro soukromou potřebu party.

## Otevřené otázky

- Které podtřídy jsou u Arése, Kakoňfonixe a Orena (screenshot je uřízl)?
- Jsou postavy v D&D Beyond veřejné? Import potřebuje sdílení „Public“.
- Hrajete podle pravidel 2024 i s postavami z 2014 (D&D Beyond to tak umí), nebo míchaně?
- Třída zbroje (TZ) nebo obranné číslo (OČ) z Dračího doupěte? Viz slovník.
