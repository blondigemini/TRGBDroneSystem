import uuid
from collections import deque
from datetime import datetime, timezone

from schemas.alert import Alert, AlertSeverity, AlertStats
from schemas.detection import DetectionResult
from schemas.telemetry import GPSCoord


def _severity_from_confidence(confidence: float) -> AlertSeverity:
    if confidence > 0.9:
        return AlertSeverity.CRITICAL
    elif confidence > 0.75:
        return AlertSeverity.HIGH
    elif confidence > 0.5:
        return AlertSeverity.MEDIUM
    return AlertSeverity.LOW


def _message_for_severity(severity: AlertSeverity, confidence: float) -> str:
    pct = int(confidence * 100)
    messages = {
        AlertSeverity.CRITICAL: f"CRITICAL: Fire hotspot detected with {pct}% confidence. Immediate action required.",
        AlertSeverity.HIGH: f"HIGH: Probable fire hotspot detected ({pct}% confidence). Investigate immediately.",
        AlertSeverity.MEDIUM: f"MEDIUM: Possible fire activity detected ({pct}% confidence). Monitor closely.",
        AlertSeverity.LOW: f"LOW: Minor thermal anomaly detected ({pct}% confidence). Continue monitoring.",
    }
    return messages[severity]


class AlertManager:
    def __init__(self, max_alerts: int = 200):
        self.alerts: deque[Alert] = deque(maxlen=max_alerts)

    def create_alert(
        self, detection: DetectionResult, gps: GPSCoord, mission_id: str | None = None
    ) -> Alert:
        severity = _severity_from_confidence(detection.confidence)
        alert = Alert(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(timezone.utc),
            severity=severity,
            message=_message_for_severity(severity, detection.confidence),
            gps=gps,
            detection=detection,
            acknowledged=False,
            mission_id=mission_id,
        )
        self.alerts.appendleft(alert)
        return alert

    def get_alerts(
        self,
        severity: AlertSeverity | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Alert]:
        filtered = list(self.alerts)
        if severity:
            filtered = [a for a in filtered if a.severity == severity]
        return filtered[offset : offset + limit]

    def acknowledge(self, alert_id: str) -> Alert | None:
        for alert in self.alerts:
            if alert.id == alert_id:
                alert.acknowledged = True
                return alert
        return None

    def get_stats(self) -> AlertStats:
        stats = AlertStats()
        for alert in self.alerts:
            if alert.severity == AlertSeverity.CRITICAL:
                stats.critical += 1
            elif alert.severity == AlertSeverity.HIGH:
                stats.high += 1
            elif alert.severity == AlertSeverity.MEDIUM:
                stats.medium += 1
            elif alert.severity == AlertSeverity.LOW:
                stats.low += 1
        stats.total = stats.critical + stats.high + stats.medium + stats.low
        return stats
