from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.license_service import (
    LicenseInfo,
    load_and_validate_license,
)


class LicenseResponse(BaseModel):
    licensee: str
    max_screens: int
    expiry_date: date
    tier: str
    valid: bool
    reason: Optional[str] = None


router = APIRouter()


@router.get("/current", response_model=LicenseResponse)
def get_current_license():
    license_path = Path("license.json")
    if not license_path.is_file():
        raise HTTPException(status_code=404, detail="License file not found")
    info: LicenseInfo = load_and_validate_license(license_path)
    return LicenseResponse(
        licensee=info.licensee,
        max_screens=info.max_screens,
        expiry_date=info.expiry_date,
        tier=info.tier,
        valid=info.valid,
        reason=info.reason,
    )

