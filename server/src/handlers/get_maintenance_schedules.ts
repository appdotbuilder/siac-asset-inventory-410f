import { db } from '../db';
import { maintenanceSchedulesTable } from '../db/schema';
import { type MaintenanceSchedule } from '../schema';
import { eq, gte, lte, and, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export async function getMaintenanceSchedules(filters?: {
    asset_id?: string;
    start_date?: Date;
    end_date?: Date;
    is_completed?: boolean;
}): Promise<MaintenanceSchedule[]> {
    try {
        // Collect conditions for filtering
        const conditions: SQL<unknown>[] = [];

        if (filters?.asset_id) {
            conditions.push(eq(maintenanceSchedulesTable.asset_id, filters.asset_id));
        }

        if (filters?.start_date) {
            conditions.push(gte(maintenanceSchedulesTable.scheduled_date, filters.start_date));
        }

        if (filters?.end_date) {
            conditions.push(lte(maintenanceSchedulesTable.scheduled_date, filters.end_date));
        }

        if (filters?.is_completed !== undefined) {
            conditions.push(eq(maintenanceSchedulesTable.is_completed, filters.is_completed));
        }

        // Build query based on whether we have conditions
        const results = conditions.length > 0
            ? await db.select()
                .from(maintenanceSchedulesTable)
                .where(conditions.length === 1 ? conditions[0] : and(...conditions))
                .orderBy(desc(maintenanceSchedulesTable.scheduled_date))
                .execute()
            : await db.select()
                .from(maintenanceSchedulesTable)
                .orderBy(desc(maintenanceSchedulesTable.scheduled_date))
                .execute();

        return results;
    } catch (error) {
        console.error('Failed to get maintenance schedules:', error);
        throw error;
    }
}