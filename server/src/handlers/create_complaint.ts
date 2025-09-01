import { db } from '../db';
import { complaintsTable, assetsTable } from '../db/schema';
import { type CreateComplaintInput, type Complaint } from '../schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const createComplaint = async (input: CreateComplaintInput): Promise<Complaint> => {
  try {
    // Verify that the asset exists before creating a complaint
    const existingAsset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, input.asset_id))
      .execute();

    if (existingAsset.length === 0) {
      throw new Error(`Asset with id ${input.asset_id} not found`);
    }

    // Generate unique ID for the complaint
    const complaintId = randomUUID();

    // Insert complaint record
    const result = await db.insert(complaintsTable)
      .values({
        id: complaintId,
        asset_id: input.asset_id,
        complainant_name: input.complainant_name,
        status: input.status,
        description: input.description
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Complaint creation failed:', error);
    throw error;
  }
};