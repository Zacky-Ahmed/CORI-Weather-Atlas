import axios from 'axios';
import { readFile } from 'node:fs/promises';
import { cached } from './cache.js';
import { calculateComfortIndex } from '../utils/comfort-index.js';

const endpoint = 'https://api.openweathermap.org/data/2.5/weather';

const demoCities = [
  ['Lisbon', 'clear sky', 24, 48, 2.1, 10000], ['Paris', 'few clouds', 21, 55, 2.6, 10000],
  ['Sydney', 'scattered clouds', 25, 59, 3.5, 10000], ['Colombo', 'broken clouds', 30, 76, 2.4, 9000],
  ['Tokyo', 'light rain', 18, 80, 3.1, 7000], ['London', 'mist', 13, 88, 2.7, 2800],
  ['Oslo', 'overcast clouds', 7, 73, 5.5, 9000], ['Boston', 'moderate rain', 9, 84, 6.2, 4500],
  ['Singapore', 'thunderstorm', 29, 82, 4.0, 3000], ['Shanghai', 'haze', 17, 67, 1.9, 1800]
];

export async function loadCityCodes() {
  const raw = JSON.parse(await readFile(new URL('../../cities.json', import.meta.url)));
  const cities = raw.List ?? raw.CityList;
  if (!Array.isArray(cities)) throw new Error('cities.json must contain a List array of city objects.');
  return cities.map((city) => city.CityCode);
}

async function getRawWeather(cityId) {
  return cached(`weather:${cityId}`, async () => {
    const { data } = await axios.get(endpoint, { params: { id: cityId, appid: process.env.OPENWEATHER_API_KEY, units: 'metric' }, timeout: 10000 });
    return data;
  });
}

function toInsight(data) {
  const temperatureC = data.main.temp;
  const humidity = data.main.humidity;
  const windSpeed = data.wind?.speed ?? 0;
  const visibility = data.visibility ?? 0;
  const cori = calculateComfortIndex({
    temperatureC,
    humidity,
    windSpeed,
    visibility,
    conditionCode: data.weather?.[0]?.id
  });
  return {
    city: data.name,
    description: data.weather?.[0]?.description ?? 'Unknown',
    icon: data.weather?.[0]?.icon,
    temperatureC,
    humidity,
    windSpeed,
    visibility,
    comfortScore: cori.score,
    cori
  };
}

export async function getRankings() {
  if (!process.env.OPENWEATHER_API_KEY || process.env.OPENWEATHER_API_KEY === 'replace_with_your_key') {
    if (process.env.DEMO_MODE !== 'false') {
      return demoCities.map(([city, description, temperatureC, humidity, windSpeed, visibility]) => {
        const cori = calculateComfortIndex({ temperatureC, humidity, windSpeed, visibility });
        return { city, description, temperatureC, humidity, windSpeed, visibility, comfortScore: cori.score, cori };
      })
        .sort((a, b) => b.comfortScore - a.comfortScore).map((city, index) => ({ ...city, rank: index + 1, demo: true }));
    }
    throw new Error('OPENWEATHER_API_KEY is not configured. Copy .env.example to .env and add your key.');
  }
  const cityCodes = await loadCityCodes();
  const results = await Promise.all(cityCodes.map(getRawWeather));
  return results.map(toInsight).sort((a, b) => b.comfortScore - a.comfortScore).map((city, index) => ({ ...city, rank: index + 1 }));
}
