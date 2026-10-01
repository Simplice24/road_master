-- AlterTable
ALTER TABLE `options` ADD COLUMN `position` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `questions` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `options_questionId_position_idx` ON `options`(`questionId`, `position`);

-- Backfill: give every existing option a stable 0-based position within its question, in id
-- order — the order MySQL/MariaDB was already returning them in (via the questionId index),
-- so nothing users see changes. Imported questions are then restored to their source-PDF order
-- by the one-off prisma/backfill-option-positions.ts script.
UPDATE `options` o
JOIN (
    SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `questionId` ORDER BY `id`) - 1 AS `pos`
    FROM `options`
) ranked ON ranked.`id` = o.`id`
SET o.`position` = ranked.`pos`;
