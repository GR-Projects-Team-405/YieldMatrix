"""Week 2: implement the local AI service. Run: uvicorn main:app --reload --port 8000."""
from fastapi import FastAPI

app = FastAPI(title="YieldMatrix AI Service")

@app.get("/health")
def health():
    return {"status": "ok", "service": "yieldmatrix-ai", "implementation": "Week 2 placeholder"}
