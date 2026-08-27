import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateComfortIndex, calculateDewPoint } from '../src/utils/comfort-index.js';
import { getRankingsForCities } from '../src/services/weather.js';

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

test('a failed city request does not prevent the available cities from ranking', async () => {
  const reports = {
    one: { name: 'One', main: { temp: 22, humidity: 50 }, wind: { speed: 2 }, visibility: 10000, weather: [{ id: 800, description: 'clear sky' }] },
    three: { name: 'Three', main: { temp: 12, humidity: 80 }, wind: { speed: 5 }, visibility: 5000, weather: [{ id: 500, description: 'rain' }] }
  };
  const result = await getRankingsForCities(['one', 'two', 'three'], async (cityId) => {
    if (cityId === 'two') throw new Error('upstream timeout');
    return reports[cityId];
  });
  assert.deepEqual(result.unavailableCityIds, ['two']);
  assert.equal(result.rankings.length, 2);
  assert.deepEqual(result.rankings.map((city) => city.rank), [1, 2]);
  assert.equal(result.rankings[0].city, 'One');
});

test('all unavailable city reports return a clear retryable error', async () => {
  await assert.rejects(
    getRankingsForCities(['one'], async () => { throw new Error('upstream timeout'); }),
    /temporarily unavailable for every configured city/
  );
});
