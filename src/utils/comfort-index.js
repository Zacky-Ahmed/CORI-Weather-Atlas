const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/**
 * City Outdoor Readiness Index (CORI)
 *
 * CORI estimates how pleasant and practical a normal 30-minute outdoor walk is
 * right now. It is a decision-support metric, not a medical heat-stress model.
 */
export function calculateDewPoint(temperatureC, humidity) {
  const safeHumidity = clamp(humidity, 1, 100);
  const gamma = Math.log(safeHumidity / 100) + (17.27 * temperatureC) / (237.7 + temperatureC);
  return (237.7 * gamma) / (17.27 - gamma);
}

function conditionScore(conditionCode) {
  const group = Math.floor((conditionCode ?? 800) / 100);
  if (group === 2) return { score: 0.15, label: 'thunderstorm' };
  if (group === 6) return { score: 0.40, label: 'snow' };
  if (group === 5) return { score: 0.58, label: 'rain' };
  if (group === 3) return { score: 0.72, label: 'drizzle' };
  if (group === 7) return { score: 0.38, label: 'reduced air clarity' };
  if (group === 8 && conditionCode !== 800) return { score: 0.93, label: 'cloud cover' };
  return { score: 1, label: 'settled conditions' };
}

function buildExplanation({ humidityHeatPenalty, coldWindPenalty, hotBreezeRelief, visibility, condition, safetyCap }) {
  const factors = [];
  if (safetyCap?.reason === 'thunderstorm') factors.push('active thunderstorms impose a safety cap');
  else if (safetyCap?.reason === 'very low visibility') factors.push('very low visibility imposes a safety cap');
  else if (safetyCap?.reason === 'high thermal strain') factors.push('high thermal strain imposes a safety cap');
  else if (safetyCap?.reason === 'cold exposure') factors.push('cold exposure imposes a safety cap');

  if (humidityHeatPenalty >= 2) factors.push('humid air is amplifying the heat');
  else if (hotBreezeRelief >= 1) factors.push('a breeze is easing the warmth');
  else if (coldWindPenalty >= 2) factors.push('wind is intensifying the cold');
  else factors.push('thermal conditions are relatively balanced');

  if (!safetyCap && visibility < 3000) factors.push('low visibility limits outdoor usability');
  else if (visibility >= 8000) factors.push('clear visibility supports outdoor plans');

  if (!safetyCap && condition.label === 'thunderstorm') factors.push('active thunderstorms impose a safety cap');
  else if (!['settled conditions', 'cloud cover'].includes(condition.label)) factors.push(`${condition.label} adds weather friction`);

  return factors.slice(0, 2).join(' · ');
}

/**
 * @param {object} weather
 * @param {number} weather.temperatureC
 * @param {number} weather.humidity Relative humidity as a percentage.
 * @param {number} weather.windSpeed Metres per second.
 * @param {number} weather.visibility Metres.
 * @param {number} [weather.conditionCode] OpenWeatherMap weather condition ID.
 */
export function calculateComfortIndex({ temperatureC, humidity, windSpeed, visibility, conditionCode }) {
  const safeWind = Math.max(0, windSpeed ?? 0);
  const safeVisibility = Math.max(0, visibility ?? 0);
  const dewPointC = calculateDewPoint(temperatureC, humidity);

  // Moist air hinders cooling only when the air is already warm.
  const humidityHeatPenalty = Math.max(0, temperatureC - 20) * Math.max(0, dewPointC - 12) * 0.06;
  // The same wind behaves differently in cold air: it increases body heat loss.
  const coldWindPenalty = Math.max(0, 16 - temperatureC) * Math.log1p(safeWind) * 0.45;
  // In warmer conditions a moderate breeze is useful, but the benefit is capped.
  const hotBreezeRelief = temperatureC > 26 ? Math.min(safeWind, 4) * 1.1 : 0;
  const effectiveTemperatureC = temperatureC + humidityHeatPenalty - coldWindPenalty - hotBreezeRelief;

  // 18-25°C remains a strong comfort zone, with a gentle curve so similarly
  // pleasant cities can still be meaningfully compared instead of always tying.
  const thermalDistance = Math.abs(effectiveTemperatureC - 21.5);
  const thermalScore = Math.exp(-((thermalDistance / 11) ** 2));
  // Visibility is useful on a curve: the difference between 0.5 and 3 km matters
  // more to a walker than the difference between 9 and 10 km.
  const clarityScore = 0.15 + 0.85 * Math.sqrt(clamp((safeVisibility / 1000 - 0.5) / 9.5));
  const condition = conditionScore(conditionCode);

  // Geometric blending prevents a weak dimension from being hidden by a strong one.
  const rawScore = 100 * (thermalScore ** 0.60) * (clarityScore ** 0.15) * (condition.score ** 0.25);
  const caps = [];
  if (condition.label === 'thunderstorm') caps.push({ value: 35, reason: 'thunderstorm' });
  if (safeVisibility < 1000) caps.push({ value: 45, reason: 'very low visibility' });
  if (effectiveTemperatureC >= 38) caps.push({ value: 45, reason: 'high thermal strain' });
  if (effectiveTemperatureC <= 0) caps.push({ value: 45, reason: 'cold exposure' });
  const activeCap = caps.sort((a, b) => a.value - b.value)[0];
  const score = Math.round(clamp(activeCap ? Math.min(rawScore, activeCap.value) : rawScore, 0, 100));

  return {
    score,
    dewPointC: Number(dewPointC.toFixed(1)),
    effectiveTemperatureC: Number(effectiveTemperatureC.toFixed(1)),
    thermalScore: Number((thermalScore * 100).toFixed(1)),
    clarityScore: Number((clarityScore * 100).toFixed(1)),
    conditionScore: Number((condition.score * 100).toFixed(1)),
    safetyCap: activeCap ?? null,
    explanation: buildExplanation({ humidityHeatPenalty, coldWindPenalty, hotBreezeRelief, visibility: safeVisibility, condition, safetyCap: activeCap })
  };
}
