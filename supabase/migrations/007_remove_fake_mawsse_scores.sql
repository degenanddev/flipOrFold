-- Remove remaining fake scores from security audit (max-bound test injections)
delete from game_scores
where player_id = '909e2325-871c-4d94-9ecc-b928a97a578f'
  and score = 50000;
