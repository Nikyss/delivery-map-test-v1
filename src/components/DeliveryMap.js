import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  BRASIL_BOUNDS,
  BRASIL_CENTER,
  JOAO_PESSOA_CENTER,
  MEETING_MAX_DISTANCE_METERS,
  getMapRenderMode,
  getMapStyle,
} from '../config/mapConfig.js';
import { haversineDistanceMeters } from '../utils/formatters.js';

export class DeliveryMap {
  constructor({ container, onSelectDriverStart, onMeetingPreviewChange, onMapReady, onStatus }) {
    this.container = container;
    this.onSelectDriverStart = onSelectDriverStart;
    this.onMeetingPreviewChange = onMeetingPreviewChange;
    this.onMapReady = onMapReady;
    this.onStatus = onStatus;

    this.map = null;
    this.mode = 'select-driver-start';
    this.userLocation = null;
    this.driverStartMarker = null;
    this.userMarker = null;
    this.meetingMarker = null;
    this.driverMarker = null;
    this.previewMoveHandler = null;
    this.activeRoute = null;
    this.activeRouteCoordinates = [];
    this.visibleRouteCoordinates = [];
    this.routeProgressIndex = 0;
    this.driverDragEndHandler = null;
    this.renderMode = getMapRenderMode();
    this.isLightweightMode = this.renderMode === '2d';
  }

