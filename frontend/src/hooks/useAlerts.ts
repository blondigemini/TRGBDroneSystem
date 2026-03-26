import { useQuery } from "@tanstack/react-query";
import { fetchAlertStats } from "../api/alerts";

export function useAlertStats() {
  return useQuery({
    queryKey: ["alertStats"],
    queryFn: fetchAlertStats,
    refetchInterval: 5000,
  });
}
