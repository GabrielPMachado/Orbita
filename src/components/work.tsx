import { View } from 'react-native';
import { brl, fromKey, today } from '@/lib/date';
import { invoiceTotal, type Client, type Invoice } from '@/store/modules';
import { T } from './ui';

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '33', alignItems: 'center', justifyContent: 'center' }}>
      <T v="headline" color={color} style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {initials(name)}
      </T>
    </View>
  );
}

export const whatsappNumber = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return d.length <= 11 ? '55' + d : d;
};

export type InvoiceView = 'rascunho' | 'enviada' | 'atrasada' | 'paga';
export const STATUS_LABEL: Record<InvoiceView, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: '#94A3B8' },
  enviada: { label: 'Enviada', color: '#5B9DFF' },
  atrasada: { label: 'Atrasada', color: '#F26464' },
  paga: { label: 'Paga', color: '#34C77B' },
};

export function statusOf(i: Invoice): InvoiceView {
  if (i.status === 'paga') return 'paga';
  if (i.status === 'enviada' && i.dueDate < today()) return 'atrasada';
  return i.status;
}

const br = (k: string) => fromKey(k).toLocaleDateString('pt-BR');

/** Mensagem de cobrança formatada para o WhatsApp (*negrito*, _itálico_). */
export function invoiceMessage(i: Invoice, client?: Client) {
  const lines = [
    `Olá${client ? `, ${client.name.split(' ')[0]}` : ''}! Segue a cobrança *#${i.number} · ${i.title}*:`,
    '',
    ...i.items.map((it) => `• ${it.description}${it.qty !== 1 ? ` (${it.qty}×${brl(it.price)})` : ''}: ${brl(it.qty * it.price)}`),
    '',
    `*Total: ${brl(invoiceTotal(i))}*`,
    `Vencimento: ${br(i.dueDate)}`,
  ];
  if (i.notes) lines.push('', `_${i.notes}_`);
  lines.push('', 'Qualquer dúvida, é só chamar.');
  return lines.join('\n');
}
