// Takes the README screenshots (light and dark, English) from a running dev server.
//
//   pnpm start                            # in another terminal
//   node scripts/readme-screenshots.mjs   # BASE_URL=http://localhost:4300 to use another server
//
// Loads a generated demo backup (three plans, ten weeks of workouts) through the settings import,
// freezes the clock on a Sunday at the end of a month so «Today», the calendar and the statistics
// are filled, and writes docs/readme/screenshots/<screen>-<theme>.webp (committed).
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { uuid7 } from '../src/app/core/utils/uuid7.ts';

process.env.TZ = 'Europe/Zurich';
const NOW = new Date('2026-09-27T17:30:00+02:00');
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4200';
/** Phone viewport of the E2E tests, captured at 2x. */
const VIEWPORT = { width: 393, height: 852 };
const SCALE = 2;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs/readme/screenshots');

// ---------------------------------------------------------------------------------------------
// Demo data

/** [catalog key, sets, rep min, rep max, rest s, start kg (null = bodyweight), kg added per step] */
const PLANS = [
  {
    name: 'Push',
    weekdays: [1, 4],
    items: [
      ['Barbell_Bench_Press_-_Medium_Grip', 4, 6, 8, 150, 70, 2.5],
      ['Incline_Dumbbell_Press', 3, 8, 10, 120, 24, 2],
      ['Standing_Military_Press', 3, 6, 8, 120, 40, 2.5],
      ['Side_Lateral_Raise', 3, 12, 15, 60, 8, 1],
      ['Triceps_Pushdown', 3, 10, 12, 60, 25, 2.5],
    ],
  },
  {
    name: 'Pull',
    weekdays: [2, 5],
    items: [
      ['Pullups', 4, 6, 10, 120, null, 0],
      ['Bent_Over_Barbell_Row', 4, 8, 10, 120, 60, 2.5],
      ['Wide-Grip_Lat_Pulldown', 3, 10, 12, 90, 50, 2.5],
      ['Face_Pull', 3, 12, 15, 60, 20, 2.5],
      ['Barbell_Curl', 3, 8, 12, 60, 27.5, 2.5],
    ],
  },
  {
    name: 'Legs',
    weekdays: [3, 0],
    items: [
      ['Barbell_Full_Squat', 4, 5, 8, 180, 90, 5],
      ['Romanian_Deadlift', 3, 8, 10, 120, 80, 5],
      ['Leg_Press', 3, 10, 12, 120, 140, 10],
      ['Lying_Leg_Curls', 3, 10, 12, 60, 35, 2.5],
      ['Standing_Calf_Raises', 4, 12, 15, 60, 60, 5],
    ],
  },
];

const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();

/** Deterministic, so the screenshots only change when the UI does. */
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const between = (min, max) => min + Math.floor(random() * (max - min + 1));

async function demoBackup() {
  const catalog = JSON.parse(await readFile(join(root, 'public/data/exercises.json'), 'utf8'));
  const exerciseId = (key) => {
    const exercise = catalog.exercises.find((e) => e.key === key);
    if (!exercise) throw new Error(`Exercise ${key} is not in the catalog`);
    return exercise.id;
  };
  const base = (id, createdAt, updatedAt = createdAt) => ({
    id,
    createdAt: iso(createdAt),
    updatedAt: iso(updatedAt),
    deletedAt: null,
  });
  const data = {
    plan: [],
    plan_exercise: [],
    workout_session: [],
    session_exercise: [],
    exercise_interval: [],
    set_log: [],
  };

  const created = NOW.getTime() - 80 * DAY;
  for (const plan of PLANS) {
    plan.id = uuid7(created);
    data.plan.push({
      ...base(plan.id, created),
      name: plan.name,
      weekdays: JSON.stringify(plan.weekdays),
    });
    for (const [position, [key, targetSets, repMin, repMax, restSeconds]] of plan.items.entries()) {
      data.plan_exercise.push({
        ...base(uuid7(created), created),
        planId: plan.id,
        exerciseId: exerciseId(key),
        position,
        targetSets,
        repMin,
        repMax,
        restSeconds,
      });
    }
  }

  // Scheduled days of the last ten weeks up to yesterday, with a few skipped; today stays open.
  const today = new Date(NOW);
  today.setHours(0, 0, 0, 0);
  const done = new Map();
  for (let back = 70; back >= 1; back--) {
    const day = new Date(today.getTime() - back * DAY);
    const plan = PLANS.find((p) => p.weekdays.includes(day.getDay()));
    if (!plan || random() < (back > 35 ? 0.3 : 0.12)) continue;
    const count = (done.get(plan) ?? 0) + 1;
    done.set(plan, count);
    const step = Math.floor(count / 2);

    const start = new Date(day);
    start.setHours(between(17, 19), between(0, 50), between(0, 59), 0);
    const startedAt = start.getTime();
    let clock = startedAt;
    const sessionId = uuid7(clock);

    for (const [position, [key, sets, repMin, repMax, rest, kg, kgStep]] of plan.items.entries()) {
      const sessionExerciseId = uuid7(clock);
      data.session_exercise.push({
        ...base(sessionExerciseId, startedAt),
        sessionId,
        exerciseId: exerciseId(key),
        position,
        status: 'done',
        repMin,
        repMax,
        restSeconds: rest,
      });
      const enteredAt = (clock += 20_000);
      for (let set = 0; set < sets; set++) {
        clock += between(35, 60) * 1000;
        const target = kg === null ? 6 + Math.floor(step / 2) : repMax - set;
        data.set_log.push({
          ...base(uuid7(clock), startedAt, clock),
          sessionExerciseId,
          position: set,
          weightKg: kg === null ? null : kg + kgStep * step,
          reps: Math.max(repMin, Math.min(repMax, target - between(0, 1))),
          completedAt: iso(clock),
          isExtra: 0,
        });
        if (set < sets - 1) clock += (rest + between(-10, 30)) * 1000;
      }
      const leftAt = clock + 5_000;
      data.exercise_interval.push({
        ...base(uuid7(enteredAt), enteredAt, leftAt),
        sessionExerciseId,
        enteredAt: iso(enteredAt),
        leftAt: iso(leftAt),
      });
      clock = leftAt + between(60, 120) * 1000;
    }
    data.workout_session.push({
      ...base(sessionId, startedAt, clock),
      planId: plan.id,
      startedAt: iso(startedAt),
      finishedAt: iso(clock),
      status: 'finished',
    });
  }
  return { app: 'grynd', schemaVersion: 1, exportedAt: iso(NOW.getTime()), data };
}

