import React, { useState, useEffect, useMemo } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  ActivityIndicator,
  ListRenderItem,
  Image,
  Dimensions,
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface BoxDetail {
  id: string;
  fxh: string;
  palletCode: string;
  boxCode: string;
  qty: number;
  model: string;
  color: string;
}

export default function AllocateSNBox({ navigation, route }: any) {
  const { allocateCode } = route.params || {};
  const global = useGlobal();
  const { gsURL, gs_factoryCode, gs_wareCode, gs_userName,operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion, } = global;
  const BASE_URL = gsURL;
  const [token, setToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BoxDetail[]>([]);
  const [selectedItem, setSelectedItem] = useState<BoxDetail | null>(null);


  useEffect(() => {
    const loadToken = async () => {
      const t = await AsyncStorage.getItem("userToken");
      console.log("TOKEN IN Allocateout", t);
      if (t) setToken(t);
    };

    loadToken();
  }, []);


  useEffect(() => {
    if (token) {
      fetchBoxDetails();
    }
  }, [token]);

  const fetchBoxDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/AllocatePalletSNBox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, },
        body: JSON.stringify({
          operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
          factoryCode: gs_factoryCode,
          wareHouseCode: gs_wareCode,
          allocateCode: allocateCode
        })
      });

      if (response.status === 401) {
        Alert.alert("Unauthorized", "Token expired or invalid.");
        return;
      }

      if (response.status === 403) {
        Alert.alert("Access Denied", "You do not have permission.");
        return;
      }


      const result = await response.json();
      if (result.code === 500) {
        Alert.alert("Error", result.message);
        navigation.goBack();
        return;
      }
      if (result.message === 'success' && result.data && result.data.length > 0) {
        const mappedData = result.data.map((row: any, index: number) => ({
          id: index.toString(),
          ...row,
          qty: parseInt(row.qty || "0", 10)
        }));
        setItems(mappedData);
      } else {
        Alert.alert("Error", "There is no product in the Pallet!");
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load box details");
    } finally {
      setLoading(false);
    }
  };

  const totalQty = useMemo<number>(
    () => items.reduce((sum, i) => sum + i.qty, 0),
    [items]
  );

  const showBarcodeDetails = (): void => {
    if (!selectedItem) {
      Alert.alert("Message", "Please select a box first.");
      return;
    }

    navigation.navigate('AllocateSN', {
      allocateCode,
      palletCode: selectedItem.palletCode,
      boxCode: selectedItem.boxCode
    });
  };

  const renderItem: ListRenderItem<BoxDetail> = ({ item, index }) => (
    <TouchableOpacity
      onPress={() => setSelectedItem(item)}
      style={[
        styles.row,
        index % 2 === 0 ? { backgroundColor: "#FFFFFF" } : { backgroundColor: "#BAE6FD" },
        selectedItem?.id === item.id && styles.selectedRow,
      ]}
    >
      <Text style={[styles.cell, { width: 40 }]}>{index + 1}</Text>
      <Text style={[styles.cell, { width: 150 }]}>{item.palletCode}</Text>
      <Text style={[styles.cell, { width: 150 }]}>{item.boxCode}</Text>
      <Text style={[styles.cell, { width: 50 }]}>{item.qty}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
      <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
    </TouchableOpacity>
  );

  const handleReturn = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleReturn} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SN Details</Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Qty</Text>
            <Text style={[styles.statValue, { color: '#FFFFFF' }]}>{totalQty}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={{ width: 510 }}>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ListHeaderComponent={
                <View style={styles.tableHeader}>
                  <Text style={[styles.headerCell, { width: 40 }]}>No</Text>
                  <Text style={[styles.headerCell, { width: 150 }]}>Pallet</Text>
                  <Text style={[styles.headerCell, { width: 150 }]}>Box</Text>
                  <Text style={[styles.headerCell, { width: 50 }]}>Qty</Text>
                  <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                  <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                </View>
              }
              stickyHeaderIndices={[0]}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  {loading ? <ActivityIndicator color="#4F46E5" /> : <Text style={styles.emptyText}>No data available</Text>}
                </View>
              }
            />
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={showBarcodeDetails}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>SN Detail</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const { width, height } = Dimensions.get("window");
const isSmallDevice = width < 360;
const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    backgroundColor: "#0052cc",
    paddingHorizontal: width * 0.05,
    height: scale(56),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  returnLogo: {
    width: scale(24),
    height: scale(24),
    marginRight: 10,
    tintColor: "#FFFFFF",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: isSmallDevice ? scale(14) : scale(16),
    fontWeight: "900",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  userNameText: {
    color: "#FFFFFF",
    fontSize: scale(12),
    fontWeight: "700",
    marginRight: 1,
  },
  content: { flex: 1, padding: 16 },
  statsCard: { paddingBottom: 16, gap: 10 },
  statBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0052cc",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  statLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  statValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10, borderRadius: 8, marginBottom: 8 },
  headerCell: { fontSize: 12, fontWeight: "900", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
  row: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", borderRadius: 8, marginBottom: 4 },
  cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
  selectedRow: { backgroundColor: "#ffc3c3ff", borderColor: "#4F46E5", borderWidth: 1 },
  emptyContainer: { padding: 40, alignItems: "center" },
  emptyText: { color: "#94A3B8", fontWeight: "600", fontSize: 14 },
  actions: { marginTop: 16 },
  primaryButton: { backgroundColor: "#4F46E5", height: 45, padding: 14, borderRadius: 12, justifyContent: "center", alignItems: "center", elevation: 4 },
  primaryButtonText: { color: "#fff", fontWeight: "900", fontSize: 13 },
});
