from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from solver import generate_mechanism

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/generate")
async def generate(data: dict):
    return generate_mechanism(data["points"])