import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetsTable, complaintsTable, assetHistoryTable, maintenanceSchedulesTable, usersTable } from '../db/schema';
import { getAssetById } from '../handlers/get_asset_by_id';

describe('getAssetById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent asset', async () => {
    const result = await getAssetById('non-existent-id');
    expect(result).toBeNull();
  });

  it('should return asset with empty relations when no related data exists', async () => {
    // Create a basic asset
    const assetId = 'test-asset-1';
    await db.insert(assetsTable).values({
      id: assetId,
      name: 'Test Monitor',
      description: 'A testing monitor',
      category: 'MONITOR',
      condition: 'GOOD',
      owner: 'John Doe',
      photo_url: 'https://example.com/monitor.jpg',
      qr_code: 'QR123456',
      is_archived: false
    }).execute();

    const result = await getAssetById(assetId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(assetId);
    expect(result!.name).toEqual('Test Monitor');
    expect(result!.description).toEqual('A testing monitor');
    expect(result!.category).toEqual('MONITOR');
    expect(result!.condition).toEqual('GOOD');
    expect(result!.owner).toEqual('John Doe');
    expect(result!.photo_url).toEqual('https://example.com/monitor.jpg');
    expect(result!.qr_code).toEqual('QR123456');
    expect(result!.is_archived).toEqual(false);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
    
    // Should have empty arrays for relations
    expect(result!.complaints).toEqual([]);
    expect(result!.history).toEqual([]);
    expect(result!.maintenance_schedules).toEqual([]);
  });

  it('should return asset with all related data', async () => {
    // Create prerequisite data
    const userId = 'test-user-1';
    const assetId = 'test-asset-2';

    // Create user first (needed for maintenance schedules and history)
    await db.insert(usersTable).values({
      id: userId,
      email: 'test@example.com',
      password_hash: 'hashed_password',
      role: 'ADMIN',
      full_name: 'Test User',
      is_active: true
    }).execute();

    // Create asset
    await db.insert(assetsTable).values({
      id: assetId,
      name: 'Test CPU',
      description: 'A testing CPU unit',
      category: 'CPU',
      condition: 'NEW',
      owner: 'Jane Smith',
      photo_url: 'https://example.com/cpu.jpg',
      qr_code: 'QR789012',
      is_archived: false
    }).execute();

    // Create complaints
    await db.insert(complaintsTable).values([
      {
        id: 'complaint-1',
        asset_id: assetId,
        complainant_name: 'Alice Johnson',
        status: 'NEEDS_REPAIR',
        description: 'CPU is overheating'
      },
      {
        id: 'complaint-2',
        asset_id: assetId,
        complainant_name: 'Bob Wilson',
        status: 'UNDER_REPAIR',
        description: 'Making unusual noise'
      }
    ]).execute();

    // Create asset history
    await db.insert(assetHistoryTable).values([
      {
        id: 'history-1',
        asset_id: assetId,
        field_name: 'condition',
        old_value: 'GOOD',
        new_value: 'NEW',
        changed_by: userId
      },
      {
        id: 'history-2',
        asset_id: assetId,
        field_name: 'owner',
        old_value: 'John Doe',
        new_value: 'Jane Smith',
        changed_by: userId
      }
    ]).execute();

    // Create maintenance schedules
    const scheduledDate = new Date('2024-06-15T10:00:00Z');
    await db.insert(maintenanceSchedulesTable).values([
      {
        id: 'maintenance-1',
        asset_id: assetId,
        title: 'Routine CPU Cleaning',
        description: 'Clean CPU fans and check thermal paste',
        scheduled_date: scheduledDate,
        is_completed: false,
        created_by: userId
      },
      {
        id: 'maintenance-2',
        asset_id: assetId,
        title: 'Performance Check',
        description: 'Check CPU performance metrics',
        scheduled_date: scheduledDate,
        is_completed: true,
        created_by: userId
      }
    ]).execute();

    const result = await getAssetById(assetId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(assetId);
    expect(result!.name).toEqual('Test CPU');
    expect(result!.category).toEqual('CPU');
    expect(result!.condition).toEqual('NEW');

    // Verify complaints
    expect(result!.complaints).toHaveLength(2);
    expect(result!.complaints[0].complainant_name).toEqual('Alice Johnson');
    expect(result!.complaints[0].status).toEqual('NEEDS_REPAIR');
    expect(result!.complaints[0].description).toEqual('CPU is overheating');
    expect(result!.complaints[1].complainant_name).toEqual('Bob Wilson');
    expect(result!.complaints[1].status).toEqual('UNDER_REPAIR');

    // Verify history
    expect(result!.history).toHaveLength(2);
    expect(result!.history[0].field_name).toEqual('condition');
    expect(result!.history[0].old_value).toEqual('GOOD');
    expect(result!.history[0].new_value).toEqual('NEW');
    expect(result!.history[1].field_name).toEqual('owner');
    expect(result!.history[1].old_value).toEqual('John Doe');
    expect(result!.history[1].new_value).toEqual('Jane Smith');

    // Verify maintenance schedules
    expect(result!.maintenance_schedules).toHaveLength(2);
    expect(result!.maintenance_schedules[0].title).toEqual('Routine CPU Cleaning');
    expect(result!.maintenance_schedules[0].description).toEqual('Clean CPU fans and check thermal paste');
    expect(result!.maintenance_schedules[0].is_completed).toEqual(false);
    expect(result!.maintenance_schedules[1].title).toEqual('Performance Check');
    expect(result!.maintenance_schedules[1].is_completed).toEqual(true);
  });

  it('should handle assets with mixed related data correctly', async () => {
    // Create prerequisite data
    const userId = 'test-user-3';
    const assetId = 'test-asset-3';

    // Create user
    await db.insert(usersTable).values({
      id: userId,
      email: 'mixed@example.com',
      password_hash: 'hashed_password',
      role: 'EMPLOYEE',
      full_name: 'Mixed Data User',
      is_active: true
    }).execute();

    // Create asset
    await db.insert(assetsTable).values({
      id: assetId,
      name: 'Test Chair',
      description: null, // Test null description
      category: 'CHAIR',
      condition: 'UNDER_REPAIR',
      owner: null, // Test null owner
      photo_url: null, // Test null photo_url
      qr_code: 'QR345678',
      is_archived: true
    }).execute();

    // Create only one complaint (partial related data)
    await db.insert(complaintsTable).values({
      id: 'complaint-3',
      asset_id: assetId,
      complainant_name: 'Charlie Brown',
      status: 'URGENT',
      description: 'Chair is broken'
    }).execute();

    // Create only asset history (no maintenance schedules)
    await db.insert(assetHistoryTable).values({
      id: 'history-3',
      asset_id: assetId,
      field_name: 'is_archived',
      old_value: 'false',
      new_value: 'true',
      changed_by: userId
    }).execute();

    const result = await getAssetById(assetId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(assetId);
    expect(result!.name).toEqual('Test Chair');
    expect(result!.description).toBeNull();
    expect(result!.category).toEqual('CHAIR');
    expect(result!.condition).toEqual('UNDER_REPAIR');
    expect(result!.owner).toBeNull();
    expect(result!.photo_url).toBeNull();
    expect(result!.is_archived).toEqual(true);

    // Should have one complaint
    expect(result!.complaints).toHaveLength(1);
    expect(result!.complaints[0].status).toEqual('URGENT');

    // Should have one history record
    expect(result!.history).toHaveLength(1);
    expect(result!.history[0].field_name).toEqual('is_archived');

    // Should have no maintenance schedules
    expect(result!.maintenance_schedules).toHaveLength(0);
  });

  it('should verify database integrity with asset relationships', async () => {
    // Create multiple assets to ensure we only get data for the requested asset
    const userId = 'test-user-4';
    const assetId1 = 'test-asset-4a';
    const assetId2 = 'test-asset-4b';

    await db.insert(usersTable).values({
      id: userId,
      email: 'integrity@example.com',
      password_hash: 'hashed_password',
      role: 'ADMIN',
      full_name: 'Integrity User',
      is_active: true
    }).execute();

    // Create two assets
    await db.insert(assetsTable).values([
      {
        id: assetId1,
        name: 'Asset 1',
        category: 'MONITOR',
        condition: 'GOOD',
        qr_code: 'QR111111'
      },
      {
        id: assetId2,
        name: 'Asset 2',
        category: 'CPU',
        condition: 'NEW',
        qr_code: 'QR222222'
      }
    ]).execute();

    // Create related data for both assets
    await db.insert(complaintsTable).values([
      {
        id: 'complaint-4a',
        asset_id: assetId1,
        complainant_name: 'User A',
        status: 'NEEDS_REPAIR',
        description: 'Issue with Asset 1'
      },
      {
        id: 'complaint-4b',
        asset_id: assetId2,
        complainant_name: 'User B',
        status: 'RESOLVED',
        description: 'Issue with Asset 2'
      }
    ]).execute();

    // Get Asset 1 - should only return data related to Asset 1
    const result1 = await getAssetById(assetId1);
    
    expect(result1).not.toBeNull();
    expect(result1!.id).toEqual(assetId1);
    expect(result1!.name).toEqual('Asset 1');
    expect(result1!.complaints).toHaveLength(1);
    expect(result1!.complaints[0].description).toEqual('Issue with Asset 1');
    expect(result1!.complaints[0].complainant_name).toEqual('User A');

    // Get Asset 2 - should only return data related to Asset 2
    const result2 = await getAssetById(assetId2);
    
    expect(result2).not.toBeNull();
    expect(result2!.id).toEqual(assetId2);
    expect(result2!.name).toEqual('Asset 2');
    expect(result2!.complaints).toHaveLength(1);
    expect(result2!.complaints[0].description).toEqual('Issue with Asset 2');
    expect(result2!.complaints[0].complainant_name).toEqual('User B');
  });
});