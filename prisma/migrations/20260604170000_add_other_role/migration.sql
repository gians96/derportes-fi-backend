ALTER TABLE `User`
  MODIFY `role` ENUM('OWNER_SYSTEM', 'ADMIN_SYSTEM', 'STUDENT', 'OTHER') NOT NULL DEFAULT 'STUDENT';

UPDATE `User`
SET `role` = 'OTHER',
    `facultyId` = NULL,
    `schoolId` = NULL
WHERE `role` = 'STUDENT'
  AND `studentCode` IS NULL
  AND `email` REGEXP '^[^0-9][^@]*@';
