-- 1. Backfill orphaned beds from wards -> floors
UPDATE beds b
SET hospital_id = f.hospital_id
FROM hospital_wards w
JOIN hospital_floors f ON w.floor_id = f.id
WHERE b.ward_id = w.id AND b.hospital_id IS NULL;

-- 2. Make hospital_id NOT NULL and add foreign key
ALTER TABLE beds ALTER COLUMN hospital_id SET NOT NULL;
ALTER TABLE beds ADD CONSTRAINT fk_beds_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id);
