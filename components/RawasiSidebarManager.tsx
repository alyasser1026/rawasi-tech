"use client";
import React, { useEffect, useRef } from 'react';
import { useSidebar } from '@/lib/SidebarContext';

interface SidebarProps {
    summary?: React.ReactNode;
    actions?: React.ReactNode;
    customFilters?: React.ReactNode; 
    onSearch?: (term: string) => void;
    placeholder?: string;
    onDateFilter?: (start: string, end: string) => void;
    watchDeps?: any[]; 
}

export default function RawasiSidebarManager({ 
    summary, 
    actions, 
    customFilters, 
    onSearch, 
    placeholder,
    onDateFilter, 
    watchDeps = [] 
}: SidebarProps) {
    const { setSidebarContent } = useSidebar();

    const prevDeps = useRef<any[]>(watchDeps);
    const trigger = useRef(0);

    const isChanged = watchDeps.length !== prevDeps.current.length || 
                      watchDeps.some((dep, i) => dep !== prevDeps.current[i]);

    if (isChanged) {
        trigger.current += 1;
        prevDeps.current = watchDeps;
    }

    useEffect(() => {
        setSidebarContent({ summary, actions, customFilters, searchPlaceholder: placeholder, enableSearch: Boolean(onSearch), enableDates: Boolean(onDateFilter) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger.current, setSidebarContent, placeholder]);

    useEffect(() => {
        return () => {
            setSidebarContent({ actions: null, summary: null, customFilters: null });
        };
    }, [setSidebarContent]);

    useEffect(() => {
        const hSearch = (e: any) => onSearch?.(e.detail);
        const hDate = (e: any) => onDateFilter?.(e.detail.start, e.detail.end);

        window.addEventListener('globalSearch', hSearch);
        window.addEventListener('globalDateFilter', hDate);

        return () => {
            window.removeEventListener('globalSearch', hSearch);
            window.removeEventListener('globalDateFilter', hDate);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onSearch, onDateFilter]);

    return null; 
}
