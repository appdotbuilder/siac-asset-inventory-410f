import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetsTable, complaintsTable } from '../db/schema';
import { getComplaints } from '../handlers/get_complaints';

// Test data
const testAsset1 = {
    id: 'asset-1',
    name: 'Test Monitor',
    category: 'MONITOR' as const,
    condition: 'GOOD' as const,
    qr_code: 'QR001'
};

const testAsset2 = {
    id: 'asset-2', 
    name: 'Test CPU',
    category: 'CPU' as const,
    condition: 'UNDER_REPAIR' as const,
    qr_code: 'QR002'
};

const testComplaint1 = {
    id: 'complaint-1',
    asset_id: 'asset-1',
    complainant_name: 'John Doe',
    status: 'NEEDS_REPAIR' as const,
    description: 'Monitor flickering issue'
};

const testComplaint2 = {
    id: 'complaint-2',
    asset_id: 'asset-1',
    complainant_name: 'Jane Smith',
    status: 'URGENT' as const,
    description: 'Monitor completely black'
};

const testComplaint3 = {
    id: 'complaint-3',
    asset_id: 'asset-2',
    complainant_name: 'Bob Wilson',
    status: 'UNDER_REPAIR' as const,
    description: 'CPU not starting'
};

describe('getComplaints', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    it('should return all complaints when no filters are provided', async () => {
        // Create test assets
        await db.insert(assetsTable).values([testAsset1, testAsset2]).execute();
        
        // Create test complaints
        await db.insert(complaintsTable).values([testComplaint1, testComplaint2, testComplaint3]).execute();

        const results = await getComplaints();

        expect(results).toHaveLength(3);
        expect(results.map(c => c.id)).toContain('complaint-1');
        expect(results.map(c => c.id)).toContain('complaint-2');
        expect(results.map(c => c.id)).toContain('complaint-3');
    });

    it('should filter complaints by asset_id', async () => {
        // Create test assets
        await db.insert(assetsTable).values([testAsset1, testAsset2]).execute();
        
        // Create test complaints
        await db.insert(complaintsTable).values([testComplaint1, testComplaint2, testComplaint3]).execute();

        const results = await getComplaints({ asset_id: 'asset-1' });

        expect(results).toHaveLength(2);
        expect(results.every(c => c.asset_id === 'asset-1')).toBe(true);
        expect(results.map(c => c.id)).toContain('complaint-1');
        expect(results.map(c => c.id)).toContain('complaint-2');
    });

    it('should filter complaints by status', async () => {
        // Create test assets
        await db.insert(assetsTable).values([testAsset1, testAsset2]).execute();
        
        // Create test complaints
        await db.insert(complaintsTable).values([testComplaint1, testComplaint2, testComplaint3]).execute();

        const results = await getComplaints({ status: 'URGENT' });

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('URGENT');
        expect(results[0].id).toBe('complaint-2');
        expect(results[0].complainant_name).toBe('Jane Smith');
    });

    it('should filter complaints by both asset_id and status', async () => {
        // Create test assets
        await db.insert(assetsTable).values([testAsset1, testAsset2]).execute();
        
        // Create test complaints
        await db.insert(complaintsTable).values([testComplaint1, testComplaint2, testComplaint3]).execute();

        const results = await getComplaints({ 
            asset_id: 'asset-1', 
            status: 'NEEDS_REPAIR' 
        });

        expect(results).toHaveLength(1);
        expect(results[0].asset_id).toBe('asset-1');
        expect(results[0].status).toBe('NEEDS_REPAIR');
        expect(results[0].id).toBe('complaint-1');
    });

    it('should return empty array when no complaints match filters', async () => {
        // Create test assets
        await db.insert(assetsTable).values([testAsset1, testAsset2]).execute();
        
        // Create test complaints
        await db.insert(complaintsTable).values([testComplaint1, testComplaint2, testComplaint3]).execute();

        const results = await getComplaints({ status: 'RESOLVED' });

        expect(results).toHaveLength(0);
    });

    it('should return empty array when no complaints exist', async () => {
        const results = await getComplaints();

        expect(results).toHaveLength(0);
    });

    it('should return correct complaint data structure', async () => {
        // Create test asset
        await db.insert(assetsTable).values([testAsset1]).execute();
        
        // Create test complaint
        await db.insert(complaintsTable).values([testComplaint1]).execute();

        const results = await getComplaints();

        expect(results).toHaveLength(1);
        const complaint = results[0];
        
        // Verify all required fields exist
        expect(complaint.id).toBe('complaint-1');
        expect(complaint.asset_id).toBe('asset-1');
        expect(complaint.complainant_name).toBe('John Doe');
        expect(complaint.status).toBe('NEEDS_REPAIR');
        expect(complaint.description).toBe('Monitor flickering issue');
        expect(complaint.created_at).toBeInstanceOf(Date);
        expect(complaint.updated_at).toBeInstanceOf(Date);
    });

    it('should handle invalid asset_id filter gracefully', async () => {
        // Create test assets and complaints
        await db.insert(assetsTable).values([testAsset1]).execute();
        await db.insert(complaintsTable).values([testComplaint1]).execute();

        const results = await getComplaints({ asset_id: 'non-existent-asset' });

        expect(results).toHaveLength(0);
    });

    it('should handle multiple status filters correctly', async () => {
        // Create test assets
        await db.insert(assetsTable).values([testAsset1, testAsset2]).execute();
        
        // Create test complaints
        await db.insert(complaintsTable).values([testComplaint1, testComplaint2, testComplaint3]).execute();

        // Test different status values
        const needsRepairResults = await getComplaints({ status: 'NEEDS_REPAIR' });
        const urgentResults = await getComplaints({ status: 'URGENT' });
        const underRepairResults = await getComplaints({ status: 'UNDER_REPAIR' });

        expect(needsRepairResults).toHaveLength(1);
        expect(needsRepairResults[0].status).toBe('NEEDS_REPAIR');
        
        expect(urgentResults).toHaveLength(1);
        expect(urgentResults[0].status).toBe('URGENT');
        
        expect(underRepairResults).toHaveLength(1);
        expect(underRepairResults[0].status).toBe('UNDER_REPAIR');
    });
});