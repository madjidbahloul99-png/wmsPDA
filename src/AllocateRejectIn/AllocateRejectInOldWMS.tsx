import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
  DeviceEventEmitter,
  ScrollView,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as allocateSoapClient from "./allocateSoapClient";

interface BoxItem {
  boxCode: string;
  palletCode: string;
  model: string;
  color: string;
  boxQty: string;
  systemAllocateCode: string;
  allocateCode: string;
}

export default function AllocateRejectInOldWMS({ navigation }: any) {
  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    g_webUrl,
    g_isRealUrl,
    gs_IPAddress,
    gs_classCode,
    gs_factoryCode,
  } = useGlobalStr();

  // C# public variables
  const [f_allocateCode, setFAllocateCode] = useState("");

  // Screen States
  const [txtSN, setTxtSN] = useState("");
  const [txtQty, setTxtQty] = useState("");
  const [txtSysBill, setTxtSysBill] = useState("");
  const [items, setItems] = useState<BoxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const txtSNRef = useRef<TextInput>(null);
  const scanTimer = useRef<any>(null);

  const ensureFocus = () => {
    txtSNRef.current?.focus();
  };

  // On Load
  useEffect(() => {
    // txtSN.Focus() on mount
    setTimeout(() => {
      txtSNRef.current?.focus();
    }, 300);

    // Register confirmation listeners
    const confirmSub = DeviceEventEmitter.addListener(
      "ON_ALLOCATE_REJECT_CONFIRM_OK",
      (data: { barcode: string; f_dt: any[]; f_allocateCode: string }) => {
        setFAllocateCode(data.f_allocateCode);
        palletDeal(data.barcode, data.f_dt, data.f_allocateCode);
      }
    );

    const cancelSub = DeviceEventEmitter.addListener(
      "ON_ALLOCATE_REJECT_CONFIRM_CANCEL",
      () => {
        // C# cancellation logic:
        setTxtQty("");
        setFAllocateCode("");
        setItems([]);
        setTxtSysBill("");
        setTimeout(() => {
          txtSNRef.current?.focus();
        }, 150);
      }
    );

    const focusSub = navigation.addListener("focus", () => {
      setTimeout(() => {
        txtSNRef.current?.focus();
      }, 150);
    });

    return () => {
      confirmSub.remove();
      cancelSub.remove();
      focusSub();
      if (scanTimer.current) {
        clearTimeout(scanTimer.current);
      }
    };
  }, []);

  const processSNInput = (scannedText: string) => {
    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }
    const SN = scannedText.replace(/[\r\n]/g, "").trim().toUpperCase();
    if (!SN) return;

    // Open Frm_AllocateRejectInSNConfirmOldWMS screen
    navigation.navigate("AllocateRejectInSNConfirmOldWMS", {
      f_allocateCode: "", //返回单号 不传递了
      f_barcode: SN,
      f_showConfirm: true,
    });

    setTxtSN("");
  };

  /**
   * C# txtSN_KeyDown handler (Key code 13)
   */
  const handleSNSubmit = (e?: any) => {
    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }
    const text = e?.nativeEvent?.text || txtSN;
    processSNInput(text);
  };

  /**
   * Automatic submit on text change with debounce
   */
  const handleTextChange = (text: string) => {
    setTxtSN(text);

    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }

    if (text.includes("\n") || text.includes("\r")) {
      const clean = text.replace(/[\r\n]/g, "").trim();
      if (clean.length > 0) {
        processSNInput(clean);
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    // Set 300ms delay to auto-trigger the submit once scanner finishes
    scanTimer.current = setTimeout(() => {
      const clean = trimmed.replace(/[\r\n]/g, "").trim();
      if (clean.length > 0) {
        processSNInput(clean);
      }
    }, 300);
  };

  /**
   * C# palletDeal(string barCode, DataTable dt)
   */
  const palletDeal = async (barCode: string, dt: any[], targetAllocateCode?: string) => {
    setLoading(true);
    try {
      const serverUrl = g_isRealUrl ? g_webUrl : gs_BaseURL;

      // 1. AllocateInInsertRejectOldWMS call
      const saveErrorStr = await allocateSoapClient.AllocateInInsertRejectOldWMS(
        serverUrl,
        dt,
        gs_wareCode,
        gs_userCode,
        gs_userName
      );

      if (saveErrorStr) {
        pubfunction.ShowError(saveErrorStr);
        return;
      }

      // 2. AllocateInRejectOldWMS call to get status list
      const currentAllocateCode =
        targetAllocateCode ||
        (dt && dt.length > 0 && dt[0]?.allocateCode ? dt[0].allocateCode : "") ||
        f_allocateCode;

      if (currentAllocateCode) {
        setFAllocateCode(currentAllocateCode);
      }

      const responseRows = await allocateSoapClient.AllocateInRejectOldWMS(
        serverUrl,
        gs_factoryCode,
        gs_wareCode,
        currentAllocateCode,
        gs_userCode
      );
      console.log("responseRows"+responseRows)

      if (responseRows && responseRows.length > 0) {
        if (responseRows[0].isok === "1") {
          // Update total quantity
          setTxtQty(responseRows[0].totalQty || "0");

          // Map list items
          const mapped: BoxItem[] = responseRows.map((row: any) => {
            return {
              boxCode: row.boxCode || "",
              palletCode: row.palletCode || "",
              model: row.model || "",
              color: row.color || "",
              boxQty: row.boxQty || "0",
              systemAllocateCode: row.systemAllocateCode || "",
              allocateCode: row.allocateCode || "",
            };
          });

          setItems(mapped);
          
          if (responseRows[0].allocateCode) {
            setTxtSysBill(responseRows[0].allocateCode);
          }
        } else {
          // Exception
          const retstr = responseRows[0].retstr || "Save error occurred.";
          pubfunction.ShowError(retstr);
        }
      } else {
        pubfunction.ShowError("There is no product in the Pallet!");
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network Error");
    } finally {
      setLoading(false);
      setTimeout(() => {
        txtSNRef.current?.focus();
      }, 150);
    }
  };

  const renderItem = ({ item, index }: { item: BoxItem; index: number }) => {
    return (
      <View
        style={[
          styles.row,
          { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }
        ]}
      >
        <Text style={[styles.cell, { width: 140 }]}>{item.boxCode}</Text>
        <Text style={[styles.cell, { width: 140 }]}>{item.palletCode}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
        <Text style={[styles.cell, { width: 80 }]}>{item.boxQty}</Text>
        <Text style={[styles.cell, { width: 200 }]}>{item.systemAllocateCode}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.allocateCode}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Allocate Reject In</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Sys Bill Code</Text>
            <Text style={styles.infoVal}>{txtSysBill || "-"}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Total Qty</Text>
            <Text style={styles.infoVal}>{txtQty || "-"}</Text>
          </View>
        </View>

        {/* Input Barcode */}
        <TextInput
          ref={txtSNRef}
          style={styles.textInput}
          value={txtSN}
          onChangeText={handleTextChange}
          onSubmitEditing={handleSNSubmit}
          placeholder=" SCAN BARCODE (PALLET/BOX/SN)"
          placeholderTextColor="#64748B"
          autoCapitalize="characters"
          showSoftInputOnFocus={showKeyboard}
          blurOnSubmit={false}
          onBlur={ensureFocus}
          selectTextOnFocus={true}
        />

        {/* Table / List Box */}
        <View style={styles.listCard}>
          <ScrollView horizontal>
            <View>
              <View style={styles.listHeader}>
                <Text style={[styles.headerCell, { width: 140 }]}>BOX CODE</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>PALLET CODE</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>MODEL</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>COLOR</Text>
                <Text style={[styles.headerCell, { width: 80 }]}>QTY</Text>
                <Text style={[styles.headerCell, { width: 200 }]}>SYS CODE</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>ALLOCATE</Text>
              </View>

              <FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.boxCode}-${index}`}
                ListEmptyComponent={
                  <View style={{ width: 840 }}>
                    <Text style={styles.emptyText}>No items scanned yet.</Text>
                  </View>
                }
              />
            </View>
          </ScrollView>
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
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
  },
  infoBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0052cc",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 4,
  },
  infoLabel: { fontSize: 12, fontWeight: "800", color: "rgba(255, 255, 255, 0.85)" },
  infoVal: { fontSize: 12, fontWeight: "900", color: "#FFFFFF" },
  textInput: {
    backgroundColor: "#e2f0eeff",
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
  },
  listCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
  },
  listHeader: {
    flexDirection: "row",
    backgroundColor: "#0052cc",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  cell: {
    fontSize: 11,
    color: "#1E293B",
    textAlign: "center",
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    padding: 40,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 4,
  },
  exitButton: {
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#64748B",
  },
  exitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});
