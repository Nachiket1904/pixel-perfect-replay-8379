import jwt
from httpx import AsyncClient

from tests.conftest import USER

API = "/api/v1"


async def test_register_sets_cookies_and_me_works(registered: AsyncClient) -> None:
    assert "access_token" in registered.cookies
    assert "refresh_token" in registered.cookies
    r = await registered.get(f"{API}/users/me")
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "asha@example.com"  # normalized
    assert body["role"] == "learner"
    assert "password_hash" not in body


async def test_cookies_are_httponly_and_lax(client: AsyncClient) -> None:
    r = await client.post(f"{API}/auth/register", json=USER)
    cookies = r.headers.get_list("set-cookie")
    assert all("HttpOnly" in c and "SameSite=lax" in c for c in cookies)
    refresh = next(c for c in cookies if c.startswith("refresh_token="))
    assert "Path=/api/v1/auth" in refresh


async def test_duplicate_email_is_rejected(registered: AsyncClient) -> None:
    r = await registered.post(f"{API}/auth/register", json={**USER, "email": "ASHA@example.com"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "EMAIL_TAKEN"


async def test_validation_errors_never_echo_the_password(client: AsyncClient) -> None:
    r = await client.post(f"{API}/auth/register", json={**USER, "password": "short"})
    assert r.status_code == 422
    err = r.json()["error"]
    assert err["code"] == "VALIDATION_ERROR"
    assert err["details"][0]["field"] == "password"
    assert "short" not in r.text


async def test_common_password_is_rejected(client: AsyncClient) -> None:
    r = await client.post(f"{API}/auth/register", json={**USER, "password": "password1"})
    assert r.status_code == 422


async def test_role_cannot_be_set_on_register(client: AsyncClient) -> None:
    r = await client.post(f"{API}/auth/register", json={**USER, "role": "admin"})
    assert r.status_code == 422


async def test_login_errors_do_not_reveal_which_part_was_wrong(registered: AsyncClient) -> None:
    registered.cookies.clear()
    wrong_pw = await registered.post(
        f"{API}/auth/login", json={"email": USER["email"], "password": "nope-nope"}
    )
    no_user = await registered.post(
        f"{API}/auth/login", json={"email": "ghost@example.com", "password": "nope"}
    )
    assert wrong_pw.status_code == no_user.status_code == 401
    assert wrong_pw.json() == no_user.json()


async def test_login_then_me(registered: AsyncClient) -> None:
    registered.cookies.clear()
    r = await registered.post(
        f"{API}/auth/login", json={"email": "asha@example.com", "password": USER["password"]}
    )
    assert r.status_code == 200
    assert (await registered.get(f"{API}/users/me")).status_code == 200


async def test_me_requires_auth(client: AsyncClient) -> None:
    r = await client.get(f"{API}/users/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "NOT_AUTHENTICATED"


async def test_forged_tokens_are_rejected(client: AsyncClient) -> None:
    unsigned = jwt.encode(
        {"sub": "00000000-0000-0000-0000-000000000000", "type": "access"}, key=None, algorithm="none"
    )
    wrong_key = jwt.encode(
        {
            "sub": "00000000-0000-0000-0000-000000000000",
            "type": "access",
            "iss": "padhlo-api",
            "exp": 9999999999,
            "iat": 1,
        },
        "some-other-secret-that-is-long-enough-xxxx",
        algorithm="HS256",
    )
    for token in (unsigned, wrong_key):
        client.cookies.set("access_token", token)
        assert (await client.get(f"{API}/users/me")).status_code == 401


async def test_refresh_rotates_and_detects_reuse(registered: AsyncClient) -> None:
    old_refresh = registered.cookies["refresh_token"]

    r = await registered.post(f"{API}/auth/refresh")
    assert r.status_code == 200
    new_refresh = registered.cookies["refresh_token"]
    assert new_refresh != old_refresh

    # Replaying the old token = theft. It fails AND kills the new token too.
    registered.cookies.set("refresh_token", old_refresh, path="/api/v1/auth")
    assert (await registered.post(f"{API}/auth/refresh")).status_code == 401
    registered.cookies.set("refresh_token", new_refresh, path="/api/v1/auth")
    assert (await registered.post(f"{API}/auth/refresh")).status_code == 401


async def test_logout_revokes_session(registered: AsyncClient) -> None:
    refresh = registered.cookies["refresh_token"]
    r = await registered.post(f"{API}/auth/logout")
    assert r.status_code == 204
    assert (await registered.get(f"{API}/users/me")).status_code == 401
    registered.cookies.set("refresh_token", refresh, path="/api/v1/auth")
    assert (await registered.post(f"{API}/auth/refresh")).status_code == 401


async def test_login_is_rate_limited_per_email(registered: AsyncClient) -> None:
    registered.cookies.clear()
    bad = {"email": USER["email"], "password": "wrong-password"}
    codes = [(await registered.post(f"{API}/auth/login", json=bad)).status_code for _ in range(6)]
    assert codes[:5] == [401] * 5
    assert codes[5] == 429
    last = await registered.post(f"{API}/auth/login", json=bad)
    assert last.json()["error"]["code"] == "RATE_LIMITED"
    assert int(last.headers["retry-after"]) >= 1


async def test_cross_site_writes_are_blocked(client: AsyncClient) -> None:
    r = await client.post(f"{API}/auth/register", json=USER, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    ok = await client.post(f"{API}/auth/register", json=USER, headers={"Origin": "http://localhost:8080"})
    assert ok.status_code == 201


async def test_update_me_only_allows_safe_fields(registered: AsyncClient) -> None:
    r = await registered.patch(f"{API}/users/me", json={"name": "  Asha   K  "})
    assert r.status_code == 200
    assert r.json()["name"] == "Asha K"
    r = await registered.patch(f"{API}/users/me", json={"role": "admin"})
    assert r.status_code == 422


async def test_swagger_behind_a_proxy_is_same_origin(client: AsyncClient) -> None:
    headers = {"Origin": "https://abc-8000.app.github.dev", "X-Forwarded-Host": "abc-8000.app.github.dev"}
    r = await client.post(f"{API}/auth/register", json=USER, headers=headers)
    assert r.status_code == 201
