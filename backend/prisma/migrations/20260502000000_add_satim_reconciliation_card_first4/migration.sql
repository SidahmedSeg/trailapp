-- Add cardFirst4 to SatimReconciliation for stronger card verification on
-- the public reconciliation form (runner enters both first 4 and last 4).
-- Idempotent + nullable for backward compat with rows uploaded before this change.

ALTER TABLE "SatimReconciliation" ADD COLUMN IF NOT EXISTS "cardFirst4" TEXT;
