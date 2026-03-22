import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import { createChildLogger } from "./logger.js";

const log = createChildLogger("rate-limit");

interface RouteLimit {
  max: number;
  timeWindow: string;
  methods?: string[];
}

interface RateLimitConfig {
  global: RouteLimit;
  routes: Record<string, RouteLimit>;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  global: { max: 100, timeWindow: "1 minute" },
  routes: {},
};

let currentConfig: RateLimitConfig = { ...DEFAULT_CONFIG };

// Possible config file locations (checked in order)
const CONFIG_PATHS = [
  "/app/config/rate-limits.yml", // Docker mount
  path.resolve(process.cwd(), "config/rate-limits.yml"), // Local
  path.resolve(process.cwd(), "../../deployment/config/rate-limits.yml"), // From apps/api
];

function findConfigPath(): string | null {
  for (const p of CONFIG_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadConfig(): RateLimitConfig {
  const configPath = findConfigPath();
  if (!configPath) {
    log.warn("No rate-limits.yml found, using defaults");
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = parseYaml(raw) as RateLimitConfig;

    if (!parsed.global) {
      parsed.global = DEFAULT_CONFIG.global;
    }
    if (!parsed.routes) {
      parsed.routes = {};
    }

    log.info(
      { path: configPath, routeCount: Object.keys(parsed.routes).length },
      "rate limit config loaded"
    );
    return parsed;
  } catch (err) {
    log.error({ err, path: configPath }, "failed to parse rate-limits.yml, using defaults");
    return { ...DEFAULT_CONFIG };
  }
}

export function initRateLimitConfig(): RateLimitConfig {
  currentConfig = loadConfig();

  // Watch for changes (hot-reload)
  const configPath = findConfigPath();
  if (configPath) {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    fs.watch(configPath, () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        log.info("rate-limits.yml changed, reloading...");
        currentConfig = loadConfig();
      }, 500);
    });
  }

  return currentConfig;
}

export function getRateLimitConfig(): RateLimitConfig {
  return currentConfig;
}

// Match a request URL against configured route patterns.
// Supports wildcard patterns.
export function getRouteLimit(url: string): RouteLimit {
  const routes = currentConfig.routes;

  // Exact match first
  if (routes[url]) return routes[url];

  // Wildcard match
  for (const [pattern, limit] of Object.entries(routes)) {
    if (!pattern.includes("*")) continue;
    const regex = new RegExp("^" + pattern.replace(/\*/g, "[^/]+") + "$");
    if (regex.test(url)) return limit;
  }

  return currentConfig.global;
}
