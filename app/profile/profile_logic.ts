"use client";
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation'; // 🛡️ استدعاء التوجيه للحماية
import { parseDbError } from '@/lib/helpers'; // 🛡️ مترجم الأخطاء الذكي

export function useProfileLogic() {
    const queryClient = useQueryClient();
    const router = useRouter(); // 🛡️ لعمل الطرد التلقائي لو مفيش جلسة
    const searchParams = useSearchParams();
    const partnerId = searchParams ? searchParams.get('partner_id') : null;
    const isKpiOnly = searchParams ? searchParams.get('view') === 'kpi_only' : false;

    // 🎛️ 1. حالات الواجهة والفلاتر (UI States & Filters)
    const [activeTab, setActiveTab] = useState(isKpiOnly ? 'kpi' : 'tasks');
    const [searchFilters, setSearchFilters] = useState({
        term: '',
        site: 'all',
        category: 'all',
        startDate: '', 
        endDate: ''    
    });

    // 🧠 2. المحرك الأساسي: جلب البيانات الذكي المربوط (Joined Query)
    const { data, isLoading } = useQuery({
        queryKey: ['employeeProfileData', partnerId],
        queryFn: async () => {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            // 🛡️ حماية 1: طرد المستخدم لصفحة الدخول لو الجلسة منتهية أو غير موجودة
            if (sessionError || !session) {
                router.replace('/login');
                throw new Error('الجلسة منتهية، جاري تحويلك...');
            }

            let profile = null;
            let partner = null;
            let targetUserId = session.user.id; // الافتراضي هو المستخدم الحالي

            if (partnerId) {
                // المدير يريد عرض بروفايل شريك معين
                const { data: partnerData } = await supabase.from('partners').select('*').eq('id', partnerId).single();
                partner = partnerData;

                // محاولة البحث عن بروفايل مرتبط بهذا الشريك
                const { data: profileData } = await supabase.from('profiles').select('*').eq('linked_partner_id', partnerId).maybeSingle();
                
                if (profileData) {
                    profile = profileData;
                    targetUserId = profile.id; // لتحميل المهام والطلبات الخاصة به
                } else {
                    // إذا لم يكن للشريك حساب في النظام (عامل مثلاً)، ننشئ بروفايل افتراضي للعرض فقط
                    profile = {
                        id: partnerId,
                        linked_partner_id: partnerId,
                        nickname: partner?.name || 'مستخدم غير مسجل',
                        username: partner?.phone || '---',
                        avatar_url: partner?.identity_image_url || null
                    };
                }
            } else {
                // 🚀 الربط الذكي: جلب البروفايل ودمجه مع بيانات الشريك للمستخدم الحالي
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select(`
                        *,
                        partners (
                            id,
                            name,
                            phone,
                            job_role,
                            identity_image_url
                        )
                    `)
                    .eq('id', session.user.id)
                    .single();

                if (profileError) throw profileError;
                profile = profileData;
                partner = profile?.partners || null;
            }

            // 🚀 تجهيز البيانات للواجهة: سحب البيانات الأساسية من جدول الشركاء كأولوية
            const enhancedProfile = {
                ...profile,
                display_name: partner?.name || profile.nickname || 'موظف فاي تك',
                username: partner?.phone || profile.username || '---', // 📱 الجوال هو اليوزر نيم
                profession: partner?.job_role || partner?.role || 'موظف',               // 👔 المهنة
                avatar: profile.avatar_url || partner?.identity_image_url // 📸 الصورة
            };

            // جلب المهام والإشعارات والطلبات بالتوازي (Performance Boost)
            // إذا كان البروفايل وهمياً (ليس له حساب)، ستعود قوائم فارغة وهذا مطلوب
            const [tasksRes, notesRes, requestsRes] = await Promise.all([
                supabase.from('user_tasks').select('*').eq('user_id', targetUserId).order('created_at', { ascending: false }),
                supabase.from('notifications').select('*').eq('user_id', targetUserId).eq('is_read', false).order('created_at', { ascending: false }),
                supabase.from('user_requests').select('*').eq('user_id', targetUserId).order('created_at', { ascending: false })
            ]);

            let advData: Record<string, any>[] = [], dedData: Record<string, any>[] = [], logsData: Record<string, any>[] = [], payrollData = null;

            // جلب البيانات المالية لو الموظف مربوط بـ linked_partner_id
            const searchPartnerId = profile?.linked_partner_id || partnerId;
            if (searchPartnerId) {
                const [statementRes, payrollRes, logsRes] = await Promise.all([
                    // سحب كشف الحساب من الدفتر المجمع (نفس شكل شاشة الشركاء)
                    supabase.from('partner_statement_ledger').select('*').eq('partner_id', searchPartnerId).order('transaction_date', { ascending: false }).limit(500),
                    supabase.from('payroll_slips').select('net_salary').eq('emp_id', searchPartnerId).order('created_at', { ascending: false }).limit(1),
                    // سحب يوميات العامل
                    supabase.from('labor_daily_logs').select('*').eq('worker_name', partner?.name).order('work_date', { ascending: false })
                ]);
                
                advData = statementRes.data || []; // هنستخدم نفس المتغير ده عشان نبعت كشف الحساب كامل
                dedData = []; // مش هنحتاجه خلاص بس بنسيبه عشان التوافق
                logsData = logsRes.data || [];
                payrollData = payrollRes.data?.[0] || null;
            }

            return {
                profile: enhancedProfile, // 🚀 إرجاع البروفايل المدمج
                partnerData: partner,
                tasks: tasksRes.data || [],
                notifications: notesRes.data || [],
                userRequests: requestsRes.data || [],
                recentAdvances: advData,
                recentDeductions: dedData,
                recentLogs: logsData,
                netSalaryThisMonth: payrollData?.net_salary || 0
            };
        }
    });

    // 🛡️ تفريغ البيانات من الكاش بأمان (Bulletproof Fallbacks)
    const userProfile = data?.profile || null;
    const partnerData = data?.partnerData || null;
    const tasks = data?.tasks || [];
    const notifications = data?.notifications || [];
    const userRequests = data?.userRequests || [];
    const recentLogs = data?.recentLogs || [];
    const recentAdvances = data?.recentAdvances || [];
    const recentDeductions = data?.recentDeductions || [];

    // 💰 حساب الإجماليات المالية
    const financials = useMemo(() => ({
        totalAdvances: recentAdvances.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
        totalDeductions: recentDeductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
        netSalaryThisMonth: data?.netSalaryThisMonth || 0
    }), [recentAdvances, recentDeductions, data?.netSalaryThisMonth]);

    // 📅 3. لوجيك الفلترة المتقدمة (تعمل على الـ Cache بسرعة البرق)
    const filteredData = useMemo(() => {
        const start = searchFilters.startDate ? new Date(searchFilters.startDate) : null;
        const end = searchFilters.endDate ? new Date(searchFilters.endDate) : null;

        const checkDate = (dateStr: string) => {
            if (!dateStr) return true;
            const d = new Date(dateStr);
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        };

        const logs = recentLogs.filter(log => 
            checkDate(log.work_date || log.Date) &&
            (searchFilters.site === 'all' || (log.site_ref || log.Site) === searchFilters.site) &&
            (log.site_ref || log.Site || log.work_item || '').toLowerCase().includes(searchFilters.term.toLowerCase())
        );

        const advances = recentAdvances.filter(a => checkDate(a.date || a.created_at));
        const deductions = recentDeductions.filter(d => checkDate(d.date || d.created_at));

        return { logs, advances, deductions };
    }, [recentLogs, recentAdvances, recentDeductions, searchFilters]);

    // 📈 4. حسابات الـ KPIs (خلاصة الفترة المحددة)
    const rangeKPIs = useMemo(() => {
        const totalWages = filteredData.logs.reduce((sum, l) => sum + (Number(l.daily_wage || l.D_W) || 0), 0);
        const totalDeds = filteredData.deductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        const totalAdvs = filteredData.advances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
        const workDays = filteredData.logs.filter(l => l.attendance_value === '1' || l.Att === '1').length;

        return {
            workDays,
            totalWages,
            totalDeductions: totalDeds + totalAdvs,
            netBalance: totalWages - (totalDeds + totalAdvs)
        };
    }, [filteredData]);

    const monthlyKPIs = useMemo(() => {
        const now = new Date();
        
        // 1. حساب نسبة الحضور (حتى آخر شهر عمل فيه، مع تجاهل التواريخ الخاطئة والقديمة جداً مثل 1970)
        let attendanceRate = 0;
        let expectedDays = 0;
        let daysWorked = 0;
        
        // تجميع الحضور بالشهور فقط
        const monthlyAttendance: Record<string, { daysWorked: number, expectedDays: number, percentage: number, isAccumulated: boolean }> = {};
        
        recentLogs.forEach(log => {
            const dateStr = log.work_date || log.Date;
            // إذا لم يكن هناك تاريخ صالح، نفترض أنه قيد افتتاحي/تجميعي
            let date = new Date(dateStr);
            let monthName = "";
            let isAccumulated = false;

            if (!dateStr || isNaN(date.getTime()) || date.getFullYear() < 2020) {
                monthName = "أرصدة وفترات سابقة";
                isAccumulated = true;
            } else {
                monthName = date.toLocaleString('ar-EG', { month: 'long', year: 'numeric' });
            }

            if (!monthlyAttendance[monthName]) {
                monthlyAttendance[monthName] = { daysWorked: 0, expectedDays: 26, percentage: 0, isAccumulated };
            }
            monthlyAttendance[monthName].daysWorked += (Number(log.attendance_value) || 1);
            daysWorked += (Number(log.attendance_value) || 1);
        });

        // تصحيح الأيام المتوقعة للقيود التجميعية (إذا تجاوزت 26 يوم)
        for (const [month, data] of Object.entries(monthlyAttendance)) {
            if (data.daysWorked > 26) {
                // حساب كم شهر يمثل هذا الرقم التجميعي (مثلا 43 يوم = شهرين متوقعين)
                const monthsCount = Math.ceil(data.daysWorked / 26);
                data.expectedDays = monthsCount * 26;
            }
            expectedDays += data.expectedDays;
        }

        if (expectedDays > 0) {
            attendanceRate = Math.min(100, Math.round((daysWorked / expectedDays) * 100));
        }

        const attendanceBreakdown = Object.entries(monthlyAttendance).map(([month, data]) => ({
            month,
            ...data,
            percentage: Math.min(100, Math.round((data.daysWorked / data.expectedDays) * 100))
        }));

        // 2. حساب الإنتاجية مفصلة حسب البند (مع مراعاة التريحة)
        const techLogs = recentLogs.filter(l => l.skill_level !== 'عامل');
        const itemPerformance: Record<string, { totalProd: number, totalTareeha: number, logsCount: number }> = {};
        
        techLogs.forEach(log => {
            const tareeha = Number(log.tareeha) || 0;
            const prod = Number(log.daily_production || log.productivity || log.Prod) || 0;
            
            // نأخذ فقط السجلات التي لها تريحة محددة في الموازنة لحساب التقييم بدقة
            if (tareeha > 0) {
                const item = (log.work_item || log.Item || 'أخرى').trim();
                if (!itemPerformance[item]) itemPerformance[item] = { totalProd: 0, totalTareeha: 0, logsCount: 0 };
                
                itemPerformance[item].totalProd += prod;
                itemPerformance[item].totalTareeha += tareeha;
                itemPerformance[item].logsCount += 1;
            }
        });

        let totalPercentageSum = 0;
        let validItemsCount = 0;
        const itemBreakdown = [];

        for (const [item, data] of Object.entries(itemPerformance)) {
            if (data.totalTareeha > 0) {
                const itemPercent = Math.round((data.totalProd / data.totalTareeha) * 100);
                totalPercentageSum += itemPercent;
                validItemsCount++;
                itemBreakdown.push({ item, ...data, percentage: itemPercent });
            }
        }

        const performanceRate = validItemsCount > 0 ? Math.round(totalPercentageSum / validItemsCount) : (techLogs.length > 0 ? 100 : 0);
        
        // المتغيرات القديمة للتوافق
        const totalProduction = techLogs.reduce((sum, l) => sum + (Number(l.daily_production || l.productivity || l.Prod) || 0), 0);
        const totalEarnings = recentLogs.reduce((sum, l) => sum + (Number(l.daily_wage || l.D_W) || 0), 0);
        
        return { 
            daysWorked, 
            attendanceRate, 
            totalProduction, 
            performanceRate, 
            totalEarnings, 
            itemBreakdown,
            attendanceBreakdown,
            expectedDays,
            monthName: now.toLocaleString('ar-EG', { month: 'long' }) 
        };
    }, [recentLogs]);

    const taskGroups = useMemo(() => {
        return {
            completed: tasks.filter(t => t.status === 'completed'),
            pending: tasks.filter(t => t.status !== 'completed')
        };
    }, [tasks]);

    // 📡 5. الاشتراك اللحظي (Supabase Realtime)
    useEffect(() => {
        if (!userProfile?.id) return;
        const channel = supabase.channel('profile-realtime-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_tasks', filter: `user_id=eq.${userProfile.id}` }, () => {
                queryClient.invalidateQueries({ queryKey: ['employeeProfileData'] });
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userProfile.id}` }, () => {
                toast.success('لديك إشعار جديد 🔔');
                queryClient.invalidateQueries({ queryKey: ['employeeProfileData'] });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [queryClient, userProfile?.id]);

    // 🚀 6. عمليات الإرسال الذكية (Mutations) مدعومة بـ parseDbError للحماية
    const invalidateAndRefresh = () => queryClient.invalidateQueries({ queryKey: ['employeeProfileData'] });

    const requestMutation = useMutation({
        mutationFn: async (reqData: any) => {
            const { error } = await supabase.from('user_requests').insert({ user_id: userProfile?.id, ...reqData });
            if (error) throw error;
        },
        onSuccess: () => { toast.success('تم رفع الطلب للإدارة بنجاح 🚀'); invalidateAndRefresh(); },
        onError: (error) => toast.error(parseDbError(error)) // 🛡️ استخدام المترجم
    });

    const taskMutation = useMutation({
        mutationFn: async ({ taskId, status, note }: any) => {
            const { error } = await supabase.from('user_tasks').update({ status, completion_note: note || null, updated_at: new Date() }).eq('id', taskId);
            if (error) throw error;
        },
        onSuccess: (_, variables) => { 
            if (variables.status === 'completed') toast.success('تم إنجاز المهمة، عاش يا بطل! ✅');
            else toast.success('تم إرسال تقرير عدم الإنجاز ⚠️');
            invalidateAndRefresh(); 
        },
        onError: (error) => toast.error(parseDbError(error)) // 🛡️ استخدام المترجم
    });

    const profileMutation = useMutation({
        mutationFn: async (data: any) => {
            const { error } = await supabase.from('profiles').update(data).eq('id', userProfile?.id);
            if (error) throw error;
        },
        onSuccess: () => { toast.success('تم حفظ بيانات البروفايل 💾'); invalidateAndRefresh(); },
        onError: (error) => toast.error(parseDbError(error)) // 🛡️ استخدام المترجم
    });

    const notificationMutation = useMutation({
        mutationFn: async () => await supabase.from('notifications').update({ is_read: true }).eq('user_id', userProfile?.id),
        onSuccess: invalidateAndRefresh,
        onError: (error) => toast.error(parseDbError(error)) // 🛡️ استخدام المترجم
    });

    // 🔄 تصدير الدوال
    const createRequest = async (data: any) => requestMutation.mutateAsync(data);
    const submitTaskUpdate = async (taskId: string, status: string, note?: string) => taskMutation.mutateAsync({ taskId, status, note });
    const updateProfileInfo = async (data: any) => profileMutation.mutateAsync(data);
    const markAllNotificationsAsRead = async () => notificationMutation.mutateAsync();
    const refreshProfile = () => { toast.success('تم تحديث البيانات 🔄'); invalidateAndRefresh(); };
    const updatePassword = async (password: string) => {
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!user || user.id !== userProfile?.id) throw new Error('يمكنك تغيير كلمة مرور حسابك فقط من الملف الشخصي.');
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            toast.success('تم تحديث كلمة المرور.');
            return true;
        } catch (error) { toast.error(parseDbError(error)); return false; }
    };

    // דالة رفع الصورة الشخصية
    const uploadAvatar = async (file: File) => {
        if (!userProfile?.id) return;
        const toastId = toast.loading('جاري رفع الصورة... ⏳');
        try {
            const fileName = `${userProfile.id}-${Date.now()}`;
            const { error } = await supabase.storage.from('avatars').upload(fileName, file);
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            await profileMutation.mutateAsync({ avatar_url: publicUrl });
            toast.success('تم تحديث الصورة الشخصية 📸', { id: toastId });
        } catch (error) { 
            toast.error(parseDbError(error), { id: toastId }); // 🛡️ استخدام المترجم
            console.error(error); 
        } 
    };

    const isSaving = requestMutation.isPending || taskMutation.isPending || profileMutation.isPending || notificationMutation.isPending;

    // 📦 إرجاع كل البيانات كما كانت تماماً لضمان عدم تلف صفحة UI
    return {
        isLoading, isSaving, userProfile, partnerData, financials,
        recentLogs, recentAdvances, recentDeductions, filteredLogs: filteredData.logs,
        tasks, notifications, activeTab, searchFilters,
        filteredData, rangeKPIs, taskGroups, monthlyKPIs, userRequests,
        setSearchFilters, setActiveTab, refreshProfile,
        updateProfileInfo, uploadAvatar, markAllNotificationsAsRead,
        submitTaskUpdate, createRequest, updatePassword, isKpiOnly
    };
}
