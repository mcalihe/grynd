// Builds the bundled exercise catalog from free-exercise-db (The Unlicense / public domain).
//
//   pnpm catalog:import
//
// Output (committed):
//   public/data/exercises.json   catalog loaded into SQLite on first start
//   public/exercises/<key>.webp  160 px thumbnail of the first image
//
// Re-running keeps existing ids, so references from plans and backups stay valid.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { uuid7 } from '../src/app/core/utils/uuid7.ts';

const SOURCE_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const SOURCE = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${SOURCE_COMMIT}`;
const THUMB_WIDTH = 160;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'public/data/exercises.json');
const imageDir = join(root, 'public/exercises');
const namesDe = JSON.parse(
  await readFile(join(root, 'scripts/data/exercise-names.de.json'), 'utf8'),
);

/** First primary muscle → filter group used in the app (plan.md §8). */
const MUSCLE_GROUPS = {
  chest: 'chest',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  shoulders: 'shoulders',
  neck: 'shoulders',
  quadriceps: 'legs',
  hamstrings: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  glutes: 'glutes',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  abdominals: 'core',
};

async function fetchOk(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return response;
}

async function mapLimit(items, limit, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (queue.length) {
        await fn(queue.shift());
      }
    }),
  );
}

const source = await (await fetchOk(`${SOURCE}/dist/exercises.json`)).json();
const previous = existsSync(outFile)
  ? JSON.parse(await readFile(outFile, 'utf8'))
  : { exercises: [] };
const previousIds = new Map(previous.exercises.map((e) => [e.key, e.id]));

const missingNames = source.filter((e) => !namesDe[e.id]).map((e) => e.id);
if (missingNames.length) {
  throw new Error(`German names missing for: ${missingNames.join(', ')}`);
}
const unknownMuscles = source.filter(
  (e) => e.primaryMuscles[0] && !MUSCLE_GROUPS[e.primaryMuscles[0]],
);
if (unknownMuscles.length) {
  throw new Error(`Unmapped muscles: ${unknownMuscles.map((e) => e.primaryMuscles[0]).join(', ')}`);
}

await mkdir(imageDir, { recursive: true });
await mkdir(dirname(outFile), { recursive: true });

const exercises = source.map((e) => ({
  id: previousIds.get(e.id) ?? uuid7(),
  key: e.id,
  nameDe: namesDe[e.id],
  nameEn: e.name,
  primaryMuscles: e.primaryMuscles,
  secondaryMuscles: e.secondaryMuscles,
  muscleGroup: MUSCLE_GROUPS[e.primaryMuscles[0]] ?? null,
  force: e.force ?? null,
  equipment: e.equipment ?? null,
  level: e.level ?? null,
  category: e.category ?? null,
  images: e.images.length ? [`exercises/${e.id}.webp`] : [],
}));

let done = 0;
await mapLimit(
  source.filter((e) => e.images.length),
  12,
  async (e) => {
    const target = join(imageDir, `${e.id}.webp`);
    if (!existsSync(target)) {
      const image = Buffer.from(
        await (await fetchOk(`${SOURCE}/exercises/${e.images[0]}`)).arrayBuffer(),
      );
      await sharp(image).resize({ width: THUMB_WIDTH }).webp({ quality: 70 }).toFile(target);
    }
    if (++done % 100 === 0) {
      console.log(`thumbnails: ${done}`);
    }
  },
);

exercises.sort((a, b) => a.key.localeCompare(b.key));
await writeFile(
  outFile,
  JSON.stringify({ version: SOURCE_COMMIT.slice(0, 12), source: SOURCE, exercises }, null, 2) +
    '\n',
);
console.log(`wrote ${exercises.length} exercises, ${done} thumbnails`);
