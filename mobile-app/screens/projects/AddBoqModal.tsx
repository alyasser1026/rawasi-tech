import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';

interface AddBoqModalProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: () => void;
}

export default function AddBoqModal({ visible, onClose, projectId, onSuccess }: AddBoqModalProps) {
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState('main'); // 'main' or 'sub'
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!itemName.trim() || !allocatedAmount.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال اسم البند والقيمة المخصصة');
      return;
    }

    setLoading(true);
    try {
      // Assuming the table is projects_budget
      const { error } = await supabase
        .from('projects_budget')
        .insert({
          project_id: projectId,
          item_name: itemName,
          type: itemType,
          allocated_amount: parseFloat(allocatedAmount),
          actual_expenses: 0
        });

      if (error) {
        // Fallback for different schema column names if needed
        const { error: fallbackError } = await supabase
          .from('projects_budget')
          .insert({
            project_id: projectId,
            name: itemName,
            budget: parseFloat(allocatedAmount)
          });
        if (fallbackError) throw fallbackError;
      }

      setItemName('');
      setAllocatedAmount('');
      setItemType('main');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error adding BOQ:', err);
      Alert.alert('خطأ', 'تعذر حفظ البند. يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          <View style={styles.header}>
            <Text style={styles.title}>إضافة موازنة / بند جديد</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
            
            <Text style={styles.label}>نوع البند</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity 
                style={[styles.typeBtn, itemType === 'main' && styles.typeBtnActive]} 
                onPress={() => setItemType('main')}
              >
                <Text style={[styles.typeBtnText, itemType === 'main' && styles.typeBtnTextActive]}>بند رئيسي</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.typeBtn, itemType === 'sub' && styles.typeBtnActive]} 
                onPress={() => setItemType('sub')}
              >
                <Text style={[styles.typeBtnText, itemType === 'sub' && styles.typeBtnTextActive]}>بند فرعي</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>اسم البند</Text>
            <TextInput 
              style={styles.input} 
              placeholder="مثال: أعمال الحفر والردم"
              value={itemName}
              onChangeText={setItemName}
              textAlign="right"
            />

            <Text style={styles.label}>القيمة المخصصة (الميزانية)</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currency}>ر.س</Text>
              <TextInput 
                style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0, backgroundColor: 'transparent' }]} 
                placeholder="0.00"
                value={allocatedAmount}
                onChangeText={setAllocatedAmount}
                keyboardType="numeric"
                textAlign="right"
              />
            </View>

            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleSave}
              disabled={loading}
            >
              <LinearGradient colors={['#c2410c', '#a16207']} style={styles.saveBtnGradient}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.saveBtnText}>حفظ البند</Text>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginLeft: 8 }} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#f8fafc', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '80%' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  title: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  formContainer: { paddingBottom: 20 },
  label: { fontSize: 14, fontWeight: '800', color: '#475569', marginBottom: 10, textAlign: 'right' },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 20 },
  typeSelector: { flexDirection: 'row-reverse', gap: 10, marginBottom: 20 },
  typeBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  typeBtnActive: { backgroundColor: 'rgba(202, 138, 4, 0.1)', borderColor: '#c2410c' },
  typeBtnText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  typeBtnTextActive: { color: '#c2410c' },
  amountContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, marginBottom: 30, paddingHorizontal: 15 },
  currency: { fontSize: 16, fontWeight: '900', color: '#94a3b8' },
  saveBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#c2410c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  saveBtnGradient: { padding: 18, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { fontSize: 18, fontWeight: '900', color: '#ffffff' }
});
