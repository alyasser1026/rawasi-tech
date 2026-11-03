import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useExpensesLogic } from './expenses_logic'; 
import AddExpenseModal from './AddExpenseModal';

const MAIN_CATEGORIES = [
  "إعاشة وتغذية", "محروقات وانتقالات", "عدد ومعدات", "مستهلكات ومواد تشغيل", 
  "صيانة وإصلاحات", "مصاريف إدارية", "عمولات وبقشيش", "سكن وأثاث", 
  "أدوات نظافة", "مواد إنشائية"
];

export default function ExpensesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { 
    expenses, loading, refreshing, onRefresh, 
    filterStatus, setFilterStatus, paymentFilter, setPaymentFilter,
    deleteExpenses, postExpenses, suspendExpenses, payExpensesBulk, saveExpense,
    projectsList, accountsList, partnersList, jobOrdersList
  } = useExpensesLogic();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 🌟 الفلاتر المتقدمة الشاملة
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('الكل');
  const [searchPayee, setSearchPayee] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredExpenses.length && filteredExpenses.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredExpenses.map((e: any) => e.id));
    }
  };

  const handleAdd = () => {
    setEditingRecord(null); 
    setModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    setModalVisible(true);
  };

  const handleBulkAction = (actionName: string, actionFn: (ids: string[]) => Promise<void>) => {
    Alert.alert('تأكيد', `هل أنت متأكد من ${actionName} لـ ${selectedIds.length} سجل؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تأكيد', onPress: async () => {
        await actionFn(selectedIds);
        setSelectedIds([]);
        Toast.show({ type: 'success', text1: 'نجاح', text2: `${actionName} تم بنجاح ✅` });
      }}
    ]);
  };

  // 🌟 الفلترة المحلية الشاملة
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp: any) => {
      let valid = true;
      if (categoryFilter !== 'الكل' && exp.main_category !== categoryFilter) valid = false;
      
      // بحث بالبيان أو اسم المستفيد
      if (searchPayee) {
        const searchLower = searchPayee.toLowerCase();
        const matchesPayee = exp.sub_contractor?.toLowerCase().includes(searchLower) || exp.payee_name?.toLowerCase().includes(searchLower);
        const matchesDesc = exp.description?.toLowerCase().includes(searchLower) || (exp.lines_data && JSON.stringify(exp.lines_data).toLowerCase().includes(searchLower));
        if (!matchesPayee && !matchesDesc) valid = false;
      }
      
      if (dateFrom && exp.exp_date && exp.exp_date < dateFrom) valid = false;
      if (dateTo && exp.exp_date && exp.exp_date > dateTo) valid = false;

      // فلتر الحالة (معلق / مرحل)
      if (filterStatus === 'معلق' && exp.is_posted) valid = false;
      if (filterStatus === 'مرحل' && !exp.is_posted) valid = false;

      // فلتر السداد
      if (paymentFilter !== 'الكل') {
        const total = exp.total_price || ((Number(exp.quantity || 1) * Number(exp.unit_price || 0)) + Number(exp.vat_amount || 0) - Number(exp.discount_amount || 0)); 
        const paid = Number(exp.paid_amount || 0);
        if (paymentFilter === 'مسدد' && paid < total) valid = false;
        if (paymentFilter === 'غير مسدد' && paid > 0) valid = false;
        if (paymentFilter === 'مسدد جزئي' && (paid === 0 || paid >= total)) valid = false;
      }

      return valid;
    });
  }, [expenses, categoryFilter, searchPayee, dateFrom, dateTo, filterStatus, paymentFilter]);

  // 🌟 الإجماليات اللحظية
  const totalAmount = filteredExpenses.reduce((sum: number, row: any) => {
    const total = row.total_price || ((Number(row.quantity || 1) * Number(row.unit_price || 0)) + Number(row.vat_amount || 0) - Number(row.discount_amount || 0)); 
    return sum + total;
  }, 0);

  const renderItem = ({ item }: { item: any }) => {
    const isSelected = selectedIds.includes(item.id);
    const total = item.total_price || ((Number(item.quantity || 1) * Number(item.unit_price || 0)) + Number(item.vat_amount || 0) - Number(item.discount_amount || 0)); 
    const paid = Number(item.paid_amount || 0);
    
    let paymentStatus = 'غير مسدد ❌';
    let payColor = '#ef4444';
    if (paid > 0 && paid < total) { paymentStatus = 'مسدد جزئي ⏳'; payColor = '#f59e0b'; }
    else if (paid >= total) { paymentStatus = 'مسدد ✅'; payColor = '#10b981'; }

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected, { borderRightColor: item.is_posted ? '#10b981' : '#f59e0b' }]}
        onPress={() => toggleSelection(item.id)}
        onLongPress={() => handleEdit(item)}
      >
        <View style={styles.cardHeader}>
          <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flex: 1}}>
            <TouchableOpacity onPress={() => toggleSelection(item.id)}>
              <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={26} color={isSelected ? "#c2410c" : "#cbd5e1"} />
            </TouchableOpacity>
            <Text style={styles.payeeName} numberOfLines={1}>{item.sub_contractor || item.payee_name || 'بدون مستفيد'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: item.is_posted ? '#ecfdf5' : '#fff7ed' }]}>
            <Text style={[styles.statusText, { color: item.is_posted ? '#10b981' : '#f59e0b' }]}>{item.is_posted ? 'معتمد ✅' : 'معلق ⏳'}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="folder-open" size={14} color="#64748b" /></View>
            <Text style={styles.infoText}>{item.main_category || 'غير مصنف'}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="location" size={14} color="#64748b" /></View>
            <Text style={styles.infoText} numberOfLines={1}>{item.site_ref || 'عام'}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>الصافي</Text>
            <Text style={styles.footerValTotal}>{total.toLocaleString()} ر.س</Text>
          </View>
          <View style={styles.footerSeparator} />
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>السداد</Text>
            <Text style={[styles.footerVal, { color: payColor, fontSize: 13 }]}>{paymentStatus}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.title}>سجل المصروفات 💸</Text>
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={[styles.backBtn, showFilters && {backgroundColor: '#c2410c', borderColor: '#c2410c'}]}>
          <Ionicons name="options-outline" size={22} color={showFilters ? "#fff" : "#1e293b"} />
        </TouchableOpacity>
      </View>

      {/* 🌟 لوحة الفلاتر المتقدمة (تم إضافة التواريخ 🚀) */}
      {showFilters && (
        <View style={styles.advancedFilters}>
          
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrapperFlex}>
              <Ionicons name="search" size={16} color="#94a3b8" style={styles.searchIcon} />
              <TextInput style={styles.searchInput} placeholder="ابحث باسم المستفيد أو البيان..." value={searchPayee} onChangeText={setSearchPayee} textAlign="right" />
            </View>
          </View>

          <Text style={styles.filterLabel}>حالة الاعتماد:</Text>
          <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 10 }}>
            {['الكل', 'مرحل', 'معلق'].map(status => (
              <TouchableOpacity key={status} onPress={() => setFilterStatus(status)} style={[styles.chip, filterStatus === status && styles.chipActive]}>
                <Text style={[styles.chipText, filterStatus === status && styles.chipTextActive]}>{status}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterLabel}>حالة السداد:</Text>
          <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 10 }}>
            {['الكل', 'مسدد', 'مسدد جزئي', 'غير مسدد'].map(status => (
              <TouchableOpacity key={status} onPress={() => setPaymentFilter(status)} style={[styles.chip, paymentFilter === status && styles.chipActive]}>
                <Text style={[styles.chipText, paymentFilter === status && styles.chipTextActive]}>{status}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchInputWrapperFlex}>
              <Ionicons name="calendar-outline" size={16} color="#94a3b8" style={styles.searchIcon} />
              <TextInput style={styles.searchInput} placeholder="إلى (YYYY-MM-DD)" value={dateTo} onChangeText={setDateTo} textAlign="right" />
            </View>
            <View style={styles.searchInputWrapperFlex}>
              <Ionicons name="calendar-outline" size={16} color="#94a3b8" style={styles.searchIcon} />
              <TextInput style={styles.searchInput} placeholder="من (YYYY-MM-DD)" value={dateFrom} onChangeText={setDateFrom} textAlign="right" />
            </View>
          </View>

          <Text style={styles.filterLabel}>التصنيف الرئيسي:</Text>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 5, marginBottom: 10 }}>
            <TouchableOpacity onPress={() => setCategoryFilter('الكل')} style={[styles.chip, categoryFilter === 'الكل' && styles.chipActive]}><Text style={[styles.chipText, categoryFilter === 'الكل' && styles.chipTextActive]}>الكل</Text></TouchableOpacity>
            {MAIN_CATEGORIES.map(cat => (
              <TouchableOpacity key={cat} onPress={() => setCategoryFilter(cat)} style={[styles.chip, categoryFilter === cat && styles.chipActive]}>
                <Text style={[styles.chipText, categoryFilter === cat && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {(searchPayee !== '' || dateFrom !== '' || dateTo !== '' || categoryFilter !== 'الكل' || filterStatus !== 'الكل' || paymentFilter !== 'الكل') && (
            <TouchableOpacity 
              style={styles.clearFiltersBtn} 
              onPress={() => { setSearchPayee(''); setDateFrom(''); setDateTo(''); setCategoryFilter('الكل'); setFilterStatus('الكل'); setPaymentFilter('الكل'); }}
            >
              <Text style={styles.clearFiltersText}>مسح الفلاتر ✖</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 🌟 شريط الإجماليات و تحديد الكل */}
      <View style={styles.summaryContainer}>
        <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
          <Ionicons name={selectedIds.length > 0 && selectedIds.length === filteredExpenses.length ? "checkbox" : "square-outline"} size={24} color="#c2410c" />
          <Text style={styles.selectAllText}>تحديد الكل</Text>
        </TouchableOpacity>
        <View style={styles.summarySeparator} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>إجمالي المصروفات</Text>
          <Text style={styles.summaryValueWage}>{totalAmount.toLocaleString()} ر.س</Text>
        </View>
        <View style={styles.summarySeparator} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>العدد</Text>
          <Text style={styles.summaryValueCount}>{filteredExpenses.length}</Text>
        </View>
      </View>

      {/* 🌟 Bulk Actions */}
      {selectedIds.length > 0 && (
        <View style={styles.bulkActions}>
          <Text style={styles.bulkText}>محدد ({selectedIds.length})</Text>
          <View style={{ flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#10b981' }]} onPress={() => handleBulkAction('اعتماد', postExpenses)}><Ionicons name="checkmark-done" size={18} color="#fff" /></TouchableOpacity>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#f59e0b' }]} onPress={() => handleBulkAction('فك الترحيل', suspendExpenses)}><Ionicons name="return-down-back" size={18} color="#fff" /></TouchableOpacity>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#3b82f6' }]} onPress={() => handleBulkAction('سداد مجمع', payExpensesBulk)}><Ionicons name="cash-outline" size={18} color="#fff" /></TouchableOpacity>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#ef4444' }]} onPress={() => handleBulkAction('حذف', deleteExpenses)}><Ionicons name="trash" size={18} color="#fff" /></TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList 
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c2410c" />}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <Ionicons name="document-text-outline" size={60} color="#cbd5e1" />
              <Text style={{ color: '#94a3b8', marginTop: 10, fontWeight: 'bold' }}>لا توجد مصروفات تطابق بحثك</Text>
            </View>
          ) : null
        }
      />

      {/* المودال */}
      <AddExpenseModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        initialData={editingRecord}
        onSave={saveExpense} // تم التمرير بنجاح 🛠️
        projectsList={projectsList}
        accountsList={accountsList}
        partnersList={partnersList}
        jobOrdersList={jobOrdersList}
      />

      <TouchableOpacity style={styles.fab} onPress={handleAdd}>
        <LinearGradient colors={['#c2410c', '#854d0e']} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color="#ffffff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, paddingTop: 10, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  title: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  
  advancedFilters: { backgroundColor: '#ffffff', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  searchRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  searchInputWrapperFlex: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 10 },
  searchIcon: { marginLeft: 5 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, fontWeight: '700', color: '#1e293b' },
  filterLabel: { fontSize: 13, fontWeight: '800', color: '#64748b', textAlign: 'right', marginBottom: 5 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#c2410c', borderColor: '#c2410c' },
  chipText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  chipTextActive: { color: '#ffffff' },
  clearFiltersBtn: { alignSelf: 'flex-start', padding: 5 },
  clearFiltersText: { color: '#ef4444', fontSize: 13, fontWeight: 'bold' },

  summaryContainer: { flexDirection: 'row-reverse', backgroundColor: '#ffffff', marginHorizontal: 15, marginTop: 15, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  selectAllBtn: { flex: 0.8, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  selectAllText: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summarySeparator: { width: 1, height: '100%', backgroundColor: '#e2e8f0' },
  summaryLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', marginBottom: 4 },
  summaryValueWage: { fontSize: 18, fontWeight: '900', color: '#059669' },
  summaryValueCount: { fontSize: 18, fontWeight: '900', color: '#3b82f6' },

  bulkActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#1e293b', marginHorizontal: 15, marginTop: 15, borderRadius: 16, elevation: 5 },
  bulkText: { fontSize: 15, fontWeight: '900', color: '#ffffff' },
  bulkBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  
  listContent: { padding: 15, paddingBottom: 120 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 18, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', borderRightWidth: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, position: 'relative' },
  cardSelected: { borderColor: '#c2410c', backgroundColor: '#fefce8' },
  selectedOverlay: { position: 'absolute', top: -10, left: -10, backgroundColor: '#fff', borderRadius: 15, padding: 2, zIndex: 10, elevation: 5 },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  payeeName: { fontSize: 16, fontWeight: '900', color: '#27272a', flex: 1, textAlign: 'right' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginLeft: 10 },
  statusText: { fontSize: 10, fontWeight: '900' },
  cardBody: { marginBottom: 15, gap: 8 },
  infoRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  iconBox: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  infoText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#475569', textAlign: 'right' },
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  footerItem: { flex: 1, alignItems: 'center' },
  footerSeparator: { width: 1, height: '100%', backgroundColor: '#e2e8f0' },
  footerLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', marginBottom: 2 },
  footerVal: { fontSize: 15, fontWeight: '900', color: '#1e293b' },
  footerValTotal: { fontSize: 16, fontWeight: '900', color: '#059669' },
  
  fab: { position: 'absolute', bottom: 30, right: 30, borderRadius: 30, overflow: 'hidden', shadowColor: '#c2410c', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  fabGradient: { width: 64, height: 64, justifyContent: 'center', alignItems: 'center' }
});