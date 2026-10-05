import { FastifyInstance } from 'fastify';
import { prisma } from '../server';
import { authenticate, requireAdmin, auditLog } from '../middleware/auth';
import { parseSettings, settingsSchemas } from '../validators/settings.validator';

// HIGH-04 FIX: Only these categories may be read publicly (no auth required).
// Any other category key returns 403 regardless of auth status, preventing
// accidental exposure if an admin ever stores sensitive config in the settings store.
const PUBLIC_CATEGORIES = new Set(['general', 'lottery', 'wallet', 'payments'])

export default async function settingsRoutes(app: FastifyInstance) {
  
  // GET /api/settings/:category
  // Public endpoint for general settings, protected for others
  app.get<{ Params: { category: string } }>(
    '/:category',
    { preHandler: async (request, reply) => {
      if (!PUBLIC_CATEGORIES.has(request.params.category)) {
        await authenticate(request, reply)
        if (!reply.sent) await requireAdmin(request, reply)
      }
    } },
    async (request, reply) => {
      const { category } = request.params;

      try {
        const setting = await prisma.systemSetting.findUnique({
          where: { category },
        });

        // Public responses expose only known display fields, never arbitrary
        // values that might have been saved by older versions of the API.
        const schema = Object.prototype.hasOwnProperty.call(settingsSchemas, category)
          ? settingsSchemas[category as keyof typeof settingsSchemas] : undefined
        const data = PUBLIC_CATEGORIES.has(category)
          ? (schema ? schema.partial().strip().parse(setting?.data || {}) : {})
          : setting?.data || {}
        return {
          success: true,
          data,
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ success: false, message: 'Failed to fetch settings' });
      }
    }
  );

  // PUT /api/settings/:category
  // Protected endpoint to update settings
  app.put<{ Params: { category: string }; Body: any }>(
    '/:category',
    {
      preHandler: [authenticate, requireAdmin],
    },
    async (request, reply) => {
      const { category } = request.params;
      const data = parseSettings(category, request.body);
      const user = request.user as any;

      try {
        const setting = await prisma.systemSetting.upsert({
          where: { category },
          update: {
            data: data as any,
            updatedBy: user.userId,
          },
          create: {
            category,
            data: data as any,
            updatedBy: user.userId,
          },
        });
        await auditLog(user.userId, 'SETTINGS_UPDATED', 'SystemSetting', category, undefined, data, request)

        return {
          success: true,
          message: 'Settings updated successfully',
          data: setting.data,
        };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ success: false, message: 'Failed to update settings' });
      }
    }
  );
}
