import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal } from 'react-native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- الثوابت والبيانات (مقتبسة من منطق الويب) ---
const MOTIVATIONAL_MESSAGES = [
  "يوم جديد لنجاحات مبهرة، توكل على الله وانطلق! 🚀",
  "النجاح يبدأ بخطوة، وأنت الآن في المسار الصحيح! 🌟",
  "الأرقام لا تكذب، اجعل أرقام اليوم أفضل من الأمس! 📊",
  "كل مجهود صغير يتراكم ليصنع إنجازاً عظيماً! 💪",
  "فاي تك تكبر بجهودكم، شكراً لعملكم الرائع! 🏗️",
  "الدقة في العمل هي أساس الثقة، حافظ على تميزك! 💎",
  "اجعل هدفك اليوم هو التميز، لا مجرد الإنجاز! ✨",
  "لا حدود لما يمكنك تحقيقه اليوم، انطلق بثقة! 🎯",
  "من جدّ وجد، ومن زرع حصد! العمل الجاد لا يخون! 🌾",
  "بثقتنا بالله وبجهودكم، نحن نبني المستقبل! 🏛️"
];

const DEFAULT_FAVORITES = ['projects', 'job_orders', 'users'];

// قائمة افتراضية للصفحات في الموبايل
const AVAILABLE_PAGES = [
  { id: 'projects', title: 'المشاريع', icon: 'business', color: '#3b82f6' },
  { id: 'job_orders', title: 'أوامر التشغيل', icon: 'document-text', color: '#ea580c' },
  { id: 'users', title: 'فريق العمل', icon: 'people', color: '#16a34a' },
  { id: 'journal', title: 'القيود اليومية', icon: 'journal', color: '#8b5cf6' },
  { id: 'accounts', title: 'الحسابات', icon: 'wallet', color: '#14b8a6' },
  { id: 'settings', title: 'الإعدادات', icon: 'settings', color: '#64748b' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  
  // --- States ---
  const [stats, setStats] = useState({ projects: 0, users: 0, jobOrders: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('زميلنا العزيز');
  
  // States الويب
  const [greeting, setGreeting] = useState('');
  const [quote, setQuote] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isFavModalOpen, setIsFavModalOpen] = useState(false);
  const [tempFavorites, setTempFavorites] = useState<string[]>([]);

  // --- دوال جلب البيانات ---
  const fetchDashboardStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // جلب اسم المستخدم
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        if (profile?.full_name) {
           setUserName(profile.full_name.split(' ')[0]); // الاسم الأول فقط
        }
      }

      const [projRes, usersRes, jobRes] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('job_orders').select('id', { count: 'exact', head: true })
      ]);

      setStats({
        projects: projRes.count || 0,
        users: usersRes.count || 0,
        jobOrders: jobRes.count || 0
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // --- منطق الترحيب والمفضلات (من الويب) ---
  useEffect(() => {
    // تحديد وقت اليوم
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('صباح الخير ☀️');
    else if (hour < 18) setGreeting('طاب مساؤك 🌤️');
    else setGreeting('مساء الخير 🌙');

    // اختيار مقولة عشوائية
    setQuote(MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)]);

    // جلب المفضلات من الذاكرة
    const loadFavorites = async () => {
      const saved = await AsyncStorage.getItem('rawasi_fav_pages');
      if (saved) {
        setFavorites(JSON.parse(saved));
      } else {
        setFavorites(DEFAULT_FAVORITES);
      }
    };
    
    loadFavorites();
    fetchDashboardStats();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardStats();
  };

  // --- دوال المفضلات ---
  const openFavModal = () => {
    setTempFavorites(favorites);
    setIsFavModalOpen(true);
  };

  const toggleFav = (id: string) => {
    if (tempFavorites.includes(id)) {
      setTempFavorites(tempFavorites.filter(f => f !== id));
    } else {
      setTempFavorites([...tempFavorites, id]);
    }
  };

  const saveFavorites = async () => {
    setFavorites(tempFavorites);
    await AsyncStorage.setItem('rawasi_fav_pages', JSON.stringify(tempFavorites));
    setIsFavModalOpen(false);
  };

  const favItems = favorites.map(id => AVAILABLE_PAGES.find(p => p.id === id)).filter(Boolean);

  return (
    <View style={styles.screenContainer}>
      {/* 🌟 Custom Mobile Header */}
      <LinearGradient 
        colors={['#f8fafc', 'rgba(248, 250, 252, 0.9)', 'rgba(248, 250, 252, 0)']} 
        style={[styles.customHeader, { paddingTop: Math.max(insets.top, 10) }]}
      >
        <View style={styles.headerRight}>
          <Ionicons name="grid" size={24} color={COLORS.primary} style={{ marginLeft: 6, marginTop: 2 }} />
          <Text style={styles.headerTitle}>لوحة التحكم</Text>
        </View>

        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.primary} />
            <View style={styles.badge}><Text style={styles.badgeText}>3</Text></View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('إعدادات الحساب', 'سيتم فتح شاشة الملف الشخصي')}>
            <Ionicons name="person-circle" size={36} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: SIZES.padding, paddingTop: insets.top + 50 }} 
      >
        {/* 🌟 الكارت الترحيبي الديناميكي (مقتبس من الويب بنفس تصميم الجوال) */}
        <LinearGradient colors={['#ffffff', '#f4f4f5']} style={[styles.cardWrapper, { marginTop: 15, padding: 25, alignItems: 'flex-start' }]}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10, width: '100%' }}>
            <LinearGradient colors={COLORS.cinematicGold as [string, string, string, string, string]} start={{x:0, y:0}} end={{x:1, y:1}} style={[styles.iconWrapper, { width: 50, height: 50, borderRadius: 25, marginLeft: 15, marginBottom: 0 }]}>
              <Ionicons name="sparkles" size={24} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.welcomeTitle, { textAlign: 'right', fontSize: 22, marginBottom: 2 }]}>{greeting}، {userName}</Text>
              <Text style={[styles.welcomeText, { textAlign: 'right', fontSize: 13, color: COLORS.textLight }]}>{quote}</Text>
            </View>
          </View>
        </LinearGradient>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 50 }} />
        ) : (
          <View style={[styles.statsGrid, { marginTop: 20 }]}>
            {/* الإحصائيات الأساسية */}
            <LinearGradient colors={['#ffffff', '#f4f4f5']} style={styles.cardWrapper}>
              <LinearGradient colors={['#3b82f6', '#2563eb']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.iconWrapper}>
                <Ionicons name="business" size={26} color="#fff" />
              </LinearGradient>
              <Text style={styles.statNumber}>{stats.projects}</Text>
              <Text style={styles.statLabel}>المشاريع النشطة</Text>
            </LinearGradient>

            <LinearGradient colors={['#ffffff', '#f4f4f5']} style={styles.cardWrapper}>
              <LinearGradient colors={['#ea580c', '#c2410c']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.iconWrapper}>
                <Ionicons name="document-text" size={26} color="#fff" />
              </LinearGradient>
              <Text style={styles.statNumber}>{stats.jobOrders}</Text>
              <Text style={styles.statLabel}>أوامر التشغيل</Text>
            </LinearGradient>

            <LinearGradient colors={['#ffffff', '#f4f4f5']} style={styles.cardWrapper}>
              <LinearGradient colors={['#16a34a', '#15803d']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.iconWrapper}>
                <Ionicons name="people" size={26} color="#fff" />
              </LinearGradient>
              <Text style={styles.statNumber}>{stats.users}</Text>
              <Text style={styles.statLabel}>فريق العمل</Text>
            </LinearGradient>
          </View>
        )}

        {/* 🌟 قسم الصفحات المفضلة (من منطق الويب) */}
        <View style={{ marginTop: 30, marginBottom: 15, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: COLORS.primary }}>⭐ الوصول السريع</Text>
          <TouchableOpacity onPress={openFavModal}>
            <Text style={{ color: COLORS.accent, fontWeight: 'bold', fontSize: 14 }}>تخصيص</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 }}>
          {favItems.map((item, idx) => (
            <TouchableOpacity key={idx} style={styles.favCard} onPress={() => Alert.alert('قريباً', `سيتم الانتقال إلى ${item?.title}`)}>
              <View style={[styles.favIconBox, { backgroundColor: `${item?.color}15` }]}>
                <Ionicons name={item?.icon as any} size={28} color={item?.color} />
              </View>
              <Text style={styles.favTitle}>{item?.title}</Text>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity style={[styles.favCard, { borderStyle: 'dashed', borderColor: '#cbd5e1', borderWidth: 2, backgroundColor: 'transparent' }]} onPress={openFavModal}>
            <View style={[styles.favIconBox, { backgroundColor: '#f1f5f9' }]}>
              <Ionicons name="add" size={28} color="#94a3b8" />
            </View>
            <Text style={[styles.favTitle, { color: '#94a3b8' }]}>إضافة اختصار</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 🌟 نافذة التخصيص المنبثقة (Modal) */}
      <Modal visible={isFavModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تخصيص المفضلة</Text>
              <TouchableOpacity onPress={() => setIsFavModalOpen(false)}>
                <Ionicons name="close" size={28} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ padding: 20 }}>
              {AVAILABLE_PAGES.map((page, idx) => {
                const isSelected = tempFavorites.includes(page.id);
                return (
                  <TouchableOpacity 
                    key={idx} 
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => toggleFav(page.id)}
                  >
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 15 }}>
                      <Ionicons name={page.icon as any} size={24} color={isSelected ? COLORS.accent : COLORS.textLight} />
                      <Text style={[styles.modalItemText, isSelected && { color: COLORS.accent }]}>{page.title}</Text>
                    </View>
                    <Ionicons 
                      name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                      size={26} 
                      color={isSelected ? COLORS.accent : '#cbd5e1'} 
                    />
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.saveBtn} onPress={saveFavorites}>
                <Text style={styles.saveBtnText}>حفظ التغييرات</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// --- Styles المحدثة ---
const styles = StyleSheet.create({
  screenContainer: { 
    flex: 1, 
    backgroundColor: COLORS.background
  },
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
  statsGrid: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    gap: 12 
  },
  cardWrapper: {
    flex: 1,
    borderRadius: SIZES.radius,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6
  },
  statNumber: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: COLORS.primary 
  },
  statLabel: { 
    fontSize: 11, 
    color: COLORS.textLight, 
    marginTop: 4, 
    fontWeight: '900',
    textAlign: 'center'
  },
  welcomeTitle: { 
    fontWeight: '900', 
    color: COLORS.primary, 
  },
  welcomeText: { 
    lineHeight: 22,
    fontWeight: '600'
  },
  // تصميم قسم المفضلات الجديد
  favCard: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  favIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10
  },
  favTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center'
  },
  // تصميم الـ Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '70%',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
  },
  modalItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  modalItemSelected: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(202, 138, 4, 0.05)',
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});