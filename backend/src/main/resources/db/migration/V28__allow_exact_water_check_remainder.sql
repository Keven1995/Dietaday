ALTER TABLE water_checks
    DROP CONSTRAINT ck_water_check_amount;

ALTER TABLE water_checks
    ADD CONSTRAINT ck_water_check_amount
    CHECK (amount_ml BETWEEN 1 AND 4000);
