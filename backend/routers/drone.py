from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/status")
async def get_drone_status(request: Request):
    drone_service = request.app.state.drone_service
    telemetry = drone_service.get_telemetry()
    return telemetry
