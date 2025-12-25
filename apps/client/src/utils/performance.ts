import { onCLS, onLCP, onFCP, onTTFB, onINP, Metric } from "web-vitals";

function logMetric(metric: Metric) {
  const { name, value, rating } = metric;

  console.log(`[Performance] ${name}:`, {
    value: Math.round(value),
    rating,
    timestamp: new Date().toISOString(),
  });
}

export function initPerformanceMonitoring() {
  onCLS(logMetric);
  onLCP(logMetric);
  onFCP(logMetric);
  onTTFB(logMetric);
  onINP(logMetric);

  console.log("[Performance] Web Vitals monitoring initialized");
}

export function measureRenderTime(componentName: string, phase: string, actualDuration: number) {
  if (actualDuration > 16) {
    console.warn(
      `[Performance] ${componentName} took ${actualDuration.toFixed(2)}ms in ${phase} phase`
    );
  }
}
