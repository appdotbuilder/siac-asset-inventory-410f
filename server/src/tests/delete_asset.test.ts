import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetsTable, complaintsTable, assetHistoryTable, maintenanceSchedulesTable, usersTable } from '../db/schema';
import { deleteAsset } from '../handlers/delete_asset';
import { eq } from 'drizzle-orm';

describe('deleteAsset', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testAsset = {
    id: 'test-asset-1',
    name: 'Test Monitor',
    description: 'Test monitor for deletion',
    category: 'MONITOR' as const,
    condition: 'GOOD' as const,
    owner: 'test-user',
    photo_url: null,
    qr_code: 'QR123456',
    is_archived: false,
    created_at: new Date(),
    updated_at: new Date()
  };

  const testUser = {
    id: 'test-user-1',
    email: 'test@example.com',
    password_hash: 'hashed_password',
    role: 'ADMIN' as const,
    full_name: 'Test User',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  it('should soft delete (archive) an asset by default', async () => {
    // Create test asset
    await db.insert(assetsTable).values(testAsset).execute();

    // Soft delete the asset
    const result = await deleteAsset('test-asset-1');

    expect(result.success).toBe(true);

    // Verify asset is archived, not deleted
    const assets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, 'test-asset-1'))
      .execute();

    expect(assets).toHaveLength(1);
    expect(assets[0].is_archived).toBe(true);
    expect(assets[0].updated_at).toBeInstanceOf(Date);
  });

  it('should permanently delete an asset and related records', async () => {
    // Create test user first (required for foreign keys)
    await db.insert(usersTable).values(testUser).execute();
    
    // Create test asset
    await db.insert(assetsTable).values(testAsset).execute();

    // Create related records
    await db.insert(complaintsTable).values({
      id: 'complaint-1',
      asset_id: 'test-asset-1',
      complainant_name: 'Test Complainant',
      status: 'NEEDS_REPAIR',
      description: 'Test complaint',
      created_at: new Date(),
      updated_at: new Date()
    }).execute();

    await db.insert(assetHistoryTable).values({
      id: 'history-1',
      asset_id: 'test-asset-1',
      field_name: 'condition',
      old_value: 'NEW',
      new_value: 'GOOD',
      changed_by: 'test-user-1',
      changed_at: new Date()
    }).execute();

    await db.insert(maintenanceSchedulesTable).values({
      id: 'maintenance-1',
      asset_id: 'test-asset-1',
      title: 'Test Maintenance',
      description: 'Test maintenance task',
      scheduled_date: new Date(),
      is_completed: false,
      created_by: 'test-user-1',
      created_at: new Date(),
      updated_at: new Date()
    }).execute();

    // Permanently delete the asset
    const result = await deleteAsset('test-asset-1', true);

    expect(result.success).toBe(true);

    // Verify asset is completely deleted
    const assets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, 'test-asset-1'))
      .execute();

    expect(assets).toHaveLength(0);

    // Verify related records are also deleted
    const complaints = await db.select()
      .from(complaintsTable)
      .where(eq(complaintsTable.asset_id, 'test-asset-1'))
      .execute();

    const history = await db.select()
      .from(assetHistoryTable)
      .where(eq(assetHistoryTable.asset_id, 'test-asset-1'))
      .execute();

    const maintenances = await db.select()
      .from(maintenanceSchedulesTable)
      .where(eq(maintenanceSchedulesTable.asset_id, 'test-asset-1'))
      .execute();

    expect(complaints).toHaveLength(0);
    expect(history).toHaveLength(0);
    expect(maintenances).toHaveLength(0);
  });

  it('should return false when trying to delete non-existent asset', async () => {
    const result = await deleteAsset('non-existent-id');

    expect(result.success).toBe(false);
  });

  it('should return false when trying to permanently delete non-existent asset', async () => {
    const result = await deleteAsset('non-existent-id', true);

    expect(result.success).toBe(false);
  });

  it('should not affect other assets during soft delete', async () => {
    // Create multiple test assets
    const asset1 = { ...testAsset, id: 'asset-1', qr_code: 'QR111' };
    const asset2 = { ...testAsset, id: 'asset-2', qr_code: 'QR222' };

    await db.insert(assetsTable).values([asset1, asset2]).execute();

    // Soft delete only one asset
    const result = await deleteAsset('asset-1');

    expect(result.success).toBe(true);

    // Verify correct asset is archived
    const archivedAssets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, 'asset-1'))
      .execute();

    const activeAssets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, 'asset-2'))
      .execute();

    expect(archivedAssets[0].is_archived).toBe(true);
    expect(activeAssets[0].is_archived).toBe(false);
  });

  it('should handle permanent deletion without related records', async () => {
    // Create test asset without any related records
    await db.insert(assetsTable).values(testAsset).execute();

    // Permanently delete the asset
    const result = await deleteAsset('test-asset-1', true);

    expect(result.success).toBe(true);

    // Verify asset is completely deleted
    const assets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, 'test-asset-1'))
      .execute();

    expect(assets).toHaveLength(0);
  });
});