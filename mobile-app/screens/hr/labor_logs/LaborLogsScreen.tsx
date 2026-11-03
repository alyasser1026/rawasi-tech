import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLaborLogsLogic, LaborLog } from './labor_logs_logic';
import AddLaborLogModal from './AddLaborLogModal';

export default function LaborLogsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { 
    logs, loading, refreshing, onRefresh, 
    filterStatus, setFilterStatus, defaultLog, 
    saveLog, postLogs, suspendLogs, deleteLogs,
    workersList, sitesList, projectsList, jobOrdersList, partnersList
  } = useLaborLogsLogic();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<LaborLog | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 🌟 حالات الفلاتر المتقدمة
  const [showFilters, setShowFilters] = useState(false);
  const [searchWorker, setSearchWorker] = useState('');
  const [searchItem, setSearchItem] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleEdit = (log: LaborLog) => {
    setEditingLog(log);
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditingLog(defaultLog);
    setModalVisible(true);
  };

  const handleBulkAction = (actionName: string, actionFn: (ids: string[]) => Promise<void>) => {
    Alert.alert('تأكيد', `هل أنت متأكد من ${actionName} لـ ${selectedIds.length} سجل؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تأكيد', onPress: async () => {
        await actionFn(selectedIds);
        setSelectedIds([]);
        Toast.show({
          type: 'success',
          text1: 'نجاح',
          text2: `${actionName} تم بنجاح ✅`,
        });
      }}
    ]);
  };

  const renderFilterBtn = (label: string) => {
    const isActive = filterStatus === label;
    return (
      <TouchableOpacity style={{ flex: 1 }} onPress={() => setFilterStatus(label)}>
        <LinearGradient 
          colors={isActive ? ['#c2410c', '#a16207'] : ['#f1f5f9', '#f1f5f9']}
          style={styles.filterBtn}
        >
          <Text style={[styles.filterBtnText, isActive && styles.filterBtnTextActive]}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // 🌟 تطبيق الفلاتر المتقدمة على البيانات
  const filteredLogs = logs.filter(log => {
    let valid = true;
    if (searchWorker && !log.worker_name?.includes(searchWorker)) valid = false;
    if (searchItem && !log.work_item?.includes(searchItem)) valid = false;
    if (dateFrom && log.work_date && log.work_date < dateFrom) valid = false;
    if (dateTo && log.work_date && log.work_date > dateTo) valid = false;
    return valid;
  });

  // 🌟 حساب الإجماليات (الملخص) بناءً على الفلاتر النشطة
  const totalWages = filteredLogs.reduce((sum, log) => sum + (Number(log.daily_wage) || 0), 0);
  const totalRecords = filteredLogs.length;

  const renderItem = ({ item }: { item: LaborLog }) => {
    const isSelected = selectedIds.includes(item.id!);
    const statusColor = item.is_posted ? '#10b981' : '#f59e0b';
    const statusBg = item.is_posted ? '#ecfdf5' : '#fff7ed';

    const handleUnpost = async () => {
      await suspendLogs([item.id!]);
      Toast.show({
        type: 'success',
        text1: 'نجاح',
        text2: 'تم فك الترحيل بنجاح ✅',
      });
    };

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected, { borderRightColor: statusColor }]}
        onPress={() => toggleSelection(item.id!)}
        onLongPress={() => handleEdit(item)}
      >
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <Ionicons name="checkmark-circle" size={24} color="#c2410c" />
          </View>
        )}

        <View style={styles.cardHeader}>
          <Text style={styles.workerName}>{item.worker_name}</Text>
          <View style={styles.badgeContainer}>
            {item.is_posted && !isSelected && (
              <TouchableOpacity onPress={handleUnpost} style={styles.unpostBtn}>
                <Text style={styles.unpostBtnText}>فك الترحيل</Text>
              </TouchableOpacity>
            )}
            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.is_posted ? 'معتمد ✅' : 'معلق ⏳'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="calendar" size={14} color="#64748b" /></View>
            <Text style={styles.infoText}>{item.work_date}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="location" size={14} color="#64748b" /></View>
            <Text style={styles.infoText} numberOfLines={2}>{item.site_ref || 'بدون موقع'}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="construct" size={14} color="#64748b" /></View>
            <Text style={styles.infoText} numberOfLines={2}>{item.work_item || 'بدون بند'}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>اليومية</Text>
            <Text style={styles.footerValWage}>{item.daily_wage || '0.0'} ر.س</Text>
          </View>
          <View style={styles.footerSeparator} />
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>الإنجاز</Text>
            <Text style={styles.footerVal}>{item.completion_percentage || '0'}%</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 🌟 Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.title}>يوميات العمالة 👷‍♂️</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 🌟 Status Filters */}
      <View style={styles.filtersContainer}>
        {renderFilterBtn('الكل')}
        {renderFilterBtn('معتمد')}
        {renderFilterBtn('معلق')}
        <TouchableOpacity 
          style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]} 
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="options-outline" size={22} color={showFilters ? "#ffffff" : "#64748b"} />
        </TouchableOpacity>
      </View>

      {/* 🌟 Advanced Filters Panel */}
      {showFilters && (
        <View style={styles.advancedFilters}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="person-outline" size={16} color="#94a3b8" style={styles.searchIcon} />
              <TextInput 
                style={styles.searchInput} 
                placeholder="ابحث باسم العامل..." 
                value={searchWorker} 
                onChangeText={setSearchWorker} 
                textAlign="right"
              />
            </View>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="construct-outline" size={16} color="#94a3b8" style={styles.searchIcon} />
              <TextInput 
                style={styles.searchInput} 
                placeholder="ابحث بالبند..." 
                value={searchItem} 
                onChangeText={setSearchItem} 
                textAlign="right"
              />
            </View>
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="calendar-outline" size={16} color="#94a3b8" style={styles.searchIcon} />
              <TextInput 
                style={styles.searchInput} 
                placeholder="إلى (YYYY-MM-DD)" 
                value={dateTo} 
                onChangeText={setDateTo} 
                textAlign="right"
              />
            </View>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="calendar-outline" size={16} color="#94a3b8" style={styles.searchIcon} />
              <TextInput 
                style={styles.searchInput} 
                placeholder="من (YYYY-MM-DD)" 
                value={dateFrom} 
                onChangeText={setDateFrom} 
                textAlign="right"
              />
            </View>
          </View>

          {(searchWorker !== '' || searchItem !== '' || dateFrom !== '' || dateTo !== '') && (
            <TouchableOpacity 
              style={styles.clearFiltersBtn} 
              onPress={() => { setSearchWorker(''); setSearchItem(''); setDateFrom(''); setDateTo(''); }}
            >
              <Text style={styles.clearFiltersText}>مسح الفلاتر ✖</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 🌟 Summary Bar (الملخص) */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>الإجمالي (ر.س)</Text>
          <Text style={styles.summaryValueWage}>{totalWages.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={styles.summarySeparator} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>عدد السجلات</Text>
          <Text style={styles.summaryValueCount}>{totalRecords}</Text>
        </View>
      </View>

      {/* 🌟 Bulk Actions */}
      {selectedIds.length > 0 && (
        <View style={styles.bulkActions}>
          <Text style={styles.bulkText}>محدد ({selectedIds.length})</Text>
          <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#10b981' }]} onPress={() => handleBulkAction('اعتماد', postLogs)}>
              <Ionicons name="checkmark-done" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#f59e0b' }]} onPress={() => handleBulkAction('فك الترحيل', suspendLogs)}>
              <Ionicons name="return-down-back" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: '#ef4444' }]} onPress={() => handleBulkAction('حذف', deleteLogs)}>
              <Ionicons name="trash" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 🌟 List */}
      <FlatList 
        data={filteredLogs}
        keyExtractor={(item) => item.id!}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c2410c" />}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <Ionicons name="document-text-outline" size={60} color="#cbd5e1" />
              <Text style={{ color: '#94a3b8', marginTop: 10, fontWeight: 'bold' }}>لا توجد يوميات تطابق بحثك</Text>
            </View>
          ) : null
        }
      />

      {/* 🌟 Modals & FAB */}
      <AddLaborLogModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        initialData={editingLog}
        onSave={saveLog}
        workersList={workersList}
        sitesList={projectsList} 
        projectsList={projectsList}
        jobOrdersList={jobOrdersList}
        partnersList={partnersList}
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
  filtersContainer: { flexDirection: 'row-reverse', padding: 15, gap: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filterBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  filterBtnText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  filterBtnTextActive: { color: '#ffffff' },
  
  /* 🌟 Advanced Filters Styles */
  filterToggleBtn: { padding: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  filterToggleBtnActive: { backgroundColor: '#c2410c' },
  advancedFilters: { backgroundColor: '#ffffff', padding: 15, paddingTop: 5, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  searchRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  searchInputWrapper: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 10 },
  searchIcon: { marginLeft: 5 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, fontWeight: '700', color: '#1e293b' },
  clearFiltersBtn: { alignSelf: 'flex-start', marginTop: 5, padding: 5 },
  clearFiltersText: { color: '#ef4444', fontSize: 13, fontWeight: 'bold' },

  /* 🌟 Summary Styles */
  summaryContainer: { flexDirection: 'row-reverse', backgroundColor: '#ffffff', marginHorizontal: 15, marginTop: 15, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summarySeparator: { width: 1, height: '100%', backgroundColor: '#e2e8f0' },
  summaryLabel: { fontSize: 13, fontWeight: '800', color: '#64748b', marginBottom: 4 },
  summaryValueWage: { fontSize: 18, fontWeight: '900', color: '#10b981' },
  summaryValueCount: { fontSize: 18, fontWeight: '900', color: '#3b82f6' },

  bulkActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#1e293b', marginHorizontal: 15, marginTop: 15, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  bulkText: { fontSize: 15, fontWeight: '900', color: '#ffffff' },
  bulkBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 15, paddingBottom: 120 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 18, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', borderRightWidth: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, position: 'relative' },
  cardSelected: { borderColor: '#c2410c', backgroundColor: '#fefce8' },
  selectedOverlay: { position: 'absolute', top: -10, left: -10, backgroundColor: '#fff', borderRadius: 15, padding: 2, zIndex: 10, elevation: 5 },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  workerName: { fontSize: 17, fontWeight: '900', color: '#27272a', flex: 1, textAlign: 'right' },
  badgeContainer: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '900' },
  unpostBtn: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  unpostBtnText: { color: '#ef4444', fontSize: 11, fontWeight: '800' },
  cardBody: { marginBottom: 15, gap: 8 },
  infoRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  iconBox: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  infoText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#475569', textAlign: 'right' },
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  footerItem: { flex: 1, alignItems: 'center' },
  footerSeparator: { width: 1, height: '100%', backgroundColor: '#e2e8f0' },
  footerLabel: { fontSize: 12, fontWeight: '800', color: '#94a3b8', marginBottom: 4 },
  footerVal: { fontSize: 16, fontWeight: '900', color: '#1e293b' },
  footerValWage: { fontSize: 16, fontWeight: '900', color: '#059669' },
  fab: { position: 'absolute', bottom: 30, right: 30, borderRadius: 30, overflow: 'hidden', shadowColor: '#c2410c', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  fabGradient: { width: 64, height: 64, justifyContent: 'center', alignItems: 'center' }
});