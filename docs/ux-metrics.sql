-- Dietaday UX discovery MVP metrics (PostgreSQL, read-only).
-- Run using a read-only analytics role. Final results are aggregated; user,
-- meal, session, and exposure IDs are used only inside CTE joins.
--
-- Interpretation limits:
-- * meal_created is recorded after server synchronization. Offline delay moves
--   the measured activation/return time to the later synchronization time.
-- * meal_saved_locally telemetry is best-effort and may be lost while offline;
--   unmatched form sessions are an abandonment proxy, not confirmed abandonment.
-- * water_logged coverage depends on an active diet in the current frontend.
-- * deleting a diet cascades deletion of diet-scoped ux_events; account deletion
--   also removes that user's events. Historical cohorts therefore lose coverage.
-- * observational comparisons do not establish that hints caused a behavior change.

-- 1) Activation within 24 hours of registration and return on days 1-7 after
-- activation. Return windows are only counted after the full eight-day window
-- has elapsed: [activation + 1 day, activation + 8 days).
WITH first_meal AS (
    SELECT user_id, MIN(occurred_at) AS activation_at
    FROM ux_events
    WHERE event_name = 'meal_created'
    GROUP BY user_id
), registered_users AS (
    SELECT
        u.id AS user_id,
        DATE_TRUNC('week', u.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS cohort_week,
        u.created_at AS registered_at,
        fm.activation_at,
        (fm.activation_at >= u.created_at
            AND fm.activation_at < u.created_at + INTERVAL '24 hours') AS activated_24h
    FROM app_users u
    LEFT JOIN first_meal fm ON fm.user_id = u.id
    WHERE u.created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
), mature_activated_users AS (
    SELECT user_id, activation_at
    FROM registered_users
    WHERE activated_24h IS TRUE
      AND activation_at < CURRENT_TIMESTAMP - INTERVAL '8 days'
), returned_users AS (
    SELECT a.user_id,
           EXISTS (
               SELECT 1
               FROM ux_events e
               WHERE e.user_id = a.user_id
                 AND e.event_name IN ('meal_created', 'water_logged')
                 AND e.occurred_at >= a.activation_at + INTERVAL '1 day'
                 AND e.occurred_at < a.activation_at + INTERVAL '8 days'
           ) AS returned_days_1_to_7
    FROM mature_activated_users a
)
SELECT
    r.cohort_week,
    COUNT(*) AS registered_users,
    COUNT(*) FILTER (WHERE r.activated_24h IS TRUE) AS activated_within_24h,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE r.activated_24h IS TRUE) / NULLIF(COUNT(*), 0),
        1
    ) AS activation_rate_pct,
    COUNT(*) FILTER (
        WHERE r.activated_24h IS TRUE
          AND r.activation_at < CURRENT_TIMESTAMP - INTERVAL '8 days'
    ) AS mature_activated_users,
    COUNT(*) FILTER (WHERE ret.returned_days_1_to_7 IS TRUE) AS returned_days_1_to_7,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE ret.returned_days_1_to_7 IS TRUE)
        / NULLIF(COUNT(*) FILTER (
            WHERE r.activated_24h IS TRUE
              AND r.activation_at < CURRENT_TIMESTAMP - INTERVAL '8 days'
        ), 0),
        1
    ) AS return_rate_pct
FROM registered_users r
LEFT JOIN returned_users ret ON ret.user_id = r.user_id
GROUP BY r.cohort_week
ORDER BY r.cohort_week;

-- 2) Campaign exposure, click, dismissal, adoption within seven days, and
-- repeat exposure. A user is counted once per campaign/version in user totals;
-- exposure-level counts preserve separate visible exposures.
WITH exposures AS (
    SELECT
        user_id,
        details::jsonb ->> 'campaign' AS campaign,
        (details::jsonb ->> 'version')::integer AS campaign_version,
        details::jsonb ->> 'page' AS page,
        details::jsonb ->> 'exposureId' AS exposure_id,
        MIN(occurred_at) AS viewed_at
    FROM ux_events
    WHERE event_name = 'feature_hint_viewed'
    GROUP BY user_id,
             details::jsonb ->> 'campaign',
             (details::jsonb ->> 'version')::integer,
             details::jsonb ->> 'page',
             details::jsonb ->> 'exposureId'
), actions AS (
    SELECT
        user_id,
        details::jsonb ->> 'campaign' AS campaign,
        (details::jsonb ->> 'version')::integer AS campaign_version,
        details::jsonb ->> 'exposureId' AS exposure_id,
        BOOL_OR(event_name = 'feature_hint_clicked') AS clicked,
        BOOL_OR(event_name = 'feature_hint_dismissed') AS dismissed,
        MIN(occurred_at) FILTER (WHERE event_name = 'feature_adopted') AS adopted_at
    FROM ux_events
    WHERE event_name IN (
        'feature_hint_clicked', 'feature_hint_dismissed', 'feature_adopted'
    )
    GROUP BY user_id,
             details::jsonb ->> 'campaign',
             (details::jsonb ->> 'version')::integer,
             details::jsonb ->> 'exposureId'
), user_exposure_counts AS (
    SELECT user_id, campaign, campaign_version, COUNT(DISTINCT exposure_id) AS exposure_count
    FROM exposures
    GROUP BY user_id, campaign, campaign_version
)
SELECT
    e.campaign,
    e.campaign_version,
    e.page,
    DATE_TRUNC('week', e.viewed_at AT TIME ZONE 'America/Sao_Paulo')::date AS exposure_week,
    COUNT(*) AS visible_exposures,
    COUNT(DISTINCT e.user_id) AS exposed_users,
    COUNT(*) FILTER (WHERE a.clicked IS TRUE) AS clicked_exposures,
    COUNT(*) FILTER (WHERE a.dismissed IS TRUE) AS dismissed_exposures,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE a.dismissed IS TRUE) / NULLIF(COUNT(*), 0),
        1
    ) AS dismissed_rate_pct,
    COUNT(*) FILTER (
        WHERE a.adopted_at >= e.viewed_at
          AND a.adopted_at < e.viewed_at + INTERVAL '7 days'
    ) AS adopted_exposures_7d,
    COUNT(DISTINCT e.user_id) FILTER (
        WHERE a.adopted_at >= e.viewed_at
          AND a.adopted_at < e.viewed_at + INTERVAL '7 days'
    ) AS adopted_users_7d,
    ROUND(
        100.0 * COUNT(DISTINCT e.user_id) FILTER (
            WHERE a.adopted_at >= e.viewed_at
              AND a.adopted_at < e.viewed_at + INTERVAL '7 days'
        ) / NULLIF(COUNT(DISTINCT e.user_id), 0),
        1
    ) AS adoption_rate_pct,
    COUNT(DISTINCT e.user_id) FILTER (WHERE c.exposure_count > 1) AS repeat_exposure_users
