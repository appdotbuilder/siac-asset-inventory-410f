import { db } from '../db';
import { usersTable, userActivityLogsTable } from '../db/schema';
import { type CreateUserInput, type User } from '../schema';
import { randomUUID } from 'crypto';

// Simple password hashing function using crypto
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Generate unique ID and hash password
    const userId = randomUUID();
    const passwordHash = await hashPassword(input.password);

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        id: userId,
        email: input.email,
        password_hash: passwordHash,
        role: input.role,
        full_name: input.full_name,
        is_active: true
      })
      .returning()
      .execute();

    const user = result[0];

    // Log the user creation activity
    await db.insert(userActivityLogsTable)
      .values({
        id: randomUUID(),
        user_id: userId, // The newly created user
        action: 'CREATE_USER',
        entity_type: 'USER',
        entity_id: userId,
        details: `User account created: ${input.email} (${input.role})`
      })
      .execute();

    return user;
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};