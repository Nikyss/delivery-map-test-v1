import './styles/app.css';
import { DeliveryMap } from './components/DeliveryMap.js';
import { DriverSimulator } from './components/DriverSimulator.js';
import { renderSidebar } from './components/Sidebar.js';
import { fetchMeetingRoute, fetchRoute } from './services/routingService.js';
import { presetLocations } from './data/presetRoutes.js';
import { MEETING_MAX_DISTANCE_METERS } from './config/mapConfig.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="app-shell">
    <button class="sidebar-toggle" id="sidebar-toggle" type="button" aria-label="Fechar painel" aria-expanded="true">×</button>
    <div id="sidebar-root"></div>
    <main class="map-shell">
      <div id="map"></div>

      <div class="center-target" id="center-target" aria-hidden="true">
        <div class="target-arrow">⌄</div>
        <div class="target-dot"></div>
      </div>

      <div class="meeting-panel" id="meeting-panel">
        <div class="meeting-panel-title">Escolha o ponto de encontro</div>
        <div class="meeting-panel-text">
          Arraste o mapa até a seta ficar em cima da rua, portão ou esquina onde o motoboy deve parar.
        </div>
        <div class="meeting-panel-distance" id="meeting-distance">Distância do GPS: --</div>
        <button class="meeting-confirm" id="confirm-meeting">Selecionar este ponto</button>
        <button class="meeting-secondary" id="use-gps-as-meeting">Usar meu GPS exato</button>
      </div>

      <div class="map-hint" id="map-hint">Clique no mapa para marcar de onde sai o motoboy/restaurante.</div>

      <div class="location-loading" id="location-loading" aria-live="polite" aria-hidden="true">
        <div class="location-loading-card">
          <div class="location-spinner" aria-hidden="true"></div>
          <div class="location-loading-kicker">Localização</div>
          <div class="location-loading-title" id="location-loading-title">Aguarde, buscando seu endereço</div>
          <div class="location-loading-text" id="location-loading-text">Solicitando permissão do navegador...</div>
          <div class="location-loading-actions" id="location-loading-actions">
            <button class="location-retry" id="retry-location" type="button">Tentar novamente</button>
            <button class="location-cancel" id="cancel-location" type="button">Cancelar</button>
          </div>
        </div>
      </div>
    </main>
  </div>
