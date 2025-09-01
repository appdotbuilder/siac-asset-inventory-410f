import { db } from '../db';
import { assetsTable, assetHistoryTable } from '../db/schema';
import { type UpdateAssetInput, type Asset } from '../schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export const updateAsset = async (input: UpdateAssetInput): Promise<Asset> => {
  try {
    // First, get the current asset to track changes
    const currentAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, input.id))
      .execute();

    if (currentAsset.length === 0) {
      throw new Error(`Asset with id ${input.id} not found`);
    }

    const existingAsset = currentAsset[0];

    // Prepare update data with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    // Track changes for history logging
    const changes: Array<{
      field_name: string;
      old_value: string | null;
      new_value: string | null;
    }> = [];

    // Check each field for changes and build update data
    if (input.name !== undefined && input.name !== existingAsset.name) {
      updateData.name = input.name;
      changes.push({
        field_name: 'name',
        old_value: existingAsset.name,
        new_value: input.name
      });
    }

    if (input.description !== undefined && input.description !== existingAsset.description) {
      updateData.description = input.description;
      changes.push({
        field_name: 'description',
        old_value: existingAsset.description,
        new_value: input.description
      });
    }

    if (input.category !== undefined && input.category !== existingAsset.category) {
      updateData.category = input.category;
      changes.push({
        field_name: 'category',
        old_value: existingAsset.category,
        new_value: input.category
      });
    }

    if (input.condition !== undefined && input.condition !== existingAsset.condition) {
      updateData.condition = input.condition;
      changes.push({
        field_name: 'condition',
        old_value: existingAsset.condition,
        new_value: input.condition
      });
    }

    if (input.owner !== undefined && input.owner !== existingAsset.owner) {
      updateData.owner = input.owner;
      changes.push({
        field_name: 'owner',
        old_value: existingAsset.owner,
        new_value: input.owner
      });
    }

    if (input.photo_url !== undefined && input.photo_url !== existingAsset.photo_url) {
      updateData.photo_url = input.photo_url;
      changes.push({
        field_name: 'photo_url',
        old_value: existingAsset.photo_url,
        new_value: input.photo_url
      });
    }

    // Only proceed with update if there are actual changes
    if (Object.keys(updateData).length === 1) { // Only updated_at was added
      // No changes detected, return existing asset
      return existingAsset;
    }

    // Update the asset
    const result = await db.update(assetsTable)
      .set(updateData)
      .where(eq(assetsTable.id, input.id))
      .returning()
      .execute();

    const updatedAsset = result[0];

    // Log changes to asset history
    if (changes.length > 0) {
      const historyEntries = changes.map(change => ({
        id: randomBytes(16).toString('hex'),
        asset_id: input.id,
        field_name: change.field_name,
        old_value: change.old_value,
        new_value: change.new_value,
        changed_by: null, // No user context in this handler
        changed_at: new Date()
      }));

      await db.insert(assetHistoryTable)
        .values(historyEntries)
        .execute();
    }

    return updatedAsset;
  } catch (error) {
    console.error('Asset update failed:', error);
    throw error;
  }
};