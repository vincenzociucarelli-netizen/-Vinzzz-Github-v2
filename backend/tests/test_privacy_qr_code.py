"""
Test che verifica che il QR di autenticità venga embedded nel PDF della privacy
quando viene passato un document_id. FIX richiesto dall'utente in data 12/06/2026.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import generate_gdpr_adult_privacy_pdf, generate_gdpr_minor_privacy_pdf


def _common_kwargs():
    return dict(
        society_name="ASD Test",
        ragione_sociale="ASD Test SRL",
        society_address="Via Roma 1, Roma",
        society_fiscal_code="01234567890",
        society_email="info@test.it",
        signer_name="Mario",
        signer_surname="Rossi",
        signer_fiscal_code="RSSMRA80A01H501Z",
        signer_birth_date="01/01/1980",
        signer_birth_place="Roma",
        signer_address="Via Test 1",
        signer_city="Roma",
        signer_province="RM",
        signature_base64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        timestamp="2026-06-12T08:15:00Z",
        ip_address="1.2.3.4",
        user_agent="pytest",
        document_version="1.0",
        document_hash="abc123def456",
        user_id="user-1",
        society_id="society-1",
    )


def test_adult_pdf_includes_qr_when_document_id_provided():
    pdf_bytes_with = generate_gdpr_adult_privacy_pdf(**_common_kwargs(), document_id="DOC-12345")
    pdf_bytes_without = generate_gdpr_adult_privacy_pdf(**_common_kwargs(), document_id=None)
    # Il PDF con QR deve essere significativamente più grande (~2-5 KB in più per l'immagine QR)
    delta = len(pdf_bytes_with) - len(pdf_bytes_without)
    assert delta > 500, f"PDF with QR should be at least ~500 bytes larger, delta={delta}"
    assert b"%PDF" in pdf_bytes_with[:8], "Output must be a valid PDF"


def test_minor_pdf_includes_qr_when_document_id_provided():
    kwargs_minor = dict(
        society_name="ASD Test",
        ragione_sociale="ASD Test SRL",
        society_address="Via Roma 1",
        society_fiscal_code="01234567890",
        society_email="info@test.it",
        parent_name="Mario",
        parent_surname="Rossi",
        parent_fiscal_code="RSSMRA80A01H501Z",
        minor_name="Luca",
        minor_surname="Rossi",
        minor_fiscal_code="RSSLCU10A01H501Z",
        minor_birth_date="01/01/2010",
        minor_birth_place="Roma",
        signature_base64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        timestamp="2026-06-12T08:15:00Z",
        ip_address="1.2.3.4",
        user_agent="pytest",
        document_version="1.0",
        document_hash="def456abc123",
        user_id="parent-1",
        society_id="society-1",
    )
    pdf_with = generate_gdpr_minor_privacy_pdf(**kwargs_minor, document_id="DOC-99999")
    pdf_without = generate_gdpr_minor_privacy_pdf(**kwargs_minor, document_id=None)
    delta = len(pdf_with) - len(pdf_without)
    assert delta > 500, f"Minor PDF with QR should be larger, delta={delta}"
    assert b"%PDF" in pdf_with[:8]


def test_pdf_does_not_break_when_document_id_is_none():
    """Backward compat: chiamare senza document_id non deve rompere nulla."""
    pdf = generate_gdpr_adult_privacy_pdf(**_common_kwargs(), document_id=None)
    assert len(pdf) > 0
    assert b"%PDF" in pdf[:8]


if __name__ == "__main__":
    test_adult_pdf_includes_qr_when_document_id_provided()
    test_minor_pdf_includes_qr_when_document_id_provided()
    test_pdf_does_not_break_when_document_id_is_none()
    print("Tutti i test QR privacy PDF passati!")
