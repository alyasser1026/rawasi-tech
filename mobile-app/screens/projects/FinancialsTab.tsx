import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function FinancialsTab({ logic }: any) {
  const { projectDetails } = logic;
  const invoicesList = projectDetails?.invoices || [];

  if (invoicesList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>لا توجد فواتير أو مستخلصات مسجلة</Text>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    if (status === 'مدفوعة' || status === 'معتمد') return { bg: 'rgba(22, 163, 74, 0.1)', text: '#16a34a' }; // Green
    if (status === 'غير مدفوعة' || status === 'مسودة' || status === 'قيد المراجعة') return { bg: 'rgba(234, 88, 12, 0.1)', text: '#ea580c' }; // Orange
    return { bg: 'rgba(100, 116, 139, 0.1)', text: '#64748b' }; // Gray
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {invoicesList.map((item: any, index: number) => {
        const isSubClaim = item.display_type === 'مستخلص مقاول باطن';
        const stColors = getStatusColor(item.status);
        
        return (
          <View key={item.id || index} style={styles.card}>
            <View style={styles.headerRow}>
              <View style={[styles.iconContainer, isSubClaim ? { backgroundColor: 'rgba(71, 85, 105, 0.1)' } : {}]}>
                <Ionicons name={isSubClaim ? "people-outline" : "wallet-outline"} size={20} color={isSubClaim ? "#475569" : "#c2410c"} />
              </View>
              <View style={styles.titleContainer}>
                <Text style={styles.invoiceNumber}>مستخلص رقم: {item.display_number}</Text>
                <Text style={styles.date}>{new Date(item.issue_date || item.created_at).toLocaleDateString('en-GB')}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: stColors.bg }]}>
                <Text style={[styles.statusText, { color: stColors.text }]}>{item.status}</Text>
              </View>
            </View>
            
            <View style={styles.footerRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>{item.display_type}</Text>
              </View>
              <View style={styles.amountContainer}>
                <Text style={styles.amount}>{Number(item.final_amount || 0).toLocaleString()}</Text>
                <Text style={styles.currency}>ر.س</Text>
              </View>
            </View>
          </View>
        );
      })}

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => alert('سيتم إضافة "إنشاء مستخلص جديد" قريباً')}
      >
        <Ionicons name="add" size={24} color="#ffffff" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  emptyText: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(202, 138, 4, 0.1)', justifyContent: 'center', alignItems: 'center' },
  titleContainer: { flex: 1, alignItems: 'flex-end' },
  invoiceNumber: { fontSize: 14, fontWeight: '800', color: '#1e293b', textAlign: 'right' },
  date: { fontSize: 11, fontWeight: '700', color: '#64748b', marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800' },
  footerRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  typeBadge: { backgroundColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  amountContainer: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 4 },
  amount: { fontSize: 16, fontWeight: '900', color: '#1e293b' },
  currency: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#c2410c',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#c2410c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  }
});
