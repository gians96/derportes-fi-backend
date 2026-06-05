ALTER TABLE `Team`
  ADD COLUMN `cycle` VARCHAR(191) NULL,
  ADD COLUMN `section` VARCHAR(191) NULL;

UPDATE `Team` t
SET
  `cycle` = (
    SELECT p.`cycle`
    FROM `Participant` p
    WHERE p.`teamId` = t.`id` AND p.`cycle` IS NOT NULL
    ORDER BY p.`isDelegate` DESC, p.`id` ASC
    LIMIT 1
  ),
  `section` = (
    SELECT p.`section`
    FROM `Participant` p
    WHERE p.`teamId` = t.`id` AND p.`section` IS NOT NULL
    ORDER BY p.`isDelegate` DESC, p.`id` ASC
    LIMIT 1
  );

ALTER TABLE `Participant`
  DROP COLUMN `cycle`,
  DROP COLUMN `section`;
