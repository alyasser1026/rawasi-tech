import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MaterialsTab({ logic }: any) {
  const { projectDetails } = logic;
  const materialsList = projectDetails?.materials || [];

  if (materialsList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>لا توجد خامات مسحوبة لهذا المشروع</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {materialsList.map((item: any, index: number) => (
        <View key={item.id || index} style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="cube-outline" size={20} color="#c2410c" />
            </View>
            <View style={styles.titleContainer}>
              <Text style={styles.itemName}>{item.material?.name || 'خامة غير معروفة'}</Text>
              <Text style={styles.date}>{new Date(item.issue_date || item.created_at).toLocaleDateString('en-GB')}</Text>
            </View>
            <View style={styles.quantityContainer}>
              <Text style={styles.quantity}>{Number(item.quantity_issued || item.quantity || 0).toLocaleString()}</Text>
              <Text style={styles.unit}>{item.material?.unit || 'وحدة'}</Text>
            </View>
          </View>
          
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>المستلم: {item.issued_to || 'غير محدد'}</Text>
            {item.total_cost && (
              <Text style={styles.costText}>التكلفة: {Number(item.total_cost).toLocaleString()} ر.س</Text>
            )}
          </View>
        </View>
      ))}

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => alert('سيتم إضافة "صرف خامات" قريباً')}
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
  itemName: { fontSize: 15, fontWeight: '800', color: '#1e293b', textAlign: 'right' },
  date: { fontSize: 11, fontWeight: '700', color: '#64748b', marginTop: 4 },
  quantityContainer: { alignItems: 'flex-start', backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  quantity: { fontSize: 16, fontWeight: '900', color: '#1e293b' },
  unit: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  footerRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  footerText: { fontSize: 12, color: '#475569', fontWeight: '700' },
  costText: { fontSize: 12, color: '#c2410c', fontWeight: '800' },
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
