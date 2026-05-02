'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@roviq/ui';
import { useMemo } from 'react';
import { AlertsBanner } from './_components/alerts-banner';
import { GaugePanel } from './_components/gauge-panel';
import { RecentLogsPanel } from './_components/logs-panel';
import { PanelMenu } from './_components/panel-menu';
import { StatPanel } from './_components/stat-panel';
import { StreamsPanel } from './_components/streams-panel';
import { TimeseriesPanel } from './_components/timeseries-panel';
import { Toolbar } from './_components/toolbar';
import { RecentTracesPanel } from './_components/traces-panel';
import { GRAFANA_URL } from './_lib/constants';
import { METRIC_INFO } from './_lib/metric-descriptions';
import { emitRefreshNow } from './_lib/polling';
import { buildLatencyUnion, buildQueries } from './_lib/prom';
import { useDashboardUrlState } from './_lib/url-state';

const ERROR_THRESHOLDS = [
  { value: 0, color: '#73BF69' },
  { value: 1, color: '#F2CC0C' },
  { value: 5, color: '#F2495C' },
];

export function ObservabilityDashboard() {
  const { range, setRange, refresh, setRefresh, tab, setTab, services, setServices } =
    useDashboardUrlState();
  const refreshMs = refresh.ms;

  const queries = useMemo(() => buildQueries(services), [services]);
  const latencyUnion = useMemo(() => buildLatencyUnion(queries), [queries]);

  const httpLegend = (m: Record<string, string>) =>
    `${m.http_method ?? ''} ${m.http_route ?? ''}`.trim() || 'all';
  const subjectLegend = (m: Record<string, string>) => m.subject_prefix ?? 'unknown';

  return (
    <div className="flex flex-col gap-3">
      <Toolbar
        range={range}
        setRange={setRange}
        refresh={refresh}
        setRefresh={setRefresh}
        onRefreshNow={emitRefreshNow}
        services={services}
        setServices={setServices}
        grafanaUrl={GRAFANA_URL}
      />
      <AlertsBanner refreshMs={refreshMs} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="streams">Streams</TabsTrigger>
          <TabsTrigger value="traces-logs">Traces &amp; Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3">
          <div className="grid auto-rows-[minmax(120px,auto)] grid-cols-12 gap-2">
            <TimeseriesPanel
              {...METRIC_INFO.requestRate}
              query={queries.requestRate}
              range={range}
              refreshMs={refreshMs}
              legendKey={httpLegend}
              yUnit="req/s"
              decimals={3}
              className="col-span-12 row-span-2 lg:col-span-6"
              headerRight={<PanelMenu promQuery={queries.requestRate} grafanaUrl={GRAFANA_URL} />}
            />
            <TimeseriesPanel
              {...METRIC_INFO.errorRate5xx}
              query={queries.errorRate5xx}
              range={range}
              refreshMs={refreshMs}
              legendKey={httpLegend}
              yUnit="req/s"
              decimals={3}
              className="col-span-12 row-span-2 lg:col-span-6"
              headerRight={<PanelMenu promQuery={queries.errorRate5xx} grafanaUrl={GRAFANA_URL} />}
            />
            <TimeseriesPanel
              {...METRIC_INFO.latencyQuantiles}
              query={latencyUnion}
              range={range}
              refreshMs={refreshMs}
              legendKey={(m) => m.quantile ?? 'p?'}
              yUnit="ms"
              decimals={0}
              className="col-span-12 row-span-2 lg:col-span-6"
              headerRight={<PanelMenu promQuery={latencyUnion} grafanaUrl={GRAFANA_URL} />}
            />
            <StatPanel
              {...METRIC_INFO.totalRequests}
              query={queries.totalRequests}
              range={range}
              refreshMs={refreshMs}
              decimals={0}
              color="#73BF69"
              sparklineQuery={queries.totalRequestsSpark}
              className="col-span-6 lg:col-span-3"
              headerRight={<PanelMenu promQuery={queries.totalRequests} grafanaUrl={GRAFANA_URL} />}
            />
            <StatPanel
              {...METRIC_INFO.totalRequests5m}
              query={queries.totalRequests5m}
              range={range}
              refreshMs={refreshMs}
              decimals={1}
              color="#5794F2"
              sparklineQuery={queries.totalRequests5mSpark}
              className="col-span-6 lg:col-span-3"
              headerRight={
                <PanelMenu promQuery={queries.totalRequests5m} grafanaUrl={GRAFANA_URL} />
              }
            />
            <GaugePanel
              {...METRIC_INFO.errorPct}
              query={queries.errorPct}
              refreshMs={refreshMs}
              thresholds={ERROR_THRESHOLDS}
              className="col-span-6 lg:col-span-3"
              headerRight={<PanelMenu promQuery={queries.errorPct} grafanaUrl={GRAFANA_URL} />}
            />
            <StatPanel
              {...METRIC_INFO.avgResponseMs}
              query={queries.avgResponseMs}
              range={range}
              refreshMs={refreshMs}
              decimals={2}
              unit="ms"
              color="#73BF69"
              sparklineQuery={queries.avgResponseSpark}
              className="col-span-6 lg:col-span-3"
              headerRight={<PanelMenu promQuery={queries.avgResponseMs} grafanaUrl={GRAFANA_URL} />}
            />
          </div>
        </TabsContent>

        <TabsContent value="events" className="mt-3">
          <div className="grid auto-rows-[minmax(120px,auto)] grid-cols-12 gap-2">
            <TimeseriesPanel
              {...METRIC_INFO.eventBusEmit}
              query={queries.eventBusEmit}
              range={range}
              refreshMs={refreshMs}
              legendKey={subjectLegend}
              yUnit="evt/s"
              decimals={2}
              className="col-span-12 row-span-2 lg:col-span-6"
              headerRight={<PanelMenu promQuery={queries.eventBusEmit} grafanaUrl={GRAFANA_URL} />}
            />
            <TimeseriesPanel
              {...METRIC_INFO.eventBusFailed}
              query={queries.eventBusFailed}
              range={range}
              refreshMs={refreshMs}
              legendKey={subjectLegend}
              yUnit="evt/s"
              decimals={2}
              className="col-span-12 row-span-2 lg:col-span-6"
              headerRight={
                <PanelMenu promQuery={queries.eventBusFailed} grafanaUrl={GRAFANA_URL} />
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="streams" className="mt-3">
          <div>
            <StreamsPanel range={range} refreshMs={refreshMs} />
          </div>
        </TabsContent>

        <TabsContent value="traces-logs" className="mt-3">
          <div className="grid auto-rows-[minmax(120px,auto)] grid-cols-12 gap-2">
            <RecentTracesPanel
              range={range}
              refreshMs={refreshMs}
              services={services}
              grafanaUrl={GRAFANA_URL}
              className="col-span-12"
              headerRight={<PanelMenu tracesQuery="" grafanaUrl={GRAFANA_URL} />}
            />
            <RecentLogsPanel
              range={range}
              refreshMs={refreshMs}
              services={services}
              className="col-span-12"
              headerRight={<PanelMenu logsQuery='{exported_job=~".+"}' grafanaUrl={GRAFANA_URL} />}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
