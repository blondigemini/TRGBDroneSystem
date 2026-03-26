from fastapi import APIRouter, Request, HTTPException

from schemas.mission import Mission, MissionCreate, MissionStatus

router = APIRouter()


@router.post("", response_model=Mission)
async def create_mission(data: MissionCreate, request: Request):
    store = request.app.state.mission_store
    return store.create(data)


@router.get("", response_model=list[Mission])
async def list_missions(request: Request):
    store = request.app.state.mission_store
    return store.list_all()


@router.get("/{mission_id}", response_model=Mission)
async def get_mission(mission_id: str, request: Request):
    store = request.app.state.mission_store
    mission = store.get(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    return mission


@router.post("/{mission_id}/start", response_model=Mission)
async def start_mission(mission_id: str, request: Request):
    store = request.app.state.mission_store
    drone = request.app.state.drone_service
    mission = store.update_status(mission_id, MissionStatus.ACTIVE)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    drone.start_mission()
    return mission


@router.post("/{mission_id}/stop", response_model=Mission)
async def stop_mission(mission_id: str, request: Request):
    store = request.app.state.mission_store
    drone = request.app.state.drone_service
    mission = store.update_status(mission_id, MissionStatus.COMPLETED)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    drone.stop_mission()
    return mission
