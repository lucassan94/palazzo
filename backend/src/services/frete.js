import { query } from '../config/database.js';
import { config } from '../config/index.js';

// Fórmula de Haversine para calcular distância entre coordenadas
export function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Buscar dados do restaurante para cálculo de distância
export async function getRestaurantCoords() {
  const result = await query(
    'SELECT latitude, longitude, tempo_preparo_min FROM restaurantes WHERE id = $1',
    [config.restaurantId]
  );
  return result.rows[0] || null;
}

// Calcular frete baseado na distância e matriz de raios
export async function calcularFrete(latitudeCliente, longitudeCliente) {
  const restaurante = await getRestaurantCoords();

  if (!restaurante || !restaurante.latitude || !restaurante.longitude) {
    // Fallback: frete fixo se não houver coordenadas
    const result = await query(
      'SELECT raio_km, tempo_min, tempo_max, custo FROM raios_entrega WHERE restaurant_id = $1 ORDER BY raio_km ASC LIMIT 1',
      [config.restaurantId]
    );
    const faixa = result.rows[0] || { raio_km: 1, tempo_min: 15, tempo_max: 25, custo: 5.00 };
    return {
      distancia_km: null,
      faixa_raio: faixa.raio_km,
      tempo_min: faixa.tempo_min,
      tempo_max: faixa.tempo_max,
      custo: parseFloat(faixa.custo),
      tempo_preparo: restaurante?.tempo_preparo_min || 20,
    };
  }

  const distancia = calcularDistancia(
    parseFloat(restaurante.latitude),
    parseFloat(restaurante.longitude),
    latitudeCliente,
    longitudeCliente
  );

  // Buscar faixa de raio adequada
  const result = await query(
    `SELECT raio_km, tempo_min, tempo_max, custo
     FROM raios_entrega
     WHERE restaurant_id = $1 AND raio_km >= $2
     ORDER BY raio_km ASC
     LIMIT 1`,
    [config.restaurantId, Math.ceil(distancia)]
  );

  const faixa = result.rows[0];

  if (!faixa) {
    throw new Error('Desculpe, não entregamos na sua região.');
  }

  return {
    distancia_km: Math.round(distancia * 100) / 100,
    faixa_raio: faixa.raio_km,
    tempo_min: faixa.tempo_min,
    tempo_max: faixa.tempo_max,
    custo: parseFloat(faixa.custo),
    tempo_preparo: restaurante?.tempo_preparo_min || 20,
  };
}
