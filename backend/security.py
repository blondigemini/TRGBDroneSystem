# backend/security.py — HMAC-SHA256 frame verification for drone imagery
import hashlib
import hmac
import json
import logging

logger = logging.getLogger("fire-api")

# Shared secret key (in real projects: load from environment variable, not hardcoded)
SECRET_KEY = b"drone_secret_key_2025"


# -----------------------------
# 1) Sign data with HMAC-SHA256
#    (integrity + authenticity)
# -----------------------------
def sign_data(data: bytes) -> str:
    return hmac.new(SECRET_KEY, data, hashlib.sha256).hexdigest()


def verify_signature(data: bytes, received_sig: str) -> bool:
    expected_sig = sign_data(data)
    return hmac.compare_digest(expected_sig, received_sig)


# -----------------------------
# 2) Bundle data + signature
#    (so receiver can verify)
# -----------------------------
def build_secure_payload(data: bytes) -> bytes:
    payload = {
        "data_b64": data.decode("utf-8", errors="replace"),  # simple demo encoding
        "hmac_sha256": sign_data(data)
    }
    return json.dumps(payload).encode("utf-8")


# -----------------------------
# 3) Receiver side verification
#    (this is what was missing)
# -----------------------------
def receiver_verify(payload_bytes: bytes):
    received = json.loads(payload_bytes.decode("utf-8"))
    data = received["data_b64"].encode("utf-8")
    sig = received["hmac_sha256"]

    if verify_signature(data, sig):
        print("[RECEIVER] Integrity OK. Data is authentic.")
        print("[RECEIVER] Content:", received["data_b64"])
    else:
        print("[RECEIVER] ERROR: TAMPER DETECTED — integrity check failed!")
        print("[RECEIVER] Action: Reject image / raise alert.")


# -----------------------------
# 4) verify_frame — adapter for
#    the FastAPI endpoints
# -----------------------------
def verify_frame(image_bytes: bytes, signature: str | None = None) -> dict:
    """
    Verify the integrity and authenticity of a drone frame using HMAC-SHA256.

    Parameters
    ----------
    image_bytes : bytes
        Raw image file bytes.
    signature : str | None
        Hex-encoded HMAC-SHA256 signature. If None the frame is treated as
        unsigned (not a tamper event).

    Returns
    -------
    dict with keys:
        status       : "OK" | "UNSIGNED" | "SIGNATURE_INVALID"
        frame_hash   : hex SHA-256 of image_bytes
        tamper_event : None | {"code": "...", "detail": "..."}
    """
    frame_hash = hashlib.sha256(image_bytes).hexdigest()

    # No signature supplied — treat as unsigned, not a tamper event
    if signature is None:
        return {
            "status": "UNSIGNED",
            "frame_hash": frame_hash,
            "tamper_event": None,
        }

    # HMAC verification
    if verify_signature(image_bytes, signature):
        return {
            "status": "OK",
            "frame_hash": frame_hash,
            "tamper_event": None,
        }
    else:
        return {
            "status": "SIGNATURE_INVALID",
            "frame_hash": frame_hash,
            "tamper_event": {
                "code": "SIGNATURE_INVALID",
                "detail": (
                    "HMAC-SHA256 verification failed — the frame's "
                    "signature does not match its contents. "
                    "Possible in-flight tampering."
                ),
            },
        }


# -----------------------------
# 5) Demo: normal + tampered
# -----------------------------
if __name__ == "__main__":
    sample_data = b"Drone thermal frame: hotspot detected at sector 3B"

    print("=" * 55)
    print("SENDER: build payload (data + HMAC)")
    print("=" * 55)
    payload = build_secure_payload(sample_data)
    print("[SENDER] HMAC:", sign_data(sample_data))
    print("[SENDER] Payload:", payload.decode("utf-8"))

    print("\n" + "=" * 55)
    print("RECEIVER: verify payload")
    print("=" * 55)
    receiver_verify(payload)

    print("\n" + "=" * 55)
    print("TAMPER SIMULATION: attacker modifies data in transit")
    print("=" * 55)
    tampered = json.loads(payload.decode("utf-8"))
    tampered["data_b64"] = "Drone thermal frame: NO hotspot detected"  # modified content
    tampered_payload = json.dumps(tampered).encode("utf-8")

    receiver_verify(tampered_payload)
