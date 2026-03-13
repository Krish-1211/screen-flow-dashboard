import json
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey


@dataclass
class LicenseInfo:
    licensee: str
    max_screens: int
    expiry_date: date
    tier: str
    valid: bool
    reason: Optional[str] = None


TIER_MAP: dict[int, str] = {
    10: "Starter",
    20: "Growth",
    50: "Business",
}


def _load_public_key() -> RSAPublicKey:
    pub_path = Path("license_public.pem")
    if not pub_path.is_file():
        raise RuntimeError("Public key file license_public.pem not found")
    with pub_path.open("rb") as f:
        return serialization.load_pem_public_key(f.read())  # type: ignore[return-value]


def load_and_validate_license(path: Path) -> LicenseInfo:
    data = json.loads(path.read_text("utf-8"))
    signature_b64 = data.pop("signature", None)
    if not signature_b64:
        return LicenseInfo(
            licensee=data.get("licensee", ""),
            max_screens=int(data.get("max_screens", 0)),
            expiry_date=date.fromisoformat(data.get("expiry_date")),
            tier="",
            valid=False,
            reason="Missing signature",
        )

    payload = json.dumps(data, sort_keys=True).encode("utf-8")
    signature = bytes.fromhex(signature_b64)

    pub = _load_public_key()
    try:
        pub.verify(
            signature,
            payload,
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
    except Exception:
        return LicenseInfo(
            licensee=data.get("licensee", ""),
            max_screens=int(data.get("max_screens", 0)),
            expiry_date=date.fromisoformat(data.get("expiry_date")),
            tier="",
            valid=False,
            reason="Invalid signature",
        )

    expiry = date.fromisoformat(data["expiry_date"])
    if expiry < datetime.utcnow().date():
        tier = TIER_MAP.get(int(data["max_screens"]), "Enterprise")
        return LicenseInfo(
            licensee=data.get("licensee", ""),
            max_screens=int(data["max_screens"]),
            expiry_date=expiry,
            tier=tier,
            valid=False,
            reason="License expired",
        )

    max_screens = int(data["max_screens"])
    tier = TIER_MAP.get(max_screens, "Enterprise")
    return LicenseInfo(
        licensee=data.get("licensee", ""),
        max_screens=max_screens,
        expiry_date=expiry,
        tier=tier,
        valid=True,
        reason=None,
    )

