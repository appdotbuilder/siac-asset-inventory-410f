import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetsTable, assetHistoryTable } from '../db/schema';
import { type UpdateAssetInput } from '../schema';
import { updateAsset } from '../handlers/update_asset';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

describe('updateAsset', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const createTestAsset = async () => {
    const assetId = randomBytes(16).toString('hex');
    const qrCode = `QR_${randomBytes(8).toString('hex')}`;
    
    await db.insert(assetsTable).values({
      id: assetId,
      name: 'Test Asset',
      description: 'Original description',
      category: 'MONITOR',
      condition: 'GOOD',
      owner: 'original_owner',
      photo_url: 'https://example.com/photo.jpg',
      qr_code: qrCode,
      is_archived: false,
      created_at: new Date(),
      updated_at: new Date()
    }).execute();

    return assetId;
  };

  it('should update asset name and track changes', async () => {
    const assetId = await createTestAsset();
    
    const updateInput: UpdateAssetInput = {
      id: assetId,
      name: 'Updated Asset Name'
    };

    const result = await updateAsset(updateInput);

    expect(result.id).toEqual(assetId);
    expect(result.name).toEqual('Updated Asset Name');
    expect(result.description).toEqual('Original description'); // Unchanged
    expect(result.category).toEqual('MONITOR'); // Unchanged
    expect(result.condition).toEqual('GOOD'); // Unchanged
    expect(result.owner).toEqual('original_owner'); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update multiple fields and track all changes', async () => {
    const assetId = await createTestAsset();
    
    const updateInput: UpdateAssetInput = {
      id: assetId,
      name: 'New Asset Name',
      condition: 'UNDER_REPAIR',
      owner: 'new_owner',
      description: 'Updated description'
    };

    const result = await updateAsset(updateInput);

    expect(result.name).toEqual('New Asset Name');
    expect(result.condition).toEqual('UNDER_REPAIR');
    expect(result.owner).toEqual('new_owner');
    expect(result.description).toEqual('Updated description');
    expect(result.category).toEqual('MONITOR'); // Unchanged
    expect(result.photo_url).toEqual('https://example.com/photo.jpg'); // Unchanged
  });

  it('should save changes to asset history table', async () => {
    const assetId = await createTestAsset();
    
    const updateInput: UpdateAssetInput = {
      id: assetId,
      name: 'History Test Asset',
      condition: 'DAMAGED'
    };

    await updateAsset(updateInput);

    // Check history entries
    const historyEntries = await db.select()
      .from(assetHistoryTable)
      .where(eq(assetHistoryTable.asset_id, assetId))
      .execute();

    expect(historyEntries).toHaveLength(2); // Two fields changed

    // Check name change history
    const nameChange = historyEntries.find(h => h.field_name === 'name');
    expect(nameChange).toBeDefined();
    expect(nameChange!.old_value).toEqual('Test Asset');
    expect(nameChange!.new_value).toEqual('History Test Asset');
    expect(nameChange!.changed_at).toBeInstanceOf(Date);

    // Check condition change history
    const conditionChange = historyEntries.find(h => h.field_name === 'condition');
    expect(conditionChange).toBeDefined();
    expect(conditionChange!.old_value).toEqual('GOOD');
    expect(conditionChange!.new_value).toEqual('DAMAGED');
    expect(conditionChange!.changed_at).toBeInstanceOf(Date);
  });

  it('should handle null values correctly', async () => {
    const assetId = await createTestAsset();
    
    const updateInput: UpdateAssetInput = {
      id: assetId,
      description: null,
      owner: null,
      photo_url: null
    };

    const result = await updateAsset(updateInput);

    expect(result.description).toBeNull();
    expect(result.owner).toBeNull();
    expect(result.photo_url).toBeNull();

    // Check history entries for null changes
    const historyEntries = await db.select()
      .from(assetHistoryTable)
      .where(eq(assetHistoryTable.asset_id, assetId))
      .execute();

    expect(historyEntries).toHaveLength(3); // Three fields changed to null

    const descriptionChange = historyEntries.find(h => h.field_name === 'description');
    expect(descriptionChange!.old_value).toEqual('Original description');
    expect(descriptionChange!.new_value).toBeNull();

    const ownerChange = historyEntries.find(h => h.field_name === 'owner');
    expect(ownerChange!.old_value).toEqual('original_owner');
    expect(ownerChange!.new_value).toBeNull();
  });

  it('should return existing asset when no changes are made', async () => {
    const assetId = await createTestAsset();
    
    const updateInput: UpdateAssetInput = {
      id: assetId,
      name: 'Test Asset', // Same as existing
      condition: 'GOOD'    // Same as existing
    };

    const result = await updateAsset(updateInput);

    expect(result.name).toEqual('Test Asset');
    expect(result.condition).toEqual('GOOD');

    // No history entries should be created
    const historyEntries = await db.select()
      .from(assetHistoryTable)
      .where(eq(assetHistoryTable.asset_id, assetId))
      .execute();

    expect(historyEntries).toHaveLength(0);
  });

  it('should update only provided fields', async () => {
    const assetId = await createTestAsset();
    
    const updateInput: UpdateAssetInput = {
      id: assetId,
      category: 'CPU' // Only updating category
    };

    const result = await updateAsset(updateInput);

    expect(result.category).toEqual('CPU');
    expect(result.name).toEqual('Test Asset'); // Unchanged
    expect(result.description).toEqual('Original description'); // Unchanged
    expect(result.condition).toEqual('GOOD'); // Unchanged
    expect(result.owner).toEqual('original_owner'); // Unchanged

    // Only one history entry for category change
    const historyEntries = await db.select()
      .from(assetHistoryTable)
      .where(eq(assetHistoryTable.asset_id, assetId))
      .execute();

    expect(historyEntries).toHaveLength(1);
    expect(historyEntries[0].field_name).toEqual('category');
    expect(historyEntries[0].old_value).toEqual('MONITOR');
    expect(historyEntries[0].new_value).toEqual('CPU');
  });

  it('should handle asset not found error', async () => {
    const nonExistentId = randomBytes(16).toString('hex');
    
    const updateInput: UpdateAssetInput = {
      id: nonExistentId,
      name: 'This should fail'
    };

    expect(updateAsset(updateInput)).rejects.toThrow(/not found/i);
  });

  it('should update asset in database', async () => {
    const assetId = await createTestAsset();
    
    const updateInput: UpdateAssetInput = {
      id: assetId,
      name: 'Database Test Asset',
      condition: 'UNDER_REPAIR'
    };

    await updateAsset(updateInput);

    // Verify changes in database
    const assets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, assetId))
      .execute();

    expect(assets).toHaveLength(1);
    expect(assets[0].name).toEqual('Database Test Asset');
    expect(assets[0].condition).toEqual('UNDER_REPAIR');
    expect(assets[0].updated_at).toBeInstanceOf(Date);
  });
});