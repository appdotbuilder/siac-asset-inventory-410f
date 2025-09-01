import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, userActivityLogsTable } from '../db/schema';
import { type UpdateUserInput } from '../schema';
import { updateUser } from '../handlers/update_user';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  id: crypto.randomUUID(),
  email: 'test@example.com',
  password_hash: 'original_hash',
  role: 'EMPLOYEE' as const,
  full_name: 'Original Name',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date()
};

describe('updateUser', () => {
  beforeEach(async () => {
    await createDB();
    // Create a test user to update
    await db.insert(usersTable).values(testUser).execute();
  });
  
  afterEach(resetDB);

  it('should update user email', async () => {
    const input: UpdateUserInput = {
      id: testUser.id,
      email: 'updated@example.com'
    };

    const result = await updateUser(input);

    expect(result.id).toEqual(testUser.id);
    expect(result.email).toEqual('updated@example.com');
    expect(result.full_name).toEqual(testUser.full_name); // Unchanged
    expect(result.role).toEqual(testUser.role); // Unchanged
    expect(result.is_active).toEqual(testUser.is_active); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update user password and hash it', async () => {
    const input: UpdateUserInput = {
      id: testUser.id,
      password: 'newpassword123'
    };

    const result = await updateUser(input);

    expect(result.password_hash).not.toEqual(testUser.password_hash);
    expect(result.password_hash).not.toEqual('newpassword123'); // Should be hashed
    expect(result.password_hash.length).toBeGreaterThan(20); // Hashed passwords are longer
    
    // Verify password was actually hashed correctly
    const isValidPassword = await Bun.password.verify('newpassword123', result.password_hash);
    expect(isValidPassword).toBe(true);
  });

  it('should update user role', async () => {
    const input: UpdateUserInput = {
      id: testUser.id,
      role: 'ADMIN'
    };

    const result = await updateUser(input);

    expect(result.role).toEqual('ADMIN');
    expect(result.email).toEqual(testUser.email); // Unchanged
  });

  it('should update user full name', async () => {
    const input: UpdateUserInput = {
      id: testUser.id,
      full_name: 'New Full Name'
    };

    const result = await updateUser(input);

    expect(result.full_name).toEqual('New Full Name');
    expect(result.email).toEqual(testUser.email); // Unchanged
  });

  it('should update user active status', async () => {
    const input: UpdateUserInput = {
      id: testUser.id,
      is_active: false
    };

    const result = await updateUser(input);

    expect(result.is_active).toBe(false);
    expect(result.email).toEqual(testUser.email); // Unchanged
  });

  it('should update multiple fields at once', async () => {
    const input: UpdateUserInput = {
      id: testUser.id,
      email: 'multi@example.com',
      full_name: 'Multi Update Name',
      role: 'ADMIN',
      is_active: false
    };

    const result = await updateUser(input);

    expect(result.email).toEqual('multi@example.com');
    expect(result.full_name).toEqual('Multi Update Name');
    expect(result.role).toEqual('ADMIN');
    expect(result.is_active).toBe(false);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save changes to database', async () => {
    const input: UpdateUserInput = {
      id: testUser.id,
      email: 'saved@example.com',
      full_name: 'Saved Name'
    };

    await updateUser(input);

    // Verify changes were persisted
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUser.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('saved@example.com');
    expect(users[0].full_name).toEqual('Saved Name');
  });

  it('should log activity when user is updated', async () => {
    const input: UpdateUserInput = {
      id: testUser.id,
      email: 'logged@example.com',
      role: 'ADMIN'
    };

    await updateUser(input);

    // Check that activity was logged
    const activities = await db.select()
      .from(userActivityLogsTable)
      .where(eq(userActivityLogsTable.user_id, testUser.id))
      .execute();

    expect(activities).toHaveLength(1);
    expect(activities[0].action).toEqual('UPDATE');
    expect(activities[0].entity_type).toEqual('USER');
    expect(activities[0].entity_id).toEqual(testUser.id);
    expect(activities[0].details).toContain('email changed');
    expect(activities[0].details).toContain('role changed');
    expect(activities[0].timestamp).toBeInstanceOf(Date);
  });

  it('should not log activity when no changes are made', async () => {
    const input: UpdateUserInput = {
      id: testUser.id
      // No actual changes
    };

    await updateUser(input);

    // Check that no activity was logged
    const activities = await db.select()
      .from(userActivityLogsTable)
      .where(eq(userActivityLogsTable.user_id, testUser.id))
      .execute();

    expect(activities).toHaveLength(0);
  });

  it('should return unchanged user when no updates provided', async () => {
    const input: UpdateUserInput = {
      id: testUser.id
    };

    const result = await updateUser(input);

    expect(result.id).toEqual(testUser.id);
    expect(result.email).toEqual(testUser.email);
    expect(result.full_name).toEqual(testUser.full_name);
    expect(result.role).toEqual(testUser.role);
    expect(result.is_active).toEqual(testUser.is_active);
  });

  it('should throw error when user does not exist', async () => {
    const input: UpdateUserInput = {
      id: 'non-existent-id',
      email: 'new@example.com'
    };

    expect(updateUser(input)).rejects.toThrow(/user not found/i);
  });

  it('should handle password-only updates', async () => {
    const input: UpdateUserInput = {
      id: testUser.id,
      password: 'onlypassword123'
    };

    const result = await updateUser(input);

    expect(result.password_hash).not.toEqual(testUser.password_hash);
    
    // Verify password verification works
    const isValidPassword = await Bun.password.verify('onlypassword123', result.password_hash);
    expect(isValidPassword).toBe(true);

    // Verify activity was logged
    const activities = await db.select()
      .from(userActivityLogsTable)
      .where(eq(userActivityLogsTable.user_id, testUser.id))
      .execute();

    expect(activities).toHaveLength(1);
    expect(activities[0].details).toEqual('password updated');
  });
});