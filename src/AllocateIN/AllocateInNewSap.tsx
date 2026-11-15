import React, { useState, useRef, useEffect } from "react";
import {
  SafeAreaView } from "react-native-safe-area-context";
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
import * as allocateInClient from "./allocateInNONewSapClient";

// Même code scanné dans cet intervalle = ignoré
const DUPLICATE_WINDOW_MS = 2000;
// Même insertion (code + type) dans cet intervalle = ignorée
const INSERT_DUPLICATE_WINDOW_MS = 3000;
// Si la navigation n'a pas eu lieu, on libère le verrou après ce délai
const NAV_LOCK_FAILSAFE_MS = 1500;

interface ItemVO {
  id: string;
  scanBarCode: string;
  model: string;
  color: string;
  goodsCount: string;
  scanBarCodeType: string;
}

export default function AllocateInNewSap({ navigation, route }: any) {
  const {
    f_deliveryCode,
    f_systemDeliveryCode,
    f_model,
    f_fromck,
    f_sapMainBillCode,
    f_guid,
    f_brand
  } = route.params || {};

  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
    gs_classCode,
    
    gs_IPAddress,
    gs_factoryindex,
} = useGlobalStr();

  const styles = createStyles(gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc");

  const [txtSN, setTxtSN] = useState("");
  const [items, setItems] = useState<ItemVO[]>([]);
  const [qtyTotal, setQtyTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [txtSource, setTxtSource] = useState("");
  const [txtQty, setTxtQty] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);

  const txtSNRef = useRef<TextInput>(null);
  const scanTimerRef = useRef<any>(null);

  // Protections anti double scan / double insertion
  const isScanning = useRef(false);
  const dealing = useRef(false);
  const listLoading = useRef(false);
  const lastScan = useRef<{ code: string; time: number }>({ code: "", time: 0 });
  const lastInsert = useRef<{ key: string; time: number }>({ key: "", time: 0 });
  const lockTimer = useRef<any>(null);
  const itemsRef = useRef<ItemVO[]>([]);

  // Toujours la dernière liste, même depuis un timer ou un listener
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (f_systemDeliveryCode) {
      getListFinishBoxList();
    }

    const confirmSub = DeviceEventEmitter.addListener("ON_ALLOCATEIN_CONFIRM_OK", (data: any) => {
       if (!data?.barCode) return;
       palletDeal(data.barCode, data.scanType);
    });

    const focusSub = navigation.addListener("focus", () => {
      // Retour sur l'écran : on libère le verrou de scan
      clearTimeout(lockTimer.current);
      isScanning.current = false;
      setTimeout(() => {
        txtSNRef.current?.focus();
      }, 150);
    });

    const interval = setInterval(() => {
      if (navigation.isFocused() && txtSNRef.current && !txtSNRef.current.isFocused()) {
        txtSNRef.current.focus();
      }
    }, 1000);

    return () => {
      confirmSub.remove();
      focusSub();
      clearInterval(interval);
      clearTimeout(lockTimer.current);
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
      }
    };
  }, []);

  const getListFinishBoxList = async () => {
    listLoading.current = true;
    setLoading(true);
    try {
      setTxtSource(`${gs_wareCode}#${f_fromck}`);
      const res = await allocateInClient.getReceiptInfoByOperatorBatch(
        gs_BaseURL,
        f_systemDeliveryCode,
        f_model,
        f_deliveryCode,
        f_guid,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );
      console.log("getListFinishBoxList response:", res)

      if (res && res.success && res.list) {
        const listObj = typeof res.list === "string" ? JSON.parse(res.list) : res.list;
        let tQty = 0;
        const mappedItems: ItemVO[] = listObj.map((item: any, index: number) => {
          tQty += parseInt(item.goodsCount || "0", 10);
          return {
            id: `${item.scanBarCode}-${index}`,
            scanBarCode: item.scanBarCode || "",
            model: item.model || "",
            color: item.color || "",
            goodsCount: item.goodsCount || "",
            scanBarCodeType: item.scanBarCodeType || ""
          };
        });
        setItems(mappedItems);
        setQtyTotal(tQty);
      } else {
         if (res && !res.success) {
            pubfunction.ShowError(res.msg);
         }
      }
    } catch (err: any) {
      pubfunction.ShowError(err?.message || "Network Error");
    } finally {
      listLoading.current = false;
      setLoading(false);
    }
  };

  // Sécurité : si la navigation n'a pas abouti, on ne reste pas bloqué
  const armLockFailsafe = () => {
    clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      if (navigation.isFocused()) {
        isScanning.current = false;
      }
    }, NAV_LOCK_FAILSAFE_MS);
  };

  // Point d'entrée unique pour un scan (timer ou submit)
  const submitBarcode = (raw: string) => {
    const SN = raw.toUpperCase().trim();

    // On vide toujours l'input, même si le scan est ignoré ensuite,
    // pour que le scan suivant ne soit jamais concaténé à l'ancien.
    setTxtSN("");

    if (!SN) return;

    // Scan déjà en cours, insertion en cours ou liste pas encore chargée
    if (isScanning.current || dealing.current || listLoading.current) return;

    // Écran en arrière-plan (confirmation ouverte) : on ignore
    if (!navigation.isFocused()) return;

    // Anti-doublon : même code dans les 2 secondes = ignoré
    const now = Date.now();
    if (
      lastScan.current.code === SN &&
      now - lastScan.current.time < DUPLICATE_WINDOW_MS
    ) {
      return;
    }
    lastScan.current = { code: SN, time: now };

    const isAlreadyScanned = itemsRef.current.some(
      item => item.scanBarCode && item.scanBarCode.toUpperCase() === SN
    );
    if (isAlreadyScanned) {
      pubfunction.ShowError(SN + "  This barcode has already been scanned!");
      setTimeout(() => { txtSNRef.current?.focus(); }, 150);
      return;
    }

    const scanType = pubfunction.getBarcodeType(SN);

    // Verrou actif jusqu'au retour sur l'écran (libéré par le listener "focus")
    isScanning.current = true;
    armLockFailsafe();
    navigation.navigate("AllocateInSNConfirmBoxNew", {
       f_systemDeliveryCode: f_systemDeliveryCode,
       f_barCode: SN,
       f_scanType: scanType,
       f_model: f_model,
       f_fromck: f_fromck,
       f_guid: f_guid,
       f_brand: f_brand
    });
  };

  const handleSNSubmit = () => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }
    submitBarcode(txtSN);
  };

  const handleTextChange = (text: string) => {
    setTxtSN(text);
    console.log("text", text);

    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    scanTimerRef.current = setTimeout(() => {
      submitBarcode(trimmed);
    }, 300);
  };

  const palletDeal = async (barCode: string, scanType: string) => {
    if (!barCode) return;

    // Une insertion est déjà en cours
    if (dealing.current) return;

    // Même insertion déjà faite à l'instant (ex : événement émis deux fois)
    const key = `${barCode}|${scanType}`;
    const now = Date.now();
    if (
      lastInsert.current.key === key &&
      now - lastInsert.current.time < INSERT_DUPLICATE_WINDOW_MS
    ) {
      return;
    }
    lastInsert.current = { key, time: now };
    dealing.current = true;

    setLoading(true);
    let success = false;
    try {
      const res = await allocateInClient.doAllocateWarehouseInStorage(
        gs_BaseURL,
        f_systemDeliveryCode,
        gs_wareCode,
        barCode,
        scanType,
        f_model,
        f_deliveryCode,
        gs_classCode,
        gs_IPAddress,
        f_sapMainBillCode,
        f_guid,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      success = !!(res && res.success);

      if (res && res.success && res.data) {
        const vo = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
        const jihuaQty = parseInt(vo.receiptCount?.hasDeliveryCount || "0", 10);
        const shijiQty = parseInt(vo.receiptCount?.allReceiptCount || "0", 10);

        setTxtSource(`${gs_wareCode}#${f_fromck}`);
        setTxtQty(`${shijiQty}/${jihuaQty}`);

        if (shijiQty >= jihuaQty) {
           pubfunction.ShowError("The allocate of documents has already shipped completed!");
           navigation.goBack();
           return;
        }

        let tQty = 0;
        const mappedItems: ItemVO[] = (vo.warehouseSumByScanBarCodeList || []).map((item: any, index: number) => {
          tQty += parseInt(item.goodsCount || "0", 10);
          return {
            id: `${item.scanBarCode}-${index}`,
            scanBarCode: item.scanBarCode || "",
            model: item.model || "",
            color: item.color || "",
            goodsCount: item.goodsCount || "",
            scanBarCodeType: item.scanBarCodeType || ""
          };
        });
        setItems(mappedItems);
        setQtyTotal(tQty);

      } else {
        if (res && !res.success) {
           pubfunction.ShowError(res.msg);
        }
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network Error");
    } finally {
      dealing.current = false;
      // En cas d'échec, on autorise un nouvel essai immédiat
      if (!success) lastInsert.current.time = 0;
      setLoading(false);
      setTimeout(() => { txtSNRef.current?.focus(); }, 150);
    }
  };

  const renderItem = ({ item, index }: { item: ItemVO; index: number }) => (
    <View style={[styles.row, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }]}>
       <Text style={[styles.cell, { width: 140 }]}>{item.scanBarCode}</Text>
       <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
       <Text style={[styles.cell, { width: 80 }]}>{item.color}</Text>
       <Text style={[styles.cell, { width: 60 }]}>{item.goodsCount}</Text>
       <Text style={[styles.cell, { width: 60 }]}>{item.scanBarCodeType}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Image source={require("../../assets/logo/left.png")} style={styles.returnLogo} resizeMode="contain" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Allocate In New {gs_wareCode}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Source</Text><Text style={styles.infoValue}>{txtSource}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Qty</Text><Text style={styles.infoValue}>{txtQty}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Total</Text><Text style={styles.infoValue}>{qtyTotal}</Text></View>
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            ref={txtSNRef}
            style={styles.input}
            value={txtSN}
            onChangeText={handleTextChange}
            //onSubmitEditing={handleSNSubmit}
            placeholder=" SCAN BARCODE"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            autoFocus={true}
            selectTextOnFocus={true}
            showSoftInputOnFocus={showKeyboard}
            blurOnSubmit={false}
            onBlur={() => {
              if (navigation.isFocused()) {
                setTimeout(() => {
                  txtSNRef.current?.focus();
                }, 100);
              }
            }}
          />
        </View>

        <View style={styles.listCard}>
          <ScrollView horizontal>
            <View>
              <View style={styles.listHeader}>
                 <Text style={[styles.headerCell, { width: 140 }]}>BARCODE</Text>
                 <Text style={[styles.headerCell, { width: 120 }]}>MODEL</Text>
                 <Text style={[styles.headerCell, { width: 80 }]}>COLOR</Text>
                 <Text style={[styles.headerCell, { width: 60 }]}>QTY</Text>
                 <Text style={[styles.headerCell, { width: 60 }]}>TYPE</Text>
              </View>
              <FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                ListEmptyComponent={<View style={{ width: 460 }}><Text style={styles.emptyText}>No items found.</Text></View>}
              />
            </View>
          </ScrollView>
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
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: factoryColor,
  },
  infoRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    marginBottom: 6,
    backgroundColor: factoryColor,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  infoLabel: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  infoValue: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },
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
    borderColor: factoryColor,
  },
  statusLabelCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 8,
    alignItems: "center",
  },
  statusLabelText: { color: factoryColor, fontSize: 13, fontWeight: "900" },
  listCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 8,
  },
  listHeader: {
    flexDirection: "row",
    backgroundColor: factoryColor,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    paddingHorizontal: 2,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  cell: { fontSize: 11, textAlign: "center", fontWeight: "600", paddingHorizontal: 2, color: "#1E293B" },
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});