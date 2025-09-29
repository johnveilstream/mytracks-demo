import { useCallback, useEffect, useRef, useState } from "react";

type GeoOptions = {
  enableHighAccuracy?: boolean;
  timeout?: number;          // ms
  maximumAge?: number;       // ms
};

type GeoState = {
  isSupported: boolean;
  status: "idle" | "prompt" | "granted" | "denied";
  coords?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp?: number;
  error?: string;
};

export function useGeolocation(options: GeoOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }) {
  const [state, setState] = useState<GeoState>({
    isSupported: typeof window !== "undefined" && "geolocation" in navigator,
    status: "idle",
  });

  const watchId = useRef<number | null>(null);

  const onSuccess = useCallback((pos: GeolocationPosition) => {
    const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = pos.coords;
    setState(s => ({
      ...s,
      status: "granted",
      coords: { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed },
      timestamp: pos.timestamp,
      error: undefined,
    }));
  }, []);

  const onError = useCallback((err: GeolocationPositionError) => {
    const map: Record<number, string> = {
      1: "Permission denied",
      2: "Position unavailable",
      3: "Timeout",
    };
    setState(s => ({ ...s, status: err.code === 1 ? "denied" : s.status, error: map[err.code] ?? err.message }));
  }, []);

  // Query permission state (not supported in all browsers)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!("permissions" in navigator)) return;
      try {
        // TS note: 'geolocation' is valid; cast if your TS lib.dom.d.ts is older
        // @ts-expect-error
        const p: PermissionStatus = await navigator.permissions.query({ name: "geolocation" });
        if (!cancelled) {
          setState(s => ({ ...s, status: (p.state as GeoState["status"]) ?? s.status }));
          p.onchange = () => setState(s => ({ ...s, status: (p.state as GeoState["status"]) }));
        }
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const getOnce = useCallback(() => {
    if (!state.isSupported) return;
    setState(s => ({ ...s, status: "prompt" }));
    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
  }, [onError, onSuccess, options, state.isSupported]);

  const startWatch = useCallback(() => {
    if (!state.isSupported || watchId.current !== null) return;
    setState(s => ({ ...s, status: "prompt" }));
    watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
  }, [onError, onSuccess, options, state.isSupported]);

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  useEffect(() => () => stopWatch(), [stopWatch]);

  return { ...state, getOnce, startWatch, stopWatch };
}
