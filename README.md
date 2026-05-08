# Delivery Map Test V1 — 3D + Rota A+ corrigida

Projeto Vite + MapLibre para testar fluxo de tracking de delivery.

## O que esta versão corrige

- Mantém a câmera limitada ao Brasil.
- Usa mapa vetorial `OpenFreeMap Bright` por padrão, sem chave de API.
- Ativa prédios/contornos 3D em zoom alto, estilo app moderno.
- Corrige o pontilhado do ponto A até o A+: agora ele tenta seguir ruas via OSRM em vez de ficar uma linha reta.
- Mantém a rota pontilhada do A ao A+ na tela mesmo depois da rota principal ser calculada.
- Corrige a simulação para a moto chegar exatamente no destino final A+.
- Reduz o bug de sumir tudo no zoom limitando zoom máximo prático e usando mapa vetorial.

## Fluxo

1. Clique no mapa para marcar a origem do motoboy/restaurante, ponto B.
2. O navegador pede sua localização automaticamente.
3. Ao aceitar, o mapa aproxima na sua localização real, ponto A.
4. Mova o mapa por baixo da mira fixa A+.
5. A linha pontilhada mostra o caminho do seu GPS até o ponto de encontro.
6. Clique em “Selecionar este ponto”.
7. O motoboy sai do ponto B e vai até o A+.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra:

```txt
http://localhost:5173
```

Localização real funciona em `localhost` ou HTTPS. O Chrome costuma bloquear em IP de rede local como `http://192.168.x.x:5173`.

## Testar em HTTPS local

```bash
npm run dev:https
```

O navegador pode mostrar aviso de certificado local. Aceite apenas para teste.

## GitHub Pages

O projeto já tem `vite.config.js` com base `/delivery-map-test-v1/` quando `GITHUB_PAGES=true` e workflow em `.github/workflows/deploy.yml`.


## Versão MapTiler corrigida

Esta versão usa o style JSON customizado do MapTiler:

`https://api.maptiler.com/maps/019e06bc-77fc-7e5a-abff-5266a7bb1749/style.json?key=JQTuzz1KSBoO6671nQor`

O objetivo é evitar o bug das ruas/tiles sumindo no zoom que acontecia com mapas gratuitos instáveis e manter o mapa vetorial com prédios/contornos 3D em zoom alto.

Atenção: em produção, restrinja a chave do MapTiler por domínio no painel do MapTiler.