  init() {
    document.body.classList.toggle('map-mode-2d', this.isLightweightMode);
    document.body.classList.toggle('map-mode-3d', !this.isLightweightMode);

    this.map = new maplibregl.Map({
      container: this.container,
      style: getMapStyle(this.renderMode),
      center: JOAO_PESSOA_CENTER,
      zoom: this.isLightweightMode ? 12.1 : 12.4,
      pitch: this.isLightweightMode ? 0 : 44,
      bearing: this.isLightweightMode ? 0 : -8,
      minZoom: 4.3,
      maxZoom: this.isLightweightMode ? 18.4 : 20,
      maxBounds: BRASIL_BOUNDS,
      renderWorldCopies: false,
      attributionControl: false,
      antialias: !this.isLightweightMode,
      preserveDrawingBuffer: false,
      fadeDuration: 120,
      transformRequest: (url, resourceType) => ({
        url,
        resourceType,
        credentials: 'same-origin',
      }),
    });

    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: !this.isLightweightMode }), 'top-right');
    if (!this.isLightweightMode) {
      this.map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    }
    this.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    this.map.on('load', () => {
      if (!this.isLightweightMode) this.add3DBuildings();
      this.ensureRouteLayers();
      this.ensureMeetingLimitLayers();
      this.ensureMeetingLineLayer();
      this.resizeSoon();
      this.onMapReady?.();
    });

    this.map.on('styledata', () => {
      if (!this.isLightweightMode) this.add3DBuildings();
      this.ensureRouteLayers();
      this.ensureMeetingLimitLayers();
      this.ensureMeetingLineLayer();

      if (this.userLocation) {
        this.setMeetingLimitCircle(this.userLocation, MEETING_MAX_DISTANCE_METERS);
      }
    });

    this.map.on('click', (event) => {
      if (this.mode !== 'select-driver-start') return;

      const coordinates = [event.lngLat.lng, event.lngLat.lat];
      this.onSelectDriverStart?.(coordinates);
    });

    this.map.on('moveend', () => {
      this.keepInsideBrazil();
    });

    this.map.on('error', (event) => {
      const message = event?.error?.message || '';
      if (message.includes('404') || message.includes('tile')) {
        console.warn('Tile do mapa falhou e será ignorado:', message);
        return;
      }
      console.warn('Aviso do mapa:', event?.error || event);
    });

    window.addEventListener('resize', () => this.resizeSoon());
  }

  resizeSoon() {
    window.setTimeout(() => this.map?.resize(), 80);
    window.setTimeout(() => this.map?.resize(), 260);
  }

  setMode(mode) {
    this.mode = mode;
  }

  keepInsideBrazil() {
    if (!this.map) return;

    const center = this.map.getCenter();
    const [[west, south], [east, north]] = BRASIL_BOUNDS;

    if (center.lng < west || center.lng > east || center.lat < south || center.lat > north) {
      this.map.easeTo({ center: BRASIL_CENTER, zoom: 4.8, pitch: this.isLightweightMode ? 0 : 18, duration: 650 });
    }
  }

  isInsideBrazil(coordinates) {
    const [lng, lat] = coordinates;
    const [[west, south], [east, north]] = BRASIL_BOUNDS;
    return lng >= west && lng <= east && lat >= south && lat <= north;
  }

  setDriverStart(coordinates) {
    this.removeMarker('driverStartMarker');
    this.removeMarker('driverMarker');

    this.driverStartMarker = new maplibregl.Marker({
      element: createMarkerElement('B', 'driver-start-marker'),
      anchor: 'center',
    })
      .setLngLat(coordinates)
      .setPopup(new maplibregl.Popup({ offset: 22 }).setHTML('<strong>Ponto B</strong><br>Origem do motoboy/restaurante'))
      .addTo(this.map);
  }

  setUserLocation(coordinates, details = {}) {
    this.userLocation = coordinates;

    if (!this.userMarker) {
      this.userMarker = new maplibregl.Marker({
        element: createMarkerElement('A', 'user-marker'),
        anchor: 'center',
      })
        .setLngLat(coordinates)
        .setPopup(new maplibregl.Popup({ offset: 22 }).setHTML('<strong>Ponto A</strong><br>Sua localização real/GPS'))
        .addTo(this.map);
    }

    this.updateUserLocation(coordinates, details);

    this.map.easeTo({
      center: coordinates,
      zoom: this.isLightweightMode ? 17.25 : 18.15,
      pitch: this.isLightweightMode ? 0 : 56,
      bearing: this.isLightweightMode ? 0 : this.map.getBearing(),
      duration: 1050,
    });
  }

  updateUserLocation(coordinates, details = {}) {
    this.userLocation = coordinates;

    if (this.userMarker) {
      this.userMarker.setLngLat(coordinates);

      const element = this.userMarker.getElement();
      if (Number.isFinite(details.heading)) {
        element.style.setProperty('--user-heading', `${details.heading}deg`);
        element.classList.add('has-heading');
      } else {
        element.classList.remove('has-heading');
      }

      if (Number.isFinite(details.accuracy)) {
        element.title = `Precisão aproximada: ${Math.round(details.accuracy)}m`;
      }
    }

    this.setMeetingLimitCircle(coordinates, MEETING_MAX_DISTANCE_METERS);
  }

  startMeetingPreview(userLocation) {
    this.userLocation = userLocation;
    this.setMode('select-meeting-point');

    if (this.previewMoveHandler) {
      this.map.off('move', this.previewMoveHandler);
      this.map.off('moveend', this.previewMoveHandler);
    }

    this.previewMoveHandler = () => this.updateMeetingPreviewFromTargetDot();
    this.map.on('move', this.previewMoveHandler);
    this.map.on('moveend', this.previewMoveHandler);
    this.updateMeetingPreviewFromTargetDot();
  }

  updateMeetingPreviewFromTargetDot() {
    if (!this.userLocation) return;

    const meetingPoint = this.getTargetDotCoordinates();
    const distance = haversineDistanceMeters(this.userLocation, meetingPoint);

    this.onMeetingPreviewChange?.({ meetingPoint, distance });
  }

  getTargetDotCoordinates() {
    const dot = document.querySelector('.target-dot');

    if (!dot || !this.map) {
      const center = this.map.getCenter();
      return [center.lng, center.lat];
    }

    const dotRect = dot.getBoundingClientRect();
    const mapRect = this.map.getContainer().getBoundingClientRect();

    const x = dotRect.left + dotRect.width / 2 - mapRect.left;
    const y = dotRect.top + dotRect.height / 2 - mapRect.top;
    const lngLat = this.map.unproject([x, y]);

    return [lngLat.lng, lngLat.lat];
  }

  stopMeetingPreview({ keepLine = true } = {}) {
    if (this.previewMoveHandler) {
      this.map.off('move', this.previewMoveHandler);
      this.map.off('moveend', this.previewMoveHandler);
      this.previewMoveHandler = null;
    }

    if (!keepLine) this.clearMeetingLine();
  }

  setMeetingPoint(coordinates) {
    this.removeMarker('meetingMarker');

    this.meetingMarker = new maplibregl.Marker({
      element: createMarkerElement('A+', 'meeting-marker'),
      anchor: 'bottom',
    })
      .setLngLat(coordinates)
      .setPopup(new maplibregl.Popup({ offset: 22 }).setHTML('<strong>Ponto de encontro</strong><br>Local onde o motoboy deve parar'))
      .addTo(this.map);
  }

  setDriverMarker(coordinates) {
    const wasDraggable = Boolean(this.driverMarker?.isDraggable?.());
    const previousDragHandler = this.driverDragEndHandler;

    this.removeMarker('driverMarker');

    this.driverMarker = new maplibregl.Marker({
      element: createMarkerElement('🛵', 'driver-marker'),
      anchor: 'center',
      draggable: wasDraggable,
    })
      .setLngLat(coordinates)
      .setPopup(new maplibregl.Popup({ offset: 22 }).setHTML('<strong>Motoboy</strong>'))
      .addTo(this.map);

    if (wasDraggable && previousDragHandler) {
      this.setDriverDragMode(true, previousDragHandler);
    }
  }

  setDriverDragMode(enabled, onDragEnd) {
    if (!this.driverMarker) return false;

    if (this.driverDragEndHandler) {
      this.driverMarker.off('dragend', this.driverDragEndHandler);
      this.driverDragEndHandler = null;
    }

    this.driverMarker.setDraggable(Boolean(enabled));
    this.driverMarker.getElement().classList.toggle('is-dev-draggable', Boolean(enabled));

    if (enabled) {
      this.driverDragEndHandler = () => {
        const lngLat = this.driverMarker.getLngLat();
        onDragEnd?.([lngLat.lng, lngLat.lat]);
      };

      this.driverMarker.on('dragend', this.driverDragEndHandler);
    }

    return true;
  }

  getDriverCoordinates() {
    if (!this.driverMarker) return null;
    const lngLat = this.driverMarker.getLngLat();
    return [lngLat.lng, lngLat.lat];
  }

  setRoute(route) {
    this.ensureRouteLayers();

    this.activeRoute = route;
    this.activeRouteCoordinates = Array.isArray(route.coordinates) ? [...route.coordinates] : [];
    this.routeProgressIndex = 0;

    this.setVisibleRouteCoordinates(this.activeRouteCoordinates);

    const bounds = new maplibregl.LngLatBounds();
    this.activeRouteCoordinates.forEach((coordinate) => bounds.extend(coordinate));

    this.map.fitBounds(bounds, {
      padding: this.getRoutePadding(),
      maxZoom: this.isLightweightMode ? 16.8 : 17.6,
      pitch: this.isLightweightMode ? 0 : 50,
      duration: 850,
    });
  }

  updateDriverPosition({ coordinates, bearing = 0, remaining = 0, routeIndex = null, trimRoute = true }) {
    if (!this.driverMarker) return;

    this.driverMarker.setLngLat(coordinates);

    const element = this.driverMarker.getElement();
    element.style.setProperty('--driver-rotation', `${bearing}deg`);

    let scale = 1;
    if (remaining > 2500) scale = 1.18;
    else if (remaining > 900) scale = 1.05;
    else if (remaining < 250) scale = 0.84;

    element.style.setProperty('--driver-scale', scale);

    if (trimRoute) {
      this.updateRouteProgressFromDriver(coordinates, routeIndex);
    }

    // Não prende mais a câmera no motoboy.
    // O marcador anda, mas a pessoa pode navegar livremente pelo mapa.
    if (!this.isLightweightMode && this.map.getPitch() < 35) {
      this.map.easeTo({ pitch: 42, duration: 300 });
    }
  }

  /**
   * Atualiza a rota visível para mostrar apenas o trecho restante.
   *
   * Hoje isso é usado pela simulação, mas o mesmo método já serve para GPS real:
   * quando chegar uma nova posição do motoboy, chame updateLiveDriverLocation().
   */
  updateRouteProgressFromDriver(driverCoordinates, routeIndex = null) {
    if (!this.activeRouteCoordinates.length) return;

    const progressIndex = this.resolveRouteProgressIndex(driverCoordinates, routeIndex);
    const safeProgressIndex = Math.max(this.routeProgressIndex, progressIndex);
    this.routeProgressIndex = Math.min(safeProgressIndex, this.activeRouteCoordinates.length - 1);

    const destination = this.activeRouteCoordinates[this.activeRouteCoordinates.length - 1];
    const tail = this.activeRouteCoordinates.slice(Math.min(this.routeProgressIndex + 1, this.activeRouteCoordinates.length - 1));
    const visibleCoordinates = [driverCoordinates, ...tail];

    if (visibleCoordinates.length < 2) {
      visibleCoordinates.push(destination);
    }

    this.setVisibleRouteCoordinates(visibleCoordinates);
  }

  updateLiveDriverLocation({ coordinates, bearing = 0, remaining = 0, routeIndex = null }) {
    const deviationMeters = this.getRouteDeviationMeters(coordinates);

    this.updateDriverPosition({
      coordinates,
      bearing,
      remaining,
      routeIndex,
      trimRoute: true,
    });

    return {
      deviationMeters,
      shouldRecalculate: Number.isFinite(deviationMeters) && deviationMeters > 50,
    };
  }

  resolveRouteProgressIndex(driverCoordinates, routeIndex = null) {
    if (Number.isInteger(routeIndex)) {
      return clamp(routeIndex, 0, this.activeRouteCoordinates.length - 1);
    }

    const nearest = this.findNearestRoutePoint(driverCoordinates, this.routeProgressIndex);
    return nearest.index;
  }

  getRouteDeviationMeters(coordinates) {
    if (!this.activeRouteCoordinates.length || !coordinates) return null;
    return this.findNearestRoutePoint(coordinates, this.routeProgressIndex).distanceMeters;
  }

  findNearestRoutePoint(coordinates, startIndex = 0) {
    let bestIndex = clamp(startIndex, 0, Math.max(this.activeRouteCoordinates.length - 1, 0));
    let bestDistance = Number.POSITIVE_INFINITY;

    // Janela limitada para evitar voltar muitos pontos e para deixar pronto para GPS real.
    // Se o motoboy pular/desviar muito, a rotina ainda procura um pouco adiante.
    const searchStart = Math.max(0, bestIndex - 8);
    const searchEnd = Math.min(this.activeRouteCoordinates.length - 1, bestIndex + 90);

    for (let index = searchStart; index <= searchEnd; index += 1) {
      const distance = haversineDistanceMeters(coordinates, this.activeRouteCoordinates[index]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    return { index: bestIndex, distanceMeters: bestDistance };
  }

  setVisibleRouteCoordinates(coordinates) {
    const source = this.map?.getSource('route');
    if (!source) return;

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      this.visibleRouteCoordinates = [];
      source.setData(emptyFeatureCollection());
      return;
    }

    this.visibleRouteCoordinates = [...coordinates];

    source.setData({
      type: 'Feature',
      properties: { kind: 'remaining-route' },
      geometry: {
        type: 'LineString',
        coordinates,
      },
    });
  }

  getVisibleRouteCoordinates() {
    return Array.isArray(this.visibleRouteCoordinates) ? [...this.visibleRouteCoordinates] : [];
  }

  clearRoute() {
    this.activeRoute = null;
    this.activeRouteCoordinates = [];
    this.visibleRouteCoordinates = [];
    this.routeProgressIndex = 0;

    if (this.map?.getSource('route')) {
      this.map.getSource('route').setData(emptyFeatureCollection());
    }
  }

  clearMeetingLine() {
    if (this.map?.getSource('meeting-line')) {
      this.map.getSource('meeting-line').setData(emptyFeatureCollection());
    }
  }

  setMeetingLine(from, to) {
    this.setMeetingLineGeometry({
      type: 'LineString',
      coordinates: [from, to],
    });
  }

  setMeetingLineGeometry(geometry) {
    this.ensureMeetingLineLayer();

    const source = this.map.getSource('meeting-line');
    source?.setData({
      type: 'Feature',
      properties: {},
      geometry,
    });
  }

  reset() {
    this.stopMeetingPreview({ keepLine: false });
    this.removeMarker('driverStartMarker');
    this.removeMarker('userMarker');
    this.removeMarker('meetingMarker');
    this.removeMarker('driverMarker');
    this.userLocation = null;
    this.clearRoute();
    this.clearMeetingLine();
    this.clearMeetingLimitCircle();
    this.setMode('select-driver-start');
    this.map.easeTo({
      center: JOAO_PESSOA_CENTER,
      zoom: this.isLightweightMode ? 12.1 : 12.4,
      pitch: this.isLightweightMode ? 0 : 44,
      bearing: this.isLightweightMode ? 0 : -8,
      duration: 650,
    });
  }

  removeMarker(name) {
    if (this[name]) {
      if (name === 'driverMarker' && this.driverDragEndHandler) {
        this[name].off('dragend', this.driverDragEndHandler);
        this.driverDragEndHandler = null;
      }

      this[name].remove();
      this[name] = null;
    }
  }

  getRoutePadding() {
    if (this.isMobileViewport()) {
      return { top: 90, bottom: 260, left: 34, right: 34 };
    }

    const sidebarHidden = document.body.classList.contains('sidebar-collapsed');
    return sidebarHidden
      ? { top: 90, bottom: 90, left: 90, right: 90 }
      : { top: 90, bottom: 90, left: 440, right: 90 };
  }

  isMobileViewport() {
    return window.matchMedia?.('(max-width: 900px)').matches || this.isLightweightMode;
  }

  add3DBuildings() {
    if (this.isLightweightMode || !this.map || this.map.getLayer('building-3d')) return;

    const sourceId = getAvailableVectorSource(this.map);
    if (!sourceId) return;

    const beforeId = findFirstSymbolLayerId(this.map);

    try {
      this.map.setLight?.({
        color: '#ffffff',
        intensity: 0.38,
        anchor: 'viewport',
        position: [1.15, 210, 35],
      });

      this.map.addLayer({
        id: 'building-3d',
        type: 'fill-extrusion',
        source: sourceId,
        'source-layer': 'building',
        minzoom: 15,
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            '#e5e7eb',
            17,
            '#cbd5e1',
            19,
            '#94a3b8',
          ],
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            16.2,
            [
              'coalesce',
              ['to-number', ['get', 'render_height']],
              ['to-number', ['get', 'height']],
              7,
            ],
          ],
          'fill-extrusion-base': [
            'coalesce',
            ['to-number', ['get', 'render_min_height']],
            ['to-number', ['get', 'min_height']],
            0,
          ],
          'fill-extrusion-opacity': 0.48,
          'fill-extrusion-vertical-gradient': true,
        },
      }, beforeId);
    } catch (error) {
      console.warn('Não foi possível ativar prédios 3D neste estilo:', error);
    }
  }

  ensureRouteLayers() {
    if (!this.map || this.map.getSource('route')) return;

    this.map.addSource('route', {
      type: 'geojson',
      data: emptyFeatureCollection(),
    });

    this.map.addLayer({
      id: 'route-glow',
      type: 'line',
      source: 'route',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#111827',
        'line-width': 14,
        'line-opacity': 0.18,
        'line-blur': 4,
      },
    });

    this.map.addLayer({
      id: 'route-border',
      type: 'line',
      source: 'route',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#ffffff',
        'line-width': 9,
        'line-opacity': 0.95,
      },
    });

    this.map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#111827',
        'line-width': 5.8,
        'line-opacity': 0.99,
      },
    });
  }

  ensureMeetingLimitLayers() {
    if (!this.map || this.map.getSource('meeting-limit')) return;

    this.map.addSource('meeting-limit', {
      type: 'geojson',
      data: emptyFeatureCollection(),
    });

    this.map.addLayer({
      id: 'meeting-limit-fill',
      type: 'fill',
      source: 'meeting-limit',
      paint: {
        'fill-color': '#2563eb',
        'fill-opacity': 0.12,
      },
    });

    this.map.addLayer({
      id: 'meeting-limit-border',
      type: 'line',
      source: 'meeting-limit',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#2563eb',
        'line-width': 2.5,
        'line-opacity': 0.72,
        'line-dasharray': [2, 1.4],
      },
    });
  }

  setMeetingLimitCircle(center, radiusMeters) {
    this.ensureMeetingLimitLayers();

    const source = this.map?.getSource('meeting-limit');
    source?.setData({
      type: 'Feature',
      properties: { radiusMeters },
      geometry: createCirclePolygon(center, radiusMeters),
    });
  }

  clearMeetingLimitCircle() {
    if (this.map?.getSource('meeting-limit')) {
      this.map.getSource('meeting-limit').setData(emptyFeatureCollection());
    }
  }

  ensureMeetingLineLayer() {
    if (!this.map || this.map.getSource('meeting-line')) return;

    this.map.addSource('meeting-line', {
      type: 'geojson',
      data: emptyFeatureCollection(),
    });

    this.map.addLayer({
      id: 'meeting-line-shadow',
      type: 'line',
      source: 'meeting-line',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#92400e',
        'line-width': 7,
        'line-opacity': 0.18,
        'line-blur': 2,
      },
    });

    this.map.addLayer({
      id: 'meeting-line',
      type: 'line',
      source: 'meeting-line',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#f59e0b',
        'line-width': 4,
        'line-opacity': 0.98,
        'line-dasharray': [1.4, 1.1],
      },
    });
  }
}

