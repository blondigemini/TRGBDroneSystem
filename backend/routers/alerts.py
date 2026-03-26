from fastapi import APIRouter, Request, HTTPException

from schemas.alert import Alert, AlertSeverity, AlertStats

router = APIRouter()


@router.get("", response_model=list[Alert])
async def list_alerts(
    request: Request,
    severity: AlertSeverity | None = None,
    limit: int = 50,
    offset: int = 0,
):
    manager = request.app.state.alert_manager
    return manager.get_alerts(severity=severity, limit=limit, offset=offset)


@router.post("/{alert_id}/acknowledge", response_model=Alert)
async def acknowledge_alert(alert_id: str, request: Request):
    manager = request.app.state.alert_manager
    alert = manager.acknowledge(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.get("/stats", response_model=AlertStats)
async def alert_stats(request: Request):
    manager = request.app.state.alert_manager
    return manager.get_stats()
