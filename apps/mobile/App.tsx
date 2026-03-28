import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { sampleHouseholdBundle, type HouseholdBundle } from "@marda/shared";
import { HouseholdDetailScreen } from "./src/screens/HouseholdDetailScreen";
import { HouseholdListScreen } from "./src/screens/HouseholdListScreen";
import { localDb } from "./src/storage/local-db";
import { createHouseholdSyncItem } from "./src/sync/sync-queue";

export default function App() {
  const [households, setHouseholds] = useState<HouseholdBundle[]>([sampleHouseholdBundle]);
  const [selected, setSelected] = useState<HouseholdBundle>(sampleHouseholdBundle);

  useEffect(() => {
    const seed = async () => {
      await localDb.saveHousehold(sampleHouseholdBundle);
      await localDb.enqueueSync(createHouseholdSyncItem(sampleHouseholdBundle));
      const localHouseholds = await localDb.getHouseholds();
      setHouseholds(localHouseholds);
      setSelected(localHouseholds[0]);
    };

    void seed();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Field Survey App</Text>
          <Text style={styles.title}>Marda Village R&R</Text>
          <Text style={styles.subtitle}>
            Android-first starter with offline queue placeholders and shared family logic.
          </Text>
        </View>

        <HouseholdListScreen households={households} onSelect={setSelected} />
        <HouseholdDetailScreen bundle={selected} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#d9dece",
  },
  container: {
    padding: 20,
    gap: 18,
  },
  header: {
    gap: 6,
  },
  eyebrow: {
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#7f4426",
    fontSize: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#253327",
  },
  subtitle: {
    color: "#4b5643",
    lineHeight: 20,
  },
});

