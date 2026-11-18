# Družina

Czech play sheet and GM screen for one D&D group (campaign "Lančák 2.0", 6 players + GM,
in person, phones at the table). Replaces D&D Beyond at the table, not as a builder.
Plan, phases and open questions: [PLAN.md](PLAN.md). Czech terms: [docs/slovnik.md](docs/slovnik.md).

## The product rule

Players only play. A character is set up once (D&D Beyond import or the form), then the sheet
is for rolling and tracking. Before adding rule automation, ask whether a Czech-only player at
the table needs it mid-session. Default answer: no; a free-text field beats a rules engine.

## Model

- **Campaign**: `gmKey` (everything), `partyKey` (read-only party view). Characters have their
  own `key` (play and edit that one character). Keys travel in the URL path on the client and
  in the `X-Key` header on the API. No accounts, no cookies, so the shared `*.lankapp.cloud`
  site does not matter.
- **Character**: `sheet` (static, changes on level-up) and `state` (HP, slots, resources,
  conditions), both JSON strings validated by zod in `server/src/schema.ts`. The types live in
  `client/src/lib/types.ts` and must match. Derived numbers (modifiers, proficiency bonus,
  passives, spell DC) are computed on the client in `client/src/lib/rules.ts`, never stored.
- **Roll**: the client rolls (crypto RNG), the server stores and broadcasts. Kept forever, the
  log shows the last 100.
- **Live updates**: SSE at `/api/events` (key in `?key=`, EventSource cannot set headers).
  Events: `character` (public view, no key), `roll`, `removed`.

## Content

`scripts/fetch-srd.mjs` pulls SRD 5.2 (+ SRD 5.1 legacy races) from Open5e into
`data/srd-en/`. Both SRDs are CC-BY-4.0; the attribution is in the footer and README.

Translation pipeline: batches in `data/srd-cs/_in/<batch>.json` (gitignored), translated per
[docs/preklad.md](docs/preklad.md) into `_out/<batch>.json`, then
`node scripts/merge-translations.mjs` checks each batch against its input (same keys, no long
dashes, no English dice or feet, nothing suspiciously short) and folds it into the committed
`data/srd-cs/{spells,features,misc}.json`. Spell names are fixed up front in
`data/srd-cs/spell-names.json` so every batch names cross-referenced spells the same way.
`node scripts/build-content.mjs` then writes `client/public/srd/{spells,features}.json`
(English with Czech fields merged in; the UI prefers Czech and labels what is still English). Text from outside the SRD (Rune Knight, Light Domain, ...) is
never committed: it lives only in the campaign database.

## D&D Beyond import

`server/src/ddb.ts`. The server fetches `character-service.dndbeyond.com/character/v5/character/<id>`
(public characters only; the browser cannot, CORS) and maps it in `mapCharacter`. Nothing is saved
by `POST /api/import/ddb`: the GM reviews the result in the editor and saves.

- D&D Beyond computes most numbers client-side, so we recompute: abilities from base + bonus +
  modifiers (`choose-an-ability-score` is ignored: it is the leftover of an option not taken),
  AC from equipped armor or `set unarmored-armor-class` (+ the stat in `statId`), HP from base +
  Con × level, attacks from equipped weapons, resources from `actions.*.limitedUse`.
  Verified on Oren (160170320) against D&D Beyond: HP 64, AC 15, passives 13/9/10, speed 40.
- The group's characters are mixed: 2014 class features, 2024 weapons with mastery. So feature
  and spell texts are D&D Beyond's own, kept in `nameEn`/`textEn`; `text === textEn` means not yet
  translated (the sheet says "zatím anglicky"). SRD spells get our key and Czech text instead.
- Re-import (`characterId` given) keeps the Czech name/text of every feature or spell whose
  English original is unchanged, keeps notes and portrait, and never touches `state`.
- Never commit a D&D Beyond JSON: it carries non-SRD book text.

## Stack and layout

React 19 + Vite + Tailwind 3 (`client/`), Express 5 + Prisma + SQLite (`server/`). One image:
the server serves the built client from `public/`. Czech UI, all labels from
`client/src/lib/cs.ts`. Dark zinc with an amber accent.

Dev: `server/.env` with `DATABASE_URL=file:./dev.db` and `CREATE_KEY=dev`, then `npm run dev`
in both folders (client on 5173 proxies `/api` to 3000). `npm run seed` in `server/` makes a
demo campaign and prints its links. Schema changes: `npx prisma migrate dev --name x`; the
container runs `prisma migrate deploy` on start.

## Deploy

GitHub Actions → `ghcr.io/zodiakcz/druzina:{latest,sha-xxxxxxx}` → Watchtower.
`deploy/docker-compose.yml` publishes `172.17.0.1:8096` on the Docker VM (port not yet checked
live, see HomeLab `docs/network.md`); the shared Caddy in the lankaparty stack routes
`druzina.lankapp.cloud` there. Push needs `git config credential.username Zodiakcz`.
