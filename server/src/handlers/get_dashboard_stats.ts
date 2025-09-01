import { db } from '../db';
import { 
  assetsTable, 
  complaintsTable, 
  maintenanceSchedulesTable, 
  userActivityLogsTable 
} from '../db/schema';
import { eq, and, count, gte, lte, sql } from 'drizzle-orm';

export interface DashboardStats {
    total_assets: number;
    assets_by_condition: Record<string, number>;
    assets_by_category: Record<string, number>;
    pending_complaints: number;
    upcoming_maintenance: number;
    recent_activities: number;
    archived_assets: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
    try {
        // Get total assets count
        const totalAssetsResult = await db.select({ count: count() })
            .from(assetsTable)
            .execute();
        const total_assets = totalAssetsResult[0]?.count || 0;

        // Get archived assets count
        const archivedAssetsResult = await db.select({ count: count() })
            .from(assetsTable)
            .where(eq(assetsTable.is_archived, true))
            .execute();
        const archived_assets = archivedAssetsResult[0]?.count || 0;

        // Get assets by condition
        const conditionStatsResult = await db.select({
            condition: assetsTable.condition,
            count: count()
        })
            .from(assetsTable)
            .where(eq(assetsTable.is_archived, false))
            .groupBy(assetsTable.condition)
            .execute();

        const assets_by_condition: Record<string, number> = {};
        conditionStatsResult.forEach(row => {
            assets_by_condition[row.condition] = row.count;
        });

        // Get assets by category
        const categoryStatsResult = await db.select({
            category: assetsTable.category,
            count: count()
        })
            .from(assetsTable)
            .where(eq(assetsTable.is_archived, false))
            .groupBy(assetsTable.category)
            .execute();

        const assets_by_category: Record<string, number> = {};
        categoryStatsResult.forEach(row => {
            assets_by_category[row.category] = row.count;
        });

        // Get pending complaints count (not resolved)
        const pendingComplaintsResult = await db.select({ count: count() })
            .from(complaintsTable)
            .where(sql`${complaintsTable.status} != 'RESOLVED'`)
            .execute();
        const pending_complaints = pendingComplaintsResult[0]?.count || 0;

        // Get upcoming maintenance count (scheduled in next 30 days and not completed)
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        const upcomingMaintenanceResult = await db.select({ count: count() })
            .from(maintenanceSchedulesTable)
            .where(and(
                eq(maintenanceSchedulesTable.is_completed, false),
                gte(maintenanceSchedulesTable.scheduled_date, now),
                lte(maintenanceSchedulesTable.scheduled_date, thirtyDaysFromNow)
            ))
            .execute();
        const upcoming_maintenance = upcomingMaintenanceResult[0]?.count || 0;

        // Get recent activities count (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);

        const recentActivitiesResult = await db.select({ count: count() })
            .from(userActivityLogsTable)
            .where(gte(userActivityLogsTable.timestamp, sevenDaysAgo))
            .execute();
        const recent_activities = recentActivitiesResult[0]?.count || 0;

        return {
            total_assets,
            assets_by_condition,
            assets_by_category,
            pending_complaints,
            upcoming_maintenance,
            recent_activities,
            archived_assets
        };
    } catch (error) {
        console.error('Dashboard stats retrieval failed:', error);
        throw error;
    }
}