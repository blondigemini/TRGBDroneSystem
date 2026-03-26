import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import config

router = APIRouter()


@router.websocket("/ws/feed")
async def websocket_feed(websocket: WebSocket):
    await websocket.accept()

    drone_service = websocket.app.state.drone_service
    detector_service = websocket.app.state.detector_service
    alert_manager = websocket.app.state.alert_manager
    mission_store = websocket.app.state.mission_store

    tick = 0
    paused = False

    async def send_json(msg_type: str, data: dict):
        await websocket.send_text(json.dumps({"type": msg_type, "data": data}))

    try:
        while True:
            # Check for incoming commands (non-blocking)
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.05)
                msg = json.loads(raw)
                cmd = msg.get("command")
                if cmd == "pause_feed":
                    paused = True
                elif cmd == "resume_feed":
                    paused = False
                elif cmd == "set_camera_mode":
                    drone_service.camera_mode = msg.get("mode", "thermal")
            except asyncio.TimeoutError:
                pass

            if paused:
                await asyncio.sleep(config.WS_TICK_INTERVAL)
                continue

            tick += 1

            # Always send telemetry
            telemetry = drone_service.get_telemetry()
            await send_json("telemetry_update", telemetry.model_dump(mode="json"))

            # Send detection every N ticks
            if tick % config.DETECTION_EVERY_N_TICKS == 0:
                detection = detector_service.get_detection()
                await send_json("detection_result", detection.model_dump(mode="json"))

                # Generate alert if fire detected
                if detection.classification == "fire" and detection.confidence > 0.3:
                    # Find active mission
                    active_mission_id = None
                    for m in mission_store.list_all():
                        if m.status.value == "active":
                            active_mission_id = m.id
                            mission_store.record_detection(m.id, is_alert=True)
                            break

                    alert = alert_manager.create_alert(
                        detection=detection,
                        gps=telemetry.gps,
                        mission_id=active_mission_id,
                    )
                    await send_json("alert", alert.model_dump(mode="json"))

            await asyncio.sleep(config.WS_TICK_INTERVAL)

    except WebSocketDisconnect:
        pass
