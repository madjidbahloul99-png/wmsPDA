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
  Image,
  Dimensions,
  DeviceEventEmitter,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as distributorReturnClient from "./distributorReturnClient";


interface DistributorReturnItem {
  id: string;
  sysDeliveryCode: string; // item.billCode
  model: string;           // item.model
  color: string;           // item.color
  billCount: string;       // item.billCount (计划数)
  okqty: number;           // item.actualCount (接收数)
  cyqty: number;           // billCount - okqty (差异数)
  fromck: string;          // fromck / warehouseCode
  supplierCode: string;    // item.supplierCode / tokh
  operatorBatch: string;   // item.operatorBatch / deliveryCode
  sapMainBillCode: string; // sapMainBillCode
}

export default function DistributorReturnNONewSap({ navigation }: any) {
  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
  } = useGlobalStr();

  // Screen states matching C# logic
  const [txtSN, setTxtSN] = useState("");
  const [labelError, setLabelError] = useState("");
  const [items, setItems] = useState<DistributorReturnItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  // Global variables
  const [f_sapMainBillCode, setFSapMainBillCode] = useState("");
  const [f_fromck, setFFromck] = useState("");

  const txtSNRef = useRef<TextInput>(null);

  const ensureFocus = () => {
    txtSNRef.current?.focus();
  };

  // On page load & refresh setup
  useEffect(() => {
    setLabelError("");
    setFFromck("");
    setFSapMainBillCode("");
    setTimeout(() => {
      txtSNRef.current?.focus();
    }, 300);

    // Register DeviceEventEmitter listener for refresh
    const refreshSub = DeviceEventEmitter.addListener("ON_DISTRIBUTOR_RETURN_REFRESH", () => {
      if (f_sapMainBillCode) {
        DeliveryModelListSap(f_sapMainBillCode);
      }
    });

    const focusSub = navigation.addListener("focus", () => {
      setTimeout(() => {
        txtSNRef.current?.focus();
      }, 150);
    });

    return () => {
      refreshSub.remove();
      focusSub();
    };
  }, [f_sapMainBillCode, gs_wareCode]);

  /**
   * Matches DeliveryModelListSap in C#
   */
  const DeliveryModelListSap = async (sapMainBillCode: string) => {
    const cleanCode = (sapMainBillCode || "").toUpperCase().trim();
    if (!cleanCode) return;

    setLoading(true);
    setLabelError("");
    setSelectedIndex(null);

    try {
      const res = await distributorReturnClient.getDistributorReturnBillInfoByBillCodeFromSap(
        gs_BaseURL,
        cleanCode,
        gs_wareCode,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      let fromck = "";
      let tokh = "";

      if (res && res.success && res.list) {
        const list = res.list;

        if (list.length >= 1) {
          fromck = list[0].warehouseCode || "";
          tokh = list[0].supplierCode || "";
          setFFromck(fromck);
          setLabelError(`Source: ${tokh}#${fromck}`);
        }

        if (list.length > 0) {
          const mappedItems: DistributorReturnItem[] = list.map((item: any, index: number) => {
            const jihuaqty = parseInt(item.billCount || "0") || 0;
            const okqty = parseInt(item.actualCount || "0") || 0;
            const cyqty = jihuaqty - okqty;

            return {
              id: String(index),
              sysDeliveryCode: item.billCode || "",
              model: item.model || "",
              color: item.color || "",
              billCount: String(jihuaqty),
              okqty: okqty,
              cyqty: cyqty,
              fromck: fromck,
              supplierCode: item.supplierCode || "",
              operatorBatch: item.operatorBatch || "",
              sapMainBillCode: cleanCode
            };
          });

          setItems(mappedItems);
        } else {
          // If no data
          setFSapMainBillCode("");
          setTxtSN("");
          txtSNRef.current?.focus();
          return;
        }
      } else {
        if (res && !res.success) {
          pubfunction.ShowError(res.msg || "Loading Failed");
          setFSapMainBillCode("");
          setTxtSN("");
          txtSNRef.current?.focus();
          return;
        }
      }

      // Check warehouse matching rule
      if (fromck !== "" && fromck !== gs_wareCode) {
        setLabelError(`To WareHose Must is Login WareHouse ${gs_wareCode}`);
        setTxtSN("");
        setItems([]);
        setFSapMainBillCode("");
        txtSNRef.current?.focus();
        return;
      }

      // Assign global state on success
      setFSapMainBillCode(cleanCode);
    } catch (err: any) {
      console.error(err);
      pubfunction.ShowError(err.message || "Network Error");
    } finally {
      setLoading(false);
    }
  };

  const handleSNSubmit = () => {
    const code = txtSN.toUpperCase().trim();
    if (code) {
      DeliveryModelListSap(code);
    }
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

    // Navigate to DistributorReturnNewSap screen
    navigation.navigate("DistributorReturnNewSap", {
      f_deliveryCode: selectedItem.operatorBatch,
      f_systemDeliveryCode: selectedItem.sysDeliveryCode,
      f_sapMainBillCode: f_sapMainBillCode,
      f_customerCode: selectedItem.supplierCode,
      f_model: selectedItem.model,
    });
  };

  const renderItem = React.useCallback(({ item, index }: { item: DistributorReturnItem; index: number }) => {
    // If cyqty > 0, if okqty > 0 then Blue, else Red
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
        <Text style={[styles.cell, { color: textColor, width: 80 }]}>{item.billCount}</Text>
        <Text style={[styles.cell, { color: textColor, width: 80 }]}>{item.okqty}</Text>
        <Text style={[styles.cell, { color: textColor, width: 80 }]}>{item.cyqty}</Text>
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
          <Text style={styles.headerTitle}>Distributor Return {gs_wareCode || ""}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Input Card */}
        <View style={styles.card}>
          {labelError ? <Text style={styles.infoText}>{labelError}</Text> : null}

          <View style={styles.inputGroup}>
            <TextInput
              ref={txtSNRef}
              style={styles.input}
              value={txtSN}
              onChangeText={(text) => {
                setTxtSN(text);
                setLabelError("");
              }}
              onSubmitEditing={handleSNSubmit}
              placeholder=" SCAN SAP MAIN BILL CODE"
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              showSoftInputOnFocus={showKeyboard}
              blurOnSubmit={false}
              onBlur={ensureFocus}
              selectTextOnFocus={true}
            />
          </View>
        </View>

        {/* Data list view */}
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 120 }]}>BILL CODE</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                <Text style={[styles.headerCell, { width: 80 }]}>Plan Qty</Text>
                <Text style={[styles.headerCell, { width: 80 }]}>Ok Qty</Text>
                <Text style={[styles.headerCell, { width: 80 }]}>Diff Qty</Text>
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
  headerTitle: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "900" },
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
  inputGroup: { marginBottom: 4 },
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
  infoText: { color: "#1E293B", fontSize: 12, marginBottom: 8, fontWeight: "800" },
  selectedRow: { backgroundColor: "#BAE6FD" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
