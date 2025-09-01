import { db } from '../db';
import { usersTable, userActivityLogsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function deleteUser(id: string): Promise<{ success: boolean }> {
  try {
    // Check if user exists and is currently active
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1)
      .execute();

    if (existingUser.length === 0) {
      throw new Error('User not found');
    }

    if (!existingUser[0].is_active) {
      throw new Error('User is already deactivated');
    }

    // Deactivate the user (soft delete to preserve audit trail)
    await db.update(usersTable)
      .set({
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, id))
      .execute();

    // Log the user deletion activity
    await db.insert(userActivityLogsTable)
      .values({
        id: crypto.randomUUID(),
        user_id: id, // The user being deactivated
        action: 'USER_DEACTIVATED',
        entity_type: 'USER',
        entity_id: id,
        details: `User ${existingUser[0].email} has been deactivated`,
        timestamp: new Date()
      })
      .execute();

    return { success: true };
  } catch (error) {
    console.error('User deletion failed:', error);
    throw error;
  }
}