-- Rename/relabel existing organizational units in place. Every UPDATE matches by the
-- CURRENT (old) code and changes only code/name/city — id is never touched, so every
-- FK (accounts, vouchers, allocations, replenishments, user_unit_access) carries over
-- automatically. No rows are deleted or recreated.

UPDATE organizational_units SET code = 'PSH-CCS', name = 'Pakistan Sweet Home Cadet College Sohawa', city = 'Sohawa' WHERE code = 'PSH-SOH';
UPDATE organizational_units SET code = 'PSH-BHW', name = 'Pakistan Sweet Home Bhalwal', city = 'Bhalwal' WHERE code = 'PSH-BWL';
UPDATE organizational_units SET name = 'Pakistan Sweet Home Center of Excellence', city = 'Rehara, Rawalakot, AJK' WHERE code = 'PSH-COE';
UPDATE organizational_units SET code = 'PSH-REHAB-CHK', name = 'Pakistan Sweet Home Rehabilitation Center', city = 'Chakri' WHERE code = 'REHAB-CHK';
UPDATE organizational_units SET code = 'PSH-REHAB-H9', name = 'Pakistan Sweet Home Rehabilitation Center', city = 'H-9, Islamabad' WHERE code = 'REHAB-H9';
UPDATE organizational_units SET code = 'FTZ-DST-DHQ', name = 'Fatima Tuz Zahra Dastarkhawan', city = 'DHQ Raja Bazar, Rawalpindi' WHERE code = 'FTZ-RAJA';
UPDATE organizational_units SET code = 'FTZ-DST-MCR', name = 'Fatima Tuz Zahra Dastarkhawan', city = 'MCR, Rawalpindi' WHERE code = 'FTZ-LQB';
UPDATE organizational_units SET name = 'Pakistan Sweet Home Free Burial Service', city = 'Rakh Dhamyal' WHERE code = 'SAFAR-AKH';
-- PSH-SUK: no change — code/name/city already match exactly.

-- Retire the shared Rehabilitation user's access now that each REHAB unit gets its own
-- dedicated UNIT_USER (seeded separately in prisma/seed-data.ts). Revoke access rather
-- than deleting the user row — no hard deletion, and the account may still be
-- referenced by audit_log.actor_id.
DELETE FROM user_unit_access
WHERE user_id = (SELECT id FROM users WHERE email = 'user.rehab@psh.local')
  AND unit_id IN (SELECT id FROM organizational_units WHERE code IN ('PSH-REHAB-CHK', 'PSH-REHAB-H9'));

UPDATE users SET is_active = false WHERE email = 'user.rehab@psh.local';
