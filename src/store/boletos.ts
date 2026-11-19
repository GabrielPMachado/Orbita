import { createCollection, type Item } from './collection';
import type { DateKey } from '@/lib/date';

export type BoletoOrigem = 'manual' | 'colar' | 'foto' | 'pdf' | 'estacio';
export interface Boleto extends Item {
  descricao: string;
  /** nosso número / nº da cobrança na origem (Estácio): evita duplicar */
  ref?: string;
  competencia?: string;
  valor?: number;
  vencimento?: DateKey;
  /** linha digitável formatada */
  linha?: string;
  barras?: string;
  /** Pix copia e cola, quando o boleto tem */
  pix?: string;
  banco?: string;
  beneficiario?: string;
  origem: BoletoOrigem;
  /** PDF guardado (nome em lib/media) */
  arquivo?: string;
  pago?: boolean;
  pagoEm?: DateKey;
  /** lançamento criado nas Finanças ao pagar */
  txId?: string;
  /** notificações agendadas (véspera e dia) */
  avisos?: string[];
}
export const useBoletos = createCollection<Boleto>('boletos');
