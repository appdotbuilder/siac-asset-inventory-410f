import { db } from '../db';
import { userActivityLogsTable } from '../db/schema';
import { type UserActivityLog } from '../schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export async function getUserActivityLogs(filters?: {
    user_id?: string;
    start_date?: Date;
    end_date?: Date;
    action?: string;
}): Promise<UserActivityLog[]> {
    try {
        // Build conditions array for filtering
        const conditions: SQL<unknown>[] = [];
        
        if (filters?.user_id) {
            conditions.push(eq(userActivityLogsTable.user_id, filters.user_id));
        }
        
        if (filters?.start_date) {
            conditions.push(gte(userActivityLogsTable.timestamp, filters.start_date));
        }
        
        if (filters?.end_date) {
            conditions.push(lte(userActivityLogsTable.timestamp, filters.end_date));
        }
        
        if (filters?.action) {
            conditions.push(eq(userActivityLogsTable.action, filters.action));
        }
        
        // Build query with conditions
        const baseQuery = db.select().from(userActivityLogsTable);
        
        let finalQuery;
        if (conditions.length === 0) {
            finalQuery = baseQuery.orderBy(desc(userActivityLogsTable.timestamp));
        } else if (conditions.length === 1) {
            finalQuery = baseQuery
                .where(conditions[0])
                .orderBy(desc(userActivityLogsTable.timestamp));
        } else {
            finalQuery = baseQuery
                .where(and(...conditions))
                .orderBy(desc(userActivityLogsTable.timestamp));
        }
        
        const results = await finalQuery.execute();
        
        return results;
    } catch (error) {
        console.error('Failed to fetch user activity logs:', error);
        throw error;
    }
}