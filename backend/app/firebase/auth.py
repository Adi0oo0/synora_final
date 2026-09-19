"""FastAPI dependencies for Firebase ID tokens.

Two flavours, on purpose:

* ``current_user`` is optional. The AI routes (triage, chat, meals) stay open to
  anonymous callers, because a symptom check must never sit behind a login. A
  missing, expired or invalid token simply means "anonymous": the request is
  answered and nothing is saved. An expired token can never block an emergency
  screen.
* ``require_user`` is strict. Anything that reads or deletes stored history
  needs a verified token.
"""

from __future__ import annotations

import logging

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.firebase.client import AuthError, AuthUser, firebase

log = logging.getLogger("zenhealth.auth")

_bearer = HTTPBearer(auto_error=False)


async def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> AuthUser | None:
    if creds is None or not firebase.ready:
        return None
    try:
        return await firebase.verify(creds.credentials)
    except AuthError as exc:
        log.info("ignoring unverifiable token (%s); treating request as anonymous", exc)
        return None


async def require_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> AuthUser:
    if not firebase.ready:
        raise HTTPException(status_code=503, detail="Firebase is not configured on this server.")
    if creds is None:
        raise HTTPException(status_code=401, detail="Sign in required.", headers={"WWW-Authenticate": "Bearer"})
    try:
        return await firebase.verify(creds.credentials)
    except AuthError as exc:
        log.info("rejected token (%s)", exc)
        raise HTTPException(
            status_code=401, detail="Invalid or expired token.", headers={"WWW-Authenticate": "Bearer"}
        ) from exc
