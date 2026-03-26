import client from "./client";
import type { Mission, MissionCreate } from "../types/mission";

export async function fetchMissions(): Promise<Mission[]> {
  const { data } = await client.get<Mission[]>("/missions");
  return data;
}

export async function createMission(payload: MissionCreate): Promise<Mission> {
  const { data } = await client.post<Mission>("/missions", payload);
  return data;
}

export async function startMission(id: string): Promise<Mission> {
  const { data } = await client.post<Mission>(`/missions/${id}/start`);
  return data;
}

export async function stopMission(id: string): Promise<Mission> {
  const { data } = await client.post<Mission>(`/missions/${id}/stop`);
  return data;
}
