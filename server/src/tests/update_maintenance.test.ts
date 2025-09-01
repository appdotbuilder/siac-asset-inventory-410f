import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { maintenanceSchedulesTable, assetsTable, usersTable } from '../db/schema';
import { type UpdateMaintenanceInput } from '../schema';
import { updateMaintenance } from '../handlers/update_maintenance';
import { eq } from 'drizzle-orm';

describe('updateMaintenance', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create prerequisite data
  const createPrerequisites = async () => {
    // Create user
    await db.insert(usersTable).values({
      id: 'user1',
      email: 'admin@example.com',
      password_hash: 'hashedpassword',
      role: 'ADMIN',
      full_name: 'Admin User',
      is_active: true
    });

    // Create asset
    await db.insert(assetsTable).values({
      id: 'asset1',
      name: 'Test Monitor',
      category: 'MONITOR',
      condition: 'GOOD',
      qr_code: 'QR001'
    });

    // Create maintenance schedule
    await db.insert(maintenanceSchedulesTable).values({
      id: 'maintenance1',
      asset_id: 'asset1',
      title: 'Initial Maintenance',
      description: 'Initial description',
      scheduled_date: new Date('2024-12-25'),
      is_completed: false,
      created_by: 'user1'
    });
  };

  it('should update maintenance title', async () => {
    await createPrerequisites();

    const input: UpdateMaintenanceInput = {
      id: 'maintenance1',
      title: 'Updated Maintenance Title'
    };

    const result = await updateMaintenance(input);

    expect(result.id).toEqual('maintenance1');
    expect(result.title).toEqual('Updated Maintenance Title');
    expect(result.description).toEqual('Initial description'); // Should remain unchanged
    expect(result.is_completed).toEqual(false); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update maintenance description', async () => {
    await createPrerequisites();

    const input: UpdateMaintenanceInput = {
      id: 'maintenance1',
      description: 'Updated maintenance description'
    };

    const result = await updateMaintenance(input);

    expect(result.id).toEqual('maintenance1');
    expect(result.title).toEqual('Initial Maintenance'); // Should remain unchanged
    expect(result.description).toEqual('Updated maintenance description');
    expect(result.is_completed).toEqual(false); // Should remain unchanged
  });

  it('should update scheduled date', async () => {
    await createPrerequisites();

    const newDate = new Date('2024-12-30');
    const input: UpdateMaintenanceInput = {
      id: 'maintenance1',
      scheduled_date: newDate
    };

    const result = await updateMaintenance(input);

    expect(result.id).toEqual('maintenance1');
    expect(result.scheduled_date).toEqual(newDate);
    expect(result.title).toEqual('Initial Maintenance'); // Should remain unchanged
    expect(result.is_completed).toEqual(false); // Should remain unchanged
  });

  it('should mark maintenance as completed', async () => {
    await createPrerequisites();

    const input: UpdateMaintenanceInput = {
      id: 'maintenance1',
      is_completed: true
    };

    const result = await updateMaintenance(input);

    expect(result.id).toEqual('maintenance1');
    expect(result.is_completed).toEqual(true);
    expect(result.title).toEqual('Initial Maintenance'); // Should remain unchanged
    expect(result.description).toEqual('Initial description'); // Should remain unchanged
  });

  it('should update multiple fields at once', async () => {
    await createPrerequisites();

    const newDate = new Date('2024-12-31');
    const input: UpdateMaintenanceInput = {
      id: 'maintenance1',
      title: 'Comprehensive Update',
      description: 'Updated description with completion',
      scheduled_date: newDate,
      is_completed: true
    };

    const result = await updateMaintenance(input);

    expect(result.id).toEqual('maintenance1');
    expect(result.title).toEqual('Comprehensive Update');
    expect(result.description).toEqual('Updated description with completion');
    expect(result.scheduled_date).toEqual(newDate);
    expect(result.is_completed).toEqual(true);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update description to null', async () => {
    await createPrerequisites();

    const input: UpdateMaintenanceInput = {
      id: 'maintenance1',
      description: null
    };

    const result = await updateMaintenance(input);

    expect(result.id).toEqual('maintenance1');
    expect(result.description).toBeNull();
    expect(result.title).toEqual('Initial Maintenance'); // Should remain unchanged
  });

  it('should save updates to database', async () => {
    await createPrerequisites();

    const input: UpdateMaintenanceInput = {
      id: 'maintenance1',
      title: 'Database Verified Update',
      is_completed: true
    };

    await updateMaintenance(input);

    // Verify the update was persisted in database
    const maintenance = await db.select()
      .from(maintenanceSchedulesTable)
      .where(eq(maintenanceSchedulesTable.id, 'maintenance1'))
      .execute();

    expect(maintenance).toHaveLength(1);
    expect(maintenance[0].title).toEqual('Database Verified Update');
    expect(maintenance[0].is_completed).toEqual(true);
    expect(maintenance[0].updated_at).toBeInstanceOf(Date);
  });

  it('should update updated_at timestamp', async () => {
    await createPrerequisites();

    // Get original timestamp
    const originalMaintenance = await db.select()
      .from(maintenanceSchedulesTable)
      .where(eq(maintenanceSchedulesTable.id, 'maintenance1'))
      .execute();

    const originalUpdatedAt = originalMaintenance[0].updated_at;

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const input: UpdateMaintenanceInput = {
      id: 'maintenance1',
      title: 'Timestamp Test Update'
    };

    const result = await updateMaintenance(input);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should throw error for non-existent maintenance schedule', async () => {
    const input: UpdateMaintenanceInput = {
      id: 'non-existent-id',
      title: 'This should fail'
    };

    await expect(updateMaintenance(input)).rejects.toThrow(/not found/i);
  });

  it('should handle empty update gracefully', async () => {
    await createPrerequisites();

    const input: UpdateMaintenanceInput = {
      id: 'maintenance1'
      // No other fields provided
    };

    const result = await updateMaintenance(input);

    expect(result.id).toEqual('maintenance1');
    expect(result.title).toEqual('Initial Maintenance'); // Should remain unchanged
    expect(result.description).toEqual('Initial description'); // Should remain unchanged
    expect(result.is_completed).toEqual(false); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date); // Should be updated
  });
});