import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { MobileWeatherData } from '../services/weatherService';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sparkles,
  Droplets,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  weather: MobileWeatherData;
}

export const WeatherBackground: React.FC<Props> = ({ weather }) => {
  const { condition, isDay } = weather;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Deep night sky / dark ambient base */}
      {isDay && condition === 'clear' ? (
        // Bright Sunny Sky Ambient
        <>
          <View style={styles.sunGlowOuter} />
          <View style={styles.sunGlowMiddle} />
          <View style={styles.sunCore}>
            <Sun size={64} color="#f59e0b" />
          </View>
          <View style={[styles.floatingSparkle, { top: 120, right: 30 }]}>
            <Sparkles size={20} color="#fbbf24" opacity={0.6} />
          </View>
          <View style={[styles.floatingSparkle, { top: 200, right: 120 }]}>
            <Sparkles size={16} color="#fde68a" opacity={0.5} />
          </View>
        </>
      ) : condition === 'rain' ? (
        // Rainy Sky Ambient
        <>
          <View style={[styles.cloudLeft, { top: 40 }]}>
            <CloudRain size={90} color="#60a5fa" opacity={0.35} />
          </View>
          <View style={[styles.cloudRight, { top: 80 }]}>
            <Cloud size={110} color="#93c5fd" opacity={0.25} />
          </View>
          <View style={[styles.rainDrop, { top: 140, left: 60 }]}>
            <Droplets size={18} color="#38bdf8" opacity={0.4} />
          </View>
          <View style={[styles.rainDrop, { top: 220, right: 50 }]}>
            <Droplets size={22} color="#38bdf8" opacity={0.5} />
          </View>
          <View style={[styles.rainDrop, { top: 320, left: 100 }]}>
            <Droplets size={16} color="#38bdf8" opacity={0.3} />
          </View>
        </>
      ) : condition === 'snow' ? (
        // Snowy Sky Ambient
        <>
          <View style={[styles.cloudLeft, { top: 40 }]}>
            <CloudSnow size={90} color="#e0f2fe" opacity={0.4} />
          </View>
          <View style={[styles.cloudRight, { top: 100 }]}>
            <CloudSnow size={100} color="#bae6fd" opacity={0.3} />
          </View>
          <View style={[styles.floatingSparkle, { top: 160, left: 50 }]}>
            <Sparkles size={16} color="#e0f2fe" opacity={0.7} />
          </View>
          <View style={[styles.floatingSparkle, { top: 260, right: 60 }]}>
            <Sparkles size={20} color="#e0f2fe" opacity={0.6} />
          </View>
        </>
      ) : condition === 'thunderstorm' ? (
        // Thunderstorm Sky Ambient
        <>
          <View style={[styles.cloudLeft, { top: 40 }]}>
            <CloudLightning size={100} color="#fbbf24" opacity={0.45} />
          </View>
          <View style={[styles.cloudRight, { top: 90 }]}>
            <Cloud size={110} color="#64748b" opacity={0.3} />
          </View>
        </>
      ) : (
        // Default / Görsel-5: Night Sky with Bright Crescent Moon & Twinkling Stars
        <>
          {/* Moon Glow behind crescent */}
          <View style={styles.moonGlowOuter} />
          <View style={styles.moonGlowInner} />

          {/* Large Yellow Crescent Moon matching Görsel-5 */}
          <View style={styles.crescentMoonWrapper}>
            <Svg width={110} height={110} viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="moonGrad" cx="35" cy="35" r="65">
                  <Stop offset="0%" stopColor="#fffde7" />
                  <Stop offset="50%" stopColor="#fef08a" />
                  <Stop offset="100%" stopColor="#facc15" />
                </RadialGradient>
              </Defs>
              <Path
                d="M 50,10 A 40,40 0 1,0 86,66 A 35,35 0 1,1 50,10 Z"
                fill="url(#moonGrad)"
              />
            </Svg>
          </View>

          {/* Twinkling Stars distributed across the entire screen matching Görsel-5 */}
          {/* Top section stars */}
          <View style={[styles.starDot, { top: 35, left: 50, width: 2, height: 2, opacity: 0.6 }]} />
          <View style={[styles.starDot, { top: 60, left: 160, width: 2.5, height: 2.5, opacity: 0.8 }]} />
          <View style={[styles.starDot, { top: 40, right: 140, width: 3, height: 3, opacity: 0.85 }]} />
          <View style={[styles.starDot, { top: 90, left: 90, width: 2, height: 2, opacity: 0.5 }]} />
          <View style={[styles.starDot, { top: 120, right: 180, width: 2.5, height: 2.5, opacity: 0.7 }]} />
          <View style={[styles.starDot, { top: 140, left: 30, width: 3.5, height: 3.5, opacity: 0.9 }]} />

          {/* Mid section stars (flanking the card) */}
          <View style={[styles.starDot, { top: 220, left: 15, width: 2.5, height: 2.5, opacity: 0.7 }]} />
          <View style={[styles.starDot, { top: 280, left: 24, width: 3, height: 3, opacity: 0.85 }]} />
          <View style={[styles.starDot, { top: 260, right: 18, width: 2, height: 2, opacity: 0.6 }]} />
          <View style={[styles.starDot, { top: 340, right: 14, width: 3, height: 3, opacity: 0.9 }]} />
          <View style={[styles.starDot, { top: 420, left: 20, width: 2, height: 2, opacity: 0.5 }]} />
          <View style={[styles.starDot, { top: 490, left: 28, width: 2.5, height: 2.5, opacity: 0.75 }]} />
          <View style={[styles.starDot, { top: 470, right: 16, width: 3, height: 3, opacity: 0.8 }]} />
          <View style={[styles.starDot, { top: 560, right: 22, width: 2, height: 2, opacity: 0.6 }]} />

          {/* Bottom section stars */}
          <View style={[styles.starDot, { bottom: 140, left: 40, width: 2.5, height: 2.5, opacity: 0.7 }]} />
          <View style={[styles.starDot, { bottom: 120, left: 110, width: 2, height: 2, opacity: 0.5 }]} />
          <View style={[styles.starDot, { bottom: 130, right: 60, width: 3, height: 3, opacity: 0.85 }]} />
          <View style={[styles.starDot, { bottom: 80, left: 80, width: 2.5, height: 2.5, opacity: 0.6 }]} />
          <View style={[styles.starDot, { bottom: 70, right: 130, width: 3.5, height: 3.5, opacity: 0.9 }]} />
          <View style={[styles.starDot, { bottom: 40, left: 160, width: 2, height: 2, opacity: 0.65 }]} />
          <View style={[styles.starDot, { bottom: 30, right: 80, width: 2.5, height: 2.5, opacity: 0.75 }]} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Sun Styles
  sunGlowOuter: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  sunGlowMiddle: {
    position: 'absolute',
    top: -15,
    right: -15,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
  },
  sunCore: {
    position: 'absolute',
    top: 25,
    right: 25,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingSparkle: {
    position: 'absolute',
  },

  // Crescent Moon matching Görsel-5
  crescentMoonWrapper: {
    position: 'absolute',
    top: 105,
    right: 32,
    zIndex: 1,
  },
  moonGlowOuter: {
    position: 'absolute',
    top: 75,
    right: 5,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(254, 240, 138, 0.08)',
  },
  moonGlowInner: {
    position: 'absolute',
    top: 90,
    right: 20,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(253, 224, 71, 0.12)',
  },

  // Twinkling Stars
  starDot: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },

  // Weather Ambient Overlays
  cloudLeft: {
    position: 'absolute',
    left: -20,
  },
  cloudRight: {
    position: 'absolute',
    right: -20,
  },
  rainDrop: {
    position: 'absolute',
  },
});
