/**
 * What the popup can honestly say after a clear.
 * chrome.browsingData.remove resolves with no file list, byte count, or
 * content types. Numbers are shown only when a caller measured them.
 */

const RESULT_KEY = "lastResult";

/**
 * @typedef {{ files: number, bytes: number, fileTypes: number, estimated: boolean }} Measurement
 * @typedef {{
 *   ok: true,
 *   title: string,
 *   origin: string,
 *   categories: string[],
 *   measured?: Measurement
 * } | { ok: false, reason: string }} ResultView
 */

/**
 * @param {unknown} clearResult
 * @returns {ResultView}
 */
export function resultFromClear(clearResult) {
  const result = clearResult && typeof clearResult === "object"
    ? /** @type {Record<string, unknown>} */ (clearResult)
    : null;

  if (!result || result.ok !== true) {
    const reason = result && typeof result.reason === "string" && result.reason.trim()
      ? result.reason.trim()
      : "Couldn't clear the cache for this tab.";
    return { ok: false, reason };
  }

  /** @type {ResultView} */
  const view = {
    ok: true,
    title: "Cache cleared",
    origin: typeof result.origin === "string" ? result.origin : "",
    categories: Array.isArray(result.categories)
      ? result.categories.filter((category) => typeof category === "string" && category)
      : [],
  };

  const measured = sanitizeMeasurement(result.measured);
  if (measured) {
    view.measured = measured;
  }
  return view;
}

/**
 * @param {ResultView | null | undefined} view
 * @returns {{
 *   kind: "empty",
 *   text: string
 * } | {
 *   kind: "error",
 *   title: string,
 *   detail: string
 * } | {
 *   kind: "success",
 *   title: string,
 *   origin: string,
 *   categories: string,
 *   estimated: boolean
 * }}
 */
export function resultLines(view) {
  if (!view) {
    return {
      kind: "empty",
      text: "Results appear here after a clear.",
    };
  }
  if (view.ok !== true) {
    return {
      kind: "error",
      title: "Not cleared",
      detail: view.reason || "Couldn't clear the cache for this tab.",
    };
  }
  if (view.measured) {
    const estimated = view.measured.estimated === true;
    const typeWord = view.measured.fileTypes === 1 ? "type" : "types";
    return {
      kind: "success",
      title: `${estimated ? "Estimate: " : ""}${view.measured.files} files · ${formatBytes(view.measured.bytes)} · ${view.measured.fileTypes} file ${typeWord}`,
      origin: view.origin,
      categories: view.categories.join(", "),
      estimated,
    };
  }
  return {
    kind: "success",
    title: "Cache cleared",
    origin: view.origin,
    categories: view.categories.join(", "),
    estimated: false,
  };
}

/**
 * @param {unknown} storage
 * @param {ResultView} view
 * @returns {Promise<void>}
 */
export async function saveLastResult(storage, view) {
  const payload = { [RESULT_KEY]: view };
  const areas = storage && typeof storage === "object"
    ? /** @type {{ session?: { set?: Function }, local?: { set?: Function } }} */ (storage)
    : {};

  if (areas.session && typeof areas.session.set === "function") {
    await areas.session.set(payload);
    return;
  }
  if (areas.local && typeof areas.local.set === "function") {
    await areas.local.set(payload);
  }
}

/**
 * @param {unknown} storage
 * @returns {Promise<ResultView | null>}
 */
export async function loadLastResult(storage) {
  const areas = storage && typeof storage === "object"
    ? /** @type {{ session?: { get?: Function }, local?: { get?: Function } }} */ (storage)
    : {};

  if (areas.session && typeof areas.session.get === "function") {
    try {
      const data = await areas.session.get(RESULT_KEY);
      return coerceResult(data);
    } catch {
      return null;
    }
  }
  if (areas.local && typeof areas.local.get === "function") {
    try {
      const data = await areas.local.get(RESULT_KEY);
      return coerceResult(data);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {unknown} data
 * @returns {ResultView | null}
 */
function coerceResult(data) {
  if (!data || typeof data !== "object" || !Object.prototype.hasOwnProperty.call(data, RESULT_KEY)) {
    return null;
  }
  const value = /** @type {Record<string, unknown>} */ (data)[RESULT_KEY];
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = /** @type {Record<string, unknown>} */ (value);
  if (record.ok === true && typeof record.origin === "string") {
    return resultFromClear(record);
  }
  if (record.ok === false && typeof record.reason === "string") {
    return { ok: false, reason: record.reason };
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {Measurement | null}
 */
function sanitizeMeasurement(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = /** @type {Record<string, unknown>} */ (value);
  const { files, bytes, fileTypes } = record;
  if (!isCount(files) || !isByteCount(bytes) || !isCount(fileTypes)) {
    return null;
  }
  return {
    files,
    bytes,
    fileTypes,
    estimated: record.estimated === true,
  };
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isCount(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000;
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isByteCount(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000_000;
}

/**
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const shown = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${shown} ${units[unit]}`;
}
