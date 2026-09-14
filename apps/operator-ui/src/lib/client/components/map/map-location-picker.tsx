// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0
'use client';

import React, { useEffect, useState } from 'react';
import config from '@lib/utils/config';
import { GeoPoint } from '@lib/utils/geo-point';
import type { MapMouseEvent } from '@vis.gl/react-google-maps';
import { AdvancedMarker, APIProvider, Map } from '@vis.gl/react-google-maps';
import type { LocationPickerMapProps } from '@lib/client/components/map/types';
import { MarkerIconCircle } from '@lib/client/components/map/marker-icons';
import { getGoogleMapsApiKey, setGoogleMapsApiKey } from '@lib/utils/store/maps-slice';
import { useDispatch, useSelector } from 'react-redux';
import { getGoogleMapsApiKeyAction } from '@lib/server/actions/map/get-google-maps-api-key-action';
import { Skeleton } from '@lib/client/components/ui/skeleton';

export const defaultLatitude = 36.7783;
export const defaultLongitude = -119.4179;
const defaultZoom = 15;

// The .env.local template ships this as a literal placeholder. Without a
// real key, @vis.gl/react-google-maps throws an uncaught error deep inside
// Google's own script (outside React's render call stack, so an error
// boundary can't catch it either) and takes down the whole page. Since the
// form already has manual lat/lng inputs as a fallback, just skip loading
// the map entirely rather than crash.
const PLACEHOLDER_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';

/**
 * MapLocationPicker component that allows selecting a location on the map
 */
export const MapLocationPicker: React.FC<LocationPickerMapProps> = ({
  point,
  zoom = defaultZoom,
  onLocationSelect,
}) => {
  const dispatch = useDispatch();
  const apiKey = useSelector(getGoogleMapsApiKey);

  const [position, setPosition] = useState<{ lat: number; lng: number } | undefined>(
    point
      ? {
          lat: point.latitude,
          lng: point.longitude,
        }
      : undefined,
  );

  useEffect(() => {
    if (apiKey === undefined) {
      getGoogleMapsApiKeyAction().then((result) =>
        dispatch(setGoogleMapsApiKey(result.success ? result.data : '')),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (point) {
      setPosition({
        lat: point.latitude,
        lng: point.longitude,
      });
    } else {
      setPosition(undefined);
    }
  }, [point]);

  const handleMapClick = (e: MapMouseEvent) => {
    if (e.detail.latLng) {
      const lat = e.detail.latLng.lat;
      const lng = e.detail.latLng.lng;
      onLocationSelect(new GeoPoint(lat, lng));
    }
  };

  const isMapsConfigured = !!apiKey && apiKey !== PLACEHOLDER_API_KEY;

  if (apiKey === undefined) {
    return <Skeleton className="size=full" />;
  }

  if (!isMapsConfigured) {
    return (
      <div className="size-full flex items-center justify-center rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground text-center">
        Map unavailable: no Google Maps API key configured. Enter latitude/longitude manually.
      </div>
    );
  }

  return (
    <div className="size-full">
      <APIProvider apiKey={apiKey ?? ''}>
        <Map
          mapId={config.googleMapsLocationPickerMapId}
          center={point ? { lat: point.latitude, lng: point.longitude } : undefined}
          defaultZoom={zoom}
          onClick={handleMapClick}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          zoomControl={true}
          fullscreenControl={false}
        >
          {point && (
            <AdvancedMarker position={position}>
              <MarkerIconCircle
                fillColor="var(--primary)"
                style={{
                  width: '40px',
                  height: '40px',
                }}
              />
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>
    </div>
  );
};
