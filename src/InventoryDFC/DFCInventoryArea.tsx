import React, { useState, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
  DeviceEventEmitter,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as inventoryClient from "./inventoryClient";

interface AreaItem {
  warehouseArea: string;
  warehouseCode: string;
}

export default function DFCInventoryArea({ navigation }: any) {
  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    g_webUrl,
    g_isRealUrl,
    gs_PasswordSalt,
    gs_version,
  } = useGlobalStr();

  // Screen states
  const [lblTitle, setLblTitle] = useState(`Warehouse: ${gs_wareCode}`);
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [selectedAreaIndex, setSelectedAreaIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAreaList();
  }, []);

  /**
   * Matches getAreaList() in C#
   */
  const fetchAreaList = async () => {
    setLoading(true);
    try {
      const serverUrl = gs_BaseURL;
      const res = await inventoryClient.getAreaList(
        serverUrl,
        gs_wareCode,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success) {
        const list: AreaItem[] = res.list || [];
        setAreas(list);
        if (list.length > 0) {
          setSelectedAreaIndex(0); // select first one by default
        }
      } else {
        if (res && res.msg) {
          pubfunction.ShowError(res.msg);
        }
        setAreas([]);
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Failed to load warehouse areas");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Matches button_save_Click in C#
   */
  const handleSaveClick = () => {
    if (selectedAreaIndex === -1 || selectedAreaIndex >= areas.length) {
      pubfunction.ShowError("Please select a warehouse area first!");
      return;
    }

    const chosenArea = areas[selectedAreaIndex].warehouseArea;
    
    // Emit selection event and navigate back
    DeviceEventEmitter.emit("ON_DFC_INVENTORY_AREA_SELECTED", {
      warehouseArea: chosenArea,
    });
    
    navigation.goBack();
  };

  /**
   * Matches button_exit_Click_1 in C#
   */
  const handleExitClick = () => {
    navigation.goBack();
  };

  const renderAreaRow = ({ item, index }: { item: AreaItem; index: number }) => {
    const isSelected = index === selectedAreaIndex;
    return (
      <TouchableOpacity
        style={[
          styles.row,
          isSelected && { backgroundColor: "#0052cc15", borderColor: "#0052cc" }
        ]}
        activeOpacity={0.8}
        onPress={() => setSelectedAreaIndex(index)}
      >
        <Text style={[styles.cellText, isSelected && { fontWeight: "900", color: "#0052cc" }]}>
          {item.warehouseArea}
        </Text>
        {isSelected && (
          <Image
            source={require("../../assets/logo/left.png")}
            style={[styles.checkIcon, { tintColor: "#0052cc" }]}
            resizeMode="contain"
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleExitClick} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Area</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Warehouse code title label card */}
        <View style={styles.titleCard}>
          <Text style={styles.titleText}>{lblTitle}</Text>
        </View>

        {/* List selection of warehouse areas */}
        <View style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>AVAILABLE WAREHOUSE AREAS</Text>
          </View>

          <FlatList
            data={areas}
            renderItem={renderAreaRow}
            keyExtractor={(item, index) => `${item.warehouseArea}-${index}`}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No warehouse areas found.</Text>
            }
          />
        </View>

        {/* Actions footer buttons */}
        <View style={styles.footer}>


          <TouchableOpacity
            style={[styles.btn, styles.saveBtn]}
            onPress={handleSaveClick}
          >
            <Text style={styles.btnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0052cc" />
        </View>
      )}
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");
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
  headerLeft: { flexDirection: "row", alignItems: "center" },
  returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
  headerTitle: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "900" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
  content: { flex: 1, padding: 8 },
  titleCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
    alignItems: "center",
  },
  titleText: {
    color: "#1E293B",
    fontSize: 13,
    fontWeight: "900",
  },
  listCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
  },
  listHeader: {
    backgroundColor: "#0052cc",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  listHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 8,
    marginVertical: 2,
    marginHorizontal: 4,
  },
  cellText: {
    fontSize: 12,
    color: "#1E293B",
    fontWeight: "600",
  },
  checkIcon: {
    width: 14,
    height: 14,
    transform: [{ rotate: "180deg" }], // custom indicator or arrow
  },
  emptyText: {
    textAlign: "center",
    padding: 40,
    color: "#94A3B8",
    fontStyle: "italic",
    fontSize: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 4,
  },
  btn: {
    flex: 1,
    height: scale(42),
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
  },
  exitBtn: { backgroundColor: "#64748B" },
  saveBtn: { backgroundColor: "#0052cc" },
  btnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});
