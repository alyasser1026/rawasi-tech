import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterialIssuesLogic } from './material_issues_logic';
import Toast from 'react-native-toast-message';
import MaterialIssueModal from './MaterialIssueModal';

export default function MaterialIssuesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  
  const { 
    issues, loading, refreshing, onRefresh, 
    filterStatus, setFilterStatus,
    deleteIssues, postIssues, suspendIssues, saveIssue,
    projectsList, partnersList, inventoryItems, boqItems
  } = useMaterialIssuesLogic();
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredIssues.length && filteredIssues.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredIssues.map((e: any) => e.id));
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
    Alert.alert(`تأكيد ال${actionName}`, `هل أنت متأكد من ${actionName} (${selectedIds.length}) سجل؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'نعم', onPress: async () => {
        await actionFn(selectedIds);
        setSelectedIds([]);
      }}
    ]);
  };

  const filteredIssues = useMemo(() => {
    return issues.filter((issue: any) => {
      let valid = true;
      
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesProj = issue.project?.project_name?.toLowerCase().includes(searchLower) || issue.project?.Property?.toLowerCase().includes(searchLower);
        const matchesSub = issue.subcontractor?.name?.toLowerCase().includes(searchLower) || issue.contractor_text_name?.toLowerCase().includes(searchLower);
        const matchesNumber = issue.issue_number?.toLowerCase().includes(searchLower);
        if (!matchesProj && !matchesSub && !matchesNumber) valid = false;
      }
      
      if (dateFrom && issue.issue_date && issue.issue_date < dateFrom) valid = false;
      if (dateTo && issue.issue_date && issue.issue_date > dateTo) valid = false;

      if (filterStatus === 'معلق' && issue.is_posted) valid = false;
      if (filterStatus === 'مرحل' && !issue.is_posted) valid = false;

      return valid;
    });
  }, [issues, searchQuery, dateFrom, dateTo, filterStatus]);

  const totalAmount = filteredIssues.reduce((sum: number, row: any) => {
    return sum + Number(row.total_amount || 0);
  }, 0);

  const renderItem = ({ item }: { item: any }) => {
    const isSelected = selectedIds.includes(item.id);
    const total = Number(item.total_amount || 0);
    const subName = item.subcontractor?.name || item.contractor_text_name || 'بدون مقاول';
    
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
            <Text style={styles.payeeName} numberOfLines={1}>{subName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: item.is_posted ? '#ecfdf5' : '#fff7ed' }]}>
            <Text style={[styles.statusText, { color: item.is_posted ? '#10b981' : '#f59e0b' }]}>{item.is_posted ? 'معتمد ✅' : 'معلق ⏳'}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="folder-open" size={14} color="#64748b" /></View>
            <Text style={styles.infoText}>{item.project?.Property || 'بدون مشروع'}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="document-text" size={14} color="#64748b" /></View>
            <Text style={styles.infoText} numberOfLines={1}>رقم الإذن: {item.issue_number}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>التاريخ</Text>
            <Text style={styles.footerVal}>{item.issue_date}</Text>
          </View>
          <View style={styles.footerSeparator} />
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>إجمالي التكلفة</Text>
            <Text style={styles.footerValTotal}>{total.toLocaleString()} ر.س</Text>
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
        <Text style={styles.title}>صرف المواد 📦</Text>
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={[styles.backBtn, showFilters && {backgroundColor: '#c2410c', borderColor: '#c2410c'}]}>
          <Ionicons name="options-outline" size={22} color={showFilters ? "#fff" : "#1e293b"} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.advancedFilters}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrapperFlex}>
              <Ionicons name="search" size={16} color="#94a3b8" style={styles.searchIcon} />
              <TextInput style={styles.searchInput} placeholder="بحث برقم الإذن، المشروع أو المقاول..." value={searchQuery} onChangeText={setSearchQuery} textAlign="right" />
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

          {(searchQuery !== '' || dateFrom !== '' || dateTo !== '' || filterStatus !== 'الكل') && (
            <TouchableOpacity 
              style={styles.clearFiltersBtn} 
              onPress={() => { setSearchQuery(''); setDateFrom(''); setDateTo(''); setFilterStatus('الكل'); }}
            >
              <Text style={styles.clearFiltersText}>مسح الفلاتر ✖</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.summaryContainer}>
        <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
          <Ionicons name={selectedIds.length > 0 && selectedIds.length === filteredIssues.length ? "checkbox" : "square-outline"} size={24} color="#c2410c" />
          <Text style={styles.selectAllText}>تحديد الكل</Text>
        </TouchableOpacity>
        <View style={styles.summarySeparator} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>إجمالي التكلفة</Text>
          <Text style={styles.summaryValueWage}>{totalAmount.toLocaleString()} ر.س</Text>
        </View>
        <View style={styles.summarySeparator} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>العدد</Text>
          <Text style={styles.summaryValueCount}>{filteredIssues.length}</Text>
        </View>
      </View>

      {selectedIds.length > 0 && (
        <View style={styles.bulkActions}>
          <Text style={styles.bulkText}>محدد ({selectedIds.length})</Text>
          <View style={{ flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#10b981' }]} onPress={() => handleBulkAction('اعتماد', postIssues)}><Ionicons name="checkmark-done" size={18} color="#fff" /></TouchableOpacity>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#f59e0b' }]} onPress={() => handleBulkAction('فك الترحيل', suspendIssues)}><Ionicons name="return-down-back" size={18} color="#fff" /></TouchableOpacity>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#ef4444' }]} onPress={() => handleBulkAction('حذف', deleteIssues)}><Ionicons name="trash" size={18} color="#fff" /></TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#c2410c" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredIssues}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={<Text style={styles.emptyText}>لا توجد أذونات مطابقة للبحث</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={handleAdd}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {modalVisible && (
        <MaterialIssueModal 
          visible={modalVisible} 
          onClose={() => setModalVisible(false)} 
          record={editingRecord}
          onSave={async (data: any, isEdit: boolean) => {
            const success = await saveIssue(data, isEdit);
            if (success) setModalVisible(false);
          }}
          projectsList={projectsList}
          partnersList={partnersList}
          inventoryItems={inventoryItems}
          boqItems={boqItems}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 },
  title: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  
  advancedFilters: { backgroundColor: '#fff', margin: 15, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
  searchRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 10 },
  searchInputWrapperFlex: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0', height: 44 },
  searchIcon: { marginLeft: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#1e293b', textAlign: 'right' },
  filterLabel: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 6, textAlign: 'right' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#fef3c7', borderColor: '#c2410c' },
  chipText: { fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  chipTextActive: { color: '#c2410c' },
  clearFiltersBtn: { alignSelf: 'center', marginTop: 10, paddingVertical: 5 },
  clearFiltersText: { color: '#ef4444', fontSize: 13, fontWeight: 'bold' },

  summaryContainer: { flexDirection: 'row-reverse', backgroundColor: '#ffffff', marginHorizontal: 15, marginTop: 15, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  selectAllBtn: { flex: 0.8, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  selectAllText: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summarySeparator: { width: 1, height: '100%', backgroundColor: '#e2e8f0' },
  summaryLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', marginBottom: 4 },
  summaryValueWage: { fontSize: 16, fontWeight: '900', color: '#c2410c' },
  summaryValueCount: { fontSize: 16, fontWeight: '900', color: '#3b82f6' },

  bulkActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#1e293b', marginHorizontal: 15, marginTop: 15, borderRadius: 16, elevation: 5 },
  bulkText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  bulkBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  listContainer: { padding: 15, paddingBottom: 100 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', borderRightWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  cardSelected: { backgroundColor: '#fefce8', borderColor: '#c2410c' },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  payeeName: { fontSize: 16, fontWeight: '900', color: '#1e293b', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '900' },
  cardBody: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, gap: 8, marginBottom: 12 },
  infoRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  iconBox: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  infoText: { fontSize: 13, color: '#475569', fontWeight: '600', flex: 1, textAlign: 'right' },
  cardFooter: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  footerItem: { flex: 1, alignItems: 'center' },
  footerSeparator: { width: 1, height: 24, backgroundColor: '#e2e8f0' },
  footerLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 'bold', marginBottom: 2 },
  footerVal: { fontSize: 13, color: '#334155', fontWeight: '800' },
  footerValTotal: { fontSize: 14, color: '#c2410c', fontWeight: '900' },

  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
  fab: { position: 'absolute', bottom: 25, left: 25, width: 60, height: 60, borderRadius: 30, backgroundColor: '#c2410c', alignItems: 'center', justifyContent: 'center', shadowColor: '#c2410c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }
});
