-- AlterTable
ALTER TABLE `options` MODIFY `text` TEXT NULL;

-- AlterTable
ALTER TABLE `questions` MODIFY `text` TEXT NOT NULL,
    MODIFY `explanation` TEXT NULL;
