'use client';

import React from 'react';
import MasterPage from '@/components/MasterPage';
import RequestsHandoversView from './RequestsHandoversView';

export default function RequestsHandoversPage() {
  return (
    <MasterPage
      title="الركوستات ومحاضر التسليمات الهندسية للمشاريع 📋"
      subtitle="منظومة متكاملة لإدارة طلبات فحص واستلام الأعمال والخامات والصب (WIR / MIR / CPR / IR / MEP) ومحاضر التسليم الابتدائي والنهائي المربوطة مباشرة بالمشاريع وبنود المقايسة وأوامر الشغل"
    >
      <RequestsHandoversView />
    </MasterPage>
  );
}
