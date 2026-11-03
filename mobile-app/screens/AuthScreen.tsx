import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('تنبيه', 'برجاء إدخال البيانات');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('خطأ', 'البيانات غير صحيحة');
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>فاي تك</Text>
        <Text style={styles.subtitle}>النظام المحاسبي - نسخة الجوال</Text>
        <View style={styles.inputGroup}>
          <TextInput style={styles.input} placeholder="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" textAlign="right" />
          <TextInput style={styles.input} placeholder="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry textAlign="right" />
        </View>
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>تسجيل الدخول</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  formContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 25 },
  title: { fontSize: 36, fontWeight: 'bold', color: '#27272a', textAlign: 'center', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 40, fontWeight: '600' },
  inputGroup: { gap: 15, marginBottom: 30 },
  input: { backgroundColor: '#ffffff', paddingHorizontal: 15, paddingVertical: 18, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 16, textAlign: 'right' },
  button: { backgroundColor: '#c2410c', paddingVertical: 18, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' }
});
