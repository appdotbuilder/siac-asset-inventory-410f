import { db } from '../db';
import { usersTable, userActivityLogsTable } from '../db/schema';
import { type UpdateUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export const updateUser = async (input: UpdateUserInput): Promise<User> => {
  try {
    // Check if user exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.id))
      .execute();

    if (existingUser.length === 0) {
      throw new Error('User not found');
    }

    // Prepare update data
    const updateData: Partial<typeof usersTable.$inferInsert> = {
      updated_at: new Date()
    };

    // Track changes for activity logging
    const changes: string[] = [];

    if (input.email !== undefined) {
      updateData.email = input.email;
      changes.push(`email changed from ${existingUser[0].email} to ${input.email}`);
    }

    if (input.password !== undefined) {
      // Hash the new password using Bun's built-in password hashing
      updateData.password_hash = await Bun.password.hash(input.password);
      changes.push('password updated');
    }

    if (input.role !== undefined) {
      updateData.role = input.role;
      changes.push(`role changed from ${existingUser[0].role} to ${input.role}`);
    }

    if (input.full_name !== undefined) {
      updateData.full_name = input.full_name;
      changes.push(`full name changed from ${existingUser[0].full_name} to ${input.full_name}`);
    }

    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
      changes.push(`active status changed from ${existingUser[0].is_active} to ${input.is_active}`);
    }

    // If no changes were made, return the existing user
    if (Object.keys(updateData).length === 1) { // Only updated_at
      return existingUser[0];
    }

    // Update the user
    const result = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    // Log the update activity
    if (changes.length > 0) {
      await db.insert(userActivityLogsTable)
        .values({
          id: crypto.randomUUID(),
          user_id: input.id,
          action: 'UPDATE',
          entity_type: 'USER',
          entity_id: input.id,
          details: changes.join(', '),
          timestamp: new Date()
        })
        .execute();
    }

    return result[0];
  } catch (error) {
    console.error('User update failed:', error);
    throw error;
  }
};