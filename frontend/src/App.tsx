import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./App.css";

type Aircraft = {
  icao: string;
  callsign: string;
  registration: string | null;
  aircraft_type: string | null;
  lat: number;
  lon: number;
  altitude: number | string | null;
  ground_speed: number | null;
  heading: number | null;
  vertical_rate: number | null;
  squawk: string | null;
  emergency: string | null;
  category: string | null;
};

type PhotoInfo = {
  image_url: string | null;
  photo_url: string | null;
  registration: string | null;
  aircraft_type: string | null;
  photographer: string | null;
};

type JetPhotosResponse = {
  found?: boolean;
  registration?: string;
  count?: number;
  photos?: Array<{
    photoId?: string;
    thumbnailUrl?: string;
    imageUrl?: string;
    photoPageUrl?: string;
    registration?: string;
    registrationUrl?: string;
    aircraftType?: string;
    airline?: string;
    photographer?: string;
    photographerUrl?: string;
    location?: string;
    locationUrl?: string;
    photoDate?: string;
    uploadedDate?: string;
    likes?: string;
    comments?: string;
    views?: string;
  }>;
};

function getAircraftType(plane: Aircraft) {
  const type = (plane.aircraft_type || "").toUpperCase();
  const category = (plane.category || "").toUpperCase();

  if (
    category === "A7" ||
    type.startsWith("H") ||
    type.includes("EC35") ||
    type.includes("EC45") ||
    type.includes("AS3") ||
    type.includes("R44") ||
    type.includes("R22")
  ) {
    return "helicopter";
  }

  if (category === "A5" || type.includes("GLID")) {
    return "glider";
  }

  if (
    category === "A1" ||
    type.includes("C172") ||
    type.includes("PA28") ||
    type.includes("P28")
  ) {
    return "light";
  }

  if (
    type.startsWith("AT") ||
    type.startsWith("DH8") ||
    type.startsWith("SF34") ||
    type.includes("PC12") ||
    type.includes("PC24")
  ) {
    return "turboprop";
  }

  if (
    type.startsWith("A33") ||
    type.startsWith("A34") ||
    type.startsWith("A35") ||
    type.startsWith("A38") ||
    type.startsWith("B74") ||
    type.startsWith("B77") ||
    type.startsWith("B78") ||
    type.startsWith("B79")
  ) {
    return "large";
  }

  return "jet";
}

function getAircraftSize(plane: Aircraft) {
  switch (getAircraftType(plane)) {
    case "light":
      return 22;
    case "glider":
      return 21;
    case "helicopter":
      return 25;
    case "turboprop":
      return 28;
    case "large":
      return 35;
    default:
      return 30;
  }
}

function getAircraftColor(plane: Aircraft) {
  const squawk = (plane.squawk || "").trim();
  const emergency = (plane.emergency || "").toLowerCase();

  if (
    squawk === "7700" ||
    (emergency &&
      emergency !== "none" &&
      emergency !== "normal")
  ) {
    return "#ff3b30";
  }

  if (squawk === "7600") {
    return "#ff9500";
  }

  if (squawk === "7500") {
    return "#bf5af2";
  }

  if (squawk === "7000") {
    return "#ffd60a";
  }

  if (squawk === "2000") {
    return "#64d2ff";
  }

  return "#ffd60a";
}

