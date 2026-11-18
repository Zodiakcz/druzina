# Jak překládat SRD

Návod pro překladové dávky (lidi i Claude). Termíny: [slovnik.md](slovnik.md). Jména kouzel:
[`data/srd-cs/spell-names.json`](../data/srd-cs/spell-names.json), jsou závazná.

## Pravidla

1. **Termíny jen ze slovníku.** Hit Points = životy, saving throw = záchranný hod, DC = SO,
   Constitution = Odolnost, resistance = rezistence. Vlastnosti s velkým písmenem (Síla,
   Obratnost…), stejně jako v originále.
2. **Kouzla jménem ze seznamu.** Když text zmíní jiné kouzlo (_Fireball_), použij české jméno
   ze `spell-names.json` kurzívou: _Ohnivá koule_. Kouzlo, které v seznamu není, přelož a za
   něj dej anglický originál v závorce.
3. **Kostky jako „k“:** 1d6 → 1k6, 2d8 + 3 → 2k8 + 3, d20 → k20.
4. **Míry zůstanou ve stopách:** 30 feet → 30 stop, 5-foot → 5stopý, 1 mile → 1 míle.
   Nepřepočítávej na metry, mapy i pravidla počítají se stopami.
5. **Struktura beze změn:** `**tučné**`, `_kurzíva_`, markdownové tabulky (`|...|`), odstavce
   a odrážky zůstanou na svém místě. Čísla, kostky a hodnoty se nemění.
6. **Česky přirozeně, ne doslova.** Hráč to čte uprostřed boje: krátké věty, oslovení „ty“
   (Your speed → tvá rychlost), žádné „vy“. Obecný tvor je „tvor“.
7. **Žádné dlouhé pomlčky (—).** Místo nich čárka, dvojtečka, tečka nebo závorka.
8. Neznámý nebo sporný termín: přelož podle nejlepšího vědomí a přidej klíč do pole
   `"poznamka"` u dané položky. Revize to projde.

## Formát

Vstup: pole položek `{key, name, text, higher?, material?, prerequisite?}`.
Výstup: stejné pole, stejné klíče `key`, ostatní pole přeložená. Pole, které ve vstupu chybí
nebo je prázdné, ve výstupu chybí. Nic nepřidávej, nic nevynechávej.