function createMarkerElement(label, extraClass) {
  const element = document.createElement('div');
  element.className = `map-marker ${extraClass}`;

  if (extraClass === 'user-marker') {
    element.innerHTML = `<span>${label}</span><i class="user-direction"></i>`;
  } else {
    element.innerHTML = `<span>${label}</span>`;
  }

  return element;
}

function createCirclePolygon(center, radiusMeters, points = 96) {
  const [centerLng, centerLat] = center;
  const earthRadius = 6378137;
  const angularDistance = radiusMeters / earthRadius;
  const lat1 = degreesToRadians(centerLat);
  const lng1 = degreesToRadians(centerLng);
  const coordinates = [];

  for (let i = 0; i <= points; i += 1) {
    const bearing = (i / points) * Math.PI * 2;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

    coordinates.push([radiansToDegrees(lng2), radiansToDegrees(lat2)]);
  }

  return {
    type: 'Polygon',
    coordinates: [coordinates],
  };
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value) {
  return (value * 180) / Math.PI;
}

function emptyFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: [],
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getAvailableVectorSource(map) {
  const style = map.getStyle();
  const preferred = ['openmaptiles', 'openfreemap', 'maptiler_planet', 'vector-tiles'];

  for (const id of preferred) {
    if (style.sources?.[id]?.type === 'vector') return id;
  }

  return Object.entries(style.sources || {}).find(([, source]) => source.type === 'vector')?.[0] || null;
}

function findFirstSymbolLayerId(map) {
  const layers = map.getStyle()?.layers || [];
  return layers.find((layer) => layer.type === 'symbol')?.id;
}
