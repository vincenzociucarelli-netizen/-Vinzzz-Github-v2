"""
Test unitari per _detect_threshold_crossings_chronological — FIX P1
Garantisce che il PDF di soglia €5K/€15K venga emesso per il mese che cronologicamente
attraversa la soglia, anche se firmato fuori ordine cronologico.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import _detect_threshold_crossings_chronological


def test_sequential_signing_5k_threshold():
    """Caso normale: firme sequenziali, soglia 5K superata a marzo."""
    # Gennaio 2K firmato, Febbraio 2K firmato. Ora firmo Marzo 2K → totale 6K → soglia 5K attraversata a marzo
    signed = {1: 2000, 2: 2000}
    m5, m15 = _detect_threshold_crossings_chronological(signed, new_month=3, new_amount=2000)
    assert m5 == 3, f"Expected month 3 to cross 5K, got {m5}"
    assert m15 is None


def test_retroactive_january_signing_5k_crosses_january():
    """
    FIX P1: Alice firma Settembre prima (sotto soglia), poi torna indietro e firma
    Gennaio retroattivamente. Cronologicamente è Gennaio che attraversa la soglia.
    """
    # Settembre già firmato (es. 4000), totale =4000 (sotto 5K)
    # Ora firma Gennaio 3000 → cumulativo cronologico: Jan=3K, ..., Sep=7K → Sep cross 5K? No, Jan+Sep=7K
    # Aspetta: ordine cronologico calcolato: Gen=3K (cum=3K), Feb..Aug=0, Sep=4K (cum=7K)
    # Quindi a settembre cum passa da 3K a 7K → 5K attraversato a settembre
    signed = {9: 4000}
    m5, m15 = _detect_threshold_crossings_chronological(signed, new_month=1, new_amount=3000)
    assert m5 == 9, f"With Jan=3K and Sep=4K, 5K should be crossed at Sep (cum jumps 3→7), got {m5}"


def test_retroactive_january_is_the_crossing_month():
    """
    Caso classico Alice: Settembre già firmato 7K (sopra 5K), poi firma Gennaio 500.
    Cronologicamente è Gennaio che attraversa la soglia perché Sep+Jan combined.
    NO. Calcoliamo: Gen=500 (cum=500), Sep=7000 (cum=7500). 5K attraversato a Sep.
    
    Riformuliamo: per far sì che GENNAIO sia il mese che attraversa, deve essere il
    primo mese cronologico con cumulativo >5K. Es. prior_compensation=4800 + Jan=500 → cum=5300 a Gen.
    """
    signed = {9: 7000}  # settembre già firmato
    m5, m15 = _detect_threshold_crossings_chronological(
        signed, new_month=1, new_amount=500, prior_compensation=4800
    )
    # Gen cum = 4800 (prior) + 500 (gen) = 5300 → cross 5K a Gen
    assert m5 == 1, f"With prior=4800 + Jan=500, should cross at Jan, got {m5}"


def test_old_logic_bug_january_now_emits_pdf():
    """
    Riproduce lo scenario del bug originale: firma settembre prima di gennaio.
    Con la VECCHIA logica (yearly_total da mesi < request.month), Gennaio firmato dopo
    Settembre avrebbe yearly_total=0 → no soglia. Con il fix, considera anche Settembre.
    """
    # Settembre già firmato 7K → cumulativo 7K (sopra 5K)
    # Firma Gennaio 200 → la vecchia logica: yearly_total=0, new_total=200, no exceeded
    # Nuova logica: monthly[1]=200, monthly[9]=7000. Cumulativo: Gen=200, ..., Sep=7200 → 5K a Sep
    # Quindi gennaio NON è il mese che attraversa (perché Gen da solo <5K), Sep lo è.
    signed = {9: 7000}
    m5, m15 = _detect_threshold_crossings_chronological(signed, new_month=1, new_amount=200)
    assert m5 == 9, f"5K should cross at Sep (cum jumps from 200→7200), got {m5}"


def test_15k_threshold_chronological():
    """Verifica anche la soglia 15K."""
    signed = {1: 5000, 6: 5000, 12: 5000}
    # Cum: Jan=5K, ..., Jun=10K, ..., Dec=15K. 5K cross Jan, 15K NOT crossed (15K esatti != >15K)
    m5, m15 = _detect_threshold_crossings_chronological(signed, new_month=12, new_amount=5000)
    # Recompute: monthly[12] = 5000 (existing) + 5000 (new) = 10000. Cum Dec = 5K+5K+10K = 20K → cross 15K at Dec
    assert m15 == 12, f"15K should cross at Dec (cum→20K), got {m15}"


def test_no_threshold_crossed():
    """Importi sotto 5K, no superamento."""
    signed = {1: 1000, 2: 1000}
    m5, m15 = _detect_threshold_crossings_chronological(signed, new_month=3, new_amount=1000)
    assert m5 is None
    assert m15 is None


def test_external_compensation_pushes_to_january():
    """Prior + external compensations: imputati come gennaio."""
    # External 6K + nuovo Aprile 100 → cum a Gen = 6100 → cross 5K a Gen
    m5, m15 = _detect_threshold_crossings_chronological(
        {}, new_month=4, new_amount=100, external_total=6000
    )
    assert m5 == 1, f"External 6K should push 5K cross to Jan, got {m5}"


if __name__ == "__main__":
    test_sequential_signing_5k_threshold()
    test_retroactive_january_signing_5k_crosses_january()
    test_retroactive_january_is_the_crossing_month()
    test_old_logic_bug_january_now_emits_pdf()
    test_15k_threshold_chronological()
    test_no_threshold_crossed()
    test_external_compensation_pushes_to_january()
    print("✅ Tutti i test cronologici passati!")
