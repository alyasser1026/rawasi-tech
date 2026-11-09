import type { Metadata } from 'next';
import PhiSite from './site/PhiSite';

export const metadata: Metadata = {
  title: 'فاي تك | مقاولات عامة وتشطيبات فاخرة',
  description:
    'فاي تك للمقاولات العامة والتشطيبات الفاخرة: إنشاءات وعظم، تشطيبات معمارية، وكهروميكانيك وتكييف مخفي بإشراف هندسي متكامل.',
};

export default function HomePage() {
  return <PhiSite />;
}
