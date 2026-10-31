import { api } from './api';

let cachedEnterpriseDashboard = null;
let cachedAt = 0;
let inFlightRequest = null;
const CACHE_TTL_MS = 10000;

async function fetchEnterpriseDashboard() {
  try {
    const { data } = await api.get('/dashboard/enterprise');
    return data;
  } catch {
    const { data } = await api.get('/dashboard/metrics');
    return data;
  }
}

export async function getEnterpriseDashboard(options = {}) {
  const { force = false } = options;
  const now = Date.now();

  if (!force && cachedEnterpriseDashboard && now - cachedAt < CACHE_TTL_MS) {
    return cachedEnterpriseDashboard;
  }

  if (inFlightRequest) {
    return inFlightRequest;
  }

  inFlightRequest = fetchEnterpriseDashboard()
    .then((data) => {
      cachedEnterpriseDashboard = data;
      cachedAt = Date.now();
      return data;
    })
    .finally(() => {
      inFlightRequest = null;
    });

  return inFlightRequest;
}

export function clearEnterpriseDashboardCache() {
  cachedEnterpriseDashboard = null;
  cachedAt = 0;
}