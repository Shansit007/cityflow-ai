-- What a recommendation was avoiding, kept with the recommendation.
--
-- The naive counterfactual was already stored so the product's claim could be audited
-- after the fact. These are the same argument: without them a recommendation read back
-- tomorrow says when to leave but not why, and "why" is the only part a traveller can
-- disagree with.
ALTER TABLE recommendations
    ADD COLUMN overflow_at_plan    numeric(10, 2) NOT NULL DEFAULT 0 CHECK (overflow_at_plan >= 0),
    ADD COLUMN overflow_at_usual   numeric(10, 2) NOT NULL DEFAULT 0 CHECK (overflow_at_usual >= 0),
    ADD COLUMN roads_over_at_plan  smallint NOT NULL DEFAULT 0 CHECK (roads_over_at_plan >= 0),
    ADD COLUMN roads_over_at_usual smallint NOT NULL DEFAULT 0 CHECK (roads_over_at_usual >= 0);

COMMENT ON COLUMN recommendations.overflow_at_usual IS
    'Excess over segment capacity this vehicle would have added by leaving at the '
    'habitual time: squared and summed over the path, so it is comparable between '
    'candidate times rather than a physical quantity on its own.';
COMMENT ON COLUMN recommendations.roads_over_at_usual IS
    'The same comparison as a count of segments, which is what the traveller is shown. '
    'Stored alongside rather than derived because the objective it comes from may be '
    'retuned, and an old recommendation should still say what it meant at the time.';
