import { pgTable, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const assetConditionEnum = pgEnum('asset_condition', ['NEW', 'GOOD', 'UNDER_REPAIR', 'DAMAGED']);
export const assetCategoryEnum = pgEnum('asset_category', [
  'MONITOR', 'CPU', 'AC', 'CHAIR', 'TABLE', 'DISPENSER', 
  'CCTV', 'ROUTER', 'LAN_CABLE', 'OTHER'
]);
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'EMPLOYEE']);
export const complaintStatusEnum = pgEnum('complaint_status', ['NEEDS_REPAIR', 'URGENT', 'UNDER_REPAIR', 'RESOLVED']);

// Assets table
export const assetsTable = pgTable('assets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: assetCategoryEnum('category').notNull(),
  condition: assetConditionEnum('condition').notNull(),
  owner: text('owner'),
  photo_url: text('photo_url'),
  qr_code: text('qr_code').notNull().unique(),
  is_archived: boolean('is_archived').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Users table
export const usersTable = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  full_name: text('full_name').notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Complaints table
export const complaintsTable = pgTable('complaints', {
  id: text('id').primaryKey(),
  asset_id: text('asset_id').notNull().references(() => assetsTable.id),
  complainant_name: text('complainant_name').notNull(),
  status: complaintStatusEnum('status').notNull(),
  description: text('description').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Asset history table
export const assetHistoryTable = pgTable('asset_history', {
  id: text('id').primaryKey(),
  asset_id: text('asset_id').notNull().references(() => assetsTable.id),
  field_name: text('field_name').notNull(),
  old_value: text('old_value'),
  new_value: text('new_value'),
  changed_by: text('changed_by').references(() => usersTable.id),
  changed_at: timestamp('changed_at').defaultNow().notNull(),
});

// Maintenance schedules table
export const maintenanceSchedulesTable = pgTable('maintenance_schedules', {
  id: text('id').primaryKey(),
  asset_id: text('asset_id').notNull().references(() => assetsTable.id),
  title: text('title').notNull(),
  description: text('description'),
  scheduled_date: timestamp('scheduled_date').notNull(),
  is_completed: boolean('is_completed').default(false).notNull(),
  created_by: text('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// User activity logs table
export const userActivityLogsTable = pgTable('user_activity_logs', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => usersTable.id),
  action: text('action').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: text('entity_id'),
  details: text('details'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Relations
export const assetsRelations = relations(assetsTable, ({ many }) => ({
  complaints: many(complaintsTable),
  history: many(assetHistoryTable),
  maintenance_schedules: many(maintenanceSchedulesTable),
}));

export const complaintsRelations = relations(complaintsTable, ({ one }) => ({
  asset: one(assetsTable, {
    fields: [complaintsTable.asset_id],
    references: [assetsTable.id],
  }),
}));

export const assetHistoryRelations = relations(assetHistoryTable, ({ one }) => ({
  asset: one(assetsTable, {
    fields: [assetHistoryTable.asset_id],
    references: [assetsTable.id],
  }),
  changed_by_user: one(usersTable, {
    fields: [assetHistoryTable.changed_by],
    references: [usersTable.id],
  }),
}));

export const maintenanceSchedulesRelations = relations(maintenanceSchedulesTable, ({ one }) => ({
  asset: one(assetsTable, {
    fields: [maintenanceSchedulesTable.asset_id],
    references: [assetsTable.id],
  }),
  created_by_user: one(usersTable, {
    fields: [maintenanceSchedulesTable.created_by],
    references: [usersTable.id],
  }),
}));

export const userActivityLogsRelations = relations(userActivityLogsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userActivityLogsTable.user_id],
    references: [usersTable.id],
  }),
}));

export const usersRelations = relations(usersTable, ({ many }) => ({
  activity_logs: many(userActivityLogsTable),
  created_maintenances: many(maintenanceSchedulesTable),
  asset_changes: many(assetHistoryTable),
}));

// Export all tables for enabling relation queries
export const tables = {
  assets: assetsTable,
  users: usersTable,
  complaints: complaintsTable,
  assetHistory: assetHistoryTable,
  maintenanceSchedules: maintenanceSchedulesTable,
  userActivityLogs: userActivityLogsTable,
};

// TypeScript types for the tables
export type Asset = typeof assetsTable.$inferSelect;
export type NewAsset = typeof assetsTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Complaint = typeof complaintsTable.$inferSelect;
export type NewComplaint = typeof complaintsTable.$inferInsert;
export type AssetHistory = typeof assetHistoryTable.$inferSelect;
export type NewAssetHistory = typeof assetHistoryTable.$inferInsert;
export type MaintenanceSchedule = typeof maintenanceSchedulesTable.$inferSelect;
export type NewMaintenanceSchedule = typeof maintenanceSchedulesTable.$inferInsert;
export type UserActivityLog = typeof userActivityLogsTable.$inferSelect;
export type NewUserActivityLog = typeof userActivityLogsTable.$inferInsert;