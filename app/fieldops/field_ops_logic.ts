"use client";
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useFieldOpsLogic() {
    const today = new Date().toISOString().split('T')[0];

    // 📥 سحب البيانات الجاهزة من الـ View الذكي (طلقة واحدة للداتابيز)
    const { data: radarData = [], isLoading: isRadarLoading } = useQuery({
        queryKey: ['field_live_radar', today],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('field_live_radar')
                .select('*');
            
            if (error) throw error;
            return data || [];
        },
        refetchInterval: 30000, 
        refetchOnWindowFocus: true
    });

    // 📍 سحب بيانات المواقع الجغرافية للمشاريع
    const { data: projectsLocation = [] } = useQuery({
        queryKey: ['projects_location_data'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('projects')
                .select('id, location_address, location_url');
            if (error) return [];
            return data || [];
        },
        staleTime: 5 * 60 * 1000
    });

    // 📸 سحب أحدث الزيارات الميدانية وملاحظات الجودة للمشاريع
    const { data: siteVisits = [] } = useQuery({
        queryKey: ['field_site_visits_recent'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('project_site_visits')
                .select('id, project_id, title, status, inspector_name, visit_date, notes, photo_before_url, photo_after_url, geo_lat, geo_lng, geo_location_name')
                .order('visit_date', { ascending: false })
                .limit(50);
            if (error) return [];
            return data || [];
        },
        staleTime: 2 * 60 * 1000
    });

    // 🗺️ دمج إحداثيات ومواقع المشاريع مع بيانات الرادار
    const projectStats = useMemo(() => {
        const locationMap = new Map(projectsLocation.map(p => [p.id, p]));

        return radarData.map(row => {
            const loc = locationMap.get(row.project_id);
            return {
                id: row.project_id,
                Property: row.site_name,
                status: row.status,
                estimated_budget: Number(row.estimated_budget || 0),
                client: { name: row.client_name },
                todayWorkers: Number(row.today_workers_count || 0),
                todayLaborCost: Number(row.today_labor_cost || 0),
                todayExpenses: Number(row.today_expenses_cost || 0),
                totalTodayCost: Number(row.today_labor_cost || 0) + Number(row.today_expenses_cost || 0),
                activeTasks: row.active_tasks ? row.active_tasks.split(', ') : [],
                location_address: loc?.location_address || '',
                location_url: loc?.location_url || '',
                geofence_radius: 200 // default 200m
            };
        });
    }, [radarData, projectsLocation]);

    // 📊 حساب إجماليات الشركة (النبض العام)
    const companyTotals = useMemo(() => {
        return {
            totalWorkers: projectStats.reduce((sum, p) => sum + p.todayWorkers, 0),
            totalCost: projectStats.reduce((sum, p) => sum + p.totalTodayCost, 0)
        };
    }, [projectStats]);

    return {
        projectStats,
        siteVisits,
        companyTotals,
        isLoading: isRadarLoading,
        today
    };
}
