import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetsTable, userActivityLogsTable, usersTable } from '../db/schema';
import { type CreateAssetInput } from '../schema';
import { createAsset } from '../handlers/create_asset';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Test input data
const baseTestInput: CreateAssetInput = {
  name: 'Test Monitor',
  description: 'A monitor for testing',
  category: 'MONITOR',
  condition: 'NEW',
  owner: null,
  photo_url: null
};

const testInputWithOwner: CreateAssetInput = {
  name: 'Test CPU',
  description: 'A CPU for testing',
  category: 'CPU',
  condition: 'GOOD',
  owner: 'user_123',
  photo_url: 'https://example.com/photo.jpg'
};

describe('createAsset', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an asset with required fields', async () => {
    const result = await createAsset(baseTestInput);

    // Basic field validation
    expect(result.name).toEqual('Test Monitor');
    expect(result.description).toEqual('A monitor for testing');
    expect(result.category).toEqual('MONITOR');
    expect(result.condition).toEqual('NEW');
    expect(result.owner).toBeNull();
    expect(result.photo_url).toBeNull();
    expect(result.is_archived).toBe(false);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.qr_code).toMatch(/^QR_/);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create an asset with all fields populated', async () => {
    const result = await createAsset(testInputWithOwner);

    expect(result.name).toEqual('Test CPU');
    expect(result.description).toEqual('A CPU for testing');
    expect(result.category).toEqual('CPU');
    expect(result.condition).toEqual('GOOD');
    expect(result.owner).toEqual('user_123');
    expect(result.photo_url).toEqual('https://example.com/photo.jpg');
    expect(result.is_archived).toBe(false);
    expect(result.id).toBeDefined();
    expect(result.qr_code).toMatch(/^QR_/);
  });

  it('should save asset to database', async () => {
    const result = await createAsset(baseTestInput);

    // Query database to verify asset was saved
    const assets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, result.id))
      .execute();

    expect(assets).toHaveLength(1);
    expect(assets[0].name).toEqual('Test Monitor');
    expect(assets[0].description).toEqual('A monitor for testing');
    expect(assets[0].category).toEqual('MONITOR');
    expect(assets[0].condition).toEqual('NEW');
    expect(assets[0].owner).toBeNull();
    expect(assets[0].is_archived).toBe(false);
    expect(assets[0].qr_code).toMatch(/^QR_/);
    expect(assets[0].created_at).toBeInstanceOf(Date);
    expect(assets[0].updated_at).toBeInstanceOf(Date);
  });

  it('should generate unique QR codes for different assets', async () => {
    const input1: CreateAssetInput = {
      ...baseTestInput,
      name: 'Asset 1'
    };
    
    const input2: CreateAssetInput = {
      ...baseTestInput,
      name: 'Asset 2'
    };

    const result1 = await createAsset(input1);
    const result2 = await createAsset(input2);

    expect(result1.qr_code).not.toEqual(result2.qr_code);
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.qr_code).toMatch(/^QR_/);
    expect(result2.qr_code).toMatch(/^QR_/);
  });

  it('should log creation activity with owner as user when user exists', async () => {
    // Create a user first
    await db.insert(usersTable)
      .values({
        id: 'user_123',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'EMPLOYEE',
        full_name: 'Test User',
        is_active: true
      })
      .execute();

    const result = await createAsset(testInputWithOwner);

    // Check activity log was created
    const activityLogs = await db.select()
      .from(userActivityLogsTable)
      .where(eq(userActivityLogsTable.entity_id, result.id))
      .execute();

    expect(activityLogs).toHaveLength(1);
    expect(activityLogs[0].user_id).toEqual('user_123');
    expect(activityLogs[0].action).toEqual('CREATE');
    expect(activityLogs[0].entity_type).toEqual('ASSET');
    expect(activityLogs[0].entity_id).toEqual(result.id);
    expect(activityLogs[0].details).toContain('Test CPU');
    expect(activityLogs[0].details).toContain('CPU');
    expect(activityLogs[0].timestamp).toBeInstanceOf(Date);
  });

  it('should not log creation activity when no owner specified', async () => {
    const result = await createAsset(baseTestInput);

    // Check no activity log was created since no owner was specified
    const activityLogs = await db.select()
      .from(userActivityLogsTable)
      .where(eq(userActivityLogsTable.entity_id, result.id))
      .execute();

    expect(activityLogs).toHaveLength(0);
  });

  it('should handle different asset categories and conditions', async () => {
    // Create user for the AC asset
    await db.insert(usersTable)
      .values({
        id: 'user_ac',
        email: 'ac@example.com',
        password_hash: 'hashed_password',
        role: 'EMPLOYEE',
        full_name: 'AC User',
        is_active: true
      })
      .execute();

    const testInputs: CreateAssetInput[] = [
      {
        name: 'AC Unit',
        description: 'Air conditioning unit',
        category: 'AC',
        condition: 'UNDER_REPAIR',
        owner: 'user_ac',
        photo_url: null
      },
      {
        name: 'Office Chair',
        description: null,
        category: 'CHAIR',
        condition: 'DAMAGED',
        owner: null,
        photo_url: 'https://example.com/chair.jpg'
      }
    ];

    for (const input of testInputs) {
      const result = await createAsset(input);
      
      expect(result.name).toEqual(input.name);
      expect(result.category).toEqual(input.category);
      expect(result.condition).toEqual(input.condition);
      expect(result.owner).toEqual(input.owner);
      expect(result.description).toEqual(input.description);
      expect(result.photo_url).toEqual(input.photo_url);
      
      // Verify in database
      const dbAssets = await db.select()
        .from(assetsTable)
        .where(eq(assetsTable.id, result.id))
        .execute();
        
      expect(dbAssets).toHaveLength(1);
      expect(dbAssets[0].category).toEqual(input.category);
      expect(dbAssets[0].condition).toEqual(input.condition);
    }
  });

  it('should create asset without logging when owner does not exist in users table', async () => {
    const inputWithNonExistentOwner: CreateAssetInput = {
      ...baseTestInput,
      name: 'Asset with Non-existent Owner',
      owner: 'non_existent_user'
    };

    const result = await createAsset(inputWithNonExistentOwner);

    expect(result.name).toEqual('Asset with Non-existent Owner');
    expect(result.owner).toEqual('non_existent_user');
    expect(result.id).toBeDefined();
    
    // Verify asset was saved to database
    const assets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, result.id))
      .execute();

    expect(assets).toHaveLength(1);
    expect(assets[0].name).toEqual('Asset with Non-existent Owner');
    expect(assets[0].owner).toEqual('non_existent_user');

    // Verify no activity log was created since user doesn't exist
    const activityLogs = await db.select()
      .from(userActivityLogsTable)
      .where(eq(userActivityLogsTable.entity_id, result.id))
      .execute();

    expect(activityLogs).toHaveLength(0);
  });

  it('should continue asset creation even if activity logging fails', async () => {
    // Create asset with valid input
    const validInput: CreateAssetInput = {
      ...baseTestInput,
      name: 'Test Asset with Logging Issue'
    };

    // The asset creation should still succeed even if logging fails
    const result = await createAsset(validInput);

    expect(result.name).toEqual('Test Asset with Logging Issue');
    expect(result.id).toBeDefined();
    
    // Verify asset was saved to database
    const assets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, result.id))
      .execute();

    expect(assets).toHaveLength(1);
    expect(assets[0].name).toEqual('Test Asset with Logging Issue');
  });
});