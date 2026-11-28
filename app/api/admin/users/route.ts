import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeAdminRequest } from '@/lib/admin-authorization';

// تهيئة عميل Supabase بصلاحيات الإدارة (Service Role)
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// دالة مساعدة لتحويل رقم الجوال لصيغة E.164 العالمية المقبولة في Supabase Auth
function toE164(phone: string | null | undefined): string | null {
    if (!phone) return null;
    let digits = String(phone).replace(/[\s\-().]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    if (!/^\d+$/.test(digits)) return null;
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) {
        // مصر: 010, 011, 012, 015
        if (/^01[0125]\d{8}$/.test(digits)) {
            digits = '20' + digits.slice(1);
        } else if (/^05\d{8}$/.test(digits)) {
            // السعودية: 05...
            digits = '966' + digits.slice(1);
        } else {
            digits = '20' + digits.slice(1);
        }
    }
    return /^[1-9]\d{9,14}$/.test(digits) ? `+${digits}` : null;
}

interface CompanyAssignmentInput {
    company_id: string;
    role: 'admin' | 'member';
    is_default: boolean;
}

async function syncUserCompanyAssignments(
    supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
    userId: string,
    assignments: unknown
) {
    if (!Array.isArray(assignments)) return;

    const deduped = new Map<string, CompanyAssignmentInput>();
    for (const raw of assignments) {
        const companyId = typeof (raw as any)?.company_id === 'string' ? (raw as any).company_id.trim() : '';
        if (!companyId || deduped.has(companyId)) continue;
        deduped.set(companyId, {
            company_id: companyId,
            role: (raw as any)?.role === 'admin' ? 'admin' : 'member',
            is_default: Boolean((raw as any)?.is_default),
        });
    }

    const valid = Array.from(deduped.values());
    if (valid.length > 0) {
        const firstDefaultIdx = valid.findIndex((item) => item.is_default);
        const defaultIdx = firstDefaultIdx >= 0 ? firstDefaultIdx : 0;
        valid.forEach((item, idx) => {
            item.is_default = idx === defaultIdx;
        });
    }

    const { error: deleteErr } = await supabaseAdmin
        .from('user_companies')
        .delete()
        .eq('user_id', userId);
    if (deleteErr) {
        throw new Error(`تعذر تحديث ربط الشركات: ${deleteErr.message}`);
    }

    if (valid.length > 0) {
        const rows = valid.map((item) => ({
            user_id: userId,
            company_id: item.company_id,
            role: item.role,
            is_active: true,
            is_default: item.is_default,
        }));
        const { error: insertErr } = await supabaseAdmin.from('user_companies').insert(rows);
        if (insertErr) {
            throw new Error(`تعذر حفظ الشركات المرتبطة: ${insertErr.message}`);
        }
    }
}

// 0. جلب قائمة الشركات النشطة وعضويات المستخدمين (GET)
export async function GET(req: Request) {
    try {
        const access = await authorizeAdminRequest(req, getSupabaseAdmin);
        if (access.error) return access.error;
        const supabaseAdmin = access.client;

        const [companiesRes, membershipsRes] = await Promise.all([
            supabaseAdmin
                .from('companies')
                .select('id, code, name, currency, is_default, is_active')
                .eq('is_active', true)
                .order('is_default', { ascending: false })
                .order('name'),
            supabaseAdmin
                .from('user_companies')
                .select('user_id, company_id, role, is_default, is_active')
                .eq('is_active', true),
        ]);

        if (companiesRes.error) {
            return NextResponse.json({ error: companiesRes.error.message }, { status: 400 });
        }
        if (membershipsRes.error) {
            return NextResponse.json({ error: membershipsRes.error.message }, { status: 400 });
        }

        return NextResponse.json({
            companies: companiesRes.data || [],
            memberships: membershipsRes.data || [],
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'حدث خطأ غير متوقع' }, { status: 500 });
    }
}

// 1. إضافة مستخدم جديد (POST)
export async function POST(req: Request) {
    try {
        const access = await authorizeAdminRequest(req, getSupabaseAdmin);
        if (access.error) return access.error;
        const supabaseAdmin = access.client;
        const body = await req.json();
        const { email, password, phone, full_name, role, linked_partner_id, permissions, is_active, company_assignments } = body;

        // 1️⃣ إنشاء الحساب في المصادقة (Auth)
        const e164 = toE164(phone);
        const createParams: any = {
            email,
            password,
            email_confirm: true,
        };
        if (e164) {
            createParams.phone = e164;
            createParams.phone_confirm = true;
        }

        let { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser(createParams);

        // إذا فشل بسبب تنسيق الهاتف في Auth، نعيد المحاولة بدون تمرير الهاتف لـ Auth مع الاحتفاظ به في البروفايل
        if (authError && authError.message?.toLowerCase().includes('phone')) {
            console.warn('Retrying user creation without Auth phone:', authError.message);
            delete createParams.phone;
            delete createParams.phone_confirm;
            const retry = await supabaseAdmin.auth.admin.createUser(createParams);
            authData = retry.data;
            authError = retry.error;
        }

        if (authError || !authData?.user) {
            return NextResponse.json({ error: authError?.message || 'تعذر إنشاء المستخدم' }, { status: 400 });
        }

        const userId = authData.user.id;

        // 2️⃣ الانتظار ثانية واحدة للتأكد من أن الـ Trigger أنشأ الـ Profile
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 3️⃣ تحديث بيانات الـ Profile
        const isAdminFlag = role === 'super_admin' || role === 'admin';
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                full_name,
                email, // مزامنة الإيميل
                phone_number: phone || null, // مزامنة الجوال كما كتبه المستخدم
                role,
                linked_partner_id: linked_partner_id || null,
                permissions,
                is_admin: isAdminFlag,
                is_active: is_active ?? true
            })
            .eq('id', userId);

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 400 });
        }

        await syncUserCompanyAssignments(supabaseAdmin, userId, company_assignments);

        return NextResponse.json({ success: true, message: 'تم إنشاء المستخدم بنجاح', userId });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'حدث خطأ غير متوقع' }, { status: 500 });
    }
}

