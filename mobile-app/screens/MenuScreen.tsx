import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MaskedView from '@react-native-masked-view/masked-view';

const MENU_CATEGORIES = [
  {
    title: "إدارة المشاريع والتنفيذ",
    items: [
      { name: "سجل المشاريع", icon: "business", color: "#2563eb", route: "Projects" },
      { name: "أوامر التشغيل", icon: "document-text", color: "#ea580c", route: "JobOrders" },
      { name: "المقايسات (BOQ)", icon: "list", color: "#8b5a2b" },
      { name: "مكتبة البنود", icon: "library", color: "#64748b" },
      { name: "العمليات الميدانية", icon: "construct", color: "#f59e0b" },
      { name: "المستخلصات", icon: "documents", color: "#059669", route: "SubClaims" },
      { name: "مقاولي الباطن", icon: "people", color: "#475569", route: "Subcontractors" },
      { name: "يوميات العمالة", icon: "time", color: "#84cc16", route: "LaborLogs" },
      { name: "تكاليف العمالة", icon: "cash", color: "#65a30d" },
      { name: "استيراد بيانات", icon: "cloud-upload", color: "#0284c7" },
    ]
  },
  {
    title: "إدارة الحسابات المالية",
    items: [
      { name: "المالية", icon: "calculator", color: "#ea580c", route: "FinanceDashboard" },
      { name: "المصروفات", icon: "cash-outline", color: "#b91c1c", route: "Expenses" }, // 👈 ده السطر الجديد
      { name: "شجرة الحسابات", icon: "wallet", color: "#c2410c" },
      { name: "القيود اليومية", icon: "people-circle", color: "#d97706" },
      { name: "دفتر الأستاذ", icon: "list-circle", color: "#b45309" },
      { name: "سندات القبض", icon: "arrow-down-circle", color: "#16a34a", route: "Vouchers" },
      { name: "سندات الصرف", icon: "arrow-up-circle", color: "#dc2626", route: "Vouchers" },
    ]
  },
  {
    title: "العملاء والمبيعات",
    items: [
      { name: "أرصدة الشركاء", icon: "wallet", color: "#c2410c" },
      { name: "العملاء والشركاء", icon: "people-circle", color: "#d97706" },
      { name: "كشف حساب", icon: "list-circle", color: "#b45309" },
      { name: "الفواتير", icon: "calculator", color: "#ea580c" },
      { name: "سندات القبض", icon: "arrow-down-circle", color: "#16a34a" },
      { name: "سندات الصرف", icon: "arrow-up-circle", color: "#dc2626" },
    ]
  },
  {
    title: "المخزون والمواد",
    items: [
      { name: "إدارة المخزون", icon: "layers", color: "#475569" },
      { name: "دليل الخامات", icon: "cube", color: "#64748b" },
      { name: "أذونات الصرف", icon: "arrow-redo", color: "#f97316", route: "MaterialIssues" },
    ]
  },
  {
    title: "الإدارة والرقابة",
    items: [
      { name: "ملخص شامل", icon: "globe", color: "#3b82f6" },
      { name: "لوحة الأداء", icon: "speedometer", color: "#8b5cf6" },
      { name: "التقارير", icon: "bar-chart", color: "#14b8a6" },
      { name: "التدقيق (Audit)", icon: "shield-checkmark", color: "#0f766e" },
    ]
  },
  {
    title: "الموارد البشرية",
    items: [
      { name: "فريق العمل", icon: "people", color: "#6366f1" },
      { name: "الرواتب والأجور", icon: "card", color: "#14b8a6" },
      { name: "المخالفات", icon: "close-circle", color: "#dc2626" },
    ]
  },
  {
    title: "التواصل والنظام",
    items: [
      { name: "الرسائل", icon: "chatbubbles", color: "#3b82f6" },
      { name: "التنبيهات", icon: "notifications", color: "#f59e0b" },
      { name: "حسابي", icon: "person", color: "#64748b" },
      { name: "الإعدادات", icon: "settings", color: "#475569" },
    ]
  }
];

export default function MenuScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  
  const handlePress = (item: any) => {
    if (item.route) {
      navigation.navigate(item.route);
    } else {
      Alert.alert("قريباً 🛠️", `جاري برمجة واجهة (${item.name}) للنسخة القادمة.`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* 🌟 Custom Mobile Header - Gradient to Transparent */}
      <LinearGradient 
        colors={['#f8fafc', 'rgba(248, 250, 252, 0.9)', 'rgba(248, 250, 252, 0)']} 
        style={[styles.customHeader, { paddingTop: Math.max(insets.top, 10) }]}
      >
        {/* اليمين: الأيقونة وعنوان الصفحة */}
        <View style={styles.headerRight}>
          <Ionicons name="apps" size={24} color={COLORS.primary} style={{ marginLeft: 6, marginTop: 2 }} />
          <Text style={styles.headerTitle}>القائمة الشاملة</Text>
        </View>

        {/* اليسار: كارت اليوزر بدون حاوية والإشعارات */}
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.primary} />
            <View style={styles.badge}><Text style={styles.badgeText}>3</Text></View>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => Alert.alert('إعدادات الحساب', 'سيتم فتح شاشة الملف الشخصي والإعدادات قريباً')}
          >
            <Ionicons name="person-circle" size={36} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.screenContainer} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 50 }} 
      >
        
        {MENU_CATEGORIES.map((category, index) => (
        <View key={index} style={styles.categoryContainer}>
          <Text style={styles.categoryTitle}>{category.title}</Text>
          <View style={styles.grid}>
            {category.items.map((item, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={styles.gridItemWrapper} 
                onPress={() => handlePress(item)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#ffffff', '#f4f4f5']}
                  style={styles.gridItemInner}
                >
                  <LinearGradient
                    colors={[item.color, item.color + '90']}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={styles.iconContainer}
                  >
                    <Ionicons name={item.icon as any} size={24} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.itemText}>{item.name}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  customHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 25,
    zIndex: 10,
  },
  headerRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
  },
  headerLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    flex: 1,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  menuBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenContainer: { flex: 1, padding: SIZES.padding, paddingTop: 10 },
  categoryContainer: { marginBottom: 25 },
  categoryTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: '#1e293b', // Modern Slate 800
    marginBottom: 15, 
    textAlign: 'right', 
    paddingHorizontal: 5,
  },
  grid: { 
    flexDirection: 'row-reverse', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between'
  },
  gridItemWrapper: {
    width: '31%',
    marginBottom: 12,
  },
  gridItemInner: {
    borderRadius: SIZES.radiusSm, 
    padding: 10,
    alignItems: 'center',
    height: 100,
    justifyContent: 'center',
    shadowColor: '#ea580c', // Gold cinematic shadow
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5
  },
  itemText: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: '#475569', // Modern Slate 600 - very comfortable for reading
    textAlign: 'center',
  }
});
