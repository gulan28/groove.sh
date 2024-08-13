import os
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import asyncio

MUSIC_FOLDER = "music"
SECONDS_TILL_NEXT_TRACK = 30
current_path = Path(__file__).resolve().parent

# Cache for music files by genre
music_files_cache = {}
last_cache_time = {}
current_tracks = {}

# WebSocket connections and visitor count
active_connections: set[WebSocket] = set()
visitor_count = 0

def get_music_files(genre):
    current_time = time.time()
    
    if (genre not in music_files_cache or 
        genre not in last_cache_time or 
        current_time - last_cache_time[genre] >= SECONDS_TILL_NEXT_TRACK):
        
        genre_path = current_path / MUSIC_FOLDER / genre
        if not genre_path.is_dir():
            return []
        
        music_files_cache[genre] = sorted(
            [f for f in os.listdir(genre_path) if f.endswith(".mp3")],
            key=lambda x: x.split(".")[0]
        )
        last_cache_time[genre] = current_time
    
    return music_files_cache[genre]

def get_genres():
    return [d for d in os.listdir(current_path / MUSIC_FOLDER) 
            if (current_path / MUSIC_FOLDER / d).is_dir()]

async def track_incrementer():
    while True:
        await asyncio.sleep(SECONDS_TILL_NEXT_TRACK)
        for genre in get_genres():
            music_files = get_music_files(genre)
            if music_files:
                current_tracks[genre] = (current_tracks.get(genre, 0) % len(music_files)) + 1
        print(current_tracks)

async def broadcast_visitor_count():
    for connection in active_connections:
        await connection.send_json({"type": "visitor_count", "count": visitor_count})

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(track_incrementer())
    yield
    task.cancel()

app = FastAPI(lifespan=lifespan)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global visitor_count
    await websocket.accept()
    active_connections.add(websocket)
    visitor_count += 1
    await broadcast_visitor_count()
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        visitor_count -= 1
        await broadcast_visitor_count()

@app.get("/{genre}/current.mp3")
async def get_current_track(genre: str):
    music_files = get_music_files(genre)
    if not music_files:
        raise HTTPException(status_code=404, detail=f"No music files found for genre: {genre}")
    
    if genre not in current_tracks:
        current_tracks[genre] = 1
    
    file_path = current_path / MUSIC_FOLDER / genre / music_files[current_tracks[genre] - 1]
    return FileResponse(file_path, media_type="audio/mpeg")

@app.get("/genres")
async def list_genres():
    return {"genres": get_genres()}

app.mount("/", StaticFiles(directory="web", html=True), name="web")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)