import { AggregateTracker } from '../shared/aggregation.mjs';
import { validateSenderConfig } from './config.mjs';
import { HerdrCollector } from './herdr-collector.mjs';
import { SnapshotSender } from './snapshot-sender.mjs';

export function createSenderApp(rawConfig, {
  apiFactory,
  fetchImpl,
  instanceId,
  logger = console,
  now,
  reconnectDelaysMs,
  retryDelaysMs,
} = {}) {
  const config = validateSenderConfig(rawConfig);
  let sender;
  const tracker = new AggregateTracker({ onChange: (view) => sender.update(view) });
  sender = new SnapshotSender({
    receiverUrl: config.receiverUrl,
    sourceId: config.sourceId,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    requestTimeoutMs: config.requestTimeoutMs,
    fetchImpl,
    instanceId,
    now,
    retryDelaysMs,
    logger,
  });
  const collector = new HerdrCollector({
    socketPath: config.herdrSocketPath,
    requestTimeoutMs: config.herdrRequestTimeoutMs,
    tracker,
    apiFactory,
    reconnectDelaysMs,
    logger,
  });

  return {
    collector,
    config,
    sender,
    tracker,
    start() {
      sender.start(tracker.view());
      collector.start();
    },
    async stop() {
      await collector.stop();
      await sender.stop();
    },
  };
}
