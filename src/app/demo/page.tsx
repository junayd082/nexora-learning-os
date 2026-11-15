import type { Metadata } from 'next';
import '../keynote/keynote.css';
import './demo.css';
import { LiveDemo } from './LiveDemo';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: `${brand.productName} Live — a class period, start to finish`,
  description: `A narrated live demonstration of ${brand.productName}: one AutoCAD lesson from the teacher's side, with demo students.`,
};

export default function DemoPage() {
  return <LiveDemo />;
}
