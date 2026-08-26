import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateComfortIndex } from '../src/utils/comfort-index.js';

test('comfortable mild weather scores highly', () => {
  assert.ok(calculateComfortIndex({ temperatureC: 22, humidity: 50, windSpeed: 2, visibility: 10000 }) >= 95);
});

test('scores always remain between 0 and 100', () => {
  assert.equal(calculateComfortIndex({ temperatureC: -50, humidity: 200, windSpeed: 80, visibility: -1 }), 0);
});
