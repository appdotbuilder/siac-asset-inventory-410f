import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createAssetInputSchema,
  updateAssetInputSchema,
  createUserInputSchema,
  updateUserInputSchema,
  loginInputSchema,
  createComplaintInputSchema,
  updateComplaintInputSchema,
  createMaintenanceInputSchema,
  updateMaintenanceInputSchema,
  reportFilterSchema,
} from './schema';

// Import handlers
import { createAsset } from './handlers/create_asset';
import { getAssets } from './handlers/get_assets';
import { getAssetById } from './handlers/get_asset_by_id';
import { updateAsset } from './handlers/update_asset';
import { deleteAsset } from './handlers/delete_asset';
import { restoreAsset } from './handlers/restore_asset';
import { createUser } from './handlers/create_user';
import { loginUser } from './handlers/login_user';
import { getUsers } from './handlers/get_users';
import { updateUser } from './handlers/update_user';
import { deleteUser } from './handlers/delete_user';
import { createComplaint } from './handlers/create_complaint';
import { getComplaints } from './handlers/get_complaints';
import { updateComplaint } from './handlers/update_complaint';
import { createMaintenance } from './handlers/create_maintenance';
import { getMaintenanceSchedules } from './handlers/get_maintenance_schedules';
import { updateMaintenance } from './handlers/update_maintenance';
import { getAssetHistory } from './handlers/get_asset_history';
import { getUserActivityLogs } from './handlers/get_user_activity_logs';
import { generateReport } from './handlers/generate_report';
import { getAIRecommendations } from './handlers/get_ai_recommendations';
import { getDashboardStats } from './handlers/get_dashboard_stats';
import { sendNotificationEmail } from './handlers/send_notification_email';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Asset management routes
  createAsset: publicProcedure
    .input(createAssetInputSchema)
    .mutation(({ input }) => createAsset(input)),

  getAssets: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        condition: z.string().optional(),
        owner: z.string().optional(),
        is_archived: z.boolean().optional(),
      }).optional()
    )
    .query(({ input }) => getAssets(input)),

  getAssetById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => getAssetById(input.id)),

  updateAsset: publicProcedure
    .input(updateAssetInputSchema)
    .mutation(({ input }) => updateAsset(input)),

  deleteAsset: publicProcedure
    .input(z.object({ id: z.string(), permanent: z.boolean().optional() }))
    .mutation(({ input }) => deleteAsset(input.id, input.permanent)),

  restoreAsset: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => restoreAsset(input.id)),

  // User management routes
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  loginUser: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => loginUser(input)),

  getUsers: publicProcedure
    .query(() => getUsers()),

  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),

  deleteUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => deleteUser(input.id)),

  // Complaint management routes
  createComplaint: publicProcedure
    .input(createComplaintInputSchema)
    .mutation(({ input }) => createComplaint(input)),

  getComplaints: publicProcedure
    .input(
      z.object({
        asset_id: z.string().optional(),
        status: z.string().optional(),
      }).optional()
    )
    .query(({ input }) => getComplaints(input)),

  updateComplaint: publicProcedure
    .input(updateComplaintInputSchema)
    .mutation(({ input }) => updateComplaint(input)),

  // Maintenance management routes
  createMaintenance: publicProcedure
    .input(createMaintenanceInputSchema)
    .mutation(({ input }) => createMaintenance(input)),

  getMaintenanceSchedules: publicProcedure
    .input(
      z.object({
        asset_id: z.string().optional(),
        start_date: z.coerce.date().optional(),
        end_date: z.coerce.date().optional(),
        is_completed: z.boolean().optional(),
      }).optional()
    )
    .query(({ input }) => getMaintenanceSchedules(input)),

  updateMaintenance: publicProcedure
    .input(updateMaintenanceInputSchema)
    .mutation(({ input }) => updateMaintenance(input)),

  // History and logging routes
  getAssetHistory: publicProcedure
    .input(z.object({ asset_id: z.string() }))
    .query(({ input }) => getAssetHistory(input.asset_id)),

  getUserActivityLogs: publicProcedure
    .input(
      z.object({
        user_id: z.string().optional(),
        start_date: z.coerce.date().optional(),
        end_date: z.coerce.date().optional(),
        action: z.string().optional(),
      }).optional()
    )
    .query(({ input }) => getUserActivityLogs(input)),

  // Report generation
  generateReport: publicProcedure
    .input(reportFilterSchema)
    .mutation(({ input }) => generateReport(input)),

  // AI recommendations
  getAIRecommendations: publicProcedure
    .input(z.object({ asset_id: z.string() }))
    .query(({ input }) => getAIRecommendations(input.asset_id)),

  // Dashboard statistics
  getDashboardStats: publicProcedure
    .query(() => getDashboardStats()),

  // Email notifications
  sendNotificationEmail: publicProcedure
    .input(
      z.object({
        to: z.array(z.string()),
        subject: z.string(),
        body: z.string(),
        type: z.enum(['complaint', 'maintenance', 'status_change']),
      })
    )
    .mutation(({ input }) => sendNotificationEmail(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`SIAC TRPC server listening at port: ${port}`);
}

start();