import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';

export default function SettingsScreen() {
  return (
    <View style={styles.screenContainer}>
      <Text style={styles.screenTitle}>إعدادات الحساب ⚙️</Text>
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: '#ef4444', marginTop: 20 }]} 
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={styles.buttonText}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  screenTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, textAlign: 'right' },
  button: { backgroundColor: '#c2410c', paddingVertical: 18, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' }
});
