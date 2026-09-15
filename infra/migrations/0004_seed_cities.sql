-- Every City ID references a city, so the cities the traveller app offers have to
-- exist before anyone can sign up. Previously rows appeared only as a side effect of
-- loading a road network, which meant the sign-up form could offer a city the database
-- would then reject.
--
-- Listing a city here is not a claim that its road network is loaded. It means an
-- identity can belong to it and routines can be saved against it; recommendations need
-- the extract, which is a separate step per city.

INSERT INTO cities (code, name, centroid, timezone) VALUES
    ('BLR', 'Bengaluru',  ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Asia/Kolkata'),
    ('BOM', 'Mumbai',     ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326)::geography, 'Asia/Kolkata'),
    ('DEL', 'Delhi',      ST_SetSRID(ST_MakePoint(77.2090, 28.6139), 4326)::geography, 'Asia/Kolkata'),
    ('HYD', 'Hyderabad',  ST_SetSRID(ST_MakePoint(78.4867, 17.3850), 4326)::geography, 'Asia/Kolkata'),
    ('MAA', 'Chennai',    ST_SetSRID(ST_MakePoint(80.2707, 13.0827), 4326)::geography, 'Asia/Kolkata'),
    ('PNQ', 'Pune',       ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326)::geography, 'Asia/Kolkata'),
    ('CCU', 'Kolkata',    ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326)::geography, 'Asia/Kolkata'),
    ('AMD', 'Ahmedabad',  ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326)::geography, 'Asia/Kolkata'),
    ('JAI', 'Jaipur',     ST_SetSRID(ST_MakePoint(75.7873, 26.9124), 4326)::geography, 'Asia/Kolkata')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
