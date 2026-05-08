import { haversineDistanceMeters } from '../utils/formatters.js';

export class DriverSimulator {
  constructor({ onTick, onFinish, onStatus }) {
    this.onTick = onTick;
    this.onFinish = onFinish;
    this.onStatus = onStatus;
    this.timer = null;
    this.index = 0;
    this.coordinates = [];
    this.finishTimer = null;
    this.paused = false;
  }

  start(coordinates) {
    this.stop(false);

    if (!coordinates || coordinates.length < 2) {
      this.onStatus?.('Calcule uma rota antes de simular.', 'error');
      return;
    }

    this.coordinates = coordinates;
    this.index = 0;
    this.paused = false;
    this.onStatus?.('Motoboy a caminho de você...', 'normal');
    this.startTimer();
  }

  /**
   * Prepara a simulação sem iniciar o movimento.
   * Útil para testes temporários, como arrastar a moto para simular desvio.
   */
  prepare(coordinates, index = 0) {
    this.stop(false);

    if (!coordinates || coordinates.length < 2) {
      this.coordinates = [];
      this.index = 0;
      this.paused = false;
      return;
    }

    this.coordinates = coordinates;
    this.index = Math.max(0, Math.min(index, coordinates.length - 1));
    this.paused = true;
  }

  pause(showStatus = true) {
    if (!this.isRunning()) return false;

    this.clearTimers();
    this.paused = true;

    if (showStatus) {
      this.onStatus?.('Simulação pausada. O motoboy ficou parado no ponto atual.', 'normal');
    }

    return true;
  }

  resume(showStatus = true) {
    if (!this.coordinates?.length || !this.paused) return false;

    this.paused = false;

    if (showStatus) {
      this.onStatus?.('Simulação retomada. Motoboy voltou a se mover.', 'normal');
    }

    this.startTimer();
    return true;
  }

  isRunning() {
    return Boolean(this.timer || this.finishTimer);
  }

  isPaused() {
    return this.paused;
  }

  startTimer() {
    this.clearTimers();

    this.timer = window.setInterval(() => {
      this.tick();
    }, 260);
  }

  tick() {
    const finalCoordinate = this.coordinates[this.coordinates.length - 1];

    if (this.index >= this.coordinates.length) {
      this.emitFinalPosition(finalCoordinate);
      this.stop(false);
      this.onFinish?.();
      return;
    }

    const current = this.coordinates[this.index];
    const next = this.coordinates[Math.min(this.index + 1, this.coordinates.length - 1)];
    const remaining = haversineDistanceMeters(current, finalCoordinate);
    const bearing = calculateBearing(current, next);

    this.onTick?.({
      current,
      next,
      bearing,
      remaining,
      routeIndex: this.index,
      totalPoints: this.coordinates.length,
    });

    this.index += 4;

    // Se o salto pulou o último ponto, força a moto a encostar exatamente no destino.
    if (this.index >= this.coordinates.length) {
      this.finishTimer = window.setTimeout(() => {
        this.emitFinalPosition(finalCoordinate);
        this.stop(false);
        this.onFinish?.();
      }, 230);
    }
  }

  emitFinalPosition(finalCoordinate) {
    if (!finalCoordinate) return;

    this.onTick?.({
      current: finalCoordinate,
      next: finalCoordinate,
      bearing: 0,
      remaining: 0,
      routeIndex: Math.max(this.coordinates.length - 1, 0),
      totalPoints: this.coordinates.length,
    });
  }

  stop(showStatus = true) {
    this.clearTimers();
    this.paused = false;

    if (showStatus) {
      this.onStatus?.('Simulação parada.', 'normal');
    }
  }

  clearTimers() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }

    if (this.finishTimer) {
      window.clearTimeout(this.finishTimer);
      this.finishTimer = null;
    }
  }
}

function calculateBearing(from, to) {
  if (!from || !to) return 0;

  const [lng1, lat1] = from.map((value) => (value * Math.PI) / 180);
  const [lng2, lat2] = to.map((value) => (value * Math.PI) / 180);
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
