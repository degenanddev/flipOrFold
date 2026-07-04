-- One-time cleanup after security audit tests:
-- Real account was renamed to "Hacked" via open PATCH before 005; a ghost "Mawsse" row blocked restore.

-- Free the name from any leftover test/duplicate rows
update players
set username = 'legacy_' || substr(id::text, 1, 8)
where lower(trim(username)) = 'mawsse';

-- Restore the original player account
update players
set username = 'Mawsse'
where id = '909e2325-871c-4d94-9ecc-b928a97a578f';

-- Remove fake score injected during security test
delete from game_scores
where id = '08429102-9847-4326-968e-799e6f5911bb';
