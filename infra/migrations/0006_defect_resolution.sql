-- A defect leaves the queue for a reason, and "resolved" on its own does not say
-- whether the hole was filled, the road was resurfaced, or the crew found nothing
-- there. The note is what the next person reading this row needs.

ALTER TABLE defect_reports
    ADD COLUMN resolution_note text,
    ADD COLUMN resolved_by uuid REFERENCES municipal_users(id) ON DELETE SET NULL;

-- NOT VALID applies the rule to every future write while leaving rows already in the
-- table alone. Defects resolved before this migration have no note and there is no
-- honest way to invent one for them; validating against them would either fail the
-- migration on a live database or invite somebody to backfill fiction. Run
--   ALTER TABLE defect_reports VALIDATE CONSTRAINT resolved_defects_are_explained;
-- once the old rows have been dealt with by a human.
ALTER TABLE defect_reports
    ADD CONSTRAINT resolved_defects_are_explained
    CHECK (
        status <> 'resolved'
        OR (resolved_at IS NOT NULL AND resolution_note IS NOT NULL)
    ) NOT VALID;

COMMENT ON CONSTRAINT resolved_defects_are_explained ON defect_reports IS
    'A resolution with no timestamp and no note is a row someone closed to clear their
     queue. Enforced here rather than in the dashboard so that a script, a migration or
     a future second client cannot skip it.';

COMMENT ON COLUMN defect_reports.resolved_by IS
    'Who closed it, which is not always who it was assigned to. Nulled rather than
     cascaded when a staff account is removed: the work still happened.';
