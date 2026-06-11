-- 1. Add hospital_id to beds
ALTER TABLE beds ADD COLUMN hospital_id uuid;

-- 2. Backfill hospital_id from rooms
UPDATE beds b
SET hospital_id = r.hospital_id
FROM rooms r
WHERE b.room_id = r.room_id;

-- 3. Backfill orphaned beds from wards
UPDATE beds b
SET hospital_id = w.hospital_id
FROM hospital_wards w
WHERE b.ward_id = w.id AND b.hospital_id IS NULL;

-- 4. Make hospital_id NOT NULL and add foreign key
ALTER TABLE beds ALTER COLUMN hospital_id SET NOT NULL;
ALTER TABLE beds ADD CONSTRAINT fk_beds_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id);

-- 5. Drop patient_id and status from beds
ALTER TABLE beds DROP COLUMN patient_id;
ALTER TABLE beds DROP COLUMN status;

-- 6. Drop redundant/denormalized columns from rooms
ALTER TABLE rooms DROP COLUMN ward;
ALTER TABLE rooms DROP COLUMN patient_id;
ALTER TABLE rooms DROP COLUMN status;
ALTER TABLE rooms DROP COLUMN admission_date;
ALTER TABLE rooms DROP COLUMN approx_discharge_time;
ALTER TABLE rooms DROP COLUMN allocation_token;
