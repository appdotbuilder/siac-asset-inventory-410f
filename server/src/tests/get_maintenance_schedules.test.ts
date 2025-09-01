import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { maintenanceSchedulesTable, assetsTable, usersTable } from '../db/schema';
import { getMaintenanceSchedules } from '../handlers/get_maintenance_schedules';
import { eq } from 'drizzle-orm';

describe('getMaintenanceSchedules', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    // Helper function to create test data
    const createTestData = async () => {
        // Create test user
        await db.insert(usersTable).values({
            id: 'user-1',
            email: 'test@example.com',
            password_hash: 'hashed_password',
            role: 'ADMIN',
            full_name: 'Test User',
            is_active: true
        });

        // Create test assets
        await db.insert(assetsTable).values([
            {
                id: 'asset-1',
                name: 'Test Asset 1',
                description: 'First test asset',
                category: 'MONITOR',
                condition: 'GOOD',
                qr_code: 'QR001',
                is_archived: false
            },
            {
                id: 'asset-2',
                name: 'Test Asset 2',
                description: 'Second test asset',
                category: 'CPU',
                condition: 'NEW',
                qr_code: 'QR002',
                is_archived: false
            }
        ]);

        // Create maintenance schedules with different dates and statuses
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);

        await db.insert(maintenanceSchedulesTable).values([
            {
                id: 'maint-1',
                asset_id: 'asset-1',
                title: 'Monitor Cleaning',
                description: 'Regular cleaning maintenance',
                scheduled_date: yesterday,
                is_completed: true,
                created_by: 'user-1'
            },
            {
                id: 'maint-2',
                asset_id: 'asset-1',
                title: 'Monitor Inspection',
                description: 'Monthly inspection',
                scheduled_date: tomorrow,
                is_completed: false,
                created_by: 'user-1'
            },
            {
                id: 'maint-3',
                asset_id: 'asset-2',
                title: 'CPU Maintenance',
                description: 'System update and cleaning',
                scheduled_date: nextWeek,
                is_completed: false,
                created_by: 'user-1'
            }
        ]);
    };

    it('should return all maintenance schedules without filters', async () => {
        await createTestData();

        const result = await getMaintenanceSchedules();

        expect(result).toHaveLength(3);
        // Should be ordered by scheduled_date desc (most recent first)
        expect(result[0].title).toEqual('CPU Maintenance'); // Next week
        expect(result[1].title).toEqual('Monitor Inspection'); // Tomorrow
        expect(result[2].title).toEqual('Monitor Cleaning'); // Yesterday
    });

    it('should filter by asset_id', async () => {
        await createTestData();

        const result = await getMaintenanceSchedules({ asset_id: 'asset-1' });

        expect(result).toHaveLength(2);
        expect(result.every(schedule => schedule.asset_id === 'asset-1')).toBe(true);
        expect(result.map(s => s.title)).toContain('Monitor Cleaning');
        expect(result.map(s => s.title)).toContain('Monitor Inspection');
    });

    it('should filter by is_completed status', async () => {
        await createTestData();

        const completedResult = await getMaintenanceSchedules({ is_completed: true });
        const pendingResult = await getMaintenanceSchedules({ is_completed: false });

        expect(completedResult).toHaveLength(1);
        expect(completedResult[0].title).toEqual('Monitor Cleaning');
        expect(completedResult[0].is_completed).toBe(true);

        expect(pendingResult).toHaveLength(2);
        expect(pendingResult.every(schedule => !schedule.is_completed)).toBe(true);
    });

    it('should filter by date range', async () => {
        await createTestData();

        const today = new Date();
        const twoDaysFromNow = new Date(today);
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

        const result = await getMaintenanceSchedules({
            start_date: today,
            end_date: twoDaysFromNow
        });

        expect(result).toHaveLength(1);
        expect(result[0].title).toEqual('Monitor Inspection');
    });

    it('should filter by start_date only', async () => {
        await createTestData();

        const today = new Date();

        const result = await getMaintenanceSchedules({
            start_date: today
        });

        expect(result).toHaveLength(2);
        // Should include tomorrow and next week, but not yesterday
        expect(result.map(s => s.title)).toContain('Monitor Inspection');
        expect(result.map(s => s.title)).toContain('CPU Maintenance');
        expect(result.map(s => s.title)).not.toContain('Monitor Cleaning');
    });

    it('should filter by end_date only', async () => {
        await createTestData();

        const today = new Date();
        const threeDaysFromNow = new Date(today);
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

        const result = await getMaintenanceSchedules({
            end_date: threeDaysFromNow
        });

        expect(result).toHaveLength(2);
        // Should include yesterday and tomorrow, but not next week
        expect(result.map(s => s.title)).toContain('Monitor Cleaning');
        expect(result.map(s => s.title)).toContain('Monitor Inspection');
        expect(result.map(s => s.title)).not.toContain('CPU Maintenance');
    });

    it('should combine multiple filters', async () => {
        await createTestData();

        const today = new Date();
        const oneWeekFromNow = new Date(today);
        oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

        const result = await getMaintenanceSchedules({
            asset_id: 'asset-1',
            is_completed: false,
            start_date: today,
            end_date: oneWeekFromNow
        });

        expect(result).toHaveLength(1);
        expect(result[0].title).toEqual('Monitor Inspection');
        expect(result[0].asset_id).toEqual('asset-1');
        expect(result[0].is_completed).toBe(false);
    });

    it('should return empty array when no matches found', async () => {
        await createTestData();

        const result = await getMaintenanceSchedules({
            asset_id: 'non-existent-asset'
        });

        expect(result).toHaveLength(0);
    });

    it('should return empty array when no data exists', async () => {
        // Don't create test data
        const result = await getMaintenanceSchedules();

        expect(result).toHaveLength(0);
    });

    it('should validate maintenance schedule structure', async () => {
        await createTestData();

        const result = await getMaintenanceSchedules({ asset_id: 'asset-1' });

        expect(result).toHaveLength(2);
        const schedule = result[0];

        expect(schedule.id).toBeDefined();
        expect(typeof schedule.id).toBe('string');
        expect(schedule.asset_id).toBeDefined();
        expect(typeof schedule.asset_id).toBe('string');
        expect(schedule.title).toBeDefined();
        expect(typeof schedule.title).toBe('string');
        expect(schedule.scheduled_date).toBeInstanceOf(Date);
        expect(typeof schedule.is_completed).toBe('boolean');
        expect(schedule.created_by).toBeDefined();
        expect(typeof schedule.created_by).toBe('string');
        expect(schedule.created_at).toBeInstanceOf(Date);
        expect(schedule.updated_at).toBeInstanceOf(Date);
    });

    it('should verify data persistence in database', async () => {
        await createTestData();

        // Get schedules via handler
        const handlerResult = await getMaintenanceSchedules({ asset_id: 'asset-1' });

        // Verify same data exists in database
        const dbResult = await db.select()
            .from(maintenanceSchedulesTable)
            .where(eq(maintenanceSchedulesTable.asset_id, 'asset-1'))
            .execute();

        expect(handlerResult).toHaveLength(dbResult.length);
        const matchingDbRecord = dbResult.find(s => s.id === handlerResult[0].id);
        expect(matchingDbRecord).toBeDefined();
        expect(handlerResult[0].title).toEqual(matchingDbRecord!.title);
    });
});