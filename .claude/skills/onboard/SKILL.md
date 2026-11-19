---
name: onboard
description: Onboard a D&D Beyond character into a Družina campaign - import, check the build against the rules, translate its texts to Czech, set up the effects (Rage, Reckless Attack...) and save. Use when the GM sends D&D Beyond character links, says /onboard, or wants a character re-imported after a level-up.
---

# Onboarding a character

The GM (Ferin, or David on his behalf) runs this once per new character and again after a
level-up. Players build in D&D Beyond; this turns the build into a sheet that plays well at
the table. Nothing reaches the campaign until the GM says yes in step 6.

Everything goes through `scripts/onboard.mjs` (read its header for the commands). Run it as:

```
DRUZINA_GM='<GM link>' node --experimental-strip-types --no-warnings scripts/onboard.mjs <command> ...
```

## 0. What you need

- **The GM link** (`https://druzina.lankapp.cloud/pj/<key>`). Ask for it if `DRUZINA_GM` is not
  set. Use it only in that environment variable: never write it to a file, a commit or a message
  to anyone. For a dry run, the local dev GM link (`http://localhost:5190/pj/<key>`) works the
  same way.
- **The D&D Beyond links**, one per character. The characters must be public in D&D Beyond.

Several characters: go through them one at a time, steps 1 to 7 each.

## 1. Pull

`pull <D&D Beyond link>` imports into a draft in the OS temp folder and prints the report. It
recognises a character that is already in the campaign (same D&D Beyond id): saving then
updates that character, keeps its state (HP, uses spent, items), its notes, portrait, Czech
texts whose English did not change, and its effects.

## 2. Check the build

Go through the report's rules section and list what the GM should look at. Report, never fix:
the GM settles it with the player.

- **Rulebook.** The group plays 2014 class features and species with 2024 weapons (mastery).
  Flag a 2024 class, subclass or species, and any `#id` source you cannot place (look the item
  up on dndbeyond.com if needed).
- **Homebrew** anything, and D&D Beyond settings where feat or multiclass rules are not enforced.
- **Hidden feats** (story or origin boons): ask the GM whether they gave them.
- **Numbers.** A final ability above 20. Feats and ability score increases that do not fit the
  class levels (increases at 4, 8, 12, 16, 19; fighter also 6 and 14; rogue also 10). Multiclass
  without 13 in the abilities both classes need. More than 3 attuned items.
- **Importer warnings**, and any attack without an ability (`no ability`): effects like Rage
  cannot reach it. Fix those on the draft only if the GM agrees.

## 3. Translate

Feature and spell texts from D&D Beyond arrive in English. SRD spells already have our Czech.

1. `tr-in <ddbId>` writes the texts in batches (`tr-in-<n>.json`).
2. Start one subagent per batch, all in parallel, with `model: "haiku"` and this prompt (fill
   in the paths, the repo root is the current working directory):

   > Translate D&D rules text from English to Czech. First read `<repo>/docs/preklad.md` (the
   > rules, binding), `<repo>/docs/slovnik.md` (the terms) and
   > `<repo>/data/srd-cs/spell-names.json` (Czech spell names, binding). The input
   > `<tr-in-n.json>` is a JSON array of `{key, name, text}`. Write `<tr-out-n.json>`: the same
   > array, same keys in the same order, `name` and `text` translated by those rules (dice as
   > 1k6, feet as stop, no long dashes, the "ty" form, markdown kept). Write only that file and
   > reply "done".

3. `tr-merge <ddbId>` checks every text (the checks of `scripts/merge-translations.mjs`) and
   folds the good ones into the draft. For refused ones, run one more Haiku round on just those
   with the problems named; whatever fails twice stays English (the sheet says "zatím anglicky").

These texts are D&D Beyond's book text: they go into the campaign database only, never into the
repo.

## 4. Effects

An effect is something the player switches on at the table that changes other rolls. The
numbers that are always true (a +1 weapon, Archery style, Unarmored Defense) are already in the
imported sheet: an effect for them would count them twice.

For each feature, spell and magic item, decide one of three:

- **Preset**: `effect <ddbId> add <key>`. Keys: `rage`, `reckless`, `bless`, `huntersMark`,
  `dodge`. The report lists the ones that match the sheet. Presets follow the level (Rage +2/+3/+4).
- **Custom effect** inside the vocabulary: write a JSON file (in the temp folder, next to the
  draft) and `effect <ddbId> json <file>`. The vocabulary, and nothing more:
  - `mods`: `{on, ability, bonus, mode}`. `on` is `attack`, `damage`, `check`, `save`, `ac` or
    `speed`. `ability` limits it to rolls of that ability (`str`...) or `''` for all; attacks
    match by their own ability. `bonus` is `"2"`, `"-5"`, `"1d6"` (AC and speed: a number).
    `mode` is `adv`, `dis` or `normal` (attack, check, save only).
  - `resist`: damage types as Czech text. `noSpells`: no casting and no concentration.
  - `resourceId`: the resource whose use switches it on (ids are in the draft).
  - `text`: the reminder shown while it is on, in Czech, short.

  ```json
  {
    "name": "Mistr těžkých zbraní",
    "mods": [{ "on": "attack", "ability": "str", "bonus": "-5" }, { "on": "damage", "ability": "str", "bonus": "10" }],
    "text": "Jen těžké zbraně na blízko, se zdatností."
  }
  ```
- **Text only**: everything else (reactions, once-per-turn extras like Divine Fury, effects on
  other creatures). A bonus that applies only to the first hit in a turn must not be a damage
  mod: with Extra Attack it would land on every hit. Put such a line into the `text` of the
  effect it belongs to (Divine Fury into Rage's reminder) or leave it to the feature text.

Bless and similar spells cast on others belong on the **target's** sheet: offer `bless` for every
character when a party member can cast it.

When a custom effect would serve other characters too (Bladesong, Shield of Faith, a common
feat), add it as a preset in `client/src/lib/effects.ts` (`PRESETS`, `match` with the English and
Czech name, `scale` if it grows with level) with a test in `effects.test.ts`, run `npm test` in
`client/`, and offer the GM a commit and push. The character itself does not wait for that
deploy: its custom effect is already on the draft.

## 5. Report

`report <ddbId>` shows the final draft. Give the GM one summary:

- the rules findings from step 2, or "nothing to flag"
- translation: how many texts are Czech, which stayed English
- effects: what is set up, and what stays text and why

## 6. Save, only after the GM's yes

`save <ddbId>` creates the character or updates it. It prints the player's link: give it to the
GM to send to the player. Never send it to anyone yourself.

## 7. Clean up

The draft folder (`<temp>/druzina-onboard/<ddbId>`) can stay until the GM is done; it holds book
text, so it never goes into the repo.
