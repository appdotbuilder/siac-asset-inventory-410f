import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetsTable, complaintsTable, assetHistoryTable, maintenanceSchedulesTable, usersTable } from '../db/schema';
import { getAIRecommendations } from '../handlers/get_ai_recommendations';

// Test data setup
const createTestUser = async () => {
  const userId = 'test-user-' + Date.now();
  await db.insert(usersTable).values({
    id: userId,
    email: 'test@example.com',
    password_hash: 'hashedpassword',
    role: 'ADMIN',
    full_name: 'Test User',
    is_active: true
  }).execute();
  return userId;
};

const createTestAsset = async () => {
  const assetId = 'test-asset-' + Date.now();
  await db.insert(assetsTable).values({
    id: assetId,
    name: 'Test Monitor',
    description: 'Dell 24-inch monitor for testing',
    category: 'MONITOR',
    condition: 'GOOD',
    owner: 'John Doe',
    qr_code: 'QR' + assetId,
    is_archived: false
  }).execute();
  return assetId;
};

const createOldAsset = async () => {
  const assetId = 'old-asset-' + Date.now();
  const oldDate = new Date();
  oldDate.setFullYear(oldDate.getFullYear() - 6); // 6 years old
  
  await db.insert(assetsTable).values({
    id: assetId,
    name: 'Old Computer',
    description: 'Aging desktop computer',
    category: 'CPU',
    condition: 'UNDER_REPAIR',
    owner: 'IT Department',
    qr_code: 'QR' + assetId,
    is_archived: false,
    created_at: oldDate,
    updated_at: oldDate
  }).execute();
  return assetId;
};

const createDamagedAsset = async () => {
  const assetId = 'damaged-asset-' + Date.now();
  await db.insert(assetsTable).values({
    id: assetId,
    name: 'Damaged Chair',
    description: 'Office chair with broken wheel',
    category: 'CHAIR',
    condition: 'DAMAGED',
    owner: null,
    qr_code: 'QR' + assetId,
    is_archived: false
  }).execute();
  return assetId;
};

