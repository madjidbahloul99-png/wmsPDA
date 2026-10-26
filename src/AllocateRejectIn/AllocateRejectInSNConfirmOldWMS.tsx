import React, { useState, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
  DeviceEventEmitter,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as allocateSoapClient from "./allocateSoapClient";

interface ConfirmItem {
  id?: string;
  fxh: string;
  SN: string;
  model: string;
  boxCode: string;
  palletCode: string;
  realdate: string;
  orderCode: string;
  allocateCode: string;
  systemAllocateCode: string;
}

export default function AllocateRejectInSNConfirmOldWMS({ navigation, route }: any) {
  // Page pass values
  const initialAllocateCode = route.params?.f_allocateCode ?? "";
  const f_barcode = route.params?.f_barcode ?? "";
  const f_showConfirm = route.params?.f_showConfirm ?? true;

  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    g_webUrl,
    g_isRealUrl,
    gs_factoryCode,
    gs_factoryindex,
  } = useGlobalStr();

    const styles = createStyles(gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc");

  // Screen States
  const [f_allocateCode, setFAllocateCode] = useState(initialAllocateCode);
  const [lblColor, setLblColor] = useState("");
  const [items, setItems] = useState<ConfirmItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Frm_AllocateRejectInSNConfirmOldWMS_Load
  useEffect(() => {
    getPalletSNConfirm(initialAllocateCode, f_barcode);
  }, []);

  /**
   * C# getPalletSNConfirm implementation
   */
  const getPalletSNConfirm = async (allocateCode: string, barcode: string) => {
    setLoading(true);
    try {
      const serverUrl = g_isRealUrl ? g_webUrl : gs_BaseURL;
      const data = await allocateSoapClient.AllocateInPalletSNConfirmInjectOldWMS(
        serverUrl,
        gs_factoryCode,
        allocateCode,
        gs_wareCode,
        barcode
      );
      console.log("data", data)
      if (data && data.length > 0) {
        let fmodel = "";
        let fcolor = "";
        let currentAllocateCode = allocateCode;
        let sapCode = "";

        const mapped: ConfirmItem[] = data.map((myrow: any) => {
          fmodel = myrow.model || "";
          fcolor = myrow.color || "";
          sapCode = myrow.systemAllocateCode || "";

          // 返回单据号 如果是空
          if (!currentAllocateCode) {
            currentAllocateCode = myrow.allocateCode || "";
          }

          return {
            id: myrow.id || myrow.fxh || "",
            fxh: myrow.fxh || "",
            SN: myrow.SN || "",
            model: myrow.model || "",
            boxCode: myrow.boxCode || "",
            palletCode: myrow.palletCode || "",
            realdate: myrow.realdate || "",
            orderCode: myrow.orderCode || "",
            allocateCode: myrow.allocateCode || "",
            systemAllocateCode: myrow.systemAllocateCode || "",
          };
        });

        setFAllocateCode(currentAllocateCode);
        setItems(mapped);
        setLblColor(fcolor);
      } else {
        pubfunction.ShowError("There is no product in the Pallet!");
        navigation.goBack();
        setLblColor("");
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network Error");
      setLblColor("");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Matches button_Confirm_Click in C#
   */
  const handleConfirmClick = () => {
    if (items.length >= 1) {
      DeviceEventEmitter.emit("ON_ALLOCATE_REJECT_CONFIRM_OK", {
        barcode: f_barcode,
        f_dt: items,
        f_allocateCode: f_allocateCode,
      });
      navigation.goBack();
    } else {
      DeviceEventEmitter.emit("ON_ALLOCATE_REJECT_CONFIRM_CANCEL");
      navigation.goBack();
    }
  };

  /**
   * Matches button_exit_Click in C#
   */
  const handleExitClick = () => {
    DeviceEventEmitter.emit("ON_ALLOCATE_REJECT_CONFIRM_CANCEL");
    navigation.goBack();
  };

  const renderItem = ({ item, index }: { item: ConfirmItem; index: number }) => {
    return (
      <View
        style={[
          styles.tableRow,
          { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }
        ]}
      >
        <Text style={[styles.cell, { width: 60 }]}>{item.fxh}</Text>
        <Text style={[styles.cell, { width: 180 }]}>{item.SN}</Text>
        <Text style={[styles.cell, { width: 180 }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: 180 }]}>{item.boxCode}</Text>
        <Text style={[styles.cell, { width: 180 }]}>{item.palletCode}</Text>
        <Text style={[styles.cell, { width: 200 }]}>{item.realdate}</Text>
        <Text style={[styles.cell, { width: 180 }]}>{item.orderCode}</Text>
      </View>
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
          <Text style={styles.headerTitle}>Reject In Confirm</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Pallet Code</Text>
            <Text style={styles.infoVal}>{f_barcode || "-"}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Color</Text>
            <Text style={styles.infoVal}>{lblColor || "-"}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Total Qty</Text>
            <Text style={styles.infoVal}>{items.length}</Text>
          </View>
        </View>

        {/* Horizontal & Vertical scrolling list table */}
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 60 }]}>LINE</Text>
                <Text style={[styles.headerCell, { width: 180 }]}>SN</Text>
                <Text style={[styles.headerCell, { width: 180 }]}>MODEL</Text>
                <Text style={[styles.headerCell, { width: 180 }]}>BOX CODE</Text>
                <Text style={[styles.headerCell, { width: 180 }]}>PALLET CODE</Text>
                <Text style={[styles.headerCell, { width: 200 }]}>DATE</Text>
                <Text style={[styles.headerCell, { width: 180 }]}>ORDER CODE</Text>
              </View>

              <FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.SN}-${index}`}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No matching barcodes found.</Text>
                }
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        </View>

        {/* Footer actions */}
        {f_showConfirm && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.btn, styles.confirmBtn]}
              onPress={handleConfirmClick}
              activeOpacity={0.7}
            >
              <Text style={styles.btnText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#06b86c" />
        </View>
      )}
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");
const scale = (size: number) => (width / 375) * size;

const createStyles = (factoryColor: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    backgroundColor: factoryColor,
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
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 8,
  },
  infoBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: factoryColor,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 4,
  },
  infoLabel: { fontSize: 12, fontWeight: "800", color: "rgba(255, 255, 255, 0.85)" },
  infoVal: { fontSize: 12, fontWeight: "900", color: "#FFFFFF" },
  tableCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 8,
  },
  tableHeader: { flexDirection: "row", backgroundColor: factoryColor, paddingVertical: 10 },
  headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center" },
  tableRow: { flexDirection: "row", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  cell: { fontSize: 11, color: "#1E293B", textAlign: "center", fontWeight: "600" },
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 810 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8,
    marginBottom: 4,
  },
  btn: {
    height: 45,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBtn: { backgroundColor: factoryColor },
  btnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});