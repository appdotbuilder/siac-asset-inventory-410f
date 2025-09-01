import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getUsers } from '../handlers/get_users';

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();
    
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should fetch all users without password hashes', async () => {
    // Create test users
    await db.insert(usersTable).values([
      {
        id: 'user-1',
        email: 'admin@company.com',
        password_hash: 'hashed_password_123',
        role: 'ADMIN',
        full_name: 'Admin User',
        is_active: true
      },
      {
        id: 'user-2', 
        email: 'employee@company.com',
        password_hash: 'hashed_password_456',
        role: 'EMPLOYEE',
        full_name: 'Employee User',
        is_active: true
      }
    ]).execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    // Verify first user
    const adminUser = result.find(u => u.email === 'admin@company.com');
    expect(adminUser).toBeDefined();
    expect(adminUser!.id).toBe('user-1');
    expect(adminUser!.role).toBe('ADMIN');
    expect(adminUser!.full_name).toBe('Admin User');
    expect(adminUser!.is_active).toBe(true);
    expect(adminUser!.created_at).toBeInstanceOf(Date);
    expect(adminUser!.updated_at).toBeInstanceOf(Date);
    expect('password_hash' in adminUser!).toBe(false); // Security check

    // Verify second user
    const employeeUser = result.find(u => u.email === 'employee@company.com');
    expect(employeeUser).toBeDefined();
    expect(employeeUser!.id).toBe('user-2');
    expect(employeeUser!.role).toBe('EMPLOYEE');
    expect(employeeUser!.full_name).toBe('Employee User');
    expect(employeeUser!.is_active).toBe(true);
    expect(employeeUser!.created_at).toBeInstanceOf(Date);
    expect(employeeUser!.updated_at).toBeInstanceOf(Date);
    expect('password_hash' in employeeUser!).toBe(false); // Security check
  });

  it('should include inactive users in results', async () => {
    // Create active and inactive users
    await db.insert(usersTable).values([
      {
        id: 'active-user',
        email: 'active@company.com',
        password_hash: 'password_hash',
        role: 'EMPLOYEE',
        full_name: 'Active User',
        is_active: true
      },
      {
        id: 'inactive-user',
        email: 'inactive@company.com', 
        password_hash: 'password_hash',
        role: 'EMPLOYEE',
        full_name: 'Inactive User',
        is_active: false
      }
    ]).execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    const activeUser = result.find(u => u.email === 'active@company.com');
    const inactiveUser = result.find(u => u.email === 'inactive@company.com');
    
    expect(activeUser!.is_active).toBe(true);
    expect(inactiveUser!.is_active).toBe(false);
  });

  it('should return users with different roles', async () => {
    // Create users with different roles
    await db.insert(usersTable).values([
      {
        id: 'admin-1',
        email: 'admin1@company.com',
        password_hash: 'password_hash',
        role: 'ADMIN',
        full_name: 'Admin One',
        is_active: true
      },
      {
        id: 'admin-2',
        email: 'admin2@company.com',
        password_hash: 'password_hash', 
        role: 'ADMIN',
        full_name: 'Admin Two',
        is_active: true
      },
      {
        id: 'employee-1',
        email: 'emp1@company.com',
        password_hash: 'password_hash',
        role: 'EMPLOYEE', 
        full_name: 'Employee One',
        is_active: true
      }
    ]).execute();

    const result = await getUsers();

    expect(result).toHaveLength(3);
    
    const admins = result.filter(u => u.role === 'ADMIN');
    const employees = result.filter(u => u.role === 'EMPLOYEE');
    
    expect(admins).toHaveLength(2);
    expect(employees).toHaveLength(1);
    
    // Verify all users have required fields
    result.forEach(user => {
      expect(user.id).toBeDefined();
      expect(user.email).toBeDefined(); 
      expect(user.role).toMatch(/^(ADMIN|EMPLOYEE)$/);
      expect(user.full_name).toBeDefined();
      expect(typeof user.is_active).toBe('boolean');
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
      expect('password_hash' in user).toBe(false);
    });
  });

  it('should handle users with null/optional fields appropriately', async () => {
    // Test data covers edge cases within schema constraints
    await db.insert(usersTable).values([
      {
        id: 'user-with-long-name',
        email: 'long.name.user@company.com',
        password_hash: 'secure_password_hash',
        role: 'EMPLOYEE',
        full_name: 'Very Long Full Name That Tests Field Length Handling',
        is_active: false
      }
    ]).execute();

    const result = await getUsers();

    expect(result).toHaveLength(1);
    expect(result[0].full_name).toBe('Very Long Full Name That Tests Field Length Handling');
    expect(result[0].is_active).toBe(false);
  });
});