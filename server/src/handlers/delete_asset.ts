import { db } from '../db';
import { assetsTable, complaintsTable, assetHistoryTable, maintenanceSchedulesTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function deleteAsset(id: string, permanent: boolean = false): Promise<{ success: boolean }> {
  try {
    // First check if asset exists
    const existingAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, id))
      .execute();

    if (existingAsset.length === 0) {
      return { success: false };
    }

    if (permanent) {
      // Permanent delete: Remove all related records first (cascade)
      await db.delete(complaintsTable)
        .where(eq(complaintsTable.asset_id, id))
        .execute();

      await db.delete(assetHistoryTable)
        .where(eq(assetHistoryTable.asset_id, id))
        .execute();

      await db.delete(maintenanceSchedulesTable)
        .where(eq(maintenanceSchedulesTable.asset_id, id))
        .execute();

      // Finally delete the asset
      await db.delete(assetsTable)
        .where(eq(assetsTable.id, id))
        .execute();

      return { success: true };
    } else {
      // Soft delete: Archive the asset
      await db.update(assetsTable)
        .set({ 
          is_archived: true,
          updated_at: new Date()
        })
        .where(eq(assetsTable.id, id))
        .execute();

      return { success: true };
    }
  } catch (error) {
    console.error('Asset deletion failed:', error);
    throw error;
  }
}