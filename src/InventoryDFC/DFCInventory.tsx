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
import * as inventoryClient from "./inventoryClient";

interface ModelSummaryItem {
  ean: string;
  model: string;
  colorName: string;
  scanCount: string;
  billCode: string;
}

interface DropdownItem {
  model: string;
  ean: string;
}

export default function DFCInventory({ navigation }: any) {
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

  // Screen global variables / states
  const [f_billCode, setFBillCode] = useState("");
  const [lblBillCode, setLblBillCode] = useState("");
  const [lblWarehouseArea, setLblWarehouseArea] = useState("");

  // Input states
  const [txtEAN, setTxtEAN] = useState("");
  const [loading, setLoading] = useState(false);
  const [txtEANEnabled, setTxtEANEnabled] = useState(false);
  const [btnSaveEnabled, setBtnSaveEnabled] = useState(false);

  // Model ComboBox Dropdown state
  const [cmbModel, setCmbModel] = useState<DropdownItem[]>([]);
  const [selectedCmbIndex, setSelectedCmbIndex] = useState<number>(-1);
  const [showDropdownPicker, setShowDropdownPicker] = useState(false);
  const [lastSelectedModel, setLastSelectedModel] = useState<DropdownItem | null>(null);

  // Table lists
  const [items, setItems] = useState<ModelSummaryItem[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);

  const txtEANRef = useRef<TextInput>(null);

  const ensureFocus = () => {
    if (txtEANEnabled) {
      txtEANRef.current?.focus();
    }
  };

  // On mount
  useEffect(() => {
    getLastInventoryBillByWarehouseCode();

    // Register listeners for qty screen and area choosing screens
    const qtySub = DeviceEventEmitter.addListener(
      "ON_DFC_INVENTORY_QTY_SAVED",
      () => {
        if (f_billCode) {
          getInventoryModelList(f_billCode);
        }
        setTimeout(() => ensureFocus(), 150);
      }
    );

    const areaSub = DeviceEventEmitter.addListener(
      "ON_DFC_INVENTORY_AREA_SELECTED",
      async (data: { warehouseArea: string }) => {
        await doAddInventoryeanBill(data.warehouseArea);
      }
    );

    const focusSub = navigation.addListener("focus", () => {
      setTimeout(() => ensureFocus(), 150);
    });

    return () => {
      qtySub.remove();
      areaSub.remove();
      focusSub();
    };
  }, [f_billCode, txtEANEnabled]);

  /**
   * Matches getLastInventoryBillByWarehouseCode in C#
   */
  const getLastInventoryBillByWarehouseCode = async () => {
    setLoading(true);
    try {
      const serverUrl = gs_BaseURL;
      const res = await inventoryClient.getLastInventoryBillByWarehouseCode(
        serverUrl,
        gs_wareCode,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success && res.data) {
        const vo = res.data;
        if (vo.inventoryStatus === "SCAN") {
          setLblBillCode(vo.billCode || "");
          setLblWarehouseArea(vo.warehouseArea || "");
          setFBillCode(vo.billCode || "");
          setTxtEANEnabled(true);
          setBtnSaveEnabled(true);

          // Get model summary list
          await getInventoryModelList(vo.billCode);

          setTimeout(() => {
            txtEANRef.current?.focus();
          }, 300);
        } else {
          disableScreenState();
        }
      } else {
        disableScreenState();
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network Error");
      disableScreenState();
    } finally {
      setLoading(false);
    }
  };

  const disableScreenState = () => {
    setLblBillCode("");
    setLblWarehouseArea("");
    setFBillCode("");
    setTxtEANEnabled(false);
    setBtnSaveEnabled(false);
    setItems([]);
    setCmbModel([]);
    setSelectedCmbIndex(-1);
    setShowDropdownPicker(false);
  };

  /**
   * Matches getInventoryModelList in C#
   */
  const getInventoryModelList = async (billCode: string) => {
    try {
      const serverUrl = gs_BaseURL;
      const res = await inventoryClient.getInventoryModelList(
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
   * Matches txtModel_KeyDown in C# (Key code 13 / submit)
   */
  const handleEANSubmit = async () => {
    const modelStr = txtEAN.toUpperCase().trim();
    if (!modelStr) return;

    if (f_billCode === "") {
      pubfunction.ShowError("No inventory need Doing,please create!");
      setTxtEAN("");
      setTimeout(() => ensureFocus(), 100);
      return;
    }

    setLoading(true);
    try {
      // 1. Try fetching by EAN
      let searchList = await getModelListByEan(modelStr);
      
      // 2. If empty list returned, try fetching by Model code
      if (!searchList || searchList.length === 0) {
        searchList = await getModelListBymodel(modelStr);
      }

      if (searchList && searchList.length > 0) {
        // Map list to combobox array
        const listMapped: DropdownItem[] = searchList.map((m: any) => ({
          model: m.model || "",
          ean: m.ean || "",
        }));

        setCmbModel(listMapped);
        setSelectedCmbIndex(0); // Select first item by default
        setShowDropdownPicker(true);
        setLastSelectedModel(listMapped[0]);
      } else {
        pubfunction.ShowError("Model/EAN not found in base data.");
        setCmbModel([]);
        setSelectedCmbIndex(-1);
        setShowDropdownPicker(false);
        setLastSelectedModel(null);
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Query Error");
    } finally {
      setLoading(false);
      setTxtEAN("");
      setTimeout(() => ensureFocus(), 150);
    }
  };

  /**
   * Matches getModelListByEan in C#
   */
  const getModelListByEan = async (ean: string): Promise<any[]> => {
    const serverUrl = gs_BaseURL;
    const res = await inventoryClient.getModelListByEan(
      serverUrl,
      ean,
      gs_userCode,
      gs_userName,
      gs_PasswordSalt,
      gs_version
    );
    if (res && res.success) {
      return res.list || [];
    } else {
      if (res && !res.success && res.msg) {
        pubfunction.ShowError(res.msg);
      }
      return [];
    }
  };

  /**
   * Matches getModelListBymodel in C#
   */
  const getModelListBymodel = async (model: string): Promise<any[]> => {
    const serverUrl = gs_BaseURL;
    const res = await inventoryClient.getModelListBymodel(
      serverUrl,
      model,
      gs_userCode,
      gs_userName,
      gs_PasswordSalt,
      gs_version
    );
    if (res && res.success) {
      return res.list || [];
    } else {
      if (res && !res.success && res.msg) {
        pubfunction.ShowError(res.msg);
      }
      return [];
    }
  };

  /**
   * Matches doAddInventoryModelAdd in C#
   */
  const doAddInventoryModelAdd = async (model: string, ean: string) => {
    setLoading(true);
    try {
      const serverUrl = gs_BaseURL;
      const res = await inventoryClient.doAddInventoryModelAdd(
        serverUrl,
        f_billCode,
        model,
        ean,
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
          // Failure enters qty input as per C# comment wqy 2018-12-21

        }
      }
    } catch (err: any) {
    } finally {
      setLoading(false);
    }
  };

  /**
   * Matches btnModel_Click in C# (Save Model & Open Qty Page)
   */
  const handleSaveModelClick = async () => {
    if (!lastSelectedModel) {
      pubfunction.ShowError("Please select a model from the list first!");
      return;
    }

    const model = lastSelectedModel.model;
    const ean = lastSelectedModel.ean;

    // 1. doAddInventoryModelAdd
    await doAddInventoryModelAdd(model, ean);

    // 2. Open Frm_InventoryEANQty as modal dialog (Navigate)
    navigation.navigate("DFCInventoryQty", {
      f_billCode: f_billCode,
      f_model: model,
    });

    // Clear combobox states
    setCmbModel([]);
    setSelectedCmbIndex(-1);
    setShowDropdownPicker(false);
    setLastSelectedModel(null);
  };

  const handleModelSelect = (item: DropdownItem, index: number) => {
    setShowDropdownPicker(false);
    setSelectedCmbIndex(index);
    setLastSelectedModel(item);
  };

  /**
   * Matches btnChoice_Click in C# (Open selected model from list to configure Qty)
   */
  const handleChoiceClick = () => {
    if (selectedRowIndex === -1 || selectedRowIndex >= items.length) {
      pubfunction.ShowError("Please select a model from the list first!");
      return;
    }

    const item = items[selectedRowIndex];
    navigation.navigate("DFCInventoryQty", {
      f_billCode: f_billCode,
      f_model: item.model,
    });
  };

  /**
   * Matches btnCreate_Click in C# (Create New Inventory Bill)
   */
  const handleCreateClick = async () => {
    if (lblBillCode !== "") {
      pubfunction.ShowError("Please Finish or Cancel now Bon,then create New!");
      return;
    }

    const confirm = await pubfunction.ShowConfirm("Are you sure create new Bon?");
    if (!confirm) return;

    // Navigate to Area Selecting screen
    navigation.navigate("DFCInventoryArea");
  };

  /**
   * Create Inventory API Callback called from Area selection event listener
   */
  const doAddInventoryeanBill = async (warehouseArea: string) => {
    setLoading(true);
    try {
      const serverUrl = gs_BaseURL;
      const res = await inventoryClient.doAddInventoryeanBill(
        serverUrl,
        gs_wareCode,
        warehouseArea,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success) {
        // Refresh active bill status
        await getLastInventoryBillByWarehouseCode();
      } else {
        pubfunction.ShowError("Create EAN inventory Error!");
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Failed to create bill");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Matches btnCancel_Click in C#
   */
  const handleCancelClick = async () => {
    if (lblBillCode === "") {
      pubfunction.ShowError("No BON need cancel!");
      return;
    }

    const confirm = await pubfunction.ShowConfirm("Are you sure cancel this Bon?");
    if (!confirm) return;

    setLoading(true);
    try {
      const serverUrl = gs_BaseURL;
      const res = await inventoryClient.doInventoryeanBillStatus(
        serverUrl,
        f_billCode,
        "CANCEL",
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success) {
        disableScreenState();
      } else {
        pubfunction.ShowError("Edit Status Error!");
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Status change failed");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Matches btnFinish_Click in C#
   */
  const handleFinishClick = async () => {
    if (lblBillCode === "") {
      pubfunction.ShowError("No BON need finish!");
      return;
    }

    const confirm = await pubfunction.ShowConfirm("Are you sure finish this Bon?");
    if (!confirm) return;

    setLoading(true);
    try {
      const serverUrl = gs_BaseURL;
      const res = await inventoryClient.doInventoryeanBillStatus(
        serverUrl,
        f_billCode,
        "FINISH",
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success) {
        disableScreenState();
      } else {
        pubfunction.ShowError("Edit Status Error!");
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Status change failed");
    } finally {
      setLoading(false);
    }
  };

  const renderSummaryRow = ({ item, index }: { item: ModelSummaryItem; index: number }) => {
    const isSelected = index === selectedRowIndex;
    return (
      <TouchableOpacity
        style={[
          styles.row,
          { backgroundColor: isSelected ? "#e2f0eeff" : index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }
        ]}
        activeOpacity={0.8}
        onPress={() => setSelectedRowIndex(index)}
      >
        <Text style={[styles.cell, { width: scale(120) }]}>{item.ean}</Text>
        <Text style={[styles.cell, { width: scale(150), textAlign: "left" }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: scale(100) }]}>{item.colorName}</Text>
        <Text style={[styles.cell, { width: scale(80), fontWeight: "900" }]}>{item.scanCount}</Text>
        <Text style={[styles.cell, { width: scale(120) }]}>{item.billCode}</Text>
      </TouchableOpacity>
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
          <Text style={styles.headerTitle}>Inventory EAN NO</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Info Box Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Bill Code</Text>
              <Text style={styles.infoVal}>{lblBillCode || "No Active Bon"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Warehouse Area</Text>
              <Text style={styles.infoVal}>{lblWarehouseArea || "-"}</Text>
            </View>
            <View style={{ flex: 0.6 }}>
              <Text style={styles.infoLabel}>Warehouse</Text>
              <Text style={styles.infoVal}>{gs_wareCode || "-"}</Text>
            </View>
          </View>
        </View>

        {/* Barcode/EAN Input panel (no card) */}
        <TextInput
          ref={txtEANRef}
          style={[styles.textInput, !txtEANEnabled && { backgroundColor: "#E2E8F0", color: "#64748B" }, { marginBottom: 6 }]}
          value={txtEAN}
          onChangeText={setTxtEAN}
          onSubmitEditing={handleEANSubmit}
          placeholder={txtEANEnabled ? " SCAN EAN BARCODE / MODEL" : " NO ACTIVE INVENTORY BILL"}
          placeholderTextColor="#64748B"
          autoCapitalize="characters"
          editable={txtEANEnabled}
          blurOnSubmit={false}
          multiline={false}
          numberOfLines={1}
          scrollEnabled={false}
          onBlur={ensureFocus}
          selectTextOnFocus={true}
        />

        {/* Always Visible Dropdown Selector with Save button */}
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
                ? `${lastSelectedModel.model}` 
                : cmbModel.length > 0 
                  ? `Choose (${cmbModel.length})...` 
                  : "Choose Model"}
            </Text>
            <Text style={styles.comboChevron}>▼</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.inlineSaveBtn, !btnSaveEnabled && { backgroundColor: "#CBD5E1" }]}
            disabled={!btnSaveEnabled}
            onPress={handleSaveModelClick}
            activeOpacity={0.7}
          >
            <Text style={styles.inlineSaveBtnText}>INPUT QTY</Text>
          </TouchableOpacity>
        </View>
        
        {/* Dropdown ComboBox selection Modal */}
        {showDropdownPicker && cmbModel.length > 0 && (
          <Modal visible={showDropdownPicker} transparent animationType="fade">
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowDropdownPicker(false)}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Choose Model</Text>
                <FlatList
                  data={cmbModel}
                  keyExtractor={(item, index) => `${item.model}-${index}`}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={() => handleModelSelect(item, index)}
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

        {/* Table summary view list */}
        <View style={styles.listCard}>
          <ScrollView horizontal contentContainerStyle={{ flexDirection: "column", flexGrow: 1 }}>
            <View style={{ width: scale(570), flex: 1 }}>
              <View style={styles.listHeader}>
                <Text style={[styles.headerCell, { width: scale(120) }]}>EAN</Text>
                <Text style={[styles.headerCell, { width: scale(150), textAlign: "left" }]}>MODEL</Text>
                <Text style={[styles.headerCell, { width: scale(100) }]}>COLOR</Text>
                <Text style={[styles.headerCell, { width: scale(80) }]}>COUNT</Text>
                <Text style={[styles.headerCell, { width: scale(120) }]}>BILL CODE</Text>
              </View>

              <FlatList
                data={items}
                style={{ flex: 1 }}
                renderItem={renderSummaryRow}
                keyExtractor={(item, index) => `${item.ean}-${index}`}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No model scan records.</Text>
                }
              />
            </View>
          </ScrollView>
        </View>

        {/* Choice Button placed directly under table */}
        <TouchableOpacity
          style={styles.choiceBtn}
          onPress={handleChoiceClick}
          activeOpacity={0.7}
        >
          <Text style={styles.choiceBtnText}>Choice</Text>
        </TouchableOpacity>

        {/* The remaining 3 buttons below Choice button */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: "#10B981" }]}
            onPress={handleCreateClick}
            activeOpacity={0.7}
          >
            <Text style={styles.controlBtnText}>Create Bon</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: "#EF4444" }]}
            onPress={handleCancelClick}
            activeOpacity={0.7}
          >
            <Text style={styles.controlBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: "#0052cc" }]}
            onPress={handleFinishClick}
            activeOpacity={0.7}
          >
            <Text style={styles.controlBtnText}>Finish</Text>
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
    backgroundColor: "#0052cc",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#003d99",
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoLabel: { fontSize: 10, fontWeight: "800", color: "rgba(255, 255, 255, 0.85)" },
  infoVal: { fontSize: 11, fontWeight: "900", color: "#FFFFFF" },
  textInput: {
    backgroundColor: "#e2f0eeff",
    height: scale(36),
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: 13,
    color: "#1E293B",
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#0052cc",
    textAlignVertical: "center",
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
    borderColor: "#0052cc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  inlineSaveBtn: {
    backgroundColor: "#0052cc",
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
    color: "#0052cc",
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
    color: "#0052cc",
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
  choiceBtn: {
    backgroundColor: "#0284C7",
    height: scale(38),
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  choiceBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
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
    marginHorizontal: 2,
    elevation: 2,
  },
  controlBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
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
