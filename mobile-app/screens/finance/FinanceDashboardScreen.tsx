import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinanceLogic } from './finance_logic';

export default function FinanceDashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { totalReceipts, totalPayments, recentReceipts, recentPayments, loading, refreshing, onRefresh } = useFinanceLogic();

  const renderTransaction = (item: any, type: 'in' | 'out') => (
    <View key={item.id} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.iconContainer, type === 'in' ? styles.iconIn : styles.iconOut]}>
          <Ionicons name={type === 'in' ? "arrow-down-outline" : "arrow-up-outline"} size={20} color={type === 'in' ? "#16a34a" : "#ea580c"} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.partnerName}>{item.partners?.name || 'جهة غير محددة'}</Text>
          <Text style={styles.date}>{new Date(item.date).toLocaleDateString('en-GB')}</Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={[styles.amount, { color: type === 'in' ? "#16a34a" : "#ea580c" }]}>
            {type === 'in' ? '+' : '-'}{Number(item.amount).toLocaleString()}
          </Text>
          <Text style={styles.currency}>ر.س</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screenContainer}>
      <LinearGradient 
        colors={['#f8fafc', 'rgba(248, 250, 252, 0.9)', 'rgba(248, 250, 252, 0)']} 
        style={[styles.customHeader, { paddingTop: Math.max(insets.top, 10) }]}
      >
        <View style={styles.headerRight}>
          <TouchableOpacity style={{ padding: 4, marginLeft: 8 }} onPress={() => navigation.openDrawer()}>
            <Ionicons name="menu" size={28} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>المالية</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#c2410c" />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={{ padding: 20, paddingTop: insets.top + 60, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c2410c" />}
        >
          {/* Main KPI */}
          <View style={styles.kpiWrapper}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>إجمالي المقبوضات</Text>
              <Text style={[styles.kpiValue, { color: '#16a34a' }]}>{totalReceipts.toLocaleString()} <Text style={styles.kpiCurrency}>ر.س</Text></Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>إجمالي المدفوعات</Text>
              <Text style={[styles.kpiValue, { color: '#ea580c' }]}>{totalPayments.toLocaleString()} <Text style={styles.kpiCurrency}>ر.س</Text></Text>
            </View>
          </View>

          {/* Recent Receipts */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>أحدث المقبوضات</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Vouchers')}>
              <Text style={styles.seeAll}>عرض الكل</Text>
            </TouchableOpacity>
          </View>
          {recentReceipts.map(item => renderTransaction(item, 'in'))}

          {/* Recent Payments */}
          <View style={[styles.sectionHeader, { marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>أحدث المدفوعات</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Vouchers')}>
              <Text style={styles.seeAll}>عرض الكل</Text>
            </TouchableOpacity>
          </View>
          {recentPayments.map(item => renderTransaction(item, 'out'))}
        </ScrollView>
      )}
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
  kpiWrapper: { flexDirection: 'row-reverse', gap: 15, marginBottom: 25 },
  kpiBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.7)', padding: 20, borderRadius: 20, alignItems: 'center' },
  kpiLabel: { fontSize: 13, fontWeight: '800', color: '#475569', marginBottom: 8 },
  kpiValue: { fontSize: 20, fontWeight: '900' },
  kpiCurrency: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  sectionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b' },
  seeAll: { fontSize: 13, fontWeight: '800', color: '#c2410c' },
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
  currency: { fontSize: 11, fontWeight: '800', color: '#64748b' }
});
