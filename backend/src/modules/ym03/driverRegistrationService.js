
import { RegistrationConflictError } from './registrationService.js';

/**
 * YM-03 Driver registration.
 *
 * Requires the approved driver_profiles migration.
 * Uses the shared users and vehicles tables.
 *
 * Not connected to the public API yet.
 */
export async function createDriverRegistration({
  pool,
  hashPassword,
  data,
}) {
  if (!pool || typeof pool.connect !== 'function') {
    throw new Error('Database pool is required');
  }

  if (typeof hashPassword !== 'function') {
    throw new Error('Password hashing function is required');
  }

  if (!data || data.role !== 'driver') {
    throw new Error('Expected validated Driver registration');
  }

  if (
    typeof data.operatingArea !== 'string' ||
    !data.operatingArea.trim() ||
    typeof data.licenceNumber !== 'string' ||
    !data.licenceNumber.trim() ||
    typeof data.registrationNumber !== 'string' ||
    !data.registrationNumber.trim() ||
    !['lgv', 'mini_lorry', 'refrigerated', 'heavy_flatbed']
      .includes(data.vehicleType) ||
    typeof data.capacityKg !== 'number' ||
    !Number.isFinite(data.capacityKg) ||
    data.capacityKg <= 0 ||
    data.capacityKg >= 1000000000 ||
    Math.abs(data.capacityKg * 1000 -
      Math.round(data.capacityKg * 1000)) > 0.000001
  ) {
    throw new Error('Invalid validated Driver profile');
  }

  // Hash before opening the transaction.
  const passwordHash = await hashPassword(data.password);

  if (
    typeof passwordHash !== 'string' ||
    passwordHash.length === 0 ||
    passwordHash === data.password
  ) {
    throw new Error('Password hashing failed');
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const userResult = await client.query(
      `
        INSERT INTO users (
          name,
          email,
          role,
          approval_status,
          password_hash,
          phone,
          district
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, role, approval_status
      `,
      [
        data.fullName,
        data.email,
        'driver',
        'pending',
        passwordHash,
        data.phone,
        data.district,
      ]
    );

    const user = userResult.rows[0];

    if (!user?.id) {
      throw new Error('User creation returned no identifier');
    }

    const profileResult = await client.query(
      `
        INSERT INTO driver_profiles (
          user_id,
          operating_area,
          licence_number
        )
        VALUES ($1, $2, $3)
        RETURNING user_id
      `,
      [
        user.id,
        data.operatingArea.trim(),
        data.licenceNumber.trim(),
      ]
    );

    if (!profileResult.rows[0]?.user_id) {
      throw new Error('Driver profile creation failed');
    }

    const vehicleResult = await client.query(
      `
        INSERT INTO vehicles (
          driver_id,
          registration,
          vehicle_type,
          capacity_kg
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [
        user.id,
        data.registrationNumber.trim(),
        data.vehicleType,
        data.capacityKg,
      ]
    );

    if (!vehicleResult.rows[0]?.id) {
      throw new Error('Vehicle creation failed');
    }

    await client.query('COMMIT');
    transactionStarted = false;

    return {
      registrationId: user.id,
      role: user.role,
      approvalStatus: user.approval_status,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original error.
      }
    }

    if (error.code === '23505') {
      if (error.constraint === 'users_email_key') {
        throw new RegistrationConflictError('email');
      }

      if (error.constraint === 'vehicles_registration_key') {
        throw new RegistrationConflictError(
          'registrationNumber'
        );
      }
    }

    throw error;
  } finally {
    client.release();
  }
}
