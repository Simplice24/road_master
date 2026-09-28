import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Bulk-imports Q&A pairs extracted from IBIBAZO_NIBISUBIZO_+400.pdf into a single new Category.
 *
 * The source PDF marks each question's correct option in red (bold) text, and separately wraps
 * its letter in parentheses — e.g. "(c) toni 12" vs "b) toni 16" — as a second, redundant signal.
 * A one-off extraction script (not checked in) read both signals from the PDF's text-run colors
 * via PyMuPDF to build prisma/data/highway-code-questions.json.
 *
 * Deliberately excluded from that JSON (see prisma/data/highway-code-needs-review.json instead):
 *   - ~40 questions whose entire content (stem AND options) is a road-sign picture with zero
 *     extractable text — nothing to import.
 *   - ~70 questions sharing a generic stem like "Iki cyapa gisobanura iki?" ("What does this
 *     sign mean?") with OTHER questions that have the exact same stem but different correct
 *     answers — the only thing distinguishing them is a road-sign image, so importing any one of
 *     them under that shared, ambiguous stem would be misleading rather than merely incomplete.
 *   - A handful of structurally broken entries (e.g. all 4 options marked "correct" at once — an
 *     authoring error in the source PDF itself, not something this script can resolve).
 * Re-extracting those once there's a plan for hosting the associated sign images is future work.
 */

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL as string),
});

const CATEGORY_NAME =
  "Highway Code - General Knowledge (Amategeko Rusange y'Umuhanda)";
const DATA_FILE = path.join(__dirname, 'data', 'highway-code-questions.json');

interface SeedOption {
  text: string;
  isCorrect: boolean;
}

interface SeedQuestion {
  text: string;
  options: SeedOption[];
}

async function main() {
  const questions: SeedQuestion[] = JSON.parse(
    fs.readFileSync(DATA_FILE, 'utf-8'),
  );

  const category = await prisma.category.upsert({
    where: { name: CATEGORY_NAME },
    update: {},
    create: {
      name: CATEGORY_NAME,
      description:
        'Bulk-imported from IBIBAZO_NIBISUBIZO_+400.pdf. Text-only questions — road-sign questions that depend on an image not captured by extraction were left out; see prisma/data/highway-code-needs-review.json.',
    },
  });

  // Load existing question text for this category once, up front, rather than one findFirst
  // per row — this script is meant to be safely re-run (e.g. after fixing a few entries in the
  // JSON) without recreating everything that's already there.
  const existing = await prisma.question.findMany({
    where: { categoryId: category.id },
    select: { text: true },
  });
  const existingTexts = new Set(existing.map((q) => q.text));

  let created = 0;
  let skippedExisting = 0;
  let skippedMalformed = 0;

  for (const q of questions) {
    if (existingTexts.has(q.text)) {
      skippedExisting++;
      continue;
    }

    const correctCount = q.options.filter((o) => o.isCorrect).length;
    if (q.options.length !== 4 || correctCount !== 1) {
      console.warn(
        `Skipping malformed entry (expected 4 options / 1 correct, got ${q.options.length}/${correctCount}): ${q.text.slice(0, 70)}...`,
      );
      skippedMalformed++;
      continue;
    }

    await prisma.question.create({
      data: {
        categoryId: category.id,
        text: q.text,
        isActive: true,
        allowMultiple: false,
        options: {
          create: q.options.map((o) => ({
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        },
      },
    });
    created++;
  }

  console.log(`Category: "${category.name}" (${category.id})`);
  console.log(
    `Created ${created} new question(s), skipped ${skippedExisting} already present, ${skippedMalformed} malformed.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
