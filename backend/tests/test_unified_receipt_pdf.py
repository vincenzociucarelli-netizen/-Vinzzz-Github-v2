"""Test PDF unificato Coach + Atleta PRO — verifica che il PDF mostri 2 righe
importo + totale quando i due compensi sono passati."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import generate_monthly_receipt_pdf


def _base_kwargs():
    return dict(
        society_name="ASD Test",
        collaborator_name="Alice Zorzi",
        collaborator_fiscal_code="ZRZALC10A41H501Z",
        month_name="Marzo",
        year=2026,
        signature_base64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        document_id="DOC-UNIFIED-1",
        signer_id="alice-user-id",
    )


def test_pdf_split_quando_entrambi_importi_presenti():
    kwargs = _base_kwargs()
    pdf_single = generate_monthly_receipt_pdf(amount_gross=2300.0, **kwargs)
    pdf_split = generate_monthly_receipt_pdf(
        amount_gross=2300.0,
        coach_amount=800.0,
        athlete_pro_amount=1500.0,
        **kwargs,
    )
    assert b"%PDF" in pdf_split[:8]
    # Il PDF con split ha 3 righe vs 1 → almeno qualche byte in più
    assert len(pdf_split) > len(pdf_single), "Split PDF must be larger than single"


def test_pdf_singolo_compenso_quando_split_non_passato():
    """Il PDF senza coach/athlete deve essere generato senza errori."""
    kwargs = _base_kwargs()
    pdf = generate_monthly_receipt_pdf(amount_gross=2300.0, **kwargs)
    assert b"%PDF" in pdf[:8]
    assert len(pdf) > 1000  # PDF valido non vuoto


def test_pdf_split_solo_se_entrambi_maggiori_di_zero():
    """Solo coach_amount > 0 con athlete_pro_amount=0: comportamento singolo."""
    kwargs = _base_kwargs()
    pdf_single = generate_monthly_receipt_pdf(amount_gross=1500.0, **kwargs)
    pdf_only_athlete = generate_monthly_receipt_pdf(
        amount_gross=1500.0,
        coach_amount=0.0,
        athlete_pro_amount=1500.0,
        **kwargs,
    )
    # Solo uno dei due > 0 → niente split → dimensioni simili (~ ±200 byte)
    delta = abs(len(pdf_only_athlete) - len(pdf_single))
    assert delta < 500, f"Should NOT trigger split when only one amount > 0, delta={delta}"


if __name__ == "__main__":
    test_pdf_singolo_compenso_quando_split_non_passato()
    test_pdf_split_quando_entrambi_importi_presenti()
    test_pdf_split_solo_se_entrambi_maggiori_di_zero()
    print("Tutti i test unificazione PDF passati!")
