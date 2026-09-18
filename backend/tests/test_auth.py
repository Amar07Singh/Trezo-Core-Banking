from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)
from app.models.user import UserRole


def test_password_hashing():
    raw_password = "SuperSecurePassword123!"
    hashed = get_password_hash(raw_password)
    assert hashed != raw_password
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_jwt_token_generation_and_decoding():
    payload = {"sub": "123e4567-e89b-12d3-a456-426614174000", "role": UserRole.ADMIN.value}
    token = create_access_token(payload)
    decoded = decode_access_token(token)
    assert decoded["sub"] == payload["sub"]
    assert decoded["role"] == UserRole.ADMIN.value
    assert "exp" in decoded
    assert "iat" in decoded
