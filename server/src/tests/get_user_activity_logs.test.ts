import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, userActivityLogsTable } from '../db/schema';
import { getUserActivityLogs } from '../handlers/get_user_activity_logs';
import { randomUUID } from 'crypto';

const generateId = () => randomUUID();

// Test data setup
const createTestUser = async (email: string, fullName: string) => {
  const userId = generateId();
  await db.insert(usersTable).values({
    id: userId,
    email,
    password_hash: 'hashed_password',
    role: 'EMPLOYEE',
    full_name: fullName,
    is_active: true
  }).execute();
  return userId;
};

const createTestActivityLog = async (userId: string, action: string, entityType: string, timestamp?: Date) => {
  const logId = generateId();
  await db.insert(userActivityLogsTable).values({
    id: logId,
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: generateId(),
    details: `Test details for ${action}`,
    timestamp: timestamp || new Date()
  }).execute();
  return logId;
};

describe('getUserActivityLogs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all activity logs when no filters are applied', async () => {
    // Create test users
    const userId1 = await createTestUser('user1@test.com', 'User One');
    const userId2 = await createTestUser('user2@test.com', 'User Two');
    
    // Create test activity logs
    await createTestActivityLog(userId1, 'CREATE_ASSET', 'asset');
    await createTestActivityLog(userId2, 'UPDATE_ASSET', 'asset');
    await createTestActivityLog(userId1, 'DELETE_ASSET', 'asset');

    const result = await getUserActivityLogs();

    expect(result).toHaveLength(3);
    expect(result.every(log => log.id)).toBe(true);
    expect(result.every(log => log.timestamp instanceof Date)).toBe(true);
    
    // Check that results are ordered by timestamp descending (most recent first)
    for (let i = 1; i < result.length; i++) {
      expect(result[i-1].timestamp >= result[i].timestamp).toBe(true);
    }
  });

  it('should filter by user_id correctly', async () => {
    // Create test users
    const userId1 = await createTestUser('user1@test.com', 'User One');
    const userId2 = await createTestUser('user2@test.com', 'User Two');
    
    // Create activity logs for both users
    await createTestActivityLog(userId1, 'CREATE_ASSET', 'asset');
    await createTestActivityLog(userId2, 'UPDATE_ASSET', 'asset');
    await createTestActivityLog(userId1, 'DELETE_ASSET', 'asset');

    const result = await getUserActivityLogs({ user_id: userId1 });

    expect(result).toHaveLength(2);
    result.forEach(log => {
      expect(log.user_id).toEqual(userId1);
    });
  });

  it('should filter by action correctly', async () => {
    // Create test user
    const userId = await createTestUser('user@test.com', 'Test User');
    
    // Create different action logs
    await createTestActivityLog(userId, 'CREATE_ASSET', 'asset');
    await createTestActivityLog(userId, 'UPDATE_ASSET', 'asset');
    await createTestActivityLog(userId, 'CREATE_ASSET', 'asset');

    const result = await getUserActivityLogs({ action: 'CREATE_ASSET' });

    expect(result).toHaveLength(2);
    result.forEach(log => {
      expect(log.action).toEqual('CREATE_ASSET');
    });
  });

  it('should filter by date range correctly', async () => {
    // Create test user
    const userId = await createTestUser('user@test.com', 'Test User');
    
    // Create logs with different timestamps
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const today = new Date();
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await createTestActivityLog(userId, 'OLD_ACTION', 'asset', yesterday);
    await createTestActivityLog(userId, 'TODAY_ACTION', 'asset', today);
    await createTestActivityLog(userId, 'FUTURE_ACTION', 'asset', tomorrow);

    // Filter for today and future
    const result = await getUserActivityLogs({
      start_date: today,
      end_date: tomorrow
    });

    expect(result).toHaveLength(2);
    result.forEach(log => {
      expect(log.timestamp >= today).toBe(true);
      expect(log.timestamp <= tomorrow).toBe(true);
    });
  });

  it('should handle multiple filters simultaneously', async () => {
    // Create test users
    const userId1 = await createTestUser('user1@test.com', 'User One');
    const userId2 = await createTestUser('user2@test.com', 'User Two');
    
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Create various activity logs
    await createTestActivityLog(userId1, 'CREATE_ASSET', 'asset', today);
    await createTestActivityLog(userId1, 'UPDATE_ASSET', 'asset', today);
    await createTestActivityLog(userId2, 'CREATE_ASSET', 'asset', today);
    await createTestActivityLog(userId1, 'CREATE_ASSET', 'asset', yesterday);

    const result = await getUserActivityLogs({
      user_id: userId1,
      action: 'CREATE_ASSET',
      start_date: today
    });

    expect(result).toHaveLength(1);
    expect(result[0].user_id).toEqual(userId1);
    expect(result[0].action).toEqual('CREATE_ASSET');
    expect(result[0].timestamp >= today).toBe(true);
  });

  it('should return empty array when no logs match filters', async () => {
    // Create test user
    const userId = await createTestUser('user@test.com', 'Test User');
    
    // Create some logs
    await createTestActivityLog(userId, 'CREATE_ASSET', 'asset');

    const result = await getUserActivityLogs({
      action: 'NON_EXISTENT_ACTION'
    });

    expect(result).toHaveLength(0);
  });

  it('should handle empty database gracefully', async () => {
    const result = await getUserActivityLogs();
    expect(result).toHaveLength(0);
  });

  it('should validate log structure and required fields', async () => {
    // Create test user and activity log
    const userId = await createTestUser('user@test.com', 'Test User');
    await createTestActivityLog(userId, 'TEST_ACTION', 'asset');

    const result = await getUserActivityLogs();

    expect(result).toHaveLength(1);
    const log = result[0];
    
    // Validate all required fields are present
    expect(log.id).toBeDefined();
    expect(log.user_id).toEqual(userId);
    expect(log.action).toEqual('TEST_ACTION');
    expect(log.entity_type).toEqual('asset');
    expect(log.entity_id).toBeDefined();
    expect(log.details).toBeDefined();
    expect(log.timestamp).toBeInstanceOf(Date);
  });

  it('should handle date filtering with start_date only', async () => {
    // Create test user
    const userId = await createTestUser('user@test.com', 'Test User');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const today = new Date();

    await createTestActivityLog(userId, 'OLD_ACTION', 'asset', yesterday);
    await createTestActivityLog(userId, 'NEW_ACTION', 'asset', today);

    const result = await getUserActivityLogs({ start_date: today });

    expect(result).toHaveLength(1);
    expect(result[0].action).toEqual('NEW_ACTION');
    expect(result[0].timestamp >= today).toBe(true);
  });

  it('should handle date filtering with end_date only', async () => {
    // Create test user
    const userId = await createTestUser('user@test.com', 'Test User');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await createTestActivityLog(userId, 'OLD_ACTION', 'asset', yesterday);
    await createTestActivityLog(userId, 'FUTURE_ACTION', 'asset', tomorrow);

    const result = await getUserActivityLogs({ end_date: yesterday });

    expect(result).toHaveLength(1);
    expect(result[0].action).toEqual('OLD_ACTION');
    expect(result[0].timestamp <= yesterday).toBe(true);
  });
});