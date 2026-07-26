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
import * as inventoryClient from "./inventoryClient";

interface QtyDetailItem {
  ean: string;
  model: string;
  colorName: string;
  goodsCount: string;
  remark: string;
  addDateFormat: string;
}

const REMARK_OPTIONS = ["Conforme", "Class A", "Class B", "Class C"];

export default function DFCInventoryQty({ navigation, route }: any) {
  // Route inputs passed from DFCInventoryOldWMS
  const f_billCode = route.params?.f_billCode ?? "";
  const f_model = route.params?.f_model ?? "";

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
  const [f_modeEAN, setFModeEAN] = useState("");
  const [lblModel, setLblModel] = useState(`MODEL: ${f_model} EAN: Loading...`);
  const [lblQtyTotal, setLblQtyTotal] = useState("Total: 0");
  const [txtSN, setTxtSN] = useState("");
  const [selectedRemarkIndex, setSelectedRemarkIndex] = useState(0);

  // Table items state
  const [items, setItems] = useState<QtyDetailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRemarkDropdown, setShowRemarkDropdown] = useState(false);

  const txtSNRef = useRef<TextInput>(null);

  const ensureFocus = () => {
    txtSNRef.current?.focus();
  };

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    setLoading(true);
    try {
      // 1. Get Model EAN code
      const eanStr = await getModelEAN(f_model);
      setFModeEAN(eanStr);
      setLblModel(`MODEL: ${f_model}\nEAN: ${eanStr}`);

      // 2. Load already scanned summary list
      if (f_billCode !== "") {
        await getModelScanSummaryList(eanStr);
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Init Error");
    } finally {
      setLoading(false);
      setTimeout(() => ensureFocus(), 300);
    }
  };

  /**
   * Matches GetModelEAN in C#
   */
  const getModelEAN = async (modelName: string): Promise<string> => {
    try {
      const serverUrl = gs_BaseURL;
      const res = await inventoryClient.getModelListBymodel(
        serverUrl,
        modelName,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success && res.list && res.list.length > 0) {
        return (res.list[0].ean || "").toUpperCase();
      }
      return "EAN ERROR";
    } catch (err) {
      return "EAN ERROR";
    }
  };

  /**
   * Matches getModelScanSummaryList in C#
   */
  const getModelScanSummaryList = async (eanStr: string) => {
    try {
      const serverUrl = gs_BaseURL;
      const targetEan = eanStr || f_modeEAN;
      const res = await inventoryClient.getModelScanSummaryList(
        serverUrl,
        f_billCode,
        f_model,
        targetEan,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success) {
        const list: QtyDetailItem[] = res.list || [];
        setItems(list);

        // Sum quantities
        const sum = list.reduce((total, val) => total + parseInt(val.goodsCount || "0"), 0);
        setLblQtyTotal(`Total: ${sum}`);
      } else {
        if (res && res.msg) {
          pubfunction.ShowError(res.msg);
        }
        setItems([]);
        setLblQtyTotal("Total: 0");
      }
    } catch (err: any) {
    }
  };

  /**
   * Matches doAddInventoryModelAdd(qty) in C#
   */
  const doAddInventoryModelAddQty = async (qty: string) => {
    setLoading(true);
    try {
      const serverUrl = gs_BaseURL;
      const remark = REMARK_OPTIONS[selectedRemarkIndex];
      const res = await inventoryClient.doAddInventoryModelAddQty(
        serverUrl,
        f_billCode,
        f_model,
        f_modeEAN,
        gs_wareCode,
        qty,
        remark,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success) {
        const list: QtyDetailItem[] = res.list || [];
        setItems(list);

        const sum = list.reduce((total, val) => total + parseInt(val.goodsCount || "0"), 0);
        setLblQtyTotal(`Total: ${sum}`);
      } else {
        if (res && res.msg) {
          pubfunction.ShowError(res.msg);
        }
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network Error");
    } finally {
      setLoading(false);
      setTxtSN("");
      setTimeout(() => ensureFocus(), 150);
    }
  };

  /**
   * Matches btnSave_Click in C# (Save scanned qty)
   */
  const handleSaveClick = () => {
    const SNVal = txtSN.toUpperCase().trim();
    if (!SNVal) return;

    if (pubfunction.isNum(SNVal)) {
      doAddInventoryModelAddQty(SNVal);
    } else {
      pubfunction.ShowError("QTY must is number!");
      setTxtSN("");
      setTimeout(() => ensureFocus(), 150);
    }
  };

  /**
   * Matches button_exit_Click in C#
   */
  const handleExitClick = () => {
    // Notify parent to refresh model list
    DeviceEventEmitter.emit("ON_DFC_INVENTORY_QTY_SAVED");
    navigation.goBack();
  };

  const renderDetailRow = ({ item, index }: { item: QtyDetailItem; index: number }) => {
    return (
      <View
        style={[
          styles.row,
          { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }
        ]}
      >
        <Text style={[styles.cell, { width: scale(110) }]}>{item.ean}</Text>
        <Text style={[styles.cell, { width: scale(140), textAlign: "left" }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: scale(100) }]}>{item.colorName}</Text>
        <Text style={[styles.cell, { width: scale(60), fontWeight: "900", color: "#0052cc" }]}>{item.goodsCount}</Text>
        <Text style={[styles.cell, { width: scale(80) }]}>{item.remark}</Text>
        <Text style={[styles.cell, { width: scale(130) }]}>{item.addDateFormat}</Text>
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
          <Text style={styles.headerTitle}>Inventory Qty Setup</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Model EAN labels info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={{ flex: 1.5 }}>
              <Text style={styles.infoVal}>{lblModel}</Text>
            </View>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{lblQtyTotal}</Text>
            </View>
          </View>
        </View>

        {/* Input quantity scan panel */}
        <View style={styles.inputCard}>
          <View style={styles.inputColumn}>
            {/* Remark dropdown picker selection */}
            <TouchableOpacity
              style={styles.dropdownButton}
              activeOpacity={0.8}
              onPress={() => setShowRemarkDropdown(!showRemarkDropdown)}
            >
              <Text style={styles.dropdownButtonText}>
                {REMARK_OPTIONS[selectedRemarkIndex]} ▾
              </Text>
            </TouchableOpacity>

            <TextInput
              ref={txtSNRef}
              style={styles.textInput}
              value={txtSN}
              onChangeText={setTxtSN}
              onSubmitEditing={handleSaveClick}
              placeholder="ENTER INVENTORY QUANTITY"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              blurOnSubmit={false}
              multiline={false}
              numberOfLines={1}
              scrollEnabled={false}
              onBlur={ensureFocus}
              selectTextOnFocus={true}
            />
          </View>

          {showRemarkDropdown && (
            <View style={styles.dropdownList}>
              {REMARK_OPTIONS.map((opt, idx) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.dropdownRow,
                    idx === selectedRemarkIndex && { backgroundColor: "#0052cc10" }
                  ]}
                  onPress={() => {
                    setSelectedRemarkIndex(idx);
                    setShowRemarkDropdown(false);
                    setTimeout(() => ensureFocus(), 100);
                  }}
                >
                  <Text style={[styles.dropdownRowText, idx === selectedRemarkIndex && { fontWeight: "900", color: "#0052cc" }]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* List of scanned details for this model */}
        <View style={styles.listCard}>
          <ScrollView horizontal contentContainerStyle={{ flexDirection: "column", flexGrow: 1 }}>
            <View style={{ width: scale(620), flex: 1 }}>
              <View style={styles.listHeader}>
                <Text style={[styles.headerCell, { width: scale(110) }]}>EAN</Text>
                <Text style={[styles.headerCell, { width: scale(140), textAlign: "left" }]}>MODEL</Text>
                <Text style={[styles.headerCell, { width: scale(100) }]}>COLOR</Text>
                <Text style={[styles.headerCell, { width: scale(60) }]}>QTY</Text>
                <Text style={[styles.headerCell, { width: scale(80) }]}>REMARK</Text>
                <Text style={[styles.headerCell, { width: scale(130) }]}>DATE</Text>
              </View>

              <FlatList
                data={items}
                style={{ flex: 1 }}
                renderItem={renderDetailRow}
                keyExtractor={(item, index) => `${item.addDateFormat}-${index}`}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No items added yet.</Text>
                }
              />
            </View>
          </ScrollView>
        </View>

        {/* Footer actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, styles.saveBtn]}
            onPress={handleSaveClick}
          >
            <Text style={styles.btnText}>Save Qty</Text>
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
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoVal: { fontSize: 11, fontWeight: "900", color: "#1E293B", lineHeight: 15 },
  totalBadge: {
    backgroundColor: "#0052cc",
      borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  totalBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "900" },
  inputCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 6,
    zIndex: 100,
  },
  inputColumn: {
    flexDirection: "column",
  },
  dropdownButton: {
    backgroundColor: "#E2E8F0",
    height: scale(36),
    borderRadius: 8,
    paddingHorizontal: 10,
    justifyContent: "center",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  dropdownButtonText: { fontSize: 12, fontWeight: "800", color: "#475569" },
  textInput: {
    backgroundColor: "#e2f0eeff",
    height: scale(36),
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: 12,
    color: "#1E293B",
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#0052cc",
    textAlignVertical: "center",
  },
  dropdownList: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    marginTop: 4,
    overflow: "hidden",
  },
  dropdownRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownRowText: { fontSize: 12, color: "#1E293B", fontWeight: "600" },
  listCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 6,
  },
  listHeader: {
    flexDirection: "row",
    backgroundColor: "#0052cc",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerCell: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  cell: {
    fontSize: 10,
    color: "#1E293B",
    textAlign: "center",
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    padding: 30,
    color: "#94A3B8",
    fontStyle: "italic",
    fontSize: 11,
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
    height: scale(40),
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 3,
  },
  saveBtn: { backgroundColor: "#0052cc" },
  exitBtn: { backgroundColor: "#64748B" },
  btnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});
