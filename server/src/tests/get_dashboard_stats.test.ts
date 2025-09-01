import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  assetsTable, 
  usersTable, 
  complaintsTable, 
  maintenanceSchedulesTable, 
  userActivityLogsTable 
} from '../db/schema';
import { getDashboardStats } from '../handlers/get_dashboard_stats';

describe('getDashboardStats', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return zero stats for empty database', async () => {
    const stats = await getDashboardStats();

    expect(stats.total_assets).toBe(0);
    expect(stats.archived_assets).toBe(0);
    expect(stats.pending_complaints).toBe(0);
    expect(stats.upcoming_maintenance).toBe(0);
    expect(stats.recent_activities).toBe(0);
    expect(Object.keys(stats.assets_by_condition)).toHaveLength(0);
    expect(Object.keys(stats.assets_by_category)).toHaveLength(0);
  });

  it('should count total and archived assets correctly', async () => {
    // Create test assets
    await db.insert(assetsTable).values([
      {
        id: 'asset-1',
        name: 'Monitor 1',
        category: 'MONITOR',
        condition: 'GOOD',
        qr_code: 'QR001',
        is_archived: false
      },
      {
        id: 'asset-2',
        name: 'Monitor 2',
        category: 'MONITOR',
        condition: 'NEW',
        qr_code: 'QR002',
        is_archived: false
      },
      {
        id: 'asset-3',
        name: 'Old Chair',
        category: 'CHAIR',
        condition: 'DAMAGED',
        qr_code: 'QR003',
        is_archived: true
      }
    ]).execute();

    const stats = await getDashboardStats();

    expect(stats.total_assets).toBe(3);
    expect(stats.archived_assets).toBe(1);
  });

  it('should group assets by condition correctly', async () => {
    // Create assets with different conditions
    await db.insert(assetsTable).values([
      {
        id: 'asset-1',
        name: 'Monitor 1',
        category: 'MONITOR',
        condition: 'NEW',
        qr_code: 'QR001',
        is_archived: false
      },
      {
        id: 'asset-2',
        name: 'Monitor 2',
        category: 'MONITOR',
        condition: 'NEW',
        qr_code: 'QR002',
        is_archived: false
      },
      {
        id: 'asset-3',
        name: 'CPU 1',
        category: 'CPU',
        condition: 'GOOD',
        qr_code: 'QR003',
        is_archived: false
      },
      {
        id: 'asset-4',
        name: 'Chair 1',
        category: 'CHAIR',
        condition: 'UNDER_REPAIR',
        qr_code: 'QR004',
        is_archived: false
      },
      {
        id: 'asset-5',
        name: 'Archived Monitor',
        category: 'MONITOR',
        condition: 'DAMAGED',
        qr_code: 'QR005',
        is_archived: true
      }
    ]).execute();

    const stats = await getDashboardStats();

    // Archived assets should not be counted in condition stats
    expect(stats.assets_by_condition['NEW']).toBe(2);
    expect(stats.assets_by_condition['GOOD']).toBe(1);
    expect(stats.assets_by_condition['UNDER_REPAIR']).toBe(1);
    expect(stats.assets_by_condition['DAMAGED']).toBeUndefined();
  });

  it('should group assets by category correctly', async () => {
    // Create assets with different categories
    await db.insert(assetsTable).values([
      {
        id: 'asset-1',
        name: 'Monitor 1',
        category: 'MONITOR',
        condition: 'NEW',
        qr_code: 'QR001',
        is_archived: false
      },
      {
        id: 'asset-2',
        name: 'Monitor 2',
        category: 'MONITOR',
        condition: 'GOOD',
        qr_code: 'QR002',
        is_archived: false
      },
      {
        id: 'asset-3',
        name: 'CPU 1',
        category: 'CPU',
        condition: 'NEW',
        qr_code: 'QR003',
        is_archived: false
      },
      {
        id: 'asset-4',
        name: 'Chair 1',
        category: 'CHAIR',
        condition: 'GOOD',
        qr_code: 'QR004',
        is_archived: false
      },
      {
        id: 'asset-5',
        name: 'Router 1',
        category: 'ROUTER',
        condition: 'NEW',
        qr_code: 'QR005',
        is_archived: false
      },
      {
        id: 'asset-6',
        name: 'Archived Table',
        category: 'TABLE',
        condition: 'DAMAGED',
        qr_code: 'QR006',
        is_archived: true
      }
    ]).execute();

    const stats = await getDashboardStats();

    // Archived assets should not be counted in category stats
    expect(stats.assets_by_category['MONITOR']).toBe(2);
    expect(stats.assets_by_category['CPU']).toBe(1);
    expect(stats.assets_by_category['CHAIR']).toBe(1);
    expect(stats.assets_by_category['ROUTER']).toBe(1);
    expect(stats.assets_by_category['TABLE']).toBeUndefined();
  });

  it('should count pending complaints correctly', async () => {
    // Create test asset first
    await db.insert(assetsTable).values({
      id: 'asset-1',
      name: 'Monitor 1',
      category: 'MONITOR',
      condition: 'GOOD',
      qr_code: 'QR001'
    }).execute();

    // Create complaints with different statuses
    await db.insert(complaintsTable).values([
      {
        id: 'complaint-1',
        asset_id: 'asset-1',
        complainant_name: 'John Doe',
        status: 'NEEDS_REPAIR',
        description: 'Screen flickering'
      },
      {
        id: 'complaint-2',
        asset_id: 'asset-1',
        complainant_name: 'Jane Smith',
        status: 'URGENT',
        description: 'Complete failure'
      },
      {
        id: 'complaint-3',
        asset_id: 'asset-1',
        complainant_name: 'Bob Johnson',
        status: 'UNDER_REPAIR',
        description: 'Being fixed'
      },
      {
        id: 'complaint-4',
        asset_id: 'asset-1',
        complainant_name: 'Alice Brown',
        status: 'RESOLVED',
        description: 'Fixed successfully'
      }
    ]).execute();

    const stats = await getDashboardStats();

    // All statuses except 'RESOLVED' should be counted as pending
    expect(stats.pending_complaints).toBe(3);
  });

  it('should count upcoming maintenance correctly', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      id: 'user-1',
      email: 'test@example.com',
      password_hash: 'hashed_password',
      role: 'ADMIN',
      full_name: 'Test User'
    }).execute();

    // Create test asset
    await db.insert(assetsTable).values({
      id: 'asset-1',
      name: 'Monitor 1',
      category: 'MONITOR',
      condition: 'GOOD',
      qr_code: 'QR001'
    }).execute();

    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    
    const nextMonth = new Date();
    nextMonth.setDate(now.getDate() + 35); // Beyond 30 days
    
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    // Create maintenance schedules
    await db.insert(maintenanceSchedulesTable).values([
      {
        id: 'maintenance-1',
        asset_id: 'asset-1',
        title: 'Regular cleaning',
        scheduled_date: tomorrow,
        is_completed: false,
        created_by: 'user-1'
      },
      {
        id: 'maintenance-2',
        asset_id: 'asset-1',
        title: 'Weekly check',
        scheduled_date: nextWeek,
        is_completed: false,
        created_by: 'user-1'
      },
      {
        id: 'maintenance-3',
        asset_id: 'asset-1',
        title: 'Monthly service',
        scheduled_date: nextMonth, // Beyond 30 days - should not count
        is_completed: false,
        created_by: 'user-1'
      },
      {
        id: 'maintenance-4',
        asset_id: 'asset-1',
        title: 'Completed task',
        scheduled_date: tomorrow,
        is_completed: true, // Completed - should not count
        created_by: 'user-1'
      },
      {
        id: 'maintenance-5',
        asset_id: 'asset-1',
        title: 'Past due',
        scheduled_date: yesterday, // Past date but not completed - should not count in upcoming
        is_completed: false,
        created_by: 'user-1'
      }
    ]).execute();

    const stats = await getDashboardStats();

    // Only future, non-completed maintenance within 30 days should count
    expect(stats.upcoming_maintenance).toBe(2);
  });

  it('should count recent activities correctly', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      id: 'user-1',
      email: 'test@example.com',
      password_hash: 'hashed_password',
      role: 'ADMIN',
      full_name: 'Test User'
    }).execute();

    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(now.getDate() - 3);
    
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(now.getDate() - 10); // Beyond 7 days

    // Create activity logs
    await db.insert(userActivityLogsTable).values([
      {
        id: 'activity-1',
        user_id: 'user-1',
        action: 'CREATE_ASSET',
        entity_type: 'ASSET',
        entity_id: 'asset-1',
        timestamp: now
      },
      {
        id: 'activity-2',
        user_id: 'user-1',
        action: 'UPDATE_ASSET',
        entity_type: 'ASSET',
        entity_id: 'asset-1',
        timestamp: yesterday
      },
      {
        id: 'activity-3',
        user_id: 'user-1',
        action: 'CREATE_COMPLAINT',
        entity_type: 'COMPLAINT',
        entity_id: 'complaint-1',
        timestamp: threeDaysAgo
      },
      {
        id: 'activity-4',
        user_id: 'user-1',
        action: 'OLD_ACTION',
        entity_type: 'ASSET',
        entity_id: 'asset-2',
        timestamp: tenDaysAgo // Beyond 7 days - should not count
      }
    ]).execute();

    const stats = await getDashboardStats();

    // Only activities within last 7 days should count
    expect(stats.recent_activities).toBe(3);
  });

  it('should return complete dashboard stats with all metrics', async () => {
    // Create test user
    await db.insert(usersTable).values({
      id: 'user-1',
      email: 'admin@example.com',
      password_hash: 'hashed_password',
      role: 'ADMIN',
      full_name: 'Admin User'
    }).execute();

    // Create diverse assets
    await db.insert(assetsTable).values([
      {
        id: 'asset-1',
        name: 'Monitor 1',
        category: 'MONITOR',
        condition: 'NEW',
        qr_code: 'QR001',
        is_archived: false
      },
      {
        id: 'asset-2',
        name: 'CPU 1',
        category: 'CPU',
        condition: 'GOOD',
        qr_code: 'QR002',
        is_archived: false
      },
      {
        id: 'asset-3',
        name: 'Old Chair',
        category: 'CHAIR',
        condition: 'DAMAGED',
        qr_code: 'QR003',
        is_archived: true
      }
    ]).execute();

    // Create complaints
    await db.insert(complaintsTable).values([
      {
        id: 'complaint-1',
        asset_id: 'asset-1',
        complainant_name: 'User 1',
        status: 'NEEDS_REPAIR',
        description: 'Issue 1'
      },
      {
        id: 'complaint-2',
        asset_id: 'asset-2',
        complainant_name: 'User 2',
        status: 'RESOLVED',
        description: 'Issue 2'
      }
    ]).execute();

    // Create maintenance
    const tomorrow = new Date();
    tomorrow.setDate(new Date().getDate() + 1);

    await db.insert(maintenanceSchedulesTable).values({
      id: 'maintenance-1',
      asset_id: 'asset-1',
      title: 'Scheduled maintenance',
      scheduled_date: tomorrow,
      is_completed: false,
      created_by: 'user-1'
    }).execute();

    // Create activity log
    await db.insert(userActivityLogsTable).values({
      id: 'activity-1',
      user_id: 'user-1',
      action: 'CREATE_ASSET',
      entity_type: 'ASSET',
      entity_id: 'asset-1',
      timestamp: new Date()
    }).execute();

    const stats = await getDashboardStats();

    // Verify all stats are populated
    expect(stats.total_assets).toBe(3);
    expect(stats.archived_assets).toBe(1);
    expect(stats.pending_complaints).toBe(1);
    expect(stats.upcoming_maintenance).toBe(1);
    expect(stats.recent_activities).toBe(1);
    expect(stats.assets_by_condition['NEW']).toBe(1);
    expect(stats.assets_by_condition['GOOD']).toBe(1);
    expect(stats.assets_by_category['MONITOR']).toBe(1);
    expect(stats.assets_by_category['CPU']).toBe(1);
  });
});