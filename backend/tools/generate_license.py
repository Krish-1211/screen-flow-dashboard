import json
import sys
from datetime import date
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa


def load_or_create_keys():
    priv_path = Path("license_private.pem")
    pub_path = Path("license_public.pem")

    if priv_path.is_file() and pub_path.is_file():
        private_key = serialization.load_pem_private_key(
            priv_path.read_bytes(), password=None
        )
        return private_key

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()

    priv_path.write_bytes(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )

    pub_path.write_bytes(
        public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )

    return private_key


def generate_license(machine_id: str, max_screens: int, expiry: str, licensee: str):
    private_key = load_or_create_keys()

    payload = {
        "machine_id": machine_id,
        "licensee": licensee,
        "max_screens": max_screens,
        "expiry_date": expiry,
    }

    payload_bytes = json.dumps(payload, sort_keys=True).encode("utf-8")
    signature = private_key.sign(
        payload_bytes,
        padding.PKCS1v15(),
        hashes.SHA256(),
    )

    payload["signature"] = signature.hex()
    out_path = Path("license.json")
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"License written to {out_path.resolve()}")


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python generate_license.py <machine_id> <max_screens> <expiry_date:YYYY-MM-DD> <licensee>")
        sys.exit(1)

    machine_id = sys.argv[1]
    max_screens = int(sys.argv[2])
    expiry_str = sys.argv[3]
    licensee = sys.argv[4]

    # Validate date format
    date.fromisoformat(expiry_str)

    generate_license(machine_id, max_screens, expiry_str, licensee)

