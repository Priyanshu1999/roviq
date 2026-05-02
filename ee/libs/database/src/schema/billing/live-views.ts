// Live views for soft-deletable billing tables. Always declare via
// `liveView()` so RLS runs as the calling role, not the view owner.

import { liveView } from '@roviq/database';
import { isNull } from 'drizzle-orm';
import { gatewayConfigs } from './gateway-configs';
import { plans } from './plans';

export const plansLive = liveView('plans_live').as((qb) =>
  qb.select().from(plans).where(isNull(plans.deletedAt)),
);

export const gatewayConfigsLive = liveView('payment_gateway_configs_live').as((qb) =>
  qb.select().from(gatewayConfigs).where(isNull(gatewayConfigs.deletedAt)),
);