// 2. تعديل مستخدم حالي (PUT)
export async function PUT(req: Request) {
    try {
        const access = await authorizeAdminRequest(req, getSupabaseAdmin);
        if (access.error) return access.error;
        const supabaseAdmin = access.client;
        const body = await req.json();
        const { userId, email, password, phone, full_name, role, linked_partner_id, permissions, is_active, company_assignments } = body;

        if (!userId) return NextResponse.json({ error: 'معرف المستخدم مفقود' }, { status: 400 });

        // 1️⃣ تحديث بيانات المصادقة (Auth)
        const updateParams: any = {};
        if (email) updateParams.email = email;
        if (password) updateParams.password = password;
        if (phone !== undefined) {
            const e164 = toE164(phone);
            if (e164) {
                updateParams.phone = e164;
            }
        }
        
        // إيقاف أو تشغيل الحساب على مستوى Auth نفسه لزيادة الأمان
        if (is_active === false) {
            updateParams.ban_duration = '876000h'; // حظر لـ 100 سنة
        } else if (is_active === true) {
            updateParams.ban_duration = 'none'; // رفع الحظر
        }

        if (Object.keys(updateParams).length > 0) {
            let { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, updateParams);
            if (authError && authError.message?.toLowerCase().includes('phone')) {
                // إذا كان الخطأ بسبب صيغة الهاتف في Auth، نزيل الهاتف من بارامترات Auth ونعيد التحديث
                console.warn('Retrying updateUserById without Auth phone:', authError.message);
                delete updateParams.phone;
                if (Object.keys(updateParams).length > 0) {
                    const retry = await supabaseAdmin.auth.admin.updateUserById(userId, updateParams);
                    authError = retry.error;
                } else {
                    authError = null;
                }
            }
            if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        // 2️⃣ تحديث الـ Profile
        const isAdminFlag = role === 'super_admin' || role === 'admin';
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                full_name,
                ...(email && { email }), // تحديث الإيميل إذا تغير
                ...(phone !== undefined && { phone_number: phone || null }), // تحديث الجوال
                role,
                linked_partner_id: linked_partner_id || null,
                permissions,
                is_admin: isAdminFlag,
                is_active
            })
            .eq('id', userId);

        if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

        await syncUserCompanyAssignments(supabaseAdmin, userId, company_assignments);

        return NextResponse.json({ success: true, message: 'تم تحديث بيانات المستخدم بنجاح' });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'حدث خطأ غير متوقع' }, { status: 500 });
    }
}

// 3. التحكم الجماعي: إيقاف أو تشغيل كل المستخدمين (PATCH)
export async function PATCH(req: Request) {
    try {
        const access = await authorizeAdminRequest(req, getSupabaseAdmin);
        if (access.error) return access.error;
        const supabaseAdmin = access.client;
        const body = await req.json();
        const { action } = body; // 'suspend_all' أو 'activate_all'

        if (!['suspend_all', 'activate_all'].includes(action)) return NextResponse.json({ error: 'الإجراء غير صحيح' }, { status: 400 });

        const isActivating = action === 'activate_all';
        const banDuration = isActivating ? 'none' : '876000h';

        // 1️⃣ جلب جميع المستخدمين باستثناء السوبر أدمن
        const { data: users, error: fetchError } = await supabaseAdmin
            .from('profiles')
            .select('id, role')
            .neq('role', 'super_admin'); // لا تقم بحظر السوبر أدمن أبداً!

        if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });

        // 2️⃣ تطبيق التغييرات على Auth و Profiles
        const updatePromises = users.map(async (u) => {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(u.id, { ban_duration: banDuration });
            if (authError) throw authError;
            const { error: profileError } = await supabaseAdmin.from('profiles').update({ is_active: isActivating }).eq('id', u.id);
            if (profileError) throw profileError;
        });

        await Promise.all(updatePromises);

        return NextResponse.json({ success: true, message: `تم ${isActivating ? 'تشغيل' : 'إيقاف'} جميع الموظفين بنجاح` });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'حدث خطأ غير متوقع' }, { status: 500 });
    }
}
