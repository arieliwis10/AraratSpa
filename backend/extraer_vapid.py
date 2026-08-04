from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
import base64

# --- Clave privada ---
with open("private_key.pem", "rb") as f:
    private_key = serialization.load_pem_private_key(f.read(), password=None)

private_numbers = private_key.private_numbers()
raw_private = private_numbers.private_value.to_bytes(32, byteorder="big")
private_b64 = base64.urlsafe_b64encode(raw_private).rstrip(b'=').decode('utf-8')

# --- Clave pública ---
with open("public_key.pem", "rb") as f:
    public_key = serialization.load_pem_public_key(f.read())

public_numbers = public_key.public_numbers()
raw_public = public_key.public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint
)
public_b64 = base64.urlsafe_b64encode(raw_public).rstrip(b'=').decode('utf-8')

print("VAPID_PRIVATE_KEY =", private_b64)
print("VITE_VAPID_PUBLIC_KEY =", public_b64)