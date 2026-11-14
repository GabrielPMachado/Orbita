import {
  Bike,
  BookOpen,
  Brain,
  CigaretteOff,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  Code,
  Coffee,
  Droplet,
  Dumbbell,
  Footprints,
  Guitar,
  HandHeart,
  Heart,
  Leaf,
  Moon,
  PenLine,
  Pill,
  Salad,
  Sun,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

/** Ícones disponíveis para hábitos (chave salva no dado → componente SVG). */
export const HABIT_ICONS: Record<string, LucideIcon> = {
  agua: Droplet,
  caminhar: Footprints,
  ler: BookOpen,
  meditar: Leaf,
  treino: Dumbbell,
  alimentacao: Salad,
  sono: Moon,
  remedio: Pill,
  escrever: PenLine,
  musica: Guitar,
  semFumar: CigaretteOff,
  gratidao: HandHeart,
  codigo: Code,
  bike: Bike,
  cafe: Coffee,
  sol: Sun,
  saude: Heart,
  foco: Timer,
  estudo: Brain,
  energia: Zap,
};

export const habitIcon = (key: string): LucideIcon => HABIT_ICONS[key] ?? Zap;

/** Escala de humor de 1 a 5, representada por clima. */
export const MOODS: { icon: LucideIcon; label: string }[] = [
  { icon: CloudLightning, label: 'Péssimo' },
  { icon: CloudRain, label: 'Ruim' },
  { icon: Cloud, label: 'Neutro' },
  { icon: CloudSun, label: 'Bom' },
  { icon: Sun, label: 'Ótimo' },
];
