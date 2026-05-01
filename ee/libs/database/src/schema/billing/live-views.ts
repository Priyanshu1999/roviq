// Live views for soft-deletable billing tables — soft-delete visibility lives
// here, not in RLS. See libs/database/src/schema/live-views.ts for the same
// pattern across the OSS schema. Migration creates the views with
// security_invoker=true so SELECT runs RLS as the calling DB role.
import { isNull } from 'drizzle-orm';
import { pgView } from 'drizzle-orm/pg-core';
import { gatewayConfigs } from './gateway-configs';
import { plans } from './plans';

export const plansLive = pgView('plans_live').as((qb) =>
  qb.select().from(plans).where(isNull(plans.deletedAt)),
);

export const gatewayConfigsLive = pgView('payment_gateway_configs_live').as((qb) =>
  qb.select().from(gatewayConfigs).where(isNull(gatewayConfigs.deletedAt)),
);
