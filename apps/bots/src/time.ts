export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function jitter(min: number, max: number) {
  return min + Math.random() * (max - min);
}
