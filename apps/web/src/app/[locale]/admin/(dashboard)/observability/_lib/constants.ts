export const PALETTE = [
  '#73BF69',
  '#F2CC0C',
  '#5794F2',
  '#FF9830',
  '#B877D9',
  '#FF780A',
  '#705DA0',
  '#37872D',
];

export const TIME_RANGES = [
  { label: 'Last 5 minutes', shortLabel: '5m', seconds: 300, step: 5 },
  { label: 'Last 15 minutes', shortLabel: '15m', seconds: 900, step: 10 },
  { label: 'Last 30 minutes', shortLabel: '30m', seconds: 1800, step: 15 },
  { label: 'Last 1 hour', shortLabel: '1h', seconds: 3600, step: 30 },
  { label: 'Last 3 hours', shortLabel: '3h', seconds: 10800, step: 60 },
  { label: 'Last 6 hours', shortLabel: '6h', seconds: 21600, step: 120 },
  { label: 'Last 24 hours', shortLabel: '24h', seconds: 86400, step: 300 },
  { label: 'Last 7 days', shortLabel: '7d', seconds: 604800, step: 1800 },
] as const;

export const REFRESH_INTERVALS = [
  { label: 'Off', ms: null },
  { label: '5s', ms: 5_000 },
  { label: '10s', ms: 10_000 },
  { label: '30s', ms: 30_000 },
  { label: '1m', ms: 60_000 },
  { label: '5m', ms: 300_000 },
] as const;

export type TimeRange = (typeof TIME_RANGES)[number];
export type RefreshInterval = (typeof REFRESH_INTERVALS)[number];

export const GRAFANA_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GRAFANA_URL) ||
  'http://localhost:3001';
