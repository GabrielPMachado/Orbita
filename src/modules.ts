import {
  Barcode,
  BellRing,
  Briefcase,
  CalendarCheck,
  ChartLine,
  Columns3,
  Dumbbell,
  Film,
  FolderOpen,
  Gauge,
  GraduationCap,
  HeartPulse,
  Library,
  Newspaper,
  ReceiptText,
  Repeat2,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';

export type Section = 'Núcleo' | 'Vida' | 'Trabalho' | 'Insights';

export interface ModuleDef {
  id: string;
  name: string;
  section: Section;
  icon: LucideIcon;
  /** true = já tem tela própria */
  ready: boolean;
  /** rota da tela (padrão: /<id>) */
  href?: string;
  description: string;
}

/**
 * Registro central dos módulos. Para criar um módulo novo:
 *  1. crie a tela em src/app/<id>.tsx
 *  2. mude `ready` para true aqui
 */
export const MODULES: ModuleDef[] = [
  { id: 'kanban', name: 'Kanban', section: 'Núcleo', icon: Columns3, ready: true, href: '/tarefas', description: 'Tarefas em colunas: a fazer, fazendo, feito.' },
  { id: 'trabalho', name: 'Trabalho', section: 'Núcleo', icon: Briefcase, ready: true, description: 'Projetos e subprojetos com tarefas agrupadas.' },
  { id: 'lembretes', name: 'Lembretes', section: 'Núcleo', icon: BellRing, ready: true, description: 'Notificações no horário certo, únicas ou recorrentes.' },

  { id: 'metas', name: 'Metas', section: 'Vida', icon: Target, ready: true, description: 'Objetivos com progresso e prazo.' },
  { id: 'habitos', name: 'Hábitos', section: 'Vida', icon: Repeat2, ready: true, description: 'Check diário com sequência (streak).' },
  { id: 'saude', name: 'Saúde', section: 'Vida', icon: HeartPulse, ready: true, description: 'Água, sono, peso e remédios com lembrete.' },
  { id: 'academia', name: 'Academia', section: 'Vida', icon: Dumbbell, ready: true, description: 'Fichas de treino, séries e cargas.' },
  { id: 'financas', name: 'Finanças', section: 'Vida', icon: Wallet, ready: true, description: 'Contas, cartões, parcelas, orçamentos e simulador freela.' },
  { id: 'boletos', name: 'Boletos', section: 'Vida', icon: Barcode, ready: true, description: 'Contas a pagar com código, PDF e aviso na véspera.' },
  { id: 'estudos', name: 'Estudos', section: 'Vida', icon: GraduationCap, ready: true, description: 'Matérias, provas e cadernos.' },
  { id: 'filmes', name: 'Filmes e Séries', section: 'Vida', icon: Film, ready: true, description: 'Lista para ver, vistos e notas.' },
  { id: 'notas', name: 'Notas', section: 'Vida', icon: Library, ready: true, description: 'Anotações com fotos, fixar e busca.' },
  { id: 'noticias', name: 'Notícias', section: 'Vida', icon: Newspaper, ready: true, description: 'Feed dos seus portais e temas.' },

  { id: 'clientes', name: 'Clientes', section: 'Trabalho', icon: Users, ready: true, description: 'Contatos e histórico de clientes.' },
  { id: 'invoices', name: 'Invoices', section: 'Trabalho', icon: ReceiptText, ready: true, description: 'Cobranças e status de pagamento.' },

  { id: 'revisao', name: 'Revisão', section: 'Insights', icon: CalendarCheck, ready: true, description: 'Revisão semanal do que rolou.' },
  { id: 'produtividade', name: 'Produtividade', section: 'Insights', icon: Gauge, ready: true, description: 'Pomodoro, timer de foco e meta diária.' },
  { id: 'analytics', name: 'Analytics', section: 'Insights', icon: ChartLine, ready: true, description: 'Gráficos de tarefas, hábitos e humor.' },
  { id: 'arquivos', name: 'Arquivos', section: 'Insights', icon: FolderOpen, ready: true, description: 'Itens arquivados e todas as suas fotos.' },
];

export const SECTIONS: Section[] = ['Núcleo', 'Vida', 'Trabalho', 'Insights'];

export const getModule = (id: string) => MODULES.find((m) => m.id === id);

export const moduleHref = (m: ModuleDef) => (m.ready ? (m.href ?? `/${m.id}`) : `/em-breve/${m.id}`);
