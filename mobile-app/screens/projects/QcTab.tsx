import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function QcTab({ logic }: any) {
  const { projectDetails } = logic;
  const inspections = projectDetails?.inspections || [];

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="camera-outline" size={40} color="#c2410c" />
      </View>
      <Text style={styles.emptyText}>لم يتم رفع تقارير جودة أو صور للموقع حتى الآن</Text>
      <Text style={styles.subText}>سيتم إضافة ميزة رفع الصور قريباً</Text>

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => alert('سيتم إضافة "رفع مرفقات/صور الموقع" قريباً')}
      >
        <Ionicons name="add" size={24} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: 30 },
  iconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(202, 138, 4, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyText: { color: '#1e293b', fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subText: { color: '#94a3b8', fontSize: 13, fontWeight: '700', textAlign: 'center' },
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
