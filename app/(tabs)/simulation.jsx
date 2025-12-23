import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Play, Zap, Clock, Target } from 'lucide-react-native';
import { SPACING } from '../../constants/theme';
import { Card } from '../../components/ui';
import useTheme from '../../hooks/useTheme';
import useTranslation from '../../hooks/useTranslation';

export default function Simulation() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.BG }}>
    {/* Just For Spacing */}
    </ScrollView>
  );
}
