import { db } from '../db';
import { assetsTable, userActivityLogsTable, usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type Asset } from '../schema';
import { randomUUID } from 'crypto';

export const restoreAsset = async (id: string): Promise<Asset> => {
  try {
    // First, check if the asset exists and is archived
    const existingAssets = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, id))
      .execute();

    if (existingAssets.length === 0) {
      throw new Error(`Asset with id ${id} not found`);
    }

    const existingAsset = existingAssets[0];
    if (!existingAsset.is_archived) {
      throw new Error(`Asset with id ${id} is not archived`);
    }

    // Update the asset to restore it (set is_archived to false)
    const result = await db.update(assetsTable)
      .set({
        is_archived: false,
        updated_at: new Date()
      })
      .where(eq(assetsTable.id, id))
      .returning()
      .execute();

    const restoredAsset = result[0];

    // Create a system user first if it doesn't exist (for activity logging)
    const systemUserId = 'system';
    const existingSystemUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, systemUserId))
      .execute();

    if (existingSystemUser.length === 0) {
      await db.insert(usersTable)
        .values({
          id: systemUserId,
          email: 'system@internal.com',
          password_hash: 'N/A',
          role: 'ADMIN',
          full_name: 'System User',
          is_active: false
        })
        .execute();
    }

    // Log the restoration activity
    await db.insert(userActivityLogsTable)
      .values({
        id: randomUUID(),
        user_id: systemUserId,
        action: 'RESTORE_ASSET',
        entity_type: 'ASSET',
        entity_id: id,
        details: `Asset "${restoredAsset.name}" restored from archive`,
        timestamp: new Date()
      })
      .execute();

    return restoredAsset;
  } catch (error) {
    console.error('Asset restoration failed:', error);
    throw error;
  }
};