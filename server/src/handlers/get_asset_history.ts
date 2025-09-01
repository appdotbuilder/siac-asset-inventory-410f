import { db } from '../db';
import { assetHistoryTable } from '../db/schema';
import { type AssetHistory } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getAssetHistory(asset_id: string): Promise<AssetHistory[]> {
  try {
    // Query asset history ordered by most recent changes first
    const results = await db.select()
      .from(assetHistoryTable)
      .where(eq(assetHistoryTable.asset_id, asset_id))
      .orderBy(desc(assetHistoryTable.changed_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch asset history:', error);
    throw error;
  }
}