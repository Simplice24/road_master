import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

/**
 * One-off: restores the source-PDF option order for questions imported by
 * seed-highway-code.ts. The `option_position_and_question_soft_delete` migration backfilled
 * Option.position in id order (random UUIDs — the order users already saw), because options
 * have no createdAt to recover insertion order from. The importer's JSON still has the PDF's
 * a/b/c/d order, and it matters: options like "A na B ni ibisubizo by'ukuri" ("A and B are
 * correct") only make sense in that order.
 *
 * A question is only touched when it matches exactly: same stem, same set of option texts
 * (one-to-one), same correct option. Anything an admin has edited since import is left alone
 * and reported. Idempotent — re-running sets the same positions again.
 *
 * Run: npx ts-node -r tsconfig-paths/register prisma/backfill-option-positions.ts [--dry-run]
 */

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL as string),
});

const DATA_FILE = path.join(__dirname, 'data', 'highway-code-questions.json');
const DRY_RUN = process.argv.includes('--dry-run');

interface SeedQuestion {
  text: string;
  options: { text: string; isCorrect: boolean }[];
}

async function main() {
  const source: SeedQuestion[] = JSON.parse(
    fs.readFileSync(DATA_FILE, 'utf-8'),
  );
  const byText = new Map(source.map((q) => [q.text, q]));

  const questions = await prisma.question.findMany({
    where: { text: { in: [...byText.keys()] } },
    select: {
      id: true,
      text: true,
      options: { select: { id: true, text: true, isCorrect: true, position: true } },
    },
  });

  let restored = 0;
  let alreadyOrdered = 0;
  const skipped: string[] = [];

  for (const question of questions) {
    const wanted = byText.get(question.text)!;
    const sourceTexts = wanted.options.map((o) => o.text);

    const unambiguous =
      new Set(sourceTexts).size === sourceTexts.length &&
      question.options.length === sourceTexts.length;
    const targets = question.options.map((option) => ({
      option,
      index: sourceTexts.indexOf(option.text ?? ''),
    }));
    const oneToOne =
      unambiguous &&
      targets.every(({ index }) => index >= 0) &&
      new Set(targets.map(({ index }) => index)).size === targets.length;
    const sameAnswer =
      oneToOne &&
      targets.every(
        ({ option, index }) => option.isCorrect === wanted.options[index].isCorrect,
      );

    if (!sameAnswer) {
      skipped.push(`${question.id}  ${question.text.slice(0, 60)}…`);
      continue;
    }

    if (targets.every(({ option, index }) => option.position === index)) {
      alreadyOrdered++;
      continue;
    }

    if (!DRY_RUN) {
      await prisma.$transaction(
        targets.map(({ option, index }) =>
          prisma.option.update({
            where: { id: option.id },
            data: { position: index },
          }),
        ),
      );
    }
    restored++;
  }

  console.log(`${DRY_RUN ? '[dry run] ' : ''}Matched ${questions.length} of ${source.length} source questions.`);
  console.log(`Restored PDF order on ${restored}, already in order ${alreadyOrdered}, skipped ${skipped.length}.`);
  if (skipped.length > 0) {
    console.log('Skipped (edited since import or ambiguous — reorder these in the admin UI):');
    for (const line of skipped) console.log(`  ${line}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
