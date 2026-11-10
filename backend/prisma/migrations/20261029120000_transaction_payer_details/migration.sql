-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `payerPhone` VARCHAR(20) NULL,
    ADD COLUMN `cardHolderName` VARCHAR(100) NULL,
    ADD COLUMN `cardBrand` VARCHAR(20) NULL,
    ADD COLUMN `cardLast4` CHAR(4) NULL,
    ADD COLUMN `cardExpiryMonth` TINYINT NULL,
    ADD COLUMN `cardExpiryYear` SMALLINT NULL;
