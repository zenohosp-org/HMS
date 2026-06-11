-- 1. Backfill orphaned beds from wards -> floors -> buildings
UPDATE beds b
SET hospital_id = bldg.hospital_id
FROM hospital_wards w
JOIN hospital_floors f ON w.floor_id = f.id
JOIN hospital_buildings bldg ON f.building_id = bldg.id
WHERE b.ward_id = w.id AND b.hospital_id IS NULL;

-- 2. Make hospital_id NOT NULL
ALTER TABLE beds ALTER COLUMN hospital_id SET NOT NULL;
