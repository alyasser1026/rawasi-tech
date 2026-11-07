"use client";
import React from 'react';
import MasterPage from '@/components/MasterPage';
import BotSettingsManager from '../BotSettingsManager';

export default function BotSettingsPage() {
  return (
    <MasterPage title="إعدادات المساعد الذكي (بوت التليجرام)" hideTitleOnMobile={true}>
      <BotSettingsManager />
    </MasterPage>
  );
}
