/**
 * Bacheca Note Admin — task list condivisa.
 * 🆕 19/07/2026.
 *
 * Componente da inserire nella dashboard admin, in alto, sopra i quickstats.
 * Ogni admin della società vede TUTTE le note e chiunque può prendere in carico,
 * completare, riaprire, modificare o eliminare.
 *
 * Flag per nota:
 *   [ ] Presa in carico → [x] Presa in carico da <nome>
 *   [ ] Fatto → sposta in sezione collassabile "Già fatto"
 *
 * Extra:
 *   - Priorità: 🔴 Alta / 🟡 Media / 🟢 Bassa
 *   - Scadenza opzionale con badge "In scadenza" (≤3 giorni) / "Scaduta"
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

type Priority = 'high' | 'medium' | 'low';

interface AdminNote {
  id: string;
  title: string;
  description?: string | null;
  priority: Priority;
  due_date?: string | null; // YYYY-MM-DD
  created_by: string;
  created_by_name: string;
  created_at: string;
  taken_by?: string | null;
  taken_by_name?: string | null;
  taken_at?: string | null;
  completed: boolean;
  completed_by?: string | null;
  completed_by_name?: string | null;
  completed_at?: string | null;
}

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; emoji: string }> = {
  high: { label: 'Alta', color: '#C62828', bg: '#FFEBEE', emoji: '🔴' },
  medium: { label: 'Media', color: '#EF6C00', bg: '#FFF3E0', emoji: '🟡' },
  low: { label: 'Bassa', color: '#2E7D32', bg: '#E8F5E9', emoji: '🟢' },
};

function confirmAction(msg: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve(window.confirm(msg));
    } else {
      Alert.alert('Conferma', msg, [
        { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
        { text: 'OK', onPress: () => resolve(true) },
      ]);
    }
  });
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('it-IT');
  } catch {
    return '';
  }
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString('it-IT')} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return '';
  }
}

function dueDateStatus(due?: string | null): { label: string; color: string; bg: string } | null {
  if (!due) return null;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(due + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const diffDays = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: `Scaduta (${Math.abs(diffDays)}g fa)`, color: '#fff', bg: '#C62828' };
    if (diffDays === 0) return { label: 'Scade oggi', color: '#fff', bg: '#EF6C00' };
    if (diffDays <= 3) return { label: `Tra ${diffDays}g`, color: '#EF6C00', bg: '#FFF3E0' };
    return { label: `Entro ${d.toLocaleDateString('it-IT')}`, color: '#333', bg: '#F5F5F5' };
  } catch {
    return null;
  }
}

export const AdminNotesBoard: React.FC = () => {
  const [expanded, setExpanded] = useState(true);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [completed, setCompleted] = useState<AdminNote[]>([]);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [completedLoaded, setCompletedLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  // form new note
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [creating, setCreating] = useState(false);

  // inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editDueDate, setEditDueDate] = useState('');

  const loadActive = useCallback(async () => {
    try {
      const res = await api.get('/admin/notes');
      setNotes(res.data || []);
    } catch {
      // fallisce silenziosamente se non è admin
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCompleted = useCallback(async () => {
    try {
      const res = await api.get('/admin/notes/completed?limit=100');
      setCompleted(res.data || []);
      setCompletedLoaded(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadActive();
  }, [loadActive]);

  const onCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      await api.post('/admin/notes', {
        title,
        description: newDescription.trim() || null,
        priority: newPriority,
        due_date: newDueDate.trim() || null,
      });
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      setNewDueDate('');
      setShowAdvanced(false);
      await loadActive();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore creazione nota';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Errore', msg);
    } finally {
      setCreating(false);
    }
  };

  const onToggleTake = async (note: AdminNote) => {
    try {
      const path = note.taken_by ? 'untake' : 'take';
      await api.post(`/admin/notes/${note.id}/${path}`);
      await loadActive();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore aggiornamento';
      if (Platform.OS === 'web') window.alert(msg);
    }
  };

  const onComplete = async (note: AdminNote) => {
    try {
      await api.post(`/admin/notes/${note.id}/complete`);
      await loadActive();
      if (completedLoaded) await loadCompleted();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore completamento';
      if (Platform.OS === 'web') window.alert(msg);
    }
  };

  const onReopen = async (note: AdminNote) => {
    try {
      await api.post(`/admin/notes/${note.id}/reopen`);
      await loadActive();
      await loadCompleted();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore riapertura';
      if (Platform.OS === 'web') window.alert(msg);
    }
  };

  const onDelete = async (note: AdminNote) => {
    const ok = await confirmAction(`Eliminare la nota "${note.title}"?`);
    if (!ok) return;
    try {
      await api.delete(`/admin/notes/${note.id}`);
      await loadActive();
      if (completedLoaded) await loadCompleted();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore eliminazione';
      if (Platform.OS === 'web') window.alert(msg);
    }
  };

  const startEdit = (note: AdminNote) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditDescription(note.description || '');
    setEditPriority(note.priority);
    setEditDueDate(note.due_date || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (note: AdminNote) => {
    try {
      await api.patch(`/admin/notes/${note.id}`, {
        title: editTitle.trim(),
        description: editDescription,
        priority: editPriority,
        due_date: editDueDate,
      });
      setEditingId(null);
      await loadActive();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore modifica';
      if (Platform.OS === 'web') window.alert(msg);
    }
  };

  const toggleCompletedSection = async () => {
    const next = !completedOpen;
    setCompletedOpen(next);
    if (next && !completedLoaded) {
      await loadCompleted();
    }
  };

  const activeCount = notes.length;
  const completedCount = completed.length;

  const countByPriority = useMemo(() => {
    return notes.reduce(
      (acc, n) => {
        acc[n.priority] = (acc[n.priority] || 0) + 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 } as Record<Priority, number>
    );
  }, [notes]);

  if (loading) return null;

  return (
    <View style={styles.container} testID="admin-notes-board">
      {/* Header */}
      <TouchableOpacity
        style={styles.headerRow}
        onPress={() => setExpanded(!expanded)}
        testID="admin-notes-toggle"
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>📌</Text>
          <View>
            <Text style={styles.headerTitle}>Bacheca Note Admin</Text>
            <Text style={styles.headerSubtitle}>
              {activeCount === 0
                ? 'Nessuna nota attiva'
                : `${activeCount} ${activeCount === 1 ? 'nota attiva' : 'note attive'}`}
              {countByPriority.high > 0 ? ` • ${countByPriority.high} 🔴` : ''}
            </Text>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="#333" />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {/* Form aggiungi nota */}
          <View style={styles.addForm}>
            <View style={styles.addRow}>
              <TextInput
                style={styles.titleInput}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Nuova nota / cosa da fare..."
                placeholderTextColor="#999"
                onSubmitEditing={onCreate}
                testID="admin-notes-new-title"
              />
              <TouchableOpacity
                style={[styles.addBtn, (!newTitle.trim() || creating) && styles.addBtnDisabled]}
                onPress={onCreate}
                disabled={!newTitle.trim() || creating}
                testID="admin-notes-new-submit"
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={styles.addBtnText}>Aggiungi</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setShowAdvanced(!showAdvanced)}
              style={styles.advancedToggle}
              testID="admin-notes-advanced-toggle"
            >
              <Text style={styles.advancedToggleText}>
                {showAdvanced ? '− Nascondi opzioni' : '+ Priorità, scadenza, descrizione'}
              </Text>
            </TouchableOpacity>
            {showAdvanced && (
              <View style={styles.advancedBox}>
                <View style={styles.priorityRow}>
                  {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setNewPriority(p)}
                      style={[
                        styles.priorityChip,
                        { backgroundColor: newPriority === p ? PRIORITY_META[p].bg : '#F5F5F5' },
                        newPriority === p && { borderColor: PRIORITY_META[p].color, borderWidth: 1.5 },
                      ]}
                      testID={`admin-notes-priority-${p}`}
                    >
                      <Text style={{ fontSize: 13, color: newPriority === p ? PRIORITY_META[p].color : '#666', fontWeight: newPriority === p ? '700' : '500' }}>
                        {PRIORITY_META[p].emoji} {PRIORITY_META[p].label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.dueDateBox}>
                    <Text style={styles.smallLabel}>Scadenza (opz.):</Text>
                    {Platform.OS === 'web' ? (
                      // @ts-ignore — HTML input date on web
                      <input
                        type="date"
                        value={newDueDate}
                        onChange={(e: any) => setNewDueDate(e.target.value)}
                        style={styles.webDateInput as any}
                        testID="admin-notes-new-due"
                      />
                    ) : (
                      <TextInput
                        value={newDueDate}
                        onChangeText={setNewDueDate}
                        placeholder="AAAA-MM-GG"
                        style={styles.dateInputNative}
                      />
                    )}
                  </View>
                </View>
                <TextInput
                  style={styles.descInput}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder="Descrizione (opzionale)"
                  placeholderTextColor="#999"
                  multiline
                />
              </View>
            )}
          </View>

          {/* Lista note attive */}
          {notes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>✨ Nessuna nota attiva. Aggiungi la prima cosa da fare qui sopra.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {notes.map((n) => {
                const dueStatus = dueDateStatus(n.due_date);
                const isEditing = editingId === n.id;
                return (
                  <View
                    key={n.id}
                    style={[styles.noteCard, { borderLeftColor: PRIORITY_META[n.priority].color }]}
                    testID={`admin-note-${n.id}`}
                  >
                    {isEditing ? (
                      <View style={{ gap: 6 }}>
                        <TextInput style={styles.titleInput} value={editTitle} onChangeText={setEditTitle} />
                        <TextInput style={styles.descInput} value={editDescription} onChangeText={setEditDescription} placeholder="Descrizione" multiline />
                        <View style={styles.priorityRow}>
                          {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                            <TouchableOpacity
                              key={p}
                              onPress={() => setEditPriority(p)}
                              style={[
                                styles.priorityChip,
                                { backgroundColor: editPriority === p ? PRIORITY_META[p].bg : '#F5F5F5' },
                                editPriority === p && { borderColor: PRIORITY_META[p].color, borderWidth: 1.5 },
                              ]}
                            >
                              <Text style={{ fontSize: 12, color: editPriority === p ? PRIORITY_META[p].color : '#666' }}>
                                {PRIORITY_META[p].emoji} {PRIORITY_META[p].label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                          {Platform.OS === 'web' ? (
                            // @ts-ignore
                            <input type="date" value={editDueDate} onChange={(e: any) => setEditDueDate(e.target.value)} style={styles.webDateInput as any} />
                          ) : (
                            <TextInput value={editDueDate} onChangeText={setEditDueDate} placeholder="AAAA-MM-GG" style={styles.dateInputNative} />
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity style={styles.saveBtn} onPress={() => saveEdit(n)} testID={`admin-note-save-${n.id}`}>
                            <Text style={styles.saveBtnText}>Salva</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                            <Text style={styles.cancelBtnText}>Annulla</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={styles.noteHeader}>
                          <View style={styles.noteHeaderLeft}>
                            <Text style={styles.notePriorityChip}>{PRIORITY_META[n.priority].emoji}</Text>
                            <Text style={styles.noteTitle}>{n.title}</Text>
                          </View>
                          {dueStatus && (
                            <View style={[styles.dueBadge, { backgroundColor: dueStatus.bg }]}>
                              <Text style={{ color: dueStatus.color, fontSize: 11, fontWeight: '700' }}>{dueStatus.label}</Text>
                            </View>
                          )}
                        </View>
                        {n.description && <Text style={styles.noteDesc}>{n.description}</Text>}
                        <Text style={styles.noteMeta}>
                          Aggiunta da <Text style={{ fontWeight: '600' }}>{n.created_by_name}</Text> il {formatDateTime(n.created_at)}
                        </Text>
                        <View style={styles.checkboxRow}>
                          <TouchableOpacity
                            style={styles.checkboxItem}
                            onPress={() => onToggleTake(n)}
                            testID={`admin-note-take-${n.id}`}
                          >
                            <View style={[styles.checkbox, n.taken_by && styles.checkboxOn]}>
                              {n.taken_by && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </View>
                            <Text style={styles.checkboxLabel}>
                              {n.taken_by ? (
                                <>
                                  Presa in carico da <Text style={{ fontWeight: '700' }}>{n.taken_by_name}</Text>
                                </>
                              ) : (
                                'Presa in carico'
                              )}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.checkboxItem}
                            onPress={() => onComplete(n)}
                            testID={`admin-note-complete-${n.id}`}
                          >
                            <View style={styles.checkbox}>
                              <Ionicons name="checkmark-done-outline" size={14} color="#666" />
                            </View>
                            <Text style={[styles.checkboxLabel, { fontWeight: '600', color: '#2E7D32' }]}>Fatto</Text>
                          </TouchableOpacity>
                          <View style={{ flex: 1 }} />
                          <TouchableOpacity style={styles.iconBtn} onPress={() => startEdit(n)} testID={`admin-note-edit-${n.id}`}>
                            <Ionicons name="create-outline" size={17} color="#666" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.iconBtn} onPress={() => onDelete(n)} testID={`admin-note-delete-${n.id}`}>
                            <Ionicons name="trash-outline" size={17} color="#C62828" />
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Sezione Già Fatto */}
          <TouchableOpacity
            style={styles.completedHeader}
            onPress={toggleCompletedSection}
            testID="admin-notes-completed-toggle"
          >
            <Text style={styles.completedTitle}>
              ✅ Già fatto {completedLoaded ? `(${completedCount})` : ''}
            </Text>
            <Ionicons name={completedOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
          </TouchableOpacity>
          {completedOpen && completedLoaded && (
            <View style={{ gap: 6, marginTop: 4 }}>
              {completedCount === 0 ? (
                <Text style={styles.emptyText}>Nessuna nota completata.</Text>
              ) : (
                completed.map((n) => (
                  <View key={n.id} style={styles.completedCard} testID={`admin-note-completed-${n.id}`}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.completedNoteTitle}>
                        {PRIORITY_META[n.priority].emoji} {n.title}
                      </Text>
                      <Text style={styles.completedMeta}>
                        Completata da <Text style={{ fontWeight: '600' }}>{n.completed_by_name || '—'}</Text> il {formatDateTime(n.completed_at)}
                        {n.due_date ? ` • Scadenza: ${formatDate(n.due_date)}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => onReopen(n)} testID={`admin-note-reopen-${n.id}`}>
                      <Ionicons name="refresh-outline" size={17} color="#1976D2" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => onDelete(n)}>
                      <Ionicons name="trash-outline" size={17} color="#C62828" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E7F5',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F8F9FE',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { fontSize: 22 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#1a237e' },
  headerSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  body: { padding: 12, gap: 10 },
  addForm: { gap: 6 },
  addRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  titleInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a237e',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  advancedToggle: { alignSelf: 'flex-start' },
  advancedToggleText: { fontSize: 12, color: '#1a237e', fontWeight: '600' },
  advancedBox: { gap: 6, marginTop: 4, padding: 8, backgroundColor: '#F8F9FE', borderRadius: 8 },
  priorityRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  priorityChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: 'transparent' },
  descInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#fff',
    minHeight: 40,
  },
  dueDateBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 },
  smallLabel: { fontSize: 11, color: '#666' },
  webDateInput: {
    padding: 6,
    borderRadius: 6,
    border: '1px solid #DDD',
    fontSize: 12,
    fontFamily: 'inherit',
  },
  dateInputNative: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 12,
    minWidth: 110,
  },
  emptyBox: { padding: 14, alignItems: 'center', backgroundColor: '#F8F9FE', borderRadius: 8 },
  emptyText: { color: '#999', fontSize: 13, textAlign: 'center' },
  noteCard: {
    padding: 10,
    backgroundColor: '#FAFBFF',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#EEE',
    gap: 4,
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  noteHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  notePriorityChip: { fontSize: 14 },
  noteTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', flexShrink: 1 },
  noteDesc: { fontSize: 12, color: '#555', marginTop: 2 },
  noteMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  dueBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' },
  checkboxItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxOn: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  checkboxLabel: { fontSize: 12, color: '#333' },
  iconBtn: { padding: 5 },
  saveBtn: { backgroundColor: '#1a237e', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  cancelBtn: { backgroundColor: '#E0E0E0', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  cancelBtnText: { color: '#333', fontWeight: '600', fontSize: 12 },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  completedTitle: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#F6FBF6',
    borderRadius: 6,
    gap: 4,
  },
  completedNoteTitle: { fontSize: 13, color: '#333', textDecorationLine: 'line-through' },
  completedMeta: { fontSize: 11, color: '#666', marginTop: 2 },
});

export default AdminNotesBoard;
