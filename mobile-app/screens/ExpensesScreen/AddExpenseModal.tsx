import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Image, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';

const EXPENSE_CATEGORIES = [
  "إعاشة وتغذية", "محروقات وانتقالات", "عدد ومعدات", "مستهلكات ومواد تشغيل", 
  "صيانة وإصلاحات", "مصاريف إدارية", "عمولات وبقشيش", "سكن وأثاث", 
  "أدوات نظافة", "مواد إنشائية"
];
const PAYMENT_METHODS = ["آجل", "تسوية داخلية"];

export default function AddExpenseModal({ visible, onClose, initialData, onSave, projectsList = [], accountsList = [], partnersList = [], jobOrdersList = [] }: any) {
  const [record, setRecord] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [addedLines, setAddedLines] = useState<any[]>([]);

  // 🌟 Selector Modal State
  const [activeSelector, setActiveSelector] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 🌟 حقول إدخال البند الجديد
  const [lineDesc, setLineDesc] = useState('');
  const [lineQty, setLineQty] = useState('1');
  const [linePrice, setLinePrice] = useState('');
  const [lineVat, setLineVat] = useState('');
  const [lineDiscount, setLineDiscount] = useState('');

  useEffect(() => {
    if (initialData) {
      setRecord({ ...initialData });
      if (initialData.lines_data) {
        setAddedLines(typeof initialData.lines_data === 'string' ? JSON.parse(initialData.lines_data) : initialData.lines_data);
      }
    } else {
      setRecord({ exp_date: new Date().toISOString().split('T')[0], payment_method: 'آجل' });
      setAddedLines([]);
    }
  }, [initialData, visible]);

  const currentQty = Number(lineQty || 0);
  const currentPrice = Number(linePrice || 0);
  const currentVat = Number(lineVat || 0);
  const currentDiscount = Number(lineDiscount || 0);

  const linesSubtotal = addedLines.reduce((sum: number, line: any) => sum + (Number(line.quantity) * Number(line.unit_price)), 0);
  const linesVat = addedLines.reduce((sum: number, line: any) => sum + Number(line.vat_amount || 0), 0);
  const linesDiscount = addedLines.reduce((sum: number, line: any) => sum + Number(line.discount_amount || 0), 0);

  const finalSubtotal = (currentQty * currentPrice) + linesSubtotal;
  const finalVat = currentVat + linesVat;
  const finalDiscount = currentDiscount + linesDiscount;
  const finalTotal = finalSubtotal + finalVat - finalDiscount;

  const handleAddLine = () => {
    if (!lineDesc) { Toast.show({ type: 'error', text1: 'خطأ', text2: 'أدخل البيان أولاً' }); return; }
    if (currentQty <= 0 || currentPrice <= 0) { Toast.show({ type: 'error', text1: 'خطأ', text2: 'الكمية والسعر يجب أن يكونا أكبر من صفر' }); return; }

    const newLine = {
      description: lineDesc,
      quantity: currentQty,
      unit_price: currentPrice,
      vat_amount: currentVat,
      discount_amount: currentDiscount,
      total_price: (currentQty * currentPrice) + currentVat - currentDiscount
    };

    setAddedLines([...addedLines, newLine]);
    setLineDesc(''); setLineQty('1'); setLinePrice(''); setLineVat(''); setLineDiscount('');
  };

  const handleRemoveLine = (index: number) => {
    setAddedLines(addedLines.filter((_, idx) => idx !== index));
  };

  const pickImage = async (useCamera: boolean = false) => {
    let result;
    if (useCamera) {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert("صلاحية الكاميرا", "يجب منح صلاحية الوصول للكاميرا لالتقاط صورة الفاتورة.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });
    }

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setRecord({ ...record, invoice_image: base64Image });
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      "إرفاق صورة الفاتورة",
      "اختر مصدر الصورة",
      [
        { text: "إلغاء", style: "cancel" },
        { text: "الاستوديو", onPress: () => pickImage(false) },
        { text: "الكاميرا", onPress: () => pickImage(true) }
      ]
    );
  };

  const handleSave = async () => {
    if (!record.exp_date) { Toast.show({ type: 'error', text1: 'تنبيه', text2: 'تاريخ المصروف مطلوب' }); return; }
    if (!record.main_category) { Toast.show({ type: 'error', text1: 'تنبيه', text2: 'التصنيف الرئيسي مطلوب' }); return; }
    if (!record.creditor_account || !record.payment_account) { Toast.show({ type: 'error', text1: 'تنبيه', text2: 'الحسابات الدائنة والمدينة مطلوبة' }); return; }

    const isSubContractorExpense = record.creditor_account.includes('التزام مقاولي الباطن') || !!record.payee_id;
    if (!record.job_order_id && record.project_id) {
        Toast.show({ type: 'error', text1: 'تنبيه', text2: 'يرجى تحديد أمر التشغيل لكي يُخصم المصروف من الميزانية بشكل صحيح' });
        return;
    }

    let finalLinesToSave = [...addedLines];
    if (lineDesc && currentQty > 0 && currentPrice > 0) {
      finalLinesToSave.push({ description: lineDesc, quantity: currentQty, unit_price: currentPrice, vat_amount: currentVat, discount_amount: currentDiscount });
    }

    if (finalLinesToSave.length === 0) { Toast.show({ type: 'error', text1: 'تنبيه', text2: 'يجب إدخال بند واحد على الأقل' }); return; }

    setLoading(true);
    if(onSave) {
        await onSave({
            ...record,
            lines_data: finalLinesToSave,
            quantity: 1,
            unit_price: finalSubtotal,
            vat_amount: finalVat,
            discount_amount: finalDiscount,
            total_price: finalTotal,
            is_deducted_from_contractor: isSubContractorExpense
        }, !!record.id);
    }
    setLoading(false);
    onClose();
  };

  // Selectors Data
  const getSelectorData = () => {
    switch (activeSelector) {
      case 'project': return projectsList.map((p: any) => ({ id: p.id, title: p.Property || p.project_name }));
      case 'payee': return partnersList.map((p: any) => ({ id: p.id, title: p.name, subtitle: p.partner_type }));
      case 'jobOrder': 
        return jobOrdersList
          .filter((j: any) => j.project_id === record.project_id)
          .map((j: any) => ({ id: j.id, title: j.order_number, subtitle: j.work_item }));
      case 'creditorAccount':
      case 'paymentAccount':
        return accountsList.map((a: any) => ({ id: a.id, title: a.name, subtitle: a.code }));
      case 'category': return EXPENSE_CATEGORIES.map(c => ({ id: c, title: c }));
      case 'paymentMethod': return PAYMENT_METHODS.map(p => ({ id: p, title: p }));
      default: return [];
    }
  };

  const handleSelect = (item: any) => {
    switch (activeSelector) {
      case 'project': setRecord({ ...record, project_id: item.id, site_ref: item.title, job_order_id: null }); break;
      case 'payee': setRecord({ ...record, payee_id: item.id, payee_name: item.title, sub_contractor: item.title, job_order_id: null }); break;
      case 'jobOrder': setRecord({ ...record, job_order_id: item.id }); break;
      case 'creditorAccount': setRecord({ ...record, creditor_account: `${item.subtitle} - ${item.title}` }); break;
      case 'paymentAccount': setRecord({ ...record, payment_account: `${item.subtitle} - ${item.title}` }); break;
      case 'category': setRecord({ ...record, main_category: item.title }); break;
      case 'paymentMethod': setRecord({ ...record, payment_method: item.title }); break;
    }
    setActiveSelector(null);
    setSearchQuery('');
  };

  const filteredSelectorData = getSelectorData().filter((item: any) => 
    item.title?.includes(searchQuery) || item.subtitle?.includes(searchQuery)
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Ionicons name={record.id ? "create" : "add-circle"} size={28} color="#c2410c" />
              <Text style={styles.title}>{record.id ? 'تعديل المصروف' : 'إنشاء مصروف جديد'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
            <View style={{ paddingBottom: 30 }}>
              
              {/* تاريخ المصروف وطريقة الدفع */}
              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>طريقة الدفع</Text>
                  <TouchableOpacity style={styles.selectorBtn} onPress={() => setActiveSelector('paymentMethod')}>
                    <Text style={styles.selectorText}>{record.payment_method || 'اختر...'}</Text>
                    <Ionicons name="chevron-down" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>التاريخ</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="calendar-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput style={styles.inputWithIcon} value={record.exp_date} onChangeText={(t) => setRecord({...record, exp_date: t})} textAlign="right" />
                  </View>
                </View>
              </View>

              {/* التصنيف الرئيسي والمشروع */}
              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>المشروع / الموقع</Text>
                  <TouchableOpacity style={styles.selectorBtn} onPress={() => setActiveSelector('project')}>
                    <Text style={styles.selectorText}>{record.site_ref || 'اختر المشروع...'}</Text>
                    <Ionicons name="location-outline" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>التصنيف الرئيسي</Text>
                  <TouchableOpacity style={styles.selectorBtn} onPress={() => setActiveSelector('category')}>
                    <Text style={styles.selectorText}>{record.main_category || 'اختر...'}</Text>
                    <Ionicons name="pricetag-outline" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* المقاول وأمر التشغيل */}
              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>أمر التشغيل</Text>
                  <TouchableOpacity style={[styles.selectorBtn, !record.project_id && {opacity: 0.5}]} onPress={() => {
                      if (!record.project_id) Toast.show({ type: 'info', text1: 'تنبيه', text2: 'يرجى اختيار المشروع أولاً' });
                      else setActiveSelector('jobOrder');
                  }}>
                    <Text style={styles.selectorText}>{record.job_order_id ? 'أمر شغل محدد ✅' : 'اختر...'}</Text>
                    <Ionicons name="document-text-outline" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>المقاول / المستفيد</Text>
                  <TouchableOpacity style={styles.selectorBtn} onPress={() => setActiveSelector('payee')}>
                    <Text style={styles.selectorText}>{record.payee_name || 'بدون مقاول...'}</Text>
                    <Ionicons name="person-outline" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* الحسابات */}
              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>الحساب الدائن (البنك/الصندوق)</Text>
                  <TouchableOpacity style={styles.selectorBtn} onPress={() => setActiveSelector('paymentAccount')}>
                    <Text style={styles.selectorText} numberOfLines={1}>{record.payment_account || 'اختر...'}</Text>
                    <Ionicons name="wallet-outline" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>حساب المصروف المدين</Text>
                  <TouchableOpacity style={styles.selectorBtn} onPress={() => setActiveSelector('creditorAccount')}>
                    <Text style={styles.selectorText} numberOfLines={1}>{record.creditor_account || 'اختر...'}</Text>
                    <Ionicons name="receipt-outline" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* صورة الفاتورة */}
              <Text style={[styles.label, {marginTop: 10}]}>صورة الفاتورة / المرفقات</Text>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={showImagePickerOptions}>
                {record.invoice_image ? (
                  <Image source={{ uri: record.invoice_image }} style={styles.previewImage} />
                ) : (
                  <View style={{alignItems: 'center'}}>
                    <Ionicons name="camera-outline" size={32} color="#c2410c" />
                    <Text style={styles.imagePickerText}>انقر لالتقاط صورة للفاتورة أو إرفاقها</Text>
                  </View>
                )}
              </TouchableOpacity>
              {record.invoice_image && (
                <TouchableOpacity onPress={() => setRecord({...record, invoice_image: null})} style={styles.removeImgBtn}>
                  <Text style={{color: '#ef4444', fontWeight: 'bold'}}>حذف الصورة</Text>
                </TouchableOpacity>
              )}

              {/* الأصناف المتعددة */}
              <View style={styles.linesSection}>
                <Text style={styles.sectionTitle}>إضافة تفاصيل الأصناف</Text>
                
                <View style={styles.lineInputContainer}>
                  <TextInput style={[styles.input, { textAlign: 'right', marginBottom: 10 }]} placeholder="اسم الصنف / البيان..." value={lineDesc} onChangeText={setLineDesc} />
                  
                  <View style={styles.row}>
                    <View style={styles.col}>
                      <TextInput style={styles.input} placeholder="السعر" keyboardType="numeric" value={linePrice} onChangeText={setLinePrice} />
                    </View>
                    <View style={styles.col}>
                      <TextInput style={styles.input} placeholder="الكمية" keyboardType="numeric" value={lineQty} onChangeText={setLineQty} />
                    </View>
                  </View>
                  
                  <View style={styles.row}>
                    <View style={styles.col}>
                      <TextInput style={styles.input} placeholder="الخصم" keyboardType="numeric" value={lineDiscount} onChangeText={setLineDiscount} />
                    </View>
                    <View style={styles.col}>
                      <TextInput style={styles.input} placeholder="الضريبة" keyboardType="numeric" value={lineVat} onChangeText={setLineVat} />
                    </View>
                  </View>

                  <TouchableOpacity style={styles.addLineBtn} onPress={handleAddLine}>
                    <Text style={styles.addLineText}>إضافة للقائمة</Text>
                    <Ionicons name="add-circle" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                {addedLines.map((line, idx) => (
                  <View key={idx} style={styles.lineItem}>
                    <TouchableOpacity onPress={() => handleRemoveLine(idx)}>
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineItemDesc} numberOfLines={1}>{line.description}</Text>
                      <Text style={styles.lineItemDetails}>الكمية: {line.quantity} × {line.unit_price} ريال | ص: {line.total_price}</Text>
                    </View>
                  </View>
                ))}
              </View>

            </View>
          </ScrollView>

          {/* Footer - Live Calculations & Save */}
          <View style={styles.footer}>
            <View style={styles.totalsContainer}>
              <View style={styles.totalRow}><Text style={styles.totalVal}>{finalSubtotal.toLocaleString()}</Text><Text style={styles.totalLbl}>المجموع</Text></View>
              <View style={styles.totalRow}><Text style={[styles.totalVal, {color: '#ef4444'}]}>{finalVat.toLocaleString()}</Text><Text style={styles.totalLbl}>الضريبة (+)</Text></View>
              <View style={styles.totalRow}><Text style={[styles.totalVal, {color: '#10b981'}]}>{finalDiscount.toLocaleString()}</Text><Text style={styles.totalLbl}>الخصم (-)</Text></View>
              <View style={styles.totalRowFinal}><Text style={styles.finalVal}>{finalTotal.toLocaleString()}</Text><Text style={styles.finalLbl}>الصافي</Text></View>
            </View>

            <TouchableOpacity style={[styles.saveBtn, loading && {opacity: 0.7}]} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>حفظ المصروف 💾</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* 🌟 Full Screen Selector Modal 🌟 */}
        <Modal visible={activeSelector !== null} transparent animationType="slide" onRequestClose={() => setActiveSelector(null)}>
          <View style={styles.selectorOverlay}>
            <View style={styles.selectorContainer}>
              <View style={styles.selectorHeader}>
                <TouchableOpacity onPress={() => { setActiveSelector(null); setSearchQuery(''); }} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
                <Text style={styles.selectorTitle}>اختر من القائمة</Text>
                <View style={{width: 30}} />
              </View>
              
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="بحث..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  textAlign="right"
                />
              </View>

              <FlatList
                data={filteredSelectorData}
                keyExtractor={(item, index) => item.id ? String(item.id) : String(index)}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.selectorListItem} onPress={() => handleSelect(item)}>
                    <Text style={styles.selectorItemTitle}>{item.title}</Text>
                    {item.subtitle && <Text style={styles.selectorItemSubtitle}>{item.subtitle}</Text>}
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ padding: 20 }}
                ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20, color: '#94a3b8'}}>لا توجد نتائج</Text>}
              />
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#f8fafc', borderTopLeftRadius: 30, borderTopRightRadius: 30, flex: 0.95, overflow: 'hidden' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  titleContainer: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  closeBtn: { padding: 5 },
  formContainer: { padding: 20 },
  
  row: { flexDirection: 'row-reverse', gap: 15, marginBottom: 15 },
  col: { flex: 1 },
  label: { fontSize: 13, fontWeight: '800', color: '#64748b', textAlign: 'right', marginBottom: 6 },
  
  inputWrapper: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12 },
  inputIcon: { marginLeft: 8 },
  inputWithIcon: { flex: 1, paddingVertical: 12, fontSize: 14, fontWeight: '700', color: '#1e293b' },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  
  selectorBtn: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14 },
  selectorText: { fontSize: 13, fontWeight: '700', color: '#1e293b', flex: 1, textAlign: 'right' },
  
  imagePickerBtn: { backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#c2410c', borderStyle: 'dashed', borderRadius: 16, height: 120, justifyContent: 'center', alignItems: 'center', marginVertical: 10, overflow: 'hidden' },
  imagePickerText: { marginTop: 10, fontSize: 13, fontWeight: '800', color: '#854d0e' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImgBtn: { alignSelf: 'center', marginBottom: 10 },

  linesSection: { backgroundColor: '#ffffff', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginBottom: 15, textAlign: 'right' },
  lineInputContainer: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginBottom: 15 },
  addLineBtn: { backgroundColor: '#3b82f6', flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 12, marginTop: 10, gap: 8 },
  addLineText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  
  lineItem: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 },
  lineItemDesc: { fontSize: 14, fontWeight: '800', color: '#1e293b', textAlign: 'right' },
  lineItemDetails: { fontSize: 12, fontWeight: '700', color: '#64748b', textAlign: 'right', marginTop: 4 },

  footer: { backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  totalsContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12 },
  totalRow: { alignItems: 'center' },
  totalRowFinal: { alignItems: 'center', borderRightWidth: 1, borderRightColor: '#cbd5e1', paddingRight: 15 },
  totalLbl: { fontSize: 11, fontWeight: '800', color: '#64748b', marginTop: 4 },
  totalVal: { fontSize: 14, fontWeight: '900', color: '#1e293b' },
  finalLbl: { fontSize: 12, fontWeight: '900', color: '#c2410c', marginTop: 4 },
  finalVal: { fontSize: 18, fontWeight: '900', color: '#c2410c' },
  
  saveBtn: { backgroundColor: '#c2410c', paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#c2410c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  saveBtnText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },

  selectorOverlay: { flex: 1, backgroundColor: '#f8fafc' },
  selectorContainer: { flex: 1, paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  selectorHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15 },
  selectorTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b' },
  searchBar: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#ffffff', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#e2e8f0', height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  searchInput: { flex: 1, marginRight: 10, fontSize: 15, fontWeight: '700', color: '#1e293b' },
  selectorListItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'flex-start' },
  selectorItemTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', textAlign: 'right' },
  selectorItemSubtitle: { fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 4, textAlign: 'right' },
});