ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending';

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'feedback_review_status_check'
      AND conrelid = 'feedback'::regclass
  ) THEN
    ALTER TABLE feedback
      ADD CONSTRAINT feedback_review_status_check
      CHECK (review_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;
