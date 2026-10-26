import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
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
import * as allocateOutClient from "./allocateOutNONewSapClient";

interface SumItem {
  id: string;
  scanBarCode: string;
  palletCode: string;
  model: string;
  color: string;
  imei1: string;
  imei2: string;
  imei3: string;
  scanBarCodeType: string;
  goodsCount: string;
  boxCode: string;
}

// Délai anti-rebond du scanner (même EAN reçu 2 fois très vite = ignoré)
const SCAN_DEDUP_MS = 800;
// Délai d'auto-validation quand le scanner n'envoie pas "Enter"
const AUTO_SUBMIT_MS = 500;

const normalize = (s: any) => String(s ?? "").toUpperCase().trim();

export default function AllocateOutSNConfirmBoxNew({ navigation, route }: any) {
  const {
    f_barCode,
    f_scanType,
    f_model,
    f_modeEAN,
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
    gs_remark,
    
    gs_classCode,
    gs_factoryindex,
} = useGlobalStr();

    const styles = createStyles(gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc");

  const [items, setItems] = useState<SumItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [qtyTotalText, setQtyTotalText] = useState("");
  const [qtyTotal, setQtyTotal] = useState(0);
  const [showEAN, setShowEAN] = useState(false);
  const [txtEAN, setTxtEAN] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);

  const txtEANRef = useRef<TextInput>(null);
  const scanTimerRef = useRef<any>(null);

  // ---------- Protections anti double scan / double émission ----------
  // Vrai pendant l'appel API doAddInventoryOldSNAdd : tout nouveau scan EAN est ignoré
  const eanBusyRef = useRef(false);
  // Vrai dès que le résultat a été envoyé à l'écran parent (ON_ALLOCATEOUT_CONFIRM_OK).
  // Garantit qu'on n'émet JAMAIS deux fois pour le même code (EAN puis bouton Confirm,
  // double clic sur Confirm, etc.)
  const doneRef = useRef(false);
  // Vrai dès que navigation.goBack() a été déclenché : évite de dépiler 2 écrans
  const leavingRef = useRef(false);
  // Dernier EAN accepté (anti-rebond)
  const lastEanRef = useRef<{ code: string; ts: number }>({ code: "", ts: 0 });
  // Évite le double chargement initial (ex: StrictMode / remontage)
  const loadedRef = useRef(false);
  // Évite les setState après démontage de l'écran
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!loadedRef.current) {
      loadedRef.current = true;
      boxListShow();
    }
    return () => {
      mountedRef.current = false;
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, []);

  const clearScanTimer = () => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  };

  const clearEanInput = () => {
    setTxtEAN("");
    txtEANRef.current?.clear();
  };

  // goBack protégé : un seul retour possible, même en cas de double clic / double événement
  const goBackOnce = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    navigation.goBack();
  };

  // Émission protégée : un seul ON_ALLOCATEOUT_CONFIRM_OK par ouverture de l'écran
  const emitConfirmOk = (): boolean => {
    if (doneRef.current) return false;
    doneRef.current = true;
    DeviceEventEmitter.emit("ON_ALLOCATEOUT_CONFIRM_OK", {
      barCode: f_barCode,
      scanType: f_scanType,
    });
    return true;
  };

  const boxListShow = async () => {
    setLoading(true);
    try {
      const res = await allocateOutClient.getScanBarCodeSumInfo(
        gs_BaseURL,
        f_barCode,
        f_scanType,
        f_model,
        gs_wareCode,
        f_guid,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (!mountedRef.current) return;

      let isListEmpty = true;
      if (res && res.success && res.list) {
        const listObj = typeof res.list === "string" ? JSON.parse(res.list) : res.list;
        if (listObj.length > 0) {
          isListEmpty = false;
          let qtyAll = 0;
          const mappedItems: SumItem[] = listObj.map((item: any, index: number) => {
            qtyAll += parseInt(item.goodsCount || "0", 10);
            return {
              id: `${item.scanBarCode}-${index}`,
              scanBarCode: item.scanBarCode || "",
              palletCode: item.palletCode || "",
              model: item.model || "",
              color: item.color || "",
              imei1: item.imei1 || "",
              imei2: item.imei2 || "",
              imei3: item.imei3 || "",
              scanBarCodeType: item.scanBarCodeType || "",
              goodsCount: item.goodsCount || "",
              boxCode: item.boxCode || "",
            };
          });
          setItems(mappedItems);
          setQtyTotal(qtyAll);
          setQtyTotalText("");
        }
      }

      if (isListEmpty) {
        setShowEAN(true);
        setQtyTotalText(`This SN ${f_barCode} not exist: Already delivery or Already AllocateOut not in warehouse!`);
        setTimeout(() => {
          txtEANRef.current?.focus();
        }, 150);
      } else {
        setShowEAN(false);
      }

    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network Error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // ---------- Point d'entrée UNIQUE pour tout scan EAN (Enter ou auto-validation) ----------
  const processEAN = async (raw: string) => {
    const EAN = normalize(raw);
    if (!EAN) return;

    // 1) Verrou : un appel est en cours, ou le résultat est déjà parti, ou on quitte l'écran
    if (eanBusyRef.current || doneRef.current || leavingRef.current) {
      clearEanInput();
      return;
    }

    // 2) Anti-rebond : même EAN reçu 2 fois d'affilée (Enter + timer, double déclenchement)
    const now = Date.now();
    if (lastEanRef.current.code === EAN && now - lastEanRef.current.ts < SCAN_DEDUP_MS) {
      clearEanInput();
      return;
    }
    lastEanRef.current = { code: EAN, ts: now };

    // 3) Permission
    if ((gs_remark || "").toUpperCase() !== "EAN") {
      pubfunction.ShowError("You don't have permission to scan EAN!");
      clearEanInput();
      return;
    }

    // 4) EAN incorrect
    if (EAN !== normalize(f_modeEAN)) {
      setQtyTotalText(`EAN error, Ok is: ${f_modeEAN}`);
      clearEanInput();
      return;
    }

    // 5) Scan accepté : on pose le verrou AVANT l'appel API (de façon synchrone)
    eanBusyRef.current = true;
    clearEanInput();
    setLoading(true);

    try {
      const oldSNIsOk = await allocateOutClient.doAddInventoryOldSNAdd(
        gs_BaseURL,
        f_barCode,
        EAN,
        f_model,
        gs_wareCode,
        gs_classCode,
        f_brand,
        f_guid,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (oldSNIsOk && oldSNIsOk.success) {
        // Un seul événement vers le parent, un seul goBack
        emitConfirmOk();
        goBackOnce();
      } else if (mountedRef.current) {
        setQtyTotalText(oldSNIsOk?.msg || "doAddInventoryOldSNAdd error!");
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setQtyTotalText(err?.message || "doAddInventoryOldSNAdd error!");
      }
    } finally {
      eanBusyRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setTxtEAN("");
      }
    }
  };

  const handleEANSubmit = (e?: any) => {
    clearScanTimer();
    let EAN = txtEAN;
    if (e && e.nativeEvent && e.nativeEvent.text !== undefined) {
      EAN = e.nativeEvent.text;
    }
    processEAN(EAN);
  };

  const handleEANTextChange = (text: string) => {
    // Pendant un traitement, on vide le champ et on ignore les caractères reçus
    if (eanBusyRef.current || doneRef.current || leavingRef.current) {
      clearScanTimer();
      setTxtEAN("");
      return;
    }

    setTxtEAN(text);
    clearScanTimer();
    scanTimerRef.current = setTimeout(() => {
      scanTimerRef.current = null;
      processEAN(text);
    }, AUTO_SUBMIT_MS);
  };

  const handleConfirmClick = () => {
    // Ignore les clics pendant l'appel EAN ou si on est déjà en train de quitter
    if (eanBusyRef.current || leavingRef.current) return;
    if (items.length >= 1) {
      emitConfirmOk();
    }
    goBackOnce();
  };

  const handleBackClick = () => {
    if (eanBusyRef.current) return;
    goBackOnce();
  };

  const renderItem = ({ item, index }: { item: SumItem; index: number }) => (
    <View style={[styles.row, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }]}>
      <Text style={[styles.cell, { width: 140 }]}>{item.scanBarCode}</Text>
      <Text style={[styles.cell, { width: 140 }]}>{item.palletCode}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
      <Text style={[styles.cell, { width: 80 }]}>{item.color}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.imei1}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.imei2}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.imei3}</Text>
      <Text style={[styles.cell, { width: 80 }]}>{item.scanBarCodeType}</Text>
      <Text style={[styles.cell, { width: 60 }]}>{item.goodsCount}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.boxCode}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleBackClick} activeOpacity={0.7}>
            <Image source={require("../../assets/logo/left.png")} style={styles.returnLogo} resizeMode="contain" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Allocate Out Confirm</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.infoRowContainer}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Model</Text>
            <Text style={styles.infoValue}>{f_model || "-"}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>EAN</Text>
            <Text style={styles.infoValue}>{f_modeEAN || "-"}</Text>
          </View>
        </View>

        {!!qtyTotalText && (
          <View style={styles.statusLabelCard}>
            <Text style={[styles.statusLabelText, showEAN && { color: 'red' }]}>{qtyTotalText}</Text>
          </View>
        )}

        {showEAN && (
          <View style={{ marginBottom: 8 }}>
            <View style={styles.inputGroup}>
              <TextInput
                ref={txtEANRef}
                style={styles.input}
                value={txtEAN}
                onChangeText={handleEANTextChange}
                onSubmitEditing={handleEANSubmit}
                placeholder=" SCAN EAN"
                placeholderTextColor="#64748B"
                autoCapitalize="characters"
                selectTextOnFocus={true}
                showSoftInputOnFocus={showKeyboard}
                blurOnSubmit={false}
              />
            </View>
          </View>
        )}



        <View style={styles.listCard}>
          <ScrollView horizontal>
            <View>
              <View style={styles.listHeader}>
                <Text style={[styles.headerCell, { width: 140 }]}>BARCODE</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>PALLET</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>MODEL</Text>
                <Text style={[styles.headerCell, { width: 80 }]}>COLOR</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI1</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI2</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI3</Text>
                <Text style={[styles.headerCell, { width: 80 }]}>TYPE</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>QTY</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>BOX CODE</Text>
              </View>
              <FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                ListEmptyComponent={
                  <View style={{ width: 1100 }}>
                    <Text style={styles.emptyText}>No items found.</Text>
                  </View>
                }
              />
            </View>
          </ScrollView>
          <View style={styles.totalRow}>
            <Text style={styles.totalRowText}>Total Qty: {qtyTotal}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, styles.confirmBtn]}
            onPress={handleConfirmClick}
            disabled={loading}
          >
            <Text style={styles.btnText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc"} />
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
  infoRowContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  infoBlock: {
    flex: 1,
    backgroundColor: factoryColor,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { fontSize: 12, fontWeight: "700", color: "rgba(255, 255, 255, 0.85)", textAlign: "center" },
  infoValue: { fontSize: 13, fontWeight: "900", color: "#FFFFFF", marginTop: 2, textAlign: "center" },
  inputGroup: { marginTop: 4 },
  input: {
    backgroundColor: "#e2f0eeff",
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
    borderColor: factoryColor,
    borderWidth: 1
  },
  statusLabelCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F59E0B",
    marginBottom: 8,
    alignItems: "center",
  },
  statusLabelText: { color: factoryColor, fontSize: 10, fontWeight: "900", textAlign: 'center' },
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
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 4,
  },
  btn: {
    height: 45,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    flex: 1,
  },
  confirmBtn: { backgroundColor: factoryColor },
  btnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  totalRow: {
    padding: 10,
    backgroundColor: "#F1F5F9",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    alignItems: "center",
  },
  totalRowText: {
    fontSize: 13,
    fontWeight: "900",
    color: factoryColor,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});