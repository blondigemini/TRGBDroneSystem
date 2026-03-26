import math
import random
from datetime import datetime, timezone

from schemas.telemetry import DroneTelemetry, GPSCoord
import config


class MockDroneService:
    def __init__(self):
        self.tick = 0
        self.battery = 100
        self.mission_active = False
        self.camera_mode = "thermal"
        self.center_lat = config.DRONE_CENTER_LAT
        self.center_lng = config.DRONE_CENTER_LNG
        self.flight_path: list[GPSCoord] = []

    def start_mission(self):
        self.mission_active = True
        self.battery = 100
        self.tick = 0
        self.flight_path = []

    def stop_mission(self):
        self.mission_active = False

    def get_telemetry(self) -> DroneTelemetry:
        self.tick += 1

        if self.mission_active:
            self.battery = max(0, self.battery - 0.05)

        # Lawnmower flight pattern
        t = self.tick * 0.02
        row = int(t) % 10
        progress = t - int(t)
        direction = 1 if row % 2 == 0 else -1

        lat_offset = (row - 5) * 0.0005
        lng_offset = (progress * direction - 0.5) * 0.005

        lat = self.center_lat + lat_offset
        lng = self.center_lng + lng_offset

        # Add slight noise
        lat += random.uniform(-0.00002, 0.00002)
        lng += random.uniform(-0.00002, 0.00002)

        gps = GPSCoord(lat=round(lat, 6), lng=round(lng, 6))

        if self.mission_active:
            self.flight_path.append(gps)

        altitude = 65 + 15 * math.sin(t * 0.5)
        speed = random.uniform(8, 12) if self.mission_active else 0.0
        heading = (math.degrees(math.atan2(lng_offset, lat_offset)) + 360) % 360
        signal = random.randint(75, 100)

        return DroneTelemetry(
            timestamp=datetime.now(timezone.utc),
            gps=gps,
            altitude_m=round(altitude, 1),
            speed_mps=round(speed, 1),
            heading_deg=round(heading, 1),
            battery_pct=int(self.battery),
            signal_strength=signal,
            camera_mode=self.camera_mode,
        )
