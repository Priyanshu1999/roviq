'use client';

import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { useMemo } from 'react';
import { REFRESH_INTERVALS, type RefreshInterval, TIME_RANGES, type TimeRange } from './constants';

const RANGE_VALUES = TIME_RANGES.map((r) => r.shortLabel);
const REFRESH_VALUES = REFRESH_INTERVALS.map((r) => r.label);
const TAB_VALUES = ['overview', 'events', 'streams', 'traces-logs'] as const;

export type Tab = (typeof TAB_VALUES)[number];

const rangeParser = parseAsStringLiteral(RANGE_VALUES).withDefault('1h');
const refreshParser = parseAsStringLiteral(REFRESH_VALUES).withDefault('30s');
const tabParser = parseAsStringLiteral(TAB_VALUES).withDefault('overview');
const servicesParser = parseAsArrayOf(parseAsString, ',').withDefault([]);

/** All four URL-state slices in one hook so the dashboard wiring stays small. */
export function useDashboardUrlState() {
  const [rangeShort, setRangeShort] = useQueryState('range', rangeParser);
  const [refreshLabel, setRefreshLabel] = useQueryState('refresh', refreshParser);
  const [tab, setTab] = useQueryState('tab', tabParser);
  const [services, setServices] = useQueryState('svc', servicesParser);

  const range = useMemo<TimeRange>(
    () => TIME_RANGES.find((r) => r.shortLabel === rangeShort) ?? TIME_RANGES[3],
    [rangeShort],
  );
  const refresh = useMemo<RefreshInterval>(
    () => REFRESH_INTERVALS.find((r) => r.label === refreshLabel) ?? REFRESH_INTERVALS[3],
    [refreshLabel],
  );

  return {
    range,
    setRange: (r: TimeRange) => void setRangeShort(r.shortLabel),
    refresh,
    setRefresh: (r: RefreshInterval) => void setRefreshLabel(r.label),
    tab,
    setTab: (t: string) => void setTab(t as Tab),
    services,
    setServices: (s: string[]) => void setServices(s.length ? s : null),
  };
}
