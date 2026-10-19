import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
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
  Alert,
  Image,
  Dimensions,
  DeviceEventEmitter,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";

interface DeliveryReturnItem {
  id: string;
  sysDeliveryCode: string; // item.billCode
  model: string;           // item.model
  color: string;           // item.color
  billCount: string;       // item.billCount
  outqty: number;          // item.hasDeliveryCount
  okqty: number;           // item.actualCount
  cyqty: number;           // outqty - okqty
  fromck: string;          // fromck
  supplierCode: string;    // item.supplierCode
  operatorBatch: string;   // item.operatorBatch
  sapMainBillCode: string; // sapMainBillCode
}

export default function DeliveryReturnNONewSap({ navigation }: any) {
  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
  } = useGlobalStr();

  // Page level global states
  const [txtSN, setTxtSN] = useState("");
  const [labelError, setLabelError] = useState("");
  const [items, setItems] = useState<DeliveryReturnItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  // Keep tracking of current f_sapMainBillCode and f_fromck
  const [f_sapMainBillCode, setFSapMainBillCode] = useState("");
  const [f_fromck, setFFromck] = useState(gs_wareCode || "");

  const txtSNRef = useRef<TextInput>(null);
  const scanTimer = useRef<any>(null);

  const ensureFocus = () => {
    txtSNRef.current?.focus();
  };

  // Initial load
  useEffect(() => {
    setLabelError("");
    setFFromck(gs_wareCode || "");
    setTimeout(() => {
      txtSNRef.current?.focus();
    }, 300);

    // Register listen to refresh event from nested screens
    const refreshSub = DeviceEventEmitter.addListener("ON_DELIVERY_RETURN_REFRESH", () => {
      if (f_sapMainBillCode) {
        DeliveryModelListSap(f_sapMainBillCode);
      }
    });

    return () => {
      refreshSub.remove();
      if (scanTimer.current) {
        clearTimeout(scanTimer.current);
      }
    };
  }, [f_sapMainBillCode, gs_wareCode]);

  useFocusEffect(
    React.useCallback(() => {
      setTimeout(() => {
        txtSNRef.current?.focus();
      }, 150);
      if (f_sapMainBillCode) {
        DeliveryModelListSap(f_sapMainBillCode);
      }
    }, [f_sapMainBillCode])
  );

  /**
   * Matches DeliveryModelListSap in C#
   */
  const DeliveryModelListSap = async (sapMainBillCode: string) => {
    if (loading) return;

    const cleanCode = (sapMainBillCode || "").trim().toUpperCase();
    if (!cleanCode) return;

    setLoading(true);
    setLabelError("");
    setSelectedIndex(null);

    try {
      let urlCur = `${gs_BaseURL}/warehouse/billInfo/getDeliveryNotSignReturnWarehouseBillInfoByBillCodeFromSap`;
      const billType = "5003";

      // Append query parameters
      urlCur = urlCur + `?sapMainBillCode=${encodeURIComponent(cleanCode)}`;
      urlCur = urlCur + `&warehouseCode=${encodeURIComponent(gs_wareCode)}`;
      urlCur = urlCur + `&billType=${encodeURIComponent(billType)}`;

      // Append signature
      urlCur = urlCur + pubfunction.GetUserSign("&");

      const response = await fetch(urlCur, {
        method: "GET",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }, //application/x-www-form-urlencoded
      });

      if (!response.ok) {
        pubfunction.ShowError(`HTTP Error: ${response.status}`);
      }

      const resData = await response.json();
      console.log("getDeliveryNotSignReturnWarehouseBillInfoByBillCodeFromSap:", resData);

      let fromck = "";
      let tokh = "";

      // Success check (ExecuteData.IsListLoadSuccess)
      if (resData && resData.success && resData.list) {
        const rawList = typeof resData.list === "string" ? JSON.parse(resData.list) : resData.list;

        if (rawList && rawList.length >= 1) {
          fromck = rawList[0].warehouseCode || "";
          tokh = rawList[0].supplierCode || "";
          setFFromck(fromck);
          setLabelError(`Source: ${tokh}#${fromck}`);
        }

        if (rawList && rawList.length > 0) {
          const mappedItems: DeliveryReturnItem[] = rawList.map((item: any, idx: number) => {
            const outQtyVal = parseInt(item.hasDeliveryCount || "0") || 0;
            const okQtyVal = parseInt(item.actualCount || "0") || 0;
            const cyQtyVal = outQtyVal - okQtyVal;

            return {
              id: String(idx),
              sysDeliveryCode: item.billCode || "",
              model: item.model || "",
              color: item.color || "",
              billCount: item.billCount || "0",
              outqty: outQtyVal,
              okqty: okQtyVal,
              cyqty: cyQtyVal,
              fromck: fromck,
              supplierCode: item.supplierCode || "",
              operatorBatch: item.operatorBatch || "",
              sapMainBillCode: cleanCode,
            };
          });

          setItems(mappedItems);
        } else {
          setFSapMainBillCode("");
          setItems([]);
          txtSNRef.current?.focus();
          return;
        }
      } else {
        if (resData) {
          if (!resData.success) {
            pubfunction.ShowError(resData.msg || "Loading failed");
            setFSapMainBillCode("");
            setItems([]);
            return;
          }
        }
      }

      // Check warehouse rules
      if (fromck !== "" && fromck !== gs_wareCode) {
        setLabelError(`To WareHose Must is Login WareHouse ${gs_wareCode}`);
        setTxtSN("");
        setItems([]);
        setFSapMainBillCode("");
        txtSNRef.current?.focus();
        return;
      }

      // Set state when successful
      setFSapMainBillCode(cleanCode);
    } catch (err: any) {
      pubfunction.ShowError("here"+err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const processSNInput = (scannedText: string) => {
    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }
    const code = scannedText.replace(/[\r\n]/g, "").trim().toUpperCase();
    if (!code) return;

    DeliveryModelListSap(code);
    setTxtSN("");
  };

  const handleSNSubmit = (e?: any) => {
    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }
    const text = e?.nativeEvent?.text || txtSN;
    processSNInput(text);
  };

  const handleTextChange = (text: string) => {
    setTxtSN(text);
    setLabelError("");

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

  const handleSelectIndex = (index: number) => {
    setSelectedIndex(index);
    const item = items[index];
    if (item) {
      setLabelError(`Source: ${item.supplierCode}#${f_fromck}`);
    }
  };

  /**
   * Matches btnChoice_Click in C#
   */
  const handleChoiceClick = () => {
    if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= items.length) {
      pubfunction.ShowError("Please select a row first!");
      return;
    }

    const selectedItem = items[selectedIndex];
    if (!selectedItem) return;

    // Navigate to DeliveryReturnNewSap matching Frm_DeliveryReturnNewSap
    navigation.navigate("DeliveryReturnNewSap", {
      f_deliveryCode: selectedItem.operatorBatch,
      f_systemDeliveryCode: selectedItem.sysDeliveryCode,
      f_sapMainBillCode: f_sapMainBillCode,
      f_customerCode: selectedItem.supplierCode,
      f_model: selectedItem.model,
    });
  };

  const renderItem = React.useCallback(({ item, index }: { item: DeliveryReturnItem; index: number }) => {
    // If cyqty > 0, if okqty > 0 then Blue, else Red. Otherwise standard charcoal.
    let textColor = "#1E293B";
    if (item.cyqty > 0) {
      textColor = item.okqty > 0 ? "#0052cc" : "#EF4444";
    }

    const isSelected = selectedIndex === index;

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.tableRow,
          { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" },
          isSelected && styles.selectedRow
        ]}
        onPress={() => handleSelectIndex(index)}
      >
        <Text style={[styles.cell, { color: textColor, width: 120 }]}>{item.sysDeliveryCode}</Text>
        <Text style={[styles.cell, { color: textColor, width: 120 }]}>{item.model}</Text>
        <Text style={[styles.cell, { color: textColor, width: 100 }]}>{item.color}</Text>
        <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.billCount}</Text>
        <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.outqty}</Text>
        <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.okqty}</Text>
        <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.cyqty}</Text>
        <Text style={[styles.cell, { color: textColor, width: 100 }]}>{item.fromck}</Text>
        <Text style={[styles.cell, { color: textColor, width: 100 }]}>{item.supplierCode}</Text>
        <Text style={[styles.cell, { color: textColor, width: 200 }]}>{item.operatorBatch}</Text>
        <Text style={[styles.cell, { color: textColor, width: 150 }]}>{item.sapMainBillCode}</Text>
      </TouchableOpacity>
    );
  }, [selectedIndex]);

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
          <Text style={styles.headerTitle}>Delivery Return {gs_wareCode || ""}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Input area */}
        <View style={styles.inputGroup}>
          <TextInput
            ref={txtSNRef}
            style={styles.input}
            value={txtSN}
            onChangeText={handleTextChange}
            //onSubmitEditing={handleSNSubmit}
            placeholder=" SCAN SAP MAIN BILL CODE"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            showSoftInputOnFocus={showKeyboard}
            blurOnSubmit={false}
            onBlur={ensureFocus}
            selectTextOnFocus={true}
          />
          {labelError ? <Text style={styles.infoText}>{labelError}</Text> : null}
        </View>

        {/* Data list view */}
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 120 }]}>BILL CODE</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>Count</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>Out Qty</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>OK Qty</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>Diff</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>From WH</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>Supplier</Text>
                <Text style={[styles.headerCell, { width: 200 }]}>Batch</Text>
                <Text style={[styles.headerCell, { width: 150 }]}>SAP MAIN BILL</Text>
              </View>
              <FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.sysDeliveryCode}-${index}`}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {loading ? "Loading..." : "Waiting for SAP Main Bill..."}
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
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingTop: 10,
    paddingBottom: 8,
    padding: 8,
    marginBottom: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#0052cc",
  },
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
  headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  cell: { fontSize: 11, color: "#1E293B", textAlign: "center", fontWeight: "600" },
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 1120 },
  footer: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 2 },
  choiceButton: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0052cc' },
  choiceButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  infoText: { color: "#EF4444", fontSize: 13, marginTop: 4, marginLeft: 4, fontWeight: "800" },
  selectedRow: { backgroundColor: "#BAE6FD" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
