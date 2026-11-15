import type { Metadata } from 'next';
import './keynote.css';
import { Keynote } from './Keynote';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: `${brand.productName} — Keynote`,
  description: `Introducing ${brand.productName}, ${brand.positioning}.`,
};

export default function KeynotePage() {
  return <Keynote />;
}
