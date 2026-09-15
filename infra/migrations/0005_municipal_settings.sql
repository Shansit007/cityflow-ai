-- The severity above which a defect is treated as priority is a policy decision, not a
-- constant: it depends on how many crews a city has and what else is in the queue. The
-- head of road maintenance sets it, and it is stored per city because two cities on one
-- deployment will not agree on it.

CREATE TABLE municipal_settings (
    city                char(3) PRIMARY KEY REFERENCES cities(code),
    priority_threshold  numeric(4, 3) NOT NULL DEFAULT 0.600
        CHECK (priority_threshold BETWEEN 0 AND 1),
    updated_by          uuid REFERENCES municipal_users(id) ON DELETE SET NULL,
    updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN municipal_settings.priority_threshold IS
    'Severity at or above which a defect is flagged priority in the queue. Changing it
     re-labels the existing queue rather than re-scoring it: severity is a property of
     the defect, priority is a property of this city''s current capacity to fix things.';

COMMENT ON COLUMN municipal_settings.updated_by IS
    'Who last moved the threshold. Nulled rather than cascaded when a staff account is
     removed, because the setting outlives the employee who chose it.';
