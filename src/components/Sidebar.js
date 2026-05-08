import { formatLngLat, formatKm, formatMinutes } from '../utils/formatters.js';

const stepLabels = {
  'select-driver-start': '1/4 — Marque a origem do motoboy/restaurante',
  'getting-location': '2/4 — Pegando sua localização automaticamente',
  'select-meeting-point': '3/4 — Ajuste o ponto de encontro com a mira fixa',
  'calculating-route': '4/4 — Calculando rota',
  driving: 'Motoboy a caminho',
  arrived: 'Motoboy chegou',
};

export function renderSidebar(root, state, actions) {
  const currentStep = stepLabels[state.step] || 'Tracking';
  const targetLabel = state.meetingPoint ? 'Ponto A+ / encontro na rua' : 'Ponto A / GPS real';
  const pauseLabel = state.driverPaused ? 'Continuar simulação' : 'Pausar simulação';
  const dragLabel = state.driverDragMode ? 'Desativar arrastar moto' : 'Ativar arrastar moto';
  const routeReady = Boolean(state.route?.coordinates?.length);
  const deviationText = Number.isFinite(state.driverDeviationMeters)
    ? `${Math.round(state.driverDeviationMeters)}m da rota`
    : 'Ainda não testado';

  root.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-icon">🛵</div>
        <div>
          <h1>Tracking Delivery</h1>
          <p class="subtitle">Fluxo profissional: motoboy → GPS → ponto de encontro.</p>
        </div>
      </div>

      <div class="mobile-step-chip">${currentStep}</div>

      <section class="card flow-card">
        <div class="card-title">Fluxo correto</div>
        <div class="flow-step ${state.step === 'select-driver-start' ? 'is-active' : ''}">
          <strong>1</strong>
          <span>Você marca no mapa a origem do motoboy/restaurante.</span>
        </div>
        <div class="flow-step ${state.step === 'getting-location' ? 'is-active' : ''}">
          <strong>2</strong>
          <span>O navegador pede sua localização automaticamente.</span>
        </div>
        <div class="flow-step ${state.step === 'select-meeting-point' ? 'is-active' : ''}">
          <strong>3</strong>
          <span>Você move o mapa sob a mira fixa e confirma o ponto de encontro.</span>
        </div>
        <div class="flow-step ${state.step === 'driving' || state.step === 'arrived' ? 'is-active' : ''}">
          <strong>4</strong>
          <span>A moto sai do ponto B e vai até o A+.</span>
        </div>
      </section>

      <section class="card">
        <div class="card-title">Ações</div>
        <button id="demo-flow" class="primary-btn">Usar exemplo completo em João Pessoa</button>
        <button id="simulate-again" class="secondary-btn">Simular novamente</button>
        <button id="stop-driver" class="ghost-btn">Parar simulação</button>
        <button id="reset-map" class="ghost-btn">Limpar tudo</button>
        <div class="tip">
          Localização real só funciona em <strong>HTTPS</strong> ou <strong>localhost</strong>. IP local tipo <strong>192.168.x.x</strong> costuma ser bloqueado pelo Chrome.
        </div>
      </section>

      <section class="card dev-test-card">
        <div class="dev-test-kicker">🧪 Teste temporário</div>
        <div class="card-title">Simular desvio do motoboy</div>
        <p class="dev-test-text">
          Ferramentas apenas para teste. Use para validar pausa, desvio e recálculo antes de integrar motoboy real.
        </p>
        <button id="toggle-pause-driver" class="secondary-btn" ${routeReady ? '' : 'disabled'}>${pauseLabel}</button>
        <button id="toggle-drag-driver" class="ghost-btn ${state.driverDragMode ? 'is-active' : ''}" ${routeReady ? '' : 'disabled'}>${dragLabel}</button>
        <div class="dev-test-status ${state.driverDragMode ? 'is-active' : ''}">
          <span>Desvio:</span>
          <strong>${state.isRecalculatingDeviation ? 'Recalculando rota...' : deviationText}</strong>
        </div>
      </section>

      <section class="card">
        <div class="card-title">Pontos da entrega</div>
        <div class="info-box ${state.driverStart ? 'is-filled' : ''}">
          <span>Ponto B / origem do motoboy</span>
          <strong>${formatLngLat(state.driverStart)}</strong>
        </div>
        <div class="info-box ${state.userLocation ? 'is-filled' : ''}">
          <span>Ponto A / sua localização GPS</span>
          <strong>${formatLngLat(state.userLocation)}</strong>
        </div>
        <div class="info-box ${state.meetingPoint ? 'active-info' : ''}">
          <span>Ponto A+ / encontro na rua</span>
          <strong>${formatLngLat(state.meetingPoint)}</strong>
        </div>
      </section>

      <section class="card">
        <div class="card-title">Entrega</div>
        <div class="target-label">Destino atual da moto: <strong>${targetLabel}</strong></div>
        <div class="metrics">
          <div>
            <span>Distância</span>
            <strong>${formatKm(state.route?.distance)}</strong>
          </div>
          <div>
            <span>Previsão</span>
            <strong>${formatMinutes(state.route?.duration)}</strong>
          </div>
        </div>
      </section>

      <section class="card status-card">
        <div class="card-title">Status</div>
        <div class="status ${state.statusType || ''}">${state.status}</div>
      </section>
    </aside>
  `;

  root.querySelector('#demo-flow').addEventListener('click', actions.useDemoFlow);
  root.querySelector('#simulate-again').addEventListener('click', actions.simulateDriverAgain);
  root.querySelector('#stop-driver').addEventListener('click', actions.stopSimulation);
  root.querySelector('#toggle-pause-driver').addEventListener('click', actions.toggleSimulationPause);
  root.querySelector('#toggle-drag-driver').addEventListener('click', actions.toggleDriverDragMode);
  root.querySelector('#reset-map').addEventListener('click', actions.resetAll);
}
