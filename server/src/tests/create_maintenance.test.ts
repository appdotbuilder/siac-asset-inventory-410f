import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { maintenanceSchedulesTable, userActivityLogsTable, assetsTable, usersTable } from '../db/schema';
import { type CreateMaintenanceInput } from '../schema';
import { createMaintenance } from '../handlers/create_maintenance';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('createMaintenance', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testAssetId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Create test user
    testUserId = randomUUID();
    await db.insert(usersTable)
      .values({
        id: testUserId,
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'ADMIN',
        full_name: 'Test User',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      })
      .execute();

    // Create test asset
    testAssetId = randomUUID();
    await db.insert(assetsTable)
      .values({
        id: testAssetId,
        name: 'Test Asset',
        description: 'Asset for testing',
        category: 'MONITOR',
        condition: 'GOOD',
        owner: null,
        photo_url: null,
        qr_code: `QR-${testAssetId}`,
        is_archived: false,
        created_at: new Date(),
        updated_at: new Date()
      })
      .execute();
  });

  const createTestInput = (): CreateMaintenanceInput => ({
    asset_id: testAssetId,
    title: 'Monthly Cleaning',
    description: 'Regular cleaning and inspection',
    scheduled_date: new Date('2024-12-15T10:00:00Z'),
    created_by: testUserId
  });

  it('should create a maintenance schedule', async () => {
    const input = createTestInput();
    const result = await createMaintenance(input);

    // Basic field validation
    expect(result.asset_id).toEqual(testAssetId);
    expect(result.title).toEqual('Monthly Cleaning');
    expect(result.description).toEqual('Regular cleaning and inspection');
    expect(result.scheduled_date).toEqual(new Date('2024-12-15T10:00:00Z'));
    expect(result.created_by).toEqual(testUserId);
    expect(result.is_completed).toEqual(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save maintenance schedule to database', async () => {
    const input = createTestInput();
    const result = await createMaintenance(input);

    // Query using proper drizzle syntax
    const maintenances = await db.select()
      .from(maintenanceSchedulesTable)
      .where(eq(maintenanceSchedulesTable.id, result.id))
      .execute();

    expect(maintenances).toHaveLength(1);
    expect(maintenances[0].asset_id).toEqual(testAssetId);
    expect(maintenances[0].title).toEqual('Monthly Cleaning');
    expect(maintenances[0].description).toEqual('Regular cleaning and inspection');
    expect(maintenances[0].scheduled_date).toEqual(new Date('2024-12-15T10:00:00Z'));
    expect(maintenances[0].created_by).toEqual(testUserId);
    expect(maintenances[0].is_completed).toEqual(false);
    expect(maintenances[0].created_at).toBeInstanceOf(Date);
    expect(maintenances[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create activity log entry', async () => {
    const input = createTestInput();
    const result = await createMaintenance(input);

    // Check that activity log was created
    const activityLogs = await db.select()
      .from(userActivityLogsTable)
      .where(eq(userActivityLogsTable.entity_id, result.id))
      .execute();

    expect(activityLogs).toHaveLength(1);
    expect(activityLogs[0].user_id).toEqual(testUserId);
    expect(activityLogs[0].action).toEqual('CREATE_MAINTENANCE');
    expect(activityLogs[0].entity_type).toEqual('MAINTENANCE_SCHEDULE');
    expect(activityLogs[0].entity_id).toEqual(result.id);
    expect(activityLogs[0].details).toContain('Monthly Cleaning');
    expect(activityLogs[0].details).toContain(testAssetId);
    expect(activityLogs[0].details).toContain('2024-12-15');
    expect(activityLogs[0].timestamp).toBeInstanceOf(Date);
  });

  it('should handle maintenance with null description', async () => {
    const input: CreateMaintenanceInput = {
      asset_id: testAssetId,
      title: 'Quick Check',
      description: null,
      scheduled_date: new Date('2024-12-20T14:00:00Z'),
      created_by: testUserId
    };

    const result = await createMaintenance(input);

    expect(result.title).toEqual('Quick Check');
    expect(result.description).toBeNull();
    expect(result.asset_id).toEqual(testAssetId);
    expect(result.scheduled_date).toEqual(new Date('2024-12-20T14:00:00Z'));

    // Verify in database
    const maintenances = await db.select()
      .from(maintenanceSchedulesTable)
      .where(eq(maintenanceSchedulesTable.id, result.id))
      .execute();

    expect(maintenances[0].description).toBeNull();
  });

  it('should throw error for non-existent asset', async () => {
    const input: CreateMaintenanceInput = {
      asset_id: 'non-existent-asset-id',
      title: 'Test Maintenance',
      description: 'Test description',
      scheduled_date: new Date('2024-12-15T10:00:00Z'),
      created_by: testUserId
    };

    await expect(createMaintenance(input)).rejects.toThrow(/Asset with id non-existent-asset-id does not exist/);
  });

  it('should throw error for non-existent user', async () => {
    const input: CreateMaintenanceInput = {
      asset_id: testAssetId,
      title: 'Test Maintenance',
      description: 'Test description',
      scheduled_date: new Date('2024-12-15T10:00:00Z'),
      created_by: 'non-existent-user-id'
    };

    await expect(createMaintenance(input)).rejects.toThrow(/User with id non-existent-user-id does not exist/);
  });

  it('should handle different scheduled dates correctly', async () => {
    const futureDate = new Date('2025-03-10T09:30:00Z');
    const input: CreateMaintenanceInput = {
      asset_id: testAssetId,
      title: 'Annual Service',
      description: 'Comprehensive annual maintenance',
      scheduled_date: futureDate,
      created_by: testUserId
    };

    const result = await createMaintenance(input);

    expect(result.scheduled_date).toEqual(futureDate);
    expect(result.title).toEqual('Annual Service');

    // Verify activity log contains correct date
    const activityLogs = await db.select()
      .from(userActivityLogsTable)
      .where(eq(userActivityLogsTable.entity_id, result.id))
      .execute();

    expect(activityLogs[0].details).toContain('2025-03-10');
  });

  it('should create multiple maintenance schedules for same asset', async () => {
    const input1: CreateMaintenanceInput = {
      asset_id: testAssetId,
      title: 'Weekly Check',
      description: 'Weekly maintenance',
      scheduled_date: new Date('2024-12-15T10:00:00Z'),
      created_by: testUserId
    };

    const input2: CreateMaintenanceInput = {
      asset_id: testAssetId,
      title: 'Monthly Service',
      description: 'Monthly maintenance',
      scheduled_date: new Date('2024-12-30T14:00:00Z'),
      created_by: testUserId
    };

    const result1 = await createMaintenance(input1);
    const result2 = await createMaintenance(input2);

    // Both should have different IDs but same asset_id
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.asset_id).toEqual(testAssetId);
    expect(result2.asset_id).toEqual(testAssetId);
    expect(result1.title).toEqual('Weekly Check');
    expect(result2.title).toEqual('Monthly Service');

    // Verify both are in database
    const maintenances = await db.select()
      .from(maintenanceSchedulesTable)
      .where(eq(maintenanceSchedulesTable.asset_id, testAssetId))
      .execute();

    expect(maintenances).toHaveLength(2);
  });
});