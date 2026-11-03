import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AddBoqModal from './AddBoqModal';

export default function BoqTab({ logic }: any) {
  const { projectDetails } = logic;
  const [modalVisible, setModalVisible] = useState(false);
  const boqList = projectDetails?.boq || [];

  if (boqList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>لا توجد مقايسات مسجلة لهذا المشروع</Text>
      </View>
    );
  }

  // فرز العناصر الرئيسية أولاً ثم الفرعية (تبسيط للعرض)
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {boqList.map((item: any, index: number) => (
        <View key={item.id || index} style={[styles.card, item.item_type === 'رئيسي' && styles.mainCard]}>
          <View style={styles.headerRow}>
            <Text style={styles.itemName}>{item.item_name || 'بند غير مسمى'}</Text>
            {item.item_type && (
              <View style={[styles.typeBadge, item.item_type === 'رئيسي' ? styles.mainBadge : styles.subBadge]}>
                <Text style={[styles.typeText, item.item_type === 'رئيسي' ? styles.mainBadgeText : styles.subBadgeText]}>
                  {item.item_type}
                </Text>
              </View>
            )}
          </View>
          
          {item.item_type !== 'رئيسي' && (
            <View style={styles.detailsGrid}>
              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>الكمية</Text>
                <Text style={styles.detailValue}>{item.quantity || 0} {item.unit_of_measurement || ''}</Text>
              </View>
              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>سعر الوحدة</Text>
                <Text style={styles.detailValue}>{Number(item.unit_price || 0).toLocaleString()} ر.س</Text>
              </View>
              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>الإجمالي</Text>
                <Text style={styles.detailValue}>{Number(item.total_price || 0).toLocaleString()} ر.س</Text>
              </View>
            </View>
          )}

          {item.allocated_expenses > 0 && (
            <View style={styles.allocatedRow}>
              <Text style={styles.allocatedLabel}>التكاليف المحملة (المصروفات الفعلية):</Text>
              <Text style={styles.allocatedValue}>{Number(item.allocated_expenses).toLocaleString()} ر.س</Text>
            </View>
          )}
        </View>
      ))}

      {/* Add BOQ Modal */}
      <AddBoqModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        projectId={projectDetails?.id}
        onSuccess={() => {
          if (logic.onRefresh) logic.onRefresh();
        }}
      />

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setModalVisible(true)}
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
  mainCard: {
    backgroundColor: 'rgba(202, 138, 4, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(202, 138, 4, 0.2)'
  },
  headerRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  itemName: { fontSize: 16, fontWeight: '800', color: '#1e293b', flex: 1, textAlign: 'right', marginLeft: 10 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  mainBadge: { backgroundColor: '#c2410c' },
  subBadge: { backgroundColor: '#e2e8f0' },
  typeText: { fontSize: 11, fontWeight: '800' },
  mainBadgeText: { color: '#ffffff' },
  subBadgeText: { color: '#475569' },
  detailsGrid: { flexDirection: 'row-reverse', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.02)', padding: 10, borderRadius: 12, gap: 10 },
  detailBox: { flex: 1, alignItems: 'center' },
  detailLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', marginBottom: 4 },
  detailValue: { fontSize: 13, color: '#1e293b', fontWeight: '900' },
  allocatedRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  allocatedLabel: { fontSize: 12, color: '#475569', fontWeight: '700' },
  allocatedValue: { fontSize: 13, color: '#dc2626', fontWeight: '900' },
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
