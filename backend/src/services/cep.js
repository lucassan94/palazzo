// Serviço de busca de CEP com fallback entre APIs

export async function buscarCEP(cep) {
  const cepLimpo = cep.replace(/\D/g, '');

  if (cepLimpo.length !== 8) {
    throw new Error('CEP inválido. Use 8 dígitos.');
  }

  // Tentativa 1: BrasilAPI (mais confiável)
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`);
    if (response.ok) {
      const data = await response.json();
      return {
        cep: data.cep,
        logradouro: data.street,
        bairro: data.neighborhood,
        cidade: data.city,
        estado: data.state,
        latitude: data.location?.coordinates?.latitude || null,
        longitude: data.location?.coordinates?.longitude || null,
        origem: 'brasilapi',
      };
    }
  } catch {
    console.warn('[CEP] BrasilAPI falhou, tentando ViaCEP...');
  }

  // Tentativa 2: ViaCEP (fallback)
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    if (response.ok) {
      const data = await response.json();
      if (data.erro) {
        throw new Error('CEP não encontrado.');
      }
      return {
        cep: data.cep,
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        estado: data.uf,
        latitude: null,
        longitude: null,
        origem: 'viacep',
      };
    }
  } catch {
    console.warn('[CEP] ViaCEP falhou.');
  }

  throw new Error('Não foi possível consultar o CEP. Verifique o número e tente novamente.');
}
