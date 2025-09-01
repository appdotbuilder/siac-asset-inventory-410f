import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, userActivityLogsTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq, and } from 'drizzle-orm';

// Test inputs for different user roles
const adminInput: CreateUserInput = {
  email: 'admin@example.com',
  password: 'securePassword123',
  role: 'ADMIN',
  full_name: 'Admin User'
};

const employeeInput: CreateUserInput = {
  email: 'employee@example.com',
  password: 'employeePass456',
  role: 'EMPLOYEE',
  full_name: 'Employee User'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with admin role', async () => {
    const result = await createUser(adminInput);

    // Basic field validation
    expect(result.email).toEqual('admin@example.com');
    expect(result.role).toEqual('ADMIN');
    expect(result.full_name).toEqual('Admin User');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('securePassword123'); // Should be hashed
  });

  it('should create a user with employee role', async () => {
    const result = await createUser(employeeInput);

    // Basic field validation
    expect(result.email).toEqual('employee@example.com');
    expect(result.role).toEqual('EMPLOYEE');
    expect(result.full_name).toEqual('Employee User');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('employeePass456'); // Should be hashed
  });

  it('should save user to database', async () => {
    const result = await createUser(adminInput);

    // Query user from database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    expect(savedUser.email).toEqual('admin@example.com');
    expect(savedUser.role).toEqual('ADMIN');
    expect(savedUser.full_name).toEqual('Admin User');
    expect(savedUser.is_active).toEqual(true);
    expect(savedUser.password_hash).toBeDefined();
    expect(savedUser.created_at).toBeInstanceOf(Date);
    expect(savedUser.updated_at).toBeInstanceOf(Date);
  });

  it('should hash password correctly', async () => {
    const result = await createUser(adminInput);

    // Password should be hashed (not plaintext)
    expect(result.password_hash).not.toEqual('securePassword123');
    expect(result.password_hash.length).toBeGreaterThan(10); // Hashed passwords are longer
    expect(typeof result.password_hash).toBe('string');
  });

  it('should generate unique IDs for different users', async () => {
    const user1 = await createUser(adminInput);
    const user2 = await createUser({
      ...employeeInput,
      email: 'another@example.com'
    });

    expect(user1.id).not.toEqual(user2.id);
    expect(typeof user1.id).toBe('string');
    expect(typeof user2.id).toBe('string');
  });

  it('should log user creation activity', async () => {
    const result = await createUser(adminInput);

    // Query activity logs
    const activityLogs = await db.select()
      .from(userActivityLogsTable)
      .where(
        and(
          eq(userActivityLogsTable.user_id, result.id),
          eq(userActivityLogsTable.action, 'CREATE_USER')
        )
      )
      .execute();

    expect(activityLogs).toHaveLength(1);
    const log = activityLogs[0];
    expect(log.user_id).toEqual(result.id);
    expect(log.action).toEqual('CREATE_USER');
    expect(log.entity_type).toEqual('USER');
    expect(log.entity_id).toEqual(result.id);
    expect(log.details).toContain('admin@example.com');
    expect(log.details).toContain('ADMIN');
    expect(log.timestamp).toBeInstanceOf(Date);
  });

  it('should reject duplicate email addresses', async () => {
    // Create first user
    await createUser(adminInput);

    // Try to create another user with same email
    const duplicateInput: CreateUserInput = {
      ...employeeInput,
      email: 'admin@example.com' // Same email as first user
    };

    await expect(createUser(duplicateInput)).rejects.toThrow(/unique constraint/i);
  });

  it('should set default values correctly', async () => {
    const result = await createUser(adminInput);

    // Default values should be applied
    expect(result.is_active).toEqual(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Timestamps should be recent (within last minute)
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    expect(result.created_at.getTime()).toBeGreaterThan(oneMinuteAgo.getTime());
    expect(result.updated_at.getTime()).toBeGreaterThan(oneMinuteAgo.getTime());
  });

  it('should handle users with different roles in database', async () => {
    // Create admin user
    const admin = await createUser(adminInput);
    
    // Create employee user
    const employee = await createUser({
      ...employeeInput,
      email: 'unique@example.com'
    });

    // Query all users
    const allUsers = await db.select()
      .from(usersTable)
      .execute();

    expect(allUsers).toHaveLength(2);
    
    // Find users by role
    const adminUsers = allUsers.filter(u => u.role === 'ADMIN');
    const employeeUsers = allUsers.filter(u => u.role === 'EMPLOYEE');
    
    expect(adminUsers).toHaveLength(1);
    expect(employeeUsers).toHaveLength(1);
    expect(adminUsers[0].id).toEqual(admin.id);
    expect(employeeUsers[0].id).toEqual(employee.id);
  });
});