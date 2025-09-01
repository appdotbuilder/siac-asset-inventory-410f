import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, userActivityLogsTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { loginUser } from '../handlers/login_user';
import { eq } from 'drizzle-orm';
import { verify } from 'jsonwebtoken';

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test user data
  const testUser = {
    id: crypto.randomUUID(),
    email: 'test@example.com',
    password: 'password123',
    role: 'EMPLOYEE' as const,
    full_name: 'Test User',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  const loginInput: LoginInput = {
    email: 'test@example.com',
    password: 'password123'
  };

  beforeEach(async () => {
    // Create test user with hashed password
    const passwordHash = await Bun.password.hash(testUser.password);
    
    await db.insert(usersTable)
      .values({
        ...testUser,
        password_hash: passwordHash
      })
      .execute();
  });

  it('should successfully login with valid credentials', async () => {
    const result = await loginUser(loginInput);

    expect(result).not.toBeNull();
    expect(result!.user.email).toBe('test@example.com');
    expect(result!.user.full_name).toBe('Test User');
    expect(result!.user.role).toBe('EMPLOYEE');
    expect(result!.user.is_active).toBe(true);
    expect(result!.token).toBeDefined();
    expect(typeof result!.token).toBe('string');

    // Verify password hash is not included in response
    expect((result!.user as any).password_hash).toBeUndefined();
  });

  it('should return valid JWT token', async () => {
    const result = await loginUser(loginInput);

    expect(result).not.toBeNull();

    // Verify JWT token structure
    const jwtSecret = process.env['JWT_SECRET'] || 'your-secret-key';
    const decoded = verify(result!.token, jwtSecret) as any;

    expect(decoded.userId).toBe(testUser.id);
    expect(decoded.email).toBe(testUser.email);
    expect(decoded.role).toBe(testUser.role);
    expect(decoded.exp).toBeDefined(); // Token should have expiration
  });

  it('should log login activity', async () => {
    const result = await loginUser(loginInput);

    expect(result).not.toBeNull();

    // Check that activity was logged
    const activities = await db.select()
      .from(userActivityLogsTable)
      .where(eq(userActivityLogsTable.user_id, testUser.id))
      .execute();

    expect(activities).toHaveLength(1);
    expect(activities[0].action).toBe('LOGIN');
    expect(activities[0].entity_type).toBe('USER');
    expect(activities[0].entity_id).toBe(testUser.id);
    expect(activities[0].details).toContain('test@example.com');
    expect(activities[0].timestamp).toBeInstanceOf(Date);
  });

  it('should return null for non-existent user', async () => {
    const invalidInput: LoginInput = {
      email: 'nonexistent@example.com',
      password: 'password123'
    };

    const result = await loginUser(invalidInput);

    expect(result).toBeNull();

    // No activity should be logged for failed login
    const activities = await db.select()
      .from(userActivityLogsTable)
      .execute();

    expect(activities).toHaveLength(0);
  });

  it('should return null for invalid password', async () => {
    const invalidInput: LoginInput = {
      email: 'test@example.com',
      password: 'wrongpassword'
    };

    const result = await loginUser(invalidInput);

    expect(result).toBeNull();

    // No activity should be logged for failed login
    const activities = await db.select()
      .from(userActivityLogsTable)
      .execute();

    expect(activities).toHaveLength(0);
  });

  it('should return null for inactive user', async () => {
    // Update user to be inactive
    await db.update(usersTable)
      .set({ is_active: false })
      .where(eq(usersTable.id, testUser.id))
      .execute();

    const result = await loginUser(loginInput);

    expect(result).toBeNull();

    // No activity should be logged for disabled user
    const activities = await db.select()
      .from(userActivityLogsTable)
      .execute();

    expect(activities).toHaveLength(0);
  });

  it('should handle case-sensitive email correctly', async () => {
    const uppercaseEmailInput: LoginInput = {
      email: 'TEST@EXAMPLE.COM',
      password: 'password123'
    };

    const result = await loginUser(uppercaseEmailInput);

    // Should return null because email doesn't match exactly
    expect(result).toBeNull();
  });

  it('should work with admin role user', async () => {
    // Create admin user
    const adminUser = {
      id: crypto.randomUUID(),
      email: 'admin@example.com',
      password: 'adminpass123',
      role: 'ADMIN' as const,
      full_name: 'Admin User',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    const passwordHash = await Bun.password.hash(adminUser.password);
    
    await db.insert(usersTable)
      .values({
        ...adminUser,
        password_hash: passwordHash
      })
      .execute();

    const adminLogin: LoginInput = {
      email: 'admin@example.com',
      password: 'adminpass123'
    };

    const result = await loginUser(adminLogin);

    expect(result).not.toBeNull();
    expect(result!.user.role).toBe('ADMIN');
    expect(result!.user.email).toBe('admin@example.com');

    // Verify JWT contains correct role
    const jwtSecret = process.env['JWT_SECRET'] || 'your-secret-key';
    const decoded = verify(result!.token, jwtSecret) as any;
    expect(decoded.role).toBe('ADMIN');
  });
});