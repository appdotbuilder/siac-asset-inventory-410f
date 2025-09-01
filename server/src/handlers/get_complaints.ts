import { db } from '../db';
import { complaintsTable } from '../db/schema';
import { type Complaint } from '../schema';
import { eq, and, type SQL } from 'drizzle-orm';

export async function getComplaints(filters?: {
    asset_id?: string;
    status?: string;
}): Promise<Complaint[]> {
    try {
        // Build conditions array for filtering
        const conditions: SQL<unknown>[] = [];

        if (filters?.asset_id) {
            conditions.push(eq(complaintsTable.asset_id, filters.asset_id));
        }

        if (filters?.status) {
            conditions.push(eq(complaintsTable.status, filters.status as any));
        }

        // Build and execute query
        const query = conditions.length > 0
            ? db.select().from(complaintsTable).where(conditions.length === 1 ? conditions[0] : and(...conditions))
            : db.select().from(complaintsTable);

        const results = await query.execute();
        
        return results;
    } catch (error) {
        console.error('Failed to fetch complaints:', error);
        throw error;
    }
}