import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';

export async function getUsers(): Promise<Omit<User, 'password_hash'>[]> {
  try {
    const results = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      full_name: usersTable.full_name,
      is_active: usersTable.is_active,
      created_at: usersTable.created_at,
      updated_at: usersTable.updated_at
    })
    .from(usersTable)
    .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}