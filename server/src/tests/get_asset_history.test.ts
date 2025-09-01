import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetsTable, assetHistoryTable, usersTable } from '../db/schema';
import { getAssetHistory } from '../handlers/get_asset_history';
import { v4 as uuidv4 } from 'uuid';

// Test data
const testAsset = {
  id: uuidv4(),
  name: 'Test Monitor',
  description: 'Dell Monitor for testing',
  category: 'MONITOR' as const,
  condition: 'GOOD' as const,
  owner: null,
  photo_url: null,
  qr_code: `QR-${Date.now()}`,
  is_archived: false
};

const testUser = {
  id: uuidv4(),
  email: 'admin@test.com',
  password_hash: 'hashed_password',
  role: 'ADMIN' as const,
  full_name: 'Test Admin',
  is_active: true
};

const testHistory1 = {
  id: uuidv4(),
  asset_id: testAsset.id,
  field_name: 'condition',
  old_value: 'NEW',
  new_value: 'GOOD',
  changed_by: testUser.id
};

const testHistory2 = {
  id: uuidv4(),
  asset_id: testAsset.id,
  field_name: 'owner',
  old_value: null,
  new_value: 'John Doe',
  changed_by: testUser.id
};

const testHistory3 = {
  id: uuidv4(),
  asset_id: testAsset.id,
  field_name: 'description',
  old_value: 'Dell Monitor for testing',
  new_value: 'Dell Monitor - Updated description',
  changed_by: testUser.id
};

describe('getAssetHistory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return asset history for a specific asset', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(assetsTable).values(testAsset).execute();
    
    // Create history records
    await db.insert(assetHistoryTable).values(testHistory1).execute();
    await db.insert(assetHistoryTable).values(testHistory2).execute();
    
    const result = await getAssetHistory(testAsset.id);

    expect(result).toHaveLength(2);
    expect(result[0].asset_id).toEqual(testAsset.id);
    expect(result[1].asset_id).toEqual(testAsset.id);
    
    // Verify all fields are present
    result.forEach(history => {
      expect(history.id).toBeDefined();
      expect(history.field_name).toBeDefined();
      expect(history.changed_at).toBeInstanceOf(Date);
      expect(history.changed_by).toEqual(testUser.id);
    });
  });

  it('should return empty array for asset with no history', async () => {
    // Create asset without history
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(assetsTable).values(testAsset).execute();
    
    const result = await getAssetHistory(testAsset.id);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return history in chronological order (most recent first)', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(assetsTable).values(testAsset).execute();
    
    // Create history records with slight delays to ensure different timestamps
    await db.insert(assetHistoryTable).values(testHistory1).execute();
    
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    await db.insert(assetHistoryTable).values(testHistory2).execute();
    
    await new Promise(resolve => setTimeout(resolve, 10));
    await db.insert(assetHistoryTable).values(testHistory3).execute();
    
    const result = await getAssetHistory(testAsset.id);

    expect(result).toHaveLength(3);
    
    // Verify chronological order - most recent first
    expect(result[0].changed_at >= result[1].changed_at).toBe(true);
    expect(result[1].changed_at >= result[2].changed_at).toBe(true);
    
    // Verify the latest change is the description update
    expect(result[0].field_name).toEqual('description');
    expect(result[0].new_value).toEqual('Dell Monitor - Updated description');
  });

  it('should handle null values in old_value and new_value', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(assetsTable).values(testAsset).execute();
    
    const historyWithNulls = {
      id: uuidv4(),
      asset_id: testAsset.id,
      field_name: 'owner',
      old_value: null,
      new_value: 'New Owner',
      changed_by: testUser.id
    };
    
    await db.insert(assetHistoryTable).values(historyWithNulls).execute();
    
    const result = await getAssetHistory(testAsset.id);

    expect(result).toHaveLength(1);
    expect(result[0].old_value).toBeNull();
    expect(result[0].new_value).toEqual('New Owner');
    expect(result[0].field_name).toEqual('owner');
  });

  it('should only return history for the specified asset', async () => {
    // Create second asset
    const otherAsset = {
      ...testAsset,
      id: uuidv4(),
      name: 'Other Monitor',
      qr_code: `QR-OTHER-${Date.now()}`
    };
    
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(assetsTable).values([testAsset, otherAsset]).execute();
    
    // Create history for both assets
    await db.insert(assetHistoryTable).values(testHistory1).execute();
    
    const otherHistory = {
      ...testHistory2,
      id: uuidv4(),
      asset_id: otherAsset.id
    };
    await db.insert(assetHistoryTable).values(otherHistory).execute();
    
    const result = await getAssetHistory(testAsset.id);

    expect(result).toHaveLength(1);
    expect(result[0].asset_id).toEqual(testAsset.id);
    expect(result[0].asset_id).not.toEqual(otherAsset.id);
  });

  it('should handle history records with null changed_by', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(assetsTable).values(testAsset).execute();
    
    const historyWithoutUser = {
      id: uuidv4(),
      asset_id: testAsset.id,
      field_name: 'condition',
      old_value: 'GOOD',
      new_value: 'UNDER_REPAIR',
      changed_by: null
    };
    
    await db.insert(assetHistoryTable).values(historyWithoutUser).execute();
    
    const result = await getAssetHistory(testAsset.id);

    expect(result).toHaveLength(1);
    expect(result[0].changed_by).toBeNull();
    expect(result[0].field_name).toEqual('condition');
    expect(result[0].old_value).toEqual('GOOD');
    expect(result[0].new_value).toEqual('UNDER_REPAIR');
  });
});