import { db } from '../db';
import { maintenanceSchedulesTable } from '../db/schema';
import { type UpdateMaintenanceInput, type MaintenanceSchedule } from '../schema';
import { eq } from 'drizzle-orm';

export const updateMaintenance = async (input: UpdateMaintenanceInput): Promise<MaintenanceSchedule> => {
  try {
    // Build the update object with only provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date()
    };

    if (input.title !== undefined) {
      updateData['title'] = input.title;
    }

    if (input.description !== undefined) {
      updateData['description'] = input.description;
    }

    if (input.scheduled_date !== undefined) {
      updateData['scheduled_date'] = input.scheduled_date;
    }

    if (input.is_completed !== undefined) {
      updateData['is_completed'] = input.is_completed;
    }

    // Update the maintenance schedule
    const result = await db.update(maintenanceSchedulesTable)
      .set(updateData)
      .where(eq(maintenanceSchedulesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Maintenance schedule with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Maintenance update failed:', error);
    throw error;
  }
};