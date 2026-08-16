# OpenRadar

OpenRadar is a real-time aircraft tracking application with a web-based map interface.

It displays live aircraft information, including callsign, registration, aircraft type, altitude, speed, heading, vertical rate, squawk and emergency status.

The project also includes aircraft photography through a separate photos API.

## Features

- Live aircraft tracking
- Interactive MapLibre map
- WebSocket-based live updates
- Aircraft registration and callsign information
- Aircraft type detection
- Aircraft heading and movement
- Squawk and emergency detection
- Aircraft photo lookup
- Real-time aircraft following
- Adjustable aircraft rendering limit
- Radar connection status
- Windows start and stop scripts

## Project Structure

```text
OpenRadar/
│
├── backend/
│   ├── .venv/
│   ├── main.py
│   ├── start.bat
│   └── stop.bat
│
├── frontend/
│   ├── package.json
│   └── ...
│
└── photos-api/
    ├── package.json
    └── ...
```

## Requirements

- Windows 10 or Windows 11
- Python 3.10 or newer
- Node.js
- npm

## Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/OpenRadar.git
cd OpenRadar
```

### Backend

```bat
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend

Open a new terminal:

```bat
cd frontend
npm install
```

### Photos API

```bat
cd photos-api
npm install
```

## Starting OpenRadar

The easiest way to start the entire project is to use:

```text
backend/start.bat
```

The script starts all three services automatically.

### Backend

```text
http://127.0.0.1:8000
```

### Frontend

```text
http://localhost:5173
```

### Photos API

The photos API is started using:

```bash
npm start
```

## Stopping OpenRadar

Use:

```text
backend/stop.bat
```

This stops the OpenRadar backend, frontend and photos API.

## Manual Startup

If you don't want to use the batch files, the services can be started manually.

### Backend

```bat
cd backend
.venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

### Frontend

```bat
cd frontend
npm run dev -- --host 0.0.0.0
```

### Photos API

```bat
cd photos-api
npm start
```

## Aircraft Photos

When an aircraft is selected, OpenRadar sends its registration to the photos API.

The API returns the available aircraft image and related information.

If an image cannot be found, OpenRadar provides a JetPhotos search link instead.

## Technologies

### Frontend

- React
- TypeScript
- Vite
- MapLibre GL

### Backend

- Python
- FastAPI
- Uvicorn
- WebSockets

### Photos API

- Node.js
- npm

## UI

The OpenRadar UI was made with assistance from AI.

The project functionality, backend, aircraft tracking and integration were developed separately.

## Screenshots

Screenshots will be added here.

## Contributing

Pull requests and suggestions are welcome.

If you find a bug, open an issue with steps to reproduce it and any relevant console errors.

## Disclaimer

OpenRadar uses third-party services and data sources.

Aircraft photographs and external data may be subject to their respective providers' terms and conditions.

OpenRadar does not claim ownership of third-party photographs or data.

## License

See the LICENSE file for license information.
