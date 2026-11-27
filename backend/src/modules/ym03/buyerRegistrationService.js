
import { RegistrationConflictError } from './registrationService.js';

/**
 * YM-03 Buyer registration.
 *
 * Requires the reviewed YM-03 buyer_profiles migration.
 * This service is not connected to the public API yet.
 */
export async function createBuyerRegistration({
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

  if (!data || data.role !== 'buyer') {
    throw new Error('Expected validated Buyer registration');
  }

  if (
    !['individual', 'commercial'].includes(data.buyerType) ||
    (
      data.buyerType === 'commercial' &&
      (
        typeof data.businessName !== 'string' ||
        !data.businessName.trim()
      )
    ) ||
    (
      data.buyerType === 'individual' &&
      data.businessName !== ''
    )
  ) {
    throw new Error('Invalid validated Buyer profile');
  }

  const passwordHash = await hashPassword(data.password);

  if (
    typeof passwordHash !== 'string' ||
    !passwordHash ||
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
        'buyer',
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
        INSERT INTO buyer_profiles (
          user_id,
          buyer_type,
          business_name
        )
        VALUES ($1, $2, $3)
        RETURNING user_id
      `,
      [
        user.id,
        data.buyerType,
        data.buyerType === 'commercial'
          ? data.businessName.trim()
          : null,
      ]
    );

    if (!profileResult.rows[0]?.user_id) {
      throw new Error('Buyer profile creation failed');
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
