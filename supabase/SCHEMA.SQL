-- 1. Create Players Table
CREATE TABLE players (
    username TEXT PRIMARY KEY,
    total_kills INT DEFAULT 0,
    total_deaths INT DEFAULT 0,
    total_wins INT DEFAULT 0,
    total_games INT DEFAULT 0
);

-- 2. Create Match Results Table
CREATE TABLE match_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id TEXT,
    username TEXT REFERENCES players(username),
    kills INT DEFAULT 0,
    deaths INT DEFAULT 0,
    score INT DEFAULT 0,
    is_winner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. The Trigger (Auto-updates player totals)
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO players (username, total_kills, total_deaths, total_games, total_wins)
    VALUES (NEW.username, NEW.kills, NEW.deaths, 1, CASE WHEN NEW.is_winner THEN 1 ELSE 0 END)
    ON CONFLICT (username) DO UPDATE 
    SET 
        total_kills = players.total_kills + NEW.kills,
        total_deaths = players.total_deaths + NEW.deaths,
        total_games = players.total_games + 1,
        total_wins = players.total_wins + CASE WHEN NEW.is_winner THEN 1 ELSE 0 END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_match_result_insert
AFTER INSERT ON match_results
FOR EACH ROW EXECUTE FUNCTION update_player_stats();