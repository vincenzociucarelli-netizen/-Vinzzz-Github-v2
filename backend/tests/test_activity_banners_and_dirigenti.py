"""Test suite for iteration 101:
   - Activity banners visible in athlete/parent commitments payloads
   - assign-dirigenti with 3 dirigenti persists all 3
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://zaino-coach-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
UNDER14_ID = "697fec5d90eef140898ebfd7"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text[:200]}"
    body = r.json()
    return body.get("token") or body.get("access_token")


@pytest.fixture(scope="module")
def admin_token():
    return _login("vincenzo.ciucarelli@gmail.com", "Test1234")


@pytest.fixture(scope="module")
def coach_token():
    return _login("alice@test.com", "Test1234")


class TestActivityBanners:
    """Banner 'Inizio allenamenti' devono essere presenti nei payload commitments."""

    def test_coach_commitments_has_activity_banners(self, coach_token):
        r = requests.get(f"{API}/coach/commitments", headers={"Authorization": f"Bearer {coach_token}"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "activity_banners" in data, f"activity_banners missing: keys={list(data.keys())}"
        banners = data["activity_banners"]
        assert isinstance(banners, list)
        # Alice è assegnata a Under 14 con activity_start_date=2026-09-05
        u14 = [b for b in banners if b.get("team_id") == UNDER14_ID]
        assert len(u14) >= 1, f"Under 14 banner missing. Banners: {banners}"
        b = u14[0]
        assert "Under 14" in b.get("team_name", ""), f"team_name mismatch: {b}"
        assert b.get("start_label"), f"start_label missing: {b}"
        # Formato atteso: 05/09/2026
        assert "2026" in b["start_label"]

    def test_admin_get_team_has_activity_start_date(self, admin_token):
        r = requests.get(f"{API}/teams/{UNDER14_ID}", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        t = r.json()
        assert t.get("activity_start_date"), f"activity_start_date missing on Under 14: {t.get('activity_start_date')}"


class TestAssignDirigenti3x:
    """Assegnare 3 dirigenti deve persistere tutti e 3."""

    def test_get_dirigenti_pool(self, admin_token):
        r = requests.get(f"{API}/users/dirigenti", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        pool = r.json()
        assert isinstance(pool, list)
        assert len(pool) >= 3, f"Need >=3 dirigenti in pool, got {len(pool)}"

    def test_assign_three_dirigenti_persists(self, admin_token):
        H = {"Authorization": f"Bearer {admin_token}"}
        pool = requests.get(f"{API}/users/dirigenti", headers=H, timeout=30).json()
        # Prefer the 3 mentioned nel request se presenti
        wanted_names = ["CIUCHETTI VINZZZZ", "COORD TEST", "TEST DIRIGENTE"]
        selected = []
        for name in wanted_names:
            match = next((p for p in pool if p.get("full_name", "").strip().upper() == name.upper()), None)
            if match:
                selected.append(match["id"])
        # fallback: take first 3
        if len(selected) < 3:
            for p in pool:
                if p["id"] not in selected:
                    selected.append(p["id"])
                if len(selected) >= 3:
                    break
        assert len(selected) >= 3, "not enough dirigenti to test"
        ids = selected[:3]
        # POST assign
        r = requests.post(f"{API}/teams/{UNDER14_ID}/assign-dirigenti", headers=H, json={"ids": ids}, timeout=30)
        assert r.status_code in (200, 201), f"assign failed: {r.status_code} {r.text[:300]}"
        # GET team → dirigenti_info deve avere 3
        t = requests.get(f"{API}/teams/{UNDER14_ID}", headers=H, timeout=30).json()
        info = t.get("dirigenti_info") or []
        info_ids = {d.get("id") for d in info}
        for want in ids:
            assert want in info_ids, f"dirigente {want} not persisted. Got: {info_ids}"
        assert len(info) >= 3, f"expected 3+, got {len(info)}: {[d.get('full_name') for d in info]}"
