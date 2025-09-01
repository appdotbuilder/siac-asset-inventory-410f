import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetsTable, complaintsTable, assetHistoryTable } from '../db/schema';
import { type UpdateComplaintInput } from '../schema';
import { updateComplaint } from '../handlers/update_complaint';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const testAssetId = uuidv4();
const testComplaintId = uuidv4();

describe('updateComplaint', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create test asset
    await db.insert(assetsTable)
      .values({
        id: testAssetId,
        name: 'Test Asset',
        description: 'Asset for testing',
        category: 'MONITOR',
        condition: 'UNDER_REPAIR',
        owner: null,
        photo_url: null,
        qr_code: `test-qr-${testAssetId}`,
        is_archived: false,
        created_at: new Date(),
        updated_at: new Date()
      })
      .execute();

    // Create test complaint
    await db.insert(complaintsTable)
      .values({
        id: testComplaintId,
        asset_id: testAssetId,
        complainant_name: 'Test User',
        status: 'NEEDS_REPAIR',
        description: 'Test complaint description',
        created_at: new Date(),
        updated_at: new Date()
      })
      .execute();
  });

  afterEach(resetDB);

  it('should update complaint status', async () => {
    const input: UpdateComplaintInput = {
      id: testComplaintId,
      status: 'UNDER_REPAIR'
    };

    const result = await updateComplaint(input);

    expect(result.id).toEqual(testComplaintId);
    expect(result.status).toEqual('UNDER_REPAIR');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.description).toEqual('Test complaint description');
  });

  it('should update complaint description', async () => {
    const input: UpdateComplaintInput = {
      id: testComplaintId,
      description: 'Updated complaint description'
    };

    const result = await updateComplaint(input);

    expect(result.id).toEqual(testComplaintId);
    expect(result.description).toEqual('Updated complaint description');
    expect(result.status).toEqual('NEEDS_REPAIR'); // Should remain unchanged
  });

  it('should update both status and description', async () => {
    const input: UpdateComplaintInput = {
      id: testComplaintId,
      status: 'URGENT',
      description: 'Very urgent complaint'
    };

    const result = await updateComplaint(input);

    expect(result.status).toEqual('URGENT');
    expect(result.description).toEqual('Very urgent complaint');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save changes to database', async () => {
    const input: UpdateComplaintInput = {
      id: testComplaintId,
      status: 'RESOLVED',
      description: 'Issue has been resolved'
    };

    await updateComplaint(input);

    const complaints = await db.select()
      .from(complaintsTable)
      .where(eq(complaintsTable.id, testComplaintId))
      .execute();

    expect(complaints).toHaveLength(1);
    expect(complaints[0].status).toEqual('RESOLVED');
    expect(complaints[0].description).toEqual('Issue has been resolved');
  });

  it('should log status change in asset history', async () => {
    const input: UpdateComplaintInput = {
      id: testComplaintId,
      status: 'RESOLVED'
    };

    await updateComplaint(input);

    const history = await db.select()
      .from(assetHistoryTable)
      .where(eq(assetHistoryTable.asset_id, testAssetId))
      .execute();

    const statusChangeRecord = history.find(h => h.field_name === 'complaint_status');
    expect(statusChangeRecord).toBeDefined();
    expect(statusChangeRecord!.old_value).toEqual('NEEDS_REPAIR');
    expect(statusChangeRecord!.new_value).toEqual('RESOLVED');
    expect(statusChangeRecord!.changed_at).toBeInstanceOf(Date);
  });

  it('should update asset condition to GOOD when complaint is resolved and no other unresolved complaints exist', async () => {
    const input: UpdateComplaintInput = {
      id: testComplaintId,
      status: 'RESOLVED'
    };

    await updateComplaint(input);

    // Check that asset condition was updated
    const assets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, testAssetId))
      .execute();

    expect(assets[0].condition).toEqual('GOOD');

    // Check that asset condition change was logged
    const history = await db.select()
      .from(assetHistoryTable)
      .where(eq(assetHistoryTable.asset_id, testAssetId))
      .execute();

    const conditionChangeRecord = history.find(h => h.field_name === 'condition');
    expect(conditionChangeRecord).toBeDefined();
    expect(conditionChangeRecord!.old_value).toEqual('UNDER_REPAIR');
    expect(conditionChangeRecord!.new_value).toEqual('GOOD');
  });

  it('should not update asset condition when other unresolved complaints exist', async () => {
    // Create another unresolved complaint for the same asset
    const secondComplaintId = uuidv4();
    await db.insert(complaintsTable)
      .values({
        id: secondComplaintId,
        asset_id: testAssetId,
        complainant_name: 'Another User',
        status: 'URGENT',
        description: 'Another issue',
        created_at: new Date(),
        updated_at: new Date()
      })
      .execute();

    const input: UpdateComplaintInput = {
      id: testComplaintId,
      status: 'RESOLVED'
    };

    await updateComplaint(input);

    // Asset condition should remain UNDER_REPAIR
    const assets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, testAssetId))
      .execute();

    expect(assets[0].condition).toEqual('UNDER_REPAIR');
  });

  it('should not log history when no status change occurs', async () => {
    const input: UpdateComplaintInput = {
      id: testComplaintId,
      description: 'Updated description only'
    };

    await updateComplaint(input);

    const history = await db.select()
      .from(assetHistoryTable)
      .where(eq(assetHistoryTable.asset_id, testAssetId))
      .execute();

    // Should be no history records since status didn't change
    expect(history).toHaveLength(0);
  });

  it('should throw error when complaint does not exist', async () => {
    const input: UpdateComplaintInput = {
      id: 'non-existent-id',
      status: 'RESOLVED'
    };

    expect(updateComplaint(input)).rejects.toThrow(/not found/i);
  });

  it('should handle asset condition update only when asset is currently UNDER_REPAIR', async () => {
    // Update asset condition to GOOD first
    await db.update(assetsTable)
      .set({ condition: 'GOOD' })
      .where(eq(assetsTable.id, testAssetId))
      .execute();

    const input: UpdateComplaintInput = {
      id: testComplaintId,
      status: 'RESOLVED'
    };

    await updateComplaint(input);

    // Asset condition should remain GOOD (not changed)
    const assets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, testAssetId))
      .execute();

    expect(assets[0].condition).toEqual('GOOD');

    // Should only have complaint status change in history, not asset condition change
    const history = await db.select()
      .from(assetHistoryTable)
      .where(eq(assetHistoryTable.asset_id, testAssetId))
      .execute();

    const conditionChangeRecord = history.find(h => h.field_name === 'condition');
    expect(conditionChangeRecord).toBeUndefined();
  });
});