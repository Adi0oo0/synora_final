"""Firebase Admin bootstrap: ID-token verification and the Firestore handle.

Everything here is optional. ``firebase.init()`` returns False when there are no
credentials (or ``firebase-admin`` is not installed) and the rest of the app
carries on without auth or persistence, the same way it does without a NIM key.

``firebase_admin`` is imported lazily so the package is only needed when
Firebase is actually switched on.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from dataclasses import dataclass
from typing import Any

from app.config import get_settings

log = logging.getLogger("zenhealth.firebase")


class AuthError(Exception):
    """The bearer token could not be verified."""


@dataclass(frozen=True)
class AuthUser:
    uid: str
    email: str | None = None
    name: str | None = None


class FirebaseService:
    def __init__(self) -> None:
        self.ready = False
        self._app: Any = None
        self._db: Any = None

    # ── setup ────────────────────────────────────────────────────────────
    @property
    def configured(self) -> bool:
        s = get_settings()
        return bool(
            s.firebase_credentials_json
            or s.firebase_credentials_path
            or s.firebase_use_adc
            or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        )

    @staticmethod
    def _credential(credentials: Any, s: Any) -> Any:
        if s.firebase_credentials_json:
            raw = s.firebase_credentials_json.strip()
            if not raw.startswith("{"):
                raw = base64.b64decode(raw).decode("utf-8")
            return credentials.Certificate(json.loads(raw))
        if s.firebase_credentials_path:
            return credentials.Certificate(s.firebase_credentials_path)
        return credentials.ApplicationDefault()

    def init(self) -> bool:
        """Idempotent and cheap: no network calls happen here."""
        if self.ready:
            return True
        if not self.configured:
            log.info("firebase not configured: running without auth or persistence")
            return False
        try:
            import firebase_admin
            from firebase_admin import credentials
        except ImportError:
            log.error("firebase-admin is not installed: pip install -r requirements.txt")
            return False

        s = get_settings()
        try:
            try:
                self._app = firebase_admin.get_app()  # e.g. after a --reload
            except ValueError:
                options = {"projectId": s.firebase_project_id} if s.firebase_project_id else None
                self._app = firebase_admin.initialize_app(self._credential(credentials, s), options)
            self.ready = True
        except Exception as exc:  # bad path, malformed JSON, bad base64 ...
            # Never log the exception text here: it can echo credential fragments.
            log.error("firebase init failed (%s): check the FIREBASE_* settings", type(exc).__name__)
            return False
        log.info("firebase ready")
        return True

    def shutdown(self) -> None:
        if self._app is not None:
            try:
                import firebase_admin

                firebase_admin.delete_app(self._app)
            except Exception:  # noqa: BLE001 - best effort on the way out
                pass
        self._app, self._db, self.ready = None, None, False

    # ── auth ─────────────────────────────────────────────────────────────
    async def verify(self, token: str) -> AuthUser:
        if not self.ready:
            raise AuthError("firebase not ready")
        from firebase_admin import auth

        s = get_settings()
        try:
            decoded = await asyncio.to_thread(
                auth.verify_id_token,
                token,
                app=self._app,
                check_revoked=s.firebase_check_revoked,
                clock_skew_seconds=10,  # dev machines drift; avoids "token used too early"
            )
        except Exception as exc:  # expired, malformed, revoked, wrong project, cert fetch ...
            raise AuthError(type(exc).__name__) from exc
        uid = decoded.get("uid") or decoded.get("sub")
        if not uid:
            raise AuthError("token has no uid")
        return AuthUser(uid=uid, email=decoded.get("email"), name=decoded.get("name"))

    # ── firestore ────────────────────────────────────────────────────────
    def db(self) -> Any:
        if not self.ready:
            raise RuntimeError("firebase not ready")
        if self._db is None:
            from firebase_admin import firestore

            self._db = firestore.client(app=self._app)
        return self._db


firebase = FirebaseService()
