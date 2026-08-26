/**
 * Scores current outdoor comfort from 0 (least comfortable) to 100 (most).
 * Temperature is deliberately weighted most heavily; humidity, wind and
 * visibility modify how that temperature feels in practice.
 */
export function calculateComfortIndex({ temperatureC, humidity, windSpeed, visibility }) {
  const temperatureScore = Math.max(0, 1 - Math.abs(temperatureC - 22) / 22) * 45;
  const humidityScore = Math.max(0, 1 - Math.abs(humidity - 50) / 50) * 25;
  const windScore = Math.max(0, 1 - Math.max(0, windSpeed - 2) / 12) * 15;
  const visibilityScore = Math.min(Math.max(visibility, 0), 10000) / 10000 * 15;
  return Math.round(Math.min(100, Math.max(0, temperatureScore + humidityScore + windScore + visibilityScore)));
}
