# Družina

Česká karta postavy a obrazovka PJ pro hru podle D&D 5e (pravidla 2024, SRD 5.2). Hraje se u
stolu, každý má svou postavu v telefonu, PJ vidí celou družinu a všechny hody.

- Plán a fáze: [PLAN.md](PLAN.md)
- Slovník termínů: [docs/slovnik.md](docs/slovnik.md)
- Pro vývojáře a Claude: [CLAUDE.md](CLAUDE.md)

## Vývoj

```bash
cd server && npm install && npx prisma migrate dev && npm run seed && npm run dev
cd client && npm install && npm run dev
```

`server/.env`: `DATABASE_URL=file:./dev.db`, `CREATE_KEY=dev`. Seed vypíše odkazy na ukázkovou kampaň.

Obsah: `node scripts/fetch-srd.mjs` stáhne SRD z Open5e do `data/srd-en/`,
`node scripts/build-content.mjs` z něj (a z překladů v `data/srd-cs/`) postaví `client/public/srd/`.

## Licence obsahu

Pravidla a texty kouzel pocházejí ze System Reference Document 5.2 a 5.1 © Wizards of the Coast
LLC, dostupných pod licencí [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode).
Překlady jsou upravená díla pod stejnou licencí. Družina není produkt Wizards of the Coast a
nepoužívá jejich ochranné známky.
