/**
 * 🆕 24/02/2026 — Componente riusabile per visualizzare il riepilogo compenso (header card) con:
 *   1. Foto profilo + nome
 *   2. Box Compenso Mensile (arancione, importo grande)
 *   3. Box Compenso Accettato (verde sì / giallo no)
 *   4. Box Periodo Contratto (viola)
 *   5. Box Pregresso Dichiarato (azzurro + lock "Solo admin")
 *
 * Replica grafica del Dirigente user e si usa in tutte le viste compenso
 * (user collaboratore/coach/atleta-pro + admin dirigente/collaboratore/coach/atleta-pro).
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import PriorCompensationDeclarationModal from '../PriorCompensationDeclarationModal';
import AdminPriorCompensationPanel from '../AdminPriorCompensationPanel';
import PensionDeclarationModal from '../PensionDeclarationModal';
import PensionDeclarationCard from '../PensionDeclarationCard';
import AdminPensionDeclarationPanel from '../AdminPensionDeclarationPanel';

interface Props {
  fullName: string;
  monthlyCompensation: number;
  compensationAccepted: boolean;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  priorCompensation: number;
  formatCurrency: (n: number) => string;
  /** If provided, shows action button when compensation not accepted */
  onAcceptCompensation?: () => void;
  acceptingComp?: boolean;
  /** Read-only mode: hides accept button even if not accepted (admin view) */
  readOnly?: boolean;
  /** Override pregresso label suffix (defaults to "AL [contract_start-1]") */
  pregressoLabelSuffix?: string;
  /** 🆕 27/02/2026 — Label compenso (default "Compenso Mensile").
   *  Es. "Compenso Mensile COACH" per dual-role lato Coach. */
  compensationLabel?: string;
  /** 🆕 26/02/2026 — Dual-role: sostituisce l'importo del pregresso con una nota
   *  (es. "Conteggiato sull'anagrafica Atleta"). Usato sulla scheda Coach quando
   *  l'utente è anche Atleta PRO, per evitare doppio conteggio del pregresso. */
  pregressoNotice?: string;
  /** 🆕 27/07/2026 — Se presente (vista admin), mostra il pannello con dichiarazione
   *  pregresso firmata + storia modifiche admin per il dato utente. */
  adminUserId?: string;
  /** 🆕 30/07/2026 — Consente di mostrare la sezione "Accetta Compenso" anche quando
   *  il compenso mensile è 0€. Utile per atleti 18+ PRO che NON percepiscono compenso
   *  dalla società attuale ma devono comunque poter accettare per dichiarare il
   *  pregresso (compensi già percepiti da altre ASD/SSD) — obbligo Riforma Sport. */
  allowZeroCompensation?: boolean;
}

const formatContractDate = (dateStr: string) => {
  try {
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = clean.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  } catch { return dateStr; }
};

const computePregressoSuffix = (contractStartDate: string | null | undefined): string => {
  if (!contractStartDate) return '';
  try {
    const parts = String(contractStartDate).split('-');
    if (parts.length !== 3) return '';
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    d.setDate(d.getDate() - 1);
    return `al ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}:`;
  } catch { return ''; }
};

