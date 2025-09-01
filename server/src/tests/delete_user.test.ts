import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, userActivityLogsTable } from '../db/schema';
import { deleteUser } from '../handlers/delete_user';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  password_hash: 'hashed_password_123',
  role: 'EMPLOYEE' as const,
  full_name: 'Test User',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date()
};

const testAdminUser = {
  id: 'admin-user-id',
  email: 'admin@example.com',
  password_hash: 'hashed_admin_password',
  role: 'ADMIN' as const,
  full_name: 'Admin User',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date()
};

describe('deleteUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should deactivate an active user', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    // Deactivate the user
    const result = await deleteUser(testUser.id);

    // Verify return value
    expect(result.success).toBe(true);

    // Verify user is deactivated in database
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUser.id))
      .execute();

    expect(updatedUser).toHaveLength(1);
    expect(updatedUser[0].is_active).toBe(false);
    expect(updatedUser[0].email).toEqual(testUser.email); // Other data preserved
    expect(updatedUser[0].full_name).toEqual(testUser.full_name);
    expect(updatedUser[0].updated_at).toBeInstanceOf(Date);
  });

  it('should log user deactivation activity', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    // Deactivate the user
    await deleteUser(testUser.id);

    // Verify activity log was created
    const activityLogs = await db.select()
      .from(userActivityLogsTable)
      .where(eq(userActivityLogsTable.user_id, testUser.id))
      .execute();

    expect(activityLogs).toHaveLength(1);
    expect(activityLogs[0].action).toEqual('USER_DEACTIVATED');
    expect(activityLogs[0].entity_type).toEqual('USER');
    expect(activityLogs[0].entity_id).toEqual(testUser.id);
    expect(activityLogs[0].details).toContain(testUser.email);
    expect(activityLogs[0].details).toContain('has been deactivated');
    expect(activityLogs[0].timestamp).toBeInstanceOf(Date);
    expect(activityLogs[0].id).toBeDefined();
  });

  it('should throw error when user does not exist', async () => {
    const nonExistentId = 'non-existent-user-id';

    // Attempt to delete non-existent user
    await expect(deleteUser(nonExistentId)).rejects.toThrow(/user not found/i);

    // Verify no activity log was created
    const activityLogs = await db.select()
      .from(userActivityLogsTable)
      .where(eq(userActivityLogsTable.user_id, nonExistentId))
      .execute();

    expect(activityLogs).toHaveLength(0);
  });

  it('should throw error when user is already deactivated', async () => {
    // Create deactivated user
    const deactivatedUser = { ...testUser, is_active: false };
    await db.insert(usersTable).values(deactivatedUser).execute();

    // Attempt to delete already deactivated user
    await expect(deleteUser(testUser.id)).rejects.toThrow(/user is already deactivated/i);

    // Verify user remains deactivated
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUser.id))
      .execute();

    expect(user[0].is_active).toBe(false);

    // Verify no new activity log was created for this failed operation
    const activityLogs = await db.select()
      .from(userActivityLogsTable)
      .where(eq(userActivityLogsTable.user_id, testUser.id))
      .execute();

    expect(activityLogs).toHaveLength(0);
  });

  it('should handle multiple users correctly', async () => {
    // Create multiple test users
    await db.insert(usersTable).values([testUser, testAdminUser]).execute();

    // Deactivate only one user
    await deleteUser(testUser.id);

    // Verify correct user was deactivated
    const users = await db.select()
      .from(usersTable)
      .execute();

    const deactivatedUser = users.find(u => u.id === testUser.id);
    const activeUser = users.find(u => u.id === testAdminUser.id);

    expect(deactivatedUser?.is_active).toBe(false);
    expect(activeUser?.is_active).toBe(true);

    // Verify only one activity log was created
    const activityLogs = await db.select()
      .from(userActivityLogsTable)
      .execute();

    expect(activityLogs).toHaveLength(1);
    expect(activityLogs[0].user_id).toEqual(testUser.id);
  });

  it('should preserve all user data except is_active flag', async () => {
    // Create test user
    await db.insert(usersTable).values(testUser).execute();

    // Deactivate the user
    await deleteUser(testUser.id);

    // Verify all data is preserved except is_active
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUser.id))
      .execute();

    expect(updatedUser[0].id).toEqual(testUser.id);
    expect(updatedUser[0].email).toEqual(testUser.email);
    expect(updatedUser[0].password_hash).toEqual(testUser.password_hash);
    expect(updatedUser[0].role).toEqual(testUser.role);
    expect(updatedUser[0].full_name).toEqual(testUser.full_name);
    expect(updatedUser[0].is_active).toBe(false); // Only this should change
    expect(updatedUser[0].created_at).toEqual(testUser.created_at);
    // updated_at should be more recent than created_at
    expect(updatedUser[0].updated_at.getTime()).toBeGreaterThan(testUser.created_at.getTime());
  });
});