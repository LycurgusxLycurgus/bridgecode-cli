import { prepareLifecycle } from "./install.mjs";

export async function updateBridgecode(options = {}) {
  return prepareLifecycle({ ...options, command: "update" });
}