export default function CompensationSummaryCard({
  fullName,
  monthlyCompensation,
  compensationAccepted,
  contractStartDate,
  contractEndDate,
  priorCompensation,
  formatCurrency,
  onAcceptCompensation,
  acceptingComp = false,
  readOnly = false,
  pregressoLabelSuffix,
  pregressoNotice,
  compensationLabel,
  adminUserId,
  allowZeroCompensation = false,
}: Props) {
  const pregressoSuffix = pregressoLabelSuffix !== undefined
    ? pregressoLabelSuffix
    : computePregressoSuffix(contractStartDate);

  // 🆕 27/07/2026 — Gestione dichiarazione pregresso (obbligatoria prima di accettare)
  const [showPriorModal, setShowPriorModal] = useState(false);
  const [checkingPrior, setCheckingPrior] = useState(false);

  // 🆕 28/09/2026 — Stato firma pregresso nella vista PERSONALE (non admin/readOnly):
  // se il compenso è già accettato ma il pregresso NON è ancora firmato, l'utente
  // deve poterlo firmare ORA (anche se è €0). Mostriamo un pulsante dedicato.
  const isSelfView = !adminUserId && !readOnly;
  const [priorSigned, setPriorSigned] = useState<boolean | null>(null);

  const refreshPriorStatus = React.useCallback(async () => {
    if (!isSelfView) return;
    try {
      const res = await api.get('/me/prior-compensation/status');
      setPriorSigned(!!res.data?.signed);
    } catch {
      setPriorSigned(null);
    }
  }, [isSelfView]);

  useEffect(() => { refreshPriorStatus(); }, [refreshPriorStatus]);

  // 🆕 Dichiarazione posizione previdenziale (firma SEPARATA, obbligatoria prima
  // di completare l'accettazione dell'accordo). Flusso: pregresso → previdenziale → accetta.
  const [showPensionModal, setShowPensionModal] = useState(false);
  const [pensionCardKey, setPensionCardKey] = useState(0);

  const isPensionDeclared = async (): Promise<boolean> => {
    try {
      const res = await api.get('/me/pension-declaration/status');
      return !!res.data?.declared;
    } catch {
      return true; // errore di rete: lascia procedere, il backend blocca comunque
    }
  };

  const proceedAfterDeclarations = () => {
    onAcceptCompensation?.();
    refreshPriorStatus();
    // 🆕 27/07/2026 — Forza refresh su Web così la pagina padre ricarica il pregresso
    //                 aggiornato (evita mostrare €0 nel box "Pregresso dichiarato" dopo firma).
    //                 Il reload avviene solo se il caller non gestisce la propagazione.
    if (typeof window !== 'undefined' && (window as any)?.location?.reload) {
      setTimeout(() => { try { (window as any).location.reload(); } catch { /* noop */ } }, 900);
    }
  };

  const handleAcceptClick = async () => {
    if (!onAcceptCompensation) return;
    // Prima di accettare, verifica lo status della dichiarazione pregresso
    try {
      setCheckingPrior(true);
      const res = await api.get('/me/prior-compensation/status');
      if (res.data?.signed) {
        // Pregresso già firmato → verifica la dichiarazione previdenziale
        if (await isPensionDeclared()) onAcceptCompensation();
        else setShowPensionModal(true);
      } else {
        // Non firmato → apre il modal
        setShowPriorModal(true);
      }
    } catch (_e) {
      // In caso di errore di rete, prova direttamente l'accettazione (il backend bloccherà comunque)
      onAcceptCompensation();
    } finally {
      setCheckingPrior(false);
    }
  };

  const handleDeclared = async () => {
    setShowPriorModal(false);
    setPriorSigned(true);
    // Dopo la firma del pregresso: se manca la dichiarazione previdenziale, la richiede
    // (firma separata); altrimenti procede con l'accettazione come prima.
    if (await isPensionDeclared()) proceedAfterDeclarations();
    else setShowPensionModal(true);
  };

  const handlePensionDeclared = () => {
    setShowPensionModal(false);
    setPensionCardKey((k) => k + 1);
    proceedAfterDeclarations();
  };

  return (
    <View style={{ marginBottom: 16, backgroundColor: '#fff', borderRadius: 12, padding: 16 }} data-testid="compensation-summary-card">
      {/* Profilo + nome */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Ionicons name="person-circle" size={50} color="#8E44AD" />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>{fullName}</Text>
        </View>
      </View>

      {/* Box Compenso Mensile */}
      {monthlyCompensation > 0 && (
        <View style={{ backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#FF9500', borderStyle: 'dashed' }} data-testid="compenso-mensile-box">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, marginRight: 6 }}>💰</Text>
            <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>{compensationLabel || 'Compenso Mensile'}</Text>
          </View>
          <Text style={{ fontSize: 22, color: '#E65100', fontWeight: 'bold', marginTop: 4, textAlign: 'center' }}>
            {formatCurrency(monthlyCompensation)}
          </Text>
        </View>
      )}

      {/* Compenso Accettato */}
      {(monthlyCompensation > 0 || allowZeroCompensation) && (
        compensationAccepted ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#34C759' }} data-testid="compensation-accepted-row">
            <Text style={{ fontSize: 14, color: '#1B5E20', fontWeight: '500' }}>Compenso Accettato:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={18} color="#34C759" />
              <Text style={{ marginLeft: 6, color: '#1B5E20', fontWeight: '700' }}>✓ Sì</Text>
            </View>
          </View>
        ) : readOnly ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF3CD', padding: 12, borderRadius: 8, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#FF9500' }}>
            <Text style={{ fontSize: 14, color: '#856404', fontWeight: '500' }}>Compenso Accettato:</Text>
            <Text style={{ color: '#856404', fontWeight: '700' }}>✗ No</Text>
          </View>
        ) : (
          <View style={{ marginBottom: 12 }}>
            <View style={{ backgroundColor: '#FFF3CD', padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#FF9500' }}>
              <Text style={{ color: '#856404', fontSize: 13, fontWeight: '500' }}>
                {monthlyCompensation > 0
                  ? '⏳ Il tuo compenso mensile richiede accettazione. Clicca qui sotto per confermare.'
                  : '⏳ Anche senza compenso dalla società attuale, devi confermare per poter dichiarare i compensi già percepiti da altre ASD/SSD (obbligo Riforma Sport).'}
              </Text>
            </View>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#34C759', padding: 12, borderRadius: 8 }}
              onPress={handleAcceptClick}
              disabled={acceptingComp || checkingPrior}
              data-testid="accept-compensation-btn"
            >
              {(acceptingComp || checkingPrior) ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>
                    {monthlyCompensation > 0
                      ? `Accetta Compenso ${formatCurrency(monthlyCompensation)}`
                      : 'Conferma e Dichiara Pregresso'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )
      )}

      {/* 🆕 28/09/2026 — Firma pregresso ORA (vista personale): visibile quando il
          pregresso non è ancora firmato. Utile se il compenso è già stato accettato
          (o accettato dall'admin) e manca solo l'autocertificazione del pregresso. */}
      {isSelfView && priorSigned === false && (
        <View style={{ marginBottom: 12 }}>
          <View style={{ backgroundColor: '#FFF3CD', padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#FF9500' }}>
            <Text style={{ color: '#856404', fontSize: 13, fontWeight: '500' }}>
              📋 Devi firmare la Dichiarazione Pregresso (compensi già percepiti da altre ASD/SSD quest&apos;anno). Se non hai percepito nulla, dichiara <Text style={{ fontWeight: '700' }}>€0</Text>.
            </Text>
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E3A8A', padding: 12, borderRadius: 8 }}
            onPress={() => setShowPriorModal(true)}
            data-testid="sign-prior-comp-btn"
          >
            <Ionicons name="create" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>Firma Dichiarazione Pregresso</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Periodo Contratto */}
      {contractStartDate && contractEndDate && (
        <View style={{ backgroundColor: '#F3E5F5', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#8E44AD', borderStyle: 'dashed' }} data-testid="periodo-contratto-box">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, marginRight: 6 }}>📅</Text>
            <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>Periodo Contratto</Text>
          </View>
          <Text style={{ fontSize: 18, color: '#8E44AD', fontWeight: 'bold', marginTop: 4, textAlign: 'center' }}>
            {formatContractDate(contractStartDate)} - {formatContractDate(contractEndDate)}
          </Text>
        </View>
      )}

      {/* Pregresso dichiarato — 🆕 nascosto in vista admin (adminUserId): lì mostriamo
          solo il pannello firmato dall'utente (AdminPriorCompensationPanel) per evitare doppioni */}
      {!adminUserId && (
      <View style={{ backgroundColor: '#E8F4FD', padding: 12, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#007AFF' }} data-testid="pregresso-dichiarato-box">
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 14, marginRight: 6 }}>📋</Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 14, color: '#333', fontWeight: '500', flex: 1 }}>
                Pregresso dichiarato {pregressoSuffix}
              </Text>
            </View>
            {pregressoNotice ? (
              <View
                style={{
                  marginTop: 8,
                  backgroundColor: '#FFF8E1',
                  borderRadius: 6,
                  padding: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: '#F9A825',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
                data-testid="pregresso-notice"
              >
                <Ionicons name="information-circle" size={16} color="#F9A825" />
                <Text style={{ fontSize: 12, color: '#7A5D00', fontStyle: 'italic', flex: 1 }}>
                  {pregressoNotice}
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 20, color: '#1F2937', fontWeight: 'bold', marginTop: 6 }}>
                {formatCurrency(priorCompensation || 0)}
              </Text>
            )}
          </View>
        </View>
      </View>
      )}

      {/* 🆕 Posizione previdenziale — vista personale: stato, storico e nuova dichiarazione */}
      {isSelfView && (
        <PensionDeclarationCard key={pensionCardKey} userFullName={fullName} />
      )}

      {/* 🆕 27/07/2026 — Pannello admin: dichiarazione pregresso firmata + storia (solo se adminUserId presente) */}
      {adminUserId && (
        <View style={{ marginTop: 12 }}>
          <AdminPriorCompensationPanel userId={adminUserId} />
          {/* 🆕 Posizione previdenziale dichiarata (sola lettura) */}
          <View style={{ marginTop: 12 }}>
            <AdminPensionDeclarationPanel userId={adminUserId} />
          </View>
        </View>
      )}

      {/* 🆕 27/07/2026 — Modal dichiarazione pregresso (obbligatoria prima di accettare) */}
      <PriorCompensationDeclarationModal
        visible={showPriorModal}
        userFullName={fullName}
        contractStartDate={contractStartDate}
        onClose={() => setShowPriorModal(false)}
        onDeclared={handleDeclared}
      />

      {/* 🆕 Modal dichiarazione posizione previdenziale (firma separata, prima di accettare) */}
      <PensionDeclarationModal
        visible={showPensionModal}
        userFullName={fullName}
        onClose={() => setShowPensionModal(false)}
        onDeclared={handlePensionDeclared}
      />
    </View>
  );
}
