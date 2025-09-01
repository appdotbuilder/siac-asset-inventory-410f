import { db } from '../db';
import { assetsTable } from '../db/schema';
import { type Asset } from '../schema';
import { and, or, eq, ilike, isNull, type SQL } from 'drizzle-orm';

export async function getAssets(filters?: {
    search?: string;
    category?: string;
    condition?: string;
    owner?: string;
    is_archived?: boolean;
}): Promise<Asset[]> {
    try {
        // Start with base query
        let query = db.select().from(assetsTable);

        // Build conditions array
        const conditions: SQL<unknown>[] = [];

        if (filters) {
            // Handle search across name and description
            if (filters.search && filters.search.trim()) {
                conditions.push(
                    or(
                        ilike(assetsTable.name, `%${filters.search}%`),
                        ilike(assetsTable.description, `%${filters.search}%`)
                    )!
                );
            }

            // Filter by category
            if (filters.category) {
                conditions.push(eq(assetsTable.category, filters.category as any));
            }

            // Filter by condition
            if (filters.condition) {
                conditions.push(eq(assetsTable.condition, filters.condition as any));
            }

            // Filter by owner - handle null values properly
            if (filters.owner !== undefined) {
                if (filters.owner === '' || filters.owner === 'null') {
                    conditions.push(isNull(assetsTable.owner));
                } else {
                    conditions.push(eq(assetsTable.owner, filters.owner));
                }
            }

            // Filter by archived status
            if (filters.is_archived !== undefined) {
                conditions.push(eq(assetsTable.is_archived, filters.is_archived));
            }
        }

        // Apply conditions if any exist
        if (conditions.length > 0) {
            const finalQuery = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
            const results = await finalQuery.execute();
            return results;
        }

        // Execute query when no conditions
        const results = await query.execute();
        return results;
    } catch (error) {
        console.error('Failed to get assets:', error);
        throw error;
    }
}