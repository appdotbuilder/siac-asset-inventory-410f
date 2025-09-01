import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { complaintsTable, assetsTable } from '../db/schema';
import { type CreateComplaintInput } from '../schema';
import { createComplaint } from '../handlers/create_complaint';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Test asset to create complaints for
const testAsset = {
  id: 'asset_1',
  name: 'Test Monitor',
  category: 'MONITOR' as const,
  condition: 'GOOD' as const,
  qr_code: 'QR_TEST_001'
};

// Simple test input
const testInput: CreateComplaintInput = {
  asset_id: 'asset_1',
  complainant_name: 'John Doe',
  status: 'NEEDS_REPAIR',
  description: 'Monitor is flickering intermittently'
};

describe('createComplaint', () => {
  beforeEach(async () => {
    await createDB();
    // Create prerequisite asset
    await db.insert(assetsTable).values(testAsset).execute();
  });
  
  afterEach(resetDB);

  it('should create a complaint', async () => {
    const result = await createComplaint(testInput);

    // Basic field validation
    expect(result.asset_id).toEqual('asset_1');
    expect(result.complainant_name).toEqual('John Doe');
    expect(result.status).toEqual('NEEDS_REPAIR');
    expect(result.description).toEqual('Monitor is flickering intermittently');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save complaint to database', async () => {
    const result = await createComplaint(testInput);

    // Query using proper drizzle syntax
    const complaints = await db.select()
      .from(complaintsTable)
      .where(eq(complaintsTable.id, result.id))
      .execute();

    expect(complaints).toHaveLength(1);
    expect(complaints[0].asset_id).toEqual('asset_1');
    expect(complaints[0].complainant_name).toEqual('John Doe');
    expect(complaints[0].status).toEqual('NEEDS_REPAIR');
    expect(complaints[0].description).toEqual('Monitor is flickering intermittently');
    expect(complaints[0].created_at).toBeInstanceOf(Date);
    expect(complaints[0].updated_at).toBeInstanceOf(Date);
  });

  it('should generate unique IDs for multiple complaints', async () => {
    const result1 = await createComplaint(testInput);
    const result2 = await createComplaint({
      ...testInput,
      complainant_name: 'Jane Smith',
      description: 'Different issue with the same asset'
    });

    expect(result1.id).toBeDefined();
    expect(result2.id).toBeDefined();
    expect(result1.id).not.toEqual(result2.id);

    // Verify both complaints exist in database
    const complaints = await db.select()
      .from(complaintsTable)
      .where(eq(complaintsTable.asset_id, 'asset_1'))
      .execute();

    expect(complaints).toHaveLength(2);
  });

  it('should handle different complaint statuses correctly', async () => {
    const urgentInput: CreateComplaintInput = {
      asset_id: 'asset_1',
      complainant_name: 'Emergency User',
      status: 'URGENT',
      description: 'Monitor completely broken, sparking!'
    };

    const result = await createComplaint(urgentInput);

    expect(result.status).toEqual('URGENT');
    expect(result.complainant_name).toEqual('Emergency User');
    expect(result.description).toEqual('Monitor completely broken, sparking!');
  });

  it('should reject complaint for non-existent asset', async () => {
    const invalidInput: CreateComplaintInput = {
      asset_id: 'non_existent_asset',
      complainant_name: 'John Doe',
      status: 'NEEDS_REPAIR',
      description: 'This should fail'
    };

    await expect(createComplaint(invalidInput)).rejects.toThrow(/Asset with id non_existent_asset not found/i);
  });

  it('should handle long descriptions correctly', async () => {
    const longDescription = 'This is a very detailed description of the issue. '.repeat(10);
    const longDescInput: CreateComplaintInput = {
      asset_id: 'asset_1',
      complainant_name: 'Detailed Reporter',
      status: 'UNDER_REPAIR',
      description: longDescription
    };

    const result = await createComplaint(longDescInput);
    
    expect(result.description).toEqual(longDescription);
    expect(result.status).toEqual('UNDER_REPAIR');
  });
});