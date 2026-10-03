"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { env } from "./env";
import type { Engagement, MakerRow, OutcomeMarket, Report, Stats, WatcherRow } from "./types";

export class NotFoundError extends Error {}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${env.indexerUrl}${path}`, { cache: "no-store" });
  if (response.status === 404) throw new NotFoundError(path);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json() as Promise<T>;
}

const live = { refetchInterval: 2_000, placeholderData: keepPreviousData } as const;

export const useStats = () => useQuery({ queryKey: ["stats"], queryFn: () => get<Stats>("/stats"), ...live });
export const useEngagements = () =>
  useQuery({ queryKey: ["engagements"], queryFn: () => get<Engagement[]>("/engagements"), ...live });
export const useReport = (id: string) =>
  useQuery({
    queryKey: ["report", id],
    queryFn: () => get<Report>(`/engagements/${id}`),
    ...live,
    retry: (count, error) => !(error instanceof NotFoundError) && count < 2,
  });
export const useMakers = () =>
  useQuery({ queryKey: ["makers"], queryFn: () => get<MakerRow[]>("/makers"), ...live });
export const useWatchers = () =>
  useQuery({ queryKey: ["watchers"], queryFn: () => get<WatcherRow[]>("/watchers"), ...live });
export const useOutcomes = () =>
  useQuery({ queryKey: ["outcomes"], queryFn: () => get<OutcomeMarket[]>("/outcomes"), ...live });

export interface Timeseries {
  bucket: number;
  fills: { time: number; value: number }[];
  quotes: { time: number; value: number }[];
  observations: { time: number; value: number }[];
  credited: { time: number; value: number }[];
  breaches: { time: number; value: number }[];
}

export const useTimeseries = (bucket: number) =>
  useQuery({
    queryKey: ["timeseries", bucket],
    queryFn: () => get<Timeseries>(`/timeseries?bucket=${bucket}`),
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  });
