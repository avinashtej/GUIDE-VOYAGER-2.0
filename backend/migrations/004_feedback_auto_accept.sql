BEGIN;

ALTER TABLE feedback
  ALTER COLUMN review_status SET DEFAULT 'approved';

UPDATE feedback
SET review_status = 'approved', reviewed_by = NULL, reviewed_at = NULL
WHERE review_status = 'pending';

COMMIT;
