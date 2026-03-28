import { StyleSheet, Text, View } from "react-native";
import type { HouseholdBundle } from "@marda/shared";

interface HouseholdDetailScreenProps {
  bundle: HouseholdBundle;
}

export function HouseholdDetailScreen({ bundle }: HouseholdDetailScreenProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{bundle.household.houseId}</Text>
      <Text style={styles.subtitle}>{bundle.household.landOwnerName}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Family Grouping</Text>
        {bundle.persons.map((person) => (
          <Text key={person.id} style={styles.row}>
            {person.fullName} · {person.finalFamilyStatus}
            {person.familyGroupCode ? ` · ${person.familyGroupCode}` : " · No family group"}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compensation</Text>
        <Text style={styles.row}>Total Area: {bundle.landDetails?.totalAreaSqm ?? 0} sqm</Text>
        <Text style={styles.row}>
          Total Compensation: Rs {bundle.valuation?.totalCompensation.toLocaleString("en-IN") ?? 0}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fffef8",
    borderRadius: 20,
    padding: 18,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#253327",
  },
  subtitle: {
    color: "#7f4426",
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontWeight: "700",
    color: "#4a5243",
  },
  row: {
    color: "#2b2a28",
  },
});