// ---------------------------------------------------------------------------------------------
// Screenshots

const tmp = await mkdtemp(join(tmpdir(), 'grynd-screenshots-'));
const backupFile = join(tmp, 'demo-backup.json');
await writeFile(backupFile, JSON.stringify(await demoBackup()));
await mkdir(outDir, { recursive: true });

// Rounded corners and a neutral hairline, so the screens stand out on GitHub's light and dark theme.
const [width, height, radius] = [VIEWPORT.width * SCALE, VIEWPORT.height * SCALE, 28 * SCALE];
const svg = (shape) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shape}</svg>`,
  );
const ROUNDED_MASK = svg(`<rect width="${width}" height="${height}" rx="${radius}"/>`);
const HAIRLINE = svg(
  `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${radius - 1}" fill="none" stroke="#8b8b94" stroke-opacity="0.35" stroke-width="2"/>`,
);

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: SCALE,
      colorScheme: theme,
      reducedMotion: 'reduce',
      locale: 'en-US',
      timezoneId: process.env.TZ,
    });
    await context.addInitScript((t) => {
      const settings = { theme: t, unit: 'kg', lang: 'en', timerAutostart: true };
      localStorage.setItem('CapacitorStorage.grynd.settings', JSON.stringify(settings));
    }, theme);
    await context.clock.setFixedTime(NOW);
    const page = await context.newPage();
    const shot = async (name) => {
      await page.waitForTimeout(1000);
      const png = await page.screenshot();
      await sharp(png)
        .composite([{ input: ROUNDED_MASK, blend: 'dest-in' }, { input: HAIRLINE }])
        .webp({ quality: 88 })
        .toFile(join(outDir, `${name}-${theme}.webp`));
      console.log(`${name}-${theme}.webp`);
    };

    await page.goto(`${BASE_URL}/settings`);
    await page.getByRole('button', { name: 'Import' }).waitFor({ timeout: 60_000 });
    await page.locator('input[type=file]').setInputFiles(backupFile);
    await page.getByRole('button', { name: 'Replace' }).click();
    await page.getByText('Backup restored').waitFor();
    await page.getByText('Backup restored').waitFor({ state: 'hidden', timeout: 15_000 });

    await page.goto(`${BASE_URL}/plans`);
    await page.getByText('Today', { exact: false }).first().waitFor();
    await shot('plans');

    for (const view of ['list', 'calendar', 'stats']) {
      await page.goto(`${BASE_URL}/history${view === 'list' ? '' : `?view=${view}`}`);
      await page.waitForTimeout(1000);
      await shot(view === 'list' ? 'history' : view);
    }
    await page.goto(`${BASE_URL}/history`);
    await page.getByRole('button', { name: /Push/ }).first().click();
    await page.waitForURL(/\/history\/.+/);
    await shot('history-detail');

    await page.goto(`${BASE_URL}/plans/new/add-exercises`);
    await page.getByRole('searchbox').waitFor();
    await shot('picker');

    // Plan detail, then a workout with two completed sets and the rest timer running
    await page.goto(`${BASE_URL}/plans`);
    await page.getByText('Legs').first().click();
    const start = page.getByRole('button', { name: 'Start workout' });
    await start.waitFor();
    await shot('plan-detail');
    await start.click();
    await page.waitForURL(/\/workout$/);
    const sets = page.locator('app-set-row');
    await sets.nth(0).getByRole('button', { name: 'Complete set' }).click();
    await page.waitForTimeout(600);
    await sets.nth(1).getByRole('button', { name: 'Complete set' }).click();
    await page.waitForTimeout(5000); // celebration badge fades out
    await shot('workout');

    await context.close();
  }
} finally {
  await browser.close();
  await rm(tmp, { recursive: true, force: true });
}
