import { db } from '../db';
import { complaintsTable, assetsTable, assetHistoryTable } from '../db/schema';
import { type UpdateComplaintInput, type Complaint } from '../schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function updateComplaint(input: UpdateComplaintInput): Promise<Complaint> {
  try {
    // First, get the existing complaint to check what changes are being made
    const existingComplaint = await db.select()
      .from(complaintsTable)
      .where(eq(complaintsTable.id, input.id))
      .execute();

    if (!existingComplaint || existingComplaint.length === 0) {
      throw new Error(`Complaint with id ${input.id} not found`);
    }

    const complaint = existingComplaint[0];

    // Update the complaint
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    const updatedResult = await db.update(complaintsTable)
      .set(updateData)
      .where(eq(complaintsTable.id, input.id))
      .returning()
      .execute();

    const updatedComplaint = updatedResult[0];

    // Log status changes in asset history
    if (input.status && input.status !== complaint.status) {
      await db.insert(assetHistoryTable)
        .values({
          id: uuidv4(),
          asset_id: complaint.asset_id,
          field_name: 'complaint_status',
          old_value: complaint.status,
          new_value: input.status,
          changed_by: null, // Could be enhanced to accept user_id in input
          changed_at: new Date()
        })
        .execute();

      // If complaint is resolved, check if we should update asset condition
      if (input.status === 'RESOLVED') {
        // Check if there are any other non-resolved complaints for this asset
        const otherComplaints = await db.select()
          .from(complaintsTable)
          .where(eq(complaintsTable.asset_id, complaint.asset_id))
          .execute();

        const hasUnresolvedComplaints = otherComplaints.some(c => 
          c.id !== input.id && c.status !== 'RESOLVED'
        );

        // If no other unresolved complaints, potentially update asset condition from UNDER_REPAIR to GOOD
        if (!hasUnresolvedComplaints) {
          const asset = await db.select()
            .from(assetsTable)
            .where(eq(assetsTable.id, complaint.asset_id))
            .execute();

          if (asset.length > 0 && asset[0].condition === 'UNDER_REPAIR') {
            await db.update(assetsTable)
              .set({ 
                condition: 'GOOD',
                updated_at: new Date()
              })
              .where(eq(assetsTable.id, complaint.asset_id))
              .execute();

            // Log the asset condition change
            await db.insert(assetHistoryTable)
              .values({
                id: uuidv4(),
                asset_id: complaint.asset_id,
                field_name: 'condition',
                old_value: 'UNDER_REPAIR',
                new_value: 'GOOD',
                changed_by: null,
                changed_at: new Date()
              })
              .execute();
          }
        }
      }
    }

    return updatedComplaint;
  } catch (error) {
    console.error('Complaint update failed:', error);
    throw error;
  }
}