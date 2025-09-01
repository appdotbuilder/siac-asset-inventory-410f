import { db } from '../db';
import { assetsTable, userActivityLogsTable, usersTable } from '../db/schema';
import { type CreateAssetInput, type Asset } from '../schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const createAsset = async (input: CreateAssetInput): Promise<Asset> => {
  try {
    // Generate unique ID and QR code
    const id = randomUUID();
    const qr_code = `QR_${id}`;

    // Insert asset record
    const result = await db.insert(assetsTable)
      .values({
        id,
        name: input.name,
        description: input.description,
        category: input.category,
        condition: input.condition,
        owner: input.owner,
        photo_url: input.photo_url,
        qr_code,
        is_archived: false
      })
      .returning()
      .execute();

    const asset = result[0];

    // Log the creation activity - only if we have a valid user_id
    if (input.owner) {
      try {
        // Check if user exists before logging
        const userExists = await db.select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.id, input.owner))
          .limit(1)
          .execute();

        if (userExists.length > 0) {
          await db.insert(userActivityLogsTable)
            .values({
              id: randomUUID(),
              user_id: input.owner,
              action: 'CREATE',
              entity_type: 'ASSET',
              entity_id: asset.id,
              details: `Created asset: ${asset.name} (${asset.category})`
            })
            .execute();
        }
      } catch (logError) {
        // Log error but don't fail the asset creation
        console.warn('Failed to log asset creation activity:', logError);
      }
    }

    return asset;
  } catch (error) {
    console.error('Asset creation failed:', error);
    throw error;
  }
};