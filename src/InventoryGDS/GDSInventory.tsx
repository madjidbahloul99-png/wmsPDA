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
  Modal,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as gdsInventoryClient from "./gdsInventoryClient";

interface InventoryBillModelVO {
  billCode: string;
  model: string;
  colorName: string;
  scanCount: string;
}

interface DropdownItem {
  model: string;
  ean: string;
}

export default function GDSInventory({ navigation }: any) {
  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    g_webUrl,
    g_isRealUrl,
    gs_PasswordSalt,
    
    gs_version,
    gs_factoryindex,
} = useGlobalStr();

    const styles = createStyles(gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc");

  // Screen global variables / states matching C# variables
  const [f_billCode, setFBillCode] = useState("");
  const [lblBillCode, setLblBillCode] = useState("");
  const [label_error, setLabelError] = useState("");
  const [txtModel, setTxtModel] = useState("");
  const [txtModelEnabled, setTxtModelEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  // Model ComboBox / Dropdown state
  const [cmbModel, setCmbModel] = useState<DropdownItem[]>([]);
  const [selectedCmbIndex, setSelectedCmbIndex] = useState<number>(-1);
  const [showDropdownPicker, setShowDropdownPicker] = useState(false);
  const [lastSelectedModel, setLastSelectedModel] = useState<string>("");

  // Table lists matching listViewBox
  const [items, setItems] = useState<InventoryBillModelVO[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);

  const txtModelRef = useRef<TextInput>(null);
  const fBillCodeRef = useRef("");
  const txtModelEnabledRef = useRef(false);
  const scanTimer = useRef<any>(null);

  useEffect(() => {
    fBillCodeRef.current = f_billCode;
  }, [f_billCode]);

  useEffect(() => {
    txtModelEnabledRef.current = txtModelEnabled;
  }, [txtModelEnabled]);

  const ensureFocus = () => {
    if (txtModelEnabledRef.current && !showDropdownPicker && !loading) {
      txtModelRef.current?.focus();
    }
  };

  useEffect(() => {
    if (txtModelEnabled) {
      setTimeout(() => {
        txtModelRef.current?.focus();
      }, 300);
    }
  }, [txtModelEnabled]);

  // On mount load
  useEffect(() => {
    // Page init
    setLabelError("");
    setFBillCode("");
    setLblBillCode("");

    // Get active inventory bill
    getLastInventoryBillByWarehouseCode();

    // Register event listener to refresh model list when coming back from sub scan screen
    const sub = DeviceEventEmitter.addListener("ON_GDS_INVENTORY_QTY_SAVED", () => {
      if (fBillCodeRef.current) {
        getInventoryModelList(fBillCodeRef.current);
      }
      setTimeout(() => ensureFocus(), 150);
    });

    const focusSub = navigation.addListener("focus", () => {
      setTimeout(() => ensureFocus(), 150);
    });

    return () => {
      sub.remove();
      focusSub();
      if (scanTimer.current) {
        clearTimeout(scanTimer.current);
      }
    };
  }, []);

  /**
   * Matches getLastInventoryBillByWarehouseCode in C#
   */
  const getLastInventoryBillByWarehouseCode = async () => {
    setLoading(true);
    try {
      const serverUrl = gs_BaseURL;
      const res = await gdsInventoryClient.getLastInventoryBillByWarehouseCode(
        serverUrl,
        gs_wareCode,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );
      console.log("getLastInventoryBillByWarehouseCode", res)
      if (res && res.success && res.data) {
        const vo = res.data;

        if (vo.inventoryStatus === "SCAN" || vo.inventoryStatus === "DOING") {
          // Active inventory found
          setLblBillCode(vo.billCode);
          setFBillCode(vo.billCode);
          setTxtModelEnabled(true);

          // Get model summary list
          await getInventoryModelList(vo.billCode);

          setTimeout(() => {
            txtModelRef.current?.focus();
          }, 300);
        } else {
          setTxtModelEnabled(false);
          setLabelError("No inventory need Doing!");
          setItems([]);
        }
      } else {
        setTxtModelEnabled(false);
        setLabelError("No inventory need Doing!");
        setItems([]);
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network Error");
      setTxtModelEnabled(false);
      setLabelError("No inventory need Doing!");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Matches getInventoryModelList in C#
   */
  const getInventoryModelList = async (billCode: string) => {
    try {
      const serverUrl = gs_BaseURL;
      const res = await gdsInventoryClient.getInventoryModelList(
        serverUrl,
        billCode,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success) {
        setItems(res.list || []);
      } else {
        if (res && res.msg) {
          pubfunction.ShowError(res.msg);
        }
        setItems([]);
      }
    } catch (err: any) {
    }
  };

  /**
   * Matches txtModel_KeyDown in C# (Key code 13)
   */
  const processModelInput = async (scannedText: string) => {
    if (scanTimer.current) clearTimeout(scanTimer.current);
    setLabelError("");

    if (f_billCode === "") {
      setLabelError("No inventory need Doing!");
      setTxtModel("");
      setTimeout(() => ensureFocus(), 100);
      return;
    }

    const modelStr = scannedText.toUpperCase().trim();
    setTxtModel("");
    if (!modelStr) return;

    setLoading(true);
    try {
      // Clear combobox items first
      setCmbModel([]);
      setSelectedCmbIndex(-1);
      setShowDropdownPicker(false);

      // 1. Try to fetch by EAN first
      let successQuery = await getModelListByEan(modelStr);

      // 2. If no items, try searching by model name
      if (!successQuery) {
        await getModelListBymodel(modelStr);
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Query Error");
    } finally {
      setLoading(false);
      setTimeout(() => ensureFocus(), 150);
    }
  };

  const handleModelChange = (text: string) => {
    setTxtModel(text);
    if (scanTimer.current) clearTimeout(scanTimer.current);

    if (text.includes("\n") || text.includes("\r")) {
      const clean = text.replace(/[\r\n]/g, "").trim();
      if (clean.length > 0) {
        processModelInput(clean);
      }
      return;
    }

    if (text.trim().length > 0) {
      scanTimer.current = setTimeout(() => {
        const clean = text.replace(/[\r\n]/g, "").trim();
        if (clean.length > 0) {
          processModelInput(clean);
        }
      }, 300);
    }
  };

  const handleModelSubmit = (e?: any) => {
    if (scanTimer.current) clearTimeout(scanTimer.current);
    const text = e?.nativeEvent?.text || txtModel;
    const clean = text.replace(/[\r\n]/g, "").trim();
    if (clean.length > 0) {
      processModelInput(clean);
    }
  };

  /**
   * Matches getModelListByEan in C#
   */
  const getModelListByEan = async (ean: string): Promise<boolean> => {
    try {
      const serverUrl = gs_BaseURL;
      const res = await gdsInventoryClient.getModelListByEan(
        serverUrl,
        ean,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success && res.list && res.list.length > 0) {
        const mappedList: DropdownItem[] = res.list.map((m: any) => ({
          model: m.model || "",
          ean: m.ean || "",
        }));

        setCmbModel(mappedList);
        setSelectedCmbIndex(0);
        setShowDropdownPicker(true);
        return true;
      } else if (res && !res.success && res.msg) {
        pubfunction.ShowError(res.msg);
      }
    } catch (err: any) {
    }
    return false;
  };

  /**
   * Matches getModelListBymodel in C#
   */
  const getModelListBymodel = async (modelName: string): Promise<boolean> => {
    try {
      const serverUrl = gs_BaseURL;
      const res = await gdsInventoryClient.getModelListBymodel(
        serverUrl,
        modelName,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success && res.list && res.list.length > 0) {
        const mappedList: DropdownItem[] = res.list.map((m: any) => ({
          model: m.model || "",
          ean: m.ean || "",
        }));

        setCmbModel(mappedList);
        setSelectedCmbIndex(0);
        setShowDropdownPicker(true);
        return true;
      } else if (res && !res.success && res.msg) {
        pubfunction.ShowError(res.msg);
      }
    } catch (err: any) {
    }
    return false;
  };

  /**
   * Matches doAddInventoryModelAdd in C#
   */
  const doAddInventoryModelAdd = async (model: string) => {
    setLoading(true);
    try {
      const serverUrl = gs_BaseURL;
      const res = await gdsInventoryClient.doAddInventoryModelAdd(
        serverUrl,
        f_billCode,
        model,
        gs_wareCode,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success) {
        setItems(res.list || []);
      } else {
        if (res && res.msg) {
          pubfunction.ShowError(res.msg);
        }
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Failed to add model");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Matches btnModel_Click in C#
   */
  const handleModelSelect = (item: DropdownItem) => {
    setShowDropdownPicker(false);
    setLastSelectedModel(item.model);
    setTimeout(() => {
      ensureFocus();
    }, 150);
  };

  /**
   * Matches btnChoice_Click in C#
   */
  const btnChoice_Click = () => {
    if (selectedRowIndex === -1 || selectedRowIndex >= items.length) {
      pubfunction.ShowError("Please select a row from the list first!");
      return;
    }

    const selectedItem = items[selectedRowIndex];
    // Open GDSInventoryNew (Frm_InventoryNew)
    navigation.navigate("GDSInventoryNew", {
      f_billCode: f_billCode,
      f_model: selectedItem.model,
    });
  };

  /**
   * Exit / Close Button Click
   */
  const handleExitClick = () => {
    navigation.goBack();
  };

  const renderSummaryRow = ({ item, index }: { item: InventoryBillModelVO; index: number }) => {
    const isSelected = index === selectedRowIndex;
    return (
      <TouchableOpacity
        style={[
          styles.row,
          { backgroundColor: isSelected ? "#ffa3a3ff" : index % 2 === 0 ? "#FFFFFF" : "#c8dff6ff" }
        ]}
        activeOpacity={0.8}
        onPress={() => {
          setSelectedRowIndex(index);
          setTimeout(() => {
            ensureFocus();
          }, 150);
        }}
      >
        <Text style={[styles.cell, { width: 180 }]}>{item.billCode}</Text>
        <Text style={[styles.cell, { width: 150, textAlign: "left" }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: 150 }]}>{item.colorName}</Text>
        <Text style={[styles.cell, { width: 100, fontWeight: "900" }]}>{item.scanCount}</Text>
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
          <Text style={styles.headerTitle}>GDS Inventory </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Info Box Card showing lblBillCode and Error message if any */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={{ flex: 1.2 }}>
              <Text style={styles.infoLabel}>Bill Code</Text>
              <Text style={styles.infoVal}>{lblBillCode || "No Active Inventory"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Warehouse Code</Text>
              <Text style={styles.infoVal}>{gs_wareCode || "-"}</Text>
            </View>
          </View>
          {label_error !== "" && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{label_error}</Text>
            </View>
          )}
        </View>

        {/* Model Input (txtModel) */}

        <TextInput
          ref={txtModelRef}
          style={[styles.textInput, !txtModelEnabled && { backgroundColor: "#E2E8F0", color: "#64748B" }]}
          value={txtModel}
          onChangeText={handleModelChange}
          //onSubmitEditing={handleModelSubmit}
          placeholder={txtModelEnabled ? "Model / EAN" : " DISABLED"}
          placeholderTextColor="#64748B"
          autoCapitalize="characters"
          editable={txtModelEnabled}
          blurOnSubmit={false}
          showSoftInputOnFocus={showKeyboard}
          onBlur={() => {
            setTimeout(() => {
              ensureFocus();
            }, 150);
          }}
          selectTextOnFocus={true}
        />

        {/* Always Visible Dropdown Selector (like Login) with Save button */}
        <View style={styles.comboSelectorRow}>
          <TouchableOpacity
            style={styles.comboSelectorContainer}
            onPress={() => {
              if (cmbModel.length > 0) {
                setShowDropdownPicker(true);
              } else {
                pubfunction.ShowError("No models found. Please search by entering Model/EAN first.");
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={(lastSelectedModel || cmbModel.length > 0) ? styles.comboSelectorText : styles.comboSelectorPlaceholder}>
              {lastSelectedModel
                ? `${lastSelectedModel}`
                : cmbModel.length > 0
                  ? `Choose (${cmbModel.length})...`
                  : "Choose Model (cmbModel)"}
            </Text>
            <Text style={styles.comboChevron}>▼</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.inlineSaveBtn}
            onPress={async () => {
              if (!lastSelectedModel) {
                pubfunction.ShowError("Please select a model from the list first!");
                return;
              }
              await doAddInventoryModelAdd(lastSelectedModel);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.inlineSaveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>


        {/* Dropdown ComboBox selection (cmbModel) */}

        {showDropdownPicker && cmbModel.length > 0 && (
          <Modal visible={showDropdownPicker} transparent animationType="fade">
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => {
                setShowDropdownPicker(false);
                setTimeout(() => {
                  ensureFocus();
                }, 150);
              }}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Choose Model</Text>
                <FlatList
                  data={cmbModel}
                  keyExtractor={(item, index) => `${item.model}-${index}`}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={() => handleModelSelect(item)}
                    >
                      <Text style={styles.optionText}>{item.model}</Text>
                      <Text style={styles.optionSubText}>EAN: {item.ean}</Text>
                    </TouchableOpacity>
                  )}
                  style={{ maxHeight: scale(250) }}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        )}


        {/* Table summary view list (listViewBox) */}
        <View style={styles.listCard}>
          <ScrollView horizontal>
            <View>
              <View style={styles.listHeader}>
                <Text style={[styles.headerCell, { width: 180 }]}>Bill Code</Text>
                <Text style={[styles.headerCell, { width: 150, textAlign: "left" }]}>Model</Text>
                <Text style={[styles.headerCell, { width: 150 }]}>Color</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>Scan Count</Text>
              </View>

              <FlatList
                data={items}
                renderItem={renderSummaryRow}
                keyExtractor={(item, index) => `${item.model}-${index}`}
                ListEmptyComponent={
                  <View style={{ width: 450 }}>
                    <Text style={styles.emptyText}>No inventory model records found.</Text>
                  </View>
                }
              />
            </View>
          </ScrollView>
        </View>

        {/* Action Panel Buttons */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: "#06b86c" }]}
            onPress={btnChoice_Click}
          >
            <Text style={styles.controlBtnText}>Choice </Text>
          </TouchableOpacity>

        </View>
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
    backgroundColor: factoryColor,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoLabel: { fontSize: 11, fontWeight: "800", color: "#FEF2F2" },
  infoVal: { fontSize: 12, fontWeight: "900", color: "#FFFFFF" },
  errorContainer: {
    marginTop: 4,
    padding: 4,
    backgroundColor: "#FEF2F2",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorText: {
    fontSize: 11,
    color: "#DC2626",
    fontWeight: "700",
    textAlign: "center"
  },
  inputCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 4
  },
  textInput: {
    backgroundColor: "#e2f0eeff",
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "700",
    borderWidth: 1,
    borderColor: factoryColor,
    paddingVertical: 0,
    marginBottom: 6,
  },
  comboSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  comboSelectorContainer: {
    flex: 1,
    backgroundColor: "#e2f0eeff",
    height: scale(36),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: factoryColor,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  inlineSaveBtn: {
    backgroundColor: factoryColor,
    height: scale(36),
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  inlineSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  comboSelectorText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  comboSelectorPlaceholder: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  comboChevron: {
    fontSize: 10,
    color: factoryColor,
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    maxHeight: scale(400),
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: factoryColor,
    marginBottom: 12,
    textAlign: "center",
  },
  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  optionSubText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  listCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 6,
  },
  listHeader: {
    flexDirection: "row",
    backgroundColor: factoryColor,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerCell: {
    fontSize: 12,
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
    fontSize: 12,
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
  actionButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  controlBtn: {
    flex: 1,
    height: scale(38),
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    elevation: 2,
  },
  controlBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});