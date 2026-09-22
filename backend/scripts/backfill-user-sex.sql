\set ON_ERROR_STOP on

-- Idempotent production data correction for the two existing accounts.
DO $$
DECLARE
    keven_count INTEGER;
    allana_count INTEGER;
BEGIN
    SELECT count(*) INTO keven_count
      FROM app_users
     WHERE lower(email) = lower('lkeven77@gmail.com');
    SELECT count(*) INTO allana_count
      FROM app_users
     WHERE lower(email) = lower('allanagomes7126@gmail.com');

    IF keven_count <> 1 THEN
        RAISE EXCEPTION 'Expected one Keven account, found %', keven_count;
    END IF;
    IF allana_count <> 1 THEN
        RAISE EXCEPTION 'Expected one Allana account, found %', allana_count;
    END IF;
END $$;

UPDATE app_users
   SET sex = 'MALE'
 WHERE lower(email) = lower('lkeven77@gmail.com');

UPDATE app_users
   SET sex = 'FEMALE'
 WHERE lower(email) = lower('allanagomes7126@gmail.com');

SELECT email, sex
  FROM app_users
 WHERE lower(email) IN (lower('lkeven77@gmail.com'), lower('allanagomes7126@gmail.com'))
 ORDER BY lower(email);
