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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import { ApiContext, getBillModels } from "./api";
import { BillModelGroup, BillModelRow, ReturnContext } from "./types";

/** One line of the table, a customer of a model. */
type TableItem = {
  key: string;
  group: BillModelGroup;
  row: BillModelRow;
};

/**
 * Page 1 - Scan the SAP return bill and select the model to return.
 *
 * A return bill can hold several customers (multi client) and the same model
 * can belong to more than one of them, so the table is grouped by model and
 * shows one line per customer of the model.
 *
 * The table is reloaded every time the screen comes back so the processed
 * quantity is up to date.
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
  const [groups, setGroups] = useState<BillModelGroup[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKeyboard] = useState(false);
  const [f_billCode, setFBillCode] = useState("");

  const txtBillRef = useRef<TextInput>(null);
  const scanTimer = useRef<any>(null);
  // True while a request is in flight, a ref is always up to date (no stale closure)
  const busyRef = useRef(false);

  useEffect(() => {
    let isActive = true;

    const notifyIfJwtUnavailable = async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");
        if (isActive && !token) {
          pubfunction.ShowError(
            "JWT login failed. Delivery Return Bill is unavailable for this session. Check the network/VPN and log in again.",
          );
        }
      } catch {
        if (isActive) {
          pubfunction.ShowError(
            "JWT login failed. Delivery Return Bill is unavailable for this session. Check the network/VPN and log in again.",
          );
        }
      }
    };

    notifyIfJwtUnavailable();
    return () => {
      isActive = false;
    };
  }, []);

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
      busyRef.current = true;
      setLabelError("");

      try {
        const rows = await getBillModels(apiCtx, { sapMainBillCode: cleanCode });

        if (rows.length === 0) {
          setGroups([]);
          setSelectedKey(null);
          setFBillCode("");
          setLabelError(`No return bill found for ${cleanCode}`);
          return;
        }

        // The destination customer cannot be empty (same check as the delivery flow)
        const hasEmptyCustomer = rows.some((group) =>
          group.rows.some((row) => !row.customerCode)
        );
        if (hasEmptyCustomer) {
          pubfunction.ShowError("The destination customer cannot be empty!");
          setGroups([]);
          setSelectedKey(null);
          setFBillCode("");
          return;
        }

        // The warehouse of the bill is checked by the server: the rows are the
        // ones of the logged in warehouse, a foreign bill answers
        // "No model found for this bill in your warehouse" and the error below
        // shows exactly the message of the server.
        setGroups(rows);
        setSelectedKey(null);
        setFBillCode(cleanCode);
      } catch (err: any) {
        setLabelError(err.message || "Network error");
        pubfunction.ShowError(err.message || "Network error");
      } finally {
        busyRef.current = false;
        setLoading(false);
        setTimeout(() => {
          txtBillRef.current?.focus();
        }, 120);
      }
    },
    [apiCtx]
  );

  // Clean up a pending scan timer on unmount.
  useEffect(() => {
    return () => {
      if (scanTimer.current) {
        clearTimeout(scanTimer.current);
      }
    };
  }, []);

  // Reload the bill when the screen comes back (products could have been returned)
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
    // A scan during a request is ignored, it would load the bill twice
    if (busyRef.current) return;

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

  /**
   * One line per customer of a model, sorted by model. A return bill can hold
   * several customers (multi client) and the same model can belong to more
   * than one of them.
   */
  const tableData: TableItem[] = useMemo(() => {
    const items: TableItem[] = [];
    groups.forEach((group) => {
      group.rows.forEach((row) => {
        items.push({
          // The key is a business key, it stays the same when the list is reloaded
          key: `${row.customerCode}|${row.model}|${row.systemDeliveryCode}`,
          group,
          row,
        });
      });
    });
    return items;
  }, [groups]);

  /** The customer line that was selected. */
  const selectedItem: TableItem | null = useMemo(() => {
    if (!selectedKey) return null;
    return tableData.find((entry) => entry.key === selectedKey) || null;
  }, [selectedKey, tableData]);

  const selectedRow: BillModelRow | null = selectedItem ? selectedItem.row : null;

  /** Summary of the scanned bill. */
  const summary = useMemo(() => {
    let customers = 0;
    let units = 0;
    const seen: { [key: string]: boolean } = {};
    groups.forEach((group) => {
      units += group.planQty;
      group.rows.forEach((row) => {
        const key = `${row.customerCode}|${row.customerName}`;
        if (!seen[key]) {
          seen[key] = true;
          customers += 1;
        }
      });
    });
    return { customers, models: groups.length, units };
  }, [groups]);

  /**
   * Choice - goes to the SN scan page with the selected customer and model.
   */
  const handleChoiceClick = () => {
    // A double tap would push the SN page twice
    if (busyRef.current) return;

    if (!selectedRow || !selectedItem) {
      pubfunction.ShowError("Please select a row first!");
      return;
    }

    const selected = selectedRow;
    const group = selectedItem.group;

    const context: ReturnContext = {
      f_billCode: f_billCode,
      f_systemDeliveryCode: selected.systemDeliveryCode,
      f_sapMainBillCode: selected.sapMainBillCode,
      f_lineId: selected.lineId,
      f_model: selected.model,
      f_modelDesc: selected.modelDesc,
      f_color: selected.color,
      f_ean: selected.ean,
      f_brand: selected.brand,
      f_customerCode: selected.customerCode,
      f_customerName: selected.customerName,
      f_cityName: selected.cityName,
      f_address: selected.address,
      f_customerType: selected.customerType,
      f_operatorBatch: selected.operatorBatch,
      f_wareCode: gs_wareCode || "",
      f_toWarehouseCode: selected.toWarehouseCode,
      f_deliveryDate: selected.deliveryDate,
      f_movementStatus: selected.movementStatus,
      f_movementDate: selected.movementDate,
      f_movementType: selected.movementType,
      // the quantities of the model, the list of the products to scan is
      // the model of the bill, whatever the customer of the row
      f_planQty: group.planQty,
      f_doneQty: group.doneQty,
      f_diffQty: group.diffQty,
    };

    navigation.navigate("DeliveryReturnBillSN", context);
  };

  const renderItem = React.useCallback(
    ({ item, index }: { item: TableItem; index: number }) => {
      const row = item.row;
      const isSelected = selectedKey === item.key;

      // Blue when something was already returned, red when nothing was returned yet
      let textColor = "#1E293B";
      if (row.diffQty > 0) {
        textColor = row.doneQty > 0 ? "#0052cc" : "#EF4444";
      }

      return (
        <TouchableOpacity
          style={[
            styles.tableRow,
            { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" },
            isSelected && styles.selectedRow,
          ]}
          onPress={() => setSelectedKey(item.key)}
        >
          <Text style={[styles.cell, { color: textColor, width: 120 }]}>
            {row.systemDeliveryCode}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 110 }]}>
            {row.model}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 90 }]}>
            {row.color || "-"}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 50 }]}>{row.planQty}</Text>
          <Text style={[styles.cell, { color: textColor, width: 50 }]}>{row.doneQty}</Text>
          <Text style={[styles.cell, { color: textColor, width: 50 }]}>{row.diffQty}</Text>
          <Text style={[styles.cell, { color: textColor, width: 100 }]}>
            {row.fromck || "-"}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 100 }]}>
            {row.toWarehouseCode || gs_wareCode || "-"}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 90 }]}>
            {row.customerCode}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 160 }]}>
            {row.customerName}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 150 }]}>
            {row.operatorBatch}
          </Text>
          <Text style={[styles.cell, { color: textColor, width: 120 }]}>
            {row.sapMainBillCode}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedKey, gs_wareCode]
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
            editable={!loading}
            placeholder=" SCAN SAP RETURN BILL CODE"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            autoCorrect={false}
            showSoftInputOnFocus={showKeyboard}
            blurOnSubmit={false}
            onBlur={ensureFocus}
            selectTextOnFocus={true}
          />
          {labelError ? (
            <Text style={styles.infoText}>{labelError}</Text>
          ) : groups.length > 0 ? (
            <Text style={styles.summaryText}>
              {`Bill ${f_billCode} - ${summary.customers} customer(s) - ${summary.models} model(s) - ${summary.units} unit(s)`}
            </Text>
          ) : null}
        </View>

        {/* Models of the scanned bill */}
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 120 }]}>BILL CODE</Text>
                <Text style={[styles.headerCell, { width: 110 }]}>Model</Text>
                <Text style={[styles.headerCell, { width: 90 }]}>Color</Text>
                <Text style={[styles.headerCell, { width: 50 }]}>Plan</Text>
                <Text style={[styles.headerCell, { width: 50 }]}>Done</Text>
                <Text style={[styles.headerCell, { width: 50 }]}>Diff</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>From WH</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>To WH</Text>
                <Text style={[styles.headerCell, { width: 90 }]}>Customer</Text>
                <Text style={[styles.headerCell, { width: 160 }]}>Customer Name</Text>
                <Text style={[styles.headerCell, { width: 150 }]}>Batch</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>SAP BILL</Text>
              </View>

              <FlatList
                data={tableData}
                renderItem={renderItem}
                keyExtractor={(item) => item.key}
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
          <TouchableOpacity
            style={[styles.choiceButton, loading && styles.choiceButtonDisabled]}
            onPress={handleChoiceClick}
            disabled={loading}
          >
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
  inputGroup: { marginBottom: 8 },
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
  infoText: { color: "#EF4444", fontSize: 13, marginTop: 4, marginLeft: 4, fontWeight: "800" },
  summaryText: {
    color: "#0052cc",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
    marginLeft: 4,
  },
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
    paddingVertical: 12,
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
  choiceButtonDisabled: { opacity: 0.5 },
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
