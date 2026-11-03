import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVouchersLogic } from './vouchers_logic';
import AddVoucherModal from './AddVoucherModal';

export default function VouchersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { vouchers, loading, refreshing, onRefresh, filterType, setFilterType } = useVouchersLogic();
  const [modalVisible, setModalVisible] = useState(false);

  const renderFilterBtn = (id: string, label: string) => (
    <TouchableOpacity 
      style={[styles.filterBtn, filterType === id && styles.filterBtnActive]} 
      onPress={() => setFilterType(id)}
    >
      <Text style={[styles.filterText, filterType === id && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: any }) => {
    const isReceipt = item.type === 'in';
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={[styles.iconContainer, isReceipt ? styles.iconIn : styles.iconOut]}>
            <Ionicons name={isReceipt ? "arrow-down-outline" : "arrow-up-outline"} size={20} color={isReceipt ? "#16a34a" : "#ea580c"} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.partnerName}>{item.partners?.name || 'جهة غير محددة'}</Text>
            <Text style={styles.date}>{new Date(item.date).toLocaleDateString('en-GB')}</Text>
          </View>
          <View style={styles.amountContainer}>
            <Text style={[styles.amount, { color: isReceipt ? "#16a34a" : "#ea580c" }]}>
              {isReceipt ? '+' : '-'}{Number(item.amount).toLocaleString()}
            </Text>
            <Text style={styles.currency}>ر.س</Text>
          </View>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.voucherNumber}>{item.number}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
          <Text style={styles.methodText}>{item.payment_method || 'كاش'}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screenContainer}>
      <LinearGradient 
        colors={['#f8fafc', 'rgba(248, 250, 252, 0.9)', 'rgba(248, 250, 252, 0)']} 
        style={[styles.customHeader, { paddingTop: Math.max(insets.top, 10) }]}
      >
        <View style={styles.headerRight}>
          <TouchableOpacity style={{ padding: 4, marginLeft: 8 }} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>السندات</Text>
        </View>
      </LinearGradient>

      <View style={[styles.filtersContainer, { marginTop: insets.top + 60 }]}>
        {renderFilterBtn('all', 'الكل')}
        {renderFilterBtn('in', 'مقبوضات')}
        {renderFilterBtn('out', 'مدفوعات')}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#c2410c" />
        </View>
      ) : (
        <FlatList
          data={vouchers}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c2410c" />}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={styles.emptyText}>لا توجد سندات مسجلة</Text>}
        />
      )}

      {/* Add Voucher Modal */}
      <AddVoucherModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={30} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  customHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 20, zIndex: 10,
  },
  headerRight: { flexDirection: 'row-reverse', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#1e293b' },
  filtersContainer: { flexDirection: 'row-reverse', paddingHorizontal: 20, gap: 10, marginBottom: 10 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: '#e2e8f0' },
  filterBtnActive: { backgroundColor: 'rgba(202, 138, 4, 0.1)', borderColor: '#c2410c' },
  filterText: { fontSize: 13, fontWeight: '800', color: '#64748b' },
  filterTextActive: { color: '#c2410c' },
  card: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: 16, marginBottom: 12 },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  iconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  iconIn: { backgroundColor: 'rgba(22, 163, 74, 0.1)' },
  iconOut: { backgroundColor: 'rgba(234, 88, 12, 0.1)' },
  titleContainer: { flex: 1, alignItems: 'flex-end' },
  partnerName: { fontSize: 14, fontWeight: '800', color: '#1e293b', textAlign: 'right' },
  date: { fontSize: 11, fontWeight: '700', color: '#64748b', marginTop: 4 },
  amountContainer: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 4 },
  amount: { fontSize: 16, fontWeight: '900' },
  currency: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  footerRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  voucherNumber: { fontSize: 12, fontWeight: '800', color: '#1e293b' },
  statusBadge: { backgroundColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  methodText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 50, fontSize: 14, fontWeight: '800' },
  fab: {
    position: 'absolute', bottom: 25, right: 25, width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#c2410c', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#c2410c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8
  }
});
