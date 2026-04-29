"""
Pydantic models for society and Stripe settings.
"""
from typing import List, Optional
from pydantic import BaseModel


class SocietySettingsUpdate(BaseModel):
    name: Optional[str] = None
    logo: Optional[str] = None  # Base64 encoded image
    logo_size: Optional[int] = None  # Logo size in pixels
    sport_image: Optional[str] = None  # Base64 encoded image of the sport
    athlete_roles: Optional[List[str]] = None
    athlete_characteristics: Optional[List[str]] = None
    dirigente_qualifications: Optional[List[str]] = None
    venues: Optional[List[dict]] = None  # [{name, address, city}]
    # Fiscal receipt fields
    ragione_sociale: Optional[str] = None
    sport_praticato: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    fiscal_code: Optional[str] = None
    partita_iva: Optional[str] = None
    phone: Optional[str] = None
    phone2: Optional[str] = None
    president_name: Optional[str] = None
    stamp_signature: Optional[str] = None
    email: Optional[str] = None
    pec: Optional[str] = None
    pro_enabled: Optional[bool] = None
    # Season settings
    season_start_month: Optional[int] = None
    season_start_day: Optional[int] = None
    block_expired_certificates: Optional[bool] = None
    season_end_month: Optional[int] = None
    season_end_day: Optional[int] = None
    # Banking & affiliation data
    iban: Optional[str] = None
    bank_name: Optional[str] = None
    affiliations: Optional[List[dict]] = None  # [{name, number}]
    # Trial period settings
    trial_max_days: Optional[int] = None  # 3-15
    trial_max_sessions: Optional[int] = None  # 1-5


class StripeSettingsUpdate(BaseModel):
    """Stripe payment settings."""
    stripe_enabled: bool = False
    stripe_publishable_key: Optional[str] = None  # pk_live_... or pk_test_...
    stripe_secret_key: Optional[str] = None  # sk_live_... or sk_test_...
    stripe_webhook_secret: Optional[str] = None  # whsec_...
    stripe_mode: str = "test"
    payment_description: Optional[str] = None
    currency: str = "eur"
    send_payment_emails: bool = True


__all__ = ["SocietySettingsUpdate", "StripeSettingsUpdate"]
