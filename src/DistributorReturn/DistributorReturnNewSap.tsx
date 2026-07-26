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
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as distributorReturnClient from "./distributorReturnClient";

interface ScannedBoxItem {
  id: string;
  scanBarCode: string;
  model: string;
  color: string;
  goodsCount: string;
  scanBarCodeType: string;
}

export default function DistributorReturnNewSap({ navigation, route }: any) {
  // Pass parameters from previous screen
  const f_deliveryCode = route.params?.f_deliveryCode ?? "";
  const f_systemDeliveryCode = route.params?.f_systemDeliveryCode ?? "";
  const f_model = route.params?.f_model ?? "";
  const f_customerCode = route.params?.f_customerCode ?? "";
  const f_sapMainBillCode = route.params?.f_sapMainBillCode ?? "";

  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
    gs_classCode,
    gs_IPAddress,
  } = useGlobalStr();

  // Screen States
  const [txtSource, setTxtSource] = useState("");
  const [txtQty, setTxtQty] = useState("");
  const [txtSN, setTxtSN] = useState("");
  const [lblQtyTotal, setLblQtyTotal] = useState("");
  const [scannedList, setScannedList] = useState<ScannedBoxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const txtSNRef = useRef<TextInput>(null);

  const ensureFocus = () => {
    txtSNRef.current?.focus();
  };

  // Initial load
  useEffect(() => {
    if (f_systemDeliveryCode) {
      GetListFinishBoxList();
    }
    setTimeout(() => {
      txtSNRef.current?.focus();
    }, 300);

    // Register DeviceEventEmitter listener for scanning confirmation matching C# dialog callback
    const confirmSub = DeviceEventEmitter.addListener("ON_DISTRIBUTOR_RETURN_CONFIRM_OK", (data: { SN: string; scanType: string }) => {
      if (data && data.SN) {
        palletDeal(data.SN, data.scanType);
      }
    });

    const focusSub = navigation.addListener("focus", () => {
      setTimeout(() => {
        txtSNRef.current?.focus();
      }, 150);
    });

    return () => {
      confirmSub.remove();
      focusSub();
    };
  }, [f_systemDeliveryCode]);

  /**
   * Matches GetListFinishBoxList 
   */
  const GetListFinishBoxList = async () => {
    setLoading(true);
    try {
      // to#from label matching Frm_DistributorReturnNewSap_Load
      setTxtSource(`${f_customerCode}#${gs_wareCode}`);

      const res = await distributorReturnClient.getReceiptInfoByOperatorBatch(
        gs_BaseURL,
        f_systemDeliveryCode,
        f_model,
        f_deliveryCode,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success && res.list) {
        const list = res.list;

        let qtyTotal = 0;
        const mappedList: ScannedBoxItem[] = list.map((item: any, idx: number) => {
          const count = parseInt(item.goodsCount || "0") || 0;
          qtyTotal += count;

          return {
            id: String(idx),
            scanBarCode: item.scanBarCode || "",
            model: item.model || "",
            color: item.color || "",
            goodsCount: String(count),
            scanBarCodeType: item.scanBarCodeType || "",
          };
        });

        setScannedList(mappedList);
        setLblQtyTotal(`Total: ${qtyTotal}`);
      } else {
        if (res && !res.success) {
          pubfunction.ShowError(res.msg || "Failed to load scan history");
        }
      }
    } catch (err: any) {
      console.error(err);
      pubfunction.ShowError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Matches txtSN_KeyDown callback
   */
  const handleSNSubmit = () => {
    const SN = txtSN.toUpperCase().trim();
    if (!SN) return;

    // Scan type resolution
    const scanType = pubfunction.getBarcodeType(SN);

    // Navigate to DistributorReturnSNConfirmBoxNew matching Frm_DistributorReturnSNConfirmBoxNew Dialog
    navigation.navigate("DistributorReturnSNConfirmBoxNew", {
      f_systemDeliveryCode: f_systemDeliveryCode,
      f_barCode: SN,
      f_scanType: scanType,
      f_model: f_model,
    });

    setTxtSN("");
  };

  /**
   * Matches palletDeal in C#
   */
  const palletDeal = async (barCode: string, scanType: string) => {
    setLoading(true);
    try {
      const classCodeVal = gs_classCode || "01";

      const res = await distributorReturnClient.doDistributorReturnWarehouseInStorage(
        gs_BaseURL,
        f_systemDeliveryCode,
        gs_wareCode,
        f_customerCode,
        barCode,
        scanType,
        f_model,
        f_deliveryCode,
        classCodeVal,
        f_sapMainBillCode,
        gs_IPAddress,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success && res.data) {
        const vo = res.data;

        const jihuaQty = parseInt(vo.receiptCount?.hasDeliveryCount || "0") || 0;
        const shijiQty = parseInt(vo.receiptCount?.allReceiptCount || "0") || 0;

        // update txtSource and txtQty matching C#
        setTxtSource(`${gs_wareCode}#${f_customerCode}`);
        setTxtQty(`${shijiQty}/${jihuaQty}`);

        if (shijiQty >= jihuaQty) {
          pubfunction.ShowError("The allocate of documents has already shipped completed!");
          DeviceEventEmitter.emit("ON_DISTRIBUTOR_RETURN_REFRESH");
          navigation.goBack();
          return;
        }

        let qtyTotal = 0;
        const mappedList: ScannedBoxItem[] = (vo.warehouseSumByScanBarCodeList || []).map((item: any, idx: number) => {
          const count = parseInt(item.goodsCount || "0") || 0;
          qtyTotal += count;

          return {
            id: String(idx),
            scanBarCode: item.scanBarCode || "",
            model: item.model || "",
            color: item.color || "",
            goodsCount: String(count),
            scanBarCodeType: item.scanBarCodeType || "",
          };
        });

        setScannedList(mappedList);
        setLblQtyTotal(`Total: ${qtyTotal}`);

        // Notify previous screen to update
        DeviceEventEmitter.emit("ON_DISTRIBUTOR_RETURN_REFRESH");
      } else {
        if (res && !res.success) {
          pubfunction.ShowError(res.msg || "Save barcode error");
        }
      }
    } catch (err: any) {
      console.error(err);
      pubfunction.ShowError(err.message || "Network error");
    } finally {
      setLoading(false);
      setTimeout(() => {
        txtSNRef.current?.focus();
      }, 150);
    }
  };

  const renderScannedRow = ({ item, index }: { item: ScannedBoxItem; index: number }) => {
    return (
      <View
        style={[
          styles.row,
          { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }
        ]}
      >
        <Text style={[styles.cell, { flex: 2 }]}>{item.scanBarCode}</Text>
        <Text style={[styles.cell, { flex: 1.2 }]}>{item.model}</Text>
        <Text style={[styles.cell, { flex: 1 }]}>{item.color}</Text>
        <Text style={[styles.cell, { flex: 0.8 }]}>{item.goodsCount}</Text>
        <Text style={[styles.cell, { flex: 1 }]}>{item.scanBarCodeType}</Text>
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
          <Text style={styles.headerTitle}>Distributor Return New {gs_wareCode || ""}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Info Rows */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Source</Text>
            <Text style={styles.infoVal}>{txtSource || "-"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Qty</Text>
            <Text style={styles.infoVal}>{txtQty || "-"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Model</Text>
            <Text style={styles.infoVal}>{f_model || "-"}</Text>
          </View>
        </View>

        {/* Input Barcode */}
        <View style={styles.inputCard}>
          <TextInput
            ref={txtSNRef}
            style={styles.textInput}
            value={txtSN}
            onChangeText={setTxtSN}
            onSubmitEditing={handleSNSubmit}
            placeholder=" SCAN BARCODE (PALLET/BOX/SN)"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            showSoftInputOnFocus={showKeyboard}
            blurOnSubmit={false}
            onBlur={ensureFocus}
            selectTextOnFocus={true}
          />
        </View>

        {/* List of scanned items */}
        <View style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={[styles.headerCell, { flex: 2 }]}>BARCODE</Text>
            <Text style={[styles.headerCell, { flex: 1.2 }]}>MODEL</Text>
            <Text style={[styles.headerCell, { flex: 1 }]}>COLOR</Text>
            <Text style={[styles.headerCell, { flex: 0.8 }]}>QTY</Text>
            <Text style={[styles.headerCell, { flex: 1 }]}>TYPE</Text>
          </View>

          <FlatList
            data={scannedList}
            renderItem={renderScannedRow}
            keyExtractor={(item, index) => `${item.scanBarCode}-${index}`}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No items scanned yet.</Text>
            }
          />

          {lblQtyTotal ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalText}>{lblQtyTotal}</Text>
            </View>
          ) : null}
        </View>

        {/* Footer controls */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.exitButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.exitButtonText}>Exit</Text>
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
  infoCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  infoLabel: { fontSize: 12, fontWeight: "800", color: "#475569" },
  infoVal: { fontSize: 12, fontWeight: "900", color: "#1E293B" },
  inputCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
  },
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
    paddingHorizontal: 6,
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
    paddingHorizontal: 6,
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
  totalRow: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    alignItems: "flex-end",
  },
  totalText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0052cc",
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
