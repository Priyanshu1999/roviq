import { cn } from '@roviq/ui/lib/utils';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

export interface ImpersonationBadgeLabels {
  /** Badge text — e.g. "Impersonated by {name}" */
  badgeText?: (name: string) => string;
  /** Tooltip text — full impersonation description */
  tooltipText?: (name: string, scope: string, userName?: string) => string;
  /** Scope display names */
  scopeLabels?: Record<string, string>;
}

export interface ImpersonationBadgeProps {
  /** Name of the admin who impersonated */
  impersonatorName: string;
  /** Scope of the impersonator — determines badge color */
  actorScope?: 'platform' | 'reseller' | 'institute';
  /** Name of the user being impersonated (shown in tooltip) */
  userName?: string;
  /** Optional labels for i18n — pass translated strings from next-intl */
  labels?: ImpersonationBadgeLabels;
}

const scopeColors = {
  /** Platform admin impersonation — purple */
  platform: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  /** Reseller admin impersonation — blue */
  reseller: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  /** Institute-level impersonation — grey */
  institute: 'bg-muted text-muted-foreground',
} as const;

const defaultScopeLabels = {
  platform: 'platform admin',
  reseller: 'reseller admin',
  institute: 'institute admin',
} as const;

/**
 * Badge showing that an audit action was performed during impersonation.
 *
 * - Color coded by scope: platform=purple, reseller=blue, institute=grey
 * - Tooltip with full impersonation details on hover
 */
export function ImpersonationBadge({
  impersonatorName,
  actorScope = 'platform',
  userName,
  labels,
}: ImpersonationBadgeProps) {
  const colorClasses = scopeColors[actorScope];
  const scopeLabel = labels?.scopeLabels?.[actorScope] ?? defaultScopeLabels[actorScope];

  const tooltipText = labels?.tooltipText
    ? labels.tooltipText(impersonatorName, scopeLabel, userName)
    : userName
      ? `This action was performed by ${impersonatorName} (${scopeLabel}) while impersonating ${userName}`
      : `This action was performed by ${impersonatorName} (${scopeLabel}) via impersonation`;

  const badgeText = labels?.badgeText
    ? labels.badgeText(impersonatorName)
    : `Impersonated by ${impersonatorName}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn('cursor-default border-transparent text-xs font-normal', colorClasses)}
          >
            {badgeText}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
