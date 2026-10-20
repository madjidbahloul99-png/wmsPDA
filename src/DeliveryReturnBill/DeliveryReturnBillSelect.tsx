import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  TextInput,
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
import { useFocusEffect } from "@react-navigation/native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import { ApiContext, getBillModels } from "./api";
import { BillModelRow, ReturnContext } from "./types";
import { EVENT_REFRESH } from "./events";

/**
 * Page 1 - Scan the SAP return bill and select the model to return.
 */
export default function DeliveryReturnBillSelect({ navigation }: any) {
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

  const apiCtx: ApiContext = useMemo(
    () => ({
      gs_BaseURL,
      gs_wareCode,
      gs_userCode,
      gs_userName,
      gs_PasswordSalt,
      gs_version,
      gs_classCode,
      gs_IPAddress,
    }),
    [
      gs_BaseURL,
      gs_wareCode,
      gs_userCode,
      gs_userName,
      gs_PasswordSalt,
      gs_version,
      gs_classCode,
      gs_IPAddress,
    ]
  );

  // Screen states
  const [txtBill, setTxtBill] = useState("");
  const [labelError, setLabelError] = useState("");
  const [labelSource, setLabelSource] = useState("");
  const [items, setItems] = useState<BillModelRow[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKeyboard] = useState(false);
  const [f_billCode, setFBillCode] = useState("");

  const txtBillRef = useRef<TextInput>(null);
  const scanTimer = useRef<any>(null);

  const ensureFocus = () => {
    txtBillRef.current?.focus();
  };

  /**
   * Loads the models of the scanned return bill.
   */
  const loadBillModels = useCallback(
    async (billCode: string) => {
      const cleanCode = (billCode || "").trim().toUpperCase();
      if (!cleanCode) return;

      setLoading(true);
      setLabelError("");

      try {
        const rows = await getBillModels(apiCtx, { sapMainBillCode: cleanCode });

        if (rows.length === 0) {
          setItems([]);
          setSelectedIndex(null);
          setFBillCode("");
          setLabelError(`No return bill found for ${cleanCode}`);
          return;
        }

        setItems(rows);
        setSelectedIndex(null);
        setFBillCode(cleanCode);
        const first = rows[0];
        setLabelSource(`Source: ${first.supplierCode}#${first.fromck}`);
      } catch (err: any) {
        pubfunction.ShowError(err.message || "Network error");
      } finally {
        setLoading(false);
        setTimeout(() => {
          txtBillRef.current?.focus();
        }, 120);
      }
    },
    [apiCtx]
  );

  // Register the refresh event and focus the scan input
  useEffect(() => {
    const refreshSub = DeviceEventEmitter.addListener(EVENT_REFRESH, () => {
      if (f_billCode) {
        loadBillModels(f_billCode);
      }
    });

    setTimeout(() => {
      txtBillRef.current?.focus();
    }, 300);

    return () => {
      refreshSub.remove();
      if (scanTimer.current) {
        clearTimeout(scanTimer.current);
      }
    };
  }, [f_billCode, loadBillModels]);

  // Reload the bill when the screen comes back (a product could have been returned)
  useFocusEffect(
    React.useCallback(() => {
      setTimeout(() => {
        txtBillRef.current?.focus();
      }, 150);
      if (f_billCode) {
        loadBillModels(f_billCode);
      }
    }, [f_billCode, loadBillModels])
  );

  const processBillInput = (scannedText: string) => {
    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }
    const code = (scannedText || "").replace(/[\r\n]/g, "").trim().toUpperCase();
    if (!code) return;

    setTxtBill("");
    loadBillModels(code);
  };

  const handleTextChange = (text: string) => {
    setTxtBill(text);
    setLabelError("");

    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }

    if (text.includes("\n") || text.includes("\r")) {
      const clean = text.replace(/[\r\n]/g, "").trim();
      if (clean.length > 0) {
        processBillInput(clean);
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    // Auto trigger once the scanner is done
    scanTimer.current = setTimeout(() => {
      if (trimmed.length > 0) {
        processBillInput(trimmed);
      }
    }, 300);
  };

  const handleSelectIndex = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      const item = items[index];
      if (item) {
        setLabelSource(`Source: ${item.supplierCode}#${item.fromck}`);
      }
    },
    [items]
  );

  /**
   * Choice - goes to the SN scan page with the selected model.
   */
  const handleChoiceClick = () => {
    if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= items.length) {
      pubfunction.ShowError("Please select a row first!");
      return;
    }

    const selected = items[selectedIndex];
    if (!selected) return;

    const context: ReturnContext = {
      f_billCode: f_billCode,
      f_systemDeliveryCode: selected.systemDeliveryCode,
      f_sapMainBillCode: selected.sapMainBillCode,
      f_model: selected.model,
      f_color: selected.color,
      f_customerCode: selected.supplierCode,
      f_operatorBatch: selected.operatorBatch || selected.deliveryCode,
      f_wareCode: gs_wareCode || "",
      f_planQty: selected.planQty,
      f_doneQty: selected.doneQty,
    };

    navigation.navigate("DeliveryReturnBillSN", context);
  };

  const renderItem = React.useCallback(
    ({ item, index }: { item: BillModelRow; index: number }) => {
      // Blue when something was already returned, red when nothing was returned yet
      let textColor = "#1E293B";
      if (item.diffQty > 0) {
        textColor = item.doneQty > 0 ? "#0052cc" : "#EF4444";
      }

      const isSelected = selectedIndex === index;

      return (
        <TouchableOpacity
          key={item.id}
          style={[
            styles.tableRow,
            { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" },
            isSelected && styles.selectedRow,
          ]}
          onPress={() => handleSelectIndex(index)}
        >
          <Text style={[styles.cell, { color: textColor, width: 120 }]}>
            {item.systemDeliveryCode}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 110 }]}>
            {item.model}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 90 }]}>
            {item.color}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 60 }]}>
            {item.planQty}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 60 }]}>
            {item.doneQty}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 60 }]}>
            {item.diffQty}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 90 }]}>
            {item.fromck}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 90 }]}>
            {item.supplierCode}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 130 }]}>
            {item.operatorBatch}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 130 }]}>
            {item.sapMainBillCode}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedIndex, handleSelectIndex]
  );

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
          <Text style={styles.headerTitle}>
            Delivery Return Bill {gs_wareCode || ""}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Input area */}
        <View style={styles.inputGroup}>
          <TextInput
            ref={txtBillRef}
            style={styles.input}
            value={txtBill}
            onChangeText={handleTextChange}
            placeholder=" SCAN SAP RETURN BILL CODE"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            autoCorrect={false}
            showSoftInputOnFocus={showKeyboard}
            blurOnSubmit={false}
            onBlur={ensureFocus}
            selectTextOnFocus={true}
          />
          {labelSource ? <Text style={styles.sourceText}>{labelSource}</Text> : null}
          {labelError ? <Text style={styles.infoText}>{labelError}</Text> : null}
        </View>

        {/* Models of the scanned bill */}
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 120 }]}>BILL CODE</Text>
                <Text style={[styles.headerCell, { width: 110 }]}>Model</Text>
                <Text style={[styles.headerCell, { width: 90 }]}>Color</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>Plan</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>Done</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>Diff</Text>
                <Text style={[styles.headerCell, { width: 90 }]}>From WH</Text>
                <Text style={[styles.headerCell, { width: 90 }]}>Supplier</Text>
                <Text style={[styles.headerCell, { width: 130 }]}>Batch</Text>
                <Text style={[styles.headerCell, { width: 130 }]}>SAP BILL</Text>
              </View>

              <FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.systemDeliveryCode}-${index}`}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {loading ? "Loading..." : "Waiting for the SAP return bill..."}
                  </Text>
                }
                style={{ flex: 1 }}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
              />
            </View>
          </ScrollView>
        </View>

        {/* Footer controls */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.choiceButton} onPress={handleChoiceClick}>
            <Text style={styles.choiceButtonText}>Choice</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0052cc" />
          </View>
        )}
      </View>
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
  headerTitle: { color: "#FFFFFF", fontSize: scale(15), fontWeight: "900" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
  content: { flex: 1, padding: 8 },
  inputGroup: { marginBottom: 12 },
  input: {
    backgroundColor: "#e2f0eeff",
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "#0052cc",
  },
  sourceText: { color: "#0052cc", fontSize: 13, marginTop: 4, marginLeft: 4, fontWeight: "800" },
  infoText: { color: "#EF4444", fontSize: 13, marginTop: 4, marginLeft: 4, fontWeight: "800" },
  tableCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
  },
  tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
  headerCell: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  cell: { fontSize: 11, color: "#1E293B", textAlign: "center", fontWeight: "600" },
  emptyText: {
    textAlign: "center",
    padding: 40,
    color: "#94A3B8",
    fontStyle: "italic",
    width: 1000,
  },
  footer: { borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 2 },
  choiceButton: {
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0052cc",
  },
  choiceButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  selectedRow: { backgroundColor: "#BAE6FD" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});
