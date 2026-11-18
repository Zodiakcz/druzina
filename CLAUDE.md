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
`data/srd-en/`. Translations go to `data/srd-cs/`. Both SRDs are CC-BY-4.0; the attribution
is in the footer and README. Text from outside the SRD (Rune Knight, Light Domain, ...) is
never committed: it lives only in the campaign database.

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
