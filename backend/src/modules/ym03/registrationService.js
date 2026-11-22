
/**
 * YM-03 Farmer registration transaction.
 *
 * This service is not connected to the public API yet.
 * Password hashing is supplied by the shared
 * authentication implementation.
 */

export class RegistrationConflictError extends Error {
  constructor(field) {
    super('Registration conflicts with an existing record');
    this.name = 'RegistrationConflictError';
    this.field = field;
  }
}

export async function createFarmerRegistration({
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

  if (!data || data.role !== 'farmer') {
    throw new Error('Expected validated Farmer registration');
  }

  // Hash before opening the database transaction.
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
        'farmer',
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

    const farmResult = await client.query(
      `
        INSERT INTO farms (
          farmer_id,
          name,
          district,
          pickup_address
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [
        user.id,
        data.farmName,
        data.district,
        data.pickupAddress,
      ]
    );

    if (!farmResult.rows[0]?.id) {
      throw new Error('Farm creation returned no identifier');
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
        // Do not expose database error details to API users.
      }
    }

    if (
      error.code === '23505' &&
      error.constraint === 'users_email_key'
    ) {
      throw new RegistrationConflictError('email');
    }

    throw error;
  } finally {
    client.release();
  }
}
