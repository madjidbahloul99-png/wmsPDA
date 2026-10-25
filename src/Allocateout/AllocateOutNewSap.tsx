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

interface ItemVO {
  id: string;
  scanBarCode: string;
  model: string;
  color: string;
  goodsCount: string;
  scanBarCodeType: string;
}

// Délai anti-rebond du scanner (même code scanné 2 fois très vite = ignoré)
const SCAN_DEDUP_MS = 800;
// Délai avant de relâcher le verrou quand on revient de l'écran de confirmation
const RELEASE_DELAY_MS = 500;
// Délai d'auto-validation quand le scanner n'envoie pas "Enter"
const AUTO_SUBMIT_MS = 500;

const normalize = (s: any) => String(s ?? "").toUpperCase().trim();

export default function AllocateOutNewSap({ navigation, route }: any) {
  const {
    f_deliveryCode,
    f_systemDeliveryCode,
    f_model,
    f_tock,
    f_sapMainBillCode,
    f_guid,
    f_brand,
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
  } = useGlobalStr();

  const [txtSN, setTxtSN] = useState("");
  const [f_modeEAN, setF_modeEAN] = useState("");
  const [items, setItems] = useState<ItemVO[]>([]);
  const [qtyTotal, setQtyTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [txtSource, setTxtSource] = useState("");
  const [txtQty, setTxtQty] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);

  const txtSNRef = useRef<TextInput>(null);
  const scanTimerRef = useRef<any>(null);
  const releaseTimerRef = useRef<any>(null);

  // ---------- Protections anti double scan / double insert ----------
  // Verrou global : vrai dès qu'un scan est accepté (écran de confirmation ouvert
  // ou appel API en cours). Tant qu'il est vrai, tout nouveau scan est ignoré.
  const busyRef = useRef(false);
  // Vrai uniquement pendant l'appel API d'insertion
  const apiRunningRef = useRef(false);
  // Code envoyé à l'écran de confirmation par CETTE instance (sert à valider
  // l'événement de retour et à ignorer les événements en double)
  const pendingScanRef = useRef<string | null>(null);
  // Codes déjà envoyés au serveur (ou en cours d'envoi) pendant cette session d'écran
  const submittedRef = useRef<Set<string>>(new Set());
  // Dernier scan accepté (anti-rebond)
  const lastScanRef = useRef<{ code: string; ts: number }>({ code: "", ts: 0 });
  // Copie toujours à jour de la liste (évite les closures périmées dans les timers)
  const itemsRef = useRef<ItemVO[]>([]);
  // Référence vers la dernière version de palletDeal (le listener est créé une seule fois)
  const palletDealRef = useRef<(barCode: string, scanType: string) => Promise<void>>(
    async () => {}
  );

  const updateItems = (list: ItemVO[]) => {
    itemsRef.current = list;
    setItems(list);
  };

  const refocus = (delay = 150) => {
    setTimeout(() => {
      txtSNRef.current?.focus();
    }, delay);
  };

  const clearInput = () => {
    setTxtSN("");
    txtSNRef.current?.clear();
  };

  useEffect(() => {
    getModelEAN();
    if (f_systemDeliveryCode) {
      getListFinishBoxList();
    }

    const confirmSub = DeviceEventEmitter.addListener("ON_ALLOCATEOUT_CONFIRM_OK", (data: any) => {
      const code = normalize(data?.barCode);
      if (!code) return;

      // Cet écran n'a lancé aucune confirmation (ou événement déjà traité) -> on ignore.
      // Évite aussi le double traitement si deux instances de l'écran sont dans la pile.
      if (pendingScanRef.current === null) {
        console.log("CONFIRM_OK ignoré (aucun scan en attente)", code);
        return;
      }
      if (pendingScanRef.current !== code) {
        console.log("CONFIRM_OK ignoré (code différent du scan en attente)", code);
        return;
      }
      // Déjà envoyé / en cours d'envoi -> on ignore
      if (apiRunningRef.current || submittedRef.current.has(code)) {
        console.log("CONFIRM_OK ignoré (déjà en cours ou déjà envoyé)", code);
        return;
      }

      // On consomme le scan en attente : un 2e événement identique sera ignoré
      pendingScanRef.current = null;
      palletDealRef.current(data.barCode, data.scanType);
    });

    const focusSub = navigation.addListener("focus", () => {
      refocus(150);

      // Retour de l'écran de confirmation : on relâche le verrou après un court délai
      // (laisse le temps à l'événement CONFIRM_OK d'arriver), sauf si l'API tourne.
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = setTimeout(() => {
        releaseTimerRef.current = null;
        if (!apiRunningRef.current) {
          busyRef.current = false;
        }
      }, RELEASE_DELAY_MS);
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
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    };
  }, []);

  const getListFinishBoxList = async () => {
    setLoading(true);
    try {
      setTxtSource(`${f_tock}#${gs_wareCode}`);
      const res = await allocateOutClient.getDeliveryInfoByOperatorBatch(
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

      console.log("getDeliveryInfoByOperatorBatch", res);

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
            scanBarCodeType: item.scanBarCodeType || "",
          };
        });
        updateItems(mappedItems);
        setQtyTotal(tQty);
      } else {
        if (res && !res.success) {
          pubfunction.ShowError(res.msg);
        }
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network Error");
    } finally {
      setLoading(false);
    }
  };

  const getModelEAN = async () => {
    try {
      const res = await allocateOutClient.getListByCondition(
        gs_BaseURL,
        f_model,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      console.log("getListByCondition", res);
      if (res && res.success && res.list) {
        const listObj = typeof res.list === "string" ? JSON.parse(res.list) : res.list;
        if (listObj.length > 0 && listObj[0].ean) {
          setF_modeEAN(listObj[0].ean.toUpperCase());
          return;
        }
      }
      setF_modeEAN("ean Error");
    } catch (err) {
      setF_modeEAN("ean Error");
    }
  };

  // ---------- Point d'entrée UNIQUE pour tout scan (Enter ou auto-validation) ----------
  const processScan = (raw: string) => {
    const SN = normalize(raw);
    if (!SN) return;

    // 1) Verrou : un scan est déjà en cours de traitement -> on ignore
    if (busyRef.current || apiRunningRef.current) {
      clearInput();
      return;
    }

    // 2) Anti-rebond : même code reçu 2 fois d'affilée (Enter + timer, double déclenchement)
    const now = Date.now();
    if (lastScanRef.current.code === SN && now - lastScanRef.current.ts < SCAN_DEDUP_MS) {
      clearInput();
      return;
    }

    // 3) Les EAN (613...) ne sont pas acceptés
    if (SN.startsWith("613")) {
      pubfunction.ShowError("Please scan SN/BOX/PALLET, this is EAN(starts with 613)!");
      clearInput();
      refocus();
      return;
    }

    // 4) Déjà scanné : présent dans la liste OU déjà envoyé au serveur
    const isAlreadyScanned =
      submittedRef.current.has(SN) ||
      itemsRef.current.some((item) => item.scanBarCode && normalize(item.scanBarCode) === SN);
    if (isAlreadyScanned) {
      pubfunction.ShowError(SN + "  This barcode has already been scanned!");
      clearInput();
      refocus();
      return;
    }

    // 5) Scan accepté : on pose le verrou AVANT de naviguer (de façon synchrone)
    busyRef.current = true;
    pendingScanRef.current = SN;
    lastScanRef.current = { code: SN, ts: now };
    clearInput();

    const scanType = pubfunction.getBarcodeType(SN);
    navigation.navigate("AllocateOutSNConfirmBoxNew", {
      f_barCode: SN,
      f_scanType: scanType,
      f_model: f_model,
      f_modeEAN: f_modeEAN,
      f_guid: f_guid,
      f_brand: f_brand,
    });
  };

  const handleSNSubmit = (e?: any) => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    let SN = txtSN;
    if (e && e.nativeEvent && e.nativeEvent.text !== undefined) {
      SN = e.nativeEvent.text;
    }
    processScan(SN);
  };

  const handleTextChange = (text: string) => {
    // Pendant un traitement, on vide le champ et on ignore les caractères reçus
    if (busyRef.current || apiRunningRef.current) {
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
      setTxtSN("");
      return;
    }

    setTxtSN(text);
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }
    scanTimerRef.current = setTimeout(() => {
      scanTimerRef.current = null;
      processScan(text);
    }, AUTO_SUBMIT_MS);
  };

  const palletDeal = async (barCode: string, scanType: string) => {
    const key = normalize(barCode);

    // Garde-fous : jamais deux insertions en parallèle, jamais deux fois le même code
    if (apiRunningRef.current) return;
    if (submittedRef.current.has(key)) return;

    apiRunningRef.current = true;
    busyRef.current = true;
    submittedRef.current.add(key);

    setLoading(true);
    let needResync = false;

    try {
      const res = await allocateOutClient.doAllocateWarehouseOutStorage(
        gs_BaseURL,
        f_systemDeliveryCode,
        gs_wareCode,
        f_tock,
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

      if (res && res.success && res.data) {
        const vo = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
        const jihuaQty = parseInt(vo.deliveryCount?.currentBillCount || "0", 10);
        const shijiQty = parseInt(vo.deliveryCount?.allDeliveryCount || "0", 10);

        setTxtSource(`${f_tock}#${gs_wareCode}`);
        setTxtQty(`${shijiQty}/${jihuaQty}`);

        if (shijiQty >= jihuaQty) {
          pubfunction.ShowError("The allocate of documents has already shipped completed!");
          navigation.goBack();
          return;
        }

        let tQty = 0;
        const mappedItems: ItemVO[] = (vo.warehouseSumByScanBarCodeList || []).map(
          (item: any, index: number) => {
            tQty += parseInt(item.goodsCount || "0", 10);
            return {
              id: `${item.scanBarCode}-${index}`,
              scanBarCode: item.scanBarCode || "",
              model: item.model || "",
              color: item.color || "",
              goodsCount: item.goodsCount || "",
              scanBarCodeType: item.scanBarCodeType || "",
            };
          }
        );
        updateItems(mappedItems);
        setQtyTotal(tQty);
      } else if (res && res.success) {
        // Inséré côté serveur mais sans données de retour : on recharge la liste
        needResync = true;
      } else {
        // Refus explicite du serveur : rien n'a été inséré, on autorise un nouvel essai
        submittedRef.current.delete(key);
        if (res) {
          pubfunction.ShowError(res.msg);
        }
      }
    } catch (err: any) {
      // Erreur réseau / timeout : on ne sait pas si le serveur a inséré ou non.
      // On recharge la liste depuis le serveur pour avoir l'état réel avant tout nouveau scan.
      submittedRef.current.delete(key);
      needResync = true;
      pubfunction.ShowError(err.message || "Network Error");
    } finally {
      apiRunningRef.current = false;
      busyRef.current = false;
      setLoading(false);
      refocus();
    }

    if (needResync && f_systemDeliveryCode) {
      // Verrouille les scans le temps de la resynchronisation
      busyRef.current = true;
      try {
        await getListFinishBoxList();
      } finally {
        busyRef.current = false;
        refocus();
      }
    }
  };

  // Toujours pointer vers la dernière version de palletDeal (valeurs du contexte à jour)
  palletDealRef.current = palletDeal;

  const renderItem = ({ item, index }: { item: ItemVO; index: number }) => (
    <View style={[styles.row, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }]}>
      <Text style={[styles.cell, { width: 140 }]}>{item.scanBarCode}</Text>
      <Text style={[styles.cell, { width: 140 }]}>{item.model}</Text>
      <Text style={[styles.cell, { width: 80 }]}>{item.color}</Text>
      <Text style={[styles.cell, { width: 60 }]}>{item.goodsCount}</Text>
      <Text style={[styles.cell, { width: 80 }]}>{item.scanBarCodeType}</Text>
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
          <Text style={styles.headerTitle}>Allocate Out New {gs_wareCode}</Text>
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

        <View style={{ marginBottom: 8 }}>
          <View style={styles.inputGroup}>
            <TextInput
              ref={txtSNRef}
              style={styles.input}
              value={txtSN}
              onChangeText={handleTextChange}
              onSubmitEditing={handleSNSubmit}
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
        </View>

        <View style={styles.listCard}>
          <ScrollView horizontal>
            <View>
              <View style={styles.listHeader}>
                <Text style={[styles.headerCell, { width: 140 }]}>BARCODE</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>MODEL</Text>
                <Text style={[styles.headerCell, { width: 80 }]}>COLOR</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>QTY</Text>
                <Text style={[styles.headerCell, { width: 80 }]}>TYPE</Text>
              </View>
              <FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                  <View style={{ width: 500 }}>
                    <Text style={styles.emptyText}>No items found.</Text>
                  </View>
                }
              />
            </View>
          </ScrollView>
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
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#0052cc",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    backgroundColor: "#0052cc",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  infoLabel: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  infoValue: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },
  inputGroup: { marginTop: 4 },
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