FROM exposures e
LEFT JOIN actions a
       ON a.user_id = e.user_id
      AND a.campaign = e.campaign
      AND a.campaign_version = e.campaign_version
      AND a.exposure_id = e.exposure_id
LEFT JOIN user_exposure_counts c
       ON c.user_id = e.user_id
      AND c.campaign = e.campaign
      AND c.campaign_version = e.campaign_version
GROUP BY e.campaign, e.campaign_version, e.page, exposure_week
ORDER BY exposure_week, e.campaign, e.campaign_version, e.page;

-- 3) Time from form entry to local persistence and an abandonment proxy.
-- A form session is observed only when both paired best-effort events reach
-- the backend. Sessions without a save after 24 hours are not confirmed exits.
WITH form_starts AS (
    SELECT
        user_id,
        details::jsonb ->> 'formSessionId' AS form_session_id,
        MIN(occurred_at) AS started_at
    FROM ux_events
    WHERE event_name = 'meal_form_started'
      AND details::jsonb ->> 'formSessionId' IS NOT NULL
    GROUP BY user_id, details::jsonb ->> 'formSessionId'
), local_saves AS (
    SELECT
        user_id,
        details::jsonb ->> 'formSessionId' AS form_session_id,
        MIN(occurred_at) AS saved_at
    FROM ux_events
    WHERE event_name = 'meal_saved_locally'
      AND details::jsonb ->> 'formSessionId' IS NOT NULL
    GROUP BY user_id, details::jsonb ->> 'formSessionId'
), form_sessions AS (
    SELECT
        s.user_id,
        s.form_session_id,
        s.started_at,
        MIN(l.saved_at) FILTER (
            WHERE l.saved_at >= s.started_at
              AND l.saved_at < s.started_at + INTERVAL '24 hours'
        ) AS saved_within_24h
    FROM form_starts s
    LEFT JOIN local_saves l
           ON l.user_id = s.user_id
          AND l.form_session_id = s.form_session_id
    WHERE s.started_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
      AND s.started_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
    GROUP BY s.user_id, s.form_session_id, s.started_at
), attributed_forms AS (
    SELECT
        f.started_at,
        f.saved_within_24h,
        exposure.campaign,
        exposure.campaign_version
    FROM form_sessions f
    LEFT JOIN LATERAL (
        SELECT
            e.details::jsonb ->> 'campaign' AS campaign,
            (e.details::jsonb ->> 'version')::integer AS campaign_version
        FROM ux_events e
        WHERE e.user_id = f.user_id
          AND e.event_name = 'feature_hint_viewed'
          AND e.occurred_at <= f.started_at
          AND e.occurred_at > f.started_at - INTERVAL '7 days'
        ORDER BY e.occurred_at DESC
        LIMIT 1
    ) exposure ON TRUE
)
SELECT
    COALESCE(campaign, 'no_recent_hint') AS campaign,
    campaign_version,
    DATE_TRUNC('week', started_at AT TIME ZONE 'America/Sao_Paulo')::date AS form_start_week,
    COUNT(*) AS mature_form_sessions,
    COUNT(*) FILTER (WHERE saved_within_24h IS NOT NULL) AS locally_saved_within_24h,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE saved_within_24h IS NOT NULL) / NULLIF(COUNT(*), 0),
        1
    ) AS local_save_rate_pct,
    COUNT(*) FILTER (WHERE saved_within_24h IS NULL) AS abandonment_proxy_24h,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (saved_within_24h - started_at))
    ) FILTER (WHERE saved_within_24h IS NOT NULL) AS median_seconds_to_local_save,
    PERCENTILE_CONT(0.9) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (saved_within_24h - started_at))
    ) FILTER (WHERE saved_within_24h IS NOT NULL) AS p90_seconds_to_local_save
FROM attributed_forms
GROUP BY campaign, campaign_version, form_start_week
ORDER BY form_start_week, campaign, campaign_version;
