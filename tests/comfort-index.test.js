import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateComfortIndex, calculateDewPoint } from '../src/utils/comfort-index.js';

const settledWalk = { temperatureC: 22, humidity: 50, windSpeed: 2, visibility: 10000, conditionCode: 800 };

test('CORI gives ideal walking conditions a high score', () => {
  const result = calculateComfortIndex(settledWalk);
  assert.equal(result.score, 100);
  assert.equal(result.safetyCap, null);
  assert.match(result.explanation, /thermal conditions/);
});

test('dew point distinguishes humid heat from the same temperature in dry air', () => {
  const dry = calculateComfortIndex({ ...settledWalk, temperatureC: 30, humidity: 40 });
  const humid = calculateComfortIndex({ ...settledWalk, temperatureC: 30, humidity: 80 });
  assert.ok(calculateDewPoint(30, 80) > calculateDewPoint(30, 40));
  assert.ok(humid.effectiveTemperatureC > dry.effectiveTemperatureC);
  assert.ok(humid.score < dry.score);
});

test('wind helps in heat but intensifies cold exposure', () => {
  const warmStill = calculateComfortIndex({ ...settledWalk, temperatureC: 30, humidity: 45, windSpeed: 0 });
  const warmBreeze = calculateComfortIndex({ ...settledWalk, temperatureC: 30, humidity: 45, windSpeed: 3 });
  const coldStill = calculateComfortIndex({ ...settledWalk, temperatureC: 8, humidity: 55, windSpeed: 0 });
  const coldWind = calculateComfortIndex({ ...settledWalk, temperatureC: 8, humidity: 55, windSpeed: 6 });
  assert.ok(warmBreeze.score > warmStill.score);
  assert.ok(coldWind.score < coldStill.score);
});

test('a thunderstorm receives a safety cap even with ideal temperature', () => {
  const result = calculateComfortIndex({ ...settledWalk, conditionCode: 200 });
  assert.equal(result.score, 35);
  assert.deepEqual(result.safetyCap, { value: 35, reason: 'thunderstorm' });
});

test('very low visibility receives a safety cap', () => {
  const result = calculateComfortIndex({ ...settledWalk, visibility: 500, conditionCode: 741 });
  assert.equal(result.score, 45);
  assert.deepEqual(result.safetyCap, { value: 45, reason: 'very low visibility' });
});

test('CORI always remains between 0 and 100', () => {
  const result = calculateComfortIndex({ temperatureC: -50, humidity: 200, windSpeed: 80, visibility: -1, conditionCode: 200 });
  assert.ok(result.score >= 0 && result.score <= 100);
});
