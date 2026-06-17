import React, { useState, useCallback, useEffect, useRef } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  DeviceEventEmitter,
  Animated,
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AnimatedView = Animated.View as any;

type RowType = {
  palletCode: string;
  boxCode: string;
  sn: string;
  model: string;
  color: string;
  boxQty: string;
};



export default function DeliveryFrm({ navigation, route }: any) {
  const { gsURL, setgs_gsURL, operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion, } = useGlobal();
  const BASE_URL = gsURL;
  const { deliveryCode } = route.params || { deliveryCode: "" };
  const [token, setToken] = useState("");

  const global = useGlobal();
  const [barcode, setBarcode] = useState("");
  const [toCkName, setToCkName] = useState("");
  const [totalQty, setTotalQty] = useState("");
  const [rows, setRows] = useState<RowType[]>([]);
  const [loading, setLoading] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);


  const inputRef = useRef<TextInput>(null);
  const scanTimer = useRef<any>(null);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const [scanState, setScanState] = useState<
    "waiting" | "scanning" | "success" | "error"
  >("waiting");

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (scanState === "waiting") {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(borderAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: false,
          }),
          Animated.timing(borderAnim, {
            toValue: 0,
            duration: 700,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
    } else {
      borderAnim.setValue(1);
    }

    return () => {
      animation?.stop();
    };
  }, [scanState]);

  const animatedBorderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange:
      scanState === "waiting"
        ? ["#0052cc", "#60a5fa"]
        : scanState === "scanning"
          ? ["#f59e0b", "#fbbf24"]
          : scanState === "success"
            ? ["#16a34a", "#4ade80"]
            : ["#dc2626", "#f87171"],
  });

  const animatedBorderWidth = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 4],
  });

  const ensureFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  useEffect(() => {
    const loadToken = async () => {
      const t = await AsyncStorage.getItem("userToken");
      console.log("TOKEN IN delivery", t);
      if (t) setToken(t);
    };

    loadToken();
  }, []);


  useEffect(() => {
    if (token) {
      if (deliveryCode) {
        deliveryDeal(deliveryCode);
        fetchDeliveryList(deliveryCode);
      }
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [deliveryCode, token]);

  useEffect(() => {
    if (barcode === "") {
      inputRef.current?.focus();
    }
  }, [barcode]);


  useEffect(() => {
    const subscriptionCancel = DeviceEventEmitter.addListener(
      'ON_DELIVERY_CONFIRM_CANCEL',
      () => {
        setTotalQty("");
        setRows([]);
        inputRef.current?.focus();
      }
    );

    return () => subscriptionCancel.remove();
  }, [token]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('ON_DELIVERY_CONFIRM_OK', (data) => {
      palletDeal(data.barCode, data.scanType);
    });
    return () => subscription.remove();
  }, [token]);

  const fetchDeliveryList = async (code: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/api/DeliveryList`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          operateUserCode,
          operateUserName,
          operateWareHouseCode,
          operateRandomNumber,
          operateSign,
          operateVersion,
          factoryCode: global.gs_factoryCode,
          wareHouseCode: global.gs_wareCode,
          deliveryCode: code,
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.message === "success" && result.data) {
          const newRows = result.data.map((item: any) => ({
            palletCode: item.palletCode || "—",
            boxCode: item.boxCode || "—",
            sn: item.sn || "—",
            model: item.model || "",
            color: item.color || "",
            boxQty: item.boxQty !== undefined ? item.boxQty.toString() : "",
          }));
          setRows(newRows);
          if (result.data.length > 0 && result.data[0].totalQty !== undefined) {
            setTotalQty(result.data[0].totalQty.toString());
          }
        }
      }
    } catch (error) {
      console.error("Error fetching DeliveryList:", error);
    }
  };

  const deliveryDeal = async (code: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/DeliveryCheck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, },
        body: JSON.stringify({
          operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
          deliveryCode: code,
          barCode: "",
          scanType: "",
          factoryCode: global.gs_factoryCode,
          wareHouseCode: global.gs_wareCode
        })
      });

      if (response.status === 401) {
        Alert.alert("Unauthorized", "Token expired or invalid.");
        return;
      }

      if (response.status === 403) {
        Alert.alert("Access Denied", "You do not have permission.");
        return;
      }


      const result = await response.json();
      if (result.message == "success" && result.data) {
        const data = result.data;
        if (data.isok === "1") {
          setToCkName(data.ckName);
        } else {

          Alert.alert("Error", data.retstr || "Validation failed");
          console.log("message1", data.retstr);
          console.log("message1", data);
        }
      } else {
        setScanState("error");
        Alert.alert("Error", "Data handling exceptions, please check!");
        console.log("message2", result.message);
        console.log("message2", result.data);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const getType = async (sn: string) => {
    try {
      const response = await fetch(`${BASE_URL}/api/BarcodeType`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, },
        body: JSON.stringify({
          operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
          factoryCode: global.gs_factoryCode,
          scanCode: sn
        })
      });

      if (response.status === 401) {
        Alert.alert("Unauthorized", "Token expired or invalid.");
        return;
      }

      if (response.status === 403) {
        Alert.alert("Access Denied", "You do not have permission.");
        return;
      }
      const result = await response.json();
      console.log("message3", result);
      if (result.message === "success" && result.data) {
        return result.data.scanType;
      }
      return "";
    } catch (error) {
      console.error(error);
      return "";
    }
  };



  const palletDeal = useCallback(
    async (barCode: string, scanType: string) => {
      setLoading(true);
      setRows([]);

      try {
        const response = await fetch(`${BASE_URL}/api/DeliveryInsert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            operateUserCode,
            operateUserName,
            operateWareHouseCode,
            operateRandomNumber,
            operateSign,
            operateVersion,
            factoryCode: global.gs_factoryCode,
            wareHouseCode: global.gs_wareCode,
            deliveryCode,
            barCode,
            scanType,
            classesCode: global.gs_classCode,
            groupCode: global.gs_groupCode,
            workdate: global.gs_workdate,
            createUser: global.gs_userCode,
          }),
        });

        const result = await response.json();

        console.log('deliveryresult', result);

        if (result.message === 'success' && result.data?.length > 0) {
          const firstItem = result.data[0];

          if (firstItem.isok === '1') {
            setScanState('success');
            setTotalQty(firstItem.totalQty?.toString() || '0');

            if (deliveryCode) {
              await fetchDeliveryList(deliveryCode);
            }

            if (firstItem.isfinish === '1') {
              Alert.alert(
                'Message',
                'The delivery document has already been completely shipped.'
              );
            }
          } else {
            Alert.alert('Error', firstItem.retstr || 'Operation failed');
            console.log('Delivery error:', firstItem);
          }
        } else {
          setScanState('error');
          Alert.alert(
            'Error',
            result.message || 'There is no product in the pallet!'
          );
        }
      } catch (error) {
        setScanState('error');
        console.error(error);
        Alert.alert('Error', 'Failed to process pallet');
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [
      token,
      deliveryCode,
      fetchDeliveryList,
      operateUserCode,
      operateUserName,
      operateWareHouseCode,
      operateRandomNumber,
      operateSign,
      operateVersion,
    ]
  );



  const handleBarcodeChange = (text: string) => {
    if (text.trim() === "") {
      setScanState("waiting");
    } else {
      setScanState("scanning");
    }
    setBarcode(text);
    clearTimeout(scanTimer.current);

    if (text.endsWith("\n") || text.endsWith("\r")) {
      const cleanCode = text.trim();
      if (cleanCode.length > 0) {
        setBarcode(cleanCode);
        handleScan(cleanCode);
      }
      return;
    }

    scanTimer.current = setTimeout(() => {
      const cleanCode = text.trim();
      if (cleanCode.length > 0) {
        handleScan(cleanCode);
        setBarcode("");
      }
    }, 400);
  };

  const handleScan = async (manualCode?: string) => {
    const codeToProcess = typeof manualCode === "string" ? manualCode : barcode;
    if (!codeToProcess.trim()) return;

    clearTimeout(scanTimer.current);
    const sn = codeToProcess.toUpperCase().trim();
    setLoading(true);
    try {
      let scanType = await getType(sn);

      if (scanType === "") {
        scanType = "pallet";
      }

      if (scanType === "pallet" || scanType === "box") {
        const response = await fetch(`${BASE_URL}/api/DeliveryCheck`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, },
          body: JSON.stringify({
            operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
            deliveryCode: deliveryCode,
            barCode: sn,
            scanType: scanType,
            factoryCode: global.gs_factoryCode,
            wareHouseCode: global.gs_wareCode
          })
        });

        if (response.status === 401) {
          Alert.alert("Unauthorized", "Token expired or invalid.");
          return;
        }

        if (response.status === 403) {
          Alert.alert("Access Denied", "You do not have permission.");
          return;
        }
        const result = await response.json();
        if (result.message === "success" && result.data) {
          if (result.data.isok === "1") {
            setScanState("success");
            navigation.navigate('DeliverySNConfirmBox', {
              fromWareHouseCode: global.gs_wareCode,
              barCode: sn,
              scanType: scanType,
              showConfirm: true,
            });
          } else {
            setScanState("error");
            Alert.alert("Error", result.data.retstr || "Validation failed");
            inputRef.current?.focus();
          }
        } else {
          setScanState("error");
          Alert.alert("Error", result.message || "Check failed");
          inputRef.current?.focus();
        }
        return;
      }

      if (scanType === "sn") {
        const response = await fetch(`${BASE_URL}/api/DeliveryCheck`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, },
          body: JSON.stringify({
            operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
            deliveryCode: deliveryCode,
            barCode: sn,
            scanType: "sn",
            factoryCode: global.gs_factoryCode,
            wareHouseCode: global.gs_wareCode
          })
        });

        if (response.status === 401) {
          Alert.alert("Unauthorized", "Token expired or invalid.");
          return;
        }

        if (response.status === 403) {
          Alert.alert("Access Denied", "You do not have permission.");
          return;
        }
        const result = await response.json();

        if (result.code === 500) {
          Alert.alert("Error", result.message);
          navigation.goBack();
          return;
        }
        if (result.message === "success" && result.data) {
          if (result.data.isok === "1") {
            setScanState("success");
            navigation.navigate('DeliverySNConfirm', {
              fromWareHouseCode: global.gs_wareCode,
              palletCode: "",
              boxCode: "",
              SN: sn,
              scanType,
              showConfirm: true
            });
          } else {
            setScanState("error");
            Alert.alert("Error", result.data.retstr || "Validation failed");
            inputRef.current?.focus();
          }
        } else {
          setScanState("error");
          Alert.alert("Error", result.message || "Check failed");
          setBarcode("");
          inputRef.current?.focus();
        }
        setBarcode("");
        return;
      } else {
        setScanState("error");
        Alert.alert("Error", "no type for barcode");
      }


      inputRef.current?.focus();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Scan processing error");
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = () => {

    navigation.navigate('DeliverySNBox', { deliveryCode });
  };

  const columns = [
    { label: "Pallet", width: 140 },
    { label: "Boxcode", width: 140 },
    { label: "SN", width: 140 },
    { label: "Model", width: 100 },
    { label: "Color", width: 90 },
    { label: "Qty", width: 60 },
  ];

  const totalTableWidth = columns.reduce((acc, col) => acc + col.width, 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => {
            DeviceEventEmitter.emit("ON_DELIVERY_REFRESH");
            navigation.goBack();
          }} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Warehouse Delivery</Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{global.gs_userName}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Entry Card */}
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.rightLabel}>From Warehouse</Text>
            <Text style={styles.leftValue}>{toCkName || "--"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.rightLabel}>Total Qty</Text>
            <Text style={styles.leftValue}>{totalQty || "--"}</Text>
          </View>

          <View style={styles.inputGroup}>
            <AnimatedView style={{
              borderRadius: 10,
              borderWidth: animatedBorderWidth,
              borderColor: animatedBorderColor,
              backgroundColor: "#e2f0eeff",
              elevation: 2,
            }}>
              <TextInput
                ref={inputRef}
                style={[styles.input, { borderWidth: 0, elevation: 0 }]}
                value={barcode}
                onChangeText={handleBarcodeChange}
                //onSubmitEditing={() => handleScan()}
                placeholder=" Barcode "
                autoCapitalize="characters"
                showSoftInputOnFocus={showKeyboard}
                blurOnSubmit={false}
                onBlur={ensureFocus}
              />
            </AnimatedView>
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={{ width: totalTableWidth }}>
              <View style={styles.tableHeader}>
                {columns.map((col) => (
                  <Text key={col.label} style={[styles.headerCell, { width: col.width }]}>
                    {col.label}
                  </Text>
                ))}
              </View>

              <ScrollView style={{ flex: 1 }}>
                {rows.length > 0 ? (
                  rows.map((item, index) => (
                    <View key={index} style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" }]}>
                      <Text style={[styles.cell, { width: columns[0].width }]}>{item.palletCode}</Text>
                      <Text style={[styles.cell, { width: columns[1].width }]}>{item.boxCode}</Text>
                      <Text style={[styles.cell, { width: columns[2].width }]}>{item.sn}</Text>
                      <Text style={[styles.cell, { width: columns[3].width }]}>{item.model}</Text>
                      <Text style={[styles.cell, { width: columns[4].width }]}>{item.color}</Text>
                      <Text style={[styles.cell, { width: columns[5].width }]}>{item.boxQty}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.emptyText, { width: totalTableWidth }]}>No items scanned yet</Text>
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>

        {/* Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.detailButton}
            onPress={viewDetails}
          >
            <Text style={styles.detailButtonText}> Barcode Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");
const isSmallDevice = width < 360;
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  returnLogo: {
    width: scale(24),
    height: scale(24),
    marginRight: 10,
    tintColor: "#FFFFFF",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: isSmallDevice ? scale(14) : scale(16),
    fontWeight: "900",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  userNameText: {
    color: "#FFFFFF",
    fontSize: scale(12),
    fontWeight: "700",
    marginRight: 1,
  },
  content: { flex: 1, padding: 8 },
  card: { backgroundColor: "#FFF", borderRadius: 16, padding: 8, marginBottom: 8, elevation: 2, borderWidth: 1, borderColor: "#0052cc" },
  inputGroup: { marginBottom: 4 },
  input: { backgroundColor: "#e2f0eeff", height: 40, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 0, fontSize: 17, color: "#334155", fontWeight: "600", borderWidth: 1, borderColor: "#0052cc" },
  disabledInput: { backgroundColor: "#E2E8F0", color: "#64748B" },
  inputGroup1: { marginBottom: 4 },
  input1: { backgroundColor: "#0052cc", height: 35, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 0, fontSize: 13, color: "#FFFFFF", fontWeight: "600", borderWidth: 1, borderColor: "#CBD5E1" },
  disabledInput1: { backgroundColor: "#0052cc", color: "#FFFFFF" },
  tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#0052cc", marginBottom: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
  headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
  emptyText: { textAlign: "center", color: "#94A3B8", marginTop: 40, fontStyle: "italic" },
  footer: { flexDirection: "row", gap: 12 },
  detailButton: { flex: 1, backgroundColor: "#4F46E5", padding: 12, paddingTop: 8, borderRadius: 12, alignItems: "center", height: 40 },
  detailButtonText: { color: "#FFF", fontWeight: "900", fontSize: 15 },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0052cc",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 35,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },

  rightLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },

  leftValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "left",
  },
});
