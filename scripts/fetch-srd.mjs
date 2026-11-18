// Pulls the SRD content we use from the Open5e v2 API into data/srd-en/<document>/<endpoint>.json.
// Run once (and again only when Open5e fixes something): node scripts/fetch-srd.mjs
//
// SRD 5.2 (srd-2024) is the rules base. SRD 5.1 (srd-2014) is pulled only for what the group's
// characters still use from the 2014 books: the legacy races (Hill Dwarf, High Elf, Half-Orc,
// Half-Elf). Both SRDs are CC-BY-4.0, Wizards of the Coast.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'srd-en');
const API = 'https://api.open5e.com/v2';

const PULLS = {
  'srd-2024': ['spells', 'classes', 'species', 'backgrounds', 'feats', 'weapons', 'armor', 'items',
    'rules', 'skills', 'weaponproperties'],
  'srd-2014': ['species'],
};

// Open5e repeats the whole document object on every row; drop it and other noise.
function strip(row) {
  const { document, crossreferences, ...rest } = row;
  return rest;
}

async function fetchAll(doc, endpoint) {
  const rows = [];
  let url = `${API}/${endpoint}/?document__key=${doc}&limit=100&format=json`;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const page = await res.json();
    rows.push(...page.results.map(strip));
    url = page.next;
  }
  return rows.sort((a, b) => a.key.localeCompare(b.key));
}

for (const [doc, endpoints] of Object.entries(PULLS)) {
  await mkdir(join(ROOT, doc), { recursive: true });
  for (const endpoint of endpoints) {
    const rows = await fetchAll(doc, endpoint);
    await writeFile(join(ROOT, doc, `${endpoint}.json`), JSON.stringify(rows, null, 1) + '\n');
    console.log(`${doc}/${endpoint}: ${rows.length}`);
  }
}
