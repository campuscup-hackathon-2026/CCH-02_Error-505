import { api } from './api';

export async function getSecurityCenterState() {
  const { data } = await api.get('/security-center/state');
  return data;
}

export async function getSecurityCenterOverview() {
  const { data } = await api.get('/security-center/overview');
  return data;
}

export async function initiateLockdown() {
  const { data } = await api.post('/security-center/lockdown/initiate');
  return data;
}

export async function releaseLockdown() {
  const { data } = await api.post('/security-center/lockdown/release');
  return data;
}

export async function setSecurityMode(mode) {
  const { data } = await api.post('/security-center/mode', { mode });
  return data;
}

export async function predictThreat(telemetry) {
  const { data } = await api.post('/security-center/predict', telemetry);
  return data;
}

export async function getRecommendations(telemetry) {
  const { data } = await api.post('/security-center/recommendations', telemetry);
  return data;
}
