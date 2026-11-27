// `bridgecode metrics` runs the engine's metrics: one module computes the budgets for the CLI, the hook and the engine.
import { assertProjectDirectory } from "./manifest.mjs";
import { computeMetrics as engineMetrics, writeMetrics, formatMetrics, METRICS_PATH, CONFIG_PATH, THRESHOLDS, globToRegExp, approxTokens, countCriteria } from "../engine/engine.mjs";

export { formatMetrics, METRICS_PATH, CONFIG_PATH, THRESHOLDS, globToRegExp, approxTokens, countCriteria };
export async function computeMetrics(project) {
  const root = await assertProjectDirectory(project);
  return { root, ...engineMetrics(root) };
}
export async function runMetrics({ project = "." } = {}) {
  return writeMetrics(await assertProjectDirectory(project));
}
