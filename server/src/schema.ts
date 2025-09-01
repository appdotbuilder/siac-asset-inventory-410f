import { z } from 'zod';

// Enums
export const assetConditionEnum = z.enum(['NEW', 'GOOD', 'UNDER_REPAIR', 'DAMAGED']);
export const assetCategoryEnum = z.enum([
  'MONITOR', 'CPU', 'AC', 'CHAIR', 'TABLE', 'DISPENSER', 
  'CCTV', 'ROUTER', 'LAN_CABLE', 'OTHER'
]);
export const userRoleEnum = z.enum(['ADMIN', 'EMPLOYEE']);
export const complaintStatusEnum = z.enum(['NEEDS_REPAIR', 'URGENT', 'UNDER_REPAIR', 'RESOLVED']);

// Asset schema
export const assetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: assetCategoryEnum,
  condition: assetConditionEnum,
  owner: z.string().nullable(),
  photo_url: z.string().nullable(),
  qr_code: z.string(),
  is_archived: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Asset = z.infer<typeof assetSchema>;

// Asset input schemas
export const createAssetInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  category: assetCategoryEnum,
  condition: assetConditionEnum,
  owner: z.string().nullable(),
  photo_url: z.string().nullable()
});

export type CreateAssetInput = z.infer<typeof createAssetInputSchema>;

export const updateAssetInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: assetCategoryEnum.optional(),
  condition: assetConditionEnum.optional(),
  owner: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional()
});

export type UpdateAssetInput = z.infer<typeof updateAssetInputSchema>;

// User schema
export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  password_hash: z.string(),
  role: userRoleEnum,
  full_name: z.string(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// User input schemas
export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: userRoleEnum,
  full_name: z.string().min(1)
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: userRoleEnum.optional(),
  full_name: z.string().min(1).optional(),
  is_active: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Login schema
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Complaint schema
export const complaintSchema = z.object({
  id: z.string(),
  asset_id: z.string(),
  complainant_name: z.string(),
  status: complaintStatusEnum,
  description: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Complaint = z.infer<typeof complaintSchema>;

// Complaint input schemas
export const createComplaintInputSchema = z.object({
  asset_id: z.string(),
  complainant_name: z.string().min(1),
  status: complaintStatusEnum,
  description: z.string().min(1)
});

export type CreateComplaintInput = z.infer<typeof createComplaintInputSchema>;

export const updateComplaintInputSchema = z.object({
  id: z.string(),
  status: complaintStatusEnum.optional(),
  description: z.string().min(1).optional()
});

export type UpdateComplaintInput = z.infer<typeof updateComplaintInputSchema>;

// Asset history schema
export const assetHistorySchema = z.object({
  id: z.string(),
  asset_id: z.string(),
  field_name: z.string(),
  old_value: z.string().nullable(),
  new_value: z.string().nullable(),
  changed_by: z.string().nullable(),
  changed_at: z.coerce.date()
});

export type AssetHistory = z.infer<typeof assetHistorySchema>;

// Maintenance schedule schema
export const maintenanceScheduleSchema = z.object({
  id: z.string(),
  asset_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  scheduled_date: z.coerce.date(),
  is_completed: z.boolean(),
  created_by: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type MaintenanceSchedule = z.infer<typeof maintenanceScheduleSchema>;

// Maintenance input schemas
export const createMaintenanceInputSchema = z.object({
  asset_id: z.string(),
  title: z.string().min(1),
  description: z.string().nullable(),
  scheduled_date: z.coerce.date(),
  created_by: z.string()
});

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceInputSchema>;

export const updateMaintenanceInputSchema = z.object({
  id: z.string(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  scheduled_date: z.coerce.date().optional(),
  is_completed: z.boolean().optional()
});

export type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceInputSchema>;

// User activity log schema
export const userActivityLogSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullable(),
  details: z.string().nullable(),
  timestamp: z.coerce.date()
});

export type UserActivityLog = z.infer<typeof userActivityLogSchema>;

// Report filter schema
export const reportFilterSchema = z.object({
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  condition: assetConditionEnum.optional(),
  category: assetCategoryEnum.optional(),
  owner: z.string().optional(),
  format: z.enum(['PDF', 'XLSX'])
});

export type ReportFilter = z.infer<typeof reportFilterSchema>;

// AI recommendation schema
export const aiRecommendationSchema = z.object({
  usability_assessment: z.string(),
  maintenance_prediction: z.string(),
  replacement_recommendation: z.string()
});

export type AIRecommendation = z.infer<typeof aiRecommendationSchema>;

// Asset with relations schema (for detailed view)
export const assetWithRelationsSchema = assetSchema.extend({
  complaints: z.array(complaintSchema),
  history: z.array(assetHistorySchema),
  maintenance_schedules: z.array(maintenanceScheduleSchema)
});

export type AssetWithRelations = z.infer<typeof assetWithRelationsSchema>;