import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Platform, KeyboardAvoidingView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export default function MaterialIssueModal({ visible, onClose, record: editingRecord, onSave, projectsList, partnersList, inventoryItems, boqItems }: any) {
  const initialState = {
    project_id: null,
    subcontractor_id: null,
    contractor_text_name: '',
    issue_type: 'صرف لمقاول',
    issue_date: new Date().toISOString().split('T')[0],
    notes: '',
    items: [{ id: Date.now().toString(), item_id: null, item_name: '', quantity: 1, available_qty: 0, unit: 'قطعة', unit_price: 0, total_price: 0, boq_item_id: null }]
  };

  const [record, setRecord] = useState<any>(initialState);
  
  const [activeSelector, setActiveSelector] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (editingRecord) {
      setRecord({
        id: editingRecord.id,
        project_id: editingRecord.project_id,
        subcontractor_id: editingRecord.subcontractor_id,
        contractor_text_name: editingRecord.contractor_text_name || '',
        issue_type: editingRecord.issue_type || 'صرف لمقاول',
        issue_date: editingRecord.issue_date,
        notes: editingRecord.notes || '',
        items: editingRecord.lines && editingRecord.lines.length > 0 
          ? editingRecord.lines.map((l: any, idx: number) => ({
              id: l.id || idx.toString(),
              item_id: l.item_id,
              item_name: l.item_name,
              quantity: l.quantity,
              available_qty: l.quantity, // allow keeping same amount for edit
              unit: l.unit,
              unit_price: l.unit_price,
              total_price: l.total_price,
              boq_item_id: l.boq_item_id
            }))
          : initialState.items
      });
    } else {
      setRecord(initialState);
    }
  }, [editingRecord, visible]);

  const addLine = () => {
    setRecord({
      ...record, 
      items: [...record.items, { id: Date.now().toString(), item_id: null, item_name: '', quantity: 1, available_qty: 0, unit: 'قطعة', unit_price: 0, total_price: 0, boq_item_id: null }]
    });
  };

  const removeLine = (index: number) => {
    const newItems = [...record.items];
    newItems.splice(index, 1);
    setRecord({ ...record, items: newItems });
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newItems = [...record.items];
    newItems[index][field] = value;
    
    if (field === 'quantity' || field === 'unit_price') {
      const q = Number(newItems[index].quantity || 0);
      const p = Number(newItems[index].unit_price || 0);
      newItems[index].total_price = q * p;
    }
    setRecord({ ...record, items: newItems });
  };

  const getSelectorData = () => {
    if (!activeSelector) return [];
    if (activeSelector === 'project') return projectsList.map((p: any) => ({ id: p.id, title: p.Property || p.project_name }));
    if (activeSelector === 'payee') return partnersList.filter((p: any) => p.partner_type === 'مقاول').map((p: any) => ({ id: p.id, title: p.name }));
    if (activeSelector === 'issueType') return [{id: 'صرف لمقاول', title: 'صرف لمقاول (يُحمل عليه)'}, {id: 'استهلاك مباشر', title: 'استهلاك مباشر (تكلفة)'}];
    
    if (activeSelector.startsWith('item_')) {
      return inventoryItems.map((i: any) => ({ id: i.item_id, title: i.item_name, subtitle: `متاح: ${i.available_qty} ${i.unit}`, item: i }));
    }
    
    if (activeSelector.startsWith('boq_')) {
      return boqItems
        .filter((b: any) => b.project_id === record.project_id)
        .map((b: any) => ({ id: b.id, title: b.work_item, subtitle: `الكمية: ${b.quantity}` }));
    }

    return [];
  };

  const handleSelect = (item: any) => {
    if (activeSelector === 'project') {
      setRecord({ ...record, project_id: item.id, items: record.items.map((i:any) => ({...i, boq_item_id: null})) });
    } else if (activeSelector === 'payee') {
      setRecord({ ...record, subcontractor_id: item.id });
    } else if (activeSelector === 'issueType') {
      setRecord({ ...record, issue_type: item.id });
    } else if (activeSelector?.startsWith('item_')) {
      const index = parseInt(activeSelector.split('_')[1]);
      const newItems = [...record.items];
      const selectedInv = item.item;
      newItems[index] = {
        ...newItems[index],
        item_id: selectedInv.item_id,
        item_name: selectedInv.item_name,
        available_qty: selectedInv.available_qty,
        unit: selectedInv.unit,
        unit_price: selectedInv.avg_cost || 0,
        total_price: (Number(newItems[index].quantity || 1) * Number(selectedInv.avg_cost || 0))
      };
      setRecord({ ...record, items: newItems });
    } else if (activeSelector?.startsWith('boq_')) {
      const index = parseInt(activeSelector.split('_')[1]);
      updateLine(index, 'boq_item_id', item.id);
    }
    setActiveSelector(null);
    setSearchQuery('');
  };

  const filteredSelectorData = getSelectorData().filter((item: any) => 
    item.title?.includes(searchQuery) || item.subtitle?.includes(searchQuery)
  );

  const handleSave = () => {
    if (!record.project_id) {
      return Toast.show({ type: 'error', text1: 'خطأ', text2: 'يرجى اختيار المشروع' });
    }
    if (record.issue_type === 'صرف لمقاول' && !record.subcontractor_id) {
      return Toast.show({ type: 'error', text1: 'خطأ', text2: 'يرجى اختيار المقاول' });
    }
    if (record.items.length === 0) {
      return Toast.show({ type: 'error', text1: 'خطأ', text2: 'يجب إضافة صنف واحد على الأقل' });
    }
    
    // Check available quantities
    for (let i = 0; i < record.items.length; i++) {
      const item = record.items[i];
      if (!item.item_id) {
        return Toast.show({ type: 'error', text1: 'خطأ', text2: `يرجى اختيار الصنف للسطر ${i+1}` });
      }
      if (Number(item.quantity) > Number(item.available_qty) && !editingRecord) {
        return Toast.show({ type: 'error', text1: 'الرصيد لا يكفي', text2: `الصنف ${item.item_name} رصيده المتاح ${item.available_qty} فقط` });
      }
    }

    onSave(record, !!editingRecord);
  };

  const totalQuantity = record.items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
  const grandTotal = record.items.reduce((sum: number, item: any) => sum + (Number(item.total_price) || 0), 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Ionicons name={record.id ? "create" : "push"} size={28} color="#c2410c" />
              <Text style={styles.title}>{record.id ? 'تعديل إذن صرف' : 'إصدار إذن صرف خامات'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
            <View style={{ paddingBottom: 30 }}>
              
              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>المشروع المستفيد *</Text>
                  <TouchableOpacity style={styles.selectorBtn} onPress={() => setActiveSelector('project')}>
                    <Text style={styles.selectorText}>{projectsList.find((p:any) => p.id === record.project_id)?.Property || 'اختر المشروع...'}</Text>
                    <Ionicons name="location-outline" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>نوع الصرف *</Text>
                  <TouchableOpacity style={styles.selectorBtn} onPress={() => setActiveSelector('issueType')}>
                    <Text style={styles.selectorText}>{record.issue_type}</Text>
                    <Ionicons name="swap-horizontal" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.row}>
                {record.issue_type === 'صرف لمقاول' ? (
                  <View style={styles.col}>
                    <Text style={styles.label}>المقاول المستلم *</Text>
                    <TouchableOpacity style={styles.selectorBtn} onPress={() => setActiveSelector('payee')}>
                      <Text style={styles.selectorText}>{partnersList.find((p:any) => p.id === record.subcontractor_id)?.name || 'اختر المقاول...'}</Text>
                      <Ionicons name="person-outline" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.col}>
                    <Text style={styles.label}>اسم المستلم (نصي)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput style={styles.inputWithIcon} value={record.contractor_text_name} onChangeText={(t) => setRecord({...record, contractor_text_name: t})} textAlign="right" placeholder="اسم المهندس أو الموظف" />
                    </View>
                  </View>
                )}
                <View style={styles.col}>
                  <Text style={styles.label}>تاريخ الصرف</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="calendar-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput style={styles.inputWithIcon} value={record.issue_date} onChangeText={(t) => setRecord({...record, issue_date: t})} textAlign="right" />
                  </View>
                </View>
              </View>

              <View style={styles.linesSection}>
                <View style={styles.linesHeader}>
                  <Text style={styles.linesTitle}>الأصناف المنصرفة</Text>
                  <TouchableOpacity style={styles.addLineBtn} onPress={addLine}>
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={styles.addLineText}>صنف جديد</Text>
                  </TouchableOpacity>
                </View>

                {record.items.map((line: any, index: number) => (
                  <View key={line.id || index.toString()} style={styles.lineCard}>
                    <View style={styles.lineHeader}>
                      <Text style={styles.lineNumber}>رقم {index + 1}</Text>
                      <TouchableOpacity onPress={() => removeLine(index)} style={styles.removeLineBtn}>
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>اختيار الصنف المراد صرفه</Text>
                    <TouchableOpacity style={[styles.selectorBtn, { marginBottom: 10 }]} onPress={() => setActiveSelector(`item_${index}`)}>
                      <Text style={styles.selectorText}>{line.item_name || 'اختر الصنف من المخزن...'}</Text>
                      <Ionicons name="cube-outline" size={18} color="#94a3b8" />
                    </TouchableOpacity>

                    <Text style={styles.label}>ربط ببند المشروع (BOQ)</Text>
                    <TouchableOpacity style={[styles.selectorBtn, { marginBottom: 10 }, !record.project_id && {opacity: 0.5}]} onPress={() => {
                        if (!record.project_id) Toast.show({ type: 'info', text1: 'تنبيه', text2: 'اختر المشروع أولاً' });
                        else setActiveSelector(`boq_${index}`);
                    }}>
                      <Text style={styles.selectorText}>{boqItems.find((b:any) => b.id === line.boq_item_id)?.work_item || 'اختر البند المستهدف...'}</Text>
                      <Ionicons name="document-text-outline" size={18} color="#94a3b8" />
                    </TouchableOpacity>

                    <View style={styles.row}>
                      <View style={styles.col}>
                        <Text style={styles.label}>سعر الوحدة</Text>
                        <TextInput style={styles.input} value={String(line.unit_price)} onChangeText={(t) => updateLine(index, 'unit_price', t)} keyboardType="numeric" textAlign="center" />
                      </View>
                      <View style={styles.col}>
                        <Text style={styles.label}>الكمية المتاحة: {line.available_qty}</Text>
                        <TextInput style={styles.input} value={String(line.quantity)} onChangeText={(t) => updateLine(index, 'quantity', t)} keyboardType="numeric" textAlign="center" />
                      </View>
                    </View>
                    <View style={styles.lineTotalBox}>
                      <Text style={styles.lineTotalLabel}>الإجمالي:</Text>
                      <Text style={styles.lineTotalValue}>{Number(line.total_price).toLocaleString()} ر.س</Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.label}>ملاحظات</Text>
              <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={record.notes} onChangeText={(t) => setRecord({...record, notes: t})} multiline textAlign="right" placeholder="ملاحظات حول الإذن..." />

            </View>
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.footerTotals}>
              <View style={styles.totalItem}>
                <Text style={styles.totalLabel}>الكمية</Text>
                <Text style={styles.totalVal}>{totalQuantity}</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={styles.totalLabel}>المجموع</Text>
                <Text style={styles.totalValFinal}>{grandTotal.toLocaleString()} ر.س</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>حفظ وإصدار</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* شاشة اختيار (Smart Combo Fullscreen) */}
      {activeSelector && (
        <View style={styles.fullScreenSelector}>
          <View style={styles.selectorHeader}>
            <TouchableOpacity onPress={() => {setActiveSelector(null); setSearchQuery('');}} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.selectorTitle}>اختر من القائمة</Text>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#94a3b8" />
            <TextInput style={styles.searchInput} placeholder="ابحث هنا..." value={searchQuery} onChangeText={setSearchQuery} textAlign="right" autoFocus />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {filteredSelectorData.map((item: any, idx: number) => (
              <TouchableOpacity key={idx} style={styles.selectorItem} onPress={() => handleSelect(item)}>
                <View>
                  <Text style={styles.selectorItemTitle}>{item.title}</Text>
                  {item.subtitle && <Text style={styles.selectorItemSubtitle}>{item.subtitle}</Text>}
                </View>
              </TouchableOpacity>
            ))}
            {filteredSelectorData.length === 0 && (
              <Text style={styles.emptyText}>لا توجد نتائج</Text>
            )}
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#f1f5f9', height: '90%', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  titleContainer: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  formContainer: { padding: 20 },
  row: { flexDirection: 'row-reverse', gap: 15, marginBottom: 15 },
  col: { flex: 1 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 6, textAlign: 'right' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 14, color: '#1e293b' },
  inputWrapper: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, height: 46 },
  inputIcon: { marginLeft: 8 },
  inputWithIcon: { flex: 1, fontSize: 14, color: '#1e293b' },
  selectorBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 15, height: 46 },
  selectorText: { fontSize: 14, color: '#1e293b', flex: 1, textAlign: 'right', fontWeight: '600' },
  linesSection: { marginTop: 10, marginBottom: 20 },
  linesHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  linesTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b' },
  addLineBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 5 },
  addLineText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  lineCard: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  lineHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  lineNumber: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8' },
  removeLineBtn: { padding: 5 },
  lineTotalBox: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginTop: 10 },
  lineTotalLabel: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  lineTotalValue: { fontSize: 15, fontWeight: '900', color: '#c2410c' },
  footer: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  footerTotals: { flexDirection: 'row-reverse', gap: 20 },
  totalItem: { alignItems: 'flex-end' },
  totalLabel: { fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 2 },
  totalVal: { fontSize: 16, color: '#1e293b', fontWeight: '900' },
  totalValFinal: { fontSize: 18, color: '#c2410c', fontWeight: '900' },
  saveBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, gap: 8 },
  saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  fullScreenSelector: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f8fafc', zIndex: 999 },
  selectorHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  selectorTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  searchBox: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', margin: 15, paddingHorizontal: 15, height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1' },
  searchInput: { flex: 1, fontSize: 15, textAlign: 'right', color: '#1e293b' },
  selectorItem: { padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  selectorItemTitle: { fontSize: 15, fontWeight: 'bold', color: '#334155', textAlign: 'right' },
  selectorItemSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'right' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 15 }
});
