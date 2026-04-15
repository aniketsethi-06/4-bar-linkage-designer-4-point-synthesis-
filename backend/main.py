import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.solver import generate_mechanism
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

@app.post("/generate")
async def generate(data: dict):
    return generate_mechanism(data["points"])

@app.get("/")
def serve():
    return FileResponse(os.path.join(BASE_DIR, "static/index.html"))

@app.get("/favicon.ico")
def favicon():
    return {}