import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMissions,
  createMission,
  startMission,
  stopMission,
} from "../api/missions";
import type { MissionCreate } from "../types/mission";

export function useMissions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["missions"],
    queryFn: fetchMissions,
    refetchInterval: 5000,
  });

  const createMut = useMutation({
    mutationFn: (data: MissionCreate) => createMission(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["missions"] }),
  });

  const startMut = useMutation({
    mutationFn: (id: string) => startMission(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["missions"] }),
  });

  const stopMut = useMutation({
    mutationFn: (id: string) => stopMission(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["missions"] }),
  });

  return {
    missions: query.data ?? [],
    isLoading: query.isLoading,
    create: createMut.mutate,
    start: startMut.mutate,
    stop: stopMut.mutate,
  };
}
