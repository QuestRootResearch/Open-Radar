from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import httpx

app = FastAPI(title="OpenRadar API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_LAT = 52.5
DEFAULT_LON = -1.5
DEFAULT_RADIUS = 250

JETPHOTOS_API = "http://127.0.0.1:8787"

aircraft = []

fetch_lock = asyncio.Lock()


async def fetch_aircraft(lat: float, lon: float, radius: int):
    global aircraft

    radius = max(10, min(radius, 250))

    url = f"https://api.adsb.lol/v2/point/{lat}/{lon}/{radius}"

    print(
        f"Fetching aircraft: "
        f"{lat:.4f}, {lon:.4f}, {radius} NM"
    )

    try:
        async with fetch_lock:

            async with httpx.AsyncClient(
                timeout=20,
                follow_redirects=True,
            ) as client:

                response = await client.get(url)
                response.raise_for_status()

                data = response.json()

                raw_aircraft = data.get("ac", [])

                new_aircraft = []

                for plane in raw_aircraft:

                    plane_lat = plane.get("lat")
                    plane_lon = plane.get("lon")

                    if plane_lat is None or plane_lon is None:
                        continue

                    new_aircraft.append({
                        "icao": plane.get("hex"),

                        "callsign": (
                            plane.get("flight") or ""
                        ).strip(),

                        "registration": plane.get("r"),
                        "aircraft_type": plane.get("t"),

                        "lat": plane_lat,
                        "lon": plane_lon,

                        "altitude": plane.get("alt_baro"),
                        "ground_speed": plane.get("gs"),
                        "heading": plane.get("track"),

                        "vertical_rate": plane.get(
                            "baro_rate"
                        ),

                        "squawk": plane.get(
                            "squawk"
                        ),

                        "emergency": plane.get(
                            "emergency"
                        ),

                        "category": plane.get(
                            "category"
                        ),

                        "last_seen": plane.get(
                            "seen"
                        ),
                    })

                aircraft = new_aircraft

                print(
                    f"Received {len(aircraft)} aircraft"
                )

    except Exception as e:

        print(
            "Aircraft API error:",
            repr(e)
        )


@app.get("/")
async def root():
    return {
        "status": "online",
        "aircraft": len(aircraft),
    }


@app.get("/api/aircraft")
async def get_aircraft():
    return aircraft


# ============================================================
# JETPHOTOS
# ============================================================

@app.get("/api/photo/{registration}")
async def get_photo(registration: str):

    registration = registration.strip().upper()

    print(
        f"Looking up JetPhotos photo for: {registration}"
    )

    try:

        async with httpx.AsyncClient(
            timeout=20,
            follow_redirects=True,
        ) as client:

            # Ask the local JetPhotos API for photos.
            response = await client.get(
                f"{JETPHOTOS_API}/",
                params={
                    "page": 1,
                    "sort-order": 0,
                    "keywords": registration,
                    "keywords-type": "registration",
                    "keywords-contain": 0,
                },
            )

            response.raise_for_status()

            data = response.json()

            photos = data.get("photos", [])

            print(
                f"JetPhotos returned {len(photos)} photos"
            )

            # IMPORTANT:
            # The JetPhotos API currently appears to ignore
            # the registration search and returns unrelated
            # photos, so filter them ourselves.
            matching = []

            for photo in photos:

                photo_registration = (
                    photo.get("registration") or ""
                ).strip().upper()

                if photo_registration == registration:
                    matching.append(photo)

            print(
                f"Found {len(matching)} matching photos "
                f"for {registration}"
            )

            if not matching:

                return {
                    "found": False,
                    "registration": registration,
                    "photo": None,
                }

            # Return the first matching photo.
            photo = matching[0]

            return {
                "found": True,
                "registration": registration,
                "photo": {
                    "photoId": photo.get("photoId"),
                    "thumbnailUrl": photo.get(
                        "thumbnailUrl"
                    ),
                    "imageUrl": photo.get(
                        "imageUrl"
                    ),
                    "photoPageUrl": photo.get(
                        "photoPageUrl"
                    ),
                    "aircraftType": photo.get(
                        "aircraftType"
                    ),
                    "photographer": photo.get(
                        "photographer"
                    ),
                    "location": photo.get(
                        "location"
                    ),
                    "photoDate": photo.get(
                        "photoDate"
                    ),
                },
            }

    except Exception as e:

        print(
            "JetPhotos error:",
            repr(e)
        )

        return {
            "found": False,
            "registration": registration,
            "photo": None,
            "error": str(e),
        }


# ============================================================
# WEBSOCKET
# ============================================================

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket
):

    await websocket.accept()

    print("WebSocket connected")

    current_lat = DEFAULT_LAT
    current_lon = DEFAULT_LON
    current_radius = DEFAULT_RADIUS

    try:

        while True:

            try:

                message = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=5,
                )

                if message.get("type") == "viewport":

                    current_lat = float(
                        message.get(
                            "lat",
                            current_lat,
                        )
                    )

                    current_lon = float(
                        message.get(
                            "lon",
                            current_lon,
                        )
                    )

                    current_radius = int(
                        message.get(
                            "radius",
                            current_radius,
                        )
                    )

                    print(
                        "New map area:",
                        current_lat,
                        current_lon,
                        current_radius,
                    )

                    await fetch_aircraft(
                        current_lat,
                        current_lon,
                        current_radius,
                    )

            except asyncio.TimeoutError:

                await fetch_aircraft(
                    current_lat,
                    current_lon,
                    current_radius,
                )

            await websocket.send_json(
                aircraft
            )

    except Exception as e:

        print(
            "WebSocket disconnected:",
            repr(e),
        )
