import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetsTable, userActivityLogsTable } from '../db/schema';
import { restoreAsset } from '../handlers/restore_asset';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('restoreAsset', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should restore an archived asset', async () => {
    // Create an archived asset
    const assetId = randomUUID();
    await db.insert(assetsTable)
      .values({
        id: assetId,
        name: 'Test Monitor',
        description: 'A test monitor',
        category: 'MONITOR',
        condition: 'GOOD',
        owner: 'John Doe',
        photo_url: null,
        qr_code: 'QR_' + assetId,
        is_archived: true // Initially archived
      })
      .execute();

    // Restore the asset
    const result = await restoreAsset(assetId);

    // Verify the result
    expect(result.id).toEqual(assetId);
    expect(result.name).toEqual('Test Monitor');
    expect(result.description).toEqual('A test monitor');
    expect(result.category).toEqual('MONITOR');
    expect(result.condition).toEqual('GOOD');
    expect(result.owner).toEqual('John Doe');
    expect(result.is_archived).toBe(false);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update the asset in the database', async () => {
    // Create an archived asset
    const assetId = randomUUID();
    await db.insert(assetsTable)
      .values({
        id: assetId,
        name: 'Test CPU',
        description: 'A test CPU',
        category: 'CPU',
        condition: 'NEW',
        owner: null,
        photo_url: null,
        qr_code: 'QR_' + assetId,
        is_archived: true
      })
      .execute();

    // Restore the asset
    await restoreAsset(assetId);

    // Verify the asset is updated in the database
    const assets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, assetId))
      .execute();

    expect(assets).toHaveLength(1);
    expect(assets[0].is_archived).toBe(false);
    expect(assets[0].updated_at).toBeInstanceOf(Date);
  });

  it('should log the restoration activity', async () => {
    // Create an archived asset
    const assetId = randomUUID();
    await db.insert(assetsTable)
      .values({
        id: assetId,
        name: 'Test Chair',
        description: null,
        category: 'CHAIR',
        condition: 'GOOD',
        owner: 'Jane Smith',
        photo_url: null,
        qr_code: 'QR_' + assetId,
        is_archived: true
      })
      .execute();

    // Restore the asset
    await restoreAsset(assetId);

    // Verify activity log was created
    const activityLogs = await db.select()
      .from(userActivityLogsTable)
      .where(eq(userActivityLogsTable.entity_id, assetId))
      .execute();

    expect(activityLogs).toHaveLength(1);
    expect(activityLogs[0].user_id).toEqual('system');
    expect(activityLogs[0].action).toEqual('RESTORE_ASSET');
    expect(activityLogs[0].entity_type).toEqual('ASSET');
    expect(activityLogs[0].entity_id).toEqual(assetId);
    expect(activityLogs[0].details).toContain('Test Chair');
    expect(activityLogs[0].details).toContain('restored from archive');
    expect(activityLogs[0].timestamp).toBeInstanceOf(Date);
  });

  it('should throw error when asset does not exist', async () => {
    const nonExistentId = randomUUID();

    await expect(restoreAsset(nonExistentId))
      .rejects
      .toThrow(/Asset with id .+ not found/i);
  });

  it('should throw error when asset is not archived', async () => {
    // Create a non-archived asset
    const assetId = randomUUID();
    await db.insert(assetsTable)
      .values({
        id: assetId,
        name: 'Active Asset',
        description: 'An active asset',
        category: 'TABLE',
        condition: 'GOOD',
        owner: null,
        photo_url: null,
        qr_code: 'QR_' + assetId,
        is_archived: false // Not archived
      })
      .execute();

    await expect(restoreAsset(assetId))
      .rejects
      .toThrow(/Asset with id .+ is not archived/i);
  });

  it('should handle assets with all nullable fields', async () => {
    // Create an archived asset with minimal data
    const assetId = randomUUID();
    await db.insert(assetsTable)
      .values({
        id: assetId,
        name: 'Minimal Asset',
        description: null,
        category: 'OTHER',
        condition: 'DAMAGED',
        owner: null,
        photo_url: null,
        qr_code: 'QR_' + assetId,
        is_archived: true
      })
      .execute();

    // Restore the asset
    const result = await restoreAsset(assetId);

    // Verify all nullable fields are handled correctly
    expect(result.id).toEqual(assetId);
    expect(result.name).toEqual('Minimal Asset');
    expect(result.description).toBeNull();
    expect(result.owner).toBeNull();
    expect(result.photo_url).toBeNull();
    expect(result.is_archived).toBe(false);
  });
});