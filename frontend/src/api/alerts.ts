import client from "./client";
import type { Alert, AlertStats } from "../types/alert";

export async function fetchAlerts(severity?: string): Promise<Alert[]> {
  const params = severity ? { severity } : {};
  const { data } = await client.get<Alert[]>("/alerts", { params });
  return data;
}

export async function acknowledgeAlert(id: string): Promise<Alert> {
  const { data } = await client.post<Alert>(`/alerts/${id}/acknowledge`);
  return data;
}

export async function fetchAlertStats(): Promise<AlertStats> {
  const { data } = await client.get<AlertStats>("/alerts/stats");
  return data;
}
