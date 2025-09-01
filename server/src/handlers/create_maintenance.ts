import { db } from '../db';
import { maintenanceSchedulesTable, userActivityLogsTable, assetsTable, usersTable } from '../db/schema';
import { type CreateMaintenanceInput, type MaintenanceSchedule } from '../schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const createMaintenance = async (input: CreateMaintenanceInput): Promise<MaintenanceSchedule> => {
  try {
    // Verify the asset exists
    const asset = await db.select()
      .from(assetsTable)
      .where(eq(assetsTable.id, input.asset_id))
      .execute();

    if (asset.length === 0) {
      throw new Error(`Asset with id ${input.asset_id} does not exist`);
    }

    // Verify the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.created_by))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${input.created_by} does not exist`);
    }

    const maintenanceId = randomUUID();
    const now = new Date();

    // Insert maintenance schedule record
    const result = await db.insert(maintenanceSchedulesTable)
      .values({
        id: maintenanceId,
        asset_id: input.asset_id,
        title: input.title,
        description: input.description,
        scheduled_date: input.scheduled_date,
        is_completed: false,
        created_by: input.created_by,
        created_at: now,
        updated_at: now
      })
      .returning()
      .execute();

    // Log the maintenance scheduling activity
    const activityLogId = randomUUID();
    await db.insert(userActivityLogsTable)
      .values({
        id: activityLogId,
        user_id: input.created_by,
        action: 'CREATE_MAINTENANCE',
        entity_type: 'MAINTENANCE_SCHEDULE',
        entity_id: maintenanceId,
        details: `Scheduled maintenance: ${input.title} for asset ${input.asset_id} on ${input.scheduled_date.toISOString().split('T')[0]}`,
        timestamp: now
      })
      .execute();

    return result[0];
  } catch (error) {
    console.error('Maintenance creation failed:', error);
    throw error;
  }
};