`;

const sidebarRoot = document.querySelector('#sidebar-root');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const mapHint = document.querySelector('#map-hint');
const meetingPanel = document.querySelector('#meeting-panel');
const centerTarget = document.querySelector('#center-target');
const meetingDistanceEl = document.querySelector('#meeting-distance');
const confirmMeetingButton = document.querySelector('#confirm-meeting');
const useGpsAsMeetingButton = document.querySelector('#use-gps-as-meeting');
const locationLoading = document.querySelector('#location-loading');
const locationLoadingTitle = document.querySelector('#location-loading-title');
const locationLoadingText = document.querySelector('#location-loading-text');
const retryLocationButton = document.querySelector('#retry-location');
const cancelLocationButton = document.querySelector('#cancel-location');

const state = {
  step: 'select-driver-start',
  driverStart: null,
  userLocation: null,
  meetingPreview: null,
  meetingPoint: null,
  meetingDistance: null,
  route: null,
  status: 'Clique no mapa para marcar de onde sai o motoboy/restaurante.',
  statusType: 'normal',
};

let deliveryMap;
let simulator;
let meetingRouteTimer = null;
let userWatchId = null;
let sidebarCollapsed = false;
let meetingRouteRequestId = 0;
let locationLoadingTimer = null;
let locationLoadingMessageIndex = 0;


const locationLoadingMessages = [
  'Aguarde, buscando seu endereço...',
  'Verificando permissão de localização...',
  'Tentando obter a melhor precisão possível...',
  'Preparando o ponto A no mapa...',
];

function showLocationLoading(message = 'Aguarde, buscando seu endereço...', detail = 'Solicitando permissão do navegador...') {
  locationLoading.classList.remove('has-error');
  locationLoading.classList.add('is-visible');
  locationLoading.setAttribute('aria-hidden', 'false');
  locationLoadingTitle.textContent = message;
  locationLoadingText.textContent = detail;

  if (locationLoadingTimer) {
    window.clearInterval(locationLoadingTimer);
  }

  locationLoadingMessageIndex = 0;
  locationLoadingTimer = window.setInterval(() => {
    locationLoadingMessageIndex = (locationLoadingMessageIndex + 1) % locationLoadingMessages.length;
    locationLoadingTitle.textContent = locationLoadingMessages[locationLoadingMessageIndex];
  }, 1550);
}

function updateLocationLoading(message, detail) {
  locationLoadingTitle.textContent = message;
  if (detail) locationLoadingText.textContent = detail;
}

function showLocationLoadingError(message) {
  if (locationLoadingTimer) {
    window.clearInterval(locationLoadingTimer);
    locationLoadingTimer = null;
  }

  locationLoading.classList.add('is-visible', 'has-error');
  locationLoading.setAttribute('aria-hidden', 'false');
  locationLoadingTitle.textContent = 'Não consegui pegar sua localização';
  locationLoadingText.textContent = message;
}

function hideLocationLoading() {
  if (locationLoadingTimer) {
    window.clearInterval(locationLoadingTimer);
    locationLoadingTimer = null;
  }

  locationLoading.classList.remove('is-visible', 'has-error');
  locationLoading.setAttribute('aria-hidden', 'true');
}

function cancelLocationLoading() {
  hideLocationLoading();
  resetAll();
}

function setStatus(message, type = 'normal') {
  state.status = message;
  state.statusType = type;
  mapHint.textContent = message;
  render();
}

function setStep(step) {
  state.step = step;
  document.body.dataset.step = step;
  updateMeetingOverlay();
  render();
}

function getFinalDestination() {
  return state.meetingPoint || state.userLocation;
}

function getFinalDestinationName() {
  return state.meetingPoint ? 'ponto de encontro A+' : 'sua localização GPS';
}

function selectDriverStart(coordinates) {
  if (state.step !== 'select-driver-start') return;

  if (!deliveryMap.isInsideBrazil(coordinates)) {
    setStatus('Marque uma origem dentro do Brasil.', 'error');
    return;
  }

  state.driverStart = coordinates;
  state.route = null;
  state.userLocation = null;
  state.meetingPoint = null;
  state.meetingPreview = null;
  state.meetingDistance = null;

  deliveryMap.clearRoute();
  deliveryMap.clearMeetingLine();
  deliveryMap.setDriverStart(coordinates);
  deliveryMap.setMode('locked');

  setStep('getting-location');
  setStatus('Origem do motoboy marcada. Buscando sua localização...');
  showLocationLoading('Aguarde, buscando seu endereço...', 'Depois que o GPS for encontrado, vou aproximar no mapa e abrir a mira A+.');
  requestCurrentLocation();
}

function requestCurrentLocation() {
  if (!window.isSecureContext) {
    showLocationLoadingError('O Chrome bloqueou a localização porque esta página não está em HTTPS/localhost. Use GitHub Pages/Vercel ou rode em http://localhost:5173.');
    setStatus('Localização bloqueada: use HTTPS ou localhost.', 'error');
    return;
  }

  if (!navigator.geolocation) {
    showLocationLoadingError('Seu navegador não suporta geolocalização.');
    setStatus('Seu navegador não suporta geolocalização.', 'error');
    return;
  }

  showLocationLoading('Aguarde, buscando seu endereço...', 'Permita o acesso à localização quando o navegador solicitar.');

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const coordinates = [longitude, latitude];

      if (!deliveryMap.isInsideBrazil(coordinates)) {
        showLocationLoadingError('Sua localização parece estar fora do Brasil.');
        setStatus('Sua localização parece estar fora do Brasil.', 'error');
        return;
      }

      updateLocationLoading('Localização encontrada', 'Preparando o ponto A e a área de encontro...');

      state.userLocation = coordinates;
      state.meetingPoint = null;
      state.meetingPreview = coordinates;
      state.meetingDistance = 0;

      deliveryMap.setUserLocation(
        coordinates,
        {
          accuracy,
          heading: position.coords.heading,
        },
        { focus: false }
      );

      startUserLocationWatch();
      setStep('select-meeting-point');
      updateMeetingOverlay();

      updateLocationLoading('Ajustando o mapa no seu endereço', 'Vou abrir a mira A+ exatamente sobre sua localização para você escolher a rua/portão.');

      try {
        await deliveryMap.focusUserLocationForMeeting(coordinates);
      } catch (error) {
        console.warn('Falha ao aproximar no ponto A:', error);
      }

      hideLocationLoading();
      startMeetingSelection();
      setStatus(`Localização recebida com precisão aproximada de ${Math.round(accuracy)}m. Agora mova o mapa por baixo da mira A+.`);
    },
    (error) => {
      console.error(error);

      let message = 'Permita a localização no navegador e tente novamente.';
      if (error.code === error.PERMISSION_DENIED) {
        message = 'A permissão de localização foi negada. Libere nas configurações do navegador e tente novamente.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = 'O navegador não conseguiu determinar sua localização agora.';
      } else if (error.code === error.TIMEOUT) {
        message = 'A busca demorou demais. Tente novamente em alguns segundos.';
      }

      showLocationLoadingError(message);
      setStatus(message, 'error');
    },
    {
      enableHighAccuracy: true,
      timeout: 16000,
      maximumAge: 0,
    }
  );
}

function startUserLocationWatch() {
  if (!navigator.geolocation || userWatchId !== null) return;

  userWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy, heading } = position.coords;
      const coordinates = [longitude, latitude];

      if (!deliveryMap?.isInsideBrazil(coordinates)) return;

      state.userLocation = coordinates;
      deliveryMap.updateUserLocation(coordinates, { accuracy, heading });

      if (state.step === 'select-meeting-point') {
        deliveryMap.updateMeetingPreviewFromTargetDot();
      }

      render();
    },
    (error) => {
      console.warn('WatchPosition falhou:', error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 12000,
    }
  );
}

function stopUserLocationWatch() {
  if (userWatchId === null || !navigator.geolocation) return;
  navigator.geolocation.clearWatch(userWatchId);
  userWatchId = null;
}

function startMeetingSelection() {
  if (!state.userLocation) {
    setStatus('Ainda não tenho sua localização GPS.', 'error');
    return;
  }

  state.meetingPoint = null;
  state.meetingPreview = state.userLocation;
  state.meetingDistance = 0;

  setStep('select-meeting-point');
  deliveryMap.startMeetingPreview(state.userLocation);
  setStatus('Arraste o mapa por baixo da mira A+. A linha pontilhada usa a posição real do ponto preto da mira e deve ficar dentro do círculo azul.');
}

function updateMeetingPreview({ meetingPoint, distance }) {
  state.meetingPreview = meetingPoint;
  state.meetingDistance = distance;
  updateMeetingOverlay();
  scheduleMeetingRoutePreview(meetingPoint);
}

function scheduleMeetingRoutePreview(meetingPoint) {
  if (state.step !== 'select-meeting-point' || !state.userLocation || !meetingPoint) return;

  if (meetingRouteTimer) {
    window.clearTimeout(meetingRouteTimer);
  }

  const requestId = ++meetingRouteRequestId;

  // Durante o arraste, espera um pouquinho para não martelar a API.
  // Assim que o mapa para, a linha pontilhada é recalculada seguindo as ruas.
  meetingRouteTimer = window.setTimeout(async () => {
    try {
      const meetingRoute = await fetchMeetingRoute({
        from: state.userLocation,
        to: meetingPoint,
      });

      if (requestId !== meetingRouteRequestId || state.step !== 'select-meeting-point') return;
      deliveryMap.setMeetingLineGeometry(meetingRoute.geometry);
    } catch (error) {
      console.warn(error);
    }
  }, 420);
}

function updateMeetingOverlay() {
  const isMeetingStep = state.step === 'select-meeting-point';
  meetingPanel.classList.toggle('is-visible', isMeetingStep);
  centerTarget.classList.toggle('is-visible', isMeetingStep);

  if (!isMeetingStep) return;

  const distance = state.meetingDistance;
  const valid = Number.isFinite(distance) && distance <= MEETING_MAX_DISTANCE_METERS;
  const distanceText = Number.isFinite(distance) ? `${Math.round(distance)}m` : '--';

  meetingDistanceEl.textContent = `Distância do seu GPS: ${distanceText} / limite ${MEETING_MAX_DISTANCE_METERS}m`;
  meetingDistanceEl.classList.toggle('is-danger', !valid);
  confirmMeetingButton.disabled = !valid;
}

async function confirmMeetingPoint() {
  if (state.step !== 'select-meeting-point') return;

  if (!state.meetingPreview) {
    setStatus('Posicione o mapa no ponto de encontro primeiro.', 'error');
    return;
  }

  if (state.meetingDistance > MEETING_MAX_DISTANCE_METERS) {
    setStatus(`O ponto de encontro está longe demais do GPS. Deixe dentro de ${MEETING_MAX_DISTANCE_METERS}m.`, 'error');
    return;
  }

  state.meetingPoint = state.meetingPreview;

  if (meetingRouteTimer) {
    window.clearTimeout(meetingRouteTimer);
    meetingRouteTimer = null;
  }

  deliveryMap.stopMeetingPreview({ keepLine: true });
  deliveryMap.setMeetingPoint(state.meetingPoint);

  try {
    const meetingRoute = await fetchMeetingRoute({
      from: state.userLocation,
      to: state.meetingPoint,
    });
    deliveryMap.setMeetingLineGeometry(meetingRoute.geometry);
  } catch (error) {
    console.warn(error);
  }

  setStep('calculating-route');
  setStatus('Ponto de encontro definido. Calculando rota do motoboy até o A+...');

  await calculateRouteAndStartSimulation();
}

async function useGpsAsMeetingPoint() {
  if (!state.userLocation) {
    setStatus('Ainda não tenho sua localização GPS.', 'error');
    return;
  }

  state.meetingPoint = null;
  if (meetingRouteTimer) {
    window.clearTimeout(meetingRouteTimer);
    meetingRouteTimer = null;
  }
  meetingRouteRequestId += 1;
  deliveryMap.stopMeetingPreview({ keepLine: false });
  deliveryMap.clearMeetingLine();

  setStep('calculating-route');
  setStatus('Usando seu GPS exato como destino. Calculando rota...');

  await calculateRouteAndStartSimulation();
}

async function calculateRouteAndStartSimulation() {
  const destination = getFinalDestination();

  if (!state.driverStart || !destination) {
    setStatus('Falta origem do motoboy ou destino final.', 'error');
    return;
  }

  try {
    state.route = null;
    deliveryMap.clearRoute();
    deliveryMap.setDriverMarker(state.driverStart);

    const route = await fetchRoute({
      from: state.driverStart,
      to: destination,
    });

    state.route = route;
    deliveryMap.setRoute(route);

    setStep('driving');
    setStatus(`Rota calculada até ${getFinalDestinationName()}. Motoboy a caminho...`, 'success');
    simulator.start(route.coordinates);
  } catch (error) {
    console.error(error);
    setStep('select-driver-start');
    deliveryMap.setMode('select-driver-start');
    setStatus(error.message, 'error');
  }
}

function useDemoFlow() {
  state.driverStart = presetLocations.joaoPessoaDriver.coordinates;
  state.userLocation = presetLocations.joaoPessoaUser.coordinates;
  state.meetingPoint = null;
  state.meetingPreview = state.userLocation;
  state.meetingDistance = 0;
  state.route = null;

  simulator.stop(false);
  deliveryMap.reset();
  deliveryMap.setDriverStart(state.driverStart);
  deliveryMap.setUserLocation(state.userLocation);
  deliveryMap.setMode('locked');

  setStep('getting-location');
  setStatus('Exemplo carregado. Vou aproximar na sua localização para escolher o ponto de encontro.');

  window.setTimeout(() => {
    startMeetingSelection();
  }, 1100);
}

function requestLocationAgain() {
  if (!state.driverStart) {
    setStatus('Primeiro clique no mapa para marcar a origem do motoboy/restaurante.', 'error');
    return;
  }

  setStep('getting-location');
  setStatus('Solicitando localização novamente...');
  showLocationLoading('Aguarde, buscando seu endereço...', 'Tentando pegar sua localização novamente.');
  requestCurrentLocation();
}

function simulateDriverAgain() {
  if (!state.route?.coordinates?.length) {
    setStatus('Ainda não existe uma rota calculada.', 'error');
    return;
  }

  deliveryMap.setDriverMarker(state.driverStart);
  simulator.start(state.route.coordinates);
}

function stopSimulation() {
  simulator.stop(true);
}

function resetAll() {
  simulator.stop(false);
  stopUserLocationWatch();
  if (meetingRouteTimer) {
    window.clearTimeout(meetingRouteTimer);
    meetingRouteTimer = null;
  }
  meetingRouteRequestId += 1;
  state.step = 'select-driver-start';
  state.driverStart = null;
  state.userLocation = null;
  state.meetingPreview = null;
  state.meetingPoint = null;
  state.meetingDistance = null;
  state.route = null;
  deliveryMap.reset();
  setStep('select-driver-start');
  setStatus('Tudo limpo. Clique no mapa para marcar de onde sai o motoboy/restaurante.');
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  document.body.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  sidebarToggle.textContent = sidebarCollapsed ? '☰' : '×';
  sidebarToggle.setAttribute('aria-label', sidebarCollapsed ? 'Abrir painel' : 'Fechar painel');
  sidebarToggle.setAttribute('aria-expanded', String(!sidebarCollapsed));

  window.setTimeout(() => deliveryMap?.resizeSoon(), 230);
}

function render() {
  renderSidebar(sidebarRoot, state, {
    useDemoFlow,
    requestLocationAgain,
    simulateDriverAgain,
    stopSimulation,
    resetAll,
  });
}

sidebarToggle.addEventListener('click', toggleSidebar);
confirmMeetingButton.addEventListener('click', confirmMeetingPoint);
useGpsAsMeetingButton.addEventListener('click', useGpsAsMeetingPoint);
retryLocationButton.addEventListener('click', requestLocationAgain);
cancelLocationButton.addEventListener('click', cancelLocationLoading);

render();
setStep('select-driver-start');

deliveryMap = new DeliveryMap({
  container: 'map',
  onSelectDriverStart: selectDriverStart,
  onMeetingPreviewChange: updateMeetingPreview,
  onMapReady: () => setStatus('Mapa pronto. Clique no mapa para marcar de onde sai o motoboy/restaurante.'),
  onStatus: setStatus,
});

deliveryMap.init();

simulator = new DriverSimulator({
  onTick: ({ current, bearing, remaining }) => {
    deliveryMap.updateDriverPosition({ coordinates: current, bearing, remaining });
  },
  onFinish: () => {
    setStep('arrived');
    setStatus(`Motoboy chegou ao ${getFinalDestinationName()}.`, 'success');
  },
  onStatus: setStatus,
});
