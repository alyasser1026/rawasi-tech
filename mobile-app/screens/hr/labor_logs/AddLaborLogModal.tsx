import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LaborLog } from './labor_logs_logic';
import Toast from 'react-native-toast-message';
import { supabase } from '../../../lib/supabase';

interface AddLaborLogModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (log: LaborLog, isEdit: boolean) => Promise<boolean>;
  initialData?: LaborLog | null;
  workersList?: any[];
  sitesList?: any[];
  projectsList?: any[];
  jobOrdersList?: any[];
  partnersList?: any[];
}

export default function AddLaborLogModal({ 
  visible, onClose, onSave, initialData, 
  workersList = [], projectsList = [], jobOrdersList = [], partnersList = [] 
}: AddLaborLogModalProps) {
  const [logData, setLogData] = useState<LaborLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [showWorkers, setShowWorkers] = useState(false);
  const [showSites, setShowSites] = useState(false);
  const [showJobOrders, setShowJobOrders] = useState(false);
  const [showSubContractors, setShowSubContractors] = useState(false);

  useEffect(() => {
    if (initialData) {
      setLogData({ ...initialData });
    }
  }, [initialData]);

  if (!logData) return null;

  const handleSave = async () => {
    if (!logData.worker_name.trim()) {
      Toast.show({
        type: 'error',
        text1: 'تنبيه',
        text2: 'يرجى إدخال اسم العامل'
      });
      return;
    }

    setLoading(true);
    const isEdit = !!logData.id;
    const success = await onSave(logData, isEdit);
    setLoading(false);
    
    if (success) {
      onClose();
    }
  };

  const closeDropdowns = () => {
    Keyboard.dismiss();
    setShowWorkers(false);
    setShowSites(false);
    setShowJobOrders(false);
    setShowSubContractors(false);
  };

  const filteredWorkers = workersList.filter(w => w.name && w.name.includes(logData.worker_name) && w.name !== logData.worker_name).slice(0, 4);
  const filteredProjects = projectsList.filter(s => s.Property && s.Property.includes(logData.site_ref) && s.Property !== logData.site_ref).slice(0, 4);
  const currentJobOrders = jobOrdersList.filter(jo => jo.project_id === logData.project_id);
  const filteredJobOrders = currentJobOrders.filter(jo => jo.order_number && (jo.order_number.includes(logData.job_order_id ? '' : ''))).slice(0, 4); 
  const filteredSubContractors = partnersList.filter(p => (p.partner_type === 'مقاول' || p.partner_type === 'مقاول باطن') && p.name && p.name.includes(logData.sub_contractor || '') && p.name !== logData.sub_contractor).slice(0, 4);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          {/* 🌟 Header */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Ionicons name={logData.id ? "create" : "add-circle"} size={28} color="#c2410c" />
              <Text style={styles.title}>{logData.id ? 'تعديل بيانات اليومية' : 'إضافة يومية جديدة'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <TouchableWithoutFeedback onPress={closeDropdowns}>
              <View style={{ paddingBottom: 20 }}>
                
                <Text style={styles.label}>اسم العامل</Text>
                <View style={{ zIndex: 4 }}>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.inputWithIcon} 
                      placeholder="اسم العامل..."
                      value={logData.worker_name}
                      onChangeText={(text) => { setLogData({ ...logData, worker_name: text }); setShowWorkers(true); }}
                      onFocus={() => setShowWorkers(true)}
                      textAlign="right"
                    />
                  </View>
                  {showWorkers && filteredWorkers.length > 0 && (
                    <View style={styles.suggestions}>
                      {filteredWorkers.map(w => (
                        <TouchableOpacity key={w.id} style={styles.suggestionItem} onPress={() => {
                          setLogData({ ...logData, worker_name: w.name, worker_partner_id: w.id });
                          setShowWorkers(false);
                        }}>
                          <Text style={styles.suggestionText}>{w.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <Text style={styles.label}>الموقع (المشروع)</Text>
                <View style={{ zIndex: 3 }}>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="location-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.inputWithIcon} 
                      placeholder="ابحث عن الموقع أو العمارة..."
                      value={logData.site_ref}
                      onChangeText={(text) => { setLogData({ ...logData, site_ref: text }); setShowSites(true); }}
                      onFocus={() => setShowSites(true)}
                      textAlign="right"
                    />
                  </View>
                  {showSites && filteredProjects.length > 0 && (
                    <View style={styles.suggestions}>
                      {filteredProjects.map(s => (
                        <TouchableOpacity key={s.id} style={styles.suggestionItem} onPress={() => {
                          setLogData({ 
                            ...logData, 
                            site_ref: s.Property || s.project_name || '', 
                            project_id: s.id,
                            job_order_id: null,
                            work_item: '',
                            work_item_id: null,
                            unit: '' 
                          });
                          setShowSites(false);
                        }}>
                          <Text style={styles.suggestionText}>{s.Property || s.project_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <Text style={styles.label}>أمر الشغل (ربط الميزانية)</Text>
                <View style={{ zIndex: 2 }}>
                  <View style={[styles.inputWrapper, !logData.project_id && styles.inputDisabled]}>
                    <Ionicons name="document-text-outline" size={20} color={logData.project_id ? "#94a3b8" : "#cbd5e1"} style={styles.inputIcon} />
                    <TextInput 
                      style={[styles.inputWithIcon, !logData.project_id && { color: '#94a3b8' }]} 
                      placeholder="اختر الموقع أولاً..."
                      value={logData.job_order_id ? 'أمر شغل مرتبط ✅' : ''}
                      onFocus={() => {
                        if (!logData.project_id) {
                          Toast.show({
                            type: 'info',
                            text1: 'تنبيه',
                            text2: 'الرجاء اختيار الموقع أولاً'
                          });
                          return;
                        }
                        setShowJobOrders(true);
                      }}
                      editable={!!logData.project_id}
                      textAlign="right"
                    />
                  </View>
                  {showJobOrders && filteredJobOrders.length > 0 && (
                    <View style={styles.suggestions}>
                      {filteredJobOrders.map(jo => (
                        <TouchableOpacity key={jo.id} style={styles.suggestionItem} onPress={async () => {
                          let updates: any = { job_order_id: jo.id };
                          setShowJobOrders(false);
                          setLoading(true);
                          if (jo.boq_budget_id) {
                              const { data } = await supabase.from('boq_budget_distinct').select('*').eq('id', jo.boq_budget_id).single();
                              if (data) {
                                  updates.work_item = data.work_item;
                                  updates.work_item_id = data.boq_item_id;
                                  updates.unit = data.unit;
                                  updates.tareeha = data.tareeha ? String(data.tareeha) : logData.tareeha;
                              }
                          }
                          setLogData({ ...logData, ...updates });
                          setLoading(false);
                        }}>
                          <Text style={styles.suggestionText}>{jo.order_number} {jo.boq_budget?.work_item ? `- ${jo.boq_budget.work_item}` : ''}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>البند</Text>
                    <TextInput style={[styles.input, styles.inputDisabled]} placeholder="تلقائي" value={logData.work_item} editable={false} textAlign="right" />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>الوحدة</Text>
                    <TextInput style={[styles.input, styles.inputDisabled]} placeholder="تلقائي" value={logData.unit} editable={false} textAlign="right" />
                  </View>
                </View>

                <Text style={styles.label}>وصف الإنتاج</Text>
                <TextInput 
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
                  placeholder="تفاصيل العمل المنجز هنا..."
                  value={logData.production_desc}
                  onChangeText={(text) => setLogData({ ...logData, production_desc: text })}
                  multiline
                  textAlign="right"
                />

                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>الطريحة (المستهدف)</Text>
                    <TextInput style={styles.input} placeholder="الكمية" value={logData.tareeha} onChangeText={(text) => setLogData({ ...logData, tareeha: text })} textAlign="right" keyboardType="numeric" />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>الإنتاجية (المنفذ)</Text>
                    <TextInput style={styles.input} placeholder="الكمية" value={logData.productivity} onChangeText={(text) => setLogData({ ...logData, productivity: text })} textAlign="right" keyboardType="numeric" />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>الأجر اليومي (ر.س)</Text>
                    <TextInput style={[styles.input, styles.successInput]} placeholder="0.00" value={logData.daily_wage} onChangeText={(text) => setLogData({ ...logData, daily_wage: text })} keyboardType="numeric" textAlign="right" />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>قيمة الحضور (أيام)</Text>
                    <TextInput style={styles.input} placeholder="1 أو 0.5" value={String(logData.attendance_value || 1)} onChangeText={(text) => setLogData({ ...logData, attendance_value: Number(text) })} keyboardType="numeric" textAlign="right" />
                  </View>
                </View>

                <Text style={styles.label}>المقاول بالباطن (اختياري)</Text>
                <View style={{ zIndex: 1 }}>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="business-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.inputWithIcon} 
                      placeholder="ابحث عن المقاول..."
                      value={logData.sub_contractor}
                      onChangeText={(text) => { setLogData({ ...logData, sub_contractor: text }); setShowSubContractors(true); }}
                      onFocus={() => setShowSubContractors(true)}
                      textAlign="right"
                    />
                  </View>
                  {showSubContractors && filteredSubContractors.length > 0 && (
                    <View style={styles.suggestions}>
                      {filteredSubContractors.map(p => (
                        <TouchableOpacity key={p.id} style={styles.suggestionItem} onPress={() => {
                          setLogData({ ...logData, sub_contractor: p.name, sub_contractor_id: p.id });
                          setShowSubContractors(false);
                        }}>
                          <Text style={styles.suggestionText}>{p.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <Text style={styles.label}>ملاحظات</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="أي ملاحظات عامة..."
                  value={logData.notes}
                  onChangeText={(text) => setLogData({ ...logData, notes: text })}
                  textAlign="right"
                />

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                  <LinearGradient colors={['#27272a', '#2c221e']} style={styles.saveBtnGradient}>
                    {loading ? (
                      <ActivityIndicator color="#c2410c" size="large" />
                    ) : (
                      <>
                        <Text style={styles.saveBtnText}>حفظ واعتماد</Text>
                        <Ionicons name="checkmark-done-circle" size={24} color="#c2410c" style={{ marginLeft: 8 }} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#ffffff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 25, maxHeight: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 10 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 15 },
  titleContainer: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  formContainer: { paddingBottom: 20 },
  label: { fontSize: 13, fontWeight: '800', color: '#475569', marginBottom: 8, textAlign: 'right' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 15 },
  inputWrapper: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, marginBottom: 15, paddingHorizontal: 15 },
  inputWithIcon: { flex: 1, paddingVertical: 16, fontSize: 15, fontWeight: '700', color: '#1e293b', paddingRight: 10 },
  inputIcon: { marginLeft: 5 },
  inputDisabled: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  successInput: { color: '#059669', borderColor: '#a7f3d0', backgroundColor: '#ecfdf5', fontSize: 18 },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  half: { width: '48%' },
  saveBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 15, shadowColor: '#27272a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  saveBtnGradient: { padding: 18, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { fontSize: 18, fontWeight: '900', color: '#ffffff' },
  suggestions: { position: 'absolute', top: 58, left: 0, right: 0, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6, overflow: 'hidden', zIndex: 100 },
  suggestionItem: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#ffffff' },
  suggestionText: { fontSize: 14, fontWeight: '800', color: '#334155', textAlign: 'right' }
});