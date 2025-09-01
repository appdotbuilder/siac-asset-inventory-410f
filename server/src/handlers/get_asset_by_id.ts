import { db } from '../db';
import { assetsTable, complaintsTable, assetHistoryTable, maintenanceSchedulesTable } from '../db/schema';
import { type AssetWithRelations } from '../schema';
import { eq } from 'drizzle-orm';

export async function getAssetById(id: string): Promise<AssetWithRelations | null> {
  try {
    // First, get the asset
    const assets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, id))
      .execute();

    if (assets.length === 0) {
      return null;
    }

    const asset = assets[0];

    // Get all related complaints
    const complaints = await db.select()
      .from(complaintsTable)
      .where(eq(complaintsTable.asset_id, id))
      .execute();

    // Get all asset history records
    const history = await db.select()
      .from(assetHistoryTable)
      .where(eq(assetHistoryTable.asset_id, id))
      .execute();

    // Get all maintenance schedules
    const maintenance_schedules = await db.select()
      .from(maintenanceSchedulesTable)
      .where(eq(maintenanceSchedulesTable.asset_id, id))
      .execute();

    // Combine all data into the AssetWithRelations structure
    return {
      ...asset,
      complaints,
      history,
      maintenance_schedules
    };
  } catch (error) {
    console.error('Failed to get asset by ID:', error);
    throw error;
  }
}