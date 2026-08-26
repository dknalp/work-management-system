"""Webhook dispatcher — sends HTTP POST notifications to all active subscribers.

Webhooks are registered by bot accounts.  When an event occurs, call
``fire_webhooks(event, data)`` to fan out the notification to all bots
that subscribed to that event.

This is a fire-and-forget utility: delivery failures are silently swallowed
so they never affect the calling request.

Security
--------
All webhook URLs are validated before dispatch to prevent SSRF attacks.
Only ``https://`` (and ``http://`` for development) URLs pointing to public
IP addresses are allowed.  Private, loopback, and link-local ranges are
blocked at the network level (RFC 1918 / RFC 3927).
"""

import hashlib
import hmac
import ipaddress
import json
import logging
import socket
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx

from .firebase import get_db

_logger = logging.getLogger(__name__)

# Private / reserved IP ranges that must never be targeted by a webhook.
# Covers loopback, link-local, private (RFC 1918), and the AWS IMDS address.
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),      # loopback
    ipaddress.ip_network("::1/128"),           # IPv6 loopback
    ipaddress.ip_network("10.0.0.0/8"),        # RFC 1918
    ipaddress.ip_network("172.16.0.0/12"),     # RFC 1918
    ipaddress.ip_network("192.168.0.0/16"),    # RFC 1918
    ipaddress.ip_network("169.254.0.0/16"),    # link-local / AWS IMDS
    ipaddress.ip_network("fd00::/8"),          # IPv6 unique-local
    ipaddress.ip_network("fe80::/10"),         # IPv6 link-local
    ipaddress.ip_network("0.0.0.0/8"),         # "this" network
]


def _is_safe_webhook_url(url: str) -> bool:
    """Return True only if ``url`` is safe to use as a webhook target.

    Checks performed:
    - Scheme must be ``https`` or ``http`` (no ``file://``, ``ftp://``, etc.)
    - Hostname must resolve to a public IP address
    - Resolved address must not fall in any private / reserved range

    Returns False (rather than raising) so that malformed or blocked URLs
    are silently skipped — the dispatcher logs a warning instead of crashing.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return False

    if parsed.scheme not in ("http", "https"):
        _logger.warning("Webhook blocked — disallowed scheme: %s", parsed.scheme)
        return False

    hostname = parsed.hostname
    if not hostname:
        return False

    try:
        # Resolve to an IP address; use the first result.
        resolved_ip = ipaddress.ip_address(socket.gethostbyname(hostname))
    except (socket.gaierror, ValueError):
        _logger.warning("Webhook blocked — hostname could not be resolved: %s", hostname)
        return False

    for network in _BLOCKED_NETWORKS:
        if resolved_ip in network:
            _logger.warning(
                "Webhook blocked — target resolves to private/reserved address %s (network %s)",
                resolved_ip,
                network,
            )
            return False

    return True


def _build_payload(event: str, data: Any) -> dict:
    """Wrap an event payload in the standard envelope."""
    return {
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }


def _sign_payload(secret: str, body: bytes) -> str:
    """Return the HMAC-SHA256 signature header value for the given body."""
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def fire_webhooks(event: str, data: Any) -> None:
    """Look up all active webhook subscriptions and POST the event payload to each.

    Uses the shared Firestore client to query ``webhooks`` for subscriptions
    that include ``event`` in their ``events`` list.  Delivery failures are
    silently swallowed — this is a best-effort notification system.

    Parameters
    ----------
    event:
        The event name (e.g. ``'task.created'``).
    data:
        The event payload (must be JSON-serializable).
    """
    db = get_db()
    webhook_docs = db.collection("webhooks").where("is_active", "==", True).stream()

    matching = []
    for doc in webhook_docs:
        doc_data = doc.to_dict() or {}
        if event in (doc_data.get("events") or []):
            matching.append(doc_data)

    if not matching:
        return

    payload = _build_payload(event, data)
    body = json.dumps(payload, default=str).encode()

    with httpx.Client(timeout=5.0, follow_redirects=False) as client:
        for wh in matching:
            url = wh.get("url", "")

            # Block SSRF: validate the URL resolves to a public IP before POSTing.
            if not _is_safe_webhook_url(url):
                continue

            headers = {
                "Content-Type": "application/json",
                "X-WorkSync-Event": event,
            }
            secret = wh.get("secret")
            if secret:
                headers["X-WorkSync-Signature"] = _sign_payload(secret, body)
            try:
                client.post(url, content=body, headers=headers)
            except Exception as exc:
                _logger.warning("Webhook delivery failed for %s: %s", url, exc)