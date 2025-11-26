import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react-native';
import { BRAND_COLORS } from '@/constants/colors';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const NUMBERS = [1, 2, 3, 4, 5];

export default function StorageLocationsScreen() {
  const [expandedLetter, setExpandedLetter] = useState<string | null>(null);

  const toggleLetter = (letter: string) => {
    setExpandedLetter(expandedLetter === letter ? null : letter);
  };

  const handleLocationSelect = (letter: string, number: number) => {
    const location = `${letter}${number}`;
    console.log('Selected storage location:', location);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Storage Locations',
          headerShown: true,
          headerStyle: {
            backgroundColor: BRAND_COLORS.primary,
          },
          headerTintColor: BRAND_COLORS.light,
          headerTitleStyle: {
            fontWeight: '700' as const,
            fontSize: 18,
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <ArrowLeft size={24} color={BRAND_COLORS.light} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.grid}>
          {LETTERS.map((letter, index) => (
            <View key={letter} style={styles.letterContainer}>
              <TouchableOpacity
                style={[
                  styles.letterCard,
                  expandedLetter === letter && styles.letterCardExpanded,
                ]}
                onPress={() => toggleLetter(letter)}
                activeOpacity={0.7}
              >
                <Text style={styles.letterText}>{letter}</Text>
                {expandedLetter === letter ? (
                  <ChevronUp size={24} color={BRAND_COLORS.primary} />
                ) : (
                  <ChevronDown size={24} color={BRAND_COLORS.gray[400]} />
                )}
              </TouchableOpacity>

              {expandedLetter === letter && (
                <View style={styles.numbersContainer}>
                  {NUMBERS.map((number) => (
                    <TouchableOpacity
                      key={number}
                      style={styles.numberButton}
                      onPress={() => handleLocationSelect(letter, number)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.numberText}>{number}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_COLORS.gray[50],
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  letterContainer: {
    width: '48%',
    marginBottom: 8,
  },
  letterCard: {
    backgroundColor: BRAND_COLORS.light,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  letterCardExpanded: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.gray[50],
  },
  letterText: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: BRAND_COLORS.dark,
  },
  numbersContainer: {
    marginTop: 8,
    backgroundColor: BRAND_COLORS.light,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  numberButton: {
    backgroundColor: BRAND_COLORS.gray[50],
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.gray[200],
  },
  numberText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: BRAND_COLORS.dark,
    textAlign: 'center',
  },
});
