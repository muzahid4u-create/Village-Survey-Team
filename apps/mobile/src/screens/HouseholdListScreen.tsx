import { Pressable, StyleSheet, Text, View } from "react-native";
import type { HouseholdBundle } from "@marda/shared";

interface HouseholdListScreenProps {
  households: HouseholdBundle[];
  onSelect(bundle: HouseholdBundle): void;
}

export function HouseholdListScreen({ households, onSelect }: HouseholdListScreenProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Assigned Households</Text>
      <Text style={styles.subtitle}>Offline-first list for field surveyors</Text>

      {households.map((bundle) => (
        <Pressable key={bundle.household.id} style={styles.item} onPress={() => onSelect(bundle)}>
          <Text style={styles.itemTitle}>{bundle.household.houseId}</Text>
          <Text style={styles.itemMeta}>{bundle.household.landOwnerName}</Text>
          <Text style={styles.itemMeta}>{bundle.household.locality}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff8ef",
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2f362b",
  },
  subtitle: {
    color: "#5b5c52",
  },
  item: {
    backgroundColor: "#f4ead8",
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#7f4426",
  },
  itemMeta: {
    color: "#4d493f",
  },
});

