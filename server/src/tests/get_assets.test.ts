import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { assetsTable } from '../db/schema';
import { getAssets } from '../handlers/get_assets';

// Test data setup
const testAssets = [
    {
        id: 'asset-1',
        name: 'Dell Monitor 24"',
        description: 'High resolution monitor for office work',
        category: 'MONITOR' as const,
        condition: 'NEW' as const,
        owner: 'john.doe@company.com',
        photo_url: null,
        qr_code: 'QR-MONITOR-001',
        is_archived: false
    },
    {
        id: 'asset-2',
        name: 'HP Desktop CPU',
        description: 'Core i5 desktop computer',
        category: 'CPU' as const,
        condition: 'GOOD' as const,
        owner: 'jane.smith@company.com',
        photo_url: 'http://example.com/cpu.jpg',
        qr_code: 'QR-CPU-001',
        is_archived: false
    },
    {
        id: 'asset-3',
        name: 'Office Chair Ergonomic',
        description: 'Adjustable office chair with lumbar support',
        category: 'CHAIR' as const,
        condition: 'UNDER_REPAIR' as const,
        owner: null,
        photo_url: null,
        qr_code: 'QR-CHAIR-001',
        is_archived: false
    },
    {
        id: 'asset-4',
        name: 'Old Laptop',
        description: 'Archived laptop from 2018',
        category: 'CPU' as const,
        condition: 'DAMAGED' as const,
        owner: 'archived@company.com',
        photo_url: null,
        qr_code: 'QR-LAPTOP-OLD',
        is_archived: true
    },
    {
        id: 'asset-5',
        name: 'Conference Room Table',
        description: null,
        category: 'TABLE' as const,
        condition: 'GOOD' as const,
        owner: null,
        photo_url: null,
        qr_code: 'QR-TABLE-001',
        is_archived: false
    }
];

describe('getAssets', () => {
    beforeEach(async () => {
        await createDB();
        // Insert test assets
        await db.insert(assetsTable).values(testAssets).execute();
    });

    afterEach(resetDB);

    it('should return all assets when no filters are provided', async () => {
        const result = await getAssets();

        expect(result).toHaveLength(5);
        expect(result[0].name).toEqual('Dell Monitor 24"');
        expect(result[0].id).toBeDefined();
        expect(result[0].created_at).toBeInstanceOf(Date);
        expect(result[0].updated_at).toBeInstanceOf(Date);
    });

    it('should return empty array when no assets exist', async () => {
        // Clear all assets
        await db.delete(assetsTable).execute();

        const result = await getAssets();

        expect(result).toHaveLength(0);
        expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by search term in name', async () => {
        const result = await getAssets({ search: 'Monitor' });

        expect(result).toHaveLength(1);
        expect(result[0].name).toEqual('Dell Monitor 24"');
        expect(result[0].category).toEqual('MONITOR');
    });

    it('should filter by search term in description', async () => {
        const result = await getAssets({ search: 'desktop computer' });

        expect(result).toHaveLength(1);
        expect(result[0].name).toEqual('HP Desktop CPU');
        expect(result[0].description).toEqual('Core i5 desktop computer');
    });

    it('should perform case-insensitive search', async () => {
        const result = await getAssets({ search: 'ERGONOMIC' });

        expect(result).toHaveLength(1);
        expect(result[0].name).toEqual('Office Chair Ergonomic');
    });

    it('should filter by category', async () => {
        const result = await getAssets({ category: 'CPU' });

        expect(result).toHaveLength(2);
        const names = result.map(asset => asset.name).sort();
        expect(names).toEqual(['HP Desktop CPU', 'Old Laptop']);
    });

    it('should filter by condition', async () => {
        const result = await getAssets({ condition: 'GOOD' });

        expect(result).toHaveLength(2);
        const names = result.map(asset => asset.name).sort();
        expect(names).toEqual(['Conference Room Table', 'HP Desktop CPU']);
    });

    it('should filter by owner', async () => {
        const result = await getAssets({ owner: 'john.doe@company.com' });

        expect(result).toHaveLength(1);
        expect(result[0].name).toEqual('Dell Monitor 24"');
        expect(result[0].owner).toEqual('john.doe@company.com');
    });

    it('should filter by null owner', async () => {
        const result = await getAssets({ owner: 'null' });

        expect(result).toHaveLength(2);
        const names = result.map(asset => asset.name).sort();
        expect(names).toEqual(['Conference Room Table', 'Office Chair Ergonomic']);
    });

    it('should filter by empty string owner (treats as null)', async () => {
        const result = await getAssets({ owner: '' });

        expect(result).toHaveLength(2);
        const names = result.map(asset => asset.name).sort();
        expect(names).toEqual(['Conference Room Table', 'Office Chair Ergonomic']);
    });

    it('should filter by archived status - non-archived', async () => {
        const result = await getAssets({ is_archived: false });

        expect(result).toHaveLength(4);
        const archivedAsset = result.find(asset => asset.name === 'Old Laptop');
        expect(archivedAsset).toBeUndefined();
    });

    it('should filter by archived status - archived only', async () => {
        const result = await getAssets({ is_archived: true });

        expect(result).toHaveLength(1);
        expect(result[0].name).toEqual('Old Laptop');
        expect(result[0].is_archived).toBe(true);
    });

    it('should combine multiple filters', async () => {
        const result = await getAssets({
            category: 'CPU',
            condition: 'GOOD',
            is_archived: false
        });

        expect(result).toHaveLength(1);
        expect(result[0].name).toEqual('HP Desktop CPU');
        expect(result[0].category).toEqual('CPU');
        expect(result[0].condition).toEqual('GOOD');
        expect(result[0].is_archived).toBe(false);
    });

    it('should return empty array when filters match no assets', async () => {
        const result = await getAssets({
            category: 'MONITOR',
            condition: 'DAMAGED'
        });

        expect(result).toHaveLength(0);
        expect(Array.isArray(result)).toBe(true);
    });

    it('should handle search with special characters', async () => {
        const result = await getAssets({ search: '24"' });

        expect(result).toHaveLength(1);
        expect(result[0].name).toEqual('Dell Monitor 24"');
    });

    it('should handle empty search string', async () => {
        const result = await getAssets({ search: '' });

        // Empty search should return all assets (no filter applied)
        expect(result).toHaveLength(5);
    });

    it('should handle whitespace-only search string', async () => {
        const result = await getAssets({ search: '   ' });

        // Whitespace-only search should return all assets (no filter applied)
        expect(result).toHaveLength(5);
    });

    it('should return assets with proper field types', async () => {
        const result = await getAssets({ category: 'MONITOR' });

        expect(result).toHaveLength(1);
        const asset = result[0];
        
        expect(typeof asset.id).toBe('string');
        expect(typeof asset.name).toBe('string');
        expect(typeof asset.qr_code).toBe('string');
        expect(typeof asset.is_archived).toBe('boolean');
        expect(asset.created_at).toBeInstanceOf(Date);
        expect(asset.updated_at).toBeInstanceOf(Date);
        
        // Nullable fields
        if (asset.description !== null) {
            expect(typeof asset.description).toBe('string');
        }
        if (asset.owner !== null) {
            expect(typeof asset.owner).toBe('string');
        }
        if (asset.photo_url !== null) {
            expect(typeof asset.photo_url).toBe('string');
        }
    });
});