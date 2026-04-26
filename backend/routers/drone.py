from fastapi import APIRouter, HTTPException, Request

router = APIRouter()


@router.get("/status")
async def get_drone_status(request: Request):
    drone_service = getattr(request.app.state, "drone_service", None)
    if drone_service is None:
        raise HTTPException(status_code=503, detail="Drone service unavailable")
    return drone_service.get_telemetry()