describe('getAIRecommendations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return AI recommendations for a basic asset', async () => {
    const assetId = await createTestAsset();

    const result = await getAIRecommendations(assetId);

    // Verify all required fields are present
    expect(result.usability_assessment).toBeDefined();
    expect(result.maintenance_prediction).toBeDefined();
    expect(result.replacement_recommendation).toBeDefined();

    // Verify fields are non-empty strings
    expect(typeof result.usability_assessment).toBe('string');
    expect(typeof result.maintenance_prediction).toBe('string');
    expect(typeof result.replacement_recommendation).toBe('string');
    expect(result.usability_assessment.length).toBeGreaterThan(0);
    expect(result.maintenance_prediction.length).toBeGreaterThan(0);
    expect(result.replacement_recommendation.length).toBeGreaterThan(0);
  });

  it('should handle asset with complaints and history', async () => {
    const userId = await createTestUser();
    const assetId = await createTestAsset();

    // Add complaints
    await db.insert(complaintsTable).values([
      {
        id: 'complaint-1',
        asset_id: assetId,
        complainant_name: 'User One',
        status: 'URGENT',
        description: 'Screen flickering intermittently'
      },
      {
        id: 'complaint-2', 
        asset_id: assetId,
        complainant_name: 'User Two',
        status: 'NEEDS_REPAIR',
        description: 'Stand is wobbly'
      }
    ]).execute();

    // Add asset history
    await db.insert(assetHistoryTable).values([
      {
        id: 'history-1',
        asset_id: assetId,
        field_name: 'condition',
        old_value: 'NEW',
        new_value: 'GOOD',
        changed_by: userId
      }
    ]).execute();

    // Add maintenance schedules
    await db.insert(maintenanceSchedulesTable).values([
      {
        id: 'maintenance-1',
        asset_id: assetId,
        title: 'Monthly cleaning',
        description: 'Clean screen and check connections',
        scheduled_date: new Date(),
        is_completed: true,
        created_by: userId
      }
    ]).execute();

    const result = await getAIRecommendations(assetId);

    expect(result.usability_assessment).toBeDefined();
    expect(result.maintenance_prediction).toBeDefined();
    expect(result.replacement_recommendation).toBeDefined();

    // Should contain meaningful content (not just defaults)
    expect(result.usability_assessment.length).toBeGreaterThan(10);
    expect(result.maintenance_prediction.length).toBeGreaterThan(10);
    expect(result.replacement_recommendation.length).toBeGreaterThan(10);
  });

  it('should provide appropriate recommendations for old asset', async () => {
    const assetId = await createOldAsset();

    const result = await getAIRecommendations(assetId);

    expect(result.usability_assessment).toBeDefined();
    expect(result.maintenance_prediction).toBeDefined();
    expect(result.replacement_recommendation).toBeDefined();

    // For old assets, recommendations should mention age or replacement
    const combinedText = (result.usability_assessment + result.maintenance_prediction + result.replacement_recommendation).toLowerCase();
    expect(combinedText).toMatch(/(age|old|replace|year)/);
  });

  it('should handle damaged asset appropriately', async () => {
    const assetId = await createDamagedAsset();

    const result = await getAIRecommendations(assetId);

    expect(result.usability_assessment).toBeDefined();
    expect(result.maintenance_prediction).toBeDefined();
    expect(result.replacement_recommendation).toBeDefined();

    // For damaged assets, should mention the condition
    const combinedText = (result.usability_assessment + result.maintenance_prediction + result.replacement_recommendation).toLowerCase();
    expect(combinedText).toMatch(/(damage|repair|replace|impair|attention)/);
  });

  it('should handle asset with multiple urgent complaints', async () => {
    const assetId = await createTestAsset();

    // Add multiple urgent complaints
    await db.insert(complaintsTable).values([
      {
        id: 'urgent-1',
        asset_id: assetId,
        complainant_name: 'User A',
        status: 'URGENT',
        description: 'Monitor not turning on'
      },
      {
        id: 'urgent-2',
        asset_id: assetId,
        complainant_name: 'User B', 
        status: 'URGENT',
        description: 'Screen completely black'
      },
      {
        id: 'urgent-3',
        asset_id: assetId,
        complainant_name: 'User C',
        status: 'UNDER_REPAIR',
        description: 'Being fixed by tech team'
      }
    ]).execute();

    const result = await getAIRecommendations(assetId);

    expect(result.usability_assessment).toBeDefined();
    expect(result.maintenance_prediction).toBeDefined();
    expect(result.replacement_recommendation).toBeDefined();

    // Should reflect the urgency of multiple complaints
    const combinedText = (result.usability_assessment + result.maintenance_prediction + result.replacement_recommendation).toLowerCase();
    expect(combinedText).toMatch(/(urgent|immediate|attention|repair|issue)/);
  });

  it('should handle new asset with no history', async () => {
    const newAssetId = 'new-asset-' + Date.now();
    await db.insert(assetsTable).values({
      id: newAssetId,
      name: 'Brand New Laptop',
      description: 'Latest model laptop', 
      category: 'CPU',
      condition: 'NEW',
      owner: 'New Employee',
      qr_code: 'QR' + newAssetId,
      is_archived: false
    }).execute();

    const result = await getAIRecommendations(newAssetId);

    expect(result.usability_assessment).toBeDefined();
    expect(result.maintenance_prediction).toBeDefined();
    expect(result.replacement_recommendation).toBeDefined();

    // For new assets, should be positive about usability
    expect(result.usability_assessment.toLowerCase()).toMatch(/(excellent|good|new|suitable)/);
    expect(result.replacement_recommendation.toLowerCase()).toMatch(/(no.*immediate|not.*needed)/);
  });

  it('should throw error for non-existent asset', async () => {
    const nonExistentId = 'non-existent-asset';

    await expect(getAIRecommendations(nonExistentId)).rejects.toThrow(/asset not found/i);
  });

  it('should handle asset with extensive maintenance history', async () => {
    const userId = await createTestUser();
    const assetId = await createTestAsset();

    // Add multiple completed and pending maintenance
    await db.insert(maintenanceSchedulesTable).values([
      {
        id: 'maintenance-1',
        asset_id: assetId,
        title: 'Quarterly inspection',
        description: 'Full diagnostic check',
        scheduled_date: new Date(Date.now() - 86400000), // yesterday
        is_completed: true,
        created_by: userId
      },
      {
        id: 'maintenance-2',
        asset_id: assetId,
        title: 'Screen calibration',
        description: 'Color and brightness adjustment',
        scheduled_date: new Date(Date.now() - 172800000), // 2 days ago
        is_completed: true,
        created_by: userId
      },
      {
        id: 'maintenance-3',
        asset_id: assetId,
        title: 'Software update',
        description: 'Update firmware and drivers',
        scheduled_date: new Date(Date.now() + 86400000), // tomorrow
        is_completed: false,
        created_by: userId
      }
    ]).execute();

    const result = await getAIRecommendations(assetId);

    expect(result.usability_assessment).toBeDefined();
    expect(result.maintenance_prediction).toBeDefined();
    expect(result.replacement_recommendation).toBeDefined();

    // Should reflect good maintenance practices
    const combinedText = (result.usability_assessment + result.maintenance_prediction + result.replacement_recommendation).toLowerCase();
    expect(combinedText).toMatch(/(maintain|service|schedule|upkeep)/);
  });

  it('should provide consistent response structure', async () => {
    const assetId = await createTestAsset();

    // Call multiple times to ensure consistency
    const result1 = await getAIRecommendations(assetId);
    const result2 = await getAIRecommendations(assetId);

    // Structure should be consistent
    expect(Object.keys(result1)).toEqual(['usability_assessment', 'maintenance_prediction', 'replacement_recommendation']);
    expect(Object.keys(result2)).toEqual(['usability_assessment', 'maintenance_prediction', 'replacement_recommendation']);

    // All fields should be strings
    expect(typeof result1.usability_assessment).toBe('string');
    expect(typeof result1.maintenance_prediction).toBe('string');
    expect(typeof result1.replacement_recommendation).toBe('string');
    expect(typeof result2.usability_assessment).toBe('string');
    expect(typeof result2.maintenance_prediction).toBe('string');
    expect(typeof result2.replacement_recommendation).toBe('string');
  });
});