function getAircraftIcon(plane: Aircraft) {
  const aircraftType = getAircraftType(plane);

  let path = "";

  if (aircraftType === "helicopter") {
    path = `
      <circle cx="16" cy="16" r="2" fill="currentColor" />

      <path
        d="
          M16 14
          L16 7
          M9 7
          L23 7
          M12 10
          L20 10
          M16 18
          L16 28
          M10 28
          L22 28
        "
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        fill="none"
      />
    `;
  } else if (
    aircraftType === "light" ||
    aircraftType === "glider"
  ) {
    path = `
      <path
        d="
          M16 2
          L18 11
          L28 15
          L28 18
          L18 17
          L17 29
          L22 31
          L22 33
          L16 31
          L10 33
          L10 31
          L15 29
          L14 17
          L4 18
          L4 15
          L14 11
          Z
        "
        fill="currentColor"
      />
    `;
  } else if (aircraftType === "turboprop") {
    path = `
      <path
        d="
          M16 2
          L18 11
          L29 16
          L29 19
          L18 18
          L17 29
          L22 31
          L22 33
          L16 31
          L10 33
          L10 31
          L15 29
          L14 18
          L3 19
          L3 16
          L14 11
          Z
        "
        fill="currentColor"
      />

      <circle
        cx="11"
        cy="13"
        r="2"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      />

      <circle
        cx="21"
        cy="13"
        r="2"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      />
    `;
  } else {
    path = `
      <path
        d="
          M16 1
          C17 5 17 8 18 12
          L30 17
          L30 20
          L18 19
          L17 29
          L22 32
          L22 34
          L16 31
          L10 34
          L10 32
          L15 29
          L14 19
          L2 20
          L2 17
          L14 12
          C15 8 15 5 16 1
          Z
        "
        fill="currentColor"
      />
    `;
  }

  return `
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 32 36"
      xmlns="http://www.w3.org/2000/svg"
    >
      ${path}
    </svg>
  `;
}

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const aircraftRef = useRef<Aircraft[]>([]);

  const markersRef = useRef(
    new Map<string, maplibregl.Marker>()
  );

  const lastUpdateRef = useRef<number>(Date.now());

  const followingIcaoRef =
    useRef<string | null>(null);

  const renderLimitRef = useRef(250);

  const trackingCameraUpdateRef =
    useRef(false);

  const [aircraftCount, setAircraftCount] =
    useState(0);

  const [renderLimit, setRenderLimit] =
    useState(250);

  const [radarDown, setRadarDown] =
    useState(false);

  const [selectedAircraft, setSelectedAircraft] =
    useState<Aircraft | null>(null);

  const [photo, setPhoto] =
    useState<PhotoInfo | null>(null);

  const [photoLoading, setPhotoLoading] =
    useState(false);

  const [photoError, setPhotoError] =
    useState(false);

  useEffect(() => {
    renderLimitRef.current = renderLimit;

    const map = mapRef.current;

    if (map) {
      map.triggerRepaint();
    }
  }, [renderLimit]);

  useEffect(() => {
    if (!mapContainer.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      center: [-1.5, 52.5],
      zoom: 6,

      style: {
        version: 8,

        sources: {
          osm: {
            type: "raster",

            tiles: [
              "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],

            tileSize: 256,

            attribution:
              "© OpenStreetMap contributors",
          },
        },

        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
    });

    mapRef.current = map;

    function stopFollowing() {
      followingIcaoRef.current = null;

      setSelectedAircraft(null);

      map.stop();
    }

    function followAircraft(plane: Aircraft) {
      followingIcaoRef.current = plane.icao;

      setSelectedAircraft(plane);

      map.stop();

      map.flyTo({
        center: [plane.lon, plane.lat],
        zoom: Math.max(map.getZoom(), 9),
        duration: 900,
        essential: true,
      });
    }

    /*
     * =====================================================
     * JETPHOTOS
     * =====================================================
     *
     * OLD:
     *
     * localhost:8000/api/photo/G-EZDH
     *
     * NEW:
     *
     * 127.0.0.1:8787/registration/G-EZDH
     *
     * The new API returns:
     *
     * {
     *   found: true,
     *   photos: [
     *     {
     *       imageUrl: "...",
     *       thumbnailUrl: "...",
     *       photographer: "..."
     *     }
     *   ]
     * }
     *
     * =====================================================
     */

    async function loadPhoto(plane: Aircraft) {
      setPhoto(null);
      setPhotoError(false);

      if (!plane.registration) {
        setPhotoLoading(false);
        return;
      }

      const registration =
        plane.registration
          .trim()
          .toUpperCase();

      if (!registration) {
        setPhotoLoading(false);
        return;
      }

      setPhotoLoading(true);

      try {
        console.log(
          `Loading JetPhotos photo for ${registration}`
        );

        const response = await fetch(
          `http://127.0.0.1:8787/registration/${encodeURIComponent(
            registration
          )}`
        );

        if (!response.ok) {
          throw new Error(
            `Photo API returned HTTP ${response.status}`
          );
        }

        const data =
          (await response.json()) as JetPhotosResponse;

        console.log(
          "JetPhotos response:",
          data
        );

        const firstPhoto =
          data.photos?.[0];

        if (
          !firstPhoto ||
          !firstPhoto.imageUrl
        ) {
          console.log(
            `No JetPhotos image found for ${registration}`
          );

          setPhotoError(true);
          return;
        }

        /*
         * Convert the new API format into the
         * format the existing UI expects.
         */
        const photoInfo: PhotoInfo = {
          image_url:
            firstPhoto.imageUrl,

          photo_url:
            firstPhoto.photoPageUrl ||
            null,

          registration:
            firstPhoto.registration ||
            registration,

          aircraft_type:
            firstPhoto.aircraftType ||
            null,

          photographer:
            firstPhoto.photographer ||
            null,
        };

        console.log(
          "Using aircraft photo:",
          photoInfo.image_url
        );

        setPhoto(photoInfo);
        setPhotoError(false);
      } catch (error) {
        console.error(
          "Aircraft photo error:",
          error
        );

        setPhotoError(true);
      } finally {
        setPhotoLoading(false);
      }
    }

    function selectAircraft(plane: Aircraft) {
      followAircraft(plane);

      loadPhoto(plane);
    }

    function updateVisibleAircraft(
      shouldFollow = false
    ) {
      const bounds = map.getBounds();

      const visible =
        aircraftRef.current.filter((plane) => {
          if (
            !Number.isFinite(plane.lat) ||
            !Number.isFinite(plane.lon)
          ) {
            return false;
          }

          return bounds.contains([
            plane.lon,
            plane.lat,
          ]);
        });

      const limited = visible.slice(
        0,
        renderLimitRef.current
      );

      setAircraftCount(limited.length);

      const visibleIds = new Set<string>();

      for (const plane of limited) {
        if (!plane.icao) {
          continue;
        }

        visibleIds.add(plane.icao);

        let marker =
          markersRef.current.get(
            plane.icao
          );

        const size =
          getAircraftSize(plane);

        const color =
          getAircraftColor(plane);

        if (!marker) {
          const element =
            document.createElement("div");

          element.style.width =
            `${size}px`;

          element.style.height =
            `${size + 4}px`;

          element.style.display =
            "flex";

          element.style.alignItems =
            "center";

          element.style.justifyContent =
            "center";

          element.style.cursor =
            "pointer";

          element.style.userSelect =
            "none";

          element.style.color =
            color;

          element.style.filter =
            `drop-shadow(0 0 4px ${color})`;

          element.innerHTML =
            getAircraftIcon(plane);

          element.onclick = (event) => {
            event.stopPropagation();

            selectAircraft(plane);
          };

          marker =
            new maplibregl.Marker({
              element,

              rotationAlignment: "map",
            })
              .setLngLat([
                plane.lon,
                plane.lat,
              ])
              .addTo(map);

          markersRef.current.set(
            plane.icao,
            marker
          );
        } else {
          marker.setLngLat([
            plane.lon,
            plane.lat,
          ]);

          const element =
            marker.getElement();

          element.style.width =
            `${size}px`;

          element.style.height =
            `${size + 4}px`;

          element.style.color =
            color;

          element.style.filter =
            `drop-shadow(0 0 4px ${color})`;

          element.innerHTML =
            getAircraftIcon(plane);

          element.onclick = (event) => {
            event.stopPropagation();

            selectAircraft(plane);
          };
        }

        if (plane.heading !== null) {
          marker.setRotation(
            plane.heading
          );
        }

        if (
          shouldFollow &&
          followingIcaoRef.current ===
            plane.icao
        ) {
          setSelectedAircraft(plane);

          if (!map.isMoving()) {
            trackingCameraUpdateRef.current =
              true;

            map.jumpTo({
              center: [
                plane.lon,
                plane.lat,
              ],
            });

            trackingCameraUpdateRef.current =
              false;
          }
        }
      }

      for (const [
        icao,
        marker,
      ] of markersRef.current) {
        if (!visibleIds.has(icao)) {
          marker.remove();

          markersRef.current.delete(
            icao
          );
        }
      }
    }

    function sendViewport() {
      const socket =
        socketRef.current;

      if (
        !socket ||
        socket.readyState !==
          WebSocket.OPEN
      ) {
        return;
      }

      const center =
        map.getCenter();

      socket.send(
        JSON.stringify({
          type: "viewport",

          lat: center.lat,

          lon: center.lng,

          radius: 250,
        })
      );
    }

    const socket = new WebSocket(
      "ws://localhost:8000/ws"
    );

    socketRef.current = socket;

    socket.onopen = () => {
      console.log(
        "CONNECTED TO OPENRADAR"
      );

      setRadarDown(false);

      sendViewport();
    };

    socket.onmessage = (event) => {
      try {
        const aircraft =
          JSON.parse(
            event.data
          ) as Aircraft[];

        aircraftRef.current =
          aircraft;

        lastUpdateRef.current =
          Date.now();

        setRadarDown(false);

        updateVisibleAircraft(true);
      } catch (error) {
        console.error(
          "Aircraft data error:",
          error
        );
      }
    };

    socket.onerror = () => {
      console.error(
        "WebSocket error"
      );

      setRadarDown(true);
    };

    socket.onclose = () => {
      console.log(
        "Disconnected from OpenRadar"
      );

      setRadarDown(true);
    };

    map.on("click", () => {
      stopFollowing();
    });

    map.on("load", () => {
      console.log("MAP LOADED");

      sendViewport();

      updateVisibleAircraft(false);
    });

    map.on("moveend", () => {
      if (trackingCameraUpdateRef.current) {
        return;
      }

      sendViewport();

      updateVisibleAircraft(false);
    });

    const radarTimer =
      window.setInterval(() => {
        if (
          Date.now() -
            lastUpdateRef.current >
          15000
        ) {
          setRadarDown(true);
        }
      }, 3000);

    return () => {
      window.clearInterval(
        radarTimer
      );

      if (
        socket.readyState ===
          WebSocket.OPEN ||
        socket.readyState ===
          WebSocket.CONNECTING
      ) {
        socket.close();
      }

      for (const marker of markersRef.current.values()) {
        marker.remove();
      }

      markersRef.current.clear();

      followingIcaoRef.current =
        null;

      mapRef.current = null;

      map.remove();
    };
  }, []);

  function closeAircraft() {
    const map =
      mapRef.current;

    followingIcaoRef.current =
      null;

    setSelectedAircraft(null);

    setPhoto(null);

    setPhotoError(false);

    if (map) {
      map.stop();
    }
  }

  return (
    <div className="app">

      <div
        ref={mapContainer}
        className="map"
      />

      {radarDown && (
        <div className="radar-down">
          <strong>
            RADAR DOWN (:
          </strong>

          <span>
            Live aircraft data is
            currently unavailable.
          </span>
        </div>
      )}

      <div className="topbar">

        <div className="logo">

          <span className="logo-plane">
            ✈
          </span>

          <span>
            OpenRadar
          </span>

        </div>

        <input
          className="search"
          placeholder="Search aircraft, callsign or registration..."
        />

        <div className="status">

          <span
            className={
              radarDown
                ? "dot offline"
                : "dot"
            }
          />

          {radarDown
            ? "OFFLINE"
            : "LIVE"}

        </div>

      </div>

      <div className="render-control">

        <label>
          Aircraft
        </label>

        <select
          value={renderLimit}
          onChange={(event) => {
            setRenderLimit(
              Number(
                event.target.value
              )
            );
          }}
        >
          <option value={50}>
            50
          </option>

          <option value={100}>
            100
          </option>

          <option value={250}>
            250
          </option>

          <option value={500}>
            500
          </option>

          <option value={1000}>
            1000
          </option>

          <option value={99999}>
            ALL
          </option>

        </select>

      </div>

      <div className="aircraft-count">
        ✈ {aircraftCount} aircraft visible
      </div>

      {selectedAircraft && (
        <div className="aircraft-panel">

          <button
            className="aircraft-close"
            onClick={closeAircraft}
          >
            ×
          </button>

          <div className="photo-box">

            {photoLoading && (
              <div className="photo-loading">
                Searching JetPhotos...
              </div>
            )}

            {!photoLoading &&
              photo?.image_url &&
              !photoError && (
                <img
                  src={photo.image_url}
                  className="aircraft-photo"
                  alt={
                    selectedAircraft.registration ||
                    "Aircraft"
                  }
                  onError={() => {
                    console.error(
                      "JetPhotos image failed:",
                      photo.image_url
                    );

                    setPhotoError(true);
                  }}
                />
              )}

            {!photoLoading &&
              (!photo ||
                !photo.image_url ||
                photoError) && (
                <div className="photo-placeholder">

                  <div className="placeholder-icon">
                    ✈
                  </div>

                  <div>
                    No JetPhotos image
                    available
                  </div>

                  {selectedAircraft.registration && (
                    <a
                      href={`https://www.jetphotos.com/showphotos.php?reg=${encodeURIComponent(
                        selectedAircraft.registration
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="jetphotos-link"
                    >
                      Search JetPhotos
                    </a>
                  )}

                </div>
              )}

          </div>

          <div className="aircraft-header">

            <div>

              <div className="aircraft-callsign">
                {selectedAircraft.callsign ||
                  "UNKNOWN"}
              </div>

              <div className="aircraft-registration">
                {selectedAircraft.registration ||
                  "Registration unavailable"}
              </div>

            </div>

            <div className="aircraft-type">
              {selectedAircraft.aircraft_type ||
                "UNKNOWN"}
            </div>

          </div>

          <div className="aircraft-divider" />

          <div className="aircraft-grid">

            <div>
              <span>
                ALTITUDE
              </span>

              <strong>
                {selectedAircraft.altitude ??
                  "—"}

                {typeof selectedAircraft.altitude ===
                "number"
                  ? " ft"
                  : ""}
              </strong>
            </div>

            <div>
              <span>
                SPEED
              </span>

              <strong>
                {selectedAircraft.ground_speed !=
                null
                  ? `${Math.round(
                      selectedAircraft.ground_speed
                    )} kt`
                  : "—"}
              </strong>
            </div>

            <div>
              <span>
                HEADING
              </span>

              <strong>
                {selectedAircraft.heading !=
                null
                  ? `${Math.round(
                      selectedAircraft.heading
                    )}°`
                  : "—"}
              </strong>
            </div>

            <div>
              <span>
                VERTICAL RATE
              </span>

              <strong>
                {selectedAircraft.vertical_rate !=
                null
                  ? `${Math.round(
                      selectedAircraft.vertical_rate
                    )} ft/min`
                  : "—"}
              </strong>
            </div>

            <div>
              <span>
                SQUAWK
              </span>

              <strong
                className={
                  selectedAircraft.squawk ===
                  "7700"
                    ? "danger-text"
                    : selectedAircraft.squawk ===
                      "7600"
                    ? "warning-text"
                    : selectedAircraft.squawk ===
                      "7500"
                    ? "purple-text"
                    : ""
                }
              >
                {selectedAircraft.squawk ||
                  "—"}
              </strong>
            </div>

            <div>
              <span>
                ICAO
              </span>

              <strong>
                {selectedAircraft.icao ||
                  "—"}
              </strong>
            </div>

          </div>

          {selectedAircraft.emergency &&
            selectedAircraft.emergency !==
              "none" && (
              <div className="emergency">
                ⚠ EMERGENCY:{" "}
                {selectedAircraft.emergency}
              </div>
            )}

          {photo?.photographer && (
            <div className="photo-credit">
              Photo:{" "}
              {photo.photographer}
            </div>
          )}

        </div>
      )}

    </div>
  );
}

export default App;