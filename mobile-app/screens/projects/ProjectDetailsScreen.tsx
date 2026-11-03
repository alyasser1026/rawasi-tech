import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProjectsLogic } from './projects_logic';

// Tabs
import OverviewTab from './OverviewTab';
import BoqTab from './BoqTab';
import ExpensesTab from './ExpensesTab';
import MaterialsTab from './MaterialsTab';
import FinancialsTab from './FinancialsTab';
import QcTab from './QcTab';

export default function ProjectDetailsScreen({ route, navigation }: any) {
  const { projectId } = route.params;
  const insets = useSafeAreaInsets();
  const logic = useProjectsLogic();

  useEffect(() => {
    if (projectId) {
      logic.loadProjectDetails(projectId);
    }
  }, [projectId]);

  if (logic.isDetailsLoading || !logic.selectedProject) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>جاري تحميل تفاصيل المشروع...</Text>
      </View>
    );
  }

  const { selectedProject, activeTab, setActiveTab } = logic;
  const statusColors = logic.getStatusColor(selectedProject.status);

  const renderTabButton = (tabKey: string, title: string, icon: any) => (
    <TouchableOpacity 
      style={[styles.tabButton, activeTab === tabKey && styles.activeTabButton]} 
      onPress={() => setActiveTab(tabKey)}
    >
      <Ionicons name={icon} size={18} color={activeTab === tabKey ? '#c2410c' : '#475569'} />
      <Text style={[styles.tabText, activeTab === tabKey && styles.activeTabText]}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screenContainer}>
      {/* Header */}
      <LinearGradient 
        colors={['#f8fafc', 'rgba(248, 250, 252, 0.95)', 'rgba(248, 250, 252, 0)']} 
        style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>{selectedProject.status || 'غير محدد'}</Text>
          </View>
        </View>
        
        <Text style={styles.projectTitle}>🏢 {selectedProject.Property}</Text>
        {selectedProject.unit_type && (
          <Text style={styles.projectSubtitle}>{selectedProject.unit_type}</Text>
        )}
        
        <View style={styles.engineerRow}>
          {selectedProject.engineer_in_charge && (
            <Text style={styles.engineerText}>👨‍🔧 {selectedProject.engineer_in_charge}</Text>
          )}
          {selectedProject.engineer_phone && (
            <Text style={styles.engineerText}>📱 {selectedProject.engineer_phone}</Text>
          )}
        </View>
      </LinearGradient>

      {/* Tabs Menu */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll} keyboardShouldPersistTaps="handled">
          {renderTabButton('overview', 'النظرة العامة', 'pie-chart-outline')}
          {renderTabButton('boq', 'المقايسات', 'list-outline')}
          {renderTabButton('expenses', 'المصروفات', 'cash-outline')}
          {renderTabButton('materials', 'الخامات', 'cube-outline')}
          {renderTabButton('financials', 'الماليات', 'wallet-outline')}
          {renderTabButton('qc', 'الجودة', 'camera-outline')}
        </ScrollView>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContentContainer}>
        {activeTab === 'overview' && <OverviewTab logic={logic} />}
        {activeTab === 'boq' && <BoqTab logic={logic} />}
        {activeTab === 'expenses' && <ExpensesTab logic={logic} />}
        {activeTab === 'materials' && <MaterialsTab logic={logic} />}
        {activeTab === 'financials' && <FinancialsTab logic={logic} />}
        {activeTab === 'qc' && <QcTab logic={logic} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: '#f8fafc' }, // Light Background
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 10, fontSize: 16, fontWeight: '800', color: '#475569' },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: 20,
    // Remove border radius and shadows to achieve borderless fade
  },
  headerTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(202, 138, 4, 0.1)' }, // Light gold bg
  statusText: { fontSize: 12, fontWeight: '800', color: '#c2410c' },
  projectTitle: { fontSize: 28, fontWeight: '900', color: '#1e293b', textAlign: 'right', marginBottom: 4 }, // Dark Slate
  projectSubtitle: { fontSize: 16, fontWeight: '800', color: '#c2410c', textAlign: 'right' },
  engineerRow: { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 15, gap: 15 },
  engineerText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  tabsContainer: { paddingVertical: 10 },
  tabsScroll: { paddingHorizontal: SIZES.padding, flexDirection: 'row-reverse', gap: 12 },
  tabButton: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 20, 
    backgroundColor: 'transparent', 
    gap: 6 
  },
  activeTabButton: { 
    backgroundColor: 'rgba(202, 138, 4, 0.1)', 
  },
  tabText: { fontSize: 15, fontWeight: '800', color: '#475569' },
  activeTabText: { color: '#c2410c' },
  tabContentContainer: { flex: 1 }